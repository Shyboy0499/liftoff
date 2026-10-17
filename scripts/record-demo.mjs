// Records the Liftoff demo video: a scripted walkthrough of the app with
// captions, title cards and a visible cursor, captured as 1080p H.264.
//
//   npm run build && npm run demo:record                 # saved sample result
//   ANTHROPIC_API_KEY=... npm run build && npm start      # then, in another terminal:
//   npm run demo:record -- --url http://localhost:8787    # live Claude result
//
// Needs ffmpeg on PATH. Writes demo/liftoff-demo.mp4 by default.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]?.startsWith("--") ? "1" : (all[i + 1] ?? "1")]);
    return acc;
  }, []),
);
const OUT = args.out ?? "demo/liftoff-demo.mp4";
let URL = args.url ?? "http://localhost:4173/";
const FPS = 30;
const VIEW = { width: 1440, height: 810 };
const SCALE = 1920 / VIEW.width;

// ---- Start a preview server if nothing is listening ---------------------
let preview = null;
async function reachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}
if (!(await reachable(URL))) {
  if (args.url) throw new Error(`Nothing is running at ${URL}`);
  console.log("Starting vite preview on :4173 (run `npm run build` first)…");
  preview = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { stdio: "ignore" });
  for (let i = 0; i < 40 && !(await reachable(URL)); i++) await new Promise((r) => setTimeout(r, 250));
  if (!(await reachable(URL))) throw new Error("vite preview did not start");
}

// ---- Browser + frame capture --------------------------------------------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, colorScheme: "light" });
const page = await context.newPage();

// The sample patient is always on day 2; pin the time of day so the pill
// clock shows the afternoon.
const now = new Date();
now.setHours(13, 40, 0, 0);
await page.clock.setFixedTime(now);

// Capture to a near-lossless file with a fast encoder so the browser keeps
// the CPU; the final 1080p encode happens after the walkthrough.
mkdirSync(path.dirname(OUT), { recursive: true });
const RAW = path.join(os.tmpdir(), `liftoff-demo-${process.pid}.mkv`);
const ffmpeg = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
   "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", RAW],
  { stdio: ["pipe", "inherit", "inherit"] },
);

// Chrome sends screencast frames only when the screen changes, so a fixed
// clock re-sends the latest frame to keep the output at a constant 30 fps.
const cdp = await context.newCDPSession(page);
let latest = null;
cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
  latest = Buffer.from(data, "base64");
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
let started = 0;
let written = 0;
let recording = false;
const pump = setInterval(() => {
  if (!recording || !latest) return;
  const due = Math.floor(((performance.now() - started) / 1000) * FPS);
  while (written < due) {
    ffmpeg.stdin.write(latest);
    written++;
  }
}, 1000 / FPS / 2);

// ---- Overlay: captions, title cards, cursor -------------------------------
const OVERLAY_CSS = `
.rec-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483646;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:opacity .2s}
.rec-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #F2541B;z-index:2147483645;pointer-events:none;animation:rec-ring .5s ease-out forwards}
@keyframes rec-ring{from{transform:scale(.3);opacity:1}to{transform:scale(1.25);opacity:0}}
.rec-caption{position:fixed;left:50%;bottom:30px;pointer-events:none;transform:translate(-50%,12px);z-index:2147483640;max-width:1020px;width:max-content;box-sizing:border-box;padding:14px 24px;border-radius:14px;background:rgba(10,20,38,.9);color:#fff;font:600 23px/1.35 "IBM Plex Sans",system-ui,sans-serif;text-align:center;box-shadow:0 18px 40px -16px rgba(0,0,0,.6);opacity:0;transition:opacity .35s,transform .35s}
.rec-caption.on{opacity:1;transform:translate(-50%,0)}
.rec-caption b{color:#FF7A45;font-weight:600}
.rec-card{position:fixed;inset:0;z-index:2147483644;pointer-events:none;display:grid;place-items:center;text-align:center;color:#EAF0F8;background:radial-gradient(1100px 420px at 50% 115%,rgba(242,84,27,.35),transparent 65%),#12203A;opacity:0;transition:opacity .6s}
.rec-card.on{opacity:1}
.rec-card .k{font:500 18px/1 "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#93A6C2}
.rec-card h1{margin:18px 0 10px;font:700 150px/.9 "Saira Condensed",sans-serif;letter-spacing:.14em}
.rec-card h2{margin:0;font:700 46px/1.05 "Saira Condensed",sans-serif;text-transform:uppercase;letter-spacing:.02em}
.rec-card p{margin:22px auto 0;max-width:900px;font:400 28px/1.45 "IBM Plex Sans",sans-serif;color:#C9D5E6}
.rec-card ul{list-style:none;margin:26px auto 0;padding:0;display:flex;flex-direction:column;gap:10px;font:500 22px/1.3 "IBM Plex Sans",sans-serif;color:#C9D5E6}
.rec-card li::before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:#F2541B;margin-right:12px;vertical-align:middle}
.rec-rocket{width:96px;height:96px;margin:0 auto}
`;
const ROCKET = `<svg class="rec-rocket" viewBox="0 0 24 24"><path d="M10 17.2h4l-.7 2.9L12 22.6l-1.3-2.5z" fill="#F2541B"/><path d="M7.6 12.4 4.9 15.6v2.6l2.7-1.5z" fill="#93A6C2"/><path d="M16.4 12.4l2.7 3.2v2.6l-2.7-1.5z" fill="#93A6C2"/><path d="M12 1.6c3.1 2.6 4.6 6.2 4.6 10.8v4.8H7.4v-4.8c0-4.6 1.5-8.2 4.6-10.8z" fill="#EAF0F8"/><circle cx="12" cy="9.4" r="1.9" fill="#12203A"/></svg>`;

