import Link from "next/link"
import { formatDate, formatMoney, shortHash } from "@/lib/format"
import type { Task } from "@/lib/types"
import { PrivacyPill, TaskStatusPill } from "./status-pill"

export default function TaskTable({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="surface section">
        <div style={{ fontSize: 18, fontWeight: 600 }}>Task queue</div>
        <p className="muted" style={{ margin: "10px 0 0", lineHeight: 1.6 }}>
          No tasks yet. Create a new commitment to populate the queue.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/create" className="button primary">
            Create task
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="surface section">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Task queue</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Commitments, bids, and receipts at a glance.
          </div>
        </div>
        <div className="mono muted" style={{ fontSize: 12 }}>
          {tasks.length} tasks
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Privacy</th>
            <th>Reward</th>
            <th>Due</th>
            <th>Commitment</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id}>
              <td>
                <div style={{ display: "grid", gap: 6 }}>
                  <Link href={`/tasks/${encodeURIComponent(task.id)}`} style={{ fontWeight: 600 }}>
                    {task.title}
                  </Link>
                  <div className="muted" style={{ fontSize: 13 }}>{task.requester}</div>
                </div>
              </td>
              <td><TaskStatusPill status={task.status} /></td>
              <td><PrivacyPill privacy={task.privacy} /></td>
              <td>{formatMoney(task.reward, task.currency)}</td>
              <td className="mono muted">{formatDate(task.dueAt)}</td>
              <td className="mono muted">{shortHash(task.commitmentHash, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
