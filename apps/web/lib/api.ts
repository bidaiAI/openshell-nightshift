import type { AssignmentSubmission, CompactProjection, DisputeReasonCode, WorkerExecutionOffer } from "@nightshift/common"
import { getTaskById, metrics as mockMetrics, tasks as mockTasks } from "./mock-data"
import type { Bid, DashboardMetric, PrivacyLevel, Task, TaskExecutionPolicy, TaskStatus } from "./types"

const DEFAULT_LOCAL_SERVER_API_BASE_URL = "http://localhost:4010/v1"
const DEFAULT_PRODUCTION_API_BASE_URL = "https://backend-preview-production.up.railway.app/v1"
const BROWSER_PROXY_BASE_URL = "/api/nightshift/v1"
const REQUEST_TIMEOUT_MS = 6000

export type DataSource = "api" | "mock"

export interface ApiBidRecord {
  id?: string
  worker?: string
  workerName?: string
  bidderAddress?: string
  workerAddress?: string
  label?: string
  amount?: string | number
  rewardAmount?: string | number
  priceQuote?: string | number
  currency?: string
  asset?: string
  durationHours?: string | number
  etaHours?: string | number
  note?: string
  encryptedBidRef?: string
  comment?: string
  message?: string
  status?: string
  submittedAt?: string
  createdAt?: string
  executionOffer?: unknown
}

export interface ApiReceiptRecord {
  id?: string
  hash?: string
  receiptCommitment?: string
  receiptHash?: string
  artifactHash?: string
  summary?: string
  resultPreview?: string
  note?: string
  message?: string
  status?: string
  submittedAt?: string
  createdAt?: string
}

export interface ApiAssignmentRecord {
  id: string
  taskId?: string
  bidId?: string
  workerAddress?: string
  employerAddress?: string
  status: "queued" | "accepted" | "in_progress" | "submitted" | "cancelled" | "completed"
  createdAt?: string
  updatedAt?: string
  acceptedAt?: string
  startedAt?: string
  submittedAt?: string
  dueAt?: string
  taskCommitment?: string
  bidCommitment?: string
}

export interface ApiDisputeRecord {
  id: string
  taskId?: string
  assignmentId?: string
  openedBy?: string
  openerRole?: "employer" | "worker"
  reasonCode?: DisputeReasonCode
  summary?: string
  status?: "open" | "revealed" | "resolved" | "dismissed"
  requestedFields?: string[]
  createdAt?: string
  updatedAt?: string
  reveal?: {
    revealBundleHash?: string
    revealedBy?: string
    revealReason?: string
    revealedFields?: string[]
    revealRef?: string
    createdAt?: string
  }
}

export interface ApiTaskRecord {
  id: string
  employerAddress?: string
  requesterAddress?: string
  requester?: string
  requesterName?: string
  employerName?: string
  title?: string
  publicSummary?: string
  rewardAmount?: string | number
  rewardAsset?: string
  visibility?: string
  taskCommitment?: string
  encryptedTaskRef?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  deadlineAt?: string
  dueAt?: string
  privateBrief?: string
  disclosureScope?: string[] | string
  resultSummary?: string
  receiptHash?: string
  compactProjection?: unknown
  bids?: unknown[]
  receipts?: unknown[]
  assignments?: unknown[]
  [key: string]: unknown
}

export interface CreateTaskInput {
  employerAddress: string
  title: string
  publicSummary: string
  rewardAmount: string
  rewardAsset: string
  visibility: PrivacyLevel
  taskCommitment: string
  encryptedTaskRef?: string
  deadlineAt?: string
  execution?: {
    transport: "http-poller" | "libp2p" | "relay"
    mode: "worker-hosted-model" | "delegated-credential" | "tool-only"
    networkPolicy: "disabled" | "allowlist-only" | "egress-ok"
    llm?: {
      providerAllowlist?: string[]
      modelAllowlist?: string[]
      requiredCapabilities?: string[]
      preferredProvider?: string
      preferredModel?: string
      allowFallback?: boolean
    }
    toolProfile?: string[]
  }
}

export interface CreateBidInput {
  workerAddress: string
  bidCommitment: string
  encryptedBidRef?: string
  priceQuote?: string
  etaHours?: number
  executionOffer?: WorkerExecutionOffer
}

export interface CreateAssignmentInput {
  bidId: string
}

