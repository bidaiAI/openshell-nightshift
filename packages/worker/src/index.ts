export * from './config.js'
export * from './poller.js'
export * from './executor.js'
export * from './receipt.js'
export * from './http-transport.js'
export * from './runtime.js'
export * from './model-adapters.js'
export * from './provider-factory.js'
export * from './adapters/ollama-adapter.js'

import { createExecutorFromConfig } from './executor.js'
import { loadWorkerConfig, validateWorkerConfig } from './config.js'
import { FetchPollerTransport } from './http-transport.js'
import { HttpAssignmentPollClient } from './poller.js'
import { runWorkerLoop, runWorkerOnce } from './runtime.js'
import { pathToFileURL } from 'node:url'

export async function bootstrapWorker(): Promise<{ ok: boolean; issues: string[] }> {
  const config = loadWorkerConfig()
  const issues = validateWorkerConfig(config).map(issue => `${issue.field}: ${issue.message}`)
  if (issues.length > 0) {
    return { ok: false, issues }
  }

  void config
  void HttpAssignmentPollClient
  void FetchPollerTransport
  void createExecutorFromConfig

  return { ok: true, issues: [] }
}

async function main(): Promise<void> {
  const bootstrap = await bootstrapWorker()

  if (!bootstrap.ok) {
    console.error('Worker bootstrap failed')
    for (const issue of bootstrap.issues) {
      console.error('-', issue)
    }
    process.exitCode = 1
    return
  }

  if (process.env.WORKER_AUTO_RUN === '1') {
    const summary = await runWorkerOnce()
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  if (process.env.WORKER_LOOP === '1') {
    const config = loadWorkerConfig()
    const parsedIterations = Number.parseInt(process.env.WORKER_LOOP_ITERATIONS ?? '', 10)

    if (Number.isFinite(parsedIterations) && parsedIterations > 0) {
      const summaries = await runWorkerLoop({ iterations: parsedIterations, config })
      console.log(JSON.stringify(summaries, null, 2))
      return
    }

    console.log('NightShift worker loop started. Press Ctrl+C to stop.')

    while (true) {
      try {
        const [summary] = await runWorkerLoop({ iterations: 1, config })
        console.log(JSON.stringify(summary, null, 2))
      } catch (error) {
        console.error('Worker loop iteration failed')
        console.error(error)
      }

      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs))
    }
  }

  console.log('NightShift worker bootstrapped. Set WORKER_AUTO_RUN=1 to execute one poll/submit cycle.')
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  void main()
}
