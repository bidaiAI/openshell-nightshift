import Link from "next/link"
import WalletButton from "@/components/wallet-button"

const links = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Create task" },
  { href: "/tasks", label: "Task list" },
  { href: "/dashboard", label: "Dashboard" },
]

export default function SiteHeader() {
  return (
    <header className="page-shell">
      <div className="surface section grid-lines" style={{ paddingBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="stack tight" style={{ gap: 6 }}>
            <div className="mono muted" style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              OpenShell NightShift
            </div>
            <div style={{ fontSize: 15, color: "var(--text)" }}>
              Private task marketplace for Midnight.
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <nav className="row tight" aria-label="Primary">
              {links.map(link => (
                <Link key={link.href} href={link.href} className="button ghost" style={{ padding: "10px 12px", fontSize: 13 }}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  )
}

