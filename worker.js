// MPF Coaching website worker.
// Serves the static site, plus private endpoints for the online client portal.
//
// Login is handled by Cloudflare Access (email one-time code / Google) in front of /portal.
// This worker double-checks the Access token on every private request.
//
// Settings (Cloudflare dashboard > Workers > mpf-coaching-website > Settings > Variables):
//   ACCESS_TEAM     e.g. "mpfcoaching.cloudflareaccess.com"
//   ACCESS_AUD      Application Audience (AUD) tag of the /portal Access app
//   COACH_EMAILS    comma-separated emails that can see the coach view (e.g. "info@mpfcoaching.co.uk")
//   PORTAL_CLIENTS  (secret) JSON of clients keyed by email, e.g.
//     {"client@example.com":{"id":"sam","name":"Sam","tracker":"<sheet id>","folder":"<folder id>",
//       "checkin":"Wednesday","start":"2026-09-21","phase":"Fat loss","active":true}}
//     A client with two emails: give both entries the same "id".
//   SHEETS_URL      web app URL of the MPF Portal Weights Google Apps Script
//   SHEETS_KEY      (secret) the key that script expects
// Binding:
//   PHOTOS          private R2 bucket for check-in photos (never public)
// Client details are never stored in the website code.

const MAX_BYTES = 15 * 1024 * 1024;
const ANGLES = ["front", "side", "back"];

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
  // Local testing only: never honoured on the real website.
  const host = new URL(request.url).hostname;
  if (env.DEV_FAKE_EMAIL && (host === "127.0.0.1" || host === "localhost")) {
    return env.DEV_FAKE_EMAIL.toLowerCase();
  }
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

function roster(env) {
  const raw = JSON.parse(env.PORTAL_CLIENTS || "{}");
  const byEmail = {};
  for (const [email, c] of Object.entries(raw)) {
    const id = String(c.id || email).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    byEmail[email.toLowerCase()] = { ...c, id };
  }
  return byEmail;
}

function weekOf(start, when = Date.now()) {
  if (!start) return 1;
  const s = Date.parse(start + "T00:00:00Z");
  if (isNaN(s)) return 1;
  return Math.max(1, Math.floor((when - s) / 604800000) + 1);
}

