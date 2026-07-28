/**
 * Server-side Firebase ID-token verification.
 *
 * The API never trusts a uid supplied by the browser. It verifies the bearer
 * token with Firebase Authentication and returns only Firebase's confirmed uid.
 */

const FIREBASE_ACCOUNT_LOOKUP_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

export type FirebaseRequestAuthenticationResult =
  | { status: "authenticated"; uid: string }
  | { status: "unauthenticated" }
  | { status: "configuration-error" }
  | { status: "verification-unavailable" };

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function extractUid(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("users" in body)) return null;
  const users = (body as { users?: unknown }).users;
  if (!Array.isArray(users) || users.length === 0) return null;
  const first = users[0];
  if (!first || typeof first !== "object" || !("localId" in first)) return null;
  const uid = (first as { localId?: unknown }).localId;
  return typeof uid === "string" && uid.length > 0 ? uid : null;
}

export async function authenticateFirebaseRequest(
  request: Request,
): Promise<FirebaseRequestAuthenticationResult> {
  const token = bearerToken(request);
  if (!token) return { status: "unauthenticated" };

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) return { status: "configuration-error" };

  try {
    const response = await fetch(
      `${FIREBASE_ACCOUNT_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        cache: "no-store",
      },
    );
    if (!response.ok) return { status: "unauthenticated" };
    const uid = extractUid(await response.json());
    return uid
      ? { status: "authenticated", uid }
      : { status: "unauthenticated" };
  } catch {
    return { status: "verification-unavailable" };
  }
}
