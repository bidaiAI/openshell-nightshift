import WalletButton from "./wallet-button"

export default function WalletAdapterPlaceholder() {
  return (
    <div className="surface section">
      <div className="mono muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        Wallet adapter
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 10 }}>Integration boundary for Midnight wallets.</div>
      <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        This shell uses a mock adapter today. The real adapter can be swapped in later without changing page structure.
      </p>
      <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
        <span className="badge private">Midnight beta</span>
        <span className="badge">No chain lock-in</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <WalletButton />
      </div>
    </div>
  )
}
