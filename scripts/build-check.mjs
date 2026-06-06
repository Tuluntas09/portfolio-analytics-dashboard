/**
 * build-check.mjs — validates the Vite production build output in dist/.
 *
 * Run after `npm run build`:
 *   npm run test:build
 *
 * Checks (all use Node.js built-ins only — no extra dependencies):
 *   1.  dist/ directory exists
 *   2.  dist/index.html exists
 *   3.  dist/index.html references a compiled JS asset under /assets/
 *   4.  dist/index.html does NOT reference Babel Standalone
 *   5.  dist/index.html does NOT reference React/ReactDOM UMD CDN scripts
 *   6.  dist/index.html does NOT reference public/legacy/*.jsx files
 *   7.  dist/index.html does NOT contain type="text/babel"
 *   8.  dist/assets/ directory exists
 *   9.  At least one compiled .js asset exists in dist/assets/
 *   10. No .jsx files exist anywhere in dist/
 *   11. dist/legacy/ directory does NOT exist (legacy files excluded from build)
 *   12. Raw JS bundle size is under 400 kB
 *   13. Gzip JS bundle size is under 150 kB
 */

import fs   from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root  = path.resolve(__dir, "..");
const dist  = path.join(root, "dist");

const RAW_CEIL_KB  = 400;
const GZIP_CEIL_KB = 150;

let passed = 0;
let failed = 0;

function pass(msg)       { console.log(`  ✓  ${msg}`); passed++; }
function fail(msg)       { console.error(`  ✗  ${msg}`); failed++; }
function header(section) { console.log(`\n${section}`); }

// ── 1. dist/ exists ─────────────────────────────────────────────────────────
header("dist/ directory");
if (fs.existsSync(dist) && fs.statSync(dist).isDirectory()) {
  pass("dist/ exists");
} else {
  fail("dist/ does not exist — run `npm run build` first");
  process.exit(1); // nothing else can run without dist/
}

// ── 2. dist/index.html ──────────────────────────────────────────────────────
header("dist/index.html");
const htmlPath = path.join(dist, "index.html");
if (!fs.existsSync(htmlPath)) {
  fail("dist/index.html does not exist");
  process.exit(1);
}
pass("dist/index.html exists");
const html = fs.readFileSync(htmlPath, "utf8");

// ── 3. Compiled JS asset reference ──────────────────────────────────────────
header("index.html — compiled asset references");
if (/src="\/assets\/[^"]+\.js"/.test(html)) {
  pass('index.html references a compiled JS asset under /assets/');
} else {
  fail('index.html does not reference a compiled JS asset under /assets/');
}

// Inline CSS is embedded in the JS bundle for this app (no separate CSS file).
// If a CSS asset link ever appears, it should also be under /assets/.
const cssLinks = html.match(/href="\/assets\/[^"]+\.css"/g) || [];
if (cssLinks.length > 0) {
  pass(`index.html references ${cssLinks.length} compiled CSS asset(s) under /assets/`);
} else {
  pass("no separate CSS asset (styles are inlined in the JS bundle — expected)");
}

// ── 4–7. Forbidden references ───────────────────────────────────────────────
header("index.html — forbidden references absent");

const forbidden = [
  { pattern: /babel\.min\.js|babel\.js/,           label: "Babel Standalone" },
  { pattern: /react\.development\.js|react\.production\.min\.js/, label: "React UMD CDN" },
  { pattern: /react-dom\.development\.js|react-dom\.production\.min\.js/, label: "ReactDOM UMD CDN" },
  { pattern: /\/legacy\/[^"']+\.jsx/,               label: "public/legacy/*.jsx reference" },
  { pattern: /type="text\/babel"/,                  label: 'type="text/babel"' },
];
for (const { pattern, label } of forbidden) {
  if (pattern.test(html)) {
    fail(`index.html still contains forbidden reference: ${label}`);
  } else {
    pass(`${label} — not present`);
  }
}

// ── 8–9. dist/assets/ and JS files ──────────────────────────────────────────
header("dist/assets/ — compiled JS bundle");
const assetsDir = path.join(dist, "assets");
if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
  fail("dist/assets/ directory does not exist");
  process.exit(1);
}
pass("dist/assets/ exists");

const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith(".js"));
if (jsFiles.length === 0) {
  fail("no compiled .js files found in dist/assets/");
  process.exit(1);
}
pass(`${jsFiles.length} compiled JS file(s) found: ${jsFiles.join(", ")}`);

// ── 10. No .jsx files anywhere in dist/ ─────────────────────────────────────
header("dist/ — no JSX source files");
function findJsx(dir) {
  const hits = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hits.push(...findJsx(full));
    else if (entry.name.endsWith(".jsx")) hits.push(full);
  }
  return hits;
}
const jsxFiles = findJsx(dist);
if (jsxFiles.length > 0) {
  fail(`JSX source files found in dist/ (should not be emitted): ${jsxFiles.map(f => path.relative(root, f)).join(", ")}`);
} else {
  pass("no .jsx source files in dist/");
}

// ── 11. dist/legacy/ must not exist ─────────────────────────────────────────
header("dist/ — legacy directory absent");
const legacyInDist = path.join(dist, "legacy");
if (fs.existsSync(legacyInDist)) {
  fail("dist/legacy/ exists — public/legacy files should not be copied to dist/ (set build.copyPublicDir: false in vite.config.js)");
} else {
  pass("dist/legacy/ does not exist");
}

// ── 12–13. Bundle size ceilings ─────────────────────────────────────────────
header("Bundle size ceilings");
const jsBundlePath = path.join(assetsDir, jsFiles[0]);
const rawBytes  = fs.statSync(jsBundlePath).size;
const rawKB     = (rawBytes / 1024).toFixed(1);
const gzipBytes = zlib.gzipSync(fs.readFileSync(jsBundlePath)).length;
const gzipKB    = (gzipBytes / 1024).toFixed(1);

if (rawBytes <= RAW_CEIL_KB * 1024) {
  pass(`raw JS bundle: ${rawKB} kB (ceiling ${RAW_CEIL_KB} kB)`);
} else {
  fail(`raw JS bundle ${rawKB} kB exceeds ${RAW_CEIL_KB} kB ceiling`);
}

if (gzipBytes <= GZIP_CEIL_KB * 1024) {
  pass(`gzip JS bundle: ${gzipKB} kB (ceiling ${GZIP_CEIL_KB} kB)`);
} else {
  fail(`gzip JS bundle ${gzipKB} kB exceeds ${GZIP_CEIL_KB} kB ceiling`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\nbuild checks FAILED");
  process.exit(1);
}
console.log("\nbuild checks passed");
