import type { ModelProviderDescriptor } from '@nightshift/common'
import type { ModelAdapter } from './model-adapters.js'
import { createMockModelAdapter } from './model-adapters.js'
import { createOllamaAdapter } from './adapters/ollama-adapter.js'

export function createAdapterFromDescriptor(descriptor: ModelProviderDescriptor): ModelAdapter {
  switch (descriptor.provider) {
    case 'ollama':
      return createOllamaAdapter(descriptor)
    case 'mock':
      return createMockModelAdapter(descriptor)
    default:
      return createMockModelAdapter(descriptor)
  }
}
