import type {
  AssignmentSubmission,
  BidDisplayStatus,
  BidStatus,
  TaskDisplayStatus,
  TaskStatus,
  WorkerRuntimeResult,
} from './types.js'

const TASK_STATUS_TO_DISPLAY_MAP: Record<TaskStatus, TaskDisplayStatus> = {
  open: 'open',
  assigned: 'assigned',
  submitted: 'delivered',
  settled: 'settled',
  disputed: 'disputed',
  cancelled: 'cancelled',
}

const BID_STATUS_TO_DISPLAY_MAP: Record<Exclude<BidStatus, 'withdrawn'>, BidDisplayStatus> & { withdrawn: BidDisplayStatus } = {
  sealed: 'pending',
  selected: 'accepted',
  rejected: 'rejected',
  withdrawn: 'rejected',
}

export function toTaskDisplayStatus(status: TaskStatus): TaskDisplayStatus {
  return TASK_STATUS_TO_DISPLAY_MAP[status]
}

export function toBidDisplayStatus(status: BidStatus): BidDisplayStatus {
  return BID_STATUS_TO_DISPLAY_MAP[status]
}

export function buildAssignmentSubmission(
  result: WorkerRuntimeResult,
  payload: Record<string, unknown> = {},
): AssignmentSubmission {
  return {
    assignmentId: result.assignmentId,
    workerId: result.workerId,
    receipt: result.receipt,
    receiptCommitment: result.receiptCommitment,
    result: result.result,
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  }
}