async function installOverlay() {
  await page.evaluate(
    ({ css }) => {
      if (document.getElementById("rec-style")) return;
      const style = document.createElement("style");
      style.id = "rec-style";
      style.textContent = css;
      document.head.append(style);
      const cursor = document.createElement("div");
      cursor.className = "rec-cursor";
      cursor.innerHTML =
        '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11.5-6.6 1 3.9 7.3-3 1.6-3.9-7.4L4 21z" fill="#132033" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.append(cursor);
      const caption = document.createElement("div");
      caption.className = "rec-caption";
      document.body.append(caption);
      const card = document.createElement("div");
      card.className = "rec-card";
      document.body.append(card);
      document.addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      }, true);
      document.addEventListener("mousedown", (e) => {
        const ring = document.createElement("div");
        ring.className = "rec-ring";
        ring.style.left = e.clientX + "px";
        ring.style.top = e.clientY + "px";
        document.body.append(ring);
        setTimeout(() => ring.remove(), 600);
      }, true);
    },
    { css: OVERLAY_CSS },
  );
}

const beat = (ms) => page.waitForTimeout(ms);

async function caption(html, hold = 0) {
  await page.evaluate((h) => {
    const el = document.querySelector(".rec-caption");
    el.classList.remove("on");
    setTimeout(() => {
      el.innerHTML = h;
      if (h) el.classList.add("on");
    }, h && el.innerHTML ? 250 : 0);
  }, html);
  if (hold) await beat(hold);
}

async function card(html, hold, { stay = false } = {}) {
  await page.evaluate((h) => {
    const el = document.querySelector(".rec-card");
    el.innerHTML = h;
    el.classList.add("on");
  }, html);
  await beat(hold);
  if (stay) return;
  await page.evaluate(() => document.querySelector(".rec-card").classList.remove("on"));
  await beat(650);
}

