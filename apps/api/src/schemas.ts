import { z } from 'zod'

const hexCommitmentSchema = z.string().regex(/^0x[a-fA-F0-9]{8,}$/u, 'invalid_commitment')
const moneyStringSchema = z.string().regex(/^\d+(\.\d+)?$/u, 'invalid_amount')
const addressSchema = z.string().trim().min(3).max(120)
const ipfsOrOpaqueRefSchema = z.string().trim().min(1).max(500)
const providerCapabilitySchema = z.enum(['text', 'vision', 'tool-calling', 'json', 'streaming', 'long-context'])
const transportKindSchema = z.enum(['http-poller', 'libp2p', 'relay'])
const executionModeSchema = z.enum(['worker-hosted-model', 'delegated-credential', 'tool-only'])
const networkPolicySchema = z.enum(['disabled', 'allowlist-only', 'egress-ok'])
const disputeReasonCodeSchema = z.enum(['quality', 'missing-artifacts', 'policy', 'timeout', 'payment', 'other'])
const MAX_JSON_DEPTH = 8
const MAX_JSON_NODES = 1_500
const MAX_JSON_TOTAL_CHARS = 64_000
const MAX_JSON_STRING_CHARS = 8_000
const MAX_JSON_ARRAY_ITEMS = 256
const MAX_JSON_OBJECT_KEYS = 256

const workerExecutionOfferSchema = z.object({
  providers: z.array(z.object({
    provider: z.string().trim().min(1).max(40),
    model: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120).optional(),
    endpoint: z.string().trim().min(1).max(240).optional(),
    capabilities: z.array(providerCapabilitySchema).min(1).max(8),
    maxInputTokens: z.number().int().positive().max(10_000_000).optional(),
    local: z.boolean().optional(),
    pricingTier: z.enum(['local', 'bring-your-own-key', 'metered']).optional(),
  })).min(1).max(8),
  transports: z.array(transportKindSchema).min(1).max(4),
  supportedTools: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().trim().min(1).max(240).optional(),
})

type JsonBudgetResult = { ok: true } | { ok: false; reason: string }

function validateJsonBudget(value: unknown): JsonBudgetResult {
  const state = {
    nodes: 0,
    chars: 0,
  }

  const visit = (current: unknown, depth: number): JsonBudgetResult => {
    if (depth > MAX_JSON_DEPTH) {
      return { ok: false, reason: `json_too_deep_max_${MAX_JSON_DEPTH}` }
    }

    state.nodes += 1
    if (state.nodes > MAX_JSON_NODES) {
      return { ok: false, reason: `json_too_large_max_nodes_${MAX_JSON_NODES}` }
    }

    if (typeof current === 'string') {
      state.chars += current.length
      if (current.length > MAX_JSON_STRING_CHARS) {
        return { ok: false, reason: `json_string_too_large_max_${MAX_JSON_STRING_CHARS}` }
      }
      if (state.chars > MAX_JSON_TOTAL_CHARS) {
        return { ok: false, reason: `json_total_size_exceeded_max_${MAX_JSON_TOTAL_CHARS}` }
      }
      return { ok: true }
    }

    if (
      typeof current === 'number'
      || typeof current === 'boolean'
      || current === null
      || typeof current === 'undefined'
    ) {
      return { ok: true }
    }

    if (Array.isArray(current)) {
      if (current.length > MAX_JSON_ARRAY_ITEMS) {
        return { ok: false, reason: `json_array_too_large_max_${MAX_JSON_ARRAY_ITEMS}` }
      }

      for (const item of current) {
        const nested = visit(item, depth + 1)
        if (!nested.ok) {
          return nested
        }
      }

      return { ok: true }
    }

    if (typeof current === 'object') {
      const entries = Object.entries(current as Record<string, unknown>)
      if (entries.length > MAX_JSON_OBJECT_KEYS) {
        return { ok: false, reason: `json_object_too_large_max_${MAX_JSON_OBJECT_KEYS}` }
      }

      for (const [key, nestedValue] of entries) {
        state.chars += key.length
        if (state.chars > MAX_JSON_TOTAL_CHARS) {
          return { ok: false, reason: `json_total_size_exceeded_max_${MAX_JSON_TOTAL_CHARS}` }
        }

        const nested = visit(nestedValue, depth + 1)
        if (!nested.ok) {
          return nested
        }
      }

      return { ok: true }
    }

    return { ok: false, reason: 'json_contains_unsupported_value' }
  }

  return visit(value, 0)
}

