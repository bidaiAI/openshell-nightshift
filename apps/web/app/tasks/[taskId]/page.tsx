import Link from "next/link"
import { notFound } from "next/navigation"
import SiteShell from "@/components/site-shell"
import DataSourcePill from "@/components/data-source-pill"
import { PrivacyPill, TaskStatusPill } from "@/components/status-pill"
import { formatDate, formatMoney, shortHash } from "@/lib/format"
import { loadTaskData } from "@/lib/api"
import { readServerBetaAuthContext, readServerWorkspaceId } from "@/lib/server-auth"
import TaskDetailActions from "@/components/task-detail-actions"

export default async function TaskDetailPage({ params }: { params: { taskId: string } | Promise<{ taskId: string }> }) {
  const { taskId } = await params
  const auth = await readServerBetaAuthContext()
  const workspaceId = await readServerWorkspaceId()
  const { task, assignments, receipts, disputes, source } = await loadTaskData(taskId, auth ?? undefined)

  if (!task) {
    notFound()
  }

  return (
    <SiteShell>
      <div className="row" style={{ alignItems: "start" }}>
        <div className="surface section" style={{ flex: "1 1 680px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
            <div style={{ maxWidth: 560 }}>
              <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
                <DataSourcePill source={source} />
                <span className="badge">Task detail</span>
                {workspaceId ? <span className="badge private">Workspace {workspaceId.slice(0, 10)}</span> : null}
              </div>
              <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Task detail
              </div>
              <h1 style={{ margin: "10px 0 12px", fontSize: 38, lineHeight: 1.05 }}>{task.title}</h1>
              <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>{task.brief}</p>
            </div>
            <div className="stack tight">
              <TaskStatusPill status={task.status} />
              <PrivacyPill privacy={task.privacy} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 20 }}>
            <div className="surface-soft section" style={{ flex: "1 1 180px", padding: 16 }}>
              <div className="mono muted" style={{ fontSize: 12 }}>Reward</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{formatMoney(task.reward, task.currency)}</div>
            </div>
            <div className="surface-soft section" style={{ flex: "1 1 180px", padding: 16 }}>
              <div className="mono muted" style={{ fontSize: 12 }}>Due</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{formatDate(task.dueAt)}</div>
            </div>
            <div className="surface-soft section" style={{ flex: "1 1 240px", padding: 16 }}>
              <div className="mono muted" style={{ fontSize: 12 }}>Commitment</div>
              <div className="mono" style={{ fontSize: 13, marginTop: 8 }}>{shortHash(task.commitmentHash, 10)}</div>
            </div>
          </div>

          <div className="stack" style={{ marginTop: 20 }}>
            <div>
              <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Private brief</div>
              <div className="surface-soft" style={{ marginTop: 10, padding: 16, lineHeight: 1.7 }}>{task.privateBrief}</div>
            </div>

            <div>
              <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Disclosure scope</div>
              <div className="row" style={{ marginTop: 10 }}>
                {task.disclosureScope.map(scope => (
                  <span key={scope} className="badge private">{scope}</span>
                ))}
              </div>
            </div>

            {task.execution ? (
              <div>
                <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Execution policy</div>
                <div className="surface-soft" style={{ marginTop: 10, padding: 16, lineHeight: 1.7 }}>
                  <div><strong>Transport:</strong> {task.execution.transport}</div>
                  <div><strong>Mode:</strong> {task.execution.mode}</div>
                  <div><strong>Network policy:</strong> {task.execution.networkPolicy}</div>
                  <div><strong>Preferred provider:</strong> {task.execution.preferredProvider ?? "worker choice"}</div>
                  {task.execution.preferredModel ? <div><strong>Preferred model:</strong> {task.execution.preferredModel}</div> : null}
                  {task.execution.providerAllowlist?.length ? <div><strong>Provider allowlist:</strong> {task.execution.providerAllowlist.join(", ")}</div> : null}
                  <div><strong>Required capabilities:</strong> {task.execution.requiredCapabilities.length ? task.execution.requiredCapabilities.join(", ") : "none"}</div>
                  {task.execution.toolProfile?.length ? <div><strong>Tool profile:</strong> {task.execution.toolProfile.join(", ")}</div> : null}
                </div>
              </div>
            ) : null}

            {task.compactProjection ? (
              <div>
                <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Compact state projection</div>
                <div className="surface-soft" style={{ marginTop: 10, padding: 16, lineHeight: 1.7 }}>
                  <div><strong>Contract:</strong> {task.compactProjection.contract}</div>
                  <div><strong>Phase:</strong> {task.compactProjection.phase}</div>
                  <div><strong>Next transition:</strong> {task.compactProjection.nextTransition}</div>
                  <div className="mono" style={{ marginTop: 10, fontSize: 13, wordBreak: "break-all" }}>
                    State commitment: {task.compactProjection.stateCommitment}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Public inputs:</strong>
                    <div className="stack tight" style={{ marginTop: 8 }}>
                      {task.compactProjection.publicInputs.map((input) => (
                        <div key={`${input.label}:${input.value}`} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                          <span className="mono muted" style={{ fontSize: 12 }}>{input.label}</span>
                          <span className="mono" style={{ fontSize: 12 }}>{shortHash(input.value, 10)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Private witness:</strong>{" "}
                    {task.compactProjection.privateWitness.length ? task.compactProjection.privateWitness.join(", ") : "none"}
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>Receipt snapshot</div>
              <div className="surface-soft" style={{ marginTop: 10, padding: 16 }}>
                <div className="muted" style={{ fontSize: 13 }}>{task.resultSummary}</div>
                <div className="mono" style={{ marginTop: 10, fontSize: 13 }}>Receipt hash: {task.receiptHash}</div>
                {receipts.length ? (
                  <div className="stack tight" style={{ marginTop: 14 }}>
                    {receipts.map((receipt) => (
                      <div key={receipt.id ?? receipt.receiptHash} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                        <span className="badge mono">{shortHash(receipt.receiptHash ?? receipt.hash ?? "receipt", 8)}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{receipt.summary ?? receipt.note ?? "Receipt submitted"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <aside className="surface section" style={{ flex: "0 1 340px" }}>
          <TaskDetailActions task={task} assignments={assignments} receipts={receipts} disputes={disputes} source={source} />

          <div style={{ marginTop: 16 }}>
            <Link href="/tasks" className="button">Back to queue</Link>
          </div>
        </aside>
      </div>
    </SiteShell>
  )
}
