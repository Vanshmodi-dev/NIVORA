/**
 * Build-time feature flags. `VITE_ENABLE_PRESENTER_MODE` is replaced by Vite with a literal at
 * build time, so in a production build every branch guarded by `PRESENTER_ENABLED` is removed and
 * the presenter chunk is never emitted — it is not merely hidden (founder D4, blueprint §9.6 PM-6).
 *
 *  - development / test / `--mode demo` builds: enabled (.env.development, .env.test, .env.demo)
 *  - production builds (`npm run build`): disabled (.env.production)
 */
export const PRESENTER_ENABLED: boolean = import.meta.env.VITE_ENABLE_PRESENTER_MODE === "true";
