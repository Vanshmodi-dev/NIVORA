import { Link, useLocation } from "react-router-dom";
import { Compass, TriangleAlert } from "lucide-react";
import { buttonClassName } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import type { Persona } from "../domain/types";
import { useAppStore } from "../store/store";
import type { StubRoute } from "../app/nav";

/** S-02 Not Found. The primary action depends on the role (blueprint inventory S-02). */
export function NotFound({ persona: forced }: { persona?: Persona }) {
  const persona = useAppStore((s) => s.ui.persona);
  const effective = forced ?? persona;
  const target = effective === "tenant" ? { to: "/tenant", label: "Back to Find a Home" } : effective === "owner" ? { to: "/owner", label: "Back to Owner area" } : { to: "/", label: "Back to Welcome" };
  return (
    <div className="container">
      <EmptyState
        icon={<Compass size={26} />}
        as="h1"
        title="We can’t find that page"
        description="The link may be out of date, or this home isn’t available to view."
        action={
          <Link className={buttonClassName("primary")} to={target.to}>
            {target.label}
          </Link>
        }
      />
    </div>
  );
}

const JOURNEY_COPY: Partial<Record<Persona, { title: string; text: string }>> = {
  owner: {
    title: "The Owner journey is coming in the next build phases",
    text: "You’ve reached the Owner area. This build contains the foundation only — the dashboard, property management and listing wizard arrive in Phase 4.",
  },
};

/** Honest destination for the Welcome cards in Phase 1 (AC-02: destinations may be stubs). */
export function JourneyPending({ persona }: { persona: Persona }) {
  const copy = JOURNEY_COPY[persona] ?? { title: "Coming in a later build phase", text: "This area is not built yet." };
  return (
    <div className="container">
      <EmptyState
        icon={<Compass size={26} />}
        title={copy.title}
        description={copy.text}
        action={
          <Link className={buttonClassName("secondary")} to="/">
            Back to Welcome
          </Link>
        }
      />
    </div>
  );
}

/** Development-only stub for a route that is in the route map but not yet built (D-19). */
export function DevStub({ stub }: { stub: StubRoute }) {
  const { pathname } = useLocation();
  return (
    <div className="container">
      <EmptyState
        icon={<TriangleAlert size={26} />}
        title={`${stub.screenId} · ${stub.name}`}
        description={`Development stub for ${pathname}. This screen is built in ${stub.phase}. This page is not included in production builds.`}
      />
    </div>
  );
}
