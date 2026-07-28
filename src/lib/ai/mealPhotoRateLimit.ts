const REQUESTS_PER_HOUR = 5;
const WINDOW_MILLISECONDS = 60 * 60 * 1_000;

const requestsByUser = new Map<string, number[]>();

export type MealPhotoRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function consumeMealPhotoRateLimit(
  userId: string,
  now = Date.now(),
): MealPhotoRateLimitResult {
  const windowStart = now - WINDOW_MILLISECONDS;
  for (const [storedUserId, timestamps] of requestsByUser) {
    const active = timestamps.filter((timestamp) => timestamp > windowStart);
    if (active.length === 0) requestsByUser.delete(storedUserId);
    else if (active.length !== timestamps.length) {
      requestsByUser.set(storedUserId, active);
    }
  }

  const activeRequests = requestsByUser.get(userId) ?? [];
  if (activeRequests.length >= REQUESTS_PER_HOUR) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (activeRequests[0]! + WINDOW_MILLISECONDS - now) / 1_000,
      ),
    );
    return { allowed: false, retryAfterSeconds };
  }
  requestsByUser.set(userId, [...activeRequests, now]);
  return { allowed: true };
}

export function resetMealPhotoRateLimitForTests(): void {
  requestsByUser.clear();
}
