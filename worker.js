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
  if (!fresh && rosterCache && rosterCache.data && Date.now() - rosterCache.at < 30000) return rosterCache.data;
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
    if (c && c.deleted) continue;
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
  // coach "line up" settings (zoom and position per photo) so bodies match in size side by side
  const al = await getJSON(env, `_data/${id}/photo-align.json`, {});
  for (const p of out) if (al[p.key]) p.align = al[p.key];
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
// Maintenance calories (Katch-McArdle): BMR = 370 + 21.6 x lean mass (kg), x activity (default 1.55: training 3-5x a week + steps)
async function bodyInfo(env, c, body) {
  const ws = summaryWeights(await getJSON(env, `${dkey(c.id)}/summary.json`, {})), last = ws[ws.length - 1];
  const ob = (await getJSON(env, `${dkey(c.id)}/onboarding.json`, { answers: {} })).answers || {};
  const tg = await getJSON(env, `${dkey(c.id)}/targets.json`, null);
  const kg = last ? Number(last.kg) : Number(ob.weight || 0) || 0, bf = Number(body.bf) || 0, act = Number(body.activity) || 1.55;
  let maint = null, bmr = null, lean = null;
  if (kg > 0 && bf > 0) { lean = Math.round(kg * (1 - bf / 100) * 10) / 10; bmr = Math.round(370 + 21.6 * lean); maint = Math.round((bmr * act) / 10) * 10; }
  return { weight: kg || null, weightDate: last ? last.date : "", bf: body.bf || "", bfAt: body.at || "", activity: String(act), lean, bmr, maintenance: maint,
    goal: ob.goal || "", goalweight: ob.goalweight || "", phase: c.phase || "", cals: tg && tg.cals ? tg.cals : "", history: (body.history || []).slice(-12) };
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
const EX_KEYS = ["ss", "name", "sets", "reps", "tempo", "rir", "rest", "notes", "opts"]; // opts: "pick one" choices, comma separated
function cleanProgrammes(doc) {
  const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const now = new Date().toISOString();
  const programmes = (Array.isArray(doc && doc.programmes) ? doc.programmes : []).slice(0, 30).map((p) => ({
    id: str(p.id, 40).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10),
    title: str(p.title, 80) || "Programme",
    notes: str(p.notes, 3000), goal: str(p.goal, 120), schedule: str(p.schedule, 400), folder: str(p.folder, 40),
    created: str(p.created, 30) || now,
    updated: str(p.updated, 30) || now,
    workouts: (Array.isArray(p.workouts) ? p.workouts : []).slice(0, 14).map((w) => ({
      name: str(w.name, 80) || "Workout",
      notes: str(w.notes, 1500), focus: str(w.focus, 160),
      exercises: (Array.isArray(w.exercises) ? w.exercises : []).slice(0, 40)
        .map((e) => Object.fromEntries(EX_KEYS.map((k) => [k, str(e && e[k], k === "notes" || k === "opts" ? 400 : 80)])))
        .filter((e) => EX_KEYS.some((k) => e[k])),
    })),
  }));
  const current = programmes.some((p) => p.id === doc.current) ? doc.current : (programmes[0] ? programmes[0].id : "");
  return { current, programmes };
}

// ---- daily targets set by the coach: _data/<id>/targets.json ----
const TARGET_KEYS = ["cals", "protein", "carbs", "fat", "steps", "water", "cardio", "sleep", "notes", "hlOn", "hiCals", "hiP", "hiC", "hiF", "loCals", "loP", "loC", "loF", "hiDays"];
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
    title: str(p.title, 80) || "Meal plan", notes: str(p.notes, 3000), folder: str(p.folder, 40),
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
  for (let i = 0; i < 15 && t <= toT(today); i++) {
    const doc = await getJSON(env, `${dkey(id)}/workouts/${fromT(t).slice(0, 7)}.json`, {});
    for (const [d, list] of Object.entries(doc)) for (const sss of list) out.push(sss);
    const dt = new Date(t);
    t = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.at < b.at ? 1 : -1));
}

// ---- extra numbers for a check-in week (coach queue + AI drafts) ----
async function weekExtra(env, c, due, sm) {
  const from = fromT(toT(due) - 13 * DAY_MS);
  const days = await readLog(env, c.id, from, due);
  const cur = weekStats(days, due), pv = weekStats(days, fromT(toT(due) - 7 * DAY_MS));
  const wk = []; for (let i = 0; i < 7; i++) { const d = days[fromT(toT(due) - i * DAY_MS)]; if (d) wk.push(d); }
  const yes = (k) => wk.filter((d) => String(d[k] || "").toLowerCase() === "yes").length;
  const avg = (k, dp) => { const a = wk.map((d) => num(d[k])).filter((x) => x !== null); return a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(dp) : null; };
  const sum = (k) => { const a = wk.map((d) => num(d[k])).filter((x) => x !== null); return a.length ? Math.round(a.reduce((x, y) => x + y, 0)) : null; };
  const ws = summaryWeights(sm || {}), first = ws[0], last = ws[ws.length - 1];
  let photos = null;
  try { const lo = toT(due) - 7 * DAY_MS, hi = toT(due) + 3 * DAY_MS; photos = (await listPhotos(env, c.id)).filter((p) => { const t = Date.parse(p.uploaded); return t >= lo && t <= hi; }).length; } catch (e) {}
  return {
    wChange: cur.weight && pv.weight ? +(cur.weight - pv.weight).toFixed(1) : null,
    avgW: cur.weight, prevW: pv.weight,
    startW: first ? first.kg : null, startDate: first ? first.date : null, latestW: last ? last.kg : null,
    totalChange: first && last && first.date !== last.date ? +(last.kg - first.kg).toFixed(1) : null,
    trained: yes("trained"), cardio: sum("cardio"), water: avg("water", 1), offPlan: yes("offPlan"),
    period: c.sex === "m" ? null : yes("period"),
    energy: avg("energy", 1), mood: avg("mood", 1), stress: avg("stress", 1), hunger: avg("hunger", 1), adherence: avg("adherence", 1),
    photos, isNew: (c.tags || []).some((t) => /new client/i.test(t)), sex: c.sex === "m" ? "m" : "f",
  };
}