export interface AcceptAssignmentInput {
  assignmentId: string
}

export interface CreateDisputeInput {
  assignmentId: string
  reasonCode: DisputeReasonCode
  summary: string
  requestedFields?: string[]
}

export interface SubmitRevealInput {
  revealReason: string
  revealedFields: string[]
  revealBundleHash: string
  revealRef?: string
}

export type ApiActorRole = "employer" | "worker" | "admin"

export interface ApiAuthContext {
  actorId: string
  role: ApiActorRole
  token?: string
  workspaceId?: string
}

export interface HomeData {
  metrics: DashboardMetric[]
  tasks: Task[]
  featuredTask: Task | null
  source: DataSource
  error?: string
}

export interface TaskListData {
  tasks: Task[]
  source: DataSource
  error?: string
}

export interface TaskDetailData {
  task: Task | null
  assignments: ApiAssignmentRecord[]
  receipts: ApiReceiptRecord[]
  disputes: ApiDisputeRecord[]
  source: DataSource
  error?: string
}

export interface DashboardData {
  metrics: DashboardMetric[]
  tasks: Task[]
  recentReceipts: Task[]
  source: DataSource
  error?: string
}

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return BROWSER_PROXY_BASE_URL
  }

  return process.env.NIGHTSHIFT_API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || (process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_API_BASE_URL
      : DEFAULT_LOCAL_SERVER_API_BASE_URL)
}

const BETA_TOKEN_STORAGE_PREFIX = "nightshift.beta-token"
export const BETA_SESSION_COOKIE_ACTOR_ID = "nightshift_beta_actor_id"
export const BETA_SESSION_COOKIE_ROLE = "nightshift_beta_role"
export const BETA_SESSION_COOKIE_TOKEN = "nightshift_beta_token"
export const BETA_SESSION_COOKIE_WORKSPACE_ID = "nightshift_beta_workspace_id"
export const BETA_WORKSPACE_HEADER = "x-nightshift-workspace-id"

function getStoredTokenKey(auth: Pick<ApiAuthContext, "actorId" | "role">): string {
  return `${BETA_TOKEN_STORAGE_PREFIX}:${auth.role}:${auth.actorId}`
}

export function readStoredBetaAccessToken(auth: Pick<ApiAuthContext, "actorId" | "role">): string {
  if (typeof window === "undefined") {
    return ""
  }

  try {
    return window.localStorage.getItem(getStoredTokenKey(auth))?.trim() ?? ""
  } catch {
    return ""
  }
}

export function writeStoredBetaAccessToken(auth: Pick<ApiAuthContext, "actorId" | "role">, token: string): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const key = getStoredTokenKey(auth)
    const trimmed = token.trim()
    if (trimmed) {
      window.localStorage.setItem(key, trimmed)
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // ignore storage failures in beta mode
  }
}

async function syncBetaActorSession(auth: Pick<ApiAuthContext, "actorId" | "role">, token: string): Promise<void> {
  const trimmed = token.trim()

  if (!trimmed) {
    await fetch("/api/beta/session", {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    })
    return
  }

  const response = await fetch("/api/beta/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      actorId: auth.actorId,
      role: auth.role,
      token: trimmed,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(firstText(isRecord(payload) ? payload.error : undefined, "session_sync_failed") ?? "session_sync_failed")
  }
}

export async function activateBetaActorSession(auth: Pick<ApiAuthContext, "actorId" | "role">, token: string): Promise<void> {
  writeStoredBetaAccessToken(auth, token)
  await syncBetaActorSession(auth, token)
}

export async function activateLocalBetaSession(role: Extract<ApiActorRole, "employer" | "worker">): Promise<{ actorId: string; role: ApiActorRole; workspaceId?: string }> {
  const response = await fetch("/api/beta/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ role }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !isRecord(payload) || typeof payload.actorId !== "string" || typeof payload.role !== "string") {
    throw new Error(firstText(isRecord(payload) ? payload.error : undefined, "beta access unavailable") ?? "beta access unavailable")
  }

  return {
    actorId: payload.actorId,
    role: payload.role as ApiActorRole,
    ...(typeof payload.workspaceId === "string" ? { workspaceId: payload.workspaceId } : {}),
  }
}

