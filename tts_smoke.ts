import { writeFileSync, mkdirSync, statSync } from "fs";
import { join } from "path";

const API_URL = process.env.TTS_API_URL || "http://localhost:8000/synthesize";
const OUT_DIR = "outputs";
const CASES = [
  { id: "G1_short", text: "Hello world, this is a test." },
  { id: "G2_numeric", text: "The total is $1,234.56 due by 10/12/2025 at 14:30." },
  { id: "G3_multi", text: "Bienvenue à Paris. 次の駅は渋谷です. 123 ABC." }
];

mkdirSync(OUT_DIR, { recursive: true });

async function synthesize(caseId: string, text: string, format = "mp3") {
  const t0 = performance.now();
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, format })
  });
  const dt = (performance.now() - t0) / 1000;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const file = join(OUT_DIR, `${caseId}.${format}`);
  writeFileSync(file, buf);
  const ok = statSync(file).size > 1000;
  console.log(`${caseId}: ${dt.toFixed(3)}s saved=${ok} file=${file}`);
  return { latency: dt, ok, file };
}

async function main() {
  const results: Array<{ id: string; text: string; latency?: number; ok: boolean; file?: string }> = [];
  for (const c of CASES) {
    try {
      const r = await synthesize(c.id, c.text);
      results.push({ id: c.id, text: c.text, ...r });
    } catch (e) {
      console.error(c.id, "ERROR", e);
      results.push({ id: c.id, text: c.text, ok: false });
    }
  }
  const csv = [
    "case_id,text,latency_sec,ok,file",
    ...results.map(r => `${r.id},"${r.text.replace(/"/g, '""')}",${r.latency ?? ""},${r.ok},${r.file ?? ""}`)
  ].join("\n");
  writeFileSync(join(OUT_DIR, "run_results.csv"), csv, "utf8");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


