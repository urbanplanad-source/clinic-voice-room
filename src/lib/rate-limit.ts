import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
};

type RedisRestConfig = {
  url: string;
  token: string;
};

type RedisCommandResponse = {
  result?: unknown;
  error?: string;
};

const buckets = new Map<string, Bucket>();

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function redisRestConfig(): RedisRestConfig | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.VERCEL_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.VERCEL_KV_REST_API_TOKEN;

  if (!url || !token) return null;
  return { url, token };
}

function redisTimeoutMs() {
  const value = Number.parseInt(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(value) || value < 100) return 800;
  return value;
}

function requireRedisRateLimit() {
  return process.env.REQUIRE_REDIS_RATE_LIMIT === "true";
}

const redisRateLimitScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export function clientIp(request: Request) {
  if (process.env.VERCEL === "1") {
    const vercelForwardedFor = firstForwardedValue(request.headers.get("x-vercel-forwarded-for"));
    if (vercelForwardedFor) return vercelForwardedFor;

    const forwardedFor = firstForwardedValue(request.headers.get("x-forwarded-for"));
    if (forwardedFor) return forwardedFor;

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const cloudflareConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
    if (cloudflareConnectingIp) return cloudflareConnectingIp;

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwardedFor = firstForwardedValue(request.headers.get("x-forwarded-for"));
    if (forwardedFor) return forwardedFor;
  }

  if (process.env.NODE_ENV !== "production") {
    const forwardedFor = firstForwardedValue(request.headers.get("x-forwarded-for"));
    if (forwardedFor) return forwardedFor;
  }

  return "unknown";
}

function memoryRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }

  bucket.count += 1;
  return (
    {
      ok: true,
      remaining: Math.max(0, limit - bucket.count),
      retryAfter: 0
    }
  );
}

async function redisRateLimit(
  { key, limit, windowMs }: RateLimitOptions,
  config: RedisRestConfig
): Promise<RateLimitResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), redisTimeoutMs());
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(["EVAL", redisRateLimitScript, 1, `cvr:rate-limit:${key}`, String(windowMs)]),
    cache: "no-store",
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Redis rate-limit request failed with ${response.status}`);
  }

  const data = (await response.json()) as RedisCommandResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  const result = Array.isArray(data.result) ? data.result : [];
  const count = Number(result[0] ?? 0);
  const ttlMs = Number(result[1] ?? windowMs);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    throw new Error("Redis rate-limit response was invalid");
  }

  if (count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil(ttlMs / 1000))
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - count),
    retryAfter: 0
  };
}

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const config = redisRestConfig();
  if (config) {
    try {
      return await redisRateLimit(options, config);
    } catch (caught) {
      console.error("[rate-limit] Redis backend failed.", caught);
      if (requireRedisRateLimit()) {
        return { ok: false, remaining: 0, retryAfter: 5 };
      }
    }
  }

  if (process.env.NODE_ENV === "production" && requireRedisRateLimit()) {
    console.error("[rate-limit] Redis backend is required in production.");
    return { ok: false, remaining: 0, retryAfter: 5 };
  }

  return memoryRateLimit(options);
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store"
      }
    }
  );
}
