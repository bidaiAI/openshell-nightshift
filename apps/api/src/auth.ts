import type { FastifyReply, FastifyRequest } from 'fastify'

export type ActorRole = 'employer' | 'worker' | 'admin'

export interface BetaActorCredential {
  actorId: string
  role: ActorRole
  token: string
}

export interface BetaAuthConfig {
  required: boolean
  sharedToken: string
  allowSharedToken: boolean
  allowAdminRole: boolean
  actorCredentialsByToken: ReadonlyMap<string, BetaActorCredential>
}

export interface AuthenticatedActor {
  actorId: string
  role: ActorRole
  token: string
}

const DEFAULT_BETA_ACTOR_CREDENTIALS: BetaActorCredential[] = [
  {
    actorId: '0xA11cE0000000000000000000000000000000BEEF',
    role: 'employer',
    token: 'nightshift-employer-beta-token',
  },
  {
    actorId: 'worker_proof_runner_3',
    role: 'worker',
    token: 'nightshift-worker-beta-token',
  },
]

export function buildBetaAuthConfig(env: NodeJS.ProcessEnv = process.env): BetaAuthConfig {
  const actorCredentials = buildCredentialIndex(env.BETA_ACTOR_CREDENTIALS)
  return {
    required: env.BETA_AUTH_REQUIRED !== '0',
    sharedToken: env.BETA_AUTH_TOKEN?.trim() || 'nightshift-local-beta-token',
    allowSharedToken: env.BETA_ALLOW_SHARED_TOKEN === '1',
    allowAdminRole: env.BETA_ALLOW_ADMIN_ROLE === '1',
    actorCredentialsByToken: actorCredentials.size > 0
      ? actorCredentials
      : new Map(DEFAULT_BETA_ACTOR_CREDENTIALS.map((entry) => [entry.token, entry] as const)),
  }
}

export function routeRequiresActorAuth(method: string, url: string): boolean {
  if (url.startsWith('/health')) {
    return false
  }

  if (method === 'GET' && (url.startsWith('/v1/tasks') || url.startsWith('/v1/summary'))) {
    return false
  }

  return method === 'POST' || (method === 'GET' && url.startsWith('/v1/assignments/poll'))
}

export function parseAuthenticatedActor(request: FastifyRequest, config: BetaAuthConfig): AuthenticatedActor | null {
  const authorization = request.headers.authorization
  const token = readBearerToken(authorization)
  const actorIdHeader = readHeaderValue(request.headers['x-nightshift-actor-id'])
  const roleHeader = readActorRole(request.headers['x-nightshift-actor-role'])

  if (!token) {
    return null
  }

  const boundCredential = config.actorCredentialsByToken.get(token)
  if (boundCredential) {
    if (actorIdHeader && actorIdHeader !== boundCredential.actorId) {
      return null
    }

    if (roleHeader && roleHeader !== boundCredential.role) {
      return null
    }

    if (boundCredential.role === 'admin' && !config.allowAdminRole) {
      return null
    }

    return {
      actorId: boundCredential.actorId,
      role: boundCredential.role,
      token,
    }
  }

  if (!config.allowSharedToken || token !== config.sharedToken || !actorIdHeader || !roleHeader) {
    return null
  }

  if (roleHeader === 'admin' && !config.allowAdminRole) {
    return null
  }

  return { actorId: actorIdHeader, role: roleHeader, token }
}

export function requireAuthenticatedActor(
  request: FastifyRequest,
  reply: FastifyReply,
  expectedRole?: ActorRole,
): AuthenticatedActor | null {
  const actor = request.actor

  if (!actor) {
    if (!request.server.authConfig.required) {
      return {
        actorId: 'beta-auth-disabled',
        role: 'admin',
        token: 'beta-auth-disabled',
      }
    }

    reply.code(401)
    void reply.send({ error: 'auth_required' })
    return null
  }

  if (expectedRole && actor.role !== expectedRole && actor.role !== 'admin') {
    reply.code(403)
    void reply.send({ error: 'actor_role_mismatch' })
    return null
  }

  return actor
}

export function requireActorMatch(
  reply: FastifyReply,
  actor: AuthenticatedActor,
  expectedActorId: string,
  errorCode = 'actor_identity_mismatch',
): boolean {
  if (actor.role === 'admin') {
    return true
  }

  if (actor.actorId !== expectedActorId) {
    reply.code(403)
    void reply.send({ error: errorCode })
    return false
  }

  return true
}

function readBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim())
    return first?.trim() || null
  }

  return null
}

function readActorRole(value: string | string[] | undefined): ActorRole | null {
  const raw = readHeaderValue(value)

  if (raw === 'employer' || raw === 'worker' || raw === 'admin') {
    return raw
  }

  return null
}

function buildCredentialIndex(raw: string | undefined): ReadonlyMap<string, BetaActorCredential> {
  const entries = parseCredentialList(raw)
  return new Map(entries.map((entry) => [entry.token, entry] as const))
}

function parseCredentialList(raw: string | undefined): BetaActorCredential[] {
  if (!raw?.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return []
      }

      const actorId = typeof entry.actorId === 'string' ? entry.actorId.trim() : ''
      const token = typeof entry.token === 'string' ? entry.token.trim() : ''
      const role = normalizeActorRole(entry.role)

      if (!actorId || !token || !role) {
        return []
      }

      return [{ actorId, role, token }]
    })
  } catch {
    return []
  }
}

function normalizeActorRole(value: unknown): ActorRole | null {
  return value === 'employer' || value === 'worker' || value === 'admin' ? value : null
}
