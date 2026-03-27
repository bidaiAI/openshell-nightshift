import type { DataSource } from "@/lib/api"

export default function DataSourcePill({ source }: { source: DataSource }) {
  const isLive = source === "api"

  return <span className={`badge ${isLive ? "private" : "warn"}`}>{isLive ? "Live API" : "Local fallback"}</span>
}
