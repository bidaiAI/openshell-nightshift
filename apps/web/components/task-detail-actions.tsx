"use client"

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import type { AssignmentSubmission, DisputeReasonCode, ModelCapability } from "@nightshift/common"
import { canonicalJsonBrowser, deriveCommitmentBrowser, sha256HexBrowser } from "@nightshift/common/browser"
import { useRouter } from "next/navigation"
import { activateBetaActorSession, activateLocalBetaSession, api, formatApiErrorMessage, readStoredBetaAccessToken, resetBetaWorkspace, writeStoredBetaAccessToken, type ApiAssignmentRecord, type ApiDisputeRecord, type ApiReceiptRecord, type DataSource } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import type { Task } from "@/lib/types"
import { walletAdapter } from "@/lib/wallet"

interface TaskDetailActionsProps {
  task: Task
  assignments: ApiAssignmentRecord[]
  receipts: ApiReceiptRecord[]
  disputes: ApiDisputeRecord[]
  source: DataSource
}

type ActionNotice = {
  tone: "neutral" | "success" | "error"
  message: string
}

const BID_TRANSPORT_OPTIONS = ["http-poller", "libp2p", "relay"] as const
const BID_PROVIDER_OPTIONS = ["anthropic", "openai", "xai", "ollama", "openai-compatible", "mock"] as const
const BID_CAPABILITY_OPTIONS = ["text", "json", "tool-calling"] as const
const DISPUTE_REASON_OPTIONS: readonly DisputeReasonCode[] = ["quality", "missing-artifacts", "policy", "timeout", "payment", "other"]

const DEFAULT_PROVIDER_MODELS: Record<(typeof BID_PROVIDER_OPTIONS)[number], string> = {
  anthropic: "claude-sonnet-4.6",
  openai: "gpt-5.4-mini",
  xai: "grok-4.20-mini",
  ollama: "llama3.2",
  "openai-compatible": "qwen2.5-14b-instruct",
  mock: "local-sandbox",
}

async function buildBidCommitment(input: {
  taskId: string
  workerAddress: string
  priceQuote: string
  etaHours: number
  note: string
  transport: "http-poller" | "libp2p" | "relay"
  provider: "anthropic" | "openai" | "xai" | "ollama" | "openai-compatible" | "mock"
  model: string
  capabilities: string[]
}): Promise<string> {
  return deriveCommitmentBrowser("nightshift-bid", {
    taskId: input.taskId,
    workerAddress: input.workerAddress,
    priceQuote: input.priceQuote,
    etaHours: input.etaHours,
    note: input.note,
    transport: input.transport,
    provider: input.provider,
    model: input.model,
    capabilities: input.capabilities,
    nonce: Date.now(),
  })
}

async function buildBrowserBetaSubmission(input: {
  taskId: string
  assignment: ApiAssignmentRecord
  workerId: string
  summary: string
  artifactRefs: string[]
}): Promise<AssignmentSubmission> {
  const receiptId = crypto.randomUUID()
  const startedAt = input.assignment.startedAt ?? input.assignment.acceptedAt ?? input.assignment.createdAt ?? new Date().toISOString()
  const finishedAt = new Date().toISOString()

  const actionLog = [
    {
      step: "browser-beta-receipt-created",
      ts: finishedAt,
      details: {
        taskId: input.taskId,
        assignmentId: input.assignment.id,
        workerId: input.workerId,
      },
    },
  ]

  const artifacts = await Promise.all(input.artifactRefs.map(async (artifactRef, index) => ({
    kind: "file" as const,
    name: artifactRef,
    contentHash: await deriveCommitmentBrowser("browser-beta-artifact", {
      artifactRef,
      index,
      taskId: input.taskId,
      assignmentId: input.assignment.id,
    }),
  })))

  const actionLogHash = await sha256HexBrowser(canonicalJsonBrowser(actionLog.map((entry) => [entry.step, entry.ts, entry.details ?? {}])))
  const artifactHash = await sha256HexBrowser(canonicalJsonBrowser(artifacts))
  const result = {
    summary: input.summary,
    artifactRefs: input.artifactRefs,
    assignmentId: input.assignment.id,
    taskId: input.taskId,
  }
  const resultHash = await sha256HexBrowser(canonicalJsonBrowser(result))

  const receipt = {
    receiptId,
    assignmentId: input.assignment.id,
    taskId: input.taskId,
    bidId: input.assignment.bidId ?? crypto.randomUUID(),
    workerId: input.workerId,
    status: "generated" as const,
    startedAt,
    finishedAt,
    actionLogHash,
    artifactHash,
    resultHash,
    summary: input.summary,
    artifacts,
    actionLog,
    selectiveReveal: {
      origin: "browser-beta",
      artifactRefs: input.artifactRefs,
    },
  }

  const receiptHash = await sha256HexBrowser(canonicalJsonBrowser({
    receiptId: receipt.receiptId,
    assignmentId: receipt.assignmentId,
    taskId: receipt.taskId,
    workerId: receipt.workerId,
    status: receipt.status,
    actionLogHash: receipt.actionLogHash,
    artifactHash: receipt.artifactHash,
    resultHash: receipt.resultHash,
  }))

  return {
    assignmentId: input.assignment.id,
    workerId: input.workerId,
    receiptCommitment: {
      receiptId,
      assignmentId: input.assignment.id,
      receiptHash,
      createdAt: finishedAt,
    },
    result,
    receipt,
    payload: {
      origin: "browser-beta",
      artifactRefs: input.artifactRefs,
    },
  }
}

