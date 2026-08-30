import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono, MiddlewareHandler } from "hono";
import { env } from "./env.ts";

/**
 * The SFU is the page's only way out: no CDN, no remote font, no analytics.
 * Two schemes, because livekit-client opens the WebSocket and also makes an
 * HTTP validation call to the same host.
 */
const sfu = new URL(env.livekitPublicUrl);
const sfuOrigins =
  sfu.protocol === "wss:" || sfu.protocol === "https:"
    ? `wss://${sfu.host} https://${sfu.host}`
    : `ws://${sfu.host} http://${sfu.host}`;

const CSP = [
  "default-src 'self'",
  /*
    The YouTube player in DJ mode: iframe_api is served from their domain and
    loads a second script from www-widgetapi. That is all — the audio never
    passes through our media server; each browser plays its own video.
  */
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  // React writes style as an attribute (`style={{...}}`), which CSP treats as inline.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src 'self' ${sfuOrigins}`,
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/**
 * Security headers. They live here rather than in the proxy because the proxy
 * is not ours: whatever applies to the app has to travel with the app.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  // The room token lives in the URL. Without this, any external resource the
  // page ends up loading would carry the link along in the Referer.
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Content-Security-Policy", CSP);
};

const ASSET_PATH = /[\\/]assets[\\/]/;

/**
 * Serves the frontend bundle. In development it does nothing: Vite serves the
 * interface, and `WEB_ROOT` only exists inside the image.
 *
 * It has to be registered last — the catch-all route at the end swallows any
 * path in order to return `index.html`.
 */
export function mountWeb(app: Hono): void {
  const root = env.webRoot;
  if (!root) return;

  // Files under `assets` carry a hash in the name, so their content never
  // changes. `index.html` changes on every deploy and is what points at them.
  const cache = (path: string, c: { header: (k: string, v: string) => void }) => {
    c.header(
      "Cache-Control",
      ASSET_PATH.test(path) ? "public, max-age=31536000, immutable" : "no-cache",
    );
  };

  app.use("*", serveStatic({ root, onFound: cache }));

  // There is no client-side router: every path returns the same page.
  app.get("*", serveStatic({ root, path: "index.html", onFound: cache }));
}
