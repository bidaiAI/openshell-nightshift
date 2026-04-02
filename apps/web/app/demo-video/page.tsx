import SiteShell from "@/components/site-shell"

export const metadata = {
  title: "NightShift Demo Video",
  description: "Watch the 90 second OpenShell NightShift beta walkthrough.",
}

export default function DemoVideoPage() {
  return (
    <SiteShell>
      <div className="surface section" style={{ marginBottom: 20 }}>
        <div className="mono muted" style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Submission asset
        </div>
        <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(36px, 6vw, 62px)", lineHeight: 0.96, letterSpacing: "-0.04em" }}>
          NightShift demo video
        </h1>
        <p className="muted" style={{ maxWidth: 760, fontSize: 16, lineHeight: 1.7, margin: 0 }}>
          This is the public 90-second walkthrough for OpenShell NightShift. It shows the beta flow:
          private task creation, sealed bidding, assignment, receipt delivery, dispute/reveal, and the Compact-style public/private state split.
        </p>
      </div>

      <div className="surface section" style={{ marginBottom: 20 }}>
        <video
          controls
          preload="metadata"
          style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "#000" }}
          src="/nightshift-beta-90s.mp4"
        >
          Your browser does not support embedded video playback.
        </video>
        <div className="row" style={{ marginTop: 16 }}>
          <a className="button primary" href="/nightshift-beta-90s.mp4">
            Open direct MP4
          </a>
          <a className="button" href="https://openshell-nightshift.vercel.app">
            Open live product
          </a>
          <a className="button ghost" href="https://github.com/bidaiAI/openshell-nightshift">
            View public repo
          </a>
        </div>
      </div>
    </SiteShell>
  )
}