function boundedJsonRecordSchema(messagePrefix: string) {
  return z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
    const budget = validateJsonBudget(value)
    if (!budget.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${messagePrefix}:${budget.reason}`,
      })
    }
  })
}

function parseStringList(value: unknown): string[] | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function parseProviderCatalog(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export const taskIdParamsSchema = z.object({
  taskId: z.string().uuid(),
})

export const assignmentIdParamsSchema = z.object({
  assignmentId: z.string().uuid(),
})

export const createTaskSchema = z.object({
  employerAddress: addressSchema,
  title: z.string().trim().min(3).max(120),
  publicSummary: z.string().trim().min(3).max(280),
  rewardAmount: moneyStringSchema,
  rewardAsset: z.string().trim().min(1).max(16).default('USDC'),
  visibility: z.enum(['public', 'private', 'selective']).default('private'),
  taskCommitment: hexCommitmentSchema,
  encryptedTaskRef: ipfsOrOpaqueRefSchema.optional(),
  deadlineAt: z.string().datetime().optional(),
  execution: z.object({
    transport: transportKindSchema,
    mode: executionModeSchema,
    networkPolicy: networkPolicySchema,
    llm: z.object({
      providerAllowlist: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
      modelAllowlist: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
      requiredCapabilities: z.array(providerCapabilitySchema).max(8).optional(),
      preferredProvider: z.string().trim().min(1).max(40).optional(),
      preferredModel: z.string().trim().min(1).max(80).optional(),
      allowFallback: z.boolean().optional(),
    }).optional(),
    toolProfile: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  }).optional(),
})

export const createBidSchema = z.object({
  workerAddress: addressSchema,
  bidCommitment: hexCommitmentSchema,
  encryptedBidRef: ipfsOrOpaqueRefSchema.optional(),
  priceQuote: moneyStringSchema.optional(),
  etaHours: z.number().int().positive().max(24 * 14).optional(),
  executionOffer: workerExecutionOfferSchema.optional(),
})

export const createAssignmentSchema = z.object({
  bidId: z.string().uuid(),
})

export const acceptAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
})

export const disputeIdParamsSchema = z.object({
  disputeId: z.string().uuid(),
})

export const createDisputeSchema = z.object({
  assignmentId: z.string().uuid(),
  reasonCode: disputeReasonCodeSchema,
  summary: z.string().trim().min(3).max(500),
  requestedFields: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
})

export const submitRevealSchema = z.object({
  revealReason: z.string().trim().min(3).max(240),
  revealedFields: z.array(z.string().trim().min(1).max(80)).max(20).min(1),
  revealRef: ipfsOrOpaqueRefSchema.optional(),
  revealBundleHash: hexCommitmentSchema,
})

export const pollAssignmentsQuerySchema = z.object({
  workerId: addressSchema,
  maxItems: z.coerce.number().int().min(1).max(10).optional(),
  workerName: z.string().trim().min(1).max(120).optional(),
  endpoint: z.string().trim().min(1).max(240).optional(),
  chain: z.string().trim().min(1).max(60).optional(),
  capabilities: z.preprocess(parseStringList, z.array(z.string().trim().min(1).max(40)).max(20).optional()),
  transports: z.preprocess(parseStringList, z.array(transportKindSchema).max(4).optional()),
  providerCatalog: z.preprocess(parseProviderCatalog, z.array(z.object({
    provider: z.string().trim().min(1).max(40),
    model: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120).optional(),
    endpoint: z.string().trim().min(1).max(240).optional(),
    capabilities: z.array(providerCapabilitySchema).min(1).max(8),
    maxInputTokens: z.number().int().positive().max(10_000_000).optional(),
    local: z.boolean().optional(),
    pricingTier: z.enum(['local', 'bring-your-own-key', 'metered']).optional(),
  })).max(8).optional()),
})

const actionLogEntrySchema = z.object({
  step: z.string().trim().min(1).max(80),
  ts: z.string().datetime(),
  details: boundedJsonRecordSchema('action_log_details_invalid').optional(),
})

const receiptArtifactSchema = z.object({
  kind: z.enum(['log', 'screenshot', 'file', 'snapshot', 'custom']),
  name: z.string().trim().min(1).max(120),
  contentHash: hexCommitmentSchema,
  contentType: z.string().trim().min(1).max(120).optional(),
})

export const assignmentSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  workerId: addressSchema,
  receiptCommitment: z.object({
    receiptId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    receiptHash: hexCommitmentSchema,
    createdAt: z.string().datetime(),
  }),
  receipt: z.object({
    receiptId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    taskId: z.string().uuid(),
    bidId: z.string().uuid(),
    workerId: addressSchema,
    status: z.enum(['generated', 'submitted', 'verified', 'rejected']),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    actionLogHash: hexCommitmentSchema,
    artifactHash: hexCommitmentSchema,
    resultHash: hexCommitmentSchema,
    summary: z.string().trim().min(1).max(500),
    artifacts: z.array(receiptArtifactSchema).max(20),
    actionLog: z.array(actionLogEntrySchema).max(100),
    selectiveReveal: boundedJsonRecordSchema('selective_reveal_invalid').optional(),
  }),
  result: boundedJsonRecordSchema('result_invalid'),
  payload: boundedJsonRecordSchema('payload_invalid').optional(),
})
