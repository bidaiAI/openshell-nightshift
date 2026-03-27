export type ISODateString = string
export type HexString = `0x${string}`

export type CurrencyCode = 'MID' | 'USDC' | 'USDT' | (string & {})
export type TaskVisibility = 'public' | 'private' | 'selective'

export type TaskStatus = 'open' | 'assigned' | 'submitted' | 'settled' | 'disputed' | 'cancelled'
export type TaskDraftStatus = 'draft' | TaskStatus
export type BidStatus = 'sealed' | 'selected' | 'rejected' | 'withdrawn'
export type AssignmentStatus = 'queued' | 'accepted' | 'in_progress' | 'submitted' | 'cancelled' | 'completed'
export type ReceiptStatus = 'generated' | 'submitted' | 'verified' | 'rejected'
export type DisputeStatus = 'open' | 'revealed' | 'resolved' | 'dismissed'
export type DisputeReasonCode = 'quality' | 'missing-artifacts' | 'policy' | 'timeout' | 'payment' | 'other'

export interface MoneyAmount {
  currency: CurrencyCode
  amount: string
  decimals: number
}

export interface TaskPrivacySettings {
  publicSummary: string
  privateBrief?: string
  revealOnAcceptance?: boolean
  revealOnDispute?: boolean
}

export interface PublicTaskPrivacyView {
  publicSummary: string
  revealOnAcceptance?: boolean
  revealOnDispute?: boolean
}

export interface TaskDraft {
  taskId: string
  ownerId: string
  title: string
  reward: MoneyAmount
  status: TaskDraftStatus
  createdAt: ISODateString
  deadlineAt?: ISODateString
  tags: readonly string[]
  privacy: TaskPrivacySettings
  publicMetadata?: Record<string, unknown>
  privateMetadata?: Record<string, unknown>
}

export interface PublicTaskView {
  taskId: string
  title: string
  summary: string
  reward: MoneyAmount
  status: TaskDraftStatus
  createdAt: ISODateString
  deadlineAt?: ISODateString
  tags: readonly string[]
  privacy: PublicTaskPrivacyView
  metadataCommitment: HexString
}

export interface PrivateTaskPayload {
  taskId: string
  privateBrief?: string
  instructions?: string
  attachments?: readonly string[]
  privateMetadata?: Record<string, unknown>
}

export interface TaskCommitment {
  taskId: string
  metadataCommitment: HexString
  payloadCommitment: HexString
  createdAt: ISODateString
}

export type CompactTaskPhase =
  | 'sealed-bidding'
  | 'assignment-active'
  | 'receipt-submitted'
  | 'dispute-open'
  | 'settled'
  | 'cancelled'

export interface CompactProjectionInput {
  label: string
  value: string
}

export interface CompactProjection {
  contract: 'NightShiftTaskEscrow'
  phase: CompactTaskPhase
  stateCommitment: HexString
  nextTransition: string
  publicInputs: readonly CompactProjectionInput[]
  privateWitness: readonly string[]
}

export interface TaskDraftSplit {
  publicView: PublicTaskView
  privatePayload: PrivateTaskPayload
  commitment: TaskCommitment
}

export interface BidDraft {
  bidId: string
  taskId: string
  bidderId: string
  amount: MoneyAmount
  status: BidStatus
  createdAt: ISODateString
  proposalSummary: string
  proposalCommitment: HexString
  privateNote?: string
}

export interface PublicBidView {
  bidId: string
  taskId: string
  bidderId: string
  amount: MoneyAmount
  status: BidStatus
  createdAt: ISODateString
  proposalSummary: string
  proposalCommitment: HexString
}

export interface BidCommitment {
  bidId: string
  taskId: string
  proposalCommitment: HexString
  amountCommitment: HexString
  createdAt: ISODateString
}

import type { TaskExecutionRequirements, WorkerExecutionOffer } from './execution.js'

export interface TaskEntity {
  id: string
  employerAddress: string
  title: string
  publicSummary: string
  rewardAmount: string
  rewardAsset: CurrencyCode
  visibility: TaskVisibility
  taskCommitment: string
  encryptedTaskRef?: string
  deadlineAt?: ISODateString
  status: TaskStatus
  createdAt: ISODateString
  updatedAt: ISODateString
  execution?: TaskExecutionRequirements
  compactProjection?: CompactProjection
}

export interface BidEntity {
  id: string
  taskId: string
  workerAddress: string
  bidCommitment: string
  encryptedBidRef?: string
  priceQuote?: string
  etaHours?: number
  status: BidStatus
  createdAt: ISODateString
  executionOffer?: WorkerExecutionOffer
}

export interface AssignmentEntity {
  id: string
  taskId: string
  bidId: string
  workerAddress: string
  employerAddress: string
  status: AssignmentStatus
  createdAt: ISODateString
  updatedAt: ISODateString
  acceptedAt?: ISODateString
  startedAt?: ISODateString
  submittedAt?: ISODateString
  completedAt?: ISODateString
  dueAt?: ISODateString
  taskCommitment: string
  bidCommitment: string
  execution?: TaskExecutionRequirements
}

export interface ReceiptEntity {
  id: string
  taskId: string
  assignmentId: string
  workerId: string
  status: ReceiptStatus
  receiptCommitment: string
  resultPreview?: string
  artifactRefs: readonly string[]
  receiptRef?: string
  actionLogHash?: HexString
  artifactHash?: HexString
  resultHash?: HexString
  createdAt: ISODateString
}

export interface ActionLogEntry {
  step: string
  ts: ISODateString
  details?: Record<string, unknown>
}

export interface ReceiptArtifact {
  kind: 'log' | 'screenshot' | 'file' | 'snapshot' | 'custom'
  name: string
  contentHash: HexString
  contentType?: string
}

export interface ExecutionReceipt {
  receiptId: string
  assignmentId: string
  taskId: string
  bidId: string
  workerId: string
  status: ReceiptStatus
  startedAt: ISODateString
  finishedAt: ISODateString
  actionLogHash: HexString
  artifactHash: HexString
  resultHash: HexString
  summary: string
  artifacts: readonly ReceiptArtifact[]
  actionLog: readonly ActionLogEntry[]
  selectiveReveal?: Record<string, unknown>
}

export interface ReceiptCommitment {
  receiptId: string
  assignmentId: string
  receiptHash: HexString
  createdAt: ISODateString
}

export interface DisputeReveal {
  revealBundleHash: HexString
  revealedBy: string
  revealReason: string
  revealedFields: readonly string[]
  revealRef?: string
  createdAt: ISODateString
}

export interface DisputeEntity {
  id: string
  taskId: string
  assignmentId: string
  openedBy: string
  openerRole: 'employer' | 'worker'
  reasonCode: DisputeReasonCode
  summary: string
  status: DisputeStatus
  requestedFields: readonly string[]
  createdAt: ISODateString
  updatedAt: ISODateString
  reveal?: DisputeReveal
}

export interface TaskStateTransition {
  from: TaskStatus
  to: TaskStatus
  reason: string
  at: ISODateString
}

export type TaskRecord = TaskEntity
export type BidRecord = BidEntity
export type AssignmentRecord = AssignmentEntity
export type ReceiptRecord = ReceiptEntity
export type DisputeRecord = DisputeEntity
