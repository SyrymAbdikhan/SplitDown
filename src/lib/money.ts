// Amounts are integer minor units (cents). Decimal places come from the currency (JPY 0, USD 2, ...).
export const CURRENCIES = ["USD", "EUR", "GBP", "KZT", "RUB", "TRY", "AED", "CAD", "AUD", "CHF", "JPY", "CNY", "INR", "KRW", "UZS", "KGS", "GEL", "PLN"];

const digits = (currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;

export const formatMoney = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 10 ** digits(currency));

/** "12.5" / "12,50" → 1250. Returns null for invalid or non-positive input. */
export function parseMoney(input: string, currency: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d*)?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 10 ** digits(currency));
  return cents > 0 ? cents : null;
}

export const toInput = (cents: number, currency: string) => (cents / 10 ** digits(currency)).toFixed(digits(currency));
