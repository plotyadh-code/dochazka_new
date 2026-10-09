// Částky u AKCÍ Hodinářů (Kč)

/** Převede zadanou částku ("3 000", "1500,50") na kladné číslo, nebo null. */
export function parseAmount(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount > 0 ? amount : null
}

/** 3000 → "3 000 Kč" */
export function formatCzk(amount: number): string {
  return `${Number(amount).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč`
}
