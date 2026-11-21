// MPF Coaching website worker.
// Serves the static site, plus one private endpoint for the online client portal:
//   GET /portal/api/me  -> the logged-in client's details
//
// Login is handled by Cloudflare Access (email one-time code) in front of /portal.
// This worker double-checks the Access token before returning anything.
//
// Settings (Cloudflare dashboard > Workers > mpf-coaching-website > Settings > Variables):
//   ACCESS_TEAM     e.g. "mpfcoaching.cloudflareaccess.com"
//   ACCESS_AUD      the Application Audience (AUD) tag of the /portal Access app
//   PORTAL_CLIENTS  (secret) JSON list of clients, keyed by email, e.g.
//     {"client@example.com":{"name":"Sam","tracker":"<sheet id>","folder":"<folder id>",
//       "photos":"<folder id>","videos":"<folder id>","food":"<folder id>",
//       "checkin":"Wednesday","start":"2026-09-21","phase":"Fat loss"}}
// Client details are never stored in the website code.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

let certCache = { at: 0, keys: null };

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys(team) {
  if (certCache.keys && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("certs");
  const { keys } = await r.json();
  certCache = { at: Date.now(), keys };
  return keys;
}

async function verifyAccess(request, env) {
  const token =
    request.headers.get("cf-access-jwt-assertion") ||
    (request.headers.get("cookie") || "").match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) return null;
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const keys = await getKeys(env.ACCESS_TEAM);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (payload.iss && payload.iss !== `https://${env.ACCESS_TEAM}`) return null;
  return (payload.email || "").toLowerCase();
}

async function me(request, env) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD || !env.PORTAL_CLIENTS) {
    return json({ configured: false });
  }
  let email;
  try {
    email = await verifyAccess(request, env);
  } catch (e) {
    return json({ configured: true, error: "verify" }, 503);
  }
  if (!email) return json({ configured: true, signedIn: false }, 401);
  let clients = {};
  try {
    clients = JSON.parse(env.PORTAL_CLIENTS);
  } catch (e) {
    return json({ configured: true, error: "clients" }, 500);
  }
  const lower = Object.fromEntries(Object.entries(clients).map(([k, v]) => [k.toLowerCase(), v]));
  const c = lower[email];
  if (!c) return json({ configured: true, signedIn: true, known: false, email });
  return json({ configured: true, signedIn: true, known: true, email, client: c });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/portal/api/me") return me(request, env);
    return env.ASSETS.fetch(request);
  },
};
