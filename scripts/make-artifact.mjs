// Turns the single-file build (dist-artifact/index.html) into the page body a
// claude.ai Artifact expects: no doctype/html/head/body of its own, the
// <title> and styles first, then the app.
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("dist-artifact/index.html", "utf8");

const pick = (re, label) => {
  const m = src.match(re);
  if (!m) throw new Error(`make-artifact: no ${label} in dist-artifact/index.html`);
  return m[0];
};

const title = pick(/<title>[\s\S]*?<\/title>/, "<title>");
const styles = src.match(/<style[\s\S]*?<\/style>/g) ?? [];
const script = pick(/<script type="module"[\s\S]*?<\/script>/, "module script");

const page = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...styles,
  '<div id="root"></div>',
  script,
].join("\n");

writeFileSync("dist-artifact/liftoff.html", page);
console.log(`dist-artifact/liftoff.html  ${(page.length / 1024).toFixed(0)} KiB`);
