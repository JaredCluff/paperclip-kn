import type { Request, RequestHandler } from "express";
import { logger } from "./logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

function parseOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function trustedOriginsForConfig(allowedHostnames: string[]): Set<string> {
  const origins = new Set(DEFAULT_DEV_ORIGINS.map((value) => value.toLowerCase()));
  for (const hostname of allowedHostnames) {
    const trimmed = hostname.trim().toLowerCase();
    if (!trimmed) continue;
    origins.add(`http://${trimmed}`);
    origins.add(`https://${trimmed}`);
  }
  return origins;
}

function isTrustedBoardMutationRequest(req: Request, allowedOrigins: Set<string>) {
  const origin = parseOrigin(req.header("origin"));
  if (origin && allowedOrigins.has(origin)) return true;

  const refererOrigin = parseOrigin(req.header("referer"));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) return true;

  return false;
}

export function boardMutationGuard(options?: { allowedHostnames?: string[] }): RequestHandler {
  const allowedOrigins = trustedOriginsForConfig(options?.allowedHostnames ?? []);

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    if (req.actor.type !== "board") {
      next();
      return;
    }

    // local_implicit (local-trusted deployment mode) is not a browser-session request;
    // origin/referer headers are absent by design, so skip the browser-origin check.
    if (req.actor.source === "local_implicit") {
      next();
      return;
    }

    // board_key (Bearer API key) bypasses the browser-origin check because the key is
    // a machine credential that never sends Origin/Referer headers.  A leaked key can
    // therefore reach any mutation route without a trusted-origin header.  Log every
    // such request so the bypass is auditable and anomalies can be detected.
    if (req.actor.source === "board_key") {
      logger.warn(
        {
          method: req.method,
          url: req.originalUrl,
          keyId: req.actor.keyId,
          userId: req.actor.userId,
        },
        "Board mutation via API key (board_key): bypassing browser-origin guard",
      );
      next();
      return;
    }

    if (!isTrustedBoardMutationRequest(req, allowedOrigins)) {
      res.status(403).json({ error: "Board mutation requires trusted browser origin" });
      return;
    }

    next();
  };
}