export default function TaskDetailActions({ task, assignments, receipts, disputes, source }: TaskDetailActionsProps) {
  const router = useRouter()
  const employerActorId = walletAdapter.getState().address ?? task.requester
  const [isPending, startTransition] = useTransition()
  const [workerAddress, setWorkerAddress] = useState("worker_beta_runner")
  const [workerToken, setWorkerToken] = useState("")
  const [employerToken, setEmployerToken] = useState("")
  const [priceQuote, setPriceQuote] = useState(task.reward ? String(task.reward) : "100")
  const [etaHours, setEtaHours] = useState(4)
  const [note, setNote] = useState("Can deliver a compact receipt with artifact hashes.")
  const [transport, setTransport] = useState<(typeof BID_TRANSPORT_OPTIONS)[number]>(task.execution?.transport ?? "http-poller")
  const initialProvider = (task.execution?.preferredProvider as (typeof BID_PROVIDER_OPTIONS)[number] | undefined) ?? "mock"
  const [provider, setProvider] = useState<(typeof BID_PROVIDER_OPTIONS)[number]>(initialProvider)
  const [model, setModel] = useState(DEFAULT_PROVIDER_MODELS[initialProvider])
  const [capabilities, setCapabilities] = useState<string[]>(
    task.execution?.requiredCapabilities.length ? [...task.execution.requiredCapabilities] : ["text", "json"],
  )
  const [receiptSummary, setReceiptSummary] = useState("Execution complete. Receipt commitment and artifact hashes attached.")
  const [artifactRefs, setArtifactRefs] = useState("result.json, action-log.json, receipt-proof.txt")
  const [disputeReason, setDisputeReason] = useState<DisputeReasonCode>("missing-artifacts")
  const [disputeSummary, setDisputeSummary] = useState("Need selective reveal of receipt bundle details before settlement.")
  const [disputeFields, setDisputeFields] = useState("artifactRefs, actionLogHash, resultHash")
  const [revealReason, setRevealReason] = useState("Providing the minimum requested delivery evidence for review.")
  const [revealFields, setRevealFields] = useState("artifactRefs, resultHash")
  const [revealRef, setRevealRef] = useState("nightshift://reveal/beta-bundle")
  const [notice, setNotice] = useState<ActionNotice | null>(null)

  const activeAssignment = useMemo(
    () => assignments.find((assignment) => assignment.status !== "completed" && assignment.status !== "cancelled") ?? assignments[0],
    [assignments],
  )
  const latestDispute = useMemo(
    () => disputes.find((dispute) => dispute.status === "open" || dispute.status === "revealed") ?? disputes[0],
    [disputes],
  )
  const currentWorkerActorId = activeAssignment?.workerAddress ?? workerAddress

  useEffect(() => {
    setEmployerToken(readStoredBetaAccessToken({
      actorId: employerActorId,
      role: "employer",
    }))
  }, [employerActorId])

  useEffect(() => {
    setWorkerToken(readStoredBetaAccessToken({
      actorId: currentWorkerActorId,
      role: "worker",
    }))
  }, [currentWorkerActorId])

  const canCreateBid = source === "api" && task.status === "open"
  const canSelectBid = source === "api" && task.status === "open"
  const canSubmitReceipt = source === "api" && task.status === "assigned" && Boolean(activeAssignment?.id)
  const canSettle = source === "api" && task.status === "submitted" && Boolean(activeAssignment?.id)
  const canOpenDispute = source === "api" && task.status === "submitted" && Boolean(activeAssignment?.id)
  const canSubmitReveal = source === "api" && Boolean(latestDispute?.id) && (task.status === "disputed" || latestDispute?.status === "open" || latestDispute?.status === "revealed")

  function runAction(work: () => Promise<void>) {
    startTransition(() => {
      void work().catch((error) => {
        setNotice({
          tone: "error",
          message: formatApiErrorMessage(error),
        })
      })
    })
  }

  function toggleCapability(capability: string) {
    setCapabilities((current) => (
      current.includes(capability)
        ? current.filter((value) => value !== capability)
        : [...current, capability]
    ))
  }

  function activateEmployerView() {
    runAction(async () => {
      await activateBetaActorSession({
        actorId: employerActorId,
        role: "employer",
      }, employerToken)
      router.refresh()
    })
  }

  function activateWorkerView() {
    runAction(async () => {
      await activateBetaActorSession({
        actorId: currentWorkerActorId,
        role: "worker",
      }, workerToken)
      router.refresh()
    })
  }

  async function bootstrapEmployerSession() {
    try {
      const session = await activateLocalBetaSession("employer")
      setEmployerToken(readStoredBetaAccessToken({
        actorId: session.actorId,
        role: "employer",
      }))
      router.refresh()
    } catch (error) {
      setNotice({
        tone: "error",
        message: formatApiErrorMessage(error),
      })
    }
  }

  async function resetEmployerWorkspace() {
    try {
      const session = await resetBetaWorkspace("employer")
      setNotice({
        tone: "success",
        message: `Started fresh isolated workspace ${session.workspaceId?.slice(0, 10) ?? "beta"}.`,
      })
      setEmployerToken(readStoredBetaAccessToken({
        actorId: session.actorId,
        role: "employer",
      }))
      router.refresh()
    } catch (error) {
      setNotice({
        tone: "error",
        message: formatApiErrorMessage(error),
      })
    }
  }

  async function bootstrapWorkerSession() {
    try {
      const session = await activateLocalBetaSession("worker")
      setWorkerAddress(session.actorId)
      setWorkerToken(readStoredBetaAccessToken({
        actorId: session.actorId,
        role: "worker",
      }))
      router.refresh()
    } catch (error) {
      setNotice({
        tone: "error",
        message: formatApiErrorMessage(error),
      })
    }
  }

  async function resetWorkerWorkspace() {
    try {
      const session = await resetBetaWorkspace("worker")
      setNotice({
        tone: "success",
        message: `Started fresh isolated workspace ${session.workspaceId?.slice(0, 10) ?? "beta"}.`,
      })
      setWorkerAddress(session.actorId)
      setWorkerToken(readStoredBetaAccessToken({
        actorId: session.actorId,
        role: "worker",
      }))
      router.refresh()
    } catch (error) {
      setNotice({
        tone: "error",
        message: formatApiErrorMessage(error),
      })
    }
  }

  function handleBidSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canCreateBid) {
      setNotice({ tone: "error", message: "Live bid submission is available only for open API-backed tasks." })
      return
    }

    runAction(async () => {
      const bidCommitment = await buildBidCommitment({
        taskId: task.id,
        workerAddress,
        priceQuote,
        etaHours,
        note,
        transport,
        provider,
        model,
        capabilities,
      })

      await api.createBid(task.id, {
        workerAddress,
        bidCommitment,
        encryptedBidRef: `nightshift://bid/${task.id}/${encodeURIComponent(workerAddress)}`,
        priceQuote,
        etaHours,
        executionOffer: {
          transports: [transport],
          providers: [
            {
              provider,
              model,
              capabilities: (capabilities.length ? capabilities : ["text"]) as ModelCapability[],
              pricingTier: provider === "mock" || provider === "ollama" ? "local" : "metered",
              ...(provider === "mock" || provider === "ollama" ? { local: true } : {}),
            },
          ],
          supportedTools: ["receipt", ...(task.execution?.mode === "tool-only" ? ["local-sandbox"] : ["fetch"])],
          notes: note,
        },
      }, {
        actorId: workerAddress,
        role: "worker",
        token: workerToken,
      })

      setNotice({ tone: "success", message: "Sealed bid submitted." })
      router.refresh()
    })
  }

  function handleSelectBid(bidId: string) {
    if (!canSelectBid) {
      setNotice({ tone: "error", message: "Bid selection is available only while the task is open." })
      return
    }

    runAction(async () => {
      await api.createAssignment(task.id, {
        bidId,
      }, {
        actorId: employerActorId,
        role: "employer",
        token: employerToken,
      })

      setNotice({ tone: "success", message: "Worker assigned to task." })
      router.refresh()
    })
  }

  function handleSettle() {
    if (!activeAssignment?.id || !canSettle) {
      setNotice({ tone: "error", message: "No submitted assignment is ready to settle." })
      return
    }

    runAction(async () => {
      await api.acceptAssignment(task.id, { assignmentId: activeAssignment.id }, {
        actorId: employerActorId,
        role: "employer",
        token: employerToken,
      })
      setNotice({ tone: "success", message: "Task settled and marked ready for payout." })
      router.refresh()
    })
  }

  function handleOpenDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeAssignment?.id || !canOpenDispute) {
      setNotice({ tone: "error", message: "Dispute can be opened only after a receipt is submitted." })
      return
    }

    runAction(async () => {
      const requestedFields = disputeFields
        .split(/[,\n;]/)
        .map((value) => value.trim())
        .filter(Boolean)

      await api.createDispute(task.id, {
        assignmentId: activeAssignment.id,
        reasonCode: disputeReason,
        summary: disputeSummary,
        requestedFields,
      }, {
        actorId: employerActorId,
        role: "employer",
        token: employerToken,
      })

      setNotice({ tone: "success", message: "Dispute opened. Worker can now selectively reveal evidence." })
      router.refresh()
    })
  }

  function handleRevealSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!latestDispute?.id || !canSubmitReveal) {
      setNotice({ tone: "error", message: "No open dispute is available for reveal." })
      return
    }

    runAction(async () => {
      const revealedFields = revealFields
        .split(/[,\n;]/)
        .map((value) => value.trim())
        .filter(Boolean)
      const workerId = activeAssignment?.workerAddress ?? workerAddress
      const revealBundleHash = await deriveCommitmentBrowser("nightshift-reveal-bundle", {
        disputeId: latestDispute.id,
        assignmentId: latestDispute.assignmentId ?? activeAssignment?.id ?? "unknown-assignment",
        taskId: task.id,
        revealReason,
        revealedFields,
        revealRef,
      })

      await api.submitReveal(latestDispute.id, {
        revealReason,
        revealedFields,
        revealBundleHash,
        revealRef,
      }, {
        actorId: workerId,
        role: "worker",
        token: workerToken,
      })

      setNotice({ tone: "success", message: "Selective reveal submitted to the dispute record." })
      router.refresh()
    })
  }

  function handleReceiptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeAssignment?.id || !canSubmitReceipt) {
      setNotice({ tone: "error", message: "No active assignment is ready for receipt submission." })
      return
    }

    runAction(async () => {
      const normalizedArtifacts = artifactRefs
        .split(/[,\n;]/)
        .map((value) => value.trim())
        .filter(Boolean)
      const workerId = activeAssignment.workerAddress ?? workerAddress
      const submission = await buildBrowserBetaSubmission({
        taskId: task.id,
        assignment: activeAssignment,
        workerId,
        summary: receiptSummary,
        artifactRefs: normalizedArtifacts,
      })

      await api.submitAssignmentResult(activeAssignment.id, submission, {
        actorId: workerId,
        role: "worker",
        token: workerToken,
      })

      setNotice({ tone: "success", message: "Receipt submitted for employer review." })
      router.refresh()
    })
  }

  return (
    <div className="stack">
      <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        Bids
      </div>
      <div className="surface-soft" style={{ padding: 16, marginTop: 12 }}>
        <label className="stack tight">
          <span className="mono muted" style={{ fontSize: 12 }}>Employer access token (stored locally)</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            value={employerToken}
            onChange={(event) => {
              const nextValue = event.target.value
              setEmployerToken(nextValue)
              writeStoredBetaAccessToken({
                actorId: employerActorId,
                role: "employer",
              }, nextValue)
            }}
          />
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="button" type="button" disabled={isPending || !employerToken.trim()} onClick={activateEmployerView}>
            View as employer
          </button>
          <button className="button" type="button" disabled={isPending} onClick={() => void bootstrapEmployerSession()}>
            Start employer access session
          </button>
          <button className="button ghost" type="button" disabled={isPending} onClick={() => void resetEmployerWorkspace()}>
            Fresh workspace
          </button>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {task.bids.length ? task.bids.map((bid) => (
          <div key={bid.id} className="surface-soft" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ fontWeight: 600 }}>{bid.worker}</div>
              <span className="badge">{bid.status}</span>
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>{bid.note}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="badge">{formatMoney(bid.amount, bid.currency)}</span>
              <span className="badge mono">{bid.durationHours}h</span>
            </div>
            {canSelectBid ? (
              <div style={{ marginTop: 12 }}>
                <button className="button primary" type="button" disabled={isPending} onClick={() => handleSelectBid(bid.id)}>
                  Select bid
                </button>
              </div>
            ) : null}
          </div>
        )) : (
          <div className="surface-soft" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600 }}>No bids yet.</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
              This task is waiting for a sealed offer.
            </div>
          </div>
        )}
      </div>

      <form className="surface-soft" style={{ padding: 16, marginTop: 16 }} onSubmit={handleBidSubmit}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Submit sealed bid
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Worker address</span>
            <input className="input" value={workerAddress} onChange={(event) => setWorkerAddress(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Price quote</span>
            <input className="input" value={priceQuote} onChange={(event) => setPriceQuote(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>ETA (hours)</span>
            <input className="input" type="number" min="1" value={etaHours} onChange={(event) => setEtaHours(Number(event.target.value) || 1)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Bid note</span>
            <textarea className="textarea" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <label className="stack tight">
          <span className="mono muted" style={{ fontSize: 12 }}>Worker access token (stored locally)</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={workerToken}
              onChange={(event) => {
                const nextValue = event.target.value
                setWorkerToken(nextValue)
                writeStoredBetaAccessToken({
                  actorId: workerAddress,
                  role: "worker",
                }, nextValue)
              }}
            />
          </label>
          <div className="row">
            <button className="button" type="button" disabled={isPending || !workerToken.trim()} onClick={activateWorkerView}>
              View as worker
            </button>
            <button className="button" type="button" disabled={isPending} onClick={() => void bootstrapWorkerSession()}>
              Start worker access session
            </button>
            <button className="button ghost" type="button" disabled={isPending} onClick={() => void resetWorkerWorkspace()}>
              Fresh workspace
            </button>
          </div>
          <div className="row">
            <label className="stack tight" style={{ flex: 1 }}>
              <span className="mono muted" style={{ fontSize: 12 }}>Transport</span>
              <select className="select" value={transport} onChange={(event) => setTransport(event.target.value as (typeof BID_TRANSPORT_OPTIONS)[number])}>
                {BID_TRANSPORT_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="stack tight" style={{ flex: 1 }}>
              <span className="mono muted" style={{ fontSize: 12 }}>Model provider</span>
              <select
                className="select"
                value={provider}
                onChange={(event) => {
                  const nextProvider = event.target.value as (typeof BID_PROVIDER_OPTIONS)[number]
                  setProvider(nextProvider)
                  setModel(DEFAULT_PROVIDER_MODELS[nextProvider])
                }}
              >
                {BID_PROVIDER_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Model name</span>
            <input className="input" value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
          <div className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Capabilities</span>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {BID_CAPABILITY_OPTIONS.map((capability) => {
                const active = capabilities.includes(capability)
                return (
                  <button
                    key={capability}
                    className="button"
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleCapability(capability)}
                    style={{
                      opacity: active ? 1 : 0.72,
                      borderColor: active ? "rgba(110,169,255,0.55)" : undefined,
                    }}
                  >
                    {active ? "✓ " : ""}{capability}
                  </button>
                )
              })}
            </div>
          </div>
          <button className="button" type="submit" disabled={isPending || !canCreateBid}>
            {isPending ? "Submitting…" : "Submit bid"}
          </button>
          {!canCreateBid ? (
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Bid submission is enabled only for live API-backed tasks that are still open.
            </div>
          ) : null}
        </div>
      </form>

      <form className="surface-soft" style={{ padding: 16, marginTop: 16 }} onSubmit={handleReceiptSubmit}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Submit receipt
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Receipt summary</span>
            <textarea className="textarea" rows={4} value={receiptSummary} onChange={(event) => setReceiptSummary(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Artifact refs</span>
            <input className="input" value={artifactRefs} onChange={(event) => setArtifactRefs(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Worker access token (stored locally)</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={workerToken}
              onChange={(event) => {
                const nextValue = event.target.value
                setWorkerToken(nextValue)
                writeStoredBetaAccessToken({
                  actorId: currentWorkerActorId,
                  role: "worker",
                }, nextValue)
              }}
            />
          </label>
          <button className="button" type="submit" disabled={isPending || !canSubmitReceipt}>
            {isPending ? "Submitting…" : "Submit receipt"}
          </button>
          {!canSubmitReceipt ? (
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Receipt submission is enabled only when a live assignment is active and awaiting delivery.
            </div>
          ) : null}
        </div>
      </form>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="button primary" type="button" disabled={isPending || !canSettle} onClick={handleSettle}>
          {isPending ? "Working…" : "Accept receipt & settle"}
        </button>
      </div>

      {activeAssignment ? (
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 14 }}>
          Active assignment: <span className="mono">{activeAssignment.id}</span>
        </div>
      ) : null}

      {receipts.length ? (
        <div className="surface-soft" style={{ padding: 14, marginTop: 14 }}>
          <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Recent receipts
          </div>
          <div className="stack tight" style={{ marginTop: 12 }}>
            {receipts.slice(0, 3).map((receipt) => (
              <div key={receipt.id ?? receipt.receiptHash} className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <span className="mono">{receipt.receiptHash ?? receipt.hash ?? "receipt"}</span>
                {" — "}
                {receipt.summary ?? receipt.note ?? "Receipt submitted"}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <form className="surface-soft" style={{ padding: 16, marginTop: 16 }} onSubmit={handleOpenDispute}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Open dispute / request reveal
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Reason code</span>
            <select className="select" value={disputeReason} onChange={(event) => setDisputeReason(event.target.value as DisputeReasonCode)}>
              {DISPUTE_REASON_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Dispute summary</span>
            <textarea className="textarea" rows={3} value={disputeSummary} onChange={(event) => setDisputeSummary(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Requested fields</span>
            <input className="input" value={disputeFields} onChange={(event) => setDisputeFields(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Employer access token (stored locally)</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={employerToken}
              onChange={(event) => {
                const nextValue = event.target.value
                setEmployerToken(nextValue)
                writeStoredBetaAccessToken({
                  actorId: employerActorId,
                  role: "employer",
                }, nextValue)
              }}
            />
          </label>
          <button className="button" type="submit" disabled={isPending || !canOpenDispute}>
            {isPending ? "Opening…" : "Open dispute"}
          </button>
          {!canOpenDispute ? (
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Reveal requests are available only after a live receipt is submitted and before settlement.
            </div>
          ) : null}
        </div>
      </form>

      <form className="surface-soft" style={{ padding: 16, marginTop: 16 }} onSubmit={handleRevealSubmit}>
        <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Submit selective reveal
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Reveal reason</span>
            <textarea className="textarea" rows={3} value={revealReason} onChange={(event) => setRevealReason(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Revealed fields</span>
            <input className="input" value={revealFields} onChange={(event) => setRevealFields(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Reveal ref</span>
            <input className="input" value={revealRef} onChange={(event) => setRevealRef(event.target.value)} />
          </label>
          <label className="stack tight">
            <span className="mono muted" style={{ fontSize: 12 }}>Worker access token (stored locally)</span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={workerToken}
              onChange={(event) => {
                const nextValue = event.target.value
                setWorkerToken(nextValue)
                writeStoredBetaAccessToken({
                  actorId: currentWorkerActorId,
                  role: "worker",
                }, nextValue)
              }}
            />
          </label>
          <button className="button" type="submit" disabled={isPending || !canSubmitReveal}>
            {isPending ? "Revealing…" : "Submit reveal"}
          </button>
          {!canSubmitReveal ? (
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              A selective reveal requires an open dispute record.
            </div>
          ) : null}
        </div>
      </form>

      {disputes.length ? (
        <div className="surface-soft" style={{ padding: 14, marginTop: 14 }}>
          <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Disputes
          </div>
          <div className="stack tight" style={{ marginTop: 12 }}>
            {disputes.slice(0, 3).map((dispute) => (
              <div key={dispute.id} className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <span className="badge">{dispute.status ?? "open"}</span>
                {" "}
                <span className="mono">{dispute.reasonCode ?? "other"}</span>
                {" — "}
                {dispute.summary ?? "Selective reveal requested"}
                {dispute.reveal?.revealBundleHash ? (
                  <>
                    {" · "}
                    <span className="mono">{dispute.reveal.revealBundleHash}</span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className={`surface-soft`} style={{ padding: 14, marginTop: 14, borderColor: notice.tone === "error" ? "rgba(255,100,100,0.35)" : undefined }}>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{notice.message}</div>
        </div>
      ) : null}

      <div className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
        Bid selection and settlement now talk to the API. Bids also advertise provider/transport compatibility so the same task can later move from HTTP polling to libp2p without changing task or receipt semantics.
      </div>
    </div>
  )
}
