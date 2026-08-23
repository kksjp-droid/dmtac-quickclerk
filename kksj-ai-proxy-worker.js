// KKSJ DMTAC QuickClerk - AI Smart Dictation shared proxy
// ------------------------------------------------------------------
// Deploy this as a Cloudflare Worker. It holds your personal Gemini
// API key as a server-side secret (never sent to any browser) and
// only forwards requests to Gemini if the caller supplies the correct
// access code, which you set as a second secret and share only with
// authorised DMTAC pharmacists (e.g. pkdspt).
//
// Deployment: see the "Setting Up the KKSJ Shared AI Proxy" section
// in README.md for step-by-step instructions.
//
// Required secrets (set in Cloudflare dashboard -> your Worker ->
// Settings -> Variables and Secrets):
//   GEMINI_API_KEY   - your personal Gemini API key
//   AI_ACCESS_CODE   - a code you choose, shared only with authorised
//                      pharmacists. Do NOT reuse the site's "kksj"
//                      unlock code here - that code is visible to
//                      anyone who views the page source, so it gives
//                      zero protection if reused for this purpose.
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// SECURITY NOTES - read before making the Worker URL public
//
// 1. ALLOWED_ORIGINS below must list your GitHub Pages origin. With it
//    set, a browser on any other site cannot call this Worker. Leaving
//    it empty falls back to "*", which is fine for testing but means
//    any website can send requests at your Gemini quota.
//
// 2. The access code is sent from the browser on every request. Anyone
//    with DevTools open on an authorised pharmacist's session can read
//    it. Treat it like a shared team password: make it LONG and RANDOM
//    (e.g. 24+ characters from a password generator), never a guessable
//    word, and rotate it if you suspect it has leaked.
//
// 3. Rate limiting below caps requests per IP per minute. Without it, a
//    public Worker URL can be brute-forced against a short access code,
//    and a leaked code can burn your Gemini billing unchecked.
// ------------------------------------------------------------------

// Set this to your GitHub Pages origin, e.g. "https://yourname.github.io".
// Multiple origins allowed. Empty array = allow any origin (not advised).
const ALLOWED_ORIGINS = [
  // "https://YOUR-USERNAME.github.io"
];

const RATE_LIMIT_PER_MIN = 20;   // requests per IP per minute
const rateBuckets = new Map();   // per-isolate, best-effort

function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60000;
  const hits = (rateBuckets.get(ip) || []).filter(t => t > windowStart);
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 5000) rateBuckets.clear();  // crude memory guard
  return hits.length > RATE_LIMIT_PER_MIN;
}

function corsFor(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.length === 0
    ? "*"
    : (ALLOWED_ORIGINS.includes(origin) ? origin : null);
  return {
    allowed: allow !== null,
    headers: {
      "Access-Control-Allow-Origin": allow || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  };
}

export default {
  async fetch(request, env) {
    const cors = corsFor(request);
    const corsHeaders = cors.headers;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!cors.allowed) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded - try again shortly" }), {
        status: 429,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const accessCode = body.accessCode;
    const prompt = body.prompt;
    const model = body.model || "gemini-3.7-flash";

    if (!accessCode || accessCode !== env.AI_ACCESS_CODE) {
      return new Response(JSON.stringify({ error: "Invalid or missing access code" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Proxy misconfigured: GEMINI_API_KEY secret not set" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY);

    let geminiRes;
    try {
      geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Failed to reach Gemini API: " + e.message }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: "Gemini API error", detail: geminiData }), {
        status: geminiRes.status,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify(geminiData), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }
};
