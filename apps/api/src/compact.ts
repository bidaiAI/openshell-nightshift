import type {
  AssignmentRecord,
  BidRecord,
  CompactProjection,
  CompactProjectionInput,
  DisputeRecord,
  ReceiptRecord,
  TaskRecord,
} from '@nightshift/common'
import { hashCanonicalJson } from '@nightshift/common'

type CompactContext = {
  selectedBid?: BidRecord
  activeAssignment?: AssignmentRecord
  latestReceipt?: ReceiptRecord
  activeDispute?: DisputeRecord
}

export function buildCompactProjection(task: TaskRecord, context: CompactContext = {}): CompactProjection {
  const phase = derivePhase(task.status)
  const inputs: CompactProjectionInput[] = [
    { label: 'taskCommitment', value: task.taskCommitment },
  ]

  if (context.selectedBid?.bidCommitment) {
    inputs.push({ label: 'bidCommitment', value: context.selectedBid.bidCommitment })
  }

  if (context.activeAssignment?.id) {
    inputs.push({ label: 'assignmentId', value: context.activeAssignment.id })
  }

  if (context.latestReceipt?.receiptCommitment) {
    inputs.push({ label: 'receiptCommitment', value: context.latestReceipt.receiptCommitment })
  }

  if (context.activeDispute?.id) {
    inputs.push({ label: 'disputeId', value: context.activeDispute.id })
  }

  const privateWitness = derivePrivateWitness(task, context)
  const nextTransition = deriveNextTransition(phase)
  const stateCommitment = hashCanonicalJson({
    contract: 'NightShiftTaskEscrow',
    taskId: task.id,
    phase,
    inputs,
    privateWitness,
    nextTransition,
  })

  return {
    contract: 'NightShiftTaskEscrow',
    phase,
    stateCommitment,
    nextTransition,
    publicInputs: inputs,
    privateWitness,
  }
}

function derivePhase(status: TaskRecord['status']): CompactProjection['phase'] {
  switch (status) {
    case 'open':
      return 'sealed-bidding'
    case 'assigned':
      return 'assignment-active'
    case 'submitted':
      return 'receipt-submitted'
    case 'disputed':
      return 'dispute-open'
    case 'settled':
      return 'settled'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'sealed-bidding'
  }
}

function deriveNextTransition(phase: CompactProjection['phase']): string {
  switch (phase) {
    case 'sealed-bidding':
      return 'selectBid()'
    case 'assignment-active':
      return 'submitReceipt()'
    case 'receipt-submitted':
      return 'settle() or openDispute()'
    case 'dispute-open':
      return 'submitReveal() or resolveDispute()'
    case 'settled':
      return 'finalized'
    case 'cancelled':
      return 'closed'
    default:
      return 'selectBid()'
  }
}

function derivePrivateWitness(task: TaskRecord, context: CompactContext): string[] {
  const witness = new Set<string>()

  if (task.visibility !== 'public') {
    witness.add('encryptedTaskRef')
  }

  if (context.selectedBid?.encryptedBidRef) {
    witness.add('encryptedBidRef')
  }

  if (context.latestReceipt?.receiptRef) {
    witness.add('receiptArtifactBundle')
  }

  if (context.activeDispute?.reveal?.revealBundleHash || context.activeDispute?.reveal?.revealRef) {
    witness.add('selectiveRevealBundle')
  }

  if (task.execution?.llm?.providerAllowlist?.length || task.execution?.toolProfile?.length) {
    witness.add('executionWitness')
  }

  return [...witness]
}
