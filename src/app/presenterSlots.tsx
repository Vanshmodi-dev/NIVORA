import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { PRESENTER_ENABLED } from "./features";

/**
 * Lazy entry points to Presenter Demo Mode. In production builds `PRESENTER_ENABLED` is a literal
 * `false`, so these are `null` and the presenter chunk is not part of the build at all (D4).
 */
const Banner = PRESENTER_ENABLED ? lazy(() => import("../presenter/PresenterUI").then((m) => ({ default: m.PresenterBanner }))) : null;
const Panel = PRESENTER_ENABLED ? lazy(() => import("../presenter/PresenterUI").then((m) => ({ default: m.PresenterPanel }))) : null;
const Entry = PRESENTER_ENABLED ? lazy(() => import("../presenter/PresenterUI").then((m) => ({ default: m.PresenterEntry }))) : null;

export function PresenterBannerSlot() {
  if (!Banner) return null;
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}

export function PresenterEntrySlot({ onEntered }: { onEntered: () => void }) {
  if (!Entry) return null;
  return (
    <Suspense fallback={null}>
      <Entry onEntered={onEntered} />
    </Suspense>
  );
}

export function PresenterPanelRoute() {
  if (!Panel) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  );
}

/** Restores the session flag after a refresh and keeps the simulated clock consistent (demo builds only). */
export function startPresenterSession(): void {
  if (PRESENTER_ENABLED) void import("../presenter/session").then((m) => m.initPresenter());
}
