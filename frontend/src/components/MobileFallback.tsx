/**
 * Desktop-only fallback for viewports ≤768px.
 */
import { Brand } from "./Brand";

export function MobileFallback() {
  return (
    <main className="mobile-fallback">
      <Brand />
      <p>Hummingbird needs a laptop for now.</p>
      <p className="muted">Open this URL on a desktop browser to hum a song.</p>
    </main>
  );
}
