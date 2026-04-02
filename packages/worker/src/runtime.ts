import type { AssignmentRecord, WorkerIdentity, WorkerRuntimeResult } from '@nightshift/common'
import { buildAssignmentSubmission } from '@nightshift/common'
import { loadWorkerConfig, validateWorkerConfig, type WorkerConfig } from './config.js'
import { createExecutorFromConfig, runTaskExecution, type LocalExecutor } from './executor.js'
import { FetchPollerTransport } from './http-transport.js'
import { HttpAssignmentPollClient } from './poller.js'

export interface WorkerRunSummary {
  ok: boolean
  assignmentCount: number
  submittedCount: number
  issues: string[]
  results: WorkerRuntimeResult[]
}

export function createWorkerIdentity(config: WorkerConfig): WorkerIdentity {
  return {
    workerId: config.workerId,
    displayName: config.workerName,
    capabilities: config.capabilities,
    ...(config.walletAddress ? { endpoint: config.walletAddress } : {}),
    chain: config.supportedChains[0] ?? 'midnight',
    providers: config.modelProviders,
    transports: config.supportedTransports,
  }
}

export async function runWorkerOnce(
  config: WorkerConfig = loadWorkerConfig(),
  executor: LocalExecutor = createExecutorFromConfig(config),
): Promise<WorkerRunSummary> {
  const issues = validateWorkerConfig(config).map((issue) => `${issue.field}: ${issue.message}`)
  if (issues.length > 0) {
    return {
      ok: false,
      assignmentCount: 0,
      submittedCount: 0,
      issues,
      results: [],
    }
  }

  const transport = new FetchPollerTransport({
    baseUrl: config.apiBaseUrl,
    headers: {
      ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
      'X-NightShift-Actor-Id': config.workerId,
      'X-NightShift-Actor-Role': 'worker',
    },
  })
  const client = new HttpAssignmentPollClient(transport)
  const worker = createWorkerIdentity(config)

  const pollResponse = await client.pollAssignments({
    worker,
    maxItems: config.maxConcurrentAssignments,
  })

  const results: WorkerRuntimeResult[] = []

  for (const assignment of pollResponse.assignments) {
    await client.acknowledgeAssignment(assignment.id)
    const result = await runSingleAssignment(assignment, executor)
    await client.submitAssignmentResult(buildAssignmentSubmission(result, {
      transport: 'http-poller',
      submittedAt: new Date().toISOString(),
    }))
    results.push(result)
  }

  return {
    ok: true,
    assignmentCount: pollResponse.assignments.length,
    submittedCount: results.length,
    issues: [],
    results,
  }
}

export async function runWorkerLoop(options?: {
  iterations?: number
  config?: WorkerConfig
  executor?: LocalExecutor
  sleep?: (ms: number) => Promise<void>
}): Promise<WorkerRunSummary[]> {
  const config = options?.config ?? loadWorkerConfig()
  const executor = options?.executor ?? createExecutorFromConfig(config)
  const sleep = options?.sleep ?? defaultSleep
  const iterations = options?.iterations ?? 1
  const summaries: WorkerRunSummary[] = []

  for (let index = 0; index < iterations; index += 1) {
    const summary = await runWorkerOnce(config, executor)
    summaries.push(summary)

    if (index < iterations - 1) {
      await sleep(config.pollIntervalMs)
    }
  }

  return summaries
}

async function runSingleAssignment(assignment: AssignmentRecord, executor: LocalExecutor): Promise<WorkerRuntimeResult> {
  return runTaskExecution(
    {
      assignment,
      input: {
        assignmentId: assignment.id,
        taskId: assignment.taskId,
        taskCommitment: assignment.taskCommitment,
        bidCommitment: assignment.bidCommitment,
      },
    },
    executor,
  )
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
