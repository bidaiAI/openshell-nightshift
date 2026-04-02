import type { ModelProviderDescriptor, TransportKind } from '@nightshift/common'

export type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface WorkerConfig {
  workerId: string
  workerName: string
  apiBaseUrl: string
  authToken?: string
  pollIntervalMs: number
  maxConcurrentAssignments: number
  logLevel: WorkerLogLevel
  supportedChains: readonly string[]
  capabilities: readonly string[]
  supportedTransports: readonly TransportKind[]
  modelProviders: readonly ModelProviderDescriptor[]
  walletAddress?: string
}

export interface WorkerConfigError {
  field: string
  message: string
}

const DEFAULT_MODEL_CATALOG: readonly ModelProviderDescriptor[] = [
  {
    provider: 'mock',
    model: 'local-sandbox',
    label: 'Local sandbox adapter',
    capabilities: ['text', 'json', 'tool-calling'],
    local: true,
    pricingTier: 'local',
  },
]

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    workerId: env.WORKER_ID || 'worker-local',
    workerName: env.WORKER_NAME || 'NightShift Worker',
    apiBaseUrl: env.API_BASE_URL || 'http://localhost:4010/v1',
    ...(env.WORKER_AUTH_TOKEN ? { authToken: env.WORKER_AUTH_TOKEN } : {}),
    pollIntervalMs: parsePositiveInt(env.WORKER_POLL_INTERVAL_MS, 15_000),
    maxConcurrentAssignments: parsePositiveInt(env.WORKER_MAX_CONCURRENT_ASSIGNMENTS, 1),
    logLevel: parseLogLevel(env.WORKER_LOG_LEVEL),
    supportedChains: parseList(env.WORKER_SUPPORTED_CHAINS, ['midnight']),
    capabilities: parseList(env.WORKER_CAPABILITIES, ['local-execution', 'receipt-generation', 'model-adapter-routing']),
    supportedTransports: parseTransports(env.WORKER_SUPPORTED_TRANSPORTS),
    modelProviders: parseModelCatalog(env.WORKER_MODEL_CATALOG_JSON),
    ...(env.WORKER_WALLET_ADDRESS ? { walletAddress: env.WORKER_WALLET_ADDRESS } : {}),
  }
}

export function validateWorkerConfig(config: WorkerConfig): WorkerConfigError[] {
  const errors: WorkerConfigError[] = []

  if (!config.workerId.trim()) errors.push({ field: 'workerId', message: 'workerId is required' })
  if (!config.workerName.trim()) errors.push({ field: 'workerName', message: 'workerName is required' })
  if (!config.apiBaseUrl.trim()) errors.push({ field: 'apiBaseUrl', message: 'apiBaseUrl is required' })
  if (config.pollIntervalMs < 1_000) errors.push({ field: 'pollIntervalMs', message: 'pollIntervalMs must be >= 1000' })
  if (config.maxConcurrentAssignments < 1) errors.push({ field: 'maxConcurrentAssignments', message: 'maxConcurrentAssignments must be >= 1' })
  if (config.supportedChains.length === 0) errors.push({ field: 'supportedChains', message: 'supportedChains cannot be empty' })
  if (config.capabilities.length === 0) errors.push({ field: 'capabilities', message: 'capabilities cannot be empty' })
  if (config.supportedTransports.length === 0) errors.push({ field: 'supportedTransports', message: 'supportedTransports cannot be empty' })
  if (config.modelProviders.length === 0) errors.push({ field: 'modelProviders', message: 'modelProviders cannot be empty' })

  return errors
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseLogLevel(value: string | undefined): WorkerLogLevel {
  switch ((value || '').toLowerCase()) {
    case 'debug': return 'debug'
    case 'warn': return 'warn'
    case 'error': return 'error'
    default: return 'info'
  }
}

function parseList(value: string | undefined, fallback: readonly string[]): readonly string[] {
  if (!value) return fallback
  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return items.length > 0 ? items : fallback
}

function parseTransports(value: string | undefined): readonly TransportKind[] {
  const items = parseList(value, ['http-poller'])
  return items.filter(isTransportKind) as readonly TransportKind[]
}

function parseModelCatalog(value: string | undefined): readonly ModelProviderDescriptor[] {
  if (!value) {
    return DEFAULT_MODEL_CATALOG
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return DEFAULT_MODEL_CATALOG
    }

    const catalog = parsed
      .map(parseModelProviderDescriptor)
      .filter((descriptor): descriptor is ModelProviderDescriptor => descriptor !== null)

    return catalog.length > 0 ? catalog : DEFAULT_MODEL_CATALOG
  } catch {
    return DEFAULT_MODEL_CATALOG
  }
}

function parseModelProviderDescriptor(value: unknown): ModelProviderDescriptor | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>

  const provider = typeof record.provider === 'string' ? record.provider.trim() : ''
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  const capabilities = Array.isArray(record.capabilities)
    ? record.capabilities.filter((item): item is ModelProviderDescriptor['capabilities'][number] => typeof item === 'string')
    : []

  if (!provider || !model || capabilities.length === 0) {
    return null
  }

  return {
    provider,
    model,
    capabilities,
    ...(typeof record.label === 'string' && record.label.trim() ? { label: record.label.trim() } : {}),
    ...(typeof record.endpoint === 'string' && record.endpoint.trim() ? { endpoint: record.endpoint.trim() } : {}),
    ...(typeof record.maxInputTokens === 'number' && Number.isFinite(record.maxInputTokens)
      ? { maxInputTokens: record.maxInputTokens }
      : {}),
    ...(typeof record.local === 'boolean' ? { local: record.local } : {}),
    ...(record.pricingTier === 'local' || record.pricingTier === 'bring-your-own-key' || record.pricingTier === 'metered'
      ? { pricingTier: record.pricingTier }
      : {}),
  }
}

function isTransportKind(value: string): value is TransportKind {
  return value === 'http-poller' || value === 'libp2p' || value === 'relay'
}
