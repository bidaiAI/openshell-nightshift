import Link from "next/link"
import SiteShell from "@/components/site-shell"
import WalletAdapterPlaceholder from "@/components/wallet-adapter"
import DataSourcePill from "@/components/data-source-pill"
import { formatMoney, shortHash } from "@/lib/format"
import { loadDashboardData } from "@/lib/api"
import { readServerBetaAuthContext } from "@/lib/server-auth"

export default async function DashboardPage() {
  const auth = await readServerBetaAuthContext()
  const { metrics, tasks, recentReceipts, source } = await loadDashboardData(auth ?? undefined)

  return (
    <SiteShell>
      <div className="surface section" style={{ marginBottom: 20 }}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Dashboard
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>Operator view for tasks, bids, and receipts.</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760, lineHeight: 1.6 }}>
          This is the control surface for the creator or the operator. It stays focused on progress, status, and payout readiness.
        </p>
        <div className="row" style={{ marginTop: 16, alignItems: "center" }}>
          <DataSourcePill source={source} />
          <span className="badge">Live surface with mock resilience</span>
        </div>
      </div>

      <section className="row" style={{ marginBottom: 20 }}>
        {metrics.map(metric => (
          <div key={metric.label} className="surface-soft section" style={{ flex: "1 1 200px" }}>
            <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>{metric.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, marginTop: 10 }}>{metric.value}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{metric.detail}</div>
          </div>
        ))}
      </section>

      <div className="row" style={{ alignItems: "start" }}>
        <div style={{ flex: "1 1 320px" }}>
          <WalletAdapterPlaceholder />
        </div>

        <section className="surface section" style={{ flex: "2 1 620px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Active work</div>
              <div className="muted" style={{ fontSize: 13 }}>Assignments waiting on execution or acceptance.</div>
            </div>
            <Link href="/tasks" className="button">Open task queue</Link>
          </div>

          <div className="stack" style={{ marginTop: 16 }}>
            {tasks.length ? tasks.map(task => (
              <div key={task.id} className="surface-soft" style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <Link href={`/tasks/${encodeURIComponent(task.id)}`} style={{ fontWeight: 600 }}>{task.title}</Link>
                    <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{task.requester}</div>
                  </div>
                  <div className="mono muted">{shortHash(task.commitmentHash, 6)}</div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <span className="badge">{task.status}</span>
                  <span className="badge">{formatMoney(task.reward, task.currency)}</span>
                  <span className="badge">{task.privacy}</span>
                </div>
              </div>
            )) : (
              <div className="surface-soft" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600 }}>No active work yet.</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                  Create a task to populate this dashboard.
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="stack" style={{ flex: "1 1 300px" }}>
          <section className="surface section">
            <div style={{ fontSize: 18, fontWeight: 600 }}>Workflow status</div>
            <div className="stack" style={{ marginTop: 12, lineHeight: 1.75 }}>
              <div>1. Task commitment prepared</div>
              <div>2. Bids collected privately</div>
              <div>3. Receipt waiting for review</div>
              <div>4. Funds released on acceptance</div>
            </div>
          </section>

          <section className="surface section">
            <div style={{ fontSize: 18, fontWeight: 600 }}>Recent receipts</div>
            <div className="stack" style={{ marginTop: 12 }}>
              {recentReceipts.length ? recentReceipts.map(task => (
                <div key={task.id} className="surface-soft" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 600 }}>{task.title}</div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Receipt {shortHash(task.receiptHash, 7)}</div>
                </div>
              )) : (
                <div className="surface-soft" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 600 }}>No settled receipts yet.</div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                    Delivery proofs will show up here once tasks settle.
                  </div>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </SiteShell>
  )
}
