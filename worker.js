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
//       "checkin":"Wednesday","start":"2026-09-21","phase":"Fat loss","active":true,"type":"online"}}
//     type "pt" = face to face (check-in defaults to Sunday).
//     A client with two emails: give both entries the same "id".
// Binding:
//   PHOTOS          private R2 bucket: check-in photos, plus daily logs and check-ins under _data/ (never public)
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

// Client list: the PORTAL_CLIENTS secret plus the list kept in R2 (_data/_roster.json), which has no size limit.
let rosterCache = { at: 0, data: null };
async function loadRoster(env, fresh) {
  if (!fresh && rosterCache.data && Date.now() - rosterCache.at < 30000) return rosterCache.data;
  let extra = {};
  if (env.PHOTOS) {
    const o = await env.PHOTOS.get("_data/_roster.json");
    if (o) { try { extra = await o.json(); } catch (e) { extra = {}; } }
  }
  rosterCache = { at: Date.now(), data: { ...JSON.parse(env.PORTAL_CLIENTS || "{}"), ...extra } };
  return rosterCache.data;
}
function roster(env, raw) {
  raw = raw || JSON.parse(env.PORTAL_CLIENTS || "{}");
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
    r = roster(env, await loadRoster(env));
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

// ---- daily log + weekly check-ins (stored privately in the same R2 bucket, under _data/) ----
// _data/<id>/log/<YYYY-MM>.json   {"2026-11-21": {weight:"80.2", steps:"9000", ...}}
// _data/<id>/checkins.json        {"2026-11-23": {answers:[...], stats:{...}, at:"..."}}
// _data/<id>/summary.json         {weights:{date:kg}, logged:[dates], checkins:{due:at}}
const QUESTIONS = [
  "📸 Progress: any changes you've noticed physically, in your photos, measurements or how your clothes fit?",
  "💪 Training: how many sessions did you get in? How is performance, strength and progression?",
  "🏃 Cardio: are you completing what's currently programmed?",
  "🥗 Nutrition: how closely are you sticking to your calories and macros? Any issues with hunger, cravings or adherence?",
  "🥩 Protein: are you consistently hitting your protein target?",
  "😴 Sleep and energy: how is your sleep quality, your general energy and your recovery?",
  "😮‍💨 Stress: how have your stress levels been, and how are you managing them?",
  "🧠 Mindset: how are you feeling about the plan, your progress and your motivation?",
  "📅 Anything that might affect your weight this week? For example your period, illness, a holiday or meals out.",
  "🏆 Win: tell me something that's gone well this week, gym or non-gym related.",
  "🚧 Struggle: what's been the biggest thing getting in your way?",
  "🎯 Focus: what do you think you need to improve over the next week?",
  "🙋‍♀️ From me: is there anything you need help with, want me to look at, or think we need to adjust?",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 864e5;
const dkey = (id) => `_data/${id}`;
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
const toT = (s) => Date.parse(s + "T00:00:00Z");
const fromT = (t) => new Date(t).toISOString().slice(0, 10);
function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function checkinDay(c) {
  const d = c.checkin || (c.type === "pt" ? "Sunday" : "Wednesday");
  return DAYS.includes(d) ? d : "Sunday";
}
// most recent check-in date on or before `today`
function lastDue(c, today) {
  const t = toT(today), want = DAYS.indexOf(checkinDay(c)), wd = new Date(t).getUTCDay();
  return fromT(t - ((wd - want + 7) % 7) * DAY_MS);
}
async function getJSON(env, key, dflt) {
  const o = await env.PHOTOS.get(key);
  if (!o) return dflt;
  try { return await o.json(); } catch (e) { return dflt; }
}
const putJSON = (env, key, v) => env.PHOTOS.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
function cleanDay(data) {
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(data || {})) {
    if (!/^[a-zA-Z0-9]{1,24}$/.test(k) || n >= 40 || v === null || v === undefined) continue;
    const s = String(v).trim().slice(0, k === "notes" ? 2000 : 120);
    if (s === "") continue;
    out[k] = s;
    n++;
  }
  return out;
}
async function readLog(env, id, from, to) {
  const days = {};
  let t = toT(from.slice(0, 7) + "-01");
  const end = toT(to);
  for (let i = 0; i < 7 && t <= end; i++) {
    const m = fromT(t).slice(0, 7);
    const doc = await getJSON(env, `${dkey(id)}/log/${m}.json`, {});
    for (const [d, v] of Object.entries(doc)) if (d >= from && d <= to) days[d] = v;
    const dt = new Date(t);
    t = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
  }
  return days;
}
const num = (v) => {
  const n = parseFloat(String(v || "").replace(/,/g, ""));
  return isNaN(n) ? null : n;
};
function hours(v) { // "7:45" or "7.75" -> 7.75
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2})[:.h ](\d{2})$/);
  if (m && s.includes(":")) return +m[1] + +m[2] / 60;
  return num(s);
}
function weekStats(days, end) {
  const out = { daysLogged: 0 };
  const sums = { weight: [], steps: [], cals: [], sleep: [], protein: [] };
  for (let i = 0; i < 7; i++) {
    const d = days[fromT(toT(end) - i * DAY_MS)];
    if (!d) continue;
    out.daysLogged++;
    const w = num(d.weight); if (w) sums.weight.push(w);
    const st = num(d.steps); if (st !== null) sums.steps.push(st);
    let cal = num(d.cals);
    if (cal === null && (d.carbs || d.protein || d.fat)) cal = 4 * (num(d.carbs) || 0) + 4 * (num(d.protein) || 0) + 9 * (num(d.fat) || 0);
    if (cal) sums.cals.push(cal);
    const sl = hours(d.sleep); if (sl) sums.sleep.push(sl);
    const p = num(d.protein); if (p) sums.protein.push(p);
  }
  const avg = (a, dp) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(dp) : null);
  out.weight = avg(sums.weight, 1); out.steps = avg(sums.steps, 0); out.cals = avg(sums.cals, 0);
  out.sleep = avg(sums.sleep, 1); out.protein = avg(sums.protein, 0);
  return out;
}
async function saveDay(env, c, date, data) {
  const key = `${dkey(c.id)}/log/${date.slice(0, 7)}.json`;
  const doc = await getJSON(env, key, {});
  const clean = cleanDay(data);
  if (Object.keys(clean).length) doc[date] = { ...clean, _at: new Date().toISOString() };
  else delete doc[date];
  await putJSON(env, key, doc);
  const sk = `${dkey(c.id)}/summary.json`;
  const s = await getJSON(env, sk, {});
  s.weights = s.weights || {};
  s.logged = s.logged || [];
  const w = num(clean.weight);
  if (w && w > 20 && w < 400) s.weights[date] = w; else delete s.weights[date];
  const set = new Set(s.logged);
  if (doc[date]) set.add(date); else set.delete(date);
  s.logged = [...set].sort().slice(-120);
  const wd = Object.keys(s.weights).sort();
  if (wd.length > 500) for (const d of wd.slice(0, wd.length - 500)) delete s.weights[d];
  await putJSON(env, sk, s);
  return doc[date] || null;
}
const summaryWeights = (s) => Object.keys((s && s.weights) || {}).sort().map((d) => ({ date: d, kg: s.weights[d] }));
function checkinStatus(c, s, today) {
  const ci = s.checkins || {};
  const due = lastDue(c, today), next = fromT(toT(due) + 7 * DAY_MS), day = checkinDay(c);
  if (ci[next]) return { due: next, done: true, day };
  if (ci[due]) return { due, done: true, day };
  if (due === today) return { due, done: false, dueToday: true, day };
  if (c.start && due < c.start) return { due: next, done: false, upcoming: true, missed: null, day };
  if ((toT(today) - toT(due)) / DAY_MS <= 3) return { due, done: false, late: true, day };
  return { due: next, done: false, upcoming: true, missed: c.start && due < c.start ? null : due, day };
}