export async function resetBetaWorkspace(role: Extract<ApiActorRole, "employer" | "worker">): Promise<{ actorId: string; role: ApiActorRole; workspaceId?: string }> {
  await fetch("/api/beta/session", {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  })

  return activateLocalBetaSession(role)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  return ""
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = asString(value).trim()
    if (text) {
      return text
    }
  }

  return undefined
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  const parsed = Number.parseFloat(asString(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function asStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.map(item => asString(item).trim()).filter(Boolean)
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n;]/)
      .map(item => item.trim())
      .filter(Boolean)
  }

  return null
}

function asIsoString(value: unknown, fallback: string): string {
  const text = asString(value).trim()
  if (!text) {
    return fallback
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString()
}

function shortAddress(value: string): string {
  if (value.length <= 12) {
    return value
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function normalizePrivacyLevel(value: unknown, fallback: PrivacyLevel): PrivacyLevel {
  const normalized = asString(value).trim().toLowerCase()

  if (normalized === "public" || normalized === "private" || normalized === "selective") {
    return normalized
  }

  return fallback
}

function normalizeTaskStatus(value: unknown, fallback: TaskStatus): TaskStatus {
  const normalized = asString(value).trim().toLowerCase()

  if (
    normalized === "open" ||
    normalized === "assigned" ||
    normalized === "submitted" ||
    normalized === "settled" ||
    normalized === "disputed" ||
    normalized === "cancelled"
  ) {
    return normalized
  }

  if (["pending", "queued", "new", "created"].includes(normalized)) {
    return "open"
  }

  if (["accepted", "running", "working", "in_progress", "active"].includes(normalized)) {
    return "assigned"
  }

  if (["complete", "completed", "delivered", "ready_for_review"].includes(normalized)) {
    return "submitted"
  }

  if (["paid", "payout", "settled", "closed", "archived"].includes(normalized)) {
    return "settled"
  }

  return fallback
}

function normalizeBidStatus(value: unknown, fallback: Bid["status"] = "sealed"): Bid["status"] {
  const normalized = asString(value).trim().toLowerCase()

  if (normalized === "sealed" || normalized === "selected" || normalized === "rejected") {
    return normalized
  }

  if (["won", "selected"].includes(normalized)) {
    return "selected"
  }

  if (["declined", "lost", "removed", "withdrawn"].includes(normalized)) {
    return "rejected"
  }

  if (["pending", "new", "created"].includes(normalized)) {
    return "sealed"
  }

  return fallback
}

function normalizeDisclosureScope(value: unknown): string[] | null {
  const items = asStringArray(value)
  return items && items.length ? items : null
}

function normalizeExecutionPolicy(value: unknown): TaskExecutionPolicy | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const transport = asString(value.transport).trim()
  const mode = asString(value.mode).trim()

  if ((transport !== "http-poller" && transport !== "libp2p" && transport !== "relay")
    || (mode !== "worker-hosted-model" && mode !== "delegated-credential" && mode !== "tool-only")) {
    return undefined
  }

  const llm = isRecord(value.llm) ? value.llm : null
  const requiredCapabilities = asStringArray(llm?.requiredCapabilities) ?? []
  const preferredProvider = firstText(llm?.preferredProvider)
  const preferredModel = firstText(llm?.preferredModel)
  const providerAllowlist = asStringArray(llm?.providerAllowlist) ?? []
  const toolProfile = asStringArray(value.toolProfile) ?? []
  const networkPolicy = asString(value.networkPolicy).trim()

  return {
    transport,
    mode,
    networkPolicy: networkPolicy === "disabled" || networkPolicy === "egress-ok" ? networkPolicy : "allowlist-only",
    ...(preferredProvider ? { preferredProvider } : {}),
    ...(preferredModel ? { preferredModel } : {}),
    ...(providerAllowlist.length ? { providerAllowlist } : {}),
    requiredCapabilities,
    ...(toolProfile.length ? { toolProfile } : {}),
  }
}

function normalizeCompactProjection(value: unknown): CompactProjection | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const contract = asString(value.contract).trim()
  const phase = asString(value.phase).trim()
  const stateCommitment = asString(value.stateCommitment).trim()
  const nextTransition = asString(value.nextTransition).trim()
  const publicInputs = Array.isArray(value.publicInputs)
    ? value.publicInputs
      .filter(isRecord)
      .map((entry) => ({
        label: asString(entry.label).trim(),
        value: asString(entry.value).trim(),
      }))
      .filter((entry) => entry.label && entry.value)
    : []
  const privateWitness = asStringArray(value.privateWitness) ?? []

  if (
    contract !== "NightShiftTaskEscrow"
    || !["sealed-bidding", "assignment-active", "receipt-submitted", "dispute-open", "settled", "cancelled"].includes(phase)
    || !stateCommitment
    || !nextTransition
  ) {
    return undefined
  }

  return {
    contract: "NightShiftTaskEscrow",
    phase: phase as CompactProjection["phase"],
    stateCommitment: stateCommitment as CompactProjection["stateCommitment"],
    nextTransition,
    publicInputs,
    privateWitness,
  }
}

function normalizeBidRecord(raw: unknown, taskId: string, index: number): Bid {
  const record = isRecord(raw) ? raw : {}
  const currency = asString(record.currency ?? record.asset ?? record.rewardAsset).trim().toUpperCase() || "USDC"
  const executionOffer = isRecord(record.executionOffer) ? record.executionOffer : null
  const providerSummary = Array.isArray(executionOffer?.providers)
    ? executionOffer.providers
      .filter(isRecord)
      .map((provider) => {
        const providerName = firstText(provider.provider)
        const modelName = firstText(provider.model)
        if (providerName && modelName) {
          return `${providerName}/${modelName}`
        }
        return providerName ?? modelName
      })
      .filter((value): value is string => Boolean(value))
    : []
  const transportSummary = Array.isArray(executionOffer?.transports)
    ? executionOffer.transports.map((value) => asString(value).trim()).filter(Boolean)
    : []
  const offerSummary = [
    providerSummary.length ? `Providers: ${providerSummary.join(", ")}` : "",
    transportSummary.length ? `Transports: ${transportSummary.join(", ")}` : "",
  ].filter(Boolean).join(" · ")

  return {
    id: firstText(record.id, `${taskId}-bid-${index + 1}`) ?? `${taskId}-bid-${index + 1}`,
    worker: firstText(record.worker, record.workerName, record.workerAddress, record.bidderAddress, record.label) ?? `worker-${index + 1}`,
    amount: asNumber(record.amount ?? record.rewardAmount ?? record.priceQuote, 0),
    currency: currency as Bid["currency"],
    durationHours: asNumber(record.durationHours ?? record.etaHours, 0),
    note: firstText(
      record.note,
      record.comment,
      record.message,
      offerSummary,
      record.encryptedBidRef ? `Encrypted bid ref: ${record.encryptedBidRef}` : undefined,
    ) ?? "Sealed bid submitted.",
    status: normalizeBidStatus(record.status),
    submittedAt: asIsoString(record.submittedAt ?? record.createdAt, new Date().toISOString()),
  }
}

function normalizeReceiptRecord(raw: unknown, taskId: string, index: number): ApiReceiptRecord {
  const record = isRecord(raw) ? raw : {}
  const hash = firstText(record.hash, record.receiptHash, record.receiptCommitment, record.artifactHash)
  const receiptHash = firstText(record.receiptHash, record.receiptCommitment, record.hash, record.artifactHash)
  const artifactHash = firstText(record.artifactHash, record.hash, record.receiptHash, record.receiptCommitment)
  const summary = firstText(record.summary, record.resultPreview, record.note, record.message)
  const note = firstText(record.note, record.resultPreview, record.summary, record.message)
  const message = firstText(record.message, record.resultPreview, record.summary, record.note)
  const status = firstText(record.status)

  return {
    id: firstText(record.id, `${taskId}-receipt-${index + 1}`) ?? `${taskId}-receipt-${index + 1}`,
    ...(hash ? { hash } : {}),
    ...(receiptHash ? { receiptHash } : {}),
    ...(artifactHash ? { artifactHash } : {}),
    ...(summary ? { summary } : {}),
    ...(note ? { note } : {}),
    ...(message ? { message } : {}),
    ...(status ? { status } : {}),
    submittedAt: asIsoString(record.submittedAt ?? record.createdAt, new Date().toISOString()),
    createdAt: asIsoString(record.createdAt ?? record.submittedAt, new Date().toISOString()),
  }
}

function takeTaskRecord(value: unknown): ApiTaskRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null
  }

  return value as ApiTaskRecord
}

