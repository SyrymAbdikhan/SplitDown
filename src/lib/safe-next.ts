/** Only allow same-site relative redirects (blocks `//evil.com` and absolute URLs). */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
