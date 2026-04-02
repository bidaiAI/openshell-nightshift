import { spawn } from 'node:child_process'
import net from 'node:net'
import readline from 'node:readline'
import { loadBetaEnvSet, repoPath } from './lib/beta-env.mjs'

const host = '127.0.0.1'
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function assertNodeVersion() {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
  if (!Number.isFinite(major) || major < 20) {
    console.error(`OpenShell NightShift beta requires Node 20+. Current: ${process.version}`)
    process.exit(1)
  }
}

async function findAvailablePort(preferredPort) {
  let port = preferredPort

  while (port < preferredPort + 200) {
    // eslint-disable-next-line no-await-in-loop
    const available = await new Promise((resolve) => {
      const server = net.createServer()
      server.unref()
      server.on('error', () => resolve(false))
      server.listen({ port, host }, () => {
        server.close(() => resolve(true))
      })
    })

    if (available) {
      return port
    }

    port += 1
  }

  const ephemeralPort = await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen({ port: 0, host }, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate an ephemeral port')))
        return
      }
      const { port: allocatedPort } = address
      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
        } else {
          resolve(allocatedPort)
        }
      })
    })
  })

  return ephemeralPort
}

function prefixStream(stream, label) {
  const rl = readline.createInterface({ input: stream })
  rl.on('line', (line) => {
    console.log(`[${label}] ${line}`)
  })
  return rl
}

function spawnProcess(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: repoPath(),
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const output = [prefixStream(child.stdout, label), prefixStream(child.stderr, `${label}:err`)]

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.log(`[${label}] exited (${reason})`)
  })

  return { child, output }
}

async function waitForReady(url, label, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        console.log(`[ready] ${label} -> ${url}`)
        return
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`)
}

async function runPrebuild() {
  await new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, ['build:common'], {
      cwd: repoPath(),
      env: process.env,
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`pnpm build:common failed with exit code ${code ?? 1}`))
      }
    })
  })
}

async function main() {
  assertNodeVersion()

  const { apiEnv, webEnv, workerEnv, files } = loadBetaEnvSet()
  const apiPort = await findAvailablePort(4010)
  const webPort = await findAvailablePort(3010)
  const apiBaseUrl = `http://${host}:${apiPort}/v1`
  const webUrl = `http://${host}:${webPort}`

  console.log('Using beta env files:')
  console.log(`- api: ${files.api.filePath}`)
  console.log(`- web: ${files.web.filePath}`)
  console.log(`- worker: ${files.worker.filePath}`)
  console.log(`- api url: ${apiBaseUrl}`)
  console.log(`- web url: ${webUrl}`)

  await runPrebuild()

  const processes = []
  let stopping = false

  const stopAll = () => {
    if (stopping) return
    stopping = true
    for (const processInfo of processes) {
      processInfo.child.kill('SIGINT')
    }
  }

  process.on('SIGINT', stopAll)
  process.on('SIGTERM', stopAll)

  const apiProcess = spawnProcess('api', pnpmCmd, ['--filter', '@nightshift/api', 'dev'], {
    ...apiEnv,
    HOST: host,
    PORT: String(apiPort),
    CORS_ALLOWED_ORIGINS: `${webUrl},http://localhost:${webPort}`,
  })
  processes.push(apiProcess)

  try {
    await waitForReady(`http://${host}:${apiPort}/health`, 'api')

    const webProcess = spawnProcess('web', pnpmCmd, ['--filter', '@nightshift/web', 'exec', 'next', 'dev', '--port', String(webPort), '--hostname', host], {
      ...webEnv,
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    })
    processes.push(webProcess)

    const workerProcess = spawnProcess('worker', pnpmCmd, ['--filter', '@nightshift/worker', 'dev'], {
      ...workerEnv,
      API_BASE_URL: apiBaseUrl,
      WORKER_LOOP: '1',
      WORKER_AUTO_RUN: '0',
    })
    processes.push(workerProcess)

    await waitForReady(webUrl, 'web')

    console.log('\nOpenShell NightShift beta is running.')
    console.log(`- Web: ${webUrl}`)
    console.log(`- API: ${apiBaseUrl}`)
    console.log('- In the UI, use “Start employer access session” or “Start worker access session”.')
    console.log('- Press Ctrl+C to stop all processes.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Beta startup failed')
    stopAll()
    process.exitCode = 1
    return
  }

  await Promise.race(
    processes.map(({ child }) => new Promise((resolve) => child.on('exit', resolve))),
  )

  stopAll()
}

void main()
