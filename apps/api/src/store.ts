import type {
  AssignmentPollResponse,
  AssignmentSubmission,
  AssignmentRecord,
  BidRecord,
  DisputeReasonCode,
  DisputeRecord,
  ReceiptRecord,
  TaskRecord,
  WorkerExecutionOffer,
  WorkerRuntimeResult,
} from '@nightshift/common'
import { evaluateWorkerExecutionCompatibility, hashCanonicalJson, hashParts } from '@nightshift/common'
import { randomUUID } from 'node:crypto'

export const DEFAULT_WORKSPACE_ID = 'public-beta'
const DEFAULT_WORKSPACE_TTL_MS = 1000 * 60 * 60 * 6
const MAX_WORKSPACES = 200

interface CreateTaskInput
  extends Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> {}

interface CreateBidInput
  extends Omit<BidRecord, 'id' | 'createdAt' | 'status'> {}

interface CreateAssignmentInput
  extends Omit<AssignmentRecord, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'taskCommitment' | 'bidCommitment' | 'execution'> {}

interface CreateDisputeInput {
  taskId: string
  assignmentId: string
  openedBy: string
  openerRole: 'employer' | 'worker'
  reasonCode: DisputeReasonCode
  summary: string
  requestedFields?: readonly string[]
}

interface SubmitRevealInput {
  disputeId: string
  actorId: string
  revealReason: string
  revealedFields: readonly string[]
  revealBundleHash: `0x${string}`
  revealRef?: string
}

const now = () => new Date().toISOString()

export class NightShiftStoreError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message)
    this.name = 'NightShiftStoreError'
  }
}

export class InMemoryNightShiftStore {
  private readonly tasks = new Map<string, TaskRecord>()
  private readonly bids = new Map<string, BidRecord>()
  private readonly assignments = new Map<string, AssignmentRecord>()
  private readonly receipts = new Map<string, ReceiptRecord>()
  private readonly disputes = new Map<string, DisputeRecord>()

  constructor(seedInitialData = true) {
    if (seedInitialData) {
      this.seedInitialData()
    }
  }

