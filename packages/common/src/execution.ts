export type TransportKind = 'http-poller' | 'libp2p' | 'relay'
export type ExecutionMode = 'worker-hosted-model' | 'delegated-credential' | 'tool-only'
export type ModelProviderKind = 'openai' | 'anthropic' | 'google' | 'xai' | 'openrouter' | 'ollama' | 'mock' | (string & {})
export type ModelCapability = 'text' | 'vision' | 'tool-calling' | 'json' | 'streaming' | 'long-context'
export type NetworkPolicy = 'disabled' | 'allowlist-only' | 'egress-ok'
export type InvocationOperation = 'summarize' | 'extract' | 'classify' | 'answer' | 'tool-run'
export type InvocationInputFormat = 'text' | 'json' | 'chat'
export type InvocationOutputFormat = 'text' | 'json'

export interface ModelProviderDescriptor {
  provider: ModelProviderKind
  model: string
  label?: string
  endpoint?: string
  capabilities: readonly ModelCapability[]
  maxInputTokens?: number
  local?: boolean
  pricingTier?: 'local' | 'bring-your-own-key' | 'metered'
}

export interface ModelSelectionPolicy {
  providerAllowlist?: readonly ModelProviderKind[]
  modelAllowlist?: readonly string[]
  requiredCapabilities?: readonly ModelCapability[]
  preferredProvider?: ModelProviderKind
  preferredModel?: string
  allowFallback?: boolean
}

export interface ModelInvocationSpec {
  operation: InvocationOperation
  inputFormat: InvocationInputFormat
  outputFormat: InvocationOutputFormat
  outputSchema?: Record<string, unknown>
  systemPrompt?: string
  toolProfile?: readonly string[]
  maxOutputTokens?: number
  temperature?: number
  timeoutMs?: number
}

export interface TaskExecutionRequirements {
  transport: TransportKind
  mode: ExecutionMode
  networkPolicy: NetworkPolicy
  llm?: ModelSelectionPolicy
  toolProfile?: readonly string[]
  invocation?: ModelInvocationSpec
}

export interface WorkerExecutionOffer {
  providers: readonly ModelProviderDescriptor[]
  transports: readonly TransportKind[]
  supportedTools?: readonly string[]
  notes?: string
}

export interface ExecutionCompatibilityResult {
  compatible: boolean
  selectedTransport?: TransportKind
  selectedProvider?: ModelProviderDescriptor
  missingCapabilities: readonly ModelCapability[]
  reason:
    | 'no-requirements'
    | 'missing-worker-offer'
    | 'transport-mismatch'
    | 'provider-mismatch'
    | 'model-mismatch'
    | 'capability-mismatch'
    | 'compatible'
}

export function evaluateWorkerExecutionCompatibility(
  requirements: TaskExecutionRequirements | undefined,
  offer: WorkerExecutionOffer | undefined,
): ExecutionCompatibilityResult {
  if (!requirements) {
    return {
      compatible: true,
      missingCapabilities: [],
      reason: 'no-requirements',
    }
  }

  if (!offer) {
    return {
      compatible: false,
      missingCapabilities: [...(requirements.llm?.requiredCapabilities ?? [])],
      reason: 'missing-worker-offer',
    }
  }

  if (!offer.transports.includes(requirements.transport)) {
    return {
      compatible: false,
      missingCapabilities: [],
      reason: 'transport-mismatch',
    }
  }

  if (!requirements.llm) {
    return {
      compatible: true,
      selectedTransport: requirements.transport,
      missingCapabilities: [],
      reason: 'compatible',
    }
  }

  const providerAllowlist = requirements.llm.providerAllowlist ?? []
  const modelAllowlist = requirements.llm.modelAllowlist ?? []
  const requiredCapabilities = requirements.llm.requiredCapabilities ?? []

  const candidates = offer.providers.filter((provider) => {
    if (providerAllowlist.length > 0 && !providerAllowlist.includes(provider.provider)) {
      return false
    }

    if (modelAllowlist.length > 0 && !modelAllowlist.includes(provider.model)) {
      return false
    }

    return true
  })

  if (candidates.length === 0) {
    const hasProviderMatch = offer.providers.some((provider) =>
      providerAllowlist.length === 0 || providerAllowlist.includes(provider.provider))

    return {
      compatible: false,
      missingCapabilities: [],
      reason: hasProviderMatch ? 'model-mismatch' : 'provider-mismatch',
    }
  }

  const preferred = selectPreferredProvider(candidates, requirements.llm)
  const matchingProvider = preferred ?? candidates.find((provider) =>
    requiredCapabilities.every((capability) => provider.capabilities.includes(capability)))

  if (!matchingProvider) {
    return {
      compatible: false,
      missingCapabilities: requiredCapabilities,
      reason: 'capability-mismatch',
    }
  }

  const missingCapabilities = requiredCapabilities.filter((capability) =>
    !matchingProvider.capabilities.includes(capability))

  if (missingCapabilities.length > 0) {
    return {
      compatible: false,
      missingCapabilities,
      reason: 'capability-mismatch',
    }
  }

  return {
    compatible: true,
    selectedTransport: requirements.transport,
    selectedProvider: matchingProvider,
    missingCapabilities: [],
    reason: 'compatible',
  }
}

function selectPreferredProvider(
  providers: readonly ModelProviderDescriptor[],
  policy: ModelSelectionPolicy,
): ModelProviderDescriptor | undefined {
  if (policy.preferredProvider) {
    const preferredProvider = providers.find((provider) => provider.provider === policy.preferredProvider)
    if (preferredProvider && providerSatisfiesCapabilities(preferredProvider, policy.requiredCapabilities)) {
      return preferredProvider
    }
  }

  if (policy.preferredModel) {
    const preferredModel = providers.find((provider) => provider.model === policy.preferredModel)
    if (preferredModel && providerSatisfiesCapabilities(preferredModel, policy.requiredCapabilities)) {
      return preferredModel
    }
  }

  return undefined
}

function providerSatisfiesCapabilities(
  provider: ModelProviderDescriptor,
  requiredCapabilities: readonly ModelCapability[] | undefined,
): boolean {
  if (!requiredCapabilities?.length) {
    return true
  }

  return requiredCapabilities.every((capability) => provider.capabilities.includes(capability))
}
