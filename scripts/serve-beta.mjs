import { spawn } from 'node:child_process'
import readline from 'node:readline'

const host = process.env.HOST?.trim() || '0.0.0.0'
const publicPort = Number.parseInt(process.env.PORT ?? '4010', 10)
const workerApiBaseUrl = `http://127.0.0.1:${publicPort}/v1`

function prefixStream(stream, label) {
  const rl = readline.createInterface({ input: stream })
  rl.on('line', (line) => {
    console.log(`[${label}] ${line}`)
  })
  return rl
}

function spawnProcess(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  prefixStream(child.stdout, label)
  prefixStream(child.stderr, `${label}:err`)

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.log(`[${label}] exited (${reason})`)
  })

  return child
}

async function main() {
  const children = []
  let stopping = false

  const stopAll = () => {
    if (stopping) {
      return
    }

    stopping = true
    for (const child of children) {
      child.kill('SIGTERM')
    }
  }

  process.on('SIGINT', stopAll)
  process.on('SIGTERM', stopAll)

  const api = spawnProcess('api', 'node', ['apps/api/dist/index.js'], {
    HOST: host,
    PORT: String(publicPort),
  })
  children.push(api)

  const worker = spawnProcess('worker', 'node', ['packages/worker/dist/index.js'], {
    API_BASE_URL: process.env.API_BASE_URL?.trim() || workerApiBaseUrl,
    WORKER_LOOP: process.env.WORKER_LOOP?.trim() || '1',
    WORKER_AUTO_RUN: '0',
    WORKER_POLL_INTERVAL_MS: process.env.WORKER_POLL_INTERVAL_MS?.trim() || '10000',
  })
  children.push(worker)

  await Promise.race(children.map((child) => new Promise((resolve) => child.on('exit', resolve))))
  stopAll()
}

void main()
