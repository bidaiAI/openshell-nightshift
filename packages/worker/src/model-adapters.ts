import type {
  ModelInvocationSpec,
  ModelProviderDescriptor,
  ModelSelectionPolicy,
} from '@nightshift/common'
import { createOpenAICompatibleAdapter } from './adapters/openai-compatible-adapter.js'
import { createOllamaAdapter } from './adapters/ollama-adapter.js'

export interface ModelAdapter {
  descriptor: ModelProviderDescriptor
  supports(policy?: ModelSelectionPolicy): boolean
  invoke(spec: ModelInvocationSpec | undefined, input: Record<string, unknown>): Promise<Record<string, unknown>>
  summarize(input: Record<string, unknown>): Promise<Record<string, unknown>>
}

export class ModelAdapterRegistry {
  constructor(private readonly adapters: readonly ModelAdapter[]) {}

  list(): readonly ModelAdapter[] {
    return this.adapters
  }

  select(policy?: ModelSelectionPolicy): ModelAdapter | null {
    const matches = this.adapters.filter((adapter) => adapter.supports(policy))

    if (matches.length === 0) {
      return null
    }

    if (policy?.preferredProvider) {
      const providerMatch = matches.find((adapter) => adapter.descriptor.provider === policy.preferredProvider)
      if (providerMatch) {
        return providerMatch
      }
    }

    if (policy?.preferredModel) {
      const modelMatch = matches.find((adapter) => adapter.descriptor.model === policy.preferredModel)
      if (modelMatch) {
        return modelMatch
      }
    }

    return matches[0] ?? null
  }
}

export function createMockModelAdapter(
  descriptor: ModelProviderDescriptor = {
    provider: 'mock',
    model: 'local-sandbox',
    label: 'Local sandbox adapter',
    capabilities: ['text', 'json', 'tool-calling'],
    local: true,
    pricingTier: 'local',
  },
): ModelAdapter {
  return {
    descriptor,
    supports(policy?: ModelSelectionPolicy): boolean {
      if (policy?.providerAllowlist?.length && !policy.providerAllowlist.includes(descriptor.provider)) {
        return false
      }

      if (policy?.modelAllowlist?.length && !policy.modelAllowlist.includes(descriptor.model)) {
        return false
      }

      if (policy?.requiredCapabilities?.length) {
        for (const capability of policy.requiredCapabilities) {
          if (!descriptor.capabilities.includes(capability)) {
            return false
          }
        }
      }

      return true
    },
    async invoke(spec: ModelInvocationSpec | undefined, input: Record<string, unknown>): Promise<Record<string, unknown>> {
      return {
        adapterProvider: descriptor.provider,
        adapterModel: descriptor.model,
        adapterEndpoint: descriptor.endpoint ?? null,
        adapterCapabilities: descriptor.capabilities,
        operation: spec?.operation ?? 'summarize',
        inputFormat: spec?.inputFormat ?? 'json',
        outputFormat: spec?.outputFormat ?? 'json',
        usedTools: spec?.toolProfile ?? [],
        receivedKeys: Object.keys(input).sort(),
      }
    },
    async summarize(input: Record<string, unknown>): Promise<Record<string, unknown>> {
      return this.invoke({
        operation: 'summarize',
        inputFormat: 'json',
        outputFormat: 'json',
      }, input)
    },
  }
}

export function createModelAdapterRegistry(descriptors: readonly ModelProviderDescriptor[]): ModelAdapterRegistry {
  const adapters = descriptors.map((descriptor) => {
    if (descriptor.provider === 'ollama') {
      return createOllamaAdapter(descriptor)
    }

    if (
      descriptor.provider === 'openai-compatible'
      || (descriptor.local === true && typeof descriptor.endpoint === 'string' && descriptor.endpoint.trim())
    ) {
      return createOpenAICompatibleAdapter(descriptor)
    }

    return createMockModelAdapter(descriptor)
  })
  return new ModelAdapterRegistry(adapters)
}