// ---- training programmes: _data/<id>/programmes.json  {current:"<pid>", programmes:[{id,title,notes,workouts,created,updated}]} ----
const EX_KEYS = ["ss", "name", "sets", "reps", "tempo", "rir", "rest", "notes"];
function cleanProgrammes(doc) {
  const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const now = new Date().toISOString();
  const programmes = (Array.isArray(doc && doc.programmes) ? doc.programmes : []).slice(0, 30).map((p) => ({
    id: str(p.id, 40).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10),
    title: str(p.title, 80) || "Programme",
    notes: str(p.notes, 3000), goal: str(p.goal, 120), schedule: str(p.schedule, 400),
    created: str(p.created, 30) || now,
    updated: str(p.updated, 30) || now,
    workouts: (Array.isArray(p.workouts) ? p.workouts : []).slice(0, 14).map((w) => ({
      name: str(w.name, 80) || "Workout",
      notes: str(w.notes, 1500), focus: str(w.focus, 160),
      exercises: (Array.isArray(w.exercises) ? w.exercises : []).slice(0, 40)
        .map((e) => Object.fromEntries(EX_KEYS.map((k) => [k, str(e && e[k], k === "notes" ? 400 : 80)])))
        .filter((e) => EX_KEYS.some((k) => e[k])),
    })),
  }));
  const current = programmes.some((p) => p.id === doc.current) ? doc.current : (programmes[0] ? programmes[0].id : "");
  return { current, programmes };
}

