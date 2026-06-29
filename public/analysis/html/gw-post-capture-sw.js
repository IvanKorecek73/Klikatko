// Service worker that lets the static GwResponsePage.html show a POST body.
// Payment gateways (CSOB) return the result as a top-level POST to the return URL.
// A static page cannot read its own POST body from JS, so this worker intercepts the
// POST navigation, reads the body, and serves the page HTML with the body injected
// into window.__GW_POST_BODY__.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const request = event.request;

  // Only intercept top-level POST navigations (the gateway return); leave everything else.
  if (request.method !== "POST" || request.mode !== "navigate") {
    return;
  }

  event.respondWith(handlePostNavigation(request));
});

async function handlePostNavigation(request) {
  const contentType = request.headers.get("content-type") || "";

  let body = "";
  try {
    body = await request.clone().text();
  } catch (error) {
    body = "";
  }

  let html;
  try {
    const pageResponse = await fetch(request.url, { method: "GET" });
    html = await pageResponse.text();
  } catch (error) {
    html = "<!doctype html><html lang=\"cs\"><head><meta charset=\"utf-8\"></head><body></body></html>";
  }

  // Embed the captured body; escape "<" so a "</script>" in the payload can't close the tag.
  const payload = JSON.stringify({ contentType, body }).replace(/</g, "\\u003c");
  const inject = `<script>window.__GW_POST_BODY__ = ${payload};</script>`;
  html = html.includes("</head>") ? html.replace("</head>", `${inject}</head>`) : `${inject}${html}`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
