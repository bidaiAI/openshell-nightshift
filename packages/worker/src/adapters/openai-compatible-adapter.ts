import type {
  ModelInvocationSpec,
  ModelProviderDescriptor,
  ModelSelectionPolicy,
} from '@nightshift/common'
import type { ModelAdapter } from '../model-adapters.js'

const DEFAULT_OPENAI_COMPATIBLE_ENDPOINT = 'http://127.0.0.1:1234/v1'

export function createOpenAICompatibleAdapter(descriptor: ModelProviderDescriptor): ModelAdapter {
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
      const endpointBase = (descriptor.endpoint || DEFAULT_OPENAI_COMPATIBLE_ENDPOINT).replace(/\/$/, '')
      const response = await fetch(`${endpointBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: descriptor.model,
          messages: buildMessages(spec, input),
          ...(typeof spec?.temperature === 'number' ? { temperature: spec.temperature } : {}),
          ...(typeof spec?.maxOutputTokens === 'number' ? { max_tokens: spec.maxOutputTokens } : {}),
          ...(spec?.outputFormat === 'json'
            ? { response_format: { type: 'json_object' } }
            : {}),
        }),
      })

      const body = await response.json().catch(() => ({})) as {
        id?: string
        choices?: Array<{
          finish_reason?: string
          message?: {
            role?: string
            content?: string | null
          }
        }>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
      }

      if (!response.ok) {
        throw new Error(`openai_compatible_request_failed:${response.status}`)
      }

      const content = typeof body.choices?.[0]?.message?.content === 'string'
        ? body.choices[0].message.content.trim()
        : ''
      const parsedJson = spec?.outputFormat === 'json' ? tryParseJson(content) : null

      return {
        adapterProvider: descriptor.provider,
        adapterModel: descriptor.model,
        adapterEndpoint: endpointBase,
        adapterCapabilities: descriptor.capabilities,
        operation: spec?.operation ?? 'summarize',
        inputFormat: spec?.inputFormat ?? 'json',
        outputFormat: spec?.outputFormat ?? 'json',
        usedTools: spec?.toolProfile ?? [],
        output: parsedJson ?? content,
        outputText: content,
        finishReason: body.choices?.[0]?.finish_reason ?? null,
        requestId: body.id ?? null,
        metrics: {
          promptTokens: body.usage?.prompt_tokens ?? null,
          completionTokens: body.usage?.completion_tokens ?? null,
          totalTokens: body.usage?.total_tokens ?? null,
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

function buildMessages(spec: ModelInvocationSpec | undefined, input: Record<string, unknown>) {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = []

  if (spec?.systemPrompt) {
    messages.push({
      role: 'system',
      content: spec.systemPrompt,
    })
  }

  const userSections = [
    spec?.operation ? `Operation: ${spec.operation}` : '',
    spec?.inputFormat ? `Input format: ${spec.inputFormat}` : '',
    spec?.outputFormat ? `Output format: ${spec.outputFormat}` : '',
    spec?.toolProfile?.length ? `Allowed tools: ${spec.toolProfile.join(', ')}` : '',
    spec?.outputSchema ? `Output schema:\n${JSON.stringify(spec.outputSchema, null, 2)}` : '',
    `Input:\n${JSON.stringify(input, null, 2)}`,
  ].filter(Boolean)

  messages.push({
    role: 'user',
    content: userSections.join('\n\n'),
  })

  return messages
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
