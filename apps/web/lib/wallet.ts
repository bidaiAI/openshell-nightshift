export type WalletStatus = "disconnected" | "connected"

export interface WalletState {
  status: WalletStatus
  address: string | null
  label: string
}

export interface WalletAdapter {
  connect(): Promise<WalletState>
  disconnect(): Promise<WalletState>
  getState(): WalletState
}

class BetaWalletAdapter implements WalletAdapter {
  private state: WalletState = {
    status: "disconnected",
    address: null,
    label: "Beta wallet",
  }

  async connect(): Promise<WalletState> {
    this.state = {
      status: "connected",
      address: "0xA11cE0000000000000000000000000000000BEEF",
      label: "Beta wallet",
    }
    return this.state
  }

  async disconnect(): Promise<WalletState> {
    this.state = {
      status: "disconnected",
      address: null,
      label: "Beta wallet",
    }
    return this.state
  }

  getState(): WalletState {
    return this.state
  }
}

export const walletAdapter: WalletAdapter = new BetaWalletAdapter()
