import { useEffect } from "react";
import { BrandIntro } from "./BrandIntro";
import { maybeAutoPlayIntro, useIntroPlaying } from "./introStore";

/** Mounted once at the app root. Plays the intro on first entry and on explicit replay only. */
export function IntroHost() {
  const playing = useIntroPlaying();
  useEffect(() => {
    maybeAutoPlayIntro();
  }, []);
  return playing ? <BrandIntro /> : null;
}
