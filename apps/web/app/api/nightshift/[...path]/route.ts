import { NextResponse } from "next/server"
import { BETA_WORKSPACE_HEADER } from "@/lib/api"
import { readServerBetaAuthContext, readServerWorkspaceId } from "@/lib/server-auth"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

function getServerApiBaseUrl(): string {
  return process.env.NIGHTSHIFT_API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || (process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
      ? "https://backend-preview-production.up.railway.app/v1"
      : "http://localhost:4010/v1")
}

function buildUpstreamUrl(request: Request, path: string[]): string {
  const base = getServerApiBaseUrl().replace(/\/+$/u, "")
  const normalizedPath = base.endsWith("/v1") && path[0] === "v1"
    ? path.slice(1)
    : path
  const suffix = normalizedPath.length ? `/${normalizedPath.map((segment) => encodeURIComponent(segment)).join("/")}` : ""
  const url = new URL(request.url)
  return `${base}${suffix}${url.search}`
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers()

  source.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return
    }
    headers.set(key, value)
  })

  return headers
}

async function proxy(request: Request, path: string[]): Promise<NextResponse> {
  const auth = await readServerBetaAuthContext()
  const workspaceId = await readServerWorkspaceId()
  const upstreamHeaders = new Headers()
  const requestHeaders = request.headers

  const contentType = requestHeaders.get("content-type")
  const accept = requestHeaders.get("accept")
  const explicitAuthorization = requestHeaders.get("authorization")
  const explicitActorId = requestHeaders.get("x-nightshift-actor-id")
  const explicitActorRole = requestHeaders.get("x-nightshift-actor-role")
  const explicitWorkspaceId = requestHeaders.get(BETA_WORKSPACE_HEADER)

  if (contentType) {
    upstreamHeaders.set("content-type", contentType)
  }

  if (accept) {
    upstreamHeaders.set("accept", accept)
  }

  if (explicitAuthorization) {
    upstreamHeaders.set("authorization", explicitAuthorization)
  } else if (auth?.token) {
    upstreamHeaders.set("authorization", `Bearer ${auth.token}`)
  }

  if (explicitActorId) {
    upstreamHeaders.set("x-nightshift-actor-id", explicitActorId)
  } else if (auth?.actorId) {
    upstreamHeaders.set("x-nightshift-actor-id", auth.actorId)
  }

  if (explicitActorRole) {
    upstreamHeaders.set("x-nightshift-actor-role", explicitActorRole)
  } else if (auth?.role) {
    upstreamHeaders.set("x-nightshift-actor-role", auth.role)
  }

  if (explicitWorkspaceId) {
    upstreamHeaders.set(BETA_WORKSPACE_HEADER, explicitWorkspaceId)
  } else if (workspaceId) {
    upstreamHeaders.set(BETA_WORKSPACE_HEADER, workspaceId)
  }

  const init: RequestInit = {
    method: request.method,
    headers: upstreamHeaders,
    cache: "no-store",
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text()
  }

  const response = await fetch(buildUpstreamUrl(request, path), init)
  return new NextResponse(response.body, {
    status: response.status,
    headers: copyResponseHeaders(response.headers),
  })
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxy(request, path)
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxy(request, path)
}
