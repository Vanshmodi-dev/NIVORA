import { TrustCenterContent } from "../components/trust/TrustCenterContent";
import { useAppStore } from "../store/store";
import { useNow } from "../store/useNow";

/** S-01 Trust Center (page). Same content is available as a drawer from property details. */
export function TrustCenterPage() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  return (
    <div className="container" style={{ paddingBlock: "32px 64px", maxWidth: 920 }}>
      <h1 style={{ marginBottom: 8 }}>How trust works on NIVORA</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>
        What each check means, what it does not mean, and why NIVORA never shows a single &ldquo;verified&rdquo; tick.
      </p>
      <TrustCenterContent data={data} now={now} />
    </div>
  );
}
