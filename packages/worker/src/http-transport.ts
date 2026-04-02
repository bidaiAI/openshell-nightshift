import type { PollerTransport } from './poller.js'

export interface FetchTransportOptions {
  baseUrl: string
  headers?: Record<string, string>
}

export class FetchPollerTransport implements PollerTransport {
  constructor(private readonly options: FetchTransportOptions) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(this.resolveUrl(path), {
      method: 'GET',
      ...(this.options.headers ? { headers: this.options.headers } : {}),
    })

    return this.handleResponse<T>(response)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(this.resolveUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.headers ?? {}),
      },
      body: JSON.stringify(body),
    })

    return this.handleResponse<T>(response)
  }

  private resolveUrl(path: string): string {
    const base = this.options.baseUrl.replace(/\/$/, '')
    const suffix = path.startsWith('/') ? path : `/${path}`
    return `${base}${suffix}`
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
      throw new Error(body.error || response.statusText)
    }

    return response.json() as Promise<T>
  }
}
