import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { buildBetaAuthConfig, parseAuthenticatedActor, routeRequiresActorAuth, type AuthenticatedActor, type BetaAuthConfig } from './auth.js'
import { createWorkspaceStore, DEFAULT_WORKSPACE_ID, InMemoryNightShiftStore, NightShiftStoreError, normalizeWorkspaceId, type WorkspaceNightShiftStore } from './store.js'
import { assignmentRoutes } from './routes/assignments.js'
import { disputeRoutes } from './routes/disputes.js'
import { healthRoutes } from './routes/health.js'
import { taskRoutes } from './routes/tasks.js'

declare module 'fastify' {
  interface FastifyInstance {
    authConfig: BetaAuthConfig
    workspaceStore: WorkspaceNightShiftStore
  }

  interface FastifyRequest {
    actor: AuthenticatedActor | null
    workspaceId: string
    store: InMemoryNightShiftStore
  }
}

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
])

const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/.+-bidai-ai-projects\.vercel\.app$/i,
  /^https:\/\/.+\.vercel\.app$/i,
]

const RATE_LIMIT_WINDOW_MS = 60_000
const REQUEST_STORE_KEY = Symbol('nightshift.requestStore')

type RateLimitBucket = {
  name: string
  limit: number
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

function buildAllowedOrigins(envValue: string | undefined): Set<string> {
  if (!envValue) {
    return DEFAULT_ALLOWED_ORIGINS
  }

  const values = envValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return new Set(values.length > 0 ? values : [...DEFAULT_ALLOWED_ORIGINS])
}

function buildAllowedOriginPatterns(envValue: string | undefined): RegExp[] {
  const patterns = envValue
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      try {
        return [new RegExp(item, 'i')]
      } catch {
        return []
      }
    }) ?? []

  return patterns.length > 0 ? patterns : [...DEFAULT_ALLOWED_ORIGIN_PATTERNS]
}

export const buildServer = () => {
  const app = Fastify({
    logger: true,
    bodyLimit: 256 * 1024,
  })
  const allowedOrigins = buildAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)
  const allowedOriginPatterns = buildAllowedOriginPatterns(process.env.CORS_ALLOWED_ORIGIN_PATTERNS)
  const rateLimitState = new Map<string, RateLimitEntry>()
  const workspaceStore = createWorkspaceStore()

  app.decorate('authConfig', buildBetaAuthConfig())
  app.decorate('workspaceStore', workspaceStore)
  app.decorateRequest('actor', null)
  app.decorateRequest('workspaceId', DEFAULT_WORKSPACE_ID)
  app.decorateRequest('store', {
    getter(this: FastifyRequest) {
      return (this as FastifyRequest & { [REQUEST_STORE_KEY]?: InMemoryNightShiftStore })[REQUEST_STORE_KEY] ?? workspaceStore.getWorkspace(DEFAULT_WORKSPACE_ID)
    },
    setter(this: FastifyRequest, value: InMemoryNightShiftStore) {
      ;(this as FastifyRequest & { [REQUEST_STORE_KEY]?: InMemoryNightShiftStore })[REQUEST_STORE_KEY] = value
    },
  })

  void app.register(cors, {
    origin(origin, callback) {
      if (
        !origin
        || allowedOrigins.has(origin)
        || allowedOriginPatterns.some((pattern) => pattern.test(origin))
      ) {
        callback(null, true)
        return
      }

      callback(new Error('origin_not_allowed'), false)
    },
    allowedHeaders: [
      'Accept',
      'Content-Type',
      'Authorization',
      'X-NightShift-Actor-Id',
      'X-NightShift-Actor-Role',
      'X-NightShift-Workspace-Id',
    ],
  })

  app.addHook('onRequest', (request, reply, done) => {
    const bucket = resolveRateLimitBucket(request.method, request.url)
    if (!bucket) {
      done()
      return
    }

    const key = `${bucket.name}:${request.ip}`
    const currentTime = Date.now()
    const existing = rateLimitState.get(key)

    if (!existing || existing.resetAt <= currentTime) {
      const nextEntry: RateLimitEntry = {
        count: 1,
        resetAt: currentTime + RATE_LIMIT_WINDOW_MS,
      }
      rateLimitState.set(key, nextEntry)
      reply.header('x-ratelimit-limit', String(bucket.limit))
      reply.header('x-ratelimit-remaining', String(bucket.limit - nextEntry.count))
      done()
      return
    }

    if (existing.count >= bucket.limit) {
      reply.header('x-ratelimit-limit', String(bucket.limit))
      reply.header('x-ratelimit-remaining', '0')
      reply.header('retry-after', String(Math.ceil((existing.resetAt - currentTime) / 1000)))
      reply.code(429).send({ error: 'rate_limited' })
      return
    }

    existing.count += 1
    rateLimitState.set(key, existing)
    reply.header('x-ratelimit-limit', String(bucket.limit))
    reply.header('x-ratelimit-remaining', String(bucket.limit - existing.count))
    done()
  })

  app.addHook('onRequest', async (request, reply) => {
    request.workspaceId = normalizeWorkspaceId(readHeaderValue(request.headers['x-nightshift-workspace-id']))
    request.store = app.workspaceStore.getWorkspace(request.workspaceId)

    const actor = parseAuthenticatedActor(request, app.authConfig)
    request.actor = actor

    if (routeRequiresActorAuth(request.method, request.url) && app.authConfig.required && !actor) {
      reply.code(401)
      return reply.send({ error: 'auth_required' })
    }
  })

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request_failed')

    if (error instanceof ZodError) {
      reply.code(400)
      return {
        error: 'validation_error',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }
    }

    if (error instanceof NightShiftStoreError) {
      const statusCode = (
        error.code === 'duplicate_receipt'
        || error.code === 'dispute_already_open'
        || error.code === 'assignment_under_dispute'
      ) ? 409 : 400
      reply.code(statusCode)
      return { error: error.code }
    }

    reply.code(500)
    return { error: 'internal_error' }
  })

  void app.register(healthRoutes)
  void app.register(taskRoutes, { prefix: '/v1' })
  void app.register(assignmentRoutes, { prefix: '/v1' })
  void app.register(disputeRoutes, { prefix: '/v1' })

  return app
}

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value.find((item) => typeof item === 'string' && item.trim())?.trim()
  }

  return undefined
}

function resolveRateLimitBucket(method: string, url: string): RateLimitBucket | null {
  if (url.startsWith('/health')) {
    return null
  }

  if (method === 'GET' && url.startsWith('/v1/assignments/poll')) {
    return { name: 'worker-poll', limit: 120 }
  }

  if (method === 'POST' && url.includes('/submit')) {
    return { name: 'worker-submit', limit: 40 }
  }

  if (method === 'POST') {
    return { name: 'mutations', limit: 60 }
  }

  return { name: 'reads', limit: 240 }
}