  listTasks(): TaskRecord[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId)
  }

  createTask(input: CreateTaskInput): TaskRecord {
    const timestamp = now()
    const record: TaskRecord = {
      ...input,
      id: randomUUID(),
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.tasks.set(record.id, record)
    return record
  }

  listBids(taskId: string): BidRecord[] {
    return [...this.bids.values()]
      .filter((bid) => bid.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  createBid(input: CreateBidInput): BidRecord {
    const task = this.tasks.get(input.taskId)
    if (!task) {
      throw new NightShiftStoreError('task_not_found')
    }

    if (task.status !== 'open') {
      throw new NightShiftStoreError('task_not_open_for_bids')
    }

    if (task.execution) {
      const compatibility = evaluateWorkerExecutionCompatibility(task.execution, input.executionOffer)
      if (!compatibility.compatible) {
        throw new NightShiftStoreError(`worker_offer_${compatibility.reason}`)
      }
    }

    const record: BidRecord = {
      ...input,
      id: randomUUID(),
      status: 'sealed',
      createdAt: now(),
    }
    this.bids.set(record.id, record)
    return record
  }

  getBid(bidId: string): BidRecord | undefined {
    return this.bids.get(bidId)
  }

  createAssignment(input: CreateAssignmentInput): AssignmentRecord {
    const task = this.tasks.get(input.taskId)
    const bid = this.bids.get(input.bidId)
    const timestamp = now()

    if (!task) {
      throw new NightShiftStoreError('task_not_found')
    }

    if (!bid || bid.taskId !== input.taskId) {
      throw new NightShiftStoreError('invalid_bid_for_task')
    }

    if (bid.workerAddress !== input.workerAddress) {
      throw new NightShiftStoreError('worker_bid_mismatch')
    }

    if (task.employerAddress !== input.employerAddress) {
      throw new NightShiftStoreError('employer_task_mismatch')
    }

    if (task.status !== 'open') {
      throw new NightShiftStoreError('task_not_open_for_assignment')
    }

    if (task.execution) {
      const compatibility = evaluateWorkerExecutionCompatibility(task.execution, bid.executionOffer)
      if (!compatibility.compatible) {
        throw new NightShiftStoreError(`worker_offer_${compatibility.reason}`)
      }
    }

    const assignment: AssignmentRecord = {
      ...input,
      id: randomUUID(),
      status: 'queued',
      createdAt: timestamp,
      updatedAt: timestamp,
      taskCommitment: task.taskCommitment,
      bidCommitment: bid.bidCommitment,
      ...(task.deadlineAt ? { dueAt: task.deadlineAt } : {}),
      ...(task.execution ? { execution: task.execution } : {}),
    }

    this.tasks.set(task.id, { ...task, status: 'assigned', updatedAt: timestamp })
    this.bids.set(bid.id, { ...bid, status: 'selected' })
    this.assignments.set(assignment.id, assignment)
    return assignment
  }

  getAssignment(assignmentId: string): AssignmentRecord | undefined {
    return this.assignments.get(assignmentId)
  }

  listAssignments(taskId?: string): AssignmentRecord[] {
    return [...this.assignments.values()]
      .filter((assignment) => !taskId || assignment.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getDashboardSummary() {
    const tasks = [...this.tasks.values()]
    const assignments = [...this.assignments.values()]
    const receipts = [...this.receipts.values()]

    return {
      taskCount: tasks.length,
      openTaskCount: tasks.filter((task) => task.status === 'open').length,
      assignedTaskCount: tasks.filter((task) => task.status === 'assigned').length,
      submittedTaskCount: tasks.filter((task) => task.status === 'submitted').length,
      settledTaskCount: tasks.filter((task) => task.status === 'settled').length,
      bidCount: this.bids.size,
      assignmentCount: assignments.length,
      activeAssignmentCount: assignments.filter((assignment) => assignment.status !== 'completed' && assignment.status !== 'cancelled').length,
      receiptCount: receipts.length,
    }
  }

  listReceipts(taskId: string): ReceiptRecord[] {
    return [...this.receipts.values()]
      .filter((receipt) => receipt.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  listDisputes(taskId?: string): DisputeRecord[] {
    return [...this.disputes.values()]
      .filter((dispute) => !taskId || dispute.taskId === taskId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  acceptAssignment(taskId: string, assignmentId: string): AssignmentRecord | undefined {
    const assignment = this.assignments.get(assignmentId)
    if (!assignment) return undefined

    if (assignment.taskId !== taskId) {
      throw new NightShiftStoreError('invalid_assignment_for_task')
    }

    if (assignment.status !== 'submitted') {
      throw new NightShiftStoreError('assignment_not_submitted')
    }

    const task = this.tasks.get(taskId)
    const openDispute = this.listDisputes(taskId).find((dispute) => dispute.assignmentId === assignmentId && (dispute.status === 'open' || dispute.status === 'revealed'))
    if (openDispute) {
      throw new NightShiftStoreError('assignment_under_dispute')
    }

    if (!task || (task.status !== 'submitted' && task.status !== 'disputed')) {
      throw new NightShiftStoreError('task_not_settleable')
    }

    const timestamp = now()
    const accepted = {
      ...assignment,
      status: 'completed' as const,
      updatedAt: timestamp,
      completedAt: timestamp,
    }
    this.assignments.set(assignmentId, accepted)

    this.tasks.set(task.id, { ...task, status: 'settled', updatedAt: timestamp })

    return accepted
  }

  listAssignmentsForWorker(workerId: string): AssignmentRecord[] {
    return [...this.assignments.values()]
      .filter((assignment) =>
        assignment.workerAddress === workerId
        && (assignment.status === 'queued' || assignment.status === 'accepted' || assignment.status === 'in_progress'))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  acknowledgeAssignment(assignmentId: string): AssignmentRecord | undefined {
    const assignment = this.assignments.get(assignmentId)
    if (!assignment) return undefined

    if (assignment.status === 'cancelled' || assignment.status === 'completed' || assignment.status === 'submitted') {
      throw new NightShiftStoreError('assignment_not_acknowledgeable')
    }

    const timestamp = now()
    const acknowledged: AssignmentRecord = {
      ...assignment,
      status: assignment.status === 'in_progress' ? 'in_progress' : 'accepted',
      acceptedAt: assignment.acceptedAt ?? timestamp,
      startedAt: assignment.startedAt ?? timestamp,
      updatedAt: timestamp,
    }

    this.assignments.set(assignmentId, acknowledged)
    return acknowledged
  }

  recordWorkerSubmission(submission: AssignmentSubmission): WorkerRuntimeResult {
    const timestamp = now()
    const assignment = this.assignments.get(submission.assignmentId)

    if (!assignment) {
      throw new NightShiftStoreError('assignment_not_found')
    }

    if (assignment.status === 'submitted' || assignment.status === 'completed' || assignment.status === 'cancelled') {
      throw new NightShiftStoreError('assignment_not_submittable')
    }

    if (assignment.workerAddress !== submission.workerId) {
      throw new NightShiftStoreError('worker_assignment_mismatch')
    }

    if (
      submission.receipt.assignmentId !== assignment.id
      || submission.receipt.taskId !== assignment.taskId
      || submission.receipt.bidId !== assignment.bidId
      || submission.receipt.workerId !== assignment.workerAddress
    ) {
      throw new NightShiftStoreError('receipt_assignment_mismatch')
    }

    if (this.receipts.has(submission.receipt.receiptId)) {
      throw new NightShiftStoreError('duplicate_receipt')
    }

    const expectedActionLogHash = hashParts(
      submission.receipt.actionLog.map((entry) => [entry.step, entry.ts, entry.details ?? {}]),
    )
    if (expectedActionLogHash !== submission.receipt.actionLogHash) {
      throw new NightShiftStoreError('invalid_action_log_hash')
    }

    const expectedArtifactHash = hashCanonicalJson(submission.receipt.artifacts)
    if (expectedArtifactHash !== submission.receipt.artifactHash) {
      throw new NightShiftStoreError('invalid_artifact_hash')
    }

    const expectedResultHash = hashCanonicalJson(submission.result)
    if (expectedResultHash !== submission.receipt.resultHash) {
      throw new NightShiftStoreError('invalid_result_hash')
    }

    const expectedReceiptHash = hashCanonicalJson({
      receiptId: submission.receipt.receiptId,
      assignmentId: submission.receipt.assignmentId,
      taskId: submission.receipt.taskId,
      workerId: submission.receipt.workerId,
      status: submission.receipt.status,
      actionLogHash: submission.receipt.actionLogHash,
      artifactHash: submission.receipt.artifactHash,
      resultHash: submission.receipt.resultHash,
    })
    if (expectedReceiptHash !== submission.receiptCommitment.receiptHash) {
      throw new NightShiftStoreError('invalid_receipt_commitment')
    }

    const receipt: ReceiptRecord = {
      id: submission.receipt.receiptId,
      taskId: submission.receipt.taskId,
      assignmentId: submission.assignmentId,
      workerId: submission.workerId,
      status: 'submitted',
      receiptCommitment: submission.receiptCommitment.receiptHash,
      resultPreview: submission.receipt.summary,
      artifactRefs: submission.receipt.artifacts.map((artifact) => artifact.name),
      actionLogHash: submission.receipt.actionLogHash,
      artifactHash: submission.receipt.artifactHash,
      resultHash: submission.receipt.resultHash,
      createdAt: timestamp,
    }

    this.receipts.set(receipt.id, receipt)
    this.assignments.set(assignment.id, {
      ...assignment,
      status: 'submitted',
      submittedAt: timestamp,
      updatedAt: timestamp,
    })

    const task = this.tasks.get(submission.receipt.taskId)
    if (task) {
      this.tasks.set(task.id, {
        ...task,
        status: 'submitted',
        updatedAt: timestamp,
      })
    }

    return {
      assignmentId: submission.assignmentId,
      workerId: submission.workerId,
      success: true,
      status: submission.receipt.status,
      receipt: submission.receipt,
      receiptCommitment: submission.receiptCommitment,
      result: submission.result,
      notes: submission.receipt.summary,
    }
  }

  createDispute(input: CreateDisputeInput): DisputeRecord {
    const assignment = this.assignments.get(input.assignmentId)
    const task = this.tasks.get(input.taskId)

    if (!assignment || assignment.taskId !== input.taskId) {
      throw new NightShiftStoreError('invalid_assignment_for_task')
    }

    if (!task) {
      throw new NightShiftStoreError('task_not_found')
    }

    if (assignment.status !== 'submitted' || task.status !== 'submitted') {
      throw new NightShiftStoreError('dispute_not_available')
    }

    const isEmployer = assignment.employerAddress === input.openedBy
    const isWorker = assignment.workerAddress === input.openedBy
    if (!isEmployer && !isWorker) {
      throw new NightShiftStoreError('dispute_party_mismatch')
    }

    const existing = this.listDisputes(input.taskId).find((dispute) =>
      dispute.assignmentId === input.assignmentId && (dispute.status === 'open' || dispute.status === 'revealed'))
    if (existing) {
      throw new NightShiftStoreError('dispute_already_open')
    }

    const timestamp = now()
    const dispute: DisputeRecord = {
      id: randomUUID(),
      taskId: input.taskId,
      assignmentId: input.assignmentId,
      openedBy: input.openedBy,
      openerRole: input.openerRole,
      reasonCode: input.reasonCode,
      summary: input.summary,
      status: 'open',
      requestedFields: input.requestedFields ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.disputes.set(dispute.id, dispute)
    this.tasks.set(task.id, {
      ...task,
      status: 'disputed',
      updatedAt: timestamp,
    })

    return dispute
  }

  getDispute(disputeId: string): DisputeRecord | undefined {
    return this.disputes.get(disputeId)
  }

  submitReveal(input: SubmitRevealInput): DisputeRecord {
    const dispute = this.disputes.get(input.disputeId)
    if (!dispute) {
      throw new NightShiftStoreError('dispute_not_found')
    }

    const assignment = this.assignments.get(dispute.assignmentId)
    if (!assignment) {
      throw new NightShiftStoreError('assignment_not_found')
    }

    if (dispute.status !== 'open' && dispute.status !== 'revealed') {
      throw new NightShiftStoreError('dispute_not_revealable')
    }

    const isParty = assignment.employerAddress === input.actorId || assignment.workerAddress === input.actorId
    if (!isParty) {
      throw new NightShiftStoreError('dispute_party_mismatch')
    }

    const timestamp = now()
    const updated: DisputeRecord = {
      ...dispute,
      status: 'revealed',
      updatedAt: timestamp,
      reveal: {
        revealBundleHash: input.revealBundleHash,
        revealedBy: input.actorId,
        revealReason: input.revealReason,
        revealedFields: input.revealedFields,
        ...(input.revealRef ? { revealRef: input.revealRef } : {}),
        createdAt: timestamp,
      },
    }

    this.disputes.set(updated.id, updated)
    return updated
  }

  buildPollResponse(workerId: string, maxItems = 1, offer?: WorkerExecutionOffer): AssignmentPollResponse {
    const assignments = this.listAssignmentsForWorker(workerId)
      .filter((assignment) => evaluateWorkerExecutionCompatibility(assignment.execution, offer).compatible)
      .slice(0, maxItems)

    return {
      assignments,
      nextPollAfterMs: 15_000,
      serverTime: now(),
    }
  }

  private seedInitialData(): void {
    const taskOneId = '11111111-1111-4111-8111-111111111111'
    const taskTwoId = '22222222-2222-4222-8222-222222222222'
    const taskThreeId = '33333333-3333-4333-8333-333333333333'

    const bidOneId = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    const bidTwoId = 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    const bidThreeId = 'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3'
    const bidFourId = 'ccccccc4-cccc-4ccc-8ccc-ccccccccccc4'

    const assignmentTwoId = 'ddddddd5-dddd-4ddd-8ddd-ddddddddddd5'
    const assignmentThreeId = 'eeeeeee6-eeee-4eee-8eee-eeeeeeeeeee6'

    const seededTasks: TaskRecord[] = [
      {
        id: taskOneId,
        employerAddress: 'midnight1auroralab9x7k2',
        title: 'Summarize partner docs with selective disclosure',
        publicSummary: 'Produce a partner-ready memo from a confidential brief with selective reveal.',
        rewardAmount: '180',
        rewardAsset: 'USDC',
        visibility: 'private',
        taskCommitment: '0x9f17d2b4c7e65e1d8f3a0b6c9e2f1a8d4c5b6a7e8f90123456789abcdef1234',
        encryptedTaskRef: 'ipfs://nightshift/task/ns-001.enc',
        deadlineAt: '2026-03-28T18:00:00.000Z',
        status: 'open',
        createdAt: '2026-03-26T14:00:00.000Z',
        updatedAt: '2026-03-26T14:00:00.000Z',
        execution: {
          transport: 'libp2p',
          mode: 'worker-hosted-model',
          networkPolicy: 'allowlist-only',
          llm: {
            providerAllowlist: ['anthropic', 'openai', 'ollama', 'mock'],
            requiredCapabilities: ['text', 'json'],
            preferredProvider: 'anthropic',
            allowFallback: true,
          },
          toolProfile: ['fetch', 'receipt'],
        },
      },
      {
        id: taskTwoId,
        employerAddress: 'midnight1openshell77k2m',
        title: 'Generate a verifiable receipt for a local execution job',
        publicSummary: 'Run a local task and return a delivery receipt with artifact hashes.',
        rewardAmount: '240',
        rewardAsset: 'USDC',
        visibility: 'selective',
        taskCommitment: '0x1c32dbe7f4c9a8b7e6d5c4f3a2b1c0987654fedcba0123456789fedcba987654',
        encryptedTaskRef: 'ipfs://nightshift/task/ns-002.enc',
        deadlineAt: '2026-03-27T16:30:00.000Z',
        status: 'assigned',
        createdAt: '2026-03-26T12:20:00.000Z',
        updatedAt: '2026-03-26T12:45:00.000Z',
        execution: {
          transport: 'http-poller',
          mode: 'worker-hosted-model',
          networkPolicy: 'allowlist-only',
          llm: {
            providerAllowlist: ['openai', 'xai', 'mock'],
            requiredCapabilities: ['text', 'json'],
            preferredProvider: 'mock',
            allowFallback: true,
          },
          toolProfile: ['local-sandbox', 'receipt'],
        },
      },
      {
        id: taskThreeId,
        employerAddress: 'midnight1nightshiftteam4tq',
        title: 'Dashboard polish pass for the private beta',
        publicSummary: 'Tighten spacing, headings, and CTA clarity for the beta surface.',
        rewardAmount: '90',
        rewardAsset: 'USDC',
        visibility: 'public',
        taskCommitment: '0xa11d25e3f31d8811c0a0c1c5aaee11ee99cfe8c9f0bdeee2f0f77b9a25d0f100',
        encryptedTaskRef: 'ipfs://nightshift/task/ns-003.enc',
        deadlineAt: '2026-03-26T22:00:00.000Z',
        status: 'settled',
        createdAt: '2026-03-26T10:45:00.000Z',
        updatedAt: '2026-03-26T18:05:00.000Z',
        execution: {
          transport: 'http-poller',
          mode: 'tool-only',
          networkPolicy: 'allowlist-only',
          toolProfile: ['ui-audit', 'receipt'],
        },
      },
    ]

    const seededBids: BidRecord[] = [
      {
        id: bidOneId,
        taskId: taskOneId,
        workerAddress: 'worker_lattice_node_12',
        bidCommitment: '0x1000000000000000000000000000000000000000000000000000000000000001',
        encryptedBidRef: 'ipfs://nightshift/bid/bid-001.enc',
        priceQuote: '160',
        etaHours: 6,
        status: 'sealed',
        createdAt: '2026-03-26T14:12:00.000Z',
        executionOffer: {
          transports: ['libp2p', 'relay'],
          providers: [
            {
              provider: 'anthropic',
              model: 'claude-sonnet-4.6',
              capabilities: ['text', 'json'],
              pricingTier: 'bring-your-own-key',
            },
          ],
          supportedTools: ['fetch', 'receipt'],
          notes: 'Anthropic-backed libp2p node',
        },
      },
      {
        id: bidTwoId,
        taskId: taskOneId,
        workerAddress: 'worker_nightshift_7',
        bidCommitment: '0x2000000000000000000000000000000000000000000000000000000000000002',
        encryptedBidRef: 'ipfs://nightshift/bid/bid-002.enc',
        priceQuote: '175',
        etaHours: 4,
        status: 'sealed',
        createdAt: '2026-03-26T15:05:00.000Z',
        executionOffer: {
          transports: ['http-poller', 'libp2p'],
          providers: [
            {
              provider: 'openai',
              model: 'gpt-5.4-mini',
              capabilities: ['text', 'json', 'tool-calling'],
              pricingTier: 'metered',
            },
          ],
          supportedTools: ['fetch', 'receipt', 'summarize'],
          notes: 'Hybrid worker with relay fallback',
        },
      },
      {
        id: bidThreeId,
        taskId: taskTwoId,
        workerAddress: 'worker_proof_runner_3',
        bidCommitment: '0x3000000000000000000000000000000000000000000000000000000000000003',
        encryptedBidRef: 'ipfs://nightshift/bid/bid-003.enc',
        priceQuote: '240',
        etaHours: 3,
        status: 'selected',
        createdAt: '2026-03-26T12:40:00.000Z',
        executionOffer: {
          transports: ['http-poller'],
          providers: [
            {
              provider: 'mock',
              model: 'local-sandbox',
              capabilities: ['text', 'json', 'tool-calling'],
              local: true,
              pricingTier: 'local',
            },
          ],
          supportedTools: ['local-sandbox', 'receipt'],
          notes: 'Local receipt generator',
        },
      },
      {
        id: bidFourId,
        taskId: taskThreeId,
        workerAddress: 'worker_ui_node_4',
        bidCommitment: '0x4000000000000000000000000000000000000000000000000000000000000004',
        encryptedBidRef: 'ipfs://nightshift/bid/bid-004.enc',
        priceQuote: '90',
        etaHours: 2,
        status: 'selected',
        createdAt: '2026-03-26T11:08:00.000Z',
        executionOffer: {
          transports: ['http-poller'],
          providers: [
            {
              provider: 'mock',
              model: 'ui-audit-runner',
              capabilities: ['text', 'json'],
              local: true,
              pricingTier: 'local',
            },
          ],
          supportedTools: ['ui-audit', 'receipt'],
          notes: 'UI-focused tool-only worker',
        },
      },
    ]

    const seededAssignments: AssignmentRecord[] = [
      {
        id: assignmentTwoId,
        taskId: taskTwoId,
        bidId: bidThreeId,
        workerAddress: 'worker_proof_runner_3',
        employerAddress: 'midnight1openshell77k2m',
        status: 'accepted',
        createdAt: '2026-03-26T12:45:00.000Z',
        updatedAt: '2026-03-26T12:46:00.000Z',
        acceptedAt: '2026-03-26T12:46:00.000Z',
        startedAt: '2026-03-26T12:46:30.000Z',
        dueAt: '2026-03-27T16:30:00.000Z',
        taskCommitment: '0x1c32dbe7f4c9a8b7e6d5c4f3a2b1c0987654fedcba0123456789fedcba987654',
        bidCommitment: '0x3000000000000000000000000000000000000000000000000000000000000003',
        ...(seededTasks[1]?.execution ? { execution: seededTasks[1].execution } : {}),
      },
      {
        id: assignmentThreeId,
        taskId: taskThreeId,
        bidId: bidFourId,
        workerAddress: 'worker_ui_node_4',
        employerAddress: 'midnight1nightshiftteam4tq',
        status: 'completed',
        createdAt: '2026-03-26T11:10:00.000Z',
        updatedAt: '2026-03-26T18:05:00.000Z',
        acceptedAt: '2026-03-26T11:10:00.000Z',
        startedAt: '2026-03-26T11:12:00.000Z',
        submittedAt: '2026-03-26T17:58:00.000Z',
        completedAt: '2026-03-26T18:05:00.000Z',
        dueAt: '2026-03-26T22:00:00.000Z',
        taskCommitment: '0xa11d25e3f31d8811c0a0c1c5aaee11ee99cfe8c9f0bdeee2f0f77b9a25d0f100',
        bidCommitment: '0x4000000000000000000000000000000000000000000000000000000000000004',
        ...(seededTasks[2]?.execution ? { execution: seededTasks[2].execution } : {}),
      },
    ]

    const seededReceipts: ReceiptRecord[] = [
      {
        id: 'receipt_beta_003',
        taskId: taskThreeId,
        assignmentId: assignmentThreeId,
        workerId: 'worker_ui_node_4',
        status: 'submitted',
        receiptCommitment: '0x50a4b6dd1a9018c4b0f4eab0e935a8fd8c1b7f1d7d05b6b38ce98f8d274c6c00',
        resultPreview: 'Delivered. Ready for acceptance.',
        artifactRefs: ['before-after-summary.md', 'dashboard-polish.png'],
        receiptRef: 'ipfs://nightshift/receipt/receipt_beta_003.json',
        createdAt: '2026-03-26T17:58:00.000Z',
      },
    ]

    for (const task of seededTasks) this.tasks.set(task.id, task)
    for (const bid of seededBids) this.bids.set(bid.id, bid)
    for (const assignment of seededAssignments) this.assignments.set(assignment.id, assignment)
    for (const receipt of seededReceipts) this.receipts.set(receipt.id, receipt)
  }
}

type WorkspaceEntry = {
  store: InMemoryNightShiftStore
  touchedAt: number
}

export class WorkspaceNightShiftStore {
  private readonly workspaces = new Map<string, WorkspaceEntry>()

  constructor(
    private readonly seedInitialData = true,
    private readonly workspaceTtlMs = DEFAULT_WORKSPACE_TTL_MS,
  ) {}

  getWorkspace(workspaceId: string = DEFAULT_WORKSPACE_ID): InMemoryNightShiftStore {
    const normalized = normalizeWorkspaceId(workspaceId)
    const currentTime = Date.now()

    this.cleanup(currentTime)

    const existing = this.workspaces.get(normalized)
    if (existing) {
      existing.touchedAt = currentTime
      this.workspaces.set(normalized, existing)
      return existing.store
    }

    if (this.workspaces.size >= MAX_WORKSPACES) {
      this.evictOldestWorkspace()
    }

    const created: WorkspaceEntry = {
      store: new InMemoryNightShiftStore(this.seedInitialData),
      touchedAt: currentTime,
    }
    this.workspaces.set(normalized, created)
    return created.store
  }

  private cleanup(currentTime: number) {
    for (const [workspaceId, entry] of this.workspaces.entries()) {
      if (workspaceId === DEFAULT_WORKSPACE_ID) {
        continue
      }

      if (entry.touchedAt + this.workspaceTtlMs <= currentTime) {
        this.workspaces.delete(workspaceId)
      }
    }
  }

  private evictOldestWorkspace() {
    let oldestKey: string | null = null
    let oldestTouchedAt = Number.POSITIVE_INFINITY

    for (const [workspaceId, entry] of this.workspaces.entries()) {
      if (workspaceId === DEFAULT_WORKSPACE_ID) {
        continue
      }

      if (entry.touchedAt < oldestTouchedAt) {
        oldestTouchedAt = entry.touchedAt
        oldestKey = workspaceId
      }
    }

    if (oldestKey) {
      this.workspaces.delete(oldestKey)
    }
  }
}

export function normalizeWorkspaceId(value: string | undefined): string {
  const trimmed = value?.trim().toLowerCase() ?? ''
  if (!trimmed) {
    return DEFAULT_WORKSPACE_ID
  }

  if (/^[a-z0-9][a-z0-9_-]{5,63}$/u.test(trimmed)) {
    return trimmed
  }

  return DEFAULT_WORKSPACE_ID
}

export const createWorkspaceStore = () => new WorkspaceNightShiftStore()
