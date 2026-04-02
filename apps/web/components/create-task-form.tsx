"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { deriveCommitmentBrowser } from "@nightshift/common/browser"
import { activateLocalBetaSession, api, extractTaskRecord, mapApiTaskToTask, readStoredBetaAccessToken, resetBetaWorkspace, writeStoredBetaAccessToken, type CreateTaskInput } from "@/lib/api"
import { formatDate, formatMoney, shortHash } from "@/lib/format"
import type { PrivacyLevel, Task } from "@/lib/types"
import { walletAdapter } from "@/lib/wallet"

const DEFAULT_REQUESTER_ADDRESS = "0xA11cE0000000000000000000000000000000BEEF"

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; task: Task; source: "api" | "mock" }
  | { kind: "error"; message: string; task: Task }

const TRANSPORT_OPTIONS = ["http-poller", "libp2p", "relay"] as const
const MODE_OPTIONS = ["worker-hosted-model", "delegated-credential", "tool-only"] as const
const PROVIDER_OPTIONS = ["anthropic", "openai", "xai", "ollama", "openai-compatible", "mock"] as const

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task"
}

function splitScope(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function toIsoDateTime(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function buildPublicSummary(title: string, scope: string[], notes: string): string {
  const parts = [title.trim(), scope.length ? `Scope: ${scope.join(", ")}` : "", notes.trim()].filter(Boolean)
  return parts.join(" — ").slice(0, 240)
}

function buildExecutionInput(input: {
  transport: typeof TRANSPORT_OPTIONS[number]
  mode: typeof MODE_OPTIONS[number]
  preferredProvider: typeof PROVIDER_OPTIONS[number]
}): NonNullable<CreateTaskInput["execution"]> {
  return {
    transport: input.transport,
    mode: input.mode,
    networkPolicy: input.transport === "relay" ? "egress-ok" : "allowlist-only",
    ...(input.mode === "tool-only"
      ? { toolProfile: ["local-sandbox", "receipt"] }
      : {
          llm: {
            providerAllowlist: [input.preferredProvider, "mock"],
            requiredCapabilities: ["text", "json"],
            preferredProvider: input.preferredProvider,
            allowFallback: true,
          },
          toolProfile: ["fetch", "receipt"],
        }),
  }
}

async function buildCommitment(input: {
  title: string
  reward: number
  privacy: PrivacyLevel
  deadline: string
  scope: string[]
  notes: string
  employerAddress: string
  transport: typeof TRANSPORT_OPTIONS[number]
  mode: typeof MODE_OPTIONS[number]
  preferredProvider: typeof PROVIDER_OPTIONS[number]
}): Promise<string> {
  return deriveCommitmentBrowser("nightshift-task", {
    title: input.title,
    reward: input.reward,
    privacy: input.privacy,
    deadline: input.deadline,
    scope: input.scope,
    notes: input.notes.slice(0, 200),
    employerAddress: input.employerAddress,
    transport: input.transport,
    mode: input.mode,
    preferredProvider: input.preferredProvider,
  })
}

function buildDraftTask(input: CreateTaskInput, extras: { dueAt: string; scope: string[]; notes: string }): Task {
  const execution = input.execution
    ? {
        transport: input.execution.transport,
        mode: input.execution.mode,
        networkPolicy: input.execution.networkPolicy,
        ...(input.execution.llm?.preferredProvider ? { preferredProvider: input.execution.llm.preferredProvider } : {}),
        ...(input.execution.llm?.preferredModel ? { preferredModel: input.execution.llm.preferredModel } : {}),
        ...(input.execution.llm?.providerAllowlist?.length ? { providerAllowlist: input.execution.llm.providerAllowlist } : {}),
        requiredCapabilities: input.execution.llm?.requiredCapabilities ?? [],
        ...(input.execution.toolProfile?.length ? { toolProfile: input.execution.toolProfile } : {}),
      }
    : undefined

  return {
    id: `draft-${slugify(input.title)}-${Date.now()}`,
    title: input.title,
    requester: input.employerAddress,
    status: "open",
    privacy: input.visibility,
    reward: Number.parseFloat(input.rewardAmount) || 0,
    currency: input.rewardAsset as Task["currency"],
    dueAt: extras.dueAt,
    commitmentHash: input.taskCommitment,
    brief: input.publicSummary,
    privateBrief: extras.notes || "Private brief stored locally until the API responds.",
    disclosureScope: extras.scope.length ? extras.scope : ["commitment", "receipt"],
    resultSummary: "Waiting for bids.",
    receiptHash: `receipt-${slugify(input.title)}`,
    bids: [],
    ...(execution ? { execution } : {}),
  }
}

export default function CreateTaskForm() {
  const router = useRouter()
  const [title, setTitle] = useState("Summarize confidential brief")
  const [reward, setReward] = useState("180")
  const [privacy, setPrivacy] = useState<PrivacyLevel>("private")
  const [deadline, setDeadline] = useState("2026-03-28T18:00")
  const [scope, setScope] = useState("memo, citations, acceptance note")
  const [notes, setNotes] = useState("Keep the raw brief encrypted; reveal only the final memo.")
  const [transport, setTransport] = useState<typeof TRANSPORT_OPTIONS[number]>("libp2p")
  const [mode, setMode] = useState<typeof MODE_OPTIONS[number]>("worker-hosted-model")
  const [preferredProvider, setPreferredProvider] = useState<typeof PROVIDER_OPTIONS[number]>("anthropic")
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" })
  const [commitmentPreview, setCommitmentPreview] = useState("Computing commitment…")
  const [walletAddress, setWalletAddress] = useState(() => walletAdapter.getState().address ?? DEFAULT_REQUESTER_ADDRESS)
  const [employerToken, setEmployerToken] = useState("")

  useEffect(() => {
    const syncWallet = () => {
      setWalletAddress(walletAdapter.getState().address ?? DEFAULT_REQUESTER_ADDRESS)
    }

    syncWallet()
    const interval = window.setInterval(syncWallet, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    setEmployerToken(readStoredBetaAccessToken({
      actorId: walletAddress,
      role: "employer",
    }))
  }, [walletAddress])

  useEffect(() => {
    const scopeItems = splitScope(scope)
    const employerAddress = walletAddress
    let cancelled = false

    void buildCommitment({
      title,
      reward: Number.parseFloat(reward) || 0,
      privacy,
      deadline,
      scope: scopeItems,
      notes,
      employerAddress,
      transport,
      mode,
      preferredProvider,
    }).then((value) => {
      if (!cancelled) {
        setCommitmentPreview(value)
      }
    }).catch(() => {
      if (!cancelled) {
        setCommitmentPreview("commitment-unavailable")
      }
    })

    return () => {
      cancelled = true
    }
  }, [deadline, mode, notes, preferredProvider, privacy, reward, scope, title, transport, walletAddress])

  const preview = useMemo(() => {
    const parsedReward = Number.parseFloat(reward)
    const rewardAmount = Number.isFinite(parsedReward) ? parsedReward : 0
    const scopeItems = splitScope(scope)
    const employerAddress = walletAddress

    const input: CreateTaskInput = {
      employerAddress,
      title,
      publicSummary: buildPublicSummary(title, scopeItems, notes),
      rewardAmount: rewardAmount.toFixed(2),
      rewardAsset: "USDC",
      visibility: privacy,
      taskCommitment: commitmentPreview,
      ...(privacy === "public" ? {} : { encryptedTaskRef: `nightshift://task/${slugify(title)}` }),
      deadlineAt: toIsoDateTime(deadline),
      execution: buildExecutionInput({ transport, mode, preferredProvider }),
    }

    return {
      input,
      rewardAmount,
      scopeItems,
      employerAddress,
      dueAt: toIsoDateTime(deadline),
    }
  }, [commitmentPreview, deadline, mode, notes, preferredProvider, privacy, reward, scope, title, transport, walletAddress])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmission({ kind: "submitting" })

    const parsedReward = Number.parseFloat(reward)
    const rewardAmount = Number.isFinite(parsedReward) ? parsedReward : 0
    const scopeItems = splitScope(scope)
    const employerAddress = walletAdapter.getState().address ?? DEFAULT_REQUESTER_ADDRESS
    const taskCommitment = await buildCommitment({
      title,
      reward: rewardAmount,
      privacy,
      deadline,
      scope: scopeItems,
      notes,
      employerAddress,
      transport,
      mode,
      preferredProvider,
    })

    const input: CreateTaskInput = {
      employerAddress,
      title,
      publicSummary: buildPublicSummary(title, scopeItems, notes),
      rewardAmount: rewardAmount.toFixed(2),
      rewardAsset: "USDC",
      visibility: privacy,
      taskCommitment,
      ...(privacy === "public" ? {} : { encryptedTaskRef: `nightshift://task/${slugify(title)}` }),
      deadlineAt: toIsoDateTime(deadline),
      execution: buildExecutionInput({ transport, mode, preferredProvider }),
    }

    const draftTask = buildDraftTask(input, {
      dueAt: toIsoDateTime(deadline),
      scope: scopeItems,
      notes,
    })

    try {
      const auth = {
        actorId: employerAddress,
        role: "employer" as const,
        token: employerToken,
      }
      const response = await api.createTask(input, auth)
      const record = extractTaskRecord(response)

      if (record) {
        setSubmission({
          kind: "success",
          task: mapApiTaskToTask(record, draftTask),
          source: "api",
        })
        return
      }

      setSubmission({
        kind: "success",
        task: draftTask,
        source: "mock",
      })
    } catch (error) {
      setSubmission({
        kind: "error",
        message: error instanceof Error ? error.message : "Task submission failed",
        task: draftTask,
      })
    }
  }

  async function handleBootstrapEmployerSession() {
    try {
      const session = await activateLocalBetaSession("employer")
      setWalletAddress(session.actorId)
      setEmployerToken(readStoredBetaAccessToken({
        actorId: session.actorId,
        role: "employer",
      }))
      router.refresh()
    } catch (error) {
      setSubmission({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not start the employer access session",
        task: buildDraftTask(preview.input, {
          dueAt: preview.dueAt,
          scope: preview.scopeItems,
          notes,
        }),
      })
    }
  }

  async function handleFreshWorkspace() {
    try {
      const session = await resetBetaWorkspace("employer")
      setWalletAddress(session.actorId)
      setEmployerToken(readStoredBetaAccessToken({
        actorId: session.actorId,
        role: "employer",
      }))
      router.refresh()
    } catch (error) {
      setSubmission({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not start a fresh isolated workspace",
        task: buildDraftTask(preview.input, {
          dueAt: preview.dueAt,
          scope: preview.scopeItems,
          notes,
        }),
      })
    }
  }

  return (
    <div className="row" style={{ alignItems: "start" }}>
      <form className="surface section" style={{ flex: "1 1 620px" }} onSubmit={handleSubmit}>
        <div className="stack">
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Task title</span>
            <input className="input" value={title} onChange={event => setTitle(event.target.value)} />
          </label>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Reward (USDC)</span>
            <input className="input" type="number" min="1" value={reward} onChange={event => setReward(event.target.value)} />
          </label>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Privacy level</span>
            <select className="select" value={privacy} onChange={event => setPrivacy(event.target.value as PrivacyLevel)}>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="selective">Selective</option>
            </select>
          </label>

          <div className="row">
            <label className="stack tight" style={{ flex: 1 }}>
              <span className="mono muted" style={{ fontSize: 12 }}>Transport</span>
              <select className="select" value={transport} onChange={event => setTransport(event.target.value as typeof TRANSPORT_OPTIONS[number])}>
                <option value="http-poller">HTTP poller</option>
                <option value="libp2p">libp2p</option>
                <option value="relay">Relay</option>
              </select>
            </label>

            <label className="stack tight" style={{ flex: 1 }}>
              <span className="mono muted" style={{ fontSize: 12 }}>Execution mode</span>
              <select className="select" value={mode} onChange={event => setMode(event.target.value as typeof MODE_OPTIONS[number])}>
                <option value="worker-hosted-model">Worker-hosted model</option>
                <option value="delegated-credential">Delegated credential</option>
                <option value="tool-only">Tool only</option>
              </select>
            </label>
          </div>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Preferred provider</span>
            <select className="select" value={preferredProvider} onChange={event => setPreferredProvider(event.target.value as typeof PROVIDER_OPTIONS[number])}>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="xai">xAI</option>
              <option value="ollama">Ollama</option>
              <option value="mock">Mock/local</option>
            </select>
          </label>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Deadline</span>
            <input className="input" type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} />
          </label>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Disclosure scope</span>
            <input className="input" value={scope} onChange={event => setScope(event.target.value)} />
          </label>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Private notes</span>
            <textarea className="textarea" rows={5} value={notes} onChange={event => setNotes(event.target.value)} />
          </label>

          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Employer access token (stored locally)</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={employerToken}
              onChange={event => {
                const nextValue = event.target.value
                setEmployerToken(nextValue)
                writeStoredBetaAccessToken({
                  actorId: walletAddress,
                  role: "employer",
                }, nextValue)
              }}
            />
          </label>
          <div className="row">
            <button className="button" type="button" onClick={() => void handleBootstrapEmployerSession()}>
              Start employer access session
            </button>
            <button className="button ghost" type="button" onClick={() => void handleFreshWorkspace()}>
              Fresh isolated workspace
            </button>
          </div>

          <div className="row">
            <button className="button primary" type="submit" disabled={submission.kind === "submitting"}>
              {submission.kind === "submitting" ? "Submitting…" : "Prepare commitment"}
            </button>
            <Link href="/tasks" className="button">Back to queue</Link>
          </div>
        </div>
      </form>

      <aside className="surface section" style={{ flex: "0 1 360px" }}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Commitment preview
        </div>
        <pre className="surface-soft" style={{ padding: 16, overflow: "auto", marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
{JSON.stringify(preview.input, null, 2)}
        </pre>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Current wallet: {preview.employerAddress ? `${preview.employerAddress.slice(0, 8)}…${preview.employerAddress.slice(-4)}` : "beta wallet"}
        </div>

        {submission.kind === "error" ? (
          <div className="surface-soft" style={{ marginTop: 16, padding: 16 }}>
            <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Offline fallback mode
            </div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Submission failed, but the local draft is still ready.</div>
            <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
              {submission.message}
            </div>
            <div className="badge private" style={{ marginTop: 12 }}>
              Draft id {shortHash(submission.task.id, 7)}
            </div>
          </div>
        ) : null}

        {submission.kind === "success" ? (
          <div className="surface-soft" style={{ marginTop: 16, padding: 16 }}>
            <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Submission ready
            </div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>
              {submission.source === "api" ? "Task created on the API." : "Local task draft prepared."}
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
              Due {formatDate(submission.task.dueAt)} · {formatMoney(submission.task.reward, submission.task.currency)}
            </div>
            <div className="mono" style={{ marginTop: 10, fontSize: 13 }}>
              Commitment {shortHash(submission.task.commitmentHash, 7)}
            </div>
            {submission.source === "api" ? (
              <div style={{ marginTop: 14 }}>
                <Link href={`/tasks/${encodeURIComponent(submission.task.id)}`} className="button primary">
                  Open task detail
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 16 }}>
          The contract should store only the commitment and payment state. The private brief stays off-chain; transport and provider preferences stay in the execution policy.
        </div>
      </aside>
    </div>
  )
}
