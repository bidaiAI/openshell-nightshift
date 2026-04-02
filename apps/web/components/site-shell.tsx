import type { ReactNode } from "react"
import SiteHeader from "./site-header"

export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="page-shell" style={{ paddingTop: 0, paddingBottom: 40 }}>
        {children}
      </main>
    </>
  )
}

