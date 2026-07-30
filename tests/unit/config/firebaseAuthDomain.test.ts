import {
  PRODUCTION_APP_AUTH_DOMAIN,
  resolveFirebaseAuthDomain,
} from "@/lib/config/firebaseAuthDomain";

describe("Firebase Auth domain resolution", () => {
  it("uses the same-origin Vercel host in production", () => {
    expect(
      resolveFirebaseAuthDomain(
        "natassha-ai-health-coach.firebaseapp.com",
        PRODUCTION_APP_AUTH_DOMAIN,
      ),
    ).toBe(PRODUCTION_APP_AUTH_DOMAIN);
  });

  it("preserves the configured domain outside the production host", () => {
    expect(
      resolveFirebaseAuthDomain(
        "demo-project.firebaseapp.com",
        "localhost",
      ),
    ).toBe("demo-project.firebaseapp.com");
  });
});