// Who is asking? Returns {email, client, coach} or a Response on failure.
async function who(request, env) {
  const configured = env.PORTAL_CLIENTS && (env.DEV_FAKE_EMAIL || (env.ACCESS_TEAM && env.ACCESS_AUD));
  if (!configured) return json({ configured: false });
  let email;
  try {
    email = await verifyAccess(request, env);
  } catch (e) {
    return json({ configured: true, error: "verify" }, 503);
  }
  if (!email) return json({ configured: true, signedIn: false }, 401);
  let r;
  try {
    r = roster(env);
  } catch (e) {
    return json({ configured: true, error: "clients" }, 500);
  }
  const coaches = String(env.COACH_EMAILS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  return { email, client: r[email] || null, coach: coaches.includes(email), roster: r };
}

async function listPhotos(env, id) {
  const out = [];
  let cursor;
  do {
    const page = await env.PHOTOS.list({ prefix: `${id}/`, cursor, include: ["customMetadata"] });
    for (const o of page.objects) {
      const m = o.customMetadata || {};
      out.push({ key: o.key, week: Number(m.week) || 0, angle: m.angle || "", uploaded: o.uploaded, size: o.size });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  out.sort((a, b) => b.week - a.week || ANGLES.indexOf(a.angle) - ANGLES.indexOf(b.angle) || (a.uploaded < b.uploaded ? 1 : -1));
  return out;
}

async function weights(env, sheet) {
  if (!env.SHEETS_URL || !env.SHEETS_KEY || !sheet) return null;
  const cache = caches.default;
  const ck = new Request(`https://cache.mpf/weights/${encodeURIComponent(sheet)}`);
  const hit = await cache.match(ck);
  if (hit) return hit.json();
  const u = new URL(env.SHEETS_URL);
  u.searchParams.set("sheet", sheet);
  u.searchParams.set("key", env.SHEETS_KEY);
  const r = await fetch(u.toString(), { redirect: "follow" });
  if (!r.ok) return null;
  const j = await r.json();
  if (!Array.isArray(j.weights)) return null;
  const data = { weights: j.weights.slice(-400) };
  await cache.put(ck, new Response(JSON.stringify(data), { headers: { "cache-control": "max-age=900" } }));
  return data;
}

async function handleApi(request, env, url) {
  const w = await who(request, env);
  if (w instanceof Response) return w;
  const { email, client, coach, roster: r } = w;
  const path = url.pathname;

  if (path === "/portal/api/me") {
    if (!client) return json({ configured: true, signedIn: true, known: false, coach, email });
    const { id, ...pub } = client;
    return json({
      configured: true, signedIn: true, known: true, coach, email,
      client: pub, week: weekOf(client.start), photos: !!env.PHOTOS,
    });
  }

  // ---- client photos ----
  if (path === "/portal/api/photos" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    if (!env.PHOTOS) return json({ enabled: false, photos: [] });
    return json({ enabled: true, week: weekOf(client.start), photos: await listPhotos(env, client.id) });
  }

  if (path === "/portal/api/photos" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    if (!env.PHOTOS) return json({ error: "disabled" }, 503);
    const form = await request.formData();
    const file = form.get("photo");
    const angle = String(form.get("angle") || "").toLowerCase();
    const current = weekOf(client.start);
    let week = parseInt(form.get("week"), 10);
    if (!ANGLES.includes(angle)) return json({ error: "angle" }, 400);
    if (!week || week < 0 || week > current) week = current;
    if (!file || typeof file === "string") return json({ error: "file" }, 400);
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return json({ error: "type" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "size" }, 413);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" }[file.type];
    const key = `${client.id}/w${String(week).padStart(3, "0")}-${angle}-${Date.now()}.${ext}`;
    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { week: String(week), angle, by: email },
    });
    return json({ ok: true, key, week, angle });
  }

  if (path === "/portal/api/photo" && request.method === "GET") {
    if (!env.PHOTOS) return json({ error: "disabled" }, 503);
    const key = url.searchParams.get("key") || "";
    const owner = key.split("/")[0];
    const allowed = coach || (client && client.id === owner);
    if (!allowed) return json({ error: "forbidden" }, 403);
    const obj = await env.PHOTOS.get(key);
    if (!obj) return json({ error: "not found" }, 404);
    return new Response(obj.body, {
      headers: {
        "content-type": obj.httpMetadata?.contentType || "image/jpeg",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (path === "/portal/api/photo" && request.method === "DELETE") {
    if (!env.PHOTOS) return json({ error: "disabled" }, 503);
    const key = url.searchParams.get("key") || "";
    const owner = key.split("/")[0];
    if (!(coach || (client && client.id === owner))) return json({ error: "forbidden" }, 403);
    await env.PHOTOS.delete(key);
    return json({ ok: true });
  }

  if (path === "/portal/api/weights") {
    if (!client) return json({ error: "unknown" }, 403);
    const d = await weights(env, client.tracker);
    if (!d) return json({ enabled: !!env.SHEETS_URL, weights: [] });
    return json({ enabled: true, weights: d.weights });
  }

  // ---- coach ----
  if (path === "/portal/api/coach/clients") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const seen = new Set();
    const list = [];
    for (const c of Object.values(r)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      let photos = [];
      if (env.PHOTOS) photos = await listPhotos(env, c.id);
      const week = weekOf(c.start);
      const thisWeek = photos.filter((p) => p.week === week).map((p) => p.angle);
      list.push({
        id: c.id, name: c.name, phase: c.phase || "", checkin: c.checkin || "Wednesday", start: c.start || "",
        active: c.active !== false, week, tracker: c.tracker || "", folder: c.folder || "",
        photosThisWeek: [...new Set(thisWeek)], lastUpload: photos.reduce((m, p) => (p.uploaded > m ? p.uploaded : m), ""),
        photoCount: photos.length,
      });
    }
    list.sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
    return json({ enabled: !!env.PHOTOS, clients: list });
  }

  if (path === "/portal/api/coach/photos") {
    if (!coach) return json({ error: "forbidden" }, 403);
    if (!env.PHOTOS) return json({ enabled: false, photos: [] });
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return json({ enabled: true, photos: await listPhotos(env, id) });
  }

  if (path === "/portal/api/coach/weights") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    const d = await weights(env, c.tracker);
    return json({ enabled: !!d, weights: d ? d.weights : [] });
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/portal/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (e) {
        return json({ error: "server" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
