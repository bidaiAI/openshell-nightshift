import type {
  ActionLogEntry,
  AssignmentRecord,
  ReceiptArtifact,
  ReceiptStatus,
  WorkerRuntimeResult,
} from '@nightshift/common'
import { generateId, hashCanonicalJson, hashParts } from '@nightshift/common'
import { commitReceipt, createReceipt } from './receipt.js'
import { ModelAdapterRegistry, createModelAdapterRegistry } from './model-adapters.js'
import type { WorkerConfig } from './config.js'

export interface ExecutionContext {
  assignment: AssignmentRecord
  input: Record<string, unknown>
  now?: () => string
}

export interface ExecutionOutcome {
  success: boolean
  status: ReceiptStatus
  summary: string
  actionLog: readonly ActionLogEntry[]
  artifacts: readonly ReceiptArtifact[]
  result: Record<string, unknown>
  selectiveReveal?: Record<string, unknown>
}

export interface LocalExecutor {
  execute(context: ExecutionContext): Promise<ExecutionOutcome>
}

export type TaskHandler = (context: ExecutionContext) => Promise<ExecutionOutcome> | ExecutionOutcome

export interface LocalExecutorOptions {
  modelRegistry?: ModelAdapterRegistry
}

export function createLocalExecutor(handler?: TaskHandler, options?: LocalExecutorOptions): LocalExecutor {
  return {
    async execute(context: ExecutionContext): Promise<ExecutionOutcome> {
      if (handler) return handler(context)
      return defaultExecutionOutcome(context, options?.modelRegistry)
    },
  }
}

export function createExecutorFromConfig(config: WorkerConfig, handler?: TaskHandler): LocalExecutor {
  return createLocalExecutor(handler, {
    modelRegistry: createModelAdapterRegistry(config.modelProviders),
  })
}

export async function runTaskExecution(context: ExecutionContext, executor: LocalExecutor): Promise<WorkerRuntimeResult> {
  const outcome = await executor.execute(context)
  const receipt = createReceipt({
    assignment: context.assignment,
    outcome,
    ...(context.now ? { now: context.now } : {}),
  })

  return {
    assignmentId: context.assignment.id,
    workerId: context.assignment.workerAddress,
    success: outcome.success,
    status: outcome.status,
    receipt,
    receiptCommitment: commitReceipt(receipt),
    result: outcome.result,
    notes: outcome.summary,
  }
}

async function defaultExecutionOutcome(context: ExecutionContext, modelRegistry?: ModelAdapterRegistry): Promise<ExecutionOutcome> {
  const timestamp = context.now?.() ?? new Date().toISOString()
  const selectedAdapter = modelRegistry?.select(context.assignment.execution?.llm)
  const adapterResult = selectedAdapter
    ? await selectedAdapter.invoke(context.assignment.execution?.invocation, {
        assignmentId: context.assignment.id,
        taskId: context.assignment.taskId,
        input: context.input,
      })
    : null

  const actionLog: ActionLogEntry[] = [
    {
      step: 'assignment-received',
      ts: timestamp,
      details: {
        assignmentId: context.assignment.id,
        taskId: context.assignment.taskId,
        workerId: context.assignment.workerAddress,
      },
    },
  ]

  if (selectedAdapter) {
    actionLog.push({
      step: 'model-adapter-selected',
      ts: timestamp,
      details: {
        provider: selectedAdapter.descriptor.provider,
        model: selectedAdapter.descriptor.model,
        transport: context.assignment.execution?.transport ?? 'http-poller',
      },
    })
  }

  const result = {
    assignmentId: context.assignment.id,
    taskId: context.assignment.taskId,
    workerId: context.assignment.workerAddress,
    acknowledged: true,
    transport: context.assignment.execution?.transport ?? 'http-poller',
    executionMode: context.assignment.execution?.mode ?? 'tool-only',
    modelProvider: selectedAdapter?.descriptor.provider ?? null,
    modelName: selectedAdapter?.descriptor.model ?? null,
    invocation: context.assignment.execution?.invocation ?? null,
    adapterResult,
  }

  return {
    success: true,
    status: 'generated',
    summary: selectedAdapter
      ? `Execution stub completed via ${selectedAdapter.descriptor.provider}/${selectedAdapter.descriptor.model}.`
      : 'Execution stub completed successfully.',
    actionLog,
    artifacts: [],
    result,
    selectiveReveal: {
      assignmentId: context.assignment.id,
      taskId: context.assignment.taskId,
      ...(selectedAdapter
        ? {
            provider: selectedAdapter.descriptor.provider,
            model: selectedAdapter.descriptor.model,
          }
        : {}),
    },
  }
}

export function buildExecutionEnvelope(context: ExecutionContext, outcome: ExecutionOutcome): Record<string, unknown> {
  return {
    envelopeId: generateId('envelope'),
    assignmentId: context.assignment.id,
    taskId: context.assignment.taskId,
    workerId: context.assignment.workerAddress,
    resultHash: hashCanonicalJson(outcome.result),
    actionLogHash: hashParts(outcome.actionLog.map(entry => [entry.step, entry.ts, entry.details ?? {}])),
    summary: outcome.summary,
  }
}
