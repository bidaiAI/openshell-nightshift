"use client"

import { useEffect, useState } from "react"
import { walletAdapter, type WalletState } from "@/lib/wallet"

const STORAGE_KEY = "nightshift-wallet-state"

export default function WalletButton() {
  const [state, setState] = useState<WalletState>(walletAdapter.getState())

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setState(JSON.parse(raw) as WalletState)
      }
    } catch {
      // ignore storage issues in the scaffold
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage issues in the scaffold
    }
  }, [state])

  async function handleClick() {
    const next = state.status === "connected"
      ? await walletAdapter.disconnect()
      : await walletAdapter.connect()
    setState(next)
  }

  return (
    <button className="button primary" type="button" onClick={handleClick}>
      <span className="mono" style={{ fontSize: 12 }}>
        {state.status === "connected" ? "Connected" : "Connect"}
      </span>
      <span style={{ fontSize: 13 }}>
        {state.address ? state.address.slice(0, 6) + "…" + state.address.slice(-4) : "Beta wallet"}
      </span>
    </button>
  )
}