// ---- daily targets set by the coach: _data/<id>/targets.json ----
const TARGET_KEYS = ["cals", "protein", "carbs", "fat", "steps", "water", "cardio", "sleep", "notes"];
function cleanTargets(t) {
  const out = {};
  for (const k of TARGET_KEYS) {
    const v = String((t && t[k]) == null ? "" : t[k]).trim().slice(0, k === "notes" ? 1500 : 40);
    if (v) out[k] = v;
  }
  out.updated = new Date().toISOString();
  return out;
}

// ---- meal plans: _data/<id>/mealplans.json {current, plans:[{id,title,notes,created,updated,days:[{name,notes,meals:[{name,notes,foods:[...]}]}]}]} ----
function cleanMealplans(doc) {
  const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const numS = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isNaN(x) ? "" : String(Math.round(x * 10) / 10); };
  const now = new Date().toISOString();
  const plans = (Array.isArray(doc && doc.plans) ? doc.plans : []).slice(0, 30).map((p) => ({
    id: str(p.id, 40).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10),
    title: str(p.title, 80) || "Meal plan", notes: str(p.notes, 3000),
    created: str(p.created, 30) || now, updated: str(p.updated, 30) || now,
    days: (Array.isArray(p.days) ? p.days : []).slice(0, 7).map((d) => ({
      name: str(d.name, 60) || "Day", notes: str(d.notes, 1500),
      meals: (Array.isArray(d.meals) ? d.meals : []).slice(0, 10).map((m) => ({
        name: str(m.name, 60) || "Meal", notes: str(m.notes, 800),
        foods: (Array.isArray(m.foods) ? m.foods : []).slice(0, 20).map((f) => ({
          food: str(f.food, 80), amount: numS(f.amount), unit: str(f.unit, 20),
          kcal: numS(f.kcal), p: numS(f.p), c: numS(f.c), f: numS(f.f),
        })).filter((f) => f.food),
      })),
    })),
  }));
  const current = plans.some((p) => p.id === doc.current) ? doc.current : (plans[0] ? plans[0].id : "");
  return { current, plans };
}
function cleanForm(body) {
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(body || {})) {
    if (!/^[a-z0-9_]{1,30}$/i.test(k) || n++ > 120) continue;
    out[k] = Array.isArray(v) ? v.slice(0, 20).map((x) => String(x).slice(0, 200)) : String(v == null ? "" : v).slice(0, 3000);
  }
  return out;
}

