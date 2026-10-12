import { useSearchParams } from "react-router-dom";
import { PublicShell } from "../app/shells";
import { Welcome } from "../pages/Welcome";
import { Onboarding } from "./Onboarding";
import { isOnboardingDone, isOnboardingEnabled } from "./session";

/**
 * The application root. A fresh demo session opens the Nivi-led onboarding (after the brand intro);
 * once it has been finished or skipped in this tab, `/` shows the Welcome hub instead, so it is never
 * replayed by ordinary navigation. A `?s=` step in the URL means a journey is in progress (refresh
 * safe); `?reset=1` is the rehearsal shortcut and always goes to Welcome.
 */
export function EntryGate() {
  const [params] = useSearchParams();
  const inJourney = params.has("s");
  const showOnboarding = isOnboardingEnabled() && params.get("reset") !== "1" && (inJourney || !isOnboardingDone());
  if (showOnboarding) return <Onboarding />;
  return (
    <PublicShell dark>
      <Welcome />
    </PublicShell>
  );
}
