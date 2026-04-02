import SiteShell from "@/components/site-shell"

const slides = [
  {
    kicker: "Slide 1",
    title: "Why NightShift exists",
    body:
      "Operators can already invoke models and tools, but they still lack a privacy-first workflow for delegating sensitive tasks to another worker without exposing everything or losing delivery guarantees.",
    bullets: [
      "Private task payloads should not be broadcast to everyone.",
      "Workers need a structured way to bid and execute under explicit policy.",
      "Reviewers need verifiable receipts and selective reveal instead of blind trust.",
    ],
  },
  {
    kicker: "Slide 2",
    title: "What the product does today",
    body:
      "OpenShell NightShift is a deployable small-scale beta for private task delegation between operators and workers. It ships as a runnable web + API + worker stack with isolated beta workspaces.",
    bullets: [
      "Create private or selective tasks.",
      "Collect sealed bids from workers.",
      "Assign a worker under an execution policy.",
      "Receive a verifiable receipt, then settle or dispute.",
    ],
  },
  {
    kicker: "Slide 3",
    title: "Midnight-native fit",
    body:
      "The product models the exact privacy boundaries Midnight is good at: public commitments, private task material, sealed bids, and selective reveal. Each seeded task exposes a Compact-style state projection.",
    bullets: [
      "Public/private state separation is visible in the product UI.",
      "Compact-style state projections mirror contract transitions.",
      "Dispute and reveal flow demonstrates selective disclosure semantics.",
    ],
  },
  {
    kicker: "Slide 4",
    title: "Why it is different",
    body:
      "NightShift is not just another agent chat UI. It focuses on the missing coordination layer between a requester and a worker: policy, delivery proof, and dispute handling.",
    bullets: [
      "Receipt-first execution model.",
      "Controlled worker execution rather than uncontrolled broadcast.",
      "Deployable public beta with isolated workspaces, not just a concept demo.",
    ],
  },
]

export const metadata = {
  title: "NightShift Presentation",
  description: "Public presentation deck for the OpenShell NightShift beta.",
}

export default function PresentationPage() {
  return (
    <SiteShell>
      <div className="surface section grid-lines" style={{ marginBottom: 20 }}>
        <div className="mono muted" style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Presentation deck
        </div>
        <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(40px, 8vw, 72px)", lineHeight: 0.95, letterSpacing: "-0.04em" }}>
          OpenShell NightShift
          <br />
          product deck
        </h1>
        <p className="muted" style={{ maxWidth: 760, fontSize: 16, lineHeight: 1.7, margin: 0 }}>
          This public deck summarizes the NightShift beta: private tasks, sealed bids, controlled worker execution,
          verifiable receipts, selective reveal, and the Compact-style state model used for Midnight alignment.
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <a className="button primary" href="https://openshell-nightshift.vercel.app">
            Open live beta
          </a>
          <a className="button" href="https://openshell-nightshift.vercel.app/demo-video">
            Watch demo video
          </a>
          <a className="button ghost" href="https://github.com/bidaiAI/openshell-nightshift">
            Review source
          </a>
        </div>
      </div>

      <div className="stack">
        {slides.map((slide) => (
          <section key={slide.kicker} className="surface section">
            <div className="mono muted" style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {slide.kicker}
            </div>
            <h2 style={{ margin: "10px 0 10px", fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>
              {slide.title}
            </h2>
            <p className="muted" style={{ maxWidth: 860, fontSize: 16, lineHeight: 1.7, margin: 0 }}>
              {slide.body}
            </p>
            <ul style={{ margin: "16px 0 0", paddingLeft: 20, lineHeight: 1.9 }}>
              {slide.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SiteShell>
  )
}
