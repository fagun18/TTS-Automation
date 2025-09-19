import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const OUT_DIR = "outputs";
const CSV_PATH = join(OUT_DIR, "run_results.csv");
const WER_CSV_PATH = join(OUT_DIR, "wer_results.csv");
const HTML_PATH = join(OUT_DIR, "report.html");

type Row = { case_id: string; text: string; latency_sec: string; ok: string; file: string };
type WerRow = { case_id: string; asr_text: string; wer: string; cer: string };

function parseCsv(path: string): Array<Record<string, string>> {
  const raw = readFileSync(path, "utf8").trim();
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.map(line => {
    // handle simple CSV with quoted text
    const cells: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => rec[h] = (cells[idx] ?? "").trim());
    return rec;
  });
}

function badge(color: string, text: string) {
  return `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${color};color:white;font-size:12px;">${text}</span>`;
}

function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}. Run npm run smoke first.`);
  }
  const rows = parseCsv(CSV_PATH) as Row[];
  const werMap: Record<string, WerRow> = {};
  if (existsSync(WER_CSV_PATH)) {
    const wrows = parseCsv(WER_CSV_PATH) as any[];
    // header: case_id,input_text,asr_text,wer,cer,file
    for (const r of wrows) {
      const id = r["case_id"]; if (id && id !== "case_id") {
        werMap[id] = { case_id: id, asr_text: r["asr_text"], wer: r["wer"], cer: r["cer"] };
      }
    }
  }

  const items = rows.map(r => {
    const ok = r.ok.toLowerCase() === "true";
    const lat = r.latency_sec ? parseFloat(r.latency_sec) : NaN;
    const latColor = isNaN(lat) ? "#9CA3AF" : lat <= 1 ? "#10B981" : lat <= 2 ? "#F59E0B" : "#EF4444";
    const w = werMap[r.case_id];
    const werBadge = w ? badge(Number(w.wer) <= 0.15 ? "#10B981" : Number(w.wer) <= 0.25 ? "#F59E0B" : "#EF4444", `WER ${(Number(w.wer)*100).toFixed(1)}%`) : "";
    const cerBadge = w ? badge(Number(w.cer) <= 0.10 ? "#10B981" : Number(w.cer) <= 0.20 ? "#F59E0B" : "#EF4444", `CER ${(Number(w.cer)*100).toFixed(1)}%`) : "";
    const statusBadge = badge(ok ? "#2563EB" : "#EF4444", ok ? "OK" : "FAIL");
    // Make path relative to report.html location (outputs/)
    let norm = (r.file || "").replace(/\\/g, "/");
    if (norm.includes("/outputs/")) norm = norm.split("/outputs/")[1];
    if (norm.startsWith("outputs/")) norm = norm.slice("outputs/".length);
    const audio = ok && norm ? `<audio controls preload="none" src="${norm}" style="width:100%"></audio>` : "";
    return `
      <div class="card">
        <div class="card-header">
          <div class="left">
            <h3>${r.case_id}</h3>
            <div class="chips">
              ${statusBadge}
              ${badge(latColor, isNaN(lat) ? "n/a" : `${lat.toFixed(3)}s`)}
              ${werBadge} ${cerBadge}
            </div>
          </div>
        </div>
        <div class="row"><span class="label">Input</span><span class="value">${r.text}</span></div>
        <div class="row"><span class="label">File</span><span class="value">${r.file || ""}</span></div>
        <div class="player">${audio}</div>
      </div>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TTS Quality Report</title>
  <style>
    :root {
      --bg:#0b1220; --bg2:#0d182b; --grad1:#6EE7F9; --grad2:#A78BFA; --grad3:#34D399;
      --card: rgba(255,255,255,0.06); --border: rgba(255,255,255,0.12);
      --muted:#9CA3AF; --text:#F3F4F6; --heading:#FFFFFF;
    }
    *{ box-sizing:border-box }
    html,body{ height:100% }
    body{ margin:0; font-family:Inter,system-ui,Segoe UI,Arial; color:var(--text);
      background: radial-gradient(1200px 600px at 10% -10%, rgba(110,231,249,0.15), transparent),
                  radial-gradient(1000px 500px at 100% 0%, rgba(167,139,250,0.22), transparent),
                  linear-gradient(180deg, var(--bg), var(--bg2)); }
    .hero{ position:sticky; top:0; z-index:10; backdrop-filter:saturate(140%) blur(8px);
      background: linear-gradient(90deg, rgba(110,231,249,0.08), rgba(167,139,250,0.08));
      border-bottom:1px solid var(--border); }
    .hero-inner{ max-width:1200px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; }
    .brand{ display:flex; align-items:center; gap:12px; }
    .logo{ width:28px; height:28px; border-radius:8px; background:conic-gradient(from 0deg, var(--grad1), var(--grad2), var(--grad3)); box-shadow:0 0 24px rgba(167,139,250,0.35); }
    .title{ font-weight:700; letter-spacing:.2px; color:var(--heading); }
    .meta{ color:var(--muted); font-size:12px; }
    .wrap{ max-width:1200px; margin:26px auto; padding:0 20px; }
    .kpis{ display:flex; gap:12px; flex-wrap:wrap; margin:16px 0 22px; }
    .kpi{ padding:10px 14px; border-radius:12px; border:1px solid var(--border); background:var(--card); display:flex; gap:10px; align-items:center; }
    .kpi b{ color:#fff }
    .grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:18px; }
    .card{ position:relative; background:var(--card); border:1px solid var(--border); border-radius:16px; padding:16px; box-shadow:0 12px 32px rgba(0,0,0,0.35); overflow:hidden; }
    .card:before{ content:""; position:absolute; inset:0; pointer-events:none; background: radial-gradient(600px 180px at -10% -10%, rgba(110,231,249,0.08), transparent 50%), radial-gradient(600px 180px at 110% -10%, rgba(167,139,250,0.08), transparent 50%); }
    .card-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .left{ display:flex; align-items:center; gap:12px; }
    h3{ margin:0; font-size:18px; color:#fff }
    .chips{ display:flex; gap:8px; flex-wrap:wrap; }
    .row{ display:grid; grid-template-columns:84px 1fr; gap:10px; margin:8px 0; align-items:flex-start; }
    .label{ color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
    .value{ word-break:break-word; color:#e5e7eb }
    .player{ margin-top:12px; }
    audio{ width:100%; border-radius:10px; background:#0b1220 }
    .footer{ color:var(--muted); margin:24px 0 40px; font-size:12px; text-align:center }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <header class="hero">
    <div class="hero-inner">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <div class="title">TTS Quality Report</div>
          <div class="meta">Golden dataset • ${new Date().toLocaleString()}</div>
        </div>
      </div>
      <div class="kpis">
        <div class="kpi">${badge('#2563EB', `Cases ${rows.length}`)}</div>
        <div class="kpi">${badge('#10B981', 'Latency p50 — see cards')}</div>
        <div class="kpi">${existsSync(WER_CSV_PATH) ? badge('#A78BFA', 'WER included') : badge('#6B7280', 'WER not computed')}</div>
      </div>
    </div>
  </header>
  <main class="wrap">
    <div class="grid">
      ${items}
    </div>
    <div class="footer">Tip: open this file or serve the folder. Audio paths are relative to this HTML. ${existsSync(WER_CSV_PATH) ? 'Includes ASR WER/CER badges.' : 'Run WER to include ASR badges.'}</div>
  </main>
</body>
</html>`;

  writeFileSync(HTML_PATH, html, "utf8");
  console.log(`Wrote ${HTML_PATH}`);
}

main();


