import type {
  ModelInvocationSpec,
  ModelProviderDescriptor,
  ModelSelectionPolicy,
} from '@nightshift/common'
import type { ModelAdapter } from '../model-adapters.js'

const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434'

export function createOllamaAdapter(descriptor: ModelProviderDescriptor): ModelAdapter {
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
      const endpointBase = (descriptor.endpoint || DEFAULT_OLLAMA_ENDPOINT).replace(/\/$/, '')
      const payload = {
        model: descriptor.model,
        prompt: buildPrompt(spec, input),
        stream: false,
        ...(spec?.outputFormat === 'json' ? { format: 'json' } : {}),
      }

      const response = await fetch(`${endpointBase}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => ({})) as {
        response?: string
        done?: boolean
        total_duration?: number
        load_duration?: number
        prompt_eval_count?: number
        eval_count?: number
      }

      if (!response.ok) {
        throw new Error(`ollama_request_failed:${response.status}`)
      }

      const rawText = typeof body.response === 'string' ? body.response.trim() : ''
      const parsedJson = spec?.outputFormat === 'json' ? tryParseJson(rawText) : null

      return {
        adapterProvider: descriptor.provider,
        adapterModel: descriptor.model,
        adapterEndpoint: endpointBase,
        adapterCapabilities: descriptor.capabilities,
        operation: spec?.operation ?? 'summarize',
        inputFormat: spec?.inputFormat ?? 'json',
        outputFormat: spec?.outputFormat ?? 'json',
        usedTools: spec?.toolProfile ?? [],
        output: parsedJson ?? rawText,
        outputText: rawText,
        done: body.done ?? true,
        metrics: {
          totalDuration: body.total_duration ?? null,
          loadDuration: body.load_duration ?? null,
          promptEvalCount: body.prompt_eval_count ?? null,
          evalCount: body.eval_count ?? null,
        },
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

function buildPrompt(spec: ModelInvocationSpec | undefined, input: Record<string, unknown>): string {
  const sections = [
    spec?.systemPrompt ? `System:\n${spec.systemPrompt}` : '',
    spec?.operation ? `Operation: ${spec.operation}` : '',
    spec?.inputFormat ? `Input format: ${spec.inputFormat}` : '',
    spec?.outputFormat ? `Output format: ${spec.outputFormat}` : '',
    spec?.toolProfile?.length ? `Allowed tools: ${spec.toolProfile.join(', ')}` : '',
    spec?.outputSchema ? `Output schema:\n${JSON.stringify(spec.outputSchema, null, 2)}` : '',
    `Input:\n${JSON.stringify(input, null, 2)}`,
  ].filter(Boolean)

  return sections.join('\n\n')
}

function tryParseJson(value: string): unknown {
  if (!value.trim()) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
