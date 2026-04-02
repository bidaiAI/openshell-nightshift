import { spawn } from 'node:child_process'
import net from 'node:net'
import { loadBetaEnvSet, repoPath } from './lib/beta-env.mjs'

const host = '127.0.0.1'

function commandForNode() {
  return process.execPath
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

async function waitForReady(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function runCommand(command, args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoPath(),
      env: {
        ...process.env,
        ...env,
      },
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 1}`))
      }
    })
  })
}

async function main() {
  const { apiEnv } = loadBetaEnvSet()
  const apiPort = await findAvailablePort(4010)
  const apiBaseUrl = `http://${host}:${apiPort}/v1`

  await runCommand(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['build:common'], {})
  await runCommand(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['build:api'], {})

  const apiProcess = spawn(commandForNode(), ['apps/api/dist/index.js'], {
    cwd: repoPath(),
    env: {
      ...process.env,
      ...apiEnv,
      HOST: host,
      PORT: String(apiPort),
      CORS_ALLOWED_ORIGINS: `http://${host}:3010,http://localhost:3010`,
    },
    stdio: 'inherit',
  })

  try {
    await waitForReady(`http://${host}:${apiPort}/health`)
    await runCommand(commandForNode(), ['scripts/smoke-api.mjs'], {
      API_BASE_URL: apiBaseUrl,
    })
  } finally {
    apiProcess.kill('SIGINT')
  }
}

void main()
