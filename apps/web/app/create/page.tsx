import SiteShell from "@/components/site-shell"
import CreateTaskForm from "@/components/create-task-form"
import { readServerWorkspaceId } from "@/lib/server-auth"

export default async function CreateTaskPage() {
  const workspaceId = await readServerWorkspaceId()

  return (
    <SiteShell>
      <div className="surface section" style={{ marginBottom: 20 }}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Create task
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>Publish a private task commitment.</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760, lineHeight: 1.6 }}>
          This form posts to the live API when available, then falls back to a local draft so beta testing never dead-ends.
        </p>
        {workspaceId ? (
          <div className="row" style={{ marginTop: 12 }}>
            <span className="badge private">Isolated workspace {workspaceId.slice(0, 10)}</span>
          </div>
        ) : null}
      </div>

      <CreateTaskForm />
    </SiteShell>
  )
}
