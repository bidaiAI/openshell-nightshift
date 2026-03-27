import assert from 'node:assert/strict'
import { hashCanonicalJson, hashParts } from '../packages/common/dist/hashing.js'

const apiBase = process.env.API_BASE_URL?.trim() || 'http://127.0.0.1:4010/v1'
const healthUrl = apiBase.replace(/\/v1\/?$/u, '/health')
const employerId = process.env.SMOKE_EMPLOYER_ID?.trim() || '0xA11cE0000000000000000000000000000000BEEF'
const workerId = process.env.SMOKE_WORKER_ID?.trim() || 'worker_proof_runner_3'
const employerToken = process.env.SMOKE_EMPLOYER_TOKEN?.trim() || 'nightshift-employer-beta-token'
const workerToken = process.env.SMOKE_WORKER_TOKEN?.trim() || 'nightshift-worker-beta-token'
const workspaceHeader = 'X-NightShift-Workspace-Id'
const workspaceAlpha = process.env.SMOKE_WORKSPACE_ALPHA?.trim() || 'ws_smoke_alpha'
const workspaceBeta = process.env.SMOKE_WORKSPACE_BETA?.trim() || 'ws_smoke_beta'

const employerHeaders = {
  Authorization: `Bearer ${employerToken}`,
  'X-NightShift-Actor-Id': employerId,
  'X-NightShift-Actor-Role': 'employer',
}

const workerHeaders = {
  Authorization: `Bearer ${workerToken}`,
  'X-NightShift-Actor-Id': workerId,
  'X-NightShift-Actor-Role': 'worker',
}

const employerAlphaHeaders = {
  ...employerHeaders,
  [workspaceHeader]: workspaceAlpha,
}

const employerBetaHeaders = {
  ...employerHeaders,
  [workspaceHeader]: workspaceBeta,
}

async function req(path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const text = await response.text()
  let data = null
  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  return { status: response.status, data, headers: response.headers }
}

function buildSubmission({ taskId, assignmentId, bidId, workerId, summary }) {
  const now = new Date().toISOString()
  const artifacts = [
    {
      kind: 'file',
      name: 'result.json',
      contentHash: hashCanonicalJson({ taskId, assignmentId, name: 'result.json' }),
    },
  ]
  const actionLog = [
    {
      step: 'beta-worker-finish',
      ts: now,
      details: {
        taskId,
        assignmentId,
        workerId,
      },
    },
  ]
  const result = {
    summary,
    taskId,
    assignmentId,
    artifactRefs: ['result.json'],
  }
  const actionLogHash = hashParts(actionLog.map((entry) => [entry.step, entry.ts, entry.details ?? {}]))
  const artifactHash = hashCanonicalJson(artifacts)
  const resultHash = hashCanonicalJson(result)
  const receiptId = crypto.randomUUID()
  const receipt = {
    receiptId,
    assignmentId,
    taskId,
    bidId,
    workerId,
    status: 'submitted',
    startedAt: now,
    finishedAt: now,
    actionLogHash,
    artifactHash,
    resultHash,
    summary,
    artifacts,
    actionLog,
    selectiveReveal: {
      origin: 'smoke-test',
    },
  }
  const receiptHash = hashCanonicalJson({
    receiptId,
    assignmentId,
    taskId,
    workerId,
    status: receipt.status,
    actionLogHash,
    artifactHash,
    resultHash,
  })

  return {
    assignmentId,
    workerId,
    result,
    receipt,
    receiptCommitment: {
      receiptId,
      assignmentId,
      receiptHash,
      createdAt: now,
    },
    payload: {
      origin: 'smoke-test',
    },
  }
}

const health = await fetch(healthUrl).then((response) => response.json())
assert.equal(health.ok, true)

const taskList = await req('/tasks')
assert.equal(taskList.status, 200)
assert.ok(Array.isArray(taskList.data.tasks))
assert.ok(taskList.data.tasks.length > 0)
const firstPublicView = taskList.data.tasks[0]
assert.equal(firstPublicView.employerAddress, undefined)
assert.equal(firstPublicView.encryptedTaskRef, undefined)
assert.ok(Array.isArray(firstPublicView.execution?.toolProfile) === false)

const firstTaskId = firstPublicView.id
const anonDetail = await req(`/tasks/${firstTaskId}`)
assert.equal(anonDetail.status, 200)
assert.ok(Array.isArray(anonDetail.data.bids) && anonDetail.data.bids.length === 0)
assert.ok(Array.isArray(anonDetail.data.assignments) && anonDetail.data.assignments.length === 0)
assert.ok(Array.isArray(anonDetail.data.receipts) && anonDetail.data.receipts.length === 0)
assert.ok(Array.isArray(anonDetail.data.disputes) && anonDetail.data.disputes.length === 0)
assert.equal(anonDetail.data.task.employerAddress, undefined)
assert.equal(anonDetail.data.task.encryptedTaskRef, undefined)

