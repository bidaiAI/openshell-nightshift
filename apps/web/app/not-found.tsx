import Link from "next/link"
import SiteShell from "@/components/site-shell"

export default function NotFound() {
  return (
    <SiteShell>
      <div className="surface section" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 54, marginBottom: 12 }}>404</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>This task is not on the queue.</div>
        <p className="muted" style={{ maxWidth: 500, margin: "12px auto 0", lineHeight: 1.6 }}>
          The route exists, but the current mock data does not include this identifier yet.
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          <Link href="/" className="button primary">Home</Link>
          <Link href="/tasks" className="button">Task list</Link>
        </div>
      </div>
    </SiteShell>
  )
}