let mouse = { x: VIEW.width * 0.62, y: VIEW.height * 0.7 };
async function glide(x, y) {
  const dist = Math.hypot(x - mouse.x, y - mouse.y);
  const steps = Math.min(Math.max(Math.round(dist / 14), 8), 45);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(mouse.x + (x - mouse.x) * e, mouse.y + (y - mouse.y) * e);
    await beat(12);
  }
  mouse = { x, y };
}
async function moveTo(locator, { dx = 0, dy = 0 } = {}) {
  let box = await locator.boundingBox();
  if (!box) throw new Error(`Not visible: ${locator}`);
  // Keep targets clear of the top bar and the caption.
  if (box.y < 80 || box.y + box.height > VIEW.height - 130) {
    await scrollTo(locator, "center");
    box = await locator.boundingBox();
  }
  await glide(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}
async function click(locator, opts) {
  await moveTo(locator, opts);
  await beat(140);
  await page.mouse.down();
  await beat(60);
  await page.mouse.up();
}
async function scrollTo(locator, block = "center") {
  await locator.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await beat(900);
}
async function scrollTop() {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await beat(900);
}

// ---- The walkthrough -------------------------------------------------------
await page.goto(URL);
await page.waitForSelector("#scan-button");
await page.evaluate(() => document.fonts.ready);
await installOverlay();
await page.evaluate(() => document.querySelector(".rec-card").classList.add("on"));
await page.evaluate(() => document.querySelector(".rec-cursor").style.opacity = "0");
await beat(300);

// Screencast frames come at the layout size (1440x810); ffmpeg scales them
// to 1080p. Rendering at a higher device scale still smooths the text.
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
await beat(300);
started = performance.now();
recording = true;

await card(
  `<div>${ROCKET}<h1>LIFTOFF</h1><h2>Every recovery needs a launchpad.</h2><p class="k" style="font-size:18px;margin-top:28px">DSH Hacks V2 · AI x Healthcare</p></div>`,
  3800,
);
await card(
  `<div><p class="k">The problem</p><p style="font-size:36px;color:#EAF0F8;max-width:1000px;line-height:1.35">After surgery, patients go home with pages of dense instructions, right when they're tired, in pain, and starting new medicines.</p><p>Miss a warning sign or a dose and recovery goes off course.</p></div>`,
  5200,
);
await page.evaluate(() => document.querySelector(".rec-cursor").style.opacity = "1");
await page.mouse.move(mouse.x, mouse.y);

await caption("Liftoff turns <b>discharge papers</b> into a recovery plan you can actually follow.", 3400);
await click(page.locator("#scan-button"));
await caption("Claude reads the papers…", 2200);
await caption("…then plain code checks that <b>every item</b> really appears in them. No match, no trust.");
await page.waitForSelector("#launch-button:not([disabled])", { timeout: 180_000 });
await beat(1600);
await moveTo(page.locator(".scan-stats .stat-ok"));
await beat(1400);

await click(page.locator("#launch-button"));
await caption("Recovery becomes a mission: <b>day by day</b>, all the way to full activity.", 2600);
await moveTo(page.locator(".milestone").nth(1));
await beat(900);
await moveTo(page.locator(".milestone").nth(3));
await beat(900);
await caption("Every milestone comes straight from the papers. Tap any day to preview it.");
const profile = page.locator(".profile-svg");
const pbox = await profile.boundingBox();
await glide(pbox.x + pbox.width * 0.5, pbox.y + pbox.height * 0.62);
await beat(400);
await page.mouse.down();
await page.mouse.up();
await beat(1800);
await click(page.locator(".preview-bar button"));
await beat(600);

await caption("Today's checklist: tick things off and the <b>fuel bar</b> fills up.");
await scrollTo(page.locator(".checklist"), "start");
const ticks = page.locator("button.tick:not([disabled])");
for (let i = 0; i < 4; i++) {
  await click(ticks.nth(i));
  await beat(350);
}
await scrollTo(page.locator(".pips").first(), "center");
const pips = page.locator("button.pip");
for (let i = 0; i < 2; i++) {
  await click(pips.nth(i));
  await beat(250);
}
for (let i = 3; i < 6; i++) {
  await click(pips.nth(i));
  await beat(250);
}
await beat(600);

await caption("A 24-hour pill clock shows every dose, and what's due next.");
await scrollTo(page.locator(".medicines"), "start");
await moveTo(page.locator(".pill-clock"));
await beat(1200);
await moveTo(page.locator(".next-dose strong"));
await beat(1800);

await caption("Tap <b>Source</b> on anything to see the exact line your care team wrote.");
await click(page.locator(".med .source-chip").first());
await beat(2200);
await moveTo(page.locator(".med .source-chip").nth(2));
await beat(1800);
await scrollTo(page.locator(".checklist .task").nth(3), "center");
await moveTo(page.locator(".checklist .task .source-chip").nth(3));
await beat(2000);

await caption("Unclear instructions become questions for the care team. <b>Liftoff never guesses.</b>");
await scrollTo(page.locator(".questions"), "center");
await moveTo(page.locator(".questions .source-chip").first());
await beat(2600);
await moveTo(page.locator(".not-yet .source-chip").nth(1));
await beat(2000);
await click(page.locator(".papers-head .icon-btn"));
await beat(500);

await caption("Something feel off? Liftoff checks it against <b>your own papers</b> and says when to call.");
await scrollTo(page.locator(".symptom"), "center");
await click(page.locator("#symptom-input"));
await page.keyboard.type("my incision looks red and feels warm", { delay: 42 });
await beat(300);
await click(page.locator("#symptom-button"));
await page.waitForSelector(".verdict");
await beat(500);
await scrollTo(page.locator(".verdict"), "center");
await beat(2600);

await caption("One tap switches the whole plan to <b>Spanish</b>, and more languages with AI.");
await scrollTop();
await moveTo(page.locator("#language-select"));
await beat(300);
await page.selectOption("#language-select", "es");
await beat(3200);
await page.selectOption("#language-select", "en");
await beat(500);

await caption("Finish the day and the rocket fires.");
await scrollTo(page.locator(".checklist"), "start");
const remaining = page.locator("button.tick[aria-checked='false']:not([disabled])");
while ((await remaining.count()) > 0) {
  await click(remaining.first());
  await beat(160);
}
const morePips = page.locator("button.pip:not(.on)");
while ((await morePips.count()) > 0) {
  await click(morePips.first());
  await beat(90);
}
await caption("");
await scrollTop();
await beat(3400);

await card(
  `<div>${ROCKET}<h1 style="font-size:110px">LIFTOFF</h1><h2>Every recovery needs a launchpad.</h2><ul><li>Claude turns discharge papers into a day-by-day plan</li><li>Code checks every item against the original words</li><li>Pill clock · warning signs · symptom check · 5 languages</li></ul><p class="k" style="font-size:15px;margin-top:30px">Built for DSH Hacks V2 · Demo uses a fictional patient</p></div>`,
  5200,
  { stay: true },
);

recording = false;
clearInterval(pump);
await cdp.send("Page.stopScreencast");
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on("close", r));
await browser.close();
preview?.kill();

const encode = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-i", RAW, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264",
   "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT],
  { stdio: "inherit" },
);
await new Promise((r) => encode.on("close", r));
rmSync(RAW, { force: true });
console.log(`Saved ${OUT} (${(written / FPS).toFixed(1)} s)`);