const createdTask = await req('/tasks', {
  method: 'POST',
  headers: employerHeaders,
  body: {
    employerAddress: employerId,
    title: 'Smoke test private task',
    publicSummary: 'Verify privacy and settlement flow',
    rewardAmount: '15.00',
    rewardAsset: 'USDC',
    visibility: 'private',
    taskCommitment: hashCanonicalJson({ title: 'Smoke test private task', employerId }),
    encryptedTaskRef: 'nightshift://task/smoke-private',
    deadlineAt: new Date(Date.now() + 3600_000).toISOString(),
    execution: {
      transport: 'http-poller',
      mode: 'worker-hosted-model',
      networkPolicy: 'allowlist-only',
      llm: {
        providerAllowlist: ['mock', 'ollama', 'openai-compatible'],
        requiredCapabilities: ['text', 'json'],
        preferredProvider: 'mock',
        preferredModel: 'local-sandbox',
        allowFallback: true,
      },
      toolProfile: ['receipt', 'fetch'],
    },
  },
})
assert.equal(createdTask.status, 201)
const taskId = createdTask.data.task.id

const anonPrivateDetail = await req(`/tasks/${taskId}`)
assert.equal(anonPrivateDetail.status, 200)
assert.equal(anonPrivateDetail.data.task.employerAddress, undefined)
assert.equal(anonPrivateDetail.data.task.encryptedTaskRef, undefined)
assert.deepEqual(anonPrivateDetail.data.bids, [])

const createdBid = await req(`/tasks/${taskId}/bids`, {
  method: 'POST',
  headers: workerHeaders,
  body: {
    workerAddress: workerId,
    bidCommitment: hashCanonicalJson({ taskId, workerId, quote: '12.50' }),
    encryptedBidRef: 'nightshift://bid/smoke-private',
    priceQuote: '12.50',
    etaHours: 2,
    executionOffer: {
      transports: ['http-poller'],
      providers: [
        {
          provider: 'openai-compatible',
          model: 'qwen2.5-14b-instruct',
          endpoint: 'http://127.0.0.1:1234/v1',
          capabilities: ['text', 'json'],
          local: true,
          pricingTier: 'local',
        },
      ],
      supportedTools: ['receipt', 'fetch'],
      notes: 'Smoke worker offer',
    },
  },
})
assert.equal(createdBid.status, 201)
const bidId = createdBid.data.bid.id

const workerDetailBeforeAssign = await req(`/tasks/${taskId}`, { headers: workerHeaders })
assert.equal(workerDetailBeforeAssign.status, 200)
assert.ok(workerDetailBeforeAssign.data.bids.length === 1)
assert.equal(workerDetailBeforeAssign.data.task.encryptedTaskRef, undefined)

const createdAssignment = await req(`/tasks/${taskId}/assignments`, {
  method: 'POST',
  headers: employerHeaders,
  body: { bidId },
})
assert.equal(createdAssignment.status, 201)
const assignmentId = createdAssignment.data.assignment.id

const workerDetailAfterAssign = await req(`/tasks/${taskId}`, { headers: workerHeaders })
assert.equal(workerDetailAfterAssign.status, 200)
assert.equal(workerDetailAfterAssign.data.task.encryptedTaskRef, 'nightshift://task/smoke-private')
assert.ok(workerDetailAfterAssign.data.assignments.some((assignment) => assignment.id === assignmentId))

const submission = buildSubmission({
  taskId,
  assignmentId,
  bidId,
  workerId,
  summary: 'Smoke worker finished task and attached hashes.',
})
const submitted = await req(`/assignments/${assignmentId}/submit`, {
  method: 'POST',
  headers: workerHeaders,
  body: submission,
})
assert.equal(submitted.status, 200)

const anonAfterSubmit = await req(`/tasks/${taskId}`)
assert.equal(anonAfterSubmit.status, 200)
assert.deepEqual(anonAfterSubmit.data.receipts, [])

const dispute = await req(`/tasks/${taskId}/disputes`, {
  method: 'POST',
  headers: employerHeaders,
  body: {
    assignmentId,
    reasonCode: 'missing-artifacts',
    summary: 'Need limited reveal before payout',
    requestedFields: ['artifactRefs', 'resultHash'],
  },
})
assert.equal(dispute.status, 201)
const disputeId = dispute.data.dispute.id

const settleBlocked = await req(`/tasks/${taskId}/accept`, {
  method: 'POST',
  headers: employerHeaders,
  body: { assignmentId },
})
assert.equal(settleBlocked.status, 409)
assert.equal(settleBlocked.data.error, 'assignment_under_dispute')

const revealBundleHash = hashCanonicalJson({ disputeId, taskId, assignmentId, fields: ['artifactRefs', 'resultHash'] })
const revealed = await req(`/disputes/${disputeId}/reveal`, {
  method: 'POST',
  headers: workerHeaders,
  body: {
    revealReason: 'Providing requested receipt metadata only',
    revealedFields: ['artifactRefs', 'resultHash'],
    revealBundleHash,
    revealRef: 'nightshift://reveal/smoke-bundle',
  },
})
assert.equal(revealed.status, 200)

