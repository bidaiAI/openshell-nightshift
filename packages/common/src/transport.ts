import type { AssignmentEntity, AssignmentStatus, ExecutionReceipt, ISODateString, ReceiptCommitment, ReceiptStatus } from './domain.js'
import type { ModelProviderDescriptor, TransportKind } from './execution.js'

export interface WorkerIdentity {
  workerId: string
  displayName: string
  endpoint?: string
  capabilities: readonly string[]
  chain?: string
  providers?: readonly ModelProviderDescriptor[]
  transports?: readonly TransportKind[]
}

export interface AssignmentPollRequest {
  worker: WorkerIdentity
  maxItems?: number
  supportedStatuses?: readonly AssignmentStatus[]
}

export interface AssignmentPollResponse {
  assignments: readonly AssignmentEntity[]
  nextPollAfterMs: number
  serverTime: ISODateString
}

export interface AssignmentSubmission {
  assignmentId: string
  workerId: string
  receipt: ExecutionReceipt
  receiptCommitment: ReceiptCommitment
  result: Record<string, unknown>
  payload?: Record<string, unknown>
}

export interface WorkerRuntimeResult {
  assignmentId: string
  workerId: string
  success: boolean
  status: ReceiptStatus
  receipt: ExecutionReceipt
  receiptCommitment: ReceiptCommitment
  result: Record<string, unknown>
  notes?: string
}
