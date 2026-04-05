/**
 * Langfuse observability client — lazy singleton.
 *
 * Returns null when LANGFUSE_HOST / LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY
 * are not configured so all callers degrade gracefully.
 */
import { Langfuse } from "langfuse";

let _client: Langfuse | null = null;
let _initialized = false;

/**
 * Return the Langfuse singleton, or null if not configured / unavailable.
 * Never throws.
 */
export function getLangfuseClient(): Langfuse | null {
  if (_initialized) return _client;
  _initialized = true;

  const host = (process.env.LANGFUSE_HOST ?? "").trim();
  const secretKey = (process.env.LANGFUSE_SECRET_KEY ?? "").trim();
  const publicKey = (process.env.LANGFUSE_PUBLIC_KEY ?? "").trim();

  if (!host || !secretKey || !publicKey) {
    return null;
  }

  try {
    _client = new Langfuse({
      baseUrl: host,
      secretKey,
      publicKey,
    });
    return _client;
  } catch {
    return null;
  }
}

/**
 * Reset the singleton — for testing only.
 * @internal
 */
export function _resetLangfuseClient(): void {
  _client = null;
  _initialized = false;
}