async function handleApi(request, env, url, ctx) {
  const w = await who(request, env);
  if (w instanceof Response) return w;
  let { email, client, coach, roster: r } = w;
  const path = url.pathname;
  // coach "see what they see": the portal sends X-MPF-As when the coach opens /portal/?as=<id>. Read only.
  const asId = (request.headers.get("x-mpf-as") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (asId && coach) {
    const hit = Object.entries(r).find(([, x]) => x.id === asId);
    if (!hit) return json({ error: "unknown client" }, 404);
    if (request.method !== "GET") return json({ error: "preview", message: "This is a read only preview of the client's portal. Nothing was saved." }, 403);
    email = hit[0]; client = hit[1]; coach = false;
  }
  const lock = client && !coach ? await lockState(env, client, r) : { locked: false };
  if (lock.locked && path.startsWith("/portal/api/") && !["/portal/api/me", "/portal/api/billing", "/portal/api/consent", "/portal/api/delete-request", "/portal/api/prefs"].includes(path))
    return json({ error: "locked", locked: true, reason: lock.reason }, 402);

  if (path === "/portal/api/me") {
    if (!client) return json({ configured: true, signedIn: true, known: false, coach, email });
    const { id, ...pub } = client;
    return json({
      configured: true, signedIn: true, known: true, coach, email,
      client: { ...pub, checkin: checkinDay(client), type: client.type === "pt" ? "pt" : "online" }, paid: client.payOk === true || !!((await getJSON(env, "_data/_payments.json", { byEmail: {} })).byEmail || {})[email], week: weekOf(client.start), photos: !!env.PHOTOS, today: londonToday(), lock,
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
    if (isNaN(week) || week < 0 || week > current) week = current; // week 0 = Start, earlier weeks allowed for old photos
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
    for (const k of Object.keys(all)) if (all[k] && all[k].draft) { all[k] = { ...all[k] }; delete all[k].draft; }
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
    if (env.ANTHROPIC_API_KEY && ctx && !(all[due].reply && all[due].reply.text)) ctx.waitUntil(aiDraft(env, r, client, due).catch(() => {}));
    const safe = { ...all[due] }; delete safe.draft;
    return json({ ok: true, due, checkin: safe });
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
  if (path === "/portal/api/prefs") {
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/prefs.json`, cur = await getJSON(env, key, { reminders: true });
    if (request.method === "POST") { const b = await request.json().catch(() => ({})); if ("reminders" in b) cur.reminders = !!b.reminders; if ("noperiod" in b) { if (b.noperiod) cur.noperiod = true; else delete cur.noperiod; }
      if ("phone" in b) { const ph = String(b.phone || "").replace(/[^0-9+]/g, "").slice(0, 16); if (ph) cur.phone = ph; else delete cur.phone; }
      if ("about" in b) { const ab = String(b.about || "").trim().slice(0, 1000); if (ab) cur.about = ab; else delete cur.about; }
      if (b.food && typeof b.food === "object") { const f = b.food, s = (v, n) => String(v || "").slice(0, n); cur.food = { style: s(f.style, 20), diet: s(f.diet, 10), meals: s(f.meals, 2), ban: (Array.isArray(f.ban) ? f.ban : []).map((x) => s(x, 12)).slice(0, 10), dislike: s(f.dislike, 300), love: s(f.love, 300), at: new Date().toISOString() }; }
      await putJSON(env, key, cur); }
    return json(cur);
  }
  if (path === "/portal/api/delete-request" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    const b = await request.json().catch(() => ({}));
    const doc = { at: new Date().toISOString(), reason: String(b.reason || "").slice(0, 600) };
    await putJSON(env, `${dkey(client.id)}/delete-request.json`, doc);
    await sendMail(env, { subject: `Data deletion request: ${client.name}`, heading: `Deletion request: <em style="color:#e6cf8b">${escH(client.name)}</em>`, lines: [`${client.name} has asked for their portal account and all their data to be deleted.`, "", `Reason: ${doc.reason || "(none given)"}`, "", "Open their profile in the coach view and use Delete client at the bottom. Under UK GDPR you should normally do this within one month."], button: { text: "Open coach view", url: SITE + "/portal/coach/#v=clients" } }).catch(() => {});
    return json({ ok: true });
  }
  if (path === "/portal/api/billing") {
    if (!client) return json({ error: "unknown" }, 403);
    const pay = (await getJSON(env, "_data/_payments.json", { byEmail: {} })).byEmail || {};
    const emails = Object.entries(r).filter(([, x]) => x.id === client.id).map(([e]) => e.toLowerCase());
    const rec = emails.map((e) => pay[e]).filter(Boolean).sort((a, b) => String(b.updated).localeCompare(String(a.updated)))[0] || null;
    const ck = `${dkey(client.id)}/cancel.json`;
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const doc = { at: new Date().toISOString(), reason: String(b.reason || "").slice(0, 1000) };
      await putJSON(env, ck, doc);
      await notifyCancel(env, client, doc).catch(() => {});
      return json({ ok: true, cancel: doc });
    }
    return json({ billing: rec ? { status: rec.status || "", started: rec.started || "", lastPaid: rec.lastPaid || "", lastAmount: rec.lastAmount, next: rec.status === "cancelled" ? "" : rec.next || "", endsOn: rec.endsOn || "", plan: rec.plan || "" } : null, cancel: await getJSON(env, ck, null) });
  }
  if (path === "/portal/api/plan") {
    if (!client) return json({ error: "unknown" }, 403);
    return json(await getJSON(env, `${dkey(client.id)}/plan.json`, { ready: client.onboarded === true }));
  }
  if (path === "/portal/api/mealplans") {
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/mealplans.json`;
    // client "Generate me a meal plan": saves the generated plan as their current one (coach plans are kept)
    if (request.method === "POST") {
      const b = await request.json().catch(() => null);
      if (!b || !b.plan) return json({ error: "bad" }, 400);
      const cur = await getJSON(env, key, { current: "", plans: [] });
      const p = { ...b.plan, id: "gen" + Date.now().toString(36), folder: "" };
      const plans = [p, ...(cur.plans || [])];
      const gens = plans.filter((x) => String(x.id).startsWith("gen")); // keep the client's 20 newest generated plans as their history
      const drop = new Set(gens.slice(20).map((x) => x.id));
      if (cur.plans && cur.plans.length) await putJSON(env, `${dkey(client.id)}/mealplans-backup/${Date.now()}.json`, cur);
      const doc = cleanMealplans({ current: p.id, plans: plans.filter((x) => !drop.has(x.id)) });
      await putJSON(env, key, doc);
      return json({ ok: true, ...doc });
    }
    return json(await getJSON(env, key, { current: "", plans: [] }));
  }
  // ---- body stats for the maintenance calculator: _data/<id>/body.json {bf, activity, at, history:[{bf,at}]} ----
  if (path === "/portal/api/body") {
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/body.json`;
    const cur = await getJSON(env, key, { bf: "", activity: "", history: [] });
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const bf = Math.round(Number(b.bf) * 10) / 10;
      if (!(bf >= 3 && bf <= 60)) return json({ error: "bad" }, 400);
      const at = new Date().toISOString();
      const next = { ...cur, bf: String(bf), at, history: [...(cur.history || []), { bf: String(bf), at }].slice(-60) };
      await putJSON(env, key, next);
      return json(await bodyInfo(env, client, next));
    }
    return json(await bodyInfo(env, client, cur));
  }
  if (path === "/portal/api/coach/body") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    const key = `${dkey(c.id)}/body.json`;
    const cur = await getJSON(env, key, { bf: "", activity: "", history: [] });
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const next = { ...cur };
      if (b.bf !== undefined && b.bf !== "") { const bf = Math.round(Number(b.bf) * 10) / 10; if (bf >= 3 && bf <= 60) { next.bf = String(bf); next.at = new Date().toISOString(); next.history = [...(cur.history || []), { bf: String(bf), at: next.at }].slice(-60); } }
      if (b.activity !== undefined) { const a = Number(b.activity); next.activity = a >= 1.2 && a <= 2 ? String(a) : ""; }
      await putJSON(env, key, next);
      return json(await bodyInfo(env, c, next));
    }
    return json(await bodyInfo(env, c, cur));
  }

  // ---- workout log (weights and reps per set): _data/<id>/workouts/<YYYY-MM>.json {date:[session,...]} ----
  if (path === "/portal/api/workout-draft") {
    // the workout in progress, backed up from the phone every few seconds so nothing is lost if the screen closes or the phone glitches
    if (!client) return json({ error: "unknown" }, 403);
    const key = `${dkey(client.id)}/workout-draft.json`;
    if (request.method === "DELETE") { await env.PHOTOS.delete(key); return json({ ok: true }); }
    if (request.method === "POST") { const raw = await request.text(); if (raw.length > 120000) return json({ error: "too big" }, 413); let d = null; try { d = JSON.parse(raw); } catch (e) {} if (!d || !Array.isArray(d.exercises)) return json({ error: "bad" }, 400); await putJSON(env, key, { w: d, at: new Date().toISOString() }); return json({ ok: true }); }
    return json(await getJSON(env, key, null) || {});
  }
  if (path === "/portal/api/workouts" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    return json({ sessions: await readWorkouts(env, client.id, 400) });
  }
  if (path === "/portal/api/workout" && request.method === "POST") {
    if (!client) return json({ error: "unknown" }, 403);
    const b = await request.json().catch(() => ({}));
    const today = londonToday();
    if (!isDate(b.date) || (toT(today) - toT(b.date)) / DAY_MS > 400 || toT(b.date) > toT(today) + DAY_MS) return json({ error: "date" }, 400);
    const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
    const sess = {
      id: str(b.id, 20).replace(/[^a-z0-9]/gi, "") || Math.random().toString(36).slice(2, 10),
      date: b.date, programme: str(b.programme, 80), workout: str(b.workout, 80), notes: str(b.notes, 1500), at: new Date().toISOString(),
      pre: (Array.isArray(b.pre) ? b.pre : []).slice(0, 10).map((x) => ({ n: str(x && x.n, 60), m: str(x && x.m, 6) })).filter((x) => x.n), post: (Array.isArray(b.post) ? b.post : []).slice(0, 10).map((x) => ({ n: str(x && x.n, 60), m: str(x && x.m, 6) })).filter((x) => x.n),
      cardio: (Array.isArray(b.cardio) ? b.cardio : []).slice(0, 6).map((x) => ({ type: str(x && x.type, 40), mins: str(x && x.mins, 5), hr: str(x && x.hr, 5), km: str(x && x.km, 6), lvl: str(x && x.lvl, 30) })).filter((x) => x.type),
      exercises: (Array.isArray(b.exercises) ? b.exercises : []).slice(0, 40).map((e) => ({
        name: str(e.name, 80), ss: str(e.ss, 6), notes: str(e.notes, 600), ...(e.fin ? { fin: true } : {}),
        sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 24).map((x) => ({ kg: str(x.kg, 10), reps: str(x.reps, 10), done: !!x.done, ...(["w", "d", "m", "f"].includes(x.t) ? { t: x.t } : {}) })),
      })),
    };
    const key = `${dkey(client.id)}/workouts/${b.date.slice(0, 7)}.json`;
    const doc = await getJSON(env, key, {});
    const prevSess = (doc[b.date] || []).find((x) => x.id === sess.id);
    const list = (doc[b.date] || []).filter((x) => x.id !== sess.id);
    if (b.delete !== true) list.push(sess);
    if (list.length) doc[b.date] = list; else delete doc[b.date];
    await putJSON(env, key, doc);
    // cardio logged in a workout also counts in that day's daily log (only the change, so editing a workout doesn't double it)
    const cm = (s) => ((s && s.cardio) || []).reduce((t, x) => t + (parseFloat(x.mins) || 0), 0);
    const delta = (b.delete === true ? 0 : cm(sess)) - cm(prevSess);
    if (delta) { const lk = `${dkey(client.id)}/log/${b.date.slice(0, 7)}.json`, ld = await getJSON(env, lk, {}), day = { ...(ld[b.date] || {}) }; delete day._at;
      const cur = parseFloat(day.cardio) || 0; day.cardio = String(Math.max(0, Math.round(cur + delta))); if (day.cardio === "0") delete day.cardio; await saveDay(env, client, b.date, day).catch(() => {}); }
    return json({ ok: true, session: b.delete === true ? null : sess });
  }

  // ---- coach ----
  if (path === "/portal/api/coach/test-email" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    try {
      await notifyForm(env, { name: "Test client", type: "online" }, { goal: "Fat loss", weight: "70", height: "165", job: "Test" });
      await sendMail(env, { fromName: "Maria Paradise", subject: "Welcome to MPF Coaching, Jade! Your portal is ready (sample)", heading: 'Welcome, <em style="color:#e6cf8b">Jade.</em>',
        intro: "Thank you for joining my online coaching. I'm so excited to get started with you. Your client portal is ready.",
        lines: ["1. Tap the button below and log in with this email: jade@example.com", "2. You'll get a 6-digit code from Cloudflare (the secure login I use). Type it in and you're in.", "3. Follow the steps in your portal, starting with your onboarding form. It takes about 10 minutes and it's what I build your plan from.", "", "Any questions, just reply to this email or message me on WhatsApp.", "", "Maria x"],
        button: { text: "Open my portal", url: SITE + "/login.html?paid=1" }, foot: "This is a sample of the welcome email new clients get after paying." });
      return json({ ok: true, configured: !!(env.RESEND_API_KEY || env.MAILER) });
    }
    catch (e) { return json({ ok: false, err: String(e).slice(0, 200) }); }
  }
  if (path === "/portal/api/coach/grant-access" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const hit = Object.entries(r).find(([, x]) => x.id === String(b.id || "").toLowerCase());
    if (!hit) return json({ error: "unknown" }, 404);
    return json({ ok: true, email: hit[0], access: await accessAllow(env, hit[0]) });
  }
  if (path === "/portal/api/coach/test-enrol" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const e = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) return json({ error: "email" }, 400);
    const access = await autoEnrol(env, e, String(b.name || "Test Payer")).catch((x) => "error: " + String(x).slice(0, 100));
    const c = roster(env, await loadRoster(env, true))[e] || null;
    return json({ access, client: c && { id: c.id, name: c.name, type: c.type, onboarded: c.onboarded } });
  }
  if (path === "/portal/api/coach/biz-settings" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const cur = await getJSON(env, "_data/_biz-settings.json", {});
    for (const k of ["goal", "slots", "pkgSize"]) if (b[k] != null) cur[k] = Math.max(0, Math.min(1e7, Number(b[k]) || 0));
    await putJSON(env, "_data/_biz-settings.json", cur); return json({ ok: true, settings: cur });
  }
  if (path === "/portal/api/coach/expenses" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const db = await getJSON(env, "_data/_expenses.json", { items: [] });
    if (b.delete) { const it = db.items.find((x) => x.id === b.delete); if (it && it.receipt) await env.PHOTOS.delete(`_data/_receipts/${it.id}`).catch(() => {}); db.items = db.items.filter((x) => x.id !== b.delete); }
    else {
      if (!isDate(b.date) || !(Number(b.amount) > 0)) return json({ error: "bad" }, 400);
      const it = { id: String(b.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 20) || Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: b.date, amount: Math.round(Number(b.amount) * 100) / 100, category: String(b.category || "Other").slice(0, 40), note: String(b.note || "").slice(0, 200), receipt: false };
      const old = db.items.find((x) => x.id === it.id); if (old) it.receipt = old.receipt;
      db.items = [it, ...db.items.filter((x) => x.id !== it.id)].slice(0, 3000);
      await putJSON(env, "_data/_expenses.json", db); return json({ ok: true, item: it });
    }
    await putJSON(env, "_data/_expenses.json", db); return json({ ok: true });
  }
  if (path === "/portal/api/coach/receipt") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = String(url.searchParams.get("id") || "").replace(/[^a-z0-9]/gi, "");
    if (!id) return json({ error: "id" }, 400);
    if (request.method === "PUT") {
      const ct = request.headers.get("content-type") || "";
      if (!/^image\/(jpeg|png|webp|heic)|^application\/pdf/.test(ct)) return json({ error: "type" }, 400);
      const buf = await request.arrayBuffer(); if (buf.byteLength > 12e6) return json({ error: "size" }, 413);
      await env.PHOTOS.put(`_data/_receipts/${id}`, buf, { httpMetadata: { contentType: ct } });
      const db = await getJSON(env, "_data/_expenses.json", { items: [] }); const it = db.items.find((x) => x.id === id); if (it) { it.receipt = true; await putJSON(env, "_data/_expenses.json", db); }
      return json({ ok: true });
    }
    const o = await env.PHOTOS.get(`_data/_receipts/${id}`); if (!o) return new Response("not found", { status: 404 });
    return new Response(o.body, { headers: { "content-type": (o.httpMetadata && o.httpMetadata.contentType) || "application/octet-stream", "cache-control": "private, no-store" } });
  }
  if (path === "/portal/api/coach/leads" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const db = await getJSON(env, "_data/_leads.json", { items: [] });
    if (b.delete) db.items = db.items.filter((x) => x.id !== b.delete);
    else {
      const st = ["New", "Consult booked", "Won", "Lost"];
      const it = { id: String(b.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 20) || Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: isDate(b.date) ? b.date : londonToday(), name: String(b.name || "").slice(0, 60), source: String(b.source || "").slice(0, 40), status: st.includes(b.status) ? b.status : "New", note: String(b.note || "").slice(0, 300), updated: londonToday() };
      if (!it.name) return json({ error: "name" }, 400);
      db.items = [it, ...db.items.filter((x) => x.id !== it.id)].slice(0, 3000);
    }
    await putJSON(env, "_data/_leads.json", db); return json({ ok: true });
  }
  if (path === "/portal/api/coach/photos" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!Object.values(r).some((x) => x.id === id)) return json({ error: "unknown" }, 404);
    const form = await request.formData(); const file = form.get("photo");
    const angle = String(form.get("angle") || "").toLowerCase(), week = parseInt(form.get("week"), 10);
    if (!ANGLES.includes(angle) || isNaN(week) || week < 0 || week > 520) return json({ error: "angle or week" }, 400);
    if (!file || typeof file === "string" || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_BYTES) return json({ error: "file" }, 400);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
    const key = `${id}/w${String(week).padStart(3, "0")}-${angle}-${Date.now()}.${ext}`;
    await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { week: String(week), angle, by: "coach-import" } });
    return json({ ok: true, key, week, angle });
  }
  if (path === "/portal/api/coach/consent" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!Object.values(r).some((x) => x.id === id)) return json({ error: "unknown" }, 404);
    const b = await request.json().catch(() => ({})), k = `${dkey(id)}/consent.json`, cur = await getJSON(env, k, {}), now = new Date().toISOString();
    const next = { ...cur, history: [...(cur.history || []).slice(-50), { offline: !!b.offline, by: "coach", at: now }] };
    if (b.offline) { next.health = cur.health || now; next.terms = cur.terms || now; next.offline = now; }
    else { delete next.health; delete next.terms; delete next.offline; }
    await putJSON(env, k, next);
    return json({ ok: true, health: !!next.health, terms: !!next.terms, photos: next.photos || "" });
  }
  if (path === "/portal/api/schedule") {
    // client's own week planner (training, cardio, meal prep...). Coach can read it.
    let id = client && client.id;
    if (coach && url.searchParams.get("id")) id = String(url.searchParams.get("id")).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!id) return json({ error: "unknown" }, 403);
    const key = `${dkey(id)}/schedule.json`, doc = await getJSON(env, key, { items: [] });
    if (request.method === "POST") {
      if (coach && !client) return json({ error: "read only" }, 403);
      const b = await request.json().catch(() => ({}));
      const TY = ["training", "cardio", "mealprep", "walk", "stretch", "sleep", "checkin", "other"];
      const tm = (v) => (/^\d{2}:\d{2}$/.test(String(v || "")) ? v : "");
      doc.items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).map((x) => ({
        id: String(x.id || Math.random().toString(36).slice(2, 10)).replace(/[^a-z0-9]/gi, "").slice(0, 16),
        type: TY.includes(x.type) ? x.type : "other", title: String(x.title || "").slice(0, 80), notes: String(x.notes || "").slice(0, 300),
        date: isDate(x.date) ? x.date : londonToday(), time: tm(x.time) || "07:00", dur: Math.max(5, Math.min(600, parseInt(x.dur, 10) || 60)),
        days: (Array.isArray(x.days) ? x.days : []).map(Number).filter((d) => d >= 0 && d <= 6).slice(0, 7),
        until: isDate(x.until) ? x.until : "",
      })).filter((x) => x.title);
      if (b.feed === "reset" || (b.feed === "on" && !doc.token)) {
        const tk = await getJSON(env, "_data/_caltokens.json", {});
        if (doc.token) delete tk[doc.token];
        doc.token = [...crypto.getRandomValues(new Uint8Array(18))].map((n) => n.toString(16).padStart(2, "0")).join("");
        tk[doc.token] = id; await putJSON(env, "_data/_caltokens.json", tk);
      }
      if (b.feed === "off" && doc.token) { const tk = await getJSON(env, "_data/_caltokens.json", {}); delete tk[doc.token]; await putJSON(env, "_data/_caltokens.json", tk); delete doc.token; }
      doc.updated = new Date().toISOString();
      await putJSON(env, key, doc);
    }
    return json({ items: doc.items || [], feed: doc.token ? `${url.origin}/cal/${doc.token}.ics` : "" });
  }
  if (path === "/portal/api/recs") {
    // "Recommended by Maria": books, podcasts, apps and anything else. Everyone can read; only the coach can change it.
    const key = "_data/_recs.json";
    if (request.method === "POST") {
      if (!coach) return json({ error: "forbidden" }, 403);
      const b = await request.json().catch(() => ({}));
      const T = ["book", "podcast", "playlist", "app", "video", "other"];
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 100).map((x) => ({
        id: String(x.id || Math.random().toString(36).slice(2, 10)).replace(/[^a-z0-9]/gi, "").slice(0, 16),
        type: T.includes(x.type) ? x.type : "other", title: String(x.title || "").slice(0, 120), by: String(x.by || "").slice(0, 80),
        why: String(x.why || "").slice(0, 600), link: /^https:\/\//.test(String(x.link || "")) ? String(x.link).slice(0, 400) : "",
        img: /^https:\/\//.test(String(x.img || "")) ? String(x.img).slice(0, 400) : "",
        for: ["m", "f"].includes(x.for) ? x.for : "all",
      })).filter((x) => x.title);
      await putJSON(env, key, { items, updated: new Date().toISOString() });
      return json({ ok: true, items });
    }
    return json(await getJSON(env, key, { items: [] }));
  }
  if (path === "/portal/api/coach/photo-align" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!Object.values(r).some((x) => x.id === id)) return json({ error: "unknown" }, 404);
    const b = await request.json().catch(() => ({})), key = String(b.key || "");
    if (!key.startsWith(id + "/")) return json({ error: "key" }, 400);
    const num = (v, lo, hi, d) => { const n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 1000) / 1000)) : d; };
    const k = `${dkey(id)}/photo-align.json`, doc = await getJSON(env, k, {});
    if (b.reset) delete doc[key]; else doc[key] = { s: num(b.s, 0.4, 3, 1), x: num(b.x, -60, 60, 0), y: num(b.y, -60, 60, 0) };
    await putJSON(env, k, doc);
    return json({ ok: true, align: doc[key] || null });
  }
  if (path === "/portal/api/coach/import-workouts" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!Object.values(r).some((x) => x.id === id)) return json({ error: "unknown" }, 404);
    const b = await request.json().catch(() => ({})), str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
    const byMonth = {}; let n = 0;
    for (const w of (Array.isArray(b.sessions) ? b.sessions : []).slice(0, 400)) {
      if (!isDate(w.date)) continue;
      const sess = { id: "imp" + w.date.replace(/-/g, "") + str(w.part || "", 2), date: w.date, programme: str(w.programme, 80), workout: str(w.workout, 80), notes: str(w.notes || "Imported from tracker", 1500), at: w.date + "T12:00:00.000Z", imported: true,
        exercises: (Array.isArray(w.exercises) ? w.exercises : []).slice(0, 40).map((e) => ({ name: str(e.name, 80), ss: "", notes: str(e.notes, 600), sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 12).map((x) => ({ kg: str(x.kg, 10), reps: str(x.reps, 10), done: true })) })) };
      (byMonth[w.date.slice(0, 7)] = byMonth[w.date.slice(0, 7)] || []).push(sess); n++;
    }
    for (const [m, list] of Object.entries(byMonth)) {
      const key = `${dkey(id)}/workouts/${m}.json`, doc = await getJSON(env, key, {});
      for (const sess of list) { doc[sess.date] = [...(doc[sess.date] || []).filter((x) => x.id !== sess.id), sess]; }
      await putJSON(env, key, doc);
    }
    return json({ ok: true, sessions: n });
  }
  if (path === "/portal/api/coach/orders") {
    if (!coach) return json({ error: "forbidden" }, 403);
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const b = await request.json().catch(() => ({})); const ids = new Set(Object.values(r).map((x) => x.id)); const done = {};
    for (const [id, list] of Object.entries(b.byId || {})) { if (!ids.has(id) || !Array.isArray(list)) continue;
      const orders = list.slice(0, 200).map((o) => ({ date: isDate(o.date) ? o.date : "", size: Math.max(0, Math.min(200, Math.round(Number(o.size) || 0))), name: String(o.name || "").slice(0, 80) })).filter((o) => o.date && o.size);
      await putJSON(env, `${dkey(id)}/orders.json`, { orders, at: new Date().toISOString() }); done[id] = orders.length; }
    return json({ ok: true, done });
  }
  if (path === "/portal/api/coach/package") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!Object.values(r).some((x) => x.id === id)) return json({ error: "unknown" }, 404);
    const key = `${dkey(id)}/package.json`;
    if (request.method === "POST") { const b = await request.json().catch(() => ({})); const size = Math.max(0, Math.min(200, Math.round(Number(b.size) || 0))); if (!size) { await env.PHOTOS.delete(key); return json({ ok: true, pkg: null }); } const d = { size, start: isDate(b.start) ? b.start : londonToday(), set: new Date().toISOString() }; if (b.code) d.code = String(b.code).toUpperCase().slice(0, 20); await putJSON(env, key, d); return json({ ok: true, pkg: d }); }
    return json(await getJSON(env, key, null));
  }
  if (path === "/portal/api/coach/automation") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const key = "_data/_automation.json", db = await getJSON(env, key, { enabled: {}, templates: null, time: 8 });
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (b.enabled && typeof b.enabled === "object") for (const k of AUTO_RULES) if (k in b.enabled) db.enabled[k] = !!b.enabled[k];
      if (Array.isArray(b.snippets)) db.snippets = b.snippets.slice(0, 40).map((t) => ({ name: String(t.name || "").slice(0, 40), text: String(t.text || "").slice(0, 1200) })).filter((t) => t.name && t.text);
      if (Array.isArray(b.templates)) db.templates = b.templates.slice(0, 40).map((t) => ({ name: String(t.name || "").slice(0, 60), text: String(t.text || "").slice(0, 1200) })).filter((t) => t.name && t.text);
      if (b.test) { const res = await runAutomations(env, { testTo: env.NOTIFY_TO || "info@mpfcoaching.co.uk", rule: String(b.test) }); return json({ ok: true, res }); }
      if (b.runNow) { const res = await runAutomations(env, {}); return json({ ok: true, res, ...db }); }
      await putJSON(env, key, db);
    }
    const log = (await getJSON(env, "_data/_automation-log.json", { items: [] })).items.slice(0, 80);
    return json({ ...db, rules: AUTO_RULES, log, gcal: !!env.GCAL_ICAL, cron: true });
  }
  if (path === "/portal/api/coach/checkin-queue") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const today = londonToday(), seen = new Set(), out = [];
    const list = Object.values(r).filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)) && c.active !== false);
    await Promise.all(list.map(async (c) => {
      const all = await getJSON(env, `${dkey(c.id)}/checkins.json`, {});
      const sm = await getJSON(env, `${dkey(c.id)}/summary.json`, {});
      const ks = Object.keys(all).sort(), k = ks[ks.length - 1], pk = ks[ks.length - 2];
      const extra = k ? await weekExtra(env, c, k, sm).catch(() => null) : null;
      out.push({ id: c.id, name: c.name, type: c.type === "pt" ? "pt" : "online", sex: c.sex === "m" ? "m" : "f", extra, check: checkinStatus(c, sm, today), lastLog: (sm.logged || []).slice(-1)[0] || "",
        latest: k ? { due: k, ...all[k] } : null, prev: pk ? { due: pk, stats: all[pk].stats || {}, answers: all[pk].answers || [] } : null, targets: await getJSON(env, `${dkey(c.id)}/targets.json`, null) });
    }));
    return json({ today, questions: QUESTIONS, clients: out, ai: !!env.ANTHROPIC_API_KEY });
  }
  if (path === "/portal/api/coach/backup") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const files = {}; let cursor, n = 0, bytes = 0;
    do { const page = await env.PHOTOS.list({ prefix: "_data/", cursor }); for (const o of page.objects) { if (!/\.json$/.test(o.key) || /backup/.test(o.key) || o.size > 2e6) continue; const ob = await env.PHOTOS.get(o.key); if (!ob) continue; const t = await ob.text(); try { files[o.key] = JSON.parse(t); n++; bytes += t.length; } catch (e) {} if (bytes > 80e6) break; } cursor = page.truncated ? page.cursor : null; } while (cursor && bytes <= 80e6);
    return new Response(JSON.stringify({ exported: new Date().toISOString(), note: "MPF Coaching portal data backup (photos not included). Keep this file private.", count: n, files }), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="mpf-portal-backup-${londonToday()}.json"`, "cache-control": "no-store" } });
  }
  if (path === "/portal/api/coach/delete-client" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const id = String(b.id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const c = Object.values(r).find((x) => x.id === id);
    if (!c) return json({ error: "unknown" }, 404);
    if (String(b.confirm || "").trim().toLowerCase() !== String(c.name || "").trim().toLowerCase()) return json({ error: "confirm" }, 400);
    const emails = Object.entries(r).filter(([, x]) => x.id === id).map(([e]) => e.toLowerCase());
    let removed = 0;
    for (const prefix of [`${dkey(id)}/`, `${id}/`]) { let cursor; do { const page = await env.PHOTOS.list({ prefix, cursor }); const keys = page.objects.map((o) => o.key); if (keys.length) { await env.PHOTOS.delete(keys); removed += keys.length; } cursor = page.truncated ? page.cursor : null; } while (cursor); }
    const ro = (await getJSON(env, "_data/_roster.json", null)) || {}; for (const e of emails) ro[e] = { deleted: true, id, name: "Deleted", at: new Date().toISOString() }; await putJSON(env, "_data/_roster.json", ro); rosterCache = null;
    const pay = await getJSON(env, "_data/_payments.json", null); if (pay && pay.byEmail) { for (const e of emails) delete pay.byEmail[e]; for (const [cus, e] of Object.entries(pay.customers || {})) if (emails.includes(e)) delete pay.customers[cus]; await putJSON(env, "_data/_payments.json", pay); }
    let access = "not set up";
    if (env.CF_API_TOKEN && env.ACCESS_POLICY_ID && env.CF_ACCOUNT_ID) { try { const u = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/policies/${env.ACCESS_POLICY_ID}`, h = { authorization: "Bearer " + env.CF_API_TOKEN, "content-type": "application/json" }; const pol = (await (await fetch(u, { headers: h })).json()).result; const inc = (pol.include || []).filter((x) => !(x.email && emails.includes(String(x.email.email).toLowerCase()))); const body = { name: pol.name, decision: pol.decision, include: inc, exclude: pol.exclude || [], require: pol.require || [] }; if (pol.session_duration) body.session_duration = pol.session_duration; access = (await fetch(u, { method: "PUT", headers: h, body: JSON.stringify(body) })).ok ? "removed" : "failed"; } catch (e) { access = "failed"; } }
    const lg = await getJSON(env, "_data/_deletions.json", { items: [] }); lg.items.unshift({ id, at: new Date().toISOString(), files: removed, access, requested: !!b.requested }); await putJSON(env, "_data/_deletions.json", lg);
    return json({ ok: true, files: removed, access, note: "Stripe keeps its own payment records for tax purposes." });
  }
  if (path === "/portal/api/coach/todos") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const key = "_data/_todos.json", db = await getJSON(env, key, { items: [], dismissed: {} });
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (b.add) db.items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: String(b.add).slice(0, 200), done: false, at: londonToday(), client: String(b.client || "").slice(0, 40), list: String(b.list || "").slice(0, 30), due: isDate(b.due) ? b.due : "" });
      if (b.habits && Array.isArray(b.habits)) db.habits = b.habits.map((x) => String(x).slice(0, 120)).filter(Boolean).slice(0, 30);
      if (b.toggle) db.items.forEach((x) => { if (x.id === b.toggle) { x.done = !x.done; x.doneAt = x.done ? londonToday() : ""; } });
      if (b.remove) db.items = db.items.filter((x) => x.id !== b.remove);
      if (b.dismiss) db.dismissed[String(b.dismiss).slice(0, 120)] = londonToday();
      if (b.undismiss) delete db.dismissed[String(b.undismiss).slice(0, 120)];
      const cut = fromT(toT(londonToday()) - 14 * DAY_MS);
      db.items = db.items.filter((x) => !x.done || (x.doneAt || "") >= cut).slice(0, 300);
      for (const [k, d] of Object.entries(db.dismissed)) if (!k.startsWith("ms:") && d < cut) delete db.dismissed[k];
      await putJSON(env, key, db);
    }
    return json(db);
  }
  if (path === "/portal/api/coach/marketing") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const key = "_data/_marketing.json", db = await getJSON(env, key, { weeks: {}, stats: [], bank: [] });
    db.weeks = db.weeks || {}; db.stats = db.stats || []; db.bank = db.bank || [];
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({})), str = (v, n) => String(v == null ? "" : v).slice(0, n);
      if (b.day && isDate(b.week) && /^[0-6]$/.test(String(b.day.i))) {
        const w = (db.weeks[b.week] = db.weeks[b.week] || {});
        w[b.day.i] = { text: str(b.day.text, 300), pillar: str(b.day.pillar, 20), platforms: (Array.isArray(b.day.platforms) ? b.day.platforms : []).map((x) => str(x, 20)).slice(0, 6), status: ["idea", "filmed", "posted"].includes(b.day.status) ? b.day.status : "idea" };
        const keys = Object.keys(db.weeks).sort(); while (keys.length > 60) delete db.weeks[keys.shift()];
      }
      if (b.stat && isDate(b.stat.week)) {
        const st = { week: b.stat.week }; for (const k of ["ig", "igr", "tt", "fb", "enq", "views"]) if (b.stat[k] !== "" && b.stat[k] != null && !isNaN(Number(b.stat[k]))) st[k] = Math.round(Number(b.stat[k]));
        db.stats = [...db.stats.filter((x) => x.week !== st.week), st].sort((a, b2) => a.week.localeCompare(b2.week)).slice(-120);
      }
      if (b.bankAdd) db.bank.unshift({ id: Date.now().toString(36), text: str(b.bankAdd.text, 200), pillar: str(b.bankAdd.pillar, 20) });
      if (b.bankRemove) db.bank = db.bank.filter((x) => x.id !== b.bankRemove);
      db.bank = db.bank.slice(0, 300);
      if (b.checks && typeof b.checks === "object") db.checks = Object.fromEntries(Object.entries(b.checks).slice(0, 200).map(([k, v]) => [str(k, 80), str(v, 12)]));
      await putJSON(env, key, db);
    }
    return json(db);
  }
  if (path === "/portal/api/coach/notes") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!Object.values(r).some((x) => x.id === id)) return json({ error: "unknown" }, 404);
    const key = `${dkey(id)}/notes.json`;
    if (request.method === "POST") { const b = await request.json().catch(() => ({})); const d = { text: String(b.text || "").slice(0, 20000), updated: new Date().toISOString() }; await putJSON(env, key, d); return json(d); }
    return json(await getJSON(env, key, { text: "", updated: "" }));
  }
  if (path === "/portal/api/coach/checkin-draft" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const id = String(b.id || "").toLowerCase(), c = Object.values(r).find((x) => x.id === id);
    if (!c || !isDate(b.due)) return json({ error: "bad" }, 400);
    const out = await aiDraft(env, r, c, b.due);
    return json(out, out.error ? (out.error === "no-key" ? 501 : 502) : 200);
  }
  if (path === "/portal/api/coach/checkin-reply" && request.method === "POST") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const id = String(b.id || "").toLowerCase(), c = Object.values(r).find((x) => x.id === id);
    if (!c || !isDate(b.due)) return json({ error: "bad" }, 400);
    const key = `${dkey(c.id)}/checkins.json`, all = await getJSON(env, key, {});
    if (!all[b.due]) return json({ error: "no check-in" }, 404);
    if (b.skip === true || b.skip === false) {
      const at0 = new Date().toISOString();
      if (b.skip) all[b.due].reviewed = at0; else delete all[b.due].reviewed;
      await putJSON(env, key, all);
      const sk0 = `${dkey(c.id)}/summary.json`, sm0 = await getJSON(env, sk0, {}); sm0.replied = sm0.replied || {};
      if (b.skip) sm0.replied[b.due] = at0; else if (!(all[b.due].reply && all[b.due].reply.text)) delete sm0.replied[b.due];
      await putJSON(env, sk0, sm0);
      return json({ ok: true, reviewed: all[b.due].reviewed || null });
    }
    const text = String(b.text || "").trim().slice(0, 5000), at = new Date().toISOString(), isNew = !(all[b.due].reply && all[b.due].reply.text);
    if (text) { all[b.due].reply = { text, at }; delete all[b.due].draft; } else delete all[b.due].reply;
    await putJSON(env, key, all);
    const sk = `${dkey(c.id)}/summary.json`, sm = await getJSON(env, sk, {}); sm.replied = sm.replied || {};
    if (text) sm.replied[b.due] = at; else delete sm.replied[b.due];
    await putJSON(env, sk, sm);
    if (text && isNew && b.email !== false) {
      const to = Object.entries(r).filter(([, x]) => x.id === c.id).map(([e]) => e.toLowerCase())[0];
      const first = String(c.name || "").split(" ")[0];
      if (to) await sendMail(env, { to, fromName: "Maria Paradise", subject: `${first}, I've replied to your check-in`, heading: `Your check-in <em style="color:#e6cf8b">feedback.</em>`, intro: `Hi ${first}, I've gone through your check-in and left you some feedback in your portal.`, lines: ["Have a read and message me if you have any questions.", "", "Maria x"], button: { text: "Read my feedback", url: SITE + "/portal/#checkin" } }).catch(() => {});
    }
    return json({ ok: true, reply: all[b.due].reply || null });
  }
  if (path === "/portal/api/coach/business") {
    if (!coach) return json({ error: "forbidden" }, 403);
    return json(await businessStats(env, r, url.searchParams.get("fresh") === "1"));
  }
  // ---- client's own PT sessions (from Acuity) ----
  if (path === "/portal/api/sessions" && request.method === "GET") {
    if (!client) return json({ error: "unknown" }, 403);
    const acu = await acuityBookings(env, r).catch(() => null);
    const a = acu && acu.byId && acu.byId[client.id];
    if (!a) return json({ dates: [], pkg: null });
    const today = londonToday();
    const codes = a.codes || {}; const ks = Object.keys(codes).sort((x, y) => (codes[y].last).localeCompare(codes[x].last) || (codes[y].first).localeCompare(codes[x].first));
    const pk = await getJSON(env, `${dkey(client.id)}/package.json`, null), bs = await getJSON(env, "_data/_biz-settings.json", {});
    let pkg = null;
    if (ks.length) { const q = codes[ks[0]]; const ord = (await getJSON(env, `${dkey(client.id)}/orders.json`, {})).orders; const size = pkgSize(pk, ord, ks[0], q.first, q, bs).size; pkg = { size, used: q.used, booked: q.booked, left: size ? Math.max(0, size - q.used) : null, start: q.first }; }
    const dates = [...new Set(a.dates || [])].sort();
    return json({ today, past: dates.filter((d) => d <= today).reverse(), upcoming: dates.filter((d) => d > today), times: a.slots || {}, pkg });
  }
  if (path === "/portal/api/coach/acuity-emails") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const acu = await acuityBookings(env, r).catch(() => null);
    const a = acu && acu.byId && acu.byId[id];
    return json({ id, emails: (a && a.em) || {}, onFile: Object.entries(r).filter(([, x]) => x.id === id).map(([e]) => e) });
  }
  if (path === "/portal/api/coach/acuity-status") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const t0 = Date.now(); acuityCache = null; await env.PHOTOS.delete("_data/_acuity-cache.json").catch(() => {});
    let err = null; const data = await acuityBookings(env, r).catch((e) => { err = String(e).slice(0, 120); return null; });
    return json({ configured: !!(env.ACUITY_ICAL || (env.ACUITY_USER_ID && env.ACUITY_API_KEY)), ok: !!data, clients: data ? Object.keys(data.byId || data).length : 0, ms: Date.now() - t0, last: acuityLast, err });
  }
  if (path === "/portal/api/coach/clients") {
    if (!coach) return json({ error: "forbidden" }, 403);
    const acu = await acuityBookings(env, r).catch(() => null);
    const bizSet = await getJSON(env, "_data/_biz-settings.json", {});
    const pay = (await getJSON(env, "_data/_payments.json", { byEmail: {} })).byEmail || {};
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
        type: c.type === "pt" ? "pt" : "online", ...(await (async () => { const pf = await getJSON(env, `${dkey(c.id)}/prefs.json`, {}); return { phone: String(c.phone || pf.phone || "").replace(/[^0-9]/g, ""), about: pf.about || "", food: pf.food || null }; })()),
        lastLog: logged[logged.length - 1] || "", loggedWeek: logged.filter((d) => d >= weekAgo && d <= today).length,
        lastWeight: wts.length ? wts[wts.length - 1] : null, check: checkinStatus(c, sm, today),
        setup: setup.skip ? { done: true } : { done: !!setup.completed, n: Object.keys(setup.done || {}).length },
        form: c.onboarded === true ? null : !!(await getJSON(env, `${dkey(c.id)}/onboarding.json`, {})).submitted,
        planReady: c.onboarded === true ? true : !!(await getJSON(env, `${dkey(c.id)}/plan.json`, {})).ready,
        has: await (async () => { const [tg, pg, mp] = await Promise.all([getJSON(env, `${dkey(c.id)}/targets.json`, null), getJSON(env, `${dkey(c.id)}/programmes.json`, null), getJSON(env, `${dkey(c.id)}/mealplans.json`, null)]);
          return { macros: !!(tg && (tg.cals || tg.protein)), prog: !!(pg && (pg.programmes || []).length), meal: !!(mp && (mp.plans || []).length) }; })(),
        active: c.active !== false, week, tracker: c.tracker || "", folder: c.folder || "", payOk: c.payOk === true, tags: c.tags || [], lockMode: c.lock || "", lockNow: await lockState(env, c, r),
        dob: c.onboarded === true ? ((await getJSON(env, `${dkey(c.id)}/onboarding.json`, {})).answers || {}).dob || "" : ((await getJSON(env, `${dkey(c.id)}/onboarding.json`, {})).answers || {}).dob || "",
        pkg: await (async () => { const a = acu && acu.byId && acu.byId[c.id]; const codes = (a && a.codes) || {}; const ks = Object.keys(codes).sort((x, y) => (codes[y].last).localeCompare(codes[x].last) || (codes[y].first).localeCompare(codes[x].first)); const pk = await getJSON(env, `${dkey(c.id)}/package.json`, null);
          const size = (pk && pk.size) || (bizSet && bizSet.pkgSize) || 0;
          if (ks.length) { const k = ks[0], q = codes[k]; const ord = (await getJSON(env, `${dkey(c.id)}/orders.json`, {})).orders; const ps = pkgSize(pk, ord, k, q.first, q, bizSet); return { auto: true, code: k, size: ps.size, src: ps.src, name: ps.name || q.name || "", used: q.used, booked: q.booked, start: q.first, packages: ks.length }; }
          if (!pk || !pk.size) return null; const ds = (a && a.dates) || []; return { size: pk.size, start: pk.start, used: ds.filter((d) => d >= pk.start && d <= today).length, booked: ds.filter((d) => d > today).length }; })(),
        startWeight: wts.length ? wts[0] : null, needsReply: (() => { const ks = Object.keys(sm.checkins || {}).sort(); const k = ks[ks.length - 1]; return !!k && !((sm.replied || {})[k]); })(),
        photosThisWeek: [...new Set(thisWeek)], lastUpload: photos.reduce((m, p) => (p.uploaded > m ? p.uploaded : m), ""),
        photoCount: photos.length,
        lastCheckin: Object.keys(sm.checkins || {}).sort().pop() || "",
        cancelReq: (await getJSON(env, `${dkey(c.id)}/cancel.json`, null)),
        deleteReq: (await getJSON(env, `${dkey(c.id)}/delete-request.json`, null)),
        payment: (() => { const recs = emailsOf(c.id).map((e) => pay[e]).filter(Boolean); if (!recs.length) return null; const r0 = recs.sort((a, b) => String(b.updated).localeCompare(String(a.updated)))[0]; return { status: r0.status || "", lastPaid: r0.lastPaid || "", next: r0.next || "", endsOn: r0.endsOn || "", last: (r0.history || [])[0] || null }; })(),
        pt: acu && acu.byId ? (acu.byId[c.id] || { last: "", next: "" }) : acu ? emailsOf(c.id).reduce((m, e) => { const b = acu[e]; if (!b) return m; return { last: b.last > m.last ? b.last : m.last, next: !m.next || (b.next && b.next < m.next) ? b.next || m.next : m.next }; }, { last: "", next: "" }) : null,
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
      for (let [due, answers] of Object.entries(body.checkins)) {
        const custom = answers && !Array.isArray(answers) && Array.isArray(answers.answers) ? answers : null;
        if (custom) answers = custom.answers;
        if (!isDate(due) || !Array.isArray(answers) || cis[due]) continue;
        const stats = weekStats(all, due), prev = weekStats(all, fromT(toT(due) - 7 * DAY_MS));
        stats.change = stats.weight && prev.weight ? +(stats.weight - prev.weight).toFixed(1) : null;
        const qs = custom && Array.isArray(custom.questions) ? custom.questions.slice(0, 30).map((q) => String(q).slice(0, 300)) : QUESTIONS;
        cis[due] = { answers: answers.slice(0, qs.length).map((a) => String(a || "").slice(0, 3000)), questions: qs, stats, at: due + "T12:00:00.000Z", imported: true };
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
        if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && c && c.deleted === true) { clean[e] = { deleted: true, id: String(c.id || "").slice(0, 40), name: "Deleted", at: String(c.at || "").slice(0, 30) }; continue; }
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) || !c || !c.id || !c.name) continue;
        clean[e] = {
          id: String(c.id).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40), name: String(c.name).slice(0, 60),
          checkin: DAYS.includes(c.checkin) ? c.checkin : (c.type === "pt" ? "Sunday" : "Wednesday"),
          start: isDate(c.start) ? c.start : londonToday(), phase: String(c.phase || "").slice(0, 40),
          active: c.active !== false, type: c.type === "pt" ? "pt" : "online", sex: c.sex === "m" ? "m" : "f",
          onboarded: c.onboarded === true, phone: String(c.phone || "").replace(/[^0-9]/g, "").slice(0, 15),
          folder: String(c.folder || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80),
          payOk: c.payOk === true, lock: c.lock === "on" || c.lock === "off" ? c.lock : "",
          source: String(c.source || "").slice(0, 40),
          tags: (Array.isArray(c.tags) ? c.tags : []).map((x) => String(x).trim().slice(0, 24)).filter(Boolean).slice(0, 8),
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
    return json({ sessions: await readWorkouts(env, c.id, 400) });
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

// ---- branded emails (black and gold, logo and Maria's photo) ----
const SITE = "https://mpfcoaching.co.uk";
function escH(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function brandHTML({ heading, intro, lines, button, foot }) {
  const body = (lines || []).map((l) => l === "" ? '<div style="height:10px"></div>' : `<p style="margin:0 0 8px;color:#e9e1cc;font-size:15px;line-height:1.6">${escH(l)}</p>`).join("");
  return `<!DOCTYPE html><html><head><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"></head><body style="margin:0;background:#0b0b0b;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid #3a3122;border-radius:18px">
<tr><td style="padding:26px 28px 6px" align="left"><img src="${SITE}/img/logo.png" alt="MPF Coaching" height="44" style="display:block;height:44px"></td></tr>
<tr><td style="padding:12px 28px 0"><div style="height:2px;background:linear-gradient(90deg,#8a6a2a,#e6cf8b,#8a6a2a);background-color:#c9a64b"></div></td></tr>
<tr><td style="padding:22px 28px 4px"><h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#ffffff;font-weight:normal">${heading}</h1>
${intro ? `<p style="margin:0 0 14px;color:#e9e1cc;font-size:15px;line-height:1.6">${escH(intro)}</p>` : ""}${body}</td></tr>
${button ? `<tr><td style="padding:14px 28px 6px"><a href="${button.url}" style="display:inline-block;background:#c9a64b;background-image:linear-gradient(135deg,#a8873e,#e6cf8b);color:#111;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:14px 26px;border-radius:40px">${escH(button.text)}</a></td></tr>` : ""}
<tr><td style="padding:22px 28px 26px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><img src="${SITE}/img/email-avatar.png" alt="Maria Paradise" width="56" height="56" style="display:block;width:56px;height:56px;border:0"></td>
<td valign="middle" style="padding-left:14px"><div style="color:#ffffff;font-family:Georgia,serif;font-size:17px">Maria Paradise</div><div style="color:#c9a64b;font-size:12px;letter-spacing:1px">MPF COACHING · FAT LOSS &amp; BODY RECOMP</div></td></tr></table></td></tr>
</table>
<p style="color:#7d7565;font-size:12px;line-height:1.6;margin:16px 0 0;max-width:560px">${foot ? escH(foot) + "<br>" : ""}<a href="${SITE}" style="color:#c9a64b;text-decoration:none">mpfcoaching.co.uk</a> · <a href="https://instagram.com/mariaparadisefitness" style="color:#c9a64b;text-decoration:none">@mariaparadisefitness</a></p>
</td></tr></table></body></html>`;
}
async function sendMail(env, { to, subject, heading, intro, lines, button, foot, fromName, replyTo }) {
  if (!env.RESEND_API_KEY) return false;
  const text = [intro, ...(lines || []), button ? button.text + ": " + button.url : ""].filter((x) => x != null).join("\n");
  const res = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: `${fromName || "MPF Client Portal"} <${env.MAIL_FROM_ADDR || "info@mpfcoaching.co.uk"}>`, to: [to || env.NOTIFY_TO || "info@mpfcoaching.co.uk"],
      reply_to: replyTo || "info@mpfcoaching.co.uk", subject, text, html: brandHTML({ heading: heading || escH(subject), intro, lines, button, foot }) }) });
  if (!res.ok) throw new Error("resend " + res.status);
  return true;
}

async function notifyForm(env, client, a) {
  const to = env.NOTIFY_TO || "info@mpfcoaching.co.uk";
  const from = env.NOTIFY_FROM || "MPF Client Portal <portal@mpfcoaching.co.uk>";
  if (!env.RESEND_API_KEY && !env.MAILER) return;
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
  if (env.RESEND_API_KEY) {
    await sendMail(env, { to, subject: subj, heading: `New form from <em style="color:#e6cf8b">${escH(client.name)}</em>`, lines: lines.slice(0, -2), button: { text: "Open coach view", url: SITE + "/portal/coach/" } });
    return;
  }
  const { EmailMessage } = await import("cloudflare:email");
  const raw = [
    `From: ${from}`, `To: ${to}`, `Subject: ${subj.replace(/[\r\n]/g, " ")}`,
    `Message-ID: <${crypto.randomUUID()}@mpfcoaching.co.uk>`, `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", lines.join("\r\n"),
  ].join("\r\n");
  await env.MAILER.send(new EmailMessage(from.replace(/.*</, "").replace(">", ""), to, raw));
}

// ---- PT bookings from Acuity (optional: needs ACUITY_USER_ID + ACUITY_API_KEY secrets) ----
let acuityCache = null, acuityLast = null;
// Acuity iCal feed (free on all plans): ACUITY_ICAL secret = the "subscribe manually" export link.
async function acuityFromIcal(env, r) {
  const res = await fetch(String(env.ACUITY_ICAL).replace(/^webcal:/i, "https:"), { signal: AbortSignal.timeout(20000) });
  acuityLast = { status: res.status, at: new Date().toISOString(), source: "ical" };
  if (!res.ok) return null;
  const txt = (await res.text()).replace(/\r?\n[ \t]/g, "");
  const today = londonToday();
  const byEmail = {}, byName = {};
  for (const e of Object.entries(r)) byEmail[e[0].toLowerCase()] = e[1].id;
  for (const c of Object.values(r)) { const k = String(c.name || "").trim().toLowerCase(); if (k) (byName[k] = byName[k] || new Set()).add(c.id); }
  const out = {}, months = {}, weeks = {}, done = {}, labels = new Set(); let events = 0, matched = 0, next7 = 0;
  const in7 = new Date(Date.parse(today + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10);
  for (const ev of txt.split("BEGIN:VEVENT").slice(1)) {
    events++;
    const get = (k) => { const m = ev.match(new RegExp("^" + k + "[^:\\n]*:(.*)$", "m")); return m ? m[1].replace(/\\n/g, "\n").replace(/\\,/g, ",").trim() : ""; };
    if (/^CANCELLED$/i.test(get("STATUS"))) continue;
    const ds = get("DTSTART").replace(/[^0-9]/g, "").slice(0, 8);
    if (ds.length !== 8) continue;
    const d = ds.slice(0, 4) + "-" + ds.slice(4, 6) + "-" + ds.slice(6, 8);
    months[d.slice(0, 7)] = (months[d.slice(0, 7)] || 0) + 1;
    if (d <= today) done[d.slice(0, 7)] = (done[d.slice(0, 7)] || 0) + 1;
    { const dt = new Date(d + "T00:00:00Z"), wk = new Date(dt - ((dt.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); weeks[wk] = (weeks[wk] || 0) + 1; }
    if (d > today && d <= in7) next7++;
    const blob = (get("SUMMARY") + "\n" + get("DESCRIPTION")).toLowerCase();
    let id = null;
    for (const em of blob.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []) if (byEmail[em]) { id = byEmail[em]; break; }
    if (!id) { const first = (get("SUMMARY").split(/[:(\-]/)[0] || "").trim().toLowerCase().split(/\s+/)[0]; const set = byName[first]; if (set && set.size === 1) id = [...set][0]; }
    if (!id) continue;
    matched++;
    const b = (out[id] = out[id] || { last: "", next: "", dates: [], codes: {} });
    if (b.dates.length < 400) b.dates.push(d);
    { const tm = (v) => { const m = ev.match(new RegExp("^" + v + "([^:\\n]*):(\\d{8}T\\d{4,6}Z?)", "m")); if (!m) return ""; const x = m[2]; if (/Z$/.test(x)) { const dt = new Date(Date.UTC(+x.slice(0, 4), +x.slice(4, 6) - 1, +x.slice(6, 8), +x.slice(9, 11), +x.slice(11, 13))); return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(dt); } return x.slice(9, 11) + ":" + x.slice(11, 13); };
      b.slots = b.slots || {}; const st = tm("DTSTART"), en = tm("DTEND"); if (st) b.slots[d] = (b.slots[d] ? b.slots[d] + ", " : "") + st + (en ? "–" + en : ""); }
    { b.em = b.em || {}; const ems = blob.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || []; const k = ems[0] || "(no email)"; const q = (b.em[k] = b.em[k] || { past: 0, up: 0 }); if (d > today) q.up++; else q.past++; }
    const cc = (get("DESCRIPTION").match(/Certificate Code:\s*([A-Z0-9-]{4,20})/i) || [])[1];
    if (cc) { const desc = get("DESCRIPTION"); for (const m of desc.matchAll(/^\s*([A-Za-z][A-Za-z ]{1,30}):/gm)) labels.add(m[1].trim());
      const pn = (desc.match(/^\s*(?:package|product|purchased|certificate name)[^:\n]*:\s*(.+)$/im) || [])[1] || "";
      const ps = Number((pn.match(/(\d{1,2})\s*(?:x\s*)?(?:pt\s*|personal training\s*)?(?:sessions?|classes|pack)/i) || [])[1] || 0); }
    if (cc) { const k = cc.toUpperCase(), q = (b.codes[k] = b.codes[k] || { used: 0, booked: 0, first: d, last: d });
      { const desc = get("DESCRIPTION"), pn = (desc.match(/^\s*(?:package|product|purchased|certificate name)[^:\n]*:\s*(.+)$/im) || [])[1] || ""; const ps = Number((pn.match(/(\d{1,2})\s*(?:x\s*)?(?:pt\s*|personal training\s*)?(?:sessions?|classes|pack)/i) || [])[1] || 0); if (pn) q.name = pn.slice(0, 60); if (ps) q.size = ps; } if (d <= today) q.used++; else q.booked++; if (d < q.first) q.first = d; if (d > q.last) q.last = d; }
    if (d <= today) { if (d > b.last) b.last = d; } else if (!b.next || d < b.next) b.next = d;
  }
  acuityLast.events = events; acuityLast.matched = matched; acuityLast.packageLabels = [...labels].slice(0, 40);
  return { byId: out, months, weeks, done, next7 };
}
// package size from Acuity orders: the package bought most recently on/before the code was first used
function orderFor(orders, first) {
  const os = (orders || []).filter((o) => o && o.size && o.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!os.length) return null;
  let pick = null; for (const o of os) if (o.date <= first) pick = o;
  return pick || os[0];
}
function pkgSize(pk, orders, code, first, q, bs) {
  if (pk && pk.size && pk.code && pk.code === code) return { size: pk.size, src: "you" };
  const o = orderFor(orders, first);
  if (o) return { size: o.size, src: "acuity", name: o.name };
  return { size: (pk && pk.size) || q.size || (bs && bs.pkgSize) || 0, src: pk && pk.size ? "you" : "" };
}
async function acuityBookings(env, r) {
  if (env.ACUITY_ICAL) {
    if (acuityCache && Date.now() - acuityCache.at < 10 * 60 * 1000) return acuityCache.data;
    const saved = await getJSON(env, "_data/_acuity-cache.json", null);
    if (saved && Date.now() - saved.at < 30 * 60 * 1000) { acuityCache = saved; return saved.data; }
    const data = await acuityFromIcal(env, r || {});
    if (data) { acuityCache = { at: Date.now(), data }; await putJSON(env, "_data/_acuity-cache.json", acuityCache); }
    else if (saved) return saved.data;
    return data;
  }
  if (!env.ACUITY_USER_ID || !env.ACUITY_API_KEY) return null;
  if (acuityCache && Date.now() - acuityCache.at < 10 * 60 * 1000) return acuityCache.data;
  const today = londonToday();
  const qs = new URLSearchParams({ minDate: fromT(toT(today) - 60 * DAY_MS), maxDate: fromT(toT(today) + 60 * DAY_MS), max: "1000" });
  const res = await fetch("https://acuityscheduling.com/api/v1/appointments?" + qs, {
    headers: { authorization: "Basic " + btoa(env.ACUITY_USER_ID + ":" + env.ACUITY_API_KEY) },
    signal: AbortSignal.timeout(20000),
  });
  acuityLast = { status: res.status, at: new Date().toISOString() };
  if (!res.ok) { acuityLast.body = (await res.text().catch(() => "")).slice(0, 300); return null; }
  const appts = await res.json();
  acuityLast.count = Array.isArray(appts) ? appts.length : -1;
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

// ---- Stripe payments (webhook at /stripe/webhook, outside the login; every event is checked with STRIPE_WEBHOOK_SECRET) ----
async function verifyStripe(env, raw, header) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((x) => x.split("=")).filter((x) => x.length === 2 && x[0] !== "v1"));
  const sigs = header.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  const t = parts.t;
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 600 || !sigs.length) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}
async function stripeWebhook(request, env) {
  const raw = await request.text();
  if (!(await verifyStripe(env, raw, request.headers.get("stripe-signature")))) return new Response("bad signature", { status: 400 });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return new Response("bad", { status: 400 }); }
  const o = (ev.data && ev.data.object) || {};
  const key = "_data/_payments.json";
  const db = await getJSON(env, key, { byEmail: {}, customers: {} });
  const email = String((o.customer_details && o.customer_details.email) || o.customer_email || o.receipt_email || db.customers[o.customer] || "").trim().toLowerCase();
  if (o.customer && email) db.customers[o.customer] = email;
  const day = new Date(((o.created || ev.created || Date.now() / 1000)) * 1000).toISOString().slice(0, 10);
  const rec = email ? (db.byEmail[email] = db.byEmail[email] || { history: [] }) : null;
  const prevStatus = rec ? rec.status : "";
  const amt = (n) => (typeof n === "number" ? Math.round(n) / 100 : null);
  const add = (h) => { rec.history = [h, ...rec.history.filter((x) => x.id !== h.id)].slice(0, 30); };
  if (rec) {
    const toDay = (sec) => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : "");
    if (ev.type === "checkout.session.completed" && o.payment_status !== "unpaid") {
      add({ id: o.id, date: day, amount: amt(o.amount_total), kind: o.mode === "subscription" ? "first payment" : "one-off" });
      rec.status = o.mode === "subscription" ? "active" : "paid"; delete rec.failedAt; delete rec.cancelled; rec.lastPaid = day; rec.lastAmount = amt(o.amount_total); rec.started = rec.started || day;
    } else if (ev.type === "invoice.paid" && o.amount_paid > 0) {
      const line = (o.lines && o.lines.data || []).find((l) => l.period && l.period.end && (l.recurring || (l.price && l.price.recurring) || l.type === "subscription")) || (o.lines && o.lines.data || [])[0];
      if (!rec.history.some((x) => x.date === day && x.amount === amt(o.amount_paid))) add({ id: o.id, date: day, amount: amt(o.amount_paid), kind: "payment" });
      rec.status = "active"; delete rec.failedAt; delete rec.cancelled; rec.lastPaid = day; rec.lastAmount = amt(o.amount_paid); rec.started = rec.started || day;
      if (line && line.period && line.period.end) rec.next = toDay(line.period.end);
      if (line && line.description) rec.plan = String(line.description).replace(/^\d+\s*×\s*/, "").slice(0, 120);
    } else if (ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.created") {
      const end = o.current_period_end || (o.items && o.items.data && o.items.data[0] && o.items.data[0].current_period_end);
      if (end) rec.next = toDay(end);
      rec.endsOn = o.cancel_at_period_end ? toDay(o.cancel_at || end) : (o.cancel_at ? toDay(o.cancel_at) : "");
      if (o.status === "past_due" || o.status === "unpaid") { if (rec.status !== "failed") rec.failedAt = day; rec.status = "failed"; } else if (o.status === "active") { rec.status = "active"; delete rec.failedAt; }
    } else if (ev.type === "invoice.payment_failed") {
      add({ id: o.id, date: day, amount: amt(o.amount_due), kind: "FAILED payment" }); if (rec.status !== "failed") rec.failedAt = day; rec.status = "failed";
    } else if (ev.type === "customer.subscription.deleted") {
      rec.status = "cancelled"; rec.cancelled = day;
    }
    rec.updated = new Date().toISOString();
  }
  await putJSON(env, key, db);
  if (email && prevStatus === "cancelled" && ev.type === "checkout.session.completed" && o.payment_status !== "unpaid") {
    const nm = (o.customer_details && o.customer_details.name) || email;
    await sendMail(env, { subject: `🎉 ${nm} has restarted coaching`, heading: `<em style="color:#e6cf8b">${escH(nm)}</em> is back!`,
      lines: [`${nm} (${email}) just restarted their online coaching and paid £${amt(o.amount_total)}.`, "", "Their portal has reopened automatically, with all their old logs, photos and check-ins still there.", "", "Worth sending them a welcome back message, and checking their programme, targets and meal plan are still right."],
      button: { text: "Open Coach View", url: "https://mpfcoaching.co.uk/portal/coach/" } }).catch(() => {});
  }
  if (email && ev.type === "checkout.session.completed" && o.payment_status !== "unpaid" && o.mode === "subscription") {
    await autoEnrol(env, email, (o.customer_details && o.customer_details.name) || "").catch(() => {});
  }
  return new Response("ok");
}

// New paying online client: create their portal straight away (and let them log in, if an Access API token is set).
// Online clients who stop paying get locked out of their portal (data is kept). Face to face, "paid another way",
// and older clients with no Stripe record are never locked automatically. Coach can force lock or unlock per client.
async function lockState(env, client, r) {
  if (!client) return { locked: false };
  if (client.lock === "off") return { locked: false };
  if (client.lock === "on") return { locked: true, reason: "paused" };
  if (client.type === "pt" || client.payOk === true) return { locked: false };
  const pay = (await getJSON(env, "_data/_payments.json", { byEmail: {} })).byEmail || {};
  const emails = Object.entries(r).filter(([, x]) => x.id === client.id).map(([e]) => e.toLowerCase());
  const rec = emails.map((e) => pay[e]).filter(Boolean).sort((a, b) => String(b.updated).localeCompare(String(a.updated)))[0];
  if (!rec) return { locked: false };
  const today = londonToday();
  if (rec.status === "cancelled") return { locked: true, reason: "cancelled", since: rec.cancelled || "" };
  if (rec.status === "failed") {
    const since = rec.failedAt || String(rec.updated || "").slice(0, 10) || today;
    if ((toT(today) - toT(since)) / DAY_MS >= 7) return { locked: true, reason: "failed", since };
    return { locked: false, warn: "failed", since };
  }
  return { locked: false };
}
// Private calendar feed for one client's planner, so Google Calendar can subscribe to it ("From URL").
// The long random token in the link is the only key; it shows just their own plan (titles and times) and can be reset or turned off from their portal.
async function calFeed(env, url) {
  const token = url.pathname.slice(5, -4).replace(/[^a-f0-9]/g, "");
  const tk = await getJSON(env, "_data/_caltokens.json", {}), id = token.length >= 32 ? tk[token] : null;
  if (!id) return new Response("Not found", { status: 404 });
  const doc = await getJSON(env, `${dkey(id)}/schedule.json`, { items: [] });
  if (doc.token !== token) return new Response("Not found", { status: 404 });
  const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const em = { training: "🏋️", cardio: "🏃", mealprep: "🥗", walk: "🚶", stretch: "🧘", sleep: "😴", checkin: "✅", other: "⭐" };
  const BY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"], stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MPF Coaching//Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:MPF Coaching plan", "X-WR-TIMEZONE:Europe/London", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
    "BEGIN:VTIMEZONE", "TZID:Europe/London", "X-LIC-LOCATION:Europe/London",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100", "TZNAME:BST", "DTSTART:19700329T010000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000", "TZNAME:GMT", "DTSTART:19701025T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE"];
  for (const x of doc.items || []) {
    const [h, m] = (x.time || "07:00").split(":").map(Number), st = new Date(Date.UTC(2000, 0, 1, h, m)), en = new Date(st.getTime() + (x.dur || 60) * 60000);
    // a repeating item starts on its first matching weekday (the portal never shows it on a non-matching start date)
    let sd = x.date; if (x.days && x.days.length) for (let i = 0; i < 7; i++) { const dd = fromT(toT(x.date) + i * DAY_MS), wd = (new Date(toT(dd)).getUTCDay() + 6) % 7; if (x.days.includes(wd)) { sd = dd; break; } }
    if (x.days && x.days.length && x.until && sd > x.until) continue;
    const d = sd.replace(/-/g, ""), t = (z) => String(z.getUTCHours()).padStart(2, "0") + String(z.getUTCMinutes()).padStart(2, "0") + "00";
    const dayAdd = en.getUTCDate() !== st.getUTCDate() ? 1 : 0, ed = dayAdd ? fromT(toT(sd) + DAY_MS).replace(/-/g, "") : d;
    lines.push("BEGIN:VEVENT", `UID:${x.id}-${id}@mpfcoaching.co.uk`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/London:${d}T${t(st)}`, `DTEND;TZID=Europe/London:${ed}T${t(en)}`, `SUMMARY:${esc((em[x.type] || "") + " " + x.title)}`);
    if (x.notes) lines.push(`DESCRIPTION:${esc(x.notes)}`);
    if (x.days && x.days.length) lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${x.days.map((n) => BY[n]).join(",")}${x.until ? ";UNTIL=" + x.until.replace(/-/g, "") + "T235959Z" : ""}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // fold long lines at 75 bytes (RFC 5545), without splitting emoji or other multi-byte characters
  const enc = new TextEncoder(), fold = (l) => { if (enc.encode(l).length <= 75) return l; const out = []; let cur = "", n = 0, lim = 75; for (const ch of l) { const b = enc.encode(ch).length; if (n + b > lim) { out.push(cur); cur = " "; n = 1; lim = 75; } cur += ch; n += b; } out.push(cur); return out.join("\r\n"); };
  return new Response(lines.map(fold).join("\r\n") + "\r\n", { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
}
// add one email to the Cloudflare Access login policy (no emails are sent)
async function accessAllow(env, email) {
  if (!(env.CF_API_TOKEN && env.ACCESS_POLICY_ID && env.CF_ACCOUNT_ID)) return "not set up";
  try {
    const u = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/policies/${env.ACCESS_POLICY_ID}`;
    const h = { authorization: "Bearer " + env.CF_API_TOKEN, "content-type": "application/json" };
    const pol = (await (await fetch(u, { headers: h })).json()).result;
    if ((pol.include || []).some((x) => x.email && String(x.email.email).toLowerCase() === email)) return "already allowed";
    const body = { name: pol.name, decision: pol.decision, include: [...(pol.include || []), { email: { email } }], exclude: pol.exclude || [], require: pol.require || [] };
    if (pol.session_duration) body.session_duration = pol.session_duration;
    const res = await fetch(u, { method: "PUT", headers: h, body: JSON.stringify(body) });
    return res.ok ? "added" : "failed (" + res.status + ")";
  } catch (e) { return "failed"; }
}
async function autoEnrol(env, email, fullName) {
  const all = roster(env, await loadRoster(env, true));
  if (all[email]) return "already a client";
  const ro = (await getJSON(env, "_data/_roster.json", null)) || {};
  const name = String(fullName || email.split("@")[0]).replace(/\s+/g, " ").trim().slice(0, 60) || "New client";
  const taken = new Set(Object.values(all).map((c) => c.id));
  let base = name.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "client", id = base, n = 2;
  while (taken.has(id)) id = base + n++;
  ro[email] = { id, name, checkin: "Wednesday", start: londonToday(), phase: "Fat loss", active: true, type: "online", sex: "f", onboarded: false, phone: "", folder: "", auto: true };
  await putJSON(env, "_data/_roster.json", ro);
  rosterCache = null;
  let access = "not set up";
  if (env.CF_API_TOKEN && env.ACCESS_POLICY_ID && env.CF_ACCOUNT_ID) {
    try {
      const u = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/policies/${env.ACCESS_POLICY_ID}`;
      const h = { authorization: "Bearer " + env.CF_API_TOKEN, "content-type": "application/json" };
      const pol = (await (await fetch(u, { headers: h })).json()).result;
      const has = (pol.include || []).some((r) => r.email && String(r.email.email).toLowerCase() === email);
      if (!has) {
        const body = { name: pol.name, decision: pol.decision, include: [...(pol.include || []), { email: { email } }], exclude: pol.exclude || [], require: pol.require || [] };
        if (pol.session_duration) body.session_duration = pol.session_duration;
        const res = await fetch(u, { method: "PUT", headers: h, body: JSON.stringify(body) });
        access = res.ok ? "added" : "failed (" + res.status + ")";
      } else access = "already allowed";
    } catch (e) { access = "failed"; }
  }
  const result = access;
  const ok = access === "added" || access === "already allowed";
  const first = name.split(" ")[0];
  await sendMail(env, { subject: `New online client paid: ${name}`, heading: `New client: <em style="color:#e6cf8b">${escH(name)}</em>`,
    lines: [`${name} (${email}) has paid for online coaching. Their portal has been created automatically.`, "", `Login access: ${access}.` + (ok ? " They can log in now." : " Add their email to the Access policy so they can log in."), "", "Check their name and sex in the coach view, and message them a welcome."],
    button: { text: "Open coach view", url: SITE + "/portal/coach/" } }).catch(() => {});
  if (ok) await sendMail(env, { to: email, fromName: "Maria Paradise", subject: `Welcome to MPF Coaching, ${first}! Your portal is ready`,
    heading: `Welcome, <em style="color:#e6cf8b">${escH(first)}.</em>`,
    intro: "Thank you for joining my online coaching. I'm so excited to get started with you. Your client portal is ready.",
    lines: [`1. Tap the button below and log in with this email: ${email}`, "2. You'll get a 6-digit code from Cloudflare (the secure login I use). Type it in and you're in.", "3. Follow the steps in your portal, starting with your onboarding form. It takes about 10 minutes and it's what I build your plan from.", "", "Any questions, just reply to this email or message me on WhatsApp.", "", "Maria x"],
    button: { text: "Open my portal", url: SITE + "/login.html?paid=1" }, foot: "You're getting this because you signed up for MPF online coaching." }).catch(() => {});
  return result;
}

async function notifyCancel(env, client, doc) {
  await sendMail(env, { subject: `Cancellation request: ${client.name}`, heading: `Cancellation request: <em style="color:#e6cf8b">${escH(client.name)}</em>`,
    lines: [`${client.name} has asked to cancel their online coaching.`, "", `Reason: ${doc.reason || "(none given)"}`, "", `Cancel their subscription in Stripe (Customers > ${client.name} > Cancel subscription, at the end of the period), then message them to confirm.`],
    button: { text: "Open Stripe", url: "https://dashboard.stripe.com/subscriptions" } });
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/stripe/webhook" && request.method === "POST") return stripeWebhook(request, env).catch(() => new Response("error", { status: 500 }));
    if (url.pathname === "/api/recs" && request.method === "GET") return json(await getJSON(env, "_data/_recs.json", { items: [] }));
    if (url.pathname.startsWith("/cal/") && url.pathname.endsWith(".ics")) return calFeed(env, url).catch(() => new Response("error", { status: 500 }));
    if (url.pathname.startsWith("/portal/api/")) {
      try {
        return await handleApi(request, env, url, ctx);
      } catch (e) {
        return json({ error: "server" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutomations(env, {}).catch(() => {}));
  },
};

// ---- AI check-in drafts: when a client checks in, Claude writes a draft reply for Maria to edit. Never sent automatically. ----
// Needs the Cloudflare secret ANTHROPIC_API_KEY. Optional variable AI_MODEL to change the model.
const AI_SYSTEM = `You are drafting a weekly check-in reply for Maria Paradise, a UK personal trainer and online coach (MPF Coaching, fat loss and body recomp, evidence-based, flexible dieting). Maria will read and edit your draft before sending, so write it exactly as she would send it, in the first person as Maria, to the client.

How Maria writes check-in feedback:
- Warm, real, straight-talking big-sister energy. Proud of her clients and shows it ("so bloody proud of you"). Never corporate, never cheesy.
- British spelling and phrasing. Mild slang is fine (proper, knackered, bloody). No swearing beyond that.
- Absolutely no em dashes or en dashes. Use full stops, commas or line breaks.
- Short paragraphs, one idea each. Usually 150 to 350 words, longer if they wrote a lot. Covering everything they said matters more than keeping it short.
- Open with their name and a genuine reaction to their week. Pick out specific wins from their answers and numbers.
- Then the coaching: one or two clear, practical things to focus on next week, explained simply. Base them on their answers and numbers against their targets. Consistency over perfection, adjust the plan don't abandon it, the scale fluctuates (water, salt, carbs, stress, their cycle) so judge the trend.
- Respond to absolutely everything they wrote. Go through every single answer and reply to each point, nothing skipped, even one-word answers, questions they asked you and small details. If they asked Maria something, answer it or say she'll sort it.
- That includes personal things: work, family, relationships, kids, money stress, sleep, moving house, holidays, a hard week, how they feel about their body. Reply to these in the message too, the way a caring coach and friend would: name what they said, show you heard it, be kind and encouraging, and link it back to their goals where it helps (for example adjusting the plan around a busy week). Never ignore it or leave it only for the note. If they struggle with something (stress, a bad weekend, low energy), acknowledge it like a friend, no lecture.
- End warmly, signed "Maria x". A couple of emojis at most (💪🏼 🔥 🖤 ❤️‍🔥).
- Never invent numbers, events or plan changes. Never change their calories, macros or programme yourself. If a change might be needed, say you'll look at it ("I'm going to have a look at your calories and update you").
- Low intake: if their calories or protein look too low (against their targets, or simply low for an adult who trains, e.g. under about 1400 kcal or under about 100g protein when no targets are set), say so clearly in the reply as normal coaching. Explain they need to eat more to fuel their training, recover and hold on to muscle, that under-eating backfires, and give simple ways to get more in (protein at every meal, bigger portions, easy snacks). If no targets are set, say Maria will set their targets for them. ALSO mention it in the note so Maria can keep an eye on it.
- Never diagnose or give medical advice. If they mention pain, injury, illness or a medical issue, respond to it kindly and specifically in the reply (say you're sorry to hear it, that you'll work around it, and to let you know how it goes, or to get it checked if it sounds like it needs it) and put the detail in the note for Maria. If anything suggests they're struggling with food or their mood (guilt about eating, skipping meals on purpose, restricting, bingeing, feeling low), keep the reply warm and supportive without lecturing about numbers, and flag it clearly in the note.

Reply in exactly this format and nothing else:
<reply>
the message to the client
</reply>
<note>
a private heads-up for Maria, as short bullet points: every personal or sensitive thing the client mentioned (life, health, mood, injuries, relationships), anything she might want to follow up on or change (training, calories, a booking), and anything in the draft she should double check before sending. Leave it empty only if there is genuinely nothing
</note>`;

async function aiDraft(env, r, c, due) {
  if (!env.ANTHROPIC_API_KEY) return { error: "no-key" };
  const key = `${dkey(c.id)}/checkins.json`;
  const all = await getJSON(env, key, {});
  const ci = all[due];
  if (!ci) return { error: "no check-in" };
  const ks = Object.keys(all).sort(), pk = ks.filter((k) => k < due).pop();
  const targets = await getJSON(env, `${dkey(c.id)}/targets.json`, null) || {};
  const Q = ci.questions || QUESTIONS;
  const qa = (ci.answers || []).map((a, i) => (String(a || "").trim() ? `Q: ${Q[i] || "Question " + (i + 1)}\nA: ${a}` : "")).filter(Boolean).join("\n\n") || "(no written answers)";
  const fmt = (s) => Object.entries(s || {}).filter(([, v]) => v !== null && v !== "" && v !== undefined).map(([k, v]) => `${k}: ${v}`).join(", ") || "(none)";
  const tg = Object.entries(targets).filter(([k, v]) => v && !["updated", "notes", "hlOn", "hiDays"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(", ") || "(not set)";
  const past = ks.filter((k) => k < due && all[k].reply && all[k].reply.text).slice(-3).map((k) => all[k].reply.text);
  const first = String(c.name || "").split(" ")[0];
  const ex = await weekExtra(env, c, due, await getJSON(env, `${dkey(c.id)}/summary.json`, {})).catch(() => null) || {};
  const exl = [
    ex.wChange != null ? `Average weight change vs last week: ${ex.wChange > 0 ? "+" : ""}${ex.wChange} kg` : "",
    ex.totalChange != null ? `Weight change since their first weigh-in on the portal (${ex.startDate}): ${ex.totalChange > 0 ? "+" : ""}${ex.totalChange} kg` : "",
    `Training days logged this week: ${ex.trained ?? "?"}/7`, ex.cardio != null ? `Cardio this week: ${ex.cardio} mins` : "",
    ex.water != null ? `Average water: ${ex.water} L` : "", ex.offPlan ? `Off-plan meals logged: ${ex.offPlan}` : "",
    ex.period ? `Days on their period this week: ${ex.period} (can explain water retention and scale jumps; mention gently only if relevant)` : "",
    ["energy", "mood", "stress", "hunger", "adherence"].filter((k) => ex[k] != null).map((k) => `${k} ${ex[k]}/10`).join(", ") ? `Average daily scores out of 10: ${["energy", "mood", "stress", "hunger", "adherence"].filter((k) => ex[k] != null).map((k) => `${k} ${ex[k]}`).join(", ")}` : "",
    ex.photos != null ? `Progress photos uploaded this week: ${ex.photos ? "yes" : "no"}` : "",
  ].filter(Boolean).join("\n");
  const user = [
    `Client first name: ${first}`,
    `Client type: ${c.type === "pt" ? "face-to-face PT client (trains with Maria in the gym)" : "online coaching client"}`,
    c.phase ? `Phase: ${c.phase}` : "",
    ex.isNew ? "NEW CLIENT: this is one of their first weeks with Maria, so welcome them." : "EXISTING CLIENT: they have been coached by Maria for a while and have only just moved onto her new portal. Do NOT welcome them, call them new, or treat this as their first week.",
    `Week ending: ${due}`,
    `Their daily targets: ${tg}`,
    `This week's averages from their daily log (weight kg, daysLogged out of 7, cals, protein g, steps, sleep h, change = kg vs last week): ${fmt(ci.stats)}`,
    pk ? `Last week's averages: ${fmt(all[pk].stats)}` : "No previous check-in.",
    exl ? `More from their daily log this week:\n${exl}` : "",
    `Their check-in answers:\n${qa}`,
    past.length ? `Maria's last replies to this client, for her tone (don't repeat them):\n${past.map((t) => "---\n" + t).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.AI_MODEL || "claude-sonnet-5-5", max_tokens: 2500, system: AI_SYSTEM, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return { error: "api " + res.status };
  const j = await res.json().catch(() => null);
  const raw = ((j && j.content) || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  let reply = "", note = "";
  const tag = (n) => { const m = raw.match(new RegExp("<" + n + ">([\\s\\S]*?)(?:</" + n + ">|$)")); return m ? m[1].trim() : null; };
  reply = tag("reply"); note = tag("note") || "";
  if (reply == null) {
    // fallbacks: JSON-shaped output, or plain text
    try { const m = raw.match(/\{[\s\S]*\}/); const o = JSON.parse(m ? m[0] : raw); reply = String(o.reply || ""); note = String(o.note || ""); }
    catch (e) { const m = raw.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"note"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/); if (m) { reply = m[1]; note = m[2]; } else reply = raw.replace(/^\s*\{\s*"reply"\s*:\s*"?/, ""); }
    reply = reply.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  if (/^\s*<note>/.test(reply)) reply = "";
  const clean = (t) => t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
  reply = clean(reply).slice(0, 5000); note = clean(note).slice(0, 1500);
  if (!reply) return { error: "empty" };
  // re-read so we never overwrite a reply Maria sent while the draft was being written
  const fresh = await getJSON(env, key, {});
  if (!fresh[due]) return { error: "no check-in" };
  const draft = { text: reply, note, at: new Date().toISOString() };
  if (!(fresh[due].reply && fresh[due].reply.text)) { fresh[due].draft = draft; await putJSON(env, key, fresh); }
  return { draft };
}

// ---- business dashboard ----
async function stripeGet(env, path) {
  const res = await fetch("https://api.stripe.com/v1/" + path, { headers: { authorization: "Bearer " + env.STRIPE_READ_KEY }, signal: AbortSignal.timeout(20000) });
  const j = await res.json(); if (!res.ok) throw new Error("stripe " + res.status + " " + ((j.error && j.error.message) || "").slice(0, 120)); return j;
}
async function stripeMoney(env) {
  const now = new Date(), y0 = Date.UTC(now.getUTCFullYear() - 1, 0, 1) / 1000;
  const months = {}, taxYears = {}; let after = "", n = 0;
  const m = (ts) => new Date(ts * 1000).toISOString().slice(0, 7);
  const ty = (ts) => { const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts * 1000)); const y = +d.slice(0, 4), md = d.slice(5); const start = md >= "04-06" ? y : y - 1; return start + "/" + String(start + 1).slice(2); };
  while (n < 40) {
    const j = await stripeGet(env, `balance_transactions?limit=100&created[gte]=${y0}${after ? "&starting_after=" + after : ""}`);
    for (const t of j.data) {
      if (!["charge", "payment", "refund", "payment_refund", "adjustment", "payment_failure_refund"].includes(t.type)) continue;
      const k = m(t.created), o = (months[k] = months[k] || { gross: 0, refunds: 0, fees: 0, net: 0, count: 0 });
      const tk = ty(t.created), q = (taxYears[tk] = taxYears[tk] || { gross: 0, refunds: 0, fees: 0, net: 0, count: 0 });
      for (const x of [o, q]) { if (t.amount >= 0) { x.gross += t.amount; x.count++; } else x.refunds += -t.amount; x.fees += t.fee; x.net += t.net; }
      if (t.amount > 0) { const kind = /subscri|invoice/i.test(t.description || "") ? "online" : "other"; o[kind] = (o[kind] || 0) + t.amount; }
    }
    n++; if (!j.has_more || !j.data.length) break; after = j.data[j.data.length - 1].id;
  }
  for (const o of [...Object.values(months), ...Object.values(taxYears)]) for (const k of ["gross", "refunds", "fees", "net", "online", "other"]) if (o[k] != null) o[k] = Math.round(o[k]) / 100;
  let mrr = 0, subs = 0, pastDue = 0, cancelling = 0; const plans = {};
  let sa = "";
  for (let i = 0; i < 10; i++) {
    const j = await stripeGet(env, `subscriptions?status=all&limit=100${sa ? "&starting_after=" + sa : ""}`);
    for (const sb of j.data) {
      if (sb.status === "past_due" || sb.status === "unpaid") pastDue++;
      if (sb.status !== "active" && sb.status !== "past_due") continue;
      subs++; if (sb.cancel_at_period_end || sb.cancel_at) cancelling++;
      for (const it of (sb.items && sb.items.data) || []) {
        const pr = it.price || {}, rc = pr.recurring || {}; if (!rc.interval) continue;
        const per = rc.interval === "month" ? rc.interval_count : rc.interval === "year" ? 12 * rc.interval_count : rc.interval === "week" ? rc.interval_count / 4.345 : rc.interval_count / 30.4;
        const v = ((pr.unit_amount || 0) * (it.quantity || 1)) / 100 / per; mrr += v;
        const lbl = rc.interval_count === 1 && rc.interval === "month" ? "Monthly" : rc.interval_count + " " + rc.interval + "s"; plans[lbl] = (plans[lbl] || 0) + 1;
      }
    }
    if (!j.has_more || !j.data.length) break; sa = j.data[j.data.length - 1].id;
  }
  const bal = await stripeGet(env, "balance").catch(() => null);
  const gbp = (arr) => ((arr || []).filter((x) => x.currency === "gbp").reduce((t, x) => t + x.amount, 0)) / 100;
  return { months, taxYears, mrr: Math.round(mrr * 100) / 100, subs, pastDue, cancelling, plans, balance: bal ? { available: gbp(bal.available), pending: gbp(bal.pending) } : null };
}
async function businessStats(env, r, fresh) {
  const today = londonToday(), mon = today.slice(0, 7);
  let money = null, source = "webhook", err = null;
  if (env.STRIPE_READ_KEY) {
    const cache = fresh ? null : await getJSON(env, "_data/_business-cache.json", null);
    if (cache && Date.now() - cache.at < 15 * 60 * 1000) { money = cache.money; source = "stripe"; }
    else { try { money = await stripeMoney(env); source = "stripe"; await putJSON(env, "_data/_business-cache.json", { at: Date.now(), money }); } catch (e) { err = String(e).slice(0, 160); if (cache) { money = cache.money; source = "stripe"; } } }
  }
  const pay = (await getJSON(env, "_data/_payments.json", { byEmail: {} })).byEmail || {};
  if (!money) {
    const months = {}, taxYears = {};
    for (const rec of Object.values(pay)) for (const h of rec.history || []) {
      if (h.amount == null || !h.date || /FAILED/.test(h.kind || "")) continue;
      const k = h.date.slice(0, 7), y = +h.date.slice(0, 4), st = h.date.slice(5) >= "04-06" ? y : y - 1, tk = st + "/" + String(st + 1).slice(2);
      for (const o of [(months[k] = months[k] || { gross: 0, refunds: 0, fees: null, net: null, count: 0 }), (taxYears[tk] = taxYears[tk] || { gross: 0, refunds: 0, fees: null, net: null, count: 0 })]) { o.gross += h.amount; o.count++; }
    }
    const act = Object.values(pay).filter((x) => x.status === "active");
    money = { months, taxYears, mrr: null, subs: act.length, pastDue: Object.values(pay).filter((x) => x.status === "failed").length, cancelling: Object.values(pay).filter((x) => x.endsOn).length, plans: {}, balance: null };
  }
  const seen = new Set(), list = Object.entries(r).filter(([, c]) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const nameOf = {}; for (const [e, c] of Object.entries(r)) nameOf[e.toLowerCase()] = c.name;
  const act = list.filter(([, c]) => c.active !== false);
  const clients = { online: act.filter(([, c]) => c.type !== "pt").length, pt: act.filter(([, c]) => c.type === "pt").length,
    newThisMonth: act.filter(([, c]) => String(c.start || "").slice(0, 7) === mon).map(([, c]) => c.name),
    notOnboarded: act.filter(([, c]) => c.type !== "pt" && c.onboarded !== true).map(([, c]) => c.name) };
  const in14 = new Date(Date.parse(today + "T00:00:00Z") + 14 * 86400000).toISOString().slice(0, 10);
  const people = Object.entries(pay).map(([e, x]) => ({ name: nameOf[e] || e, email: e, ...x }));
  const renewals = people.filter((x) => x.status === "active" && x.next && x.next >= today && x.next <= in14 && !x.endsOn).map((x) => ({ name: x.name, date: x.next, amount: x.lastAmount })).sort((a, b) => a.date.localeCompare(b.date));
  const failed = people.filter((x) => x.status === "failed").map((x) => ({ name: x.name, since: x.updated ? x.updated.slice(0, 10) : "" }));
  const ending = people.filter((x) => x.endsOn && x.status !== "cancelled").map((x) => ({ name: x.name, date: x.endsOn }));
  const cancelReqs = [];
  for (const [, c] of list) { const d = await getJSON(env, `${dkey(c.id)}/cancel.json`, null); if (d && d.at) cancelReqs.push({ name: c.name, date: String(d.at).slice(0, 10), reason: d.reason || "" }); }
  const acu = await acuityBookings(env, r).catch(() => null);
  const sources = {}, roster2 = [];
  await Promise.all(list.map(async ([e, c]) => {
    let src = c.source || "";
    if (!src) { const ob = await getJSON(env, `${dkey(c.id)}/onboarding.json`, null); src = (ob && ob.answers && ob.answers.heard) || ""; }
    roster2.push({ id: c.id, email: e, name: c.name, type: c.type === "pt" ? "pt" : "online", start: c.start || "", active: c.active !== false, source: src });
    if (c.active !== false) sources[src || "Unknown"] = (sources[src || "Unknown"] || 0) + 1;
  }));
  const settings = await getJSON(env, "_data/_biz-settings.json", {});
  const expenses = (await getJSON(env, "_data/_expenses.json", { items: [] })).items || [];
  const leads = (await getJSON(env, "_data/_leads.json", { items: [] })).items || [];
  const gcal = await gcalBlocked(env).catch(() => null);
  return { today, source, err, money, clients, renewals, failed, ending, cancelReqs, pt: acu && acu.months ? { months: acu.months, done: acu.done || {}, weeks: acu.weeks || {}, next7: acu.next7 } : null, sources, roster: roster2, settings, expenses, leads, gcal };
}

// ---- automations (daily job) ----
const AUTO_RULES = ["checkinDue", "checkinLate", "notLogged", "paymentFailed"];
async function runAutomations(env, opt) {
  opt = opt || {};
  const cfg = await getJSON(env, "_data/_automation.json", { enabled: {} });
  const today = londonToday(), r = roster(env, await loadRoster(env, true));
  const sentKey = "_data/_automation-sent.json", sent = await getJSON(env, sentKey, {});
  const logKey = "_data/_automation-log.json", log = await getJSON(env, logKey, { items: [] });
  const pay = ((await getJSON(env, "_data/_payments.json", { byEmail: {} })).byEmail) || {};
  const first = (c) => String(c.name || "").split(" ")[0] || "there";
  const T = {
    checkinDue: (c) => ({ subject: `${first(c)}, your check-in is due today`, heading: `Check-in <em style="color:#e6cf8b">day.</em>`, intro: `Hi ${first(c)}, it's your weekly check-in day.`, lines: ["Upload your front, side and back photos and answer your check-in questions in the portal. It only takes a few minutes, and it's how I adjust your plan.", "", "Maria x"], button: { text: "Do my check-in", url: SITE + "/portal/#checkin" } }),
    checkinLate: (c) => ({ subject: `${first(c)}, I haven't had your check-in yet`, heading: `Quick <em style="color:#e6cf8b">reminder.</em>`, intro: `Hi ${first(c)}, your check-in was due yesterday and I haven't seen it come through.`, lines: ["Send it when you can so I can give you your feedback. If you've had a tough week, that's exactly when I want to hear from you.", "", "Maria x"], button: { text: "Send my check-in", url: SITE + "/portal/#checkin" } }),
    notLogged: (c) => ({ subject: `${first(c)}, don't forget your daily log`, heading: `How's it <em style="color:#e6cf8b">going?</em>`, intro: `Hi ${first(c)}, I've noticed your daily log hasn't been filled in for a couple of days.`, lines: ["Pop in your weight, food and steps when you get a minute. Missed days can be filled in by tapping the day in the row.", "", "Maria x"], button: { text: "Open my log", url: SITE + "/portal/" } }),
    paymentFailed: (c) => ({ subject: `${first(c)}, your coaching payment didn't go through`, heading: `Payment <em style="color:#e6cf8b">issue.</em>`, intro: `Hi ${first(c)}, your latest coaching payment didn't go through.`, lines: ["This is usually an expired or replaced card. Stripe will have emailed you a link to update it, or reply to this email and I'll send you a new one.", "", "Maria x"], button: { text: "Open my portal", url: SITE + "/portal/" } }),
  };
  const res = { sent: 0, skipped: 0, errors: 0, items: [] };
  if (opt.testTo) { const t = T[opt.rule] || T.checkinDue; try { await sendMail(env, { to: opt.testTo, fromName: "Maria Paradise", ...t({ name: "Jade" }) }); res.sent = 1; } catch (e) { res.errors = 1; } return res; }
  const seen = new Set();
  for (const [email, c] of Object.entries(r)) {
    if (seen.has(c.id) || c.active === false || /\+test@|\+paytest@/.test(email)) continue; seen.add(c.id);
    const prefs = await getJSON(env, `${dkey(c.id)}/prefs.json`, { reminders: true }); if (prefs.reminders === false) continue;
    const sm = await getJSON(env, `${dkey(c.id)}/summary.json`, {}), st = checkinStatus(c, sm, today), last = (sm.logged || []).slice(-1)[0] || "";
    const due = [];
    if (cfg.enabled.checkinDue && st.dueToday) due.push(["checkinDue", today]);
    if (cfg.enabled.checkinLate && st.late && (toT(today) - toT(st.due)) / DAY_MS === 1) due.push(["checkinLate", st.due]);
    if (cfg.enabled.notLogged && c.onboarded === true && last && (toT(today) - toT(last)) / DAY_MS >= 2 && (toT(today) - toT(last)) / DAY_MS <= 14) due.push(["notLogged", fromT(toT(today) - ((toT(today) / DAY_MS) % 3) * DAY_MS)]);
    const p = pay[email.toLowerCase()];
    if (cfg.enabled.paymentFailed && p && p.status === "failed") due.push(["paymentFailed", (p.updated || "").slice(0, 10)]);
    for (const [rule, mark] of due) {
      const k = `${rule}:${c.id}:${mark}`; if (sent[k]) { res.skipped++; continue; }
      try { await sendMail(env, { to: email, fromName: "Maria Paradise", ...T[rule](c) }); sent[k] = today; res.sent++; res.items.push({ rule, id: c.id, name: c.name, ok: true }); }
      catch (e) { try { await sendMail(env, { to: email, fromName: "Maria Paradise", ...T[rule](c) }); sent[k] = today; res.sent++; res.items.push({ rule, id: c.id, name: c.name, ok: true, retried: true }); } catch (e2) { res.errors++; res.items.push({ rule, id: c.id, name: c.name, ok: false, err: String(e2).slice(0, 80) }); } }
    }
  }
  const cut = fromT(toT(today) - 60 * DAY_MS); for (const [k, d] of Object.entries(sent)) if (d < cut) delete sent[k];
  await putJSON(env, sentKey, sent);
  log.items = [...res.items.map((x) => ({ ...x, at: new Date().toISOString() })), { at: new Date().toISOString(), summary: true, sent: res.sent, skipped: res.skipped, errors: res.errors }, ...log.items].slice(0, 300);
  await putJSON(env, logKey, log);
  if (res.errors) await sendMail(env, { subject: "Portal reminders: some emails failed", heading: "Some reminders <em style=\"color:#e6cf8b\">failed.</em>", lines: [`${res.errors} reminder email(s) could not be sent today, even after a retry. Check Settings → Reminder log in your coach view.`] }).catch(() => {});
  return res;
}
// ---- Google Calendar (secret iCal address): blocked days for PT capacity ----
async function gcalBlocked(env) {
  if (!env.GCAL_ICAL) return null;
  const cached = await getJSON(env, "_data/_gcal-cache.json", null);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.data;
  const res = await fetch(String(env.GCAL_ICAL).replace(/^webcal:/i, "https:"), { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res || !res.ok) return cached ? cached.data : { error: "fetch" };
  const txt = (await res.text()).replace(/\r?\n[ \t]/g, ""), today = londonToday(), hi = fromT(toT(today) + 70 * DAY_MS), lo = fromT(toT(today) - 7 * DAY_MS);
  const days = {};
  for (const ev of txt.split("BEGIN:VEVENT").slice(1)) {
    const g = (k) => { const m = ev.match(new RegExp("^" + k + "([^:\\n]*):(.*)$", "m")); return m ? { p: m[1], v: m[2].trim() } : null; };
    const ds = g("DTSTART"), de = g("DTEND"), sum = (g("SUMMARY") || { v: "" }).v.replace(/\\,/g, ",").slice(0, 80);
    if (!ds) continue; const allDay = /VALUE=DATE/.test(ds.p) || /^\d{8}$/.test(ds.v); if (!allDay && !/holiday|off|away|annual leave|unavailable|day off/i.test(sum)) continue;
    const a = ds.v.slice(0, 8), b = de ? de.v.slice(0, 8) : a; const s0 = `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}`; let e0 = `${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6, 8)}`; if (allDay && e0 > s0) e0 = fromT(toT(e0) - DAY_MS);
    for (let t = toT(s0); t <= toT(e0) && t <= toT(hi); t += DAY_MS) { const d = fromT(t); if (d >= lo) (days[d] = days[d] || []).push(sum || "Busy"); }
  }
  const data = { days, at: new Date().toISOString() }; await putJSON(env, "_data/_gcal-cache.json", { at: Date.now(), data }); return data;
}
