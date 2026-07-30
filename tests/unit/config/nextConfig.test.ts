import nextConfig, { buildFirebaseAuthRewrites } from "../../../next.config";

describe("Firebase Auth redirect proxy", () => {
  it("proxies Firebase helper paths transparently to firebaseapp.com", () => {
    expect(buildFirebaseAuthRewrites("natassha-ai-health-coach")).toEqual([
      {
        source: "/__/auth/:path*",
        destination:
          "https://natassha-ai-health-coach.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/init.json",
        destination:
          "https://natassha-ai-health-coach.firebaseapp.com/__/firebase/init.json",
      },
    ]);
  });

  it("does not construct a proxy destination from an unsafe project id", () => {
    expect(buildFirebaseAuthRewrites("project.example.com/path")).toEqual([]);
  });

  it("keeps Firebase helper paths out of the app-wide frame denial", async () => {
    const headers = await nextConfig.headers!();
    const appHeaders = headers.find((entry) =>
      entry.headers.some((header) => header.key === "X-Frame-Options"),
    );

    expect(appHeaders?.source).toContain("?!__/auth");
    expect(appHeaders?.source).toContain("__/firebase/init");
  });
});