export function extractTaskRecord(payload: unknown): ApiTaskRecord | null {
  const direct = takeTaskRecord(payload)
  if (direct) {
    return direct
  }

  if (!isRecord(payload)) {
    return null
  }

  return takeTaskRecord(payload.task) ?? takeTaskRecord(payload.data) ?? takeTaskRecord(payload.item) ?? takeTaskRecord(payload.record)
}

function extractTaskList(payload: unknown): ApiTaskRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(item => extractTaskRecord(item)).filter((item): item is ApiTaskRecord => Boolean(item))
  }

  if (!isRecord(payload)) {
    return []
  }

  for (const key of ["tasks", "items", "records", "data"]) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value.map(item => extractTaskRecord(item)).filter((item): item is ApiTaskRecord => Boolean(item))
    }
  }

  const direct = extractTaskRecord(payload)
  return direct ? [direct] : []
}

function extractTaskDetail(payload: unknown): { task: ApiTaskRecord | null; bids: unknown[]; receipts: unknown[]; assignments: ApiAssignmentRecord[]; disputes: ApiDisputeRecord[] } {
  const task = extractTaskRecord(payload)

  if (!isRecord(payload)) {
    return { task, bids: [], receipts: [], assignments: [], disputes: [] }
  }

  const bids = Array.isArray(payload.bids) ? payload.bids : Array.isArray(task?.bids) ? task?.bids ?? [] : []
  const receipts = Array.isArray(payload.receipts) ? payload.receipts : Array.isArray(task?.receipts) ? task?.receipts ?? [] : []
  const assignments = Array.isArray(payload.assignments)
    ? payload.assignments.filter(isRecord).map((assignment) => assignment as unknown as ApiAssignmentRecord)
    : Array.isArray(task?.assignments)
      ? (task?.assignments ?? []).filter(isRecord).map((assignment) => assignment as unknown as ApiAssignmentRecord)
      : []
  const disputes = Array.isArray(payload.disputes)
    ? payload.disputes.filter(isRecord).map((dispute) => dispute as unknown as ApiDisputeRecord)
    : []

  return { task, bids, receipts, assignments, disputes }
}

