export type DataSourceStatus =
  | "available"
  | "empty"
  | "unavailable"
  | "stale";

export type SafeDataErrorCode =
  | "permission"
  | "index-building"
  | "network"
  | "offline"
  | "missing-profile"
  | "unknown";

export interface DataSourceResult<T> {
  status: DataSourceStatus;
  data: T;
  updatedAt?: string;
  errorCode?: SafeDataErrorCode;
}

export type DataSourceAvailability = Omit<DataSourceResult<never>, "data">;

interface DataSourceOptions<T> {
  isEmpty: (data: T) => boolean;
  updatedAt?: (data: T) => string | undefined;
  staleAfterMs?: number;
  now?: Date;
}

export function toSafeDataErrorCode(error: unknown): SafeDataErrorCode {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message =
    typeof candidate?.message === "string"
      ? candidate.message.toLowerCase()
      : "";

  if (code.includes("permission-denied")) return "permission";
  if (
    code.includes("failed-precondition") &&
    (message.includes("index") || message.includes("building"))
  ) {
    return "index-building";
  }
  if (code.includes("unavailable") || code.includes("deadline-exceeded")) {
    return "network";
  }
  if (message.includes("offline")) return "offline";
  if (message.includes("network")) return "network";
  return "unknown";
}

export async function loadDataSource<T>(
  loader: () => Promise<T>,
  unavailableData: T,
  options: DataSourceOptions<T>,
): Promise<DataSourceResult<T>> {
  try {
    const data = await loader();
    const updatedAt = options.updatedAt?.(data);
    if (
      updatedAt &&
      options.staleAfterMs != null &&
      Number.isFinite(options.staleAfterMs)
    ) {
      const ageMs =
        (options.now ?? new Date()).getTime() - new Date(updatedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs > options.staleAfterMs) {
        return { status: "stale", data, updatedAt };
      }
    }
    return {
      status: options.isEmpty(data) ? "empty" : "available",
      data,
      ...(updatedAt ? { updatedAt } : {}),
    };
  } catch (error) {
    return {
      status: "unavailable",
      data: unavailableData,
      errorCode: toSafeDataErrorCode(error),
    };
  }
}

export function sourceAvailability<T>(
  result: DataSourceResult<T>,
): DataSourceAvailability {
  return {
    status: result.status,
    ...(result.updatedAt ? { updatedAt: result.updatedAt } : {}),
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
  };
}

export function sourceCanInformDecisions<T>(
  result: DataSourceResult<T>,
): boolean {
  return result.status === "available" || result.status === "empty";
}
