"use client"; // Error boundaries must be Client Components

// Last resort when the root layout itself fails. It replaces the whole document,
// so it can't rely on the app's stylesheet or fonts: everything is inline.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa" }}>
        <title>Something went wrong · SplitDown</title>
        <main style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 48 }}>😵</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 4px" }}>Something went wrong</h1>
          <p style={{ color: "#a3a3a3", margin: "0 0 20px", fontSize: 14 }}>This is usually temporary.</p>
          <button onClick={retry} style={{ background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
