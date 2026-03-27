export function formatMoney(amount: number, currency = "USDC") {
  return `${amount.toFixed(2)} ${currency}`
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function shortHash(hash: string, size = 8) {
  return `${hash.slice(0, size)}…${hash.slice(-size)}`
}

