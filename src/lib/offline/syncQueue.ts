/**
 * Offline Sync Queue
 * ---------------------------------------------------------------------------
 * Firestore's persistentLocalCache (enabled in src/lib/firebase/config.ts)
 * already queues writes made while offline and replays them automatically
 * on reconnect — for plain Firestore reads/writes you get "auto sync" for
 * free and this module isn't in the critical path.
 *
 * This queue exists for the operations that are NOT plain Firestore writes,
 * e.g. user-confirmed Firestore updates made on the way home with
 * no signal. Those need to be captured, persisted locally, and retried
 * ourselves once the browser reports connectivity.
 */

export type PendingOperationType = "upload-meal-photo" | "generate-report";

export interface PendingOperation {
  id: string;
  type: PendingOperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

const STORAGE_KEY = "natassha:pending-operations";
const MAX_ATTEMPTS = 5;

function readQueue(): PendingOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingOperation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOperation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueOperation(
  type: PendingOperationType,
  payload: Record<string, unknown>,
): PendingOperation {
  const op: PendingOperation = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const queue = readQueue();
  queue.push(op);
  writeQueue(queue);
  return op;
}

export function listPendingOperations(): PendingOperation[] {
  return readQueue();
}

export function removeOperation(id: string): void {
  writeQueue(readQueue().filter((op) => op.id !== id));
}

export function markAttempt(id: string): PendingOperation | undefined {
  const queue = readQueue();
  const op = queue.find((item) => item.id === id);
  if (op) {
    op.attempts += 1;
    writeQueue(queue);
  }
  return op;
}

export function isRetryExhausted(op: PendingOperation): boolean {
  return op.attempts >= MAX_ATTEMPTS;
}

export type OperationHandler = (op: PendingOperation) => Promise<void>;

/**
 * Drains the queue, invoking `handlers[op.type]` for each pending item.
 * Call this from a "back online" listener (see useOnlineStatus) and once
 * on app start. Operations that keep failing past MAX_ATTEMPTS are removed
 * to avoid an infinite retry loop; callers can log/surface that separately.
 */
export async function drainQueue(
  handlers: Partial<Record<PendingOperationType, OperationHandler>>,
): Promise<void> {
  const queue = readQueue();

  for (const op of queue) {
    const handler = handlers[op.type];
    if (!handler) continue;

    try {
      await handler(op);
      removeOperation(op.id);
    } catch {
      const updated = markAttempt(op.id);
      if (updated && isRetryExhausted(updated)) {
        removeOperation(op.id);
      }
    }
  }
}
