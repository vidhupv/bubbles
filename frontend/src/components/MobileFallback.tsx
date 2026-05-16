/**
 * Desktop-only MVP fallback for viewports ≤768px.
 *
 * No interactive surface — just the brand mark and a one-line note. Mobile
 * support lands in v1.1 per the design review.
 */
export function MobileFallback() {
  return (
    <main className="mobile-fallback">
      <h1>bubbles</h1>
      <p>Bubbles needs a laptop for now.</p>
      <p className="muted">Open this URL on a desktop browser to hum a song.</p>
    </main>
  );
}
