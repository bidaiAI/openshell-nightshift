import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import type { ApiActorRole } from "@/lib/api"
import { BETA_SESSION_COOKIE_ACTOR_ID, BETA_SESSION_COOKIE_ROLE, BETA_SESSION_COOKIE_TOKEN, BETA_SESSION_COOKIE_WORKSPACE_ID } from "@/lib/api"

type BetaActorPreset = {
  actorId: string
  role: Extract<ApiActorRole, "employer" | "worker">
  token: string
}

function readPreset(role: string | undefined): BetaActorPreset | null {
  if (process.env.BETA_BOOTSTRAP_ENABLED === "0") {
    return null
  }

  if (role === "employer") {
    const actorId = process.env.BETA_LOCAL_EMPLOYER_ID?.trim() || "0xA11cE0000000000000000000000000000000BEEF"
    const token = process.env.BETA_LOCAL_EMPLOYER_TOKEN?.trim() || "nightshift-employer-beta-token"
    return actorId && token ? { actorId, role: "employer", token } : null
  }

  if (role === "worker") {
    const actorId = process.env.BETA_LOCAL_WORKER_ID?.trim() || "worker_proof_runner_3"
    const token = process.env.BETA_LOCAL_WORKER_TOKEN?.trim() || "nightshift-worker-beta-token"
    return actorId && token ? { actorId, role: "worker", token } : null
  }

  return null
}

function isActorRole(value: string | undefined): value is ApiActorRole {
  return value === "employer" || value === "worker" || value === "admin"
}

function buildCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 12,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  }
}

function createWorkspaceId() {
  return `ws_${randomUUID().replace(/-/g, "").slice(0, 18)}`
}

function normalizeWorkspaceId(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase()
  if (trimmed && /^[a-z0-9][a-z0-9_-]{5,63}$/u.test(trimmed)) {
    return trimmed
  }
  return createWorkspaceId()
}

function clearSessionCookies(response: NextResponse) {
  const cookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  }

  response.cookies.set(BETA_SESSION_COOKIE_ACTOR_ID, "", cookieOptions)
  response.cookies.set(BETA_SESSION_COOKIE_ROLE, "", cookieOptions)
  response.cookies.set(BETA_SESSION_COOKIE_TOKEN, "", cookieOptions)
  response.cookies.set(BETA_SESSION_COOKIE_WORKSPACE_ID, "", cookieOptions)
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const body = await request.json().catch(() => null) as { role?: string; actorId?: string; token?: string } | null
  const actorId = body?.actorId?.trim()
  const token = body?.token?.trim()
  const role = body?.role?.trim()
  const workspaceId = normalizeWorkspaceId(cookieStore.get(BETA_SESSION_COOKIE_WORKSPACE_ID)?.value)
  const preset = (!actorId || !token || !isActorRole(role))
    ? readPreset(role)
    : { actorId, role, token }

  if (!preset) {
    return NextResponse.json({ error: "beta_access_unavailable" }, { status: 404 })
  }

  const response = NextResponse.json({
    ok: true,
    actorId: preset.actorId,
    role: preset.role,
    workspaceId,
  })

  const cookieOptions = buildCookieOptions()

  response.cookies.set(BETA_SESSION_COOKIE_ACTOR_ID, preset.actorId, cookieOptions)
  response.cookies.set(BETA_SESSION_COOKIE_ROLE, preset.role, cookieOptions)
  response.cookies.set(BETA_SESSION_COOKIE_TOKEN, preset.token, cookieOptions)
  response.cookies.set(BETA_SESSION_COOKIE_WORKSPACE_ID, workspaceId, cookieOptions)

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  clearSessionCookies(response)
  return response
}
