import type {
  BidStatus as SharedBidStatus,
  CompactProjection,
  TaskStatus as SharedTaskStatus,
} from "@nightshift/common"

export type TaskStatus = Extract<SharedTaskStatus, "open" | "assigned" | "submitted" | "settled" | "disputed" | "cancelled">
export type PrivacyLevel = "public" | "private" | "selective"
export type BidStatus = Extract<SharedBidStatus, "sealed" | "selected" | "rejected">

export interface Bid {
  id: string
  worker: string
  amount: number
  currency: "USDC"
  durationHours: number
  note: string
  status: BidStatus
  submittedAt: string
}

export interface TaskExecutionPolicy {
  transport: "http-poller" | "libp2p" | "relay"
  mode: "worker-hosted-model" | "delegated-credential" | "tool-only"
  networkPolicy: "disabled" | "allowlist-only" | "egress-ok"
  preferredProvider?: string
  preferredModel?: string
  providerAllowlist?: string[]
  requiredCapabilities: string[]
  toolProfile?: string[]
}

export interface Task {
  id: string
  title: string
  requester: string
  status: TaskStatus
  privacy: PrivacyLevel
  reward: number
  currency: "USDC"
  dueAt: string
  commitmentHash: string
  brief: string
  privateBrief: string
  disclosureScope: string[]
  resultSummary: string
  receiptHash: string
  bids: Bid[]
  execution?: TaskExecutionPolicy
  compactProjection?: CompactProjection
}

export interface DashboardMetric {
  label: string
  value: string
  detail: string
}
