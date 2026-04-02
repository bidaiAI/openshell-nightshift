import Link from "next/link"
import SiteShell from "@/components/site-shell"
import TaskTable from "@/components/task-table"
import DataSourcePill from "@/components/data-source-pill"
import { formatDate, formatMoney } from "@/lib/format"
import { PrivacyPill, TaskStatusPill } from "@/components/status-pill"
import { loadHomeData } from "@/lib/api"
import { readServerBetaAuthContext } from "@/lib/server-auth"

export default async function HomePage() {
  const auth = await readServerBetaAuthContext()
  const { metrics, tasks, featuredTask, source } = await loadHomeData(auth ?? undefined)

  return (
    <SiteShell>
      <div className="surface section grid-lines" style={{ padding: 28, marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "end" }}>
          <div style={{ maxWidth: 720 }}>
            <div className="mono muted" style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Private beta
            </div>
            <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(40px, 8vw, 84px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>
              Private tasks.
              <br />
              Sealed bids.
              <br />
              Verified payout.
            </h1>
            <p className="muted" style={{ maxWidth: 620, fontSize: 16, lineHeight: 1.6, margin: 0 }}>
              OpenShell NightShift is a deployable Midnight-style beta for private tasks, sealed bids,
              verifiable receipts, and selective reveal. It is a small-scale runnable product with clear
              boundaries and a controlled execution model.
            </p>
            <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
              <DataSourcePill source={source} />
              <span className="badge">Isolated beta workspaces</span>
            </div>
          </div>
          <div className="stack" style={{ minWidth: 240 }}>
            <Link href="/create" className="button primary">Create task</Link>
            <Link href="/tasks" className="button">Browse tasks</Link>
            <Link href="/dashboard" className="button ghost">Open dashboard</Link>
          </div>
        </div>
      </div>

      <section className="row" style={{ marginBottom: 20 }}>
        {metrics.map(metric => (
          <div key={metric.label} className="surface-soft section" style={{ flex: "1 1 200px" }}>
            <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>{metric.label}</div>
            <div style={{ fontSize: 34, fontWeight: 700, marginTop: 10 }}>{metric.value}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="row" style={{ alignItems: "start" }}>
        <div style={{ flex: "2 1 680px" }}>
          <TaskTable tasks={tasks} />
        </div>

        <div className="stack" style={{ flex: "1 1 320px" }}>
          <div className="surface section">
              <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Core workflow
              </div>
              <ol style={{ margin: "12px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Start a fresh isolated workspace.</li>
                <li>Inspect a private task commitment.</li>
                <li>Inspect assignment and receipt phases.</li>
                <li>See how selective reveal fits dispute resolution.</li>
              </ol>
              <div className="muted" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
                Every seeded task carries a Compact-style state projection so operators can immediately inspect the public/private state split and next contract transition.
              </div>
            </div>

          <div className="surface section">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Featured assignment</div>
                <div className="muted" style={{ fontSize: 13 }}>A compact view of the current workflow.</div>
              </div>
              {featuredTask ? <PrivacyPill privacy={featuredTask.privacy} /> : <span className="badge warn">No featured task</span>}
            </div>
            {featuredTask ? (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div>{featuredTask.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>{featuredTask.brief}</div>
                <div className="row tight">
                  <TaskStatusPill status={featuredTask.status} />
                  <span className="badge">{formatMoney(featuredTask.reward, featuredTask.currency)}</span>
                  <span className="badge mono">{formatDate(featuredTask.dueAt)}</span>
                  {featuredTask.compactProjection ? <span className="badge private">{featuredTask.compactProjection.phase}</span> : null}
                </div>
                {featuredTask.compactProjection ? (
                  <div className="surface-soft" style={{ padding: 12, marginTop: 4 }}>
                    <div className="mono muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      Compact state projection
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>{featuredTask.compactProjection.nextTransition}</div>
                    <div className="mono muted" style={{ marginTop: 6, fontSize: 12 }}>{featuredTask.compactProjection.stateCommitment}</div>
                  </div>
                ) : null}
                <Link href={`/tasks/${encodeURIComponent(featuredTask.id)}`} className="button">Open task detail</Link>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
                Create a new task to populate the beta surface.
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
