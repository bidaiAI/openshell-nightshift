import { cookies } from "next/headers"
import type { ApiAuthContext, ApiActorRole } from "@/lib/api"
import { BETA_SESSION_COOKIE_ACTOR_ID, BETA_SESSION_COOKIE_ROLE, BETA_SESSION_COOKIE_TOKEN, BETA_SESSION_COOKIE_WORKSPACE_ID } from "@/lib/api"

function isActorRole(value: string | undefined): value is ApiActorRole {
  return value === "employer" || value === "worker" || value === "admin"
}

export async function readServerBetaAuthContext(): Promise<ApiAuthContext | null> {
  const cookieStore = await cookies()
  const actorId = cookieStore.get(BETA_SESSION_COOKIE_ACTOR_ID)?.value?.trim()
  const role = cookieStore.get(BETA_SESSION_COOKIE_ROLE)?.value?.trim()
  const token = cookieStore.get(BETA_SESSION_COOKIE_TOKEN)?.value?.trim()
  const workspaceId = cookieStore.get(BETA_SESSION_COOKIE_WORKSPACE_ID)?.value?.trim()

  if (!actorId || !token || !isActorRole(role)) {
    return null
  }

  return {
    actorId,
    role,
    token,
    ...(workspaceId ? { workspaceId } : {}),
  }
}

export async function readServerWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(BETA_SESSION_COOKIE_WORKSPACE_ID)?.value?.trim() || null
}