async function readWorkouts(env, id, daysBack) {
  const out = [], today = londonToday();
  let t = toT(fromT(toT(today) - daysBack * DAY_MS).slice(0, 7) + "-01");
  for (let i = 0; i < 6 && t <= toT(today); i++) {
    const doc = await getJSON(env, `${dkey(id)}/workouts/${fromT(t).slice(0, 7)}.json`, {});
    for (const [d, list] of Object.entries(doc)) for (const sss of list) out.push(sss);
    const dt = new Date(t);
    t = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.at < b.at ? 1 : -1));
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
      client: { ...pub, checkin: checkinDay(client), type: client.type === "pt" ? "pt" : "online" }, week: weekOf(client.start), photos: !!env.PHOTOS, today: londonToday(),
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
        "cache-control": "private, no-store",
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
    if (!env.PHOTOS) return json({ enabled: false, weights: [] });
    const sm = await getJSON(env, `${dkey(client.id)}/summary.json`, {});
    return json({ enabled: true, weights: summaryWeights(sm) });
  }


  // ---- daily log ----
  if (path === "/portal/api/log" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    const today = londonToday();
    const to = isDate(url.searchParams.get("to")) ? url.searchParams.get("to") : today;
    let from = isDate(url.searchParams.get("from")) ? url.searchParams.get("from") : fromT(toT(to) - 20 * DAY_MS);
    if (toT(to) - toT(from) > 120 * DAY_MS) from = fromT(toT(to) - 120 * DAY_MS);
    return json({ today, from, to, days: await readLog(env, client.id, from, to) });
  }
  if (path === "/portal/api/log" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    const body = await request.json().catch(() => ({}));
    const today = londonToday();
    if (!isDate(body.date)) return json({ error: "date" }, 400);
    const age = (toT(today) - toT(body.date)) / DAY_MS;
    if (age < -1 || age > 62) return json({ error: "date" }, 400);
    const saved = await saveDay(env, client, body.date, body.data);
    return json({ ok: true, date: body.date, day: saved });
  }

  // ---- weekly check-in ----
  if (path === "/portal/api/checkins" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    const today = londonToday();
    const all = await getJSON(env, `${dkey(client.id)}/checkins.json`, {});
    return json({ today, day: checkinDay(client), lastDue: lastDue(client, today), questions: QUESTIONS, checkins: all });
  }
  if (path === "/portal/api/checkin" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    const body = await request.json().catch(() => ({}));
    const today = londonToday();
    const due = body.due;
    if (!isDate(due) || DAYS[new Date(toT(due)).getUTCDay()] !== checkinDay(client)) return json({ error: "due" }, 400);
    const diff = (toT(due) - toT(today)) / DAY_MS;
    if (diff < -10 || diff > 7) return json({ error: "due" }, 400);
    const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, QUESTIONS.length).map((a) => String(a || "").slice(0, 3000));
    const days = await readLog(env, client.id, fromT(toT(due) - 13 * DAY_MS), due);
    const stats = weekStats(days, due);
    const prev = weekStats(days, fromT(toT(due) - 7 * DAY_MS));
    stats.change = stats.weight && prev.weight ? +(stats.weight - prev.weight).toFixed(1) : null;
    const key = `${dkey(client.id)}/checkins.json`;
    const all = await getJSON(env, key, {});
    all[due] = { answers, questions: QUESTIONS, stats, at: new Date().toISOString() };
    await putJSON(env, key, all);
    const sk = `${dkey(client.id)}/summary.json`;
    const sm = await getJSON(env, sk, {});
    sm.checkins = sm.checkins || {};
    sm.checkins[due] = all[due].at;
    await putJSON(env, sk, sm);
    return json({ ok: true, due, checkin: all[due] });
  }

  // ---- training programme ----
  if (path === "/portal/api/programme" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    return json(await getJSON(env, `${dkey(client.id)}/programmes.json`, { current: "", programmes: [] }));
  }

  // ---- profile photo: _data/<id>/avatar ----
  if (path === "/portal/api/avatar" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    const form = await request.formData();
    const file = form.get("photo");
    if (!file || typeof file === "string" || !/^image\/(jpeg|png|webp)$/.test(file.type)) return json({ error: "type" }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: "size" }, 413);
    await env.PHOTOS.put(`${dkey(client.id)}/avatar`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { at: String(Date.now()) } });
    return json({ ok: true, v: Date.now() });
  }
  if ((path === "/portal/api/avatar" && request.method === "DELETE")) {
    if (!client) return json({ error: "unknown" }, 403);
    await env.PHOTOS.delete(`${dkey(client.id)}/avatar`);
    return json({ ok: true });
  }
  if (path === "/portal/api/avatar" || path === "/portal/api/coach/avatar") {
    let id;
    if (path === "/portal/api/avatar") { if (!client) return json({ error: "unknown" }, 403); id = client.id; }
    else { if (!coach) return json({ error: "forbidden" }, 403); id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, ""); }
    const obj = await env.PHOTOS.get(`${dkey(id)}/avatar`);
    if (!obj) return new Response("", { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "image/jpeg", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  }

  // ---- first-login setup checklist: _data/<id>/setup.json {done:{key:at}, completed:at} ----
  if (path === "/portal/api/setup") {
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/setup.json`;
    const st = await getJSON(env, key, { done: {}, completed: null });
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (typeof b.key === "string" && /^[a-z]{2,20}$/.test(b.key)) {
        if (b.done) st.done[b.key] = new Date().toISOString(); else delete st.done[b.key];
      }
      if (b.complete === true) st.completed = st.completed || new Date().toISOString();
      await putJSON(env, key, st);
    }
    return json({ ...st, skip: client.onboarded === true });
  }

  if (path === "/portal/api/targets") {
    if (!client) return json({ error: "unknown" }, 403);
    return json({ targets: await getJSON(env, `${dkey(client.id)}/targets.json`, null) });
  }

  // ---- onboarding form, plan status, meal plans (client) ----
  if (path === "/portal/api/onboarding") {
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/onboarding.json`;
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const prevDoc = await getJSON(env, key, {});
      const doc = { answers: cleanForm(b.answers), submitted: b.submit === true ? new Date().toISOString() : (prevDoc.submitted || null), updated: new Date().toISOString() };
      await putJSON(env, key, doc);
      if (b.submit === true && !prevDoc.submitted) await notifyForm(env, client, doc.answers).catch(() => {});
      return json({ ok: true, ...doc });
    }
    return json(await getJSON(env, key, { answers: {}, submitted: null }));
  }
  // consents: health data, terms, and (separately) permission to post photos on social media
  if (path === "/portal/api/consent") {
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/consent.json`;
    const cur = await getJSON(env, key, {});
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const now = new Date().toISOString();
      const next = { ...cur, history: (cur.history || []).slice(-50) };
      if (b.health === true && !cur.health) next.health = now;
      if (b.terms === true && !cur.terms) next.terms = now;
      if (b.photos === "yes" || b.photos === "no") {
        if (b.photos !== cur.photos) next.history.push({ photos: b.photos, at: now });
        next.photos = b.photos; next.photosAt = now;
      }
      await putJSON(env, key, next);
      const { history, ...pub } = next;
      return json({ ok: true, ...pub });
    }
    const { history, ...pub } = cur;
    return json(pub);
  }
  if (path === "/portal/api/plan") {
    if (!client) return json({ error: "unknown" }, 403);
    return json(await getJSON(env, `${dkey(client.id)}/plan.json`, { ready: client.onboarded === true }));
  }
  if (path === "/portal/api/mealplans") {
    if (!client) return json({ error: "unknown" }, 403);
    return json(await getJSON(env, `${dkey(client.id)}/mealplans.json`, { current: "", plans: [] }));
  }

  // ---- workout log (weights and reps per set): _data/<id>/workouts/<YYYY-MM>.json {date:[session,...]} ----
  if (path === "/portal/api/workouts" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    return json({ sessions: await readWorkouts(env, client.id, 120) });
  }
  if (path === "/portal/api/workout" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    const b = await request.json().catch(() => ({}));
    const today = londonToday();
    if (!isDate(b.date) || (toT(today) - toT(b.date)) / DAY_MS > 30 || toT(b.date) > toT(today) + DAY_MS) return json({ error: "date" }, 400);
    const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
    const sess = {
      id: str(b.id, 20).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10),
      date: b.date, programme: str(b.programme, 80), workout: str(b.workout, 80), notes: str(b.notes, 1500), at: new Date().toISOString(),
      exercises: (Array.isArray(b.exercises) ? b.exercises : []).slice(0, 40).map((e) => ({
        name: str(e.name, 80), ss: str(e.ss, 6), notes: str(e.notes, 600),
        sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 12).map((x) => ({ kg: str(x.kg, 10), reps: str(x.reps, 10), done: !!x.done })),
      })),
    };
    const key = `${dkey(client.id)}/workouts/${b.date.slice(0, 7)}.json`;
    const doc = await getJSON(env, key, {});
    const list = (doc[b.date] || []).filter((x) => x.id !== sess.id);
    if (b.delete !== true) list.push(sess);
    if (list.length) doc[b.date] = list; else delete doc[b.date];
    await putJSON(env, key, doc);
    return json({ ok: true, session: b.delete === true ? null : sess });
  }

  // ---- coach ----
  if (path === "/portal/api/coach/clients") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const acu = await acuityBookings(env).catch(() => null);
    const emailsOf = (id) => Object.entries(r).filter(([, x]) => x.id === id).map(([e]) => e.toLowerCase());
    const seen = new Set();
    const uniq = Object.values(r).filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    const one = async (c) => {
      let photos = [];
      if (env.PHOTOS) photos = await listPhotos(env, c.id);
      const week = weekOf(c.start);
      const today = londonToday();
      const sm = await getJSON(env, `${dkey(c.id)}/summary.json`, {});
      const logged = sm.logged || [];
      const weekAgo = fromT(toT(today) - 6 * DAY_MS);
      const wts = summaryWeights(sm);
      const setup = c.onboarded === true ? { skip: true } : await getJSON(env, `${dkey(c.id)}/setup.json`, { done: {}, completed: null });
      const thisWeek = photos.filter((p) => p.week === week).map((p) => p.angle);
      return ({
        id: c.id, name: c.name, phase: c.phase || "", checkin: checkinDay(c), start: c.start || "",
        type: c.type === "pt" ? "pt" : "online", phone: String(c.phone || "").replace(/[^0-9]/g, ""),
        lastLog: logged[logged.length - 1] || "", loggedWeek: logged.filter((d) => d >= weekAgo && d <= today).length,
        lastWeight: wts.length ? wts[wts.length - 1] : null, check: checkinStatus(c, sm, today),
        setup: setup.skip ? { done: true } : { done: !!setup.completed, n: Object.keys(setup.done || {}).length },
        form: c.onboarded === true ? null : !!(await getJSON(env, `${dkey(c.id)}/onboarding.json`, {})).submitted,
        planReady: c.onboarded === true ? true : !!(await getJSON(env, `${dkey(c.id)}/plan.json`, {})).ready,
        active: c.active !== false, week, tracker: c.tracker || "", folder: c.folder || "",
        photosThisWeek: [...new Set(thisWeek)], lastUpload: photos.reduce((m, p) => (p.uploaded > m ? p.uploaded : m), ""),
        photoCount: photos.length,
        lastCheckin: Object.keys(sm.checkins || {}).sort().pop() || "",
        pt: acu ? emailsOf(c.id).reduce((m, e) => { const b = acu[e]; if (!b) return m; return { last: b.last > m.last ? b.last : m.last, next: !m.next || (b.next && b.next < m.next) ? b.next || m.next : m.next }; }, { last: "", next: "" }) : null,
        consent: await (async () => { const k = await getJSON(env, `${dkey(c.id)}/consent.json`, {}); return { health: !!k.health, terms: !!k.terms, photos: k.photos || "" }; })(),
      });
    };
    const list = [];
    for (let i = 0; i < uniq.length; i += 12) list.push(...(await Promise.all(uniq.slice(i, i + 12).map(one))));
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
    const sm = await getJSON(env, `${dkey(c.id)}/summary.json`, {});
    return json({ enabled: true, weights: summaryWeights(sm) });
  }


  if (path === "/portal/api/coach/log") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    const today = londonToday();
    const to = isDate(url.searchParams.get("to")) ? url.searchParams.get("to") : today;
    let from = isDate(url.searchParams.get("from")) ? url.searchParams.get("from") : fromT(toT(to) - 27 * DAY_MS);
    if (toT(to) - toT(from) > 180 * DAY_MS) from = fromT(toT(to) - 180 * DAY_MS);
    return json({ today, from, to, days: await readLog(env, c.id, from, to) });
  }

  if (path === "/portal/api/coach/checkins") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    return json({ day: checkinDay(c), checkins: await getJSON(env, `${dkey(c.id)}/checkins.json`, {}) });
  }



  // ---- coach: bulk import a client's history (from their old Google Sheet) ----
  if (path === "/portal/api/coach/import" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "bad" }, 400);
    const inDays = body.days || {}, byMonth = {}, all = {};
    for (const [d, v] of Object.entries(inDays)) {
      if (!isDate(d)) continue;
      const clean = cleanDay(v);
      if (!Object.keys(clean).length) continue;
      (byMonth[d.slice(0, 7)] = byMonth[d.slice(0, 7)] || {})[d] = { ...clean, _at: "imported" };
    }
    const sk = `${dkey(c.id)}/summary.json`;
    const sm = await getJSON(env, sk, {});
    sm.weights = sm.weights || {};
    const logged = new Set(sm.logged || []);
    for (const [m, days] of Object.entries(byMonth)) {
      const key = `${dkey(c.id)}/log/${m}.json`;
      const doc = await getJSON(env, key, {});
      for (const [d, v] of Object.entries(days)) if (!doc[d] || doc[d]._at === "imported") doc[d] = v; // never overwrite what the client logged in the portal
      await putJSON(env, key, doc);
      for (const [d, v] of Object.entries(doc)) {
        all[d] = v;
        logged.add(d);
        const w = num(v.weight);
        if (w && w > 20 && w < 400) sm.weights[d] = w;
      }
    }
    sm.logged = [...logged].sort().slice(-400);
    let nci = 0;
    if (body.checkins && typeof body.checkins === "object") {
      const ck = `${dkey(c.id)}/checkins.json`;
      const cis = await getJSON(env, ck, {});
      sm.checkins = sm.checkins || {};
      for (const [due, answers] of Object.entries(body.checkins)) {
        if (!isDate(due) || !Array.isArray(answers) || cis[due]) continue;
        const stats = weekStats(all, due), prev = weekStats(all, fromT(toT(due) - 7 * DAY_MS));
        stats.change = stats.weight && prev.weight ? +(stats.weight - prev.weight).toFixed(1) : null;
        cis[due] = { answers: answers.slice(0, QUESTIONS.length).map((a) => String(a || "").slice(0, 3000)), questions: QUESTIONS, stats, at: due + "T12:00:00.000Z", imported: true };
        sm.checkins[due] = cis[due].at;
        nci++;
      }
      await putJSON(env, ck, cis);
    }
    await putJSON(env, sk, sm);
    return json({ ok: true, days: Object.values(byMonth).reduce((n, m) => n + Object.keys(m).length, 0), checkins: nci });
  }

  // ---- coach: client list kept in R2 ----
  if (path === "/portal/api/coach/roster") {
    if (!coach) return json({ error: "forbidden" }, 403);
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "bad" }, 400);
      const clean = {};
      for (const [email, c] of Object.entries(body)) {
        const e = String(email).trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) || !c || !c.id || !c.name) continue;
        clean[e] = {
          id: String(c.id).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40), name: String(c.name).slice(0, 60),
          checkin: DAYS.includes(c.checkin) ? c.checkin : (c.type === "pt" ? "Sunday" : "Wednesday"),
          start: isDate(c.start) ? c.start : londonToday(), phase: String(c.phase || "").slice(0, 40),
          active: c.active !== false, type: c.type === "pt" ? "pt" : "online", sex: c.sex === "m" ? "m" : "f",
          onboarded: c.onboarded === true, phone: String(c.phone || "").replace(/[^0-9]/g, "").slice(0, 15),
          folder: String(c.folder || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80),
        };
      }
      const old = await getJSON(env, "_data/_roster.json", null);
      if (old) await putJSON(env, `_data/_roster-backup/${Date.now()}.json`, old);
      await putJSON(env, "_data/_roster.json", clean);
      await loadRoster(env, true);
      return json({ ok: true, count: Object.keys(clean).length });
    }
    return json({ roster: await getJSON(env, "_data/_roster.json", {}), secret: Object.keys(JSON.parse(env.PORTAL_CLIENTS || "{}")), secretClients: JSON.parse(env.PORTAL_CLIENTS || "{}") });
  }

  if (path === "/portal/api/coach/targets") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    const key = `${dkey(c.id)}/targets.json`;
    if (request.method === "POST") {
      const t = cleanTargets(await request.json().catch(() => ({})));
      const old = await getJSON(env, key, null);
      if (old) {
        const hist = await getJSON(env, `${dkey(c.id)}/targets-history.json`, []);
        hist.push(old);
        await putJSON(env, `${dkey(c.id)}/targets-history.json`, hist.slice(-50));
      }
      await putJSON(env, key, t);
      return json({ ok: true, targets: t });
    }
    return json({ targets: await getJSON(env, key, null) });
  }

  if (path === "/portal/api/coach/onboarding" || path === "/portal/api/coach/plan" || path === "/portal/api/coach/mealplans") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    if (path === "/portal/api/coach/onboarding") return json(await getJSON(env, `${dkey(c.id)}/onboarding.json`, { answers: {}, submitted: null }));
    if (path === "/portal/api/coach/plan") {
      const key = `${dkey(c.id)}/plan.json`;
      if (request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const doc = { ready: b.ready === true, at: new Date().toISOString() };
        await putJSON(env, key, doc);
        return json({ ok: true, ...doc });
      }
      return json(await getJSON(env, key, { ready: c.onboarded === true }));
    }
    const key = `${dkey(c.id)}/mealplans.json`;
    if (request.method === "POST") {
      const doc = cleanMealplans(await request.json().catch(() => ({})));
      const old = await getJSON(env, key, null);
      if (old) await putJSON(env, `${dkey(c.id)}/mealplans-backup/${Date.now()}.json`, old);
      await putJSON(env, key, doc);
      return json({ ok: true, ...doc });
    }
    return json(await getJSON(env, key, { current: "", plans: [] }));
  }
  if (path === "/portal/api/coach/mealtemplates") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const key = `${dkey("_templates")}/mealplans.json`;
    if (request.method === "POST") {
      const doc = cleanMealplans(await request.json().catch(() => ({})));
      const old = await getJSON(env, key, null);
      if (old) await putJSON(env, `${dkey("_templates")}/meal-backup/${Date.now()}.json`, old);
      await putJSON(env, key, doc);
      return json({ ok: true, ...doc });
    }
    return json(await getJSON(env, key, { current: "", plans: [] }));
  }

  if (path === "/portal/api/coach/workouts") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    return json({ sessions: await readWorkouts(env, c.id, 120) });
  }
  if (path === "/portal/api/coach/templates") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const key = `${dkey("_templates")}/programmes.json`;
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "bad" }, 400);
      const doc = cleanProgrammes(body);
      const old = await getJSON(env, key, null);
      if (old) await putJSON(env, `${dkey("_templates")}/backup/${Date.now()}.json`, old);
      await putJSON(env, key, doc);
      return json({ ok: true, ...doc });
    }
    return json(await getJSON(env, key, { current: "", programmes: [] }));
  }
  if (path === "/portal/api/coach/programmes") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    const key = `${dkey(c.id)}/programmes.json`;
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "bad" }, 400);
      const doc = cleanProgrammes(body);
      const old = await getJSON(env, key, null);
      if (old) await putJSON(env, `${dkey(c.id)}/programmes-backup/${Date.now()}.json`, old); // every previous version is kept
      await putJSON(env, key, doc);
      return json({ ok: true, ...doc });
    }
    return json(await getJSON(env, key, { current: "", programmes: [] }));
  }

  return json({ error: "not found" }, 404);
}

// ---- email Maria when a new client sends their onboarding form (Cloudflare Email Routing send_email binding) ----
async function notifyForm(env, client, a) {
  if (!env.MAILER || !env.NOTIFY_TO || !env.NOTIFY_FROM) return;
  const { EmailMessage } = await import("cloudflare:email");
  const flags = [];
  for (let i = 1; i <= 7; i++) if (a["pq" + i] === "Yes") flags.push("PAR-Q question " + i + " answered YES");
  if (a.ed && a.ed !== "No") flags.push("Eating disorder question: " + a.ed);
  if (a.pregnant && !/^(No|Not applicable)$/.test(a.pregnant)) flags.push("Pregnancy: " + a.pregnant);
  const kind = client.type === "pt" ? "Face to face" : "Online";
  const lines = [
    `${client.name} (${kind}) has sent their onboarding form.`, "",
    flags.length ? "Please check:\n- " + flags.join("\n- ") + "\n" : "No health flags.\n",
    `Goal: ${a.goal || "-"}`, `Weight: ${a.weight || "-"} kg, height ${a.height || "-"} cm, goal weight ${a.goalweight || "-"} kg`,
    `Job: ${a.job || "-"} (${a.jobactivity || "-"})`, `Training days: ${a.days || "-"}`, "",
    "Open your coach view to see everything and build their plan:", "https://mpfcoaching.co.uk/portal/coach/",
  ];
  const subj = `New onboarding form: ${client.name} (${kind})`;
  const raw = [
    `From: MPF Client Portal <${env.NOTIFY_FROM}>`, `To: ${env.NOTIFY_TO}`, `Subject: ${subj.replace(/[\r\n]/g, " ")}`,
    `Message-ID: <${crypto.randomUUID()}@${env.NOTIFY_FROM.split("@")[1]}>`, `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", lines.join("\r\n"),
  ].join("\r\n");
  await env.MAILER.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw));
}

