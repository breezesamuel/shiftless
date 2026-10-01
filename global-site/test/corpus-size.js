/**
 * Measures the true size of the programmatic corpus.
 *
 * This exists to make the number honest. The temptation with "a million pages"
 * is to hit the number; the point here is to find out how many URLs genuinely
 * earn their existence, so the published corpus is exactly that many and no
 * more. Run: node test/corpus-size.js
 */
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

function load(rel, name) {
  const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dir = path.join(__dirname, "..", ".tmp-verify");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, name);
  fs.writeFileSync(out, js);
  return out;
}

require(load("src/lib/model.ts", "model.js"));
const { buildCorpus } = require(load("src/lib/corpus.ts", "corpus.js"));

const c = buildCorpus();

const byIndustry = {};
const byVerdict = {};
for (const p of c.pages) {
  byIndustry[p.industry.slug] = (byIndustry[p.industry.slug] || 0) + 1;
  byVerdict[p.output.verdict] = (byVerdict[p.output.verdict] || 0) + 1;
}

console.log("COMBINATIONS EXAMINED :", c.examined);
console.log("PAGES PUBLISHED       :", c.pages.length);
console.log("DEDUPED AWAY          :", c.dedupedAway);
console.log("NOINDEX (not-worth-it):", c.noindex);
console.log("VERDICTS              :", JSON.stringify(byVerdict, null, 0));
console.log("PER INDUSTRY          :", JSON.stringify(byIndustry, null, 0));
console.log("DEDUPE RATE           :", ((c.dedupedAway / c.examined) * 100).toFixed(1) + "%");