function buildMetrics(tasks: Task[]): DashboardMetric[] {
  const privateTasks = tasks.filter(task => task.privacy !== "public").length
  const sealedBids = tasks.reduce((count, task) => count + task.bids.length, 0)
  const receipts = tasks.filter(task => task.status === "submitted" || task.status === "settled" || Boolean(task.receiptHash)).length
  const settled = tasks.filter(task => task.status === "settled").length

  return [
    { label: "Private tasks", value: String(privateTasks), detail: "commitments hidden from public view" },
    { label: "Sealed bids", value: String(sealedBids), detail: "private offers across the queue" },
    { label: "Receipts", value: String(receipts), detail: "delivery proofs and artifact hashes" },
    { label: "Settled", value: String(settled), detail: "completed and paid work" },
  ]
}

function pickFeaturedTask(tasks: Task[]): Task | null {
  return (
    tasks.find(task => task.status === "assigned") ??
    tasks.find(task => task.status === "open") ??
    tasks[0] ??
    null
  )
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return "Request failed"
}

function extractErrorMessage(body: string, fallback: string): string {
  if (!body.trim()) {
    return fallback
  }

  try {
    const parsed = JSON.parse(body) as unknown
    if (isRecord(parsed)) {
      const message = firstText(parsed.error, parsed.message, parsed.detail)
      if (message) {
        return message
      }
    }
  } catch {
    // fall through to raw text
  }

  return body.trim() || fallback
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    })

    const body = await response.text()

    if (!response.ok) {
      throw new Error(extractErrorMessage(body, response.statusText))
    }

    if (!body.trim()) {
      return undefined as T
    }

    try {
      return JSON.parse(body) as T
    } catch {
      return body as T
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildBetaAuthHeaders(auth: ApiAuthContext): Record<string, string> {
  const token = auth.token?.trim() || readStoredBetaAccessToken(auth)

  if (typeof window === "undefined" && !token) {
    throw new Error(`Missing beta access token for ${auth.role}:${auth.actorId}`)
  }

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "X-NightShift-Actor-Id": auth.actorId,
    "X-NightShift-Actor-Role": auth.role,
    ...(auth.workspaceId ? { [BETA_WORKSPACE_HEADER]: auth.workspaceId } : {}),
  }
}

