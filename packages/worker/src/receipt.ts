import type {
  ActionLogEntry,
  AssignmentRecord,
  AssignmentSubmission,
  ExecutionReceipt,
  ReceiptArtifact,
  ReceiptCommitment,
  WorkerRuntimeResult,
} from '@nightshift/common'
import { buildAssignmentSubmission, hashCanonicalJson, hashParts } from '@nightshift/common'
import { randomUUID } from 'node:crypto'
import type { ExecutionOutcome } from './executor.js'

export interface ReceiptInput {
  assignment: AssignmentRecord
  outcome: ExecutionOutcome
  now?: () => string
}

export function createReceipt(input: ReceiptInput): ExecutionReceipt {
  const startedAt = input.assignment.startedAt ?? input.assignment.acceptedAt ?? input.assignment.createdAt
  const finishedAt = input.now?.() ?? new Date().toISOString()
  const actionLog = input.outcome.actionLog
  const artifacts = input.outcome.artifacts

  const actionLogHash = hashActionLog(actionLog)
  const artifactHash = hashArtifacts(artifacts)
  const resultHash = hashCanonicalJson(input.outcome.result)

  return {
    receiptId: randomUUID(),
    assignmentId: input.assignment.id,
    taskId: input.assignment.taskId,
    bidId: input.assignment.bidId,
    workerId: input.assignment.workerAddress,
    status: input.outcome.status,
    startedAt,
    finishedAt,
    actionLogHash,
    artifactHash,
    resultHash,
    summary: input.outcome.summary,
    artifacts,
    actionLog,
    ...(input.outcome.selectiveReveal ? { selectiveReveal: input.outcome.selectiveReveal } : {}),
  }
}

export function commitReceipt(receipt: ExecutionReceipt): ReceiptCommitment {
  return {
    receiptId: receipt.receiptId,
    assignmentId: receipt.assignmentId,
    receiptHash: hashCanonicalJson({
      receiptId: receipt.receiptId,
      assignmentId: receipt.assignmentId,
      taskId: receipt.taskId,
      workerId: receipt.workerId,
      status: receipt.status,
      actionLogHash: receipt.actionLogHash,
      artifactHash: receipt.artifactHash,
      resultHash: receipt.resultHash,
    }),
    createdAt: receipt.finishedAt,
  }
}

export function hashActionLog(actionLog: readonly ActionLogEntry[]): `0x${string}` {
  return hashParts(actionLog.map(entry => [entry.step, entry.ts, entry.details ?? {}]))
}

export function hashArtifacts(artifacts: readonly ReceiptArtifact[]): `0x${string}` {
  return hashCanonicalJson(artifacts)
}

export function buildSubmissionPayload(result: WorkerRuntimeResult): AssignmentSubmission {
  return buildAssignmentSubmission(
    result,
    result.notes !== undefined ? { notes: result.notes } : {},
  )
}
