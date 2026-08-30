import { createClient } from "redis";
import { env } from "./env.ts";

/**
 * With no Redis there are no rooms, so there is no api. Giving up and dying
 * recovers better than a server that stays up answering errors to everything.
 */
const MAX_RETRIES = 5;

export const redis = createClient({
  url: env.redisUrl,
  socket: {
    connectTimeout: 5_000,
    reconnectStrategy: (retries) =>
      retries >= MAX_RETRIES
        ? new Error(`redis unreachable after ${MAX_RETRIES} attempts`)
        : Math.min(200 * 2 ** retries, 3_000),
  },
});

// No stack trace: the message repeats on every attempt.
redis.on("error", (err: Error) => console.error("[redis]", err.message));

export async function connectRedis(): Promise<void> {
  if (redis.isOpen) return;
  try {
    await redis.connect();
  } catch (err) {
    console.error(`[api] redis unreachable at ${env.redisUrl}: ${(err as Error).message}`);
    process.exit(1);
  }
}