export const api = {
  listTasks: (auth?: ApiAuthContext) => request<unknown>("/tasks", {
    ...(auth ? { headers: buildBetaAuthHeaders(auth) } : {}),
  }),
  getTask: (taskId: string, auth?: ApiAuthContext) => request<unknown>(`/tasks/${encodeURIComponent(taskId)}`, {
    ...(auth ? { headers: buildBetaAuthHeaders(auth) } : {}),
  }),
  createTask: (input: CreateTaskInput, auth: ApiAuthContext) =>
    request<unknown>("/tasks", {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
  createBid: (taskId: string, input: CreateBidInput, auth: ApiAuthContext) =>
    request<unknown>(`/tasks/${encodeURIComponent(taskId)}/bids`, {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
  createAssignment: (taskId: string, input: CreateAssignmentInput, auth: ApiAuthContext) =>
    request<unknown>(`/tasks/${encodeURIComponent(taskId)}/assignments`, {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
  submitAssignmentResult: (assignmentId: string, input: AssignmentSubmission, auth: ApiAuthContext) =>
    request<unknown>(`/assignments/${encodeURIComponent(assignmentId)}/submit`, {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
  createDispute: (taskId: string, input: CreateDisputeInput, auth: ApiAuthContext) =>
    request<unknown>(`/tasks/${encodeURIComponent(taskId)}/disputes`, {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
  submitReveal: (disputeId: string, input: SubmitRevealInput, auth: ApiAuthContext) =>
    request<unknown>(`/disputes/${encodeURIComponent(disputeId)}/reveal`, {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
  acceptAssignment: (taskId: string, input: AcceptAssignmentInput, auth: ApiAuthContext) =>
    request<unknown>(`/tasks/${encodeURIComponent(taskId)}/accept`, {
      method: "POST",
      headers: buildBetaAuthHeaders(auth),
      body: JSON.stringify(input),
    }),
}

export function mapApiTaskToTask(record: ApiTaskRecord, fallback?: Task, context?: { bids?: unknown[]; receipts?: unknown[] }): Task {
  const fallbackTask = fallback ?? getTaskById(record.id) ?? null
  const detail = context ?? {}
  const receipts = (detail.receipts ?? record.receipts ?? []).map((receipt, index) => normalizeReceiptRecord(receipt, record.id, index))
  const disclosureScope = normalizeDisclosureScope(record.disclosureScope) ?? fallbackTask?.disclosureScope ?? ["task commitment", "delivery receipt"]
  const requester =
    firstText(
      record.requester,
      record.employerAddress,
      record.requesterAddress,
      record.requesterName,
      record.employerName,
      fallbackTask?.requester,
      "Unknown requester",
    ) ?? "Unknown requester"
  const title = firstText(record.title, fallbackTask?.title, "Untitled task") ?? "Untitled task"
  const brief = firstText(record.publicSummary, fallbackTask?.brief, `Public brief for ${title}`) ?? `Public brief for ${title}`
  const privateBrief = firstText(
    record.privateBrief,
    record.encryptedTaskRef ? `Encrypted reference: ${record.encryptedTaskRef}` : undefined,
    fallbackTask?.privateBrief,
    "Private brief unavailable in live API.",
  ) ?? "Private brief unavailable in live API."
  const resultSummary = firstText(record.resultSummary, receipts[0]?.summary, fallbackTask?.resultSummary, "Awaiting delivery.") ?? "Awaiting delivery."
  const receiptHash = firstText(record.receiptHash, receipts[0]?.receiptHash, receipts[0]?.hash, fallbackTask?.receiptHash, `receipt-${record.id}`) ?? `receipt-${record.id}`
  const commitmentHash = firstText(record.taskCommitment, fallbackTask?.commitmentHash, `commitment-${record.id}`) ?? `commitment-${record.id}`
  const bidsSource = detail.bids ?? record.bids ?? fallbackTask?.bids ?? []
  const bids = bidsSource.map((bid, index) => normalizeBidRecord(bid, record.id, index))
  const execution = normalizeExecutionPolicy(record.execution) ?? fallbackTask?.execution
  const compactProjection = normalizeCompactProjection(record.compactProjection) ?? fallbackTask?.compactProjection

  return {
    id: record.id,
    title,
    requester,
    status: normalizeTaskStatus(record.status, fallbackTask?.status ?? "open"),
    privacy: normalizePrivacyLevel(record.visibility, fallbackTask?.privacy ?? "private"),
    reward: asNumber(record.rewardAmount, fallbackTask?.reward ?? 0),
    currency: (asString(record.rewardAsset).trim().toUpperCase() || fallbackTask?.currency || "USDC") as Task["currency"],
    dueAt: asIsoString(record.dueAt ?? record.deadlineAt ?? record.updatedAt ?? record.createdAt, fallbackTask?.dueAt ?? new Date().toISOString()),
    commitmentHash,
    brief,
    privateBrief,
    disclosureScope,
    resultSummary,
    receiptHash,
    bids,
    ...(execution ? { execution } : {}),
    ...(compactProjection ? { compactProjection } : {}),
  }
}

function mapTaskRecordsToTasks(records: ApiTaskRecord[]): Task[] {
  return records.map(record => mapApiTaskToTask(record, getTaskById(record.id) ?? undefined))
}

function cloneMockTasks(): Task[] {
  return mockTasks.map(task => ({
    ...task,
    bids: task.bids.map(bid => ({ ...bid })),
    disclosureScope: [...task.disclosureScope],
  }))
}

export async function loadTasksData(auth?: ApiAuthContext): Promise<TaskListData> {
  try {
    const payload = await api.listTasks(auth)
    const records = extractTaskList(payload)
    return {
      tasks: mapTaskRecordsToTasks(records),
      source: "api",
    }
  } catch (error) {
    return {
      tasks: cloneMockTasks(),
      source: "mock",
      error: formatError(error),
    }
  }
}

export async function loadHomeData(auth?: ApiAuthContext): Promise<HomeData> {
  try {
    const payload = await api.listTasks(auth)
    const records = extractTaskList(payload)
    const tasks = mapTaskRecordsToTasks(records)

    return {
      metrics: buildMetrics(tasks),
      tasks,
      featuredTask: pickFeaturedTask(tasks),
      source: "api",
    }
  } catch (error) {
    const tasks = cloneMockTasks()
    return {
      metrics: mockMetrics,
      tasks,
      featuredTask: pickFeaturedTask(tasks),
      source: "mock",
      error: formatError(error),
    }
  }
}

export async function loadTaskData(taskId: string, auth?: ApiAuthContext): Promise<TaskDetailData> {
  try {
    const payload = await api.getTask(taskId, auth)
    const detail = extractTaskDetail(payload)
    const fallbackTask = getTaskById(taskId) ?? undefined
    const taskRecord = detail.task ?? (fallbackTask ? ({ id: fallbackTask.id, title: fallbackTask.title } as ApiTaskRecord) : null)

    if (!taskRecord) {
      return {
        task: null,
        assignments: [],
        receipts: [],
        disputes: [],
        source: "api",
        error: "Task not found",
      }
    }

    return {
      task: mapApiTaskToTask(taskRecord, fallbackTask, { bids: detail.bids, receipts: detail.receipts }),
      assignments: detail.assignments,
      receipts: detail.receipts.map((receipt, index) => normalizeReceiptRecord(receipt, taskRecord.id, index)),
      disputes: detail.disputes,
      source: "api",
    }
  } catch (error) {
    const fallbackTask = getTaskById(taskId)
    return {
      task: fallbackTask ?? null,
      assignments: [],
      receipts: [],
      disputes: [],
      source: "mock",
      error: formatError(error),
    }
  }
}

export async function loadDashboardData(auth?: ApiAuthContext): Promise<DashboardData> {
  try {
    const payload = await api.listTasks(auth)
    const records = extractTaskList(payload)
    const tasks = mapTaskRecordsToTasks(records)
    const recentReceipts = tasks.filter(task => task.status === "submitted" || task.status === "settled")

    return {
      metrics: buildMetrics(tasks),
      tasks,
      recentReceipts,
      source: "api",
    }
  } catch (error) {
    const tasks = cloneMockTasks()
    const recentReceipts = tasks.filter(task => task.status === "submitted" || task.status === "settled")

    return {
      metrics: mockMetrics,
      tasks,
      recentReceipts,
      source: "mock",
      error: formatError(error),
    }
  }
}

export function formatApiErrorMessage(error: unknown): string {
  return formatError(error)
}