const anonAfterReveal = await req(`/tasks/${taskId}`)
assert.equal(anonAfterReveal.status, 200)
assert.deepEqual(anonAfterReveal.data.disputes, [])

const oversizeTask = await req('/tasks', {
  method: 'POST',
  headers: employerHeaders,
  body: {
    employerAddress: employerId,
    title: 'Oversize payload guard task',
    publicSummary: 'Validate result budget limits',
    rewardAmount: '9.00',
    rewardAsset: 'USDC',
    visibility: 'private',
    taskCommitment: hashCanonicalJson({ title: 'Oversize payload guard task', employerId }),
    encryptedTaskRef: 'nightshift://task/oversize',
  },
})
assert.equal(oversizeTask.status, 201)
const oversizeTaskId = oversizeTask.data.task.id

const oversizeBid = await req(`/tasks/${oversizeTaskId}/bids`, {
  method: 'POST',
  headers: workerHeaders,
  body: {
    workerAddress: workerId,
    bidCommitment: hashCanonicalJson({ oversizeTaskId, workerId, quote: '5.00' }),
    priceQuote: '5.00',
    etaHours: 1,
    executionOffer: {
      transports: ['http-poller'],
      providers: [{ provider: 'mock', model: 'local-sandbox', capabilities: ['text', 'json'], local: true, pricingTier: 'local' }],
    },
  },
})
assert.equal(oversizeBid.status, 201)
const oversizeAssignment = await req(`/tasks/${oversizeTaskId}/assignments`, {
  method: 'POST',
  headers: employerHeaders,
  body: { bidId: oversizeBid.data.bid.id },
})
assert.equal(oversizeAssignment.status, 201)

const hugeString = 'x'.repeat(70_000)
const oversizeNow = new Date().toISOString()
const oversizeSubmission = {
  assignmentId: oversizeAssignment.data.assignment.id,
  workerId,
  receiptCommitment: {
    receiptId: crypto.randomUUID(),
    assignmentId: oversizeAssignment.data.assignment.id,
    receiptHash: hashCanonicalJson({ marker: 'placeholder' }),
    createdAt: oversizeNow,
  },
  receipt: {
    receiptId: crypto.randomUUID(),
    assignmentId: oversizeAssignment.data.assignment.id,
    taskId: oversizeTaskId,
    bidId: oversizeBid.data.bid.id,
    workerId,
    status: 'submitted',
    startedAt: oversizeNow,
    finishedAt: oversizeNow,
    actionLogHash: hashCanonicalJson({ marker: 'placeholder' }),
    artifactHash: hashCanonicalJson([]),
    resultHash: hashCanonicalJson({ hugeString }),
    summary: 'oversize',
    artifacts: [],
    actionLog: [],
  },
  result: { hugeString },
}
const oversizeSubmit = await req(`/assignments/${oversizeAssignment.data.assignment.id}/submit`, {
  method: 'POST',
  headers: workerHeaders,
  body: oversizeSubmission,
})
assert.equal(oversizeSubmit.status, 400)
assert.equal(oversizeSubmit.data.error, 'validation_error')
assert.ok(Array.isArray(oversizeSubmit.data.details))

const isolatedTask = await req('/tasks', {
  method: 'POST',
  headers: employerAlphaHeaders,
  body: {
    employerAddress: employerId,
    title: 'Workspace alpha isolated task',
    publicSummary: 'Verify isolated beta workspaces',
    rewardAmount: '11.00',
    rewardAsset: 'USDC',
    visibility: 'private',
    taskCommitment: hashCanonicalJson({ title: 'Workspace alpha isolated task', employerId, workspaceAlpha }),
    encryptedTaskRef: 'nightshift://task/workspace-alpha',
  },
})
assert.equal(isolatedTask.status, 201)
const isolatedTaskId = isolatedTask.data.task.id

const alphaTasks = await req('/tasks', { headers: { [workspaceHeader]: workspaceAlpha } })
assert.equal(alphaTasks.status, 200)
assert.ok(alphaTasks.data.meta?.isolated === true)
assert.ok(alphaTasks.data.tasks.some((task) => task.id === isolatedTaskId))

const betaTasks = await req('/tasks', { headers: { [workspaceHeader]: workspaceBeta } })
assert.equal(betaTasks.status, 200)
assert.ok(betaTasks.data.meta?.isolated === true)
assert.ok(betaTasks.data.tasks.every((task) => task.id !== isolatedTaskId))

console.log(JSON.stringify({
  ok: true,
  apiBase,
  taskId,
  assignmentId,
  disputeId,
  checks: [
    'anon task list redacted',
    'anon task detail redacted',
    'worker sees own bid only before assignment',
    'assigned worker sees private task payload',
    'receipt submit succeeds',
    'settlement blocked during dispute',
    'anon reveal remains hidden',
    'oversize result rejected',
    'workspace-isolated task state',
  ],
}, null, 2))
