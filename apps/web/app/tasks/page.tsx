import Link from "next/link"
import SiteShell from "@/components/site-shell"
import TaskTable from "@/components/task-table"
import DataSourcePill from "@/components/data-source-pill"
import { loadTasksData } from "@/lib/api"
import { readServerBetaAuthContext } from "@/lib/server-auth"

export default async function TasksPage() {
  const auth = await readServerBetaAuthContext()
  const { tasks, source } = await loadTasksData(auth ?? undefined)

  return (
    <SiteShell>
      <div className="surface section" style={{ marginBottom: 20 }}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Task list
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>Browse active tasks and commitments.</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 720, lineHeight: 1.6 }}>
          This view is intentionally compact: it shows the working surface, not a marketing page.
        </p>
        <div className="row" style={{ marginTop: 16, alignItems: "center" }}>
          <DataSourcePill source={source} />
          <span className="badge">Fallback stays on the current beta queue</span>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <Link href="/create" className="button primary">Create task</Link>
          <Link href="/dashboard" className="button">Go to dashboard</Link>
        </div>
      </div>

      <TaskTable tasks={tasks} />
    </SiteShell>
  )
}
