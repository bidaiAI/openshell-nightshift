import type { TaskStatus, PrivacyLevel } from "@/lib/types"

const statusLabels: Record<TaskStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  submitted: "Delivered",
  settled: "Settled",
  disputed: "Disputed",
  cancelled: "Cancelled",
}

const privacyLabels: Record<PrivacyLevel, string> = {
  public: "Public",
  private: "Private",
  selective: "Selective",
}

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  const tone =
    status === "settled" ? "private"
    : status === "submitted" ? ""
    : status === "assigned" ? ""
    : status === "open" ? ""
    : "warn"

  return <span className={`badge ${tone}`}>{statusLabels[status]}</span>
}

export function PrivacyPill({ privacy }: { privacy: PrivacyLevel }) {
  return <span className={`badge ${privacy !== "public" ? "private" : ""}`}>{privacyLabels[privacy]}</span>
}
