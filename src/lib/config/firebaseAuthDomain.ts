export const PRODUCTION_APP_AUTH_DOMAIN =
  "natassha-ai-health-coach-blush.vercel.app";

/**
 * Firebase redirect helpers must share the app origin on the production
 * Vercel host so Safari does not need cross-origin helper storage.
 */
export function resolveFirebaseAuthDomain(
  configuredAuthDomain: string,
  browserHostname: string | undefined,
): string {
  return browserHostname === PRODUCTION_APP_AUTH_DOMAIN
    ? PRODUCTION_APP_AUTH_DOMAIN
    : configuredAuthDomain;
}
