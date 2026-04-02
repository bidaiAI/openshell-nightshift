import type {
  AssignmentPollRequest,
  AssignmentPollResponse,
  AssignmentRecord,
  AssignmentSubmission,
  WorkerRuntimeResult,
} from '@nightshift/common'

export interface AssignmentPollClient {
  pollAssignments(request: AssignmentPollRequest): Promise<AssignmentPollResponse>
  acknowledgeAssignment(assignmentId: string): Promise<void>
  submitAssignmentResult(submission: AssignmentSubmission): Promise<WorkerRuntimeResult>
  ping?(): Promise<void>
}

export interface PollerTransport {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
}

export class HttpAssignmentPollClient implements AssignmentPollClient {
  constructor(
    private readonly transport: PollerTransport,
  ) {}

  async pollAssignments(request: AssignmentPollRequest): Promise<AssignmentPollResponse> {
    const providerCatalog = request.worker.providers?.length
      ? JSON.stringify(request.worker.providers)
      : undefined

    const query = new URLSearchParams({
      workerId: request.worker.workerId,
      workerName: request.worker.displayName,
      ...(request.maxItems ? { maxItems: String(request.maxItems) } : {}),
      ...(request.worker.endpoint ? { endpoint: request.worker.endpoint } : {}),
      ...(request.worker.chain ? { chain: request.worker.chain } : {}),
      ...(request.worker.capabilities.length ? { capabilities: request.worker.capabilities.join(',') } : {}),
      ...(request.worker.transports?.length ? { transports: request.worker.transports.join(',') } : {}),
      ...(providerCatalog ? { providerCatalog } : {}),
    })

    return this.transport.get<AssignmentPollResponse>(`/assignments/poll?${query.toString()}`)
  }

  async acknowledgeAssignment(assignmentId: string): Promise<void> {
    await this.transport.post<void>(`/assignments/${assignmentId}/ack`, {})
  }

  async submitAssignmentResult(submission: AssignmentSubmission): Promise<WorkerRuntimeResult> {
    return this.transport.post<WorkerRuntimeResult>(`/assignments/${submission.assignmentId}/submit`, submission)
  }
}

export interface PollLoopState {
  activeAssignments: readonly AssignmentRecord[]
  lastPolledAt?: string
  nextPollAfterMs: number
}