// ---- PT bookings from Acuity (optional: needs ACUITY_USER_ID + ACUITY_API_KEY secrets) ----
let acuityCache = null;
async function acuityBookings(env) {
  if (!env.ACUITY_USER_ID || !env.ACUITY_API_KEY) return null;
  if (acuityCache && Date.now() - acuityCache.at < 10 * 60 * 1000) return acuityCache.data;
  const today = londonToday();
  const qs = new URLSearchParams({ minDate: fromT(toT(today) - 90 * DAY_MS), maxDate: fromT(toT(today) + 90 * DAY_MS), max: "2500" });
  const res = await fetch("https://acuityscheduling.com/api/v1/appointments?" + qs, {
    headers: { authorization: "Basic " + btoa(env.ACUITY_USER_ID + ":" + env.ACUITY_API_KEY) },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const appts = await res.json();
  const by = {};
  for (const a of Array.isArray(appts) ? appts : []) {
    if (a.canceled) continue;
    const e = String(a.email || "").trim().toLowerCase(), d = String(a.datetime || "").slice(0, 10);
    if (!e || !d) continue;
    const b = (by[e] = by[e] || { last: "", next: "" });
    if (d <= today) { if (d > b.last) b.last = d; } else if (!b.next || d < b.next) b.next = d;
  }
  acuityCache = { at: Date.now(), data: by };
  return by;
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
