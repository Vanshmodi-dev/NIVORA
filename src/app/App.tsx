import { useEffect } from "react";
import { HashRouter } from "react-router-dom";
import { ToastProvider, useToast } from "../components/ui/Toast";
import { IntroHost } from "../intro/IntroHost";
import { appStore, useAppStore } from "../store/store";
import { startPresenterSession } from "./presenterSlots";
import { AppRoutes } from "./routes";

/** Tells the user (once) when saved data was discarded because it was unreadable or outdated. */
function LoadNotice() {
  const notice = useAppStore((s) => s.meta.notice);
  const { toast } = useToast();
  useEffect(() => {
    if (!notice) return;
    toast({
      tone: "info",
      title: notice === "reset_version" ? "Demo data was updated and has been reset." : "Saved demo data couldn’t be read and has been reset.",
    });
    appStore.getState().clearNotice();
  }, [notice, toast]);
  return null;
}

export function App() {
  useEffect(() => {
    startPresenterSession();
  }, []);
  return (
    <ToastProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoadNotice />
        <AppRoutes />
      </HashRouter>
      <IntroHost />
    </ToastProvider>
  );
}
