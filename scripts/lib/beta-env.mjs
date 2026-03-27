import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export function repoPath(...segments) {
  return path.join(rootDir, ...segments)
}

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const result = {}

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1)

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

export function serializeEnv(entries) {
  return Object.entries(entries)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n') + '\n'
}

export function ensureEnvFile({ filePath, examplePath, defaults = {} }) {
  if (fs.existsSync(filePath)) {
    return { filePath, created: false }
  }

  const source = fs.existsSync(examplePath)
    ? parseEnvFile(examplePath)
    : {}

  const merged = {
    ...source,
    ...defaults,
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, serializeEnv(merged), 'utf8')
  return { filePath, created: true }
}

export function buildBetaEnvFiles() {
  const api = ensureEnvFile({
    filePath: repoPath('apps', 'api', '.env.local'),
    examplePath: repoPath('apps', 'api', '.env.example'),
    defaults: {
      PORT: '4010',
      HOST: '127.0.0.1',
      CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3010,http://localhost:3010',
      BETA_AUTH_REQUIRED: '1',
      BETA_ALLOW_SHARED_TOKEN: '0',
      BETA_ALLOW_ADMIN_ROLE: '0',
    },
  })

  const web = ensureEnvFile({
    filePath: repoPath('apps', 'web', '.env.local'),
    examplePath: repoPath('apps', 'web', '.env.example'),
    defaults: {
      NIGHTSHIFT_API_BASE_URL: 'http://127.0.0.1:4010/v1',
      NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4010/v1',
      BETA_BOOTSTRAP_ENABLED: '1',
      BETA_LOCAL_EMPLOYER_ID: '0xA11cE0000000000000000000000000000000BEEF',
      BETA_LOCAL_EMPLOYER_TOKEN: 'nightshift-employer-beta-token',
      BETA_LOCAL_WORKER_ID: 'worker_proof_runner_3',
      BETA_LOCAL_WORKER_TOKEN: 'nightshift-worker-beta-token',
    },
  })

  const worker = ensureEnvFile({
    filePath: repoPath('packages', 'worker', '.env.local'),
    examplePath: repoPath('packages', 'worker', '.env.example'),
    defaults: {
      API_BASE_URL: 'http://127.0.0.1:4010/v1',
      WORKER_ID: 'worker_proof_runner_3',
      WORKER_AUTH_TOKEN: 'nightshift-worker-beta-token',
      WORKER_POLL_INTERVAL_MS: '5000',
      WORKER_MAX_CONCURRENT_ASSIGNMENTS: '1',
    },
  })

  return { api, web, worker }
}

export function loadBetaEnvSet() {
  const files = buildBetaEnvFiles()

  return {
    files,
    apiEnv: parseEnvFile(files.api.filePath),
    webEnv: parseEnvFile(files.web.filePath),
    workerEnv: parseEnvFile(files.worker.filePath),
  }
}
