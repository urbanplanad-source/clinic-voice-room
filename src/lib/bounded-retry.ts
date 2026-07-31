export type BoundedRetryFailure = {
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
  errorName: string;
  errorMessage: string;
};

function errorDetails(caught: unknown) {
  if (caught instanceof Error) {
    return {
      errorName: caught.name || "Error",
      errorMessage: caught.message || "unknown_error"
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: String(caught)
  };
}

export async function runWithBoundedRetry<T>(params: {
  maxAttempts: number;
  operation: (attempt: number) => Promise<T>;
  onFailure?: (failure: BoundedRetryFailure) => void;
  retryDelayMs?: number;
}) {
  const maxAttempts = Math.max(1, Math.floor(params.maxAttempts));
  const retryDelayMs = Math.max(0, Math.floor(params.retryDelayMs ?? 0));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await params.operation(attempt);
    } catch (caught) {
      params.onFailure?.({
        attempt,
        maxAttempts,
        elapsedMs: Date.now() - startedAt,
        ...errorDetails(caught)
      });

      if (attempt >= maxAttempts) throw caught;
      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw new Error("bounded_retry_exhausted");
}