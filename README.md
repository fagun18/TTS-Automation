## TTS Automation (Smoke + Playwright + WER + HTML Report)

### Prereqs
- Node 18+ (includes fetch and performance)
- Python 3.10+
- Set environment variable `TTS_API_URL` if not `http://localhost:8000/synthesize`

### Install (Windows PowerShell)
```powershell
npm install
npx playwright install
```

### One-command run
```powershell
./run_all.ps1               # uses mock at http://localhost:3000/synthesize
# Output: .\outputs\*.mp3, run_results.csv, report.html (and wer_results.csv if enabled)
```

To include WER back-eval in the same run (first time will download Whisper):
```powershell
./run_all.ps1 -WithWer
```

### Mock TTS server (local)
```powershell
$env:MOCK_REAL_VOICE = "0"   # 0 = beep tone (fast), 1 = real TTS via Edge
npm run mock
# Server at http://localhost:3000
# Endpoint: POST /synthesize { text, format } -> audio (mp3/wav)
# Optional voices: set $env:MOCK_VOICE (e.g., en-US-JennyNeural)
```

### Golden Dataset
- G1: "Hello world, this is a test." (≤ 1.5s)
- G2: "The total is $1,234.56 due by 10/12/2025 at 14:30." (≤ 2.0s)
- G3: "Bienvenue à Paris. 次の駅は渋谷です. 123 ABC." (≤ 3.0s)

Adjust thresholds via `tts.spec.ts` if your SLA differs.

To run with real voice in mock end-to-end:
```powershell
$env:MOCK_REAL_VOICE = "1"
./run_all.ps1
```

### Clean artifacts
```powershell
npm run clean   # removes outputs, test-results, playwright-report
```

---

## C—Automation Deliverable

### Test Plan (≤1 page)
- Scope: Weekly validation of TTS quality and reliability; smoke correctness and latency SLOs.
- Quality dimensions & metrics:
  - Intelligibility: Word Error Rate (WER) via ASR back-eval (Whisper). Target lower is better.
  - Pronunciation: Rule-based spot-check for numbers, dates, acronyms, and named entities (human review for edge cases).
  - Latency: API end-to-end time measured client-side. Track p50/p95 vs SLA.
  - Stability: 2xx rate, valid audio headers, non-empty payload.
  - Consistency: Duration variance ≤ ±5% across 3 runs for same input.
- Golden dataset (run each release):
  - G1: "Hello world, this is a test." (short intelligibility baseline)
  - G2: "The total is $1,234.56 due by 10/12/2025 at 14:30." (numbers/date)
  - G3: "Bienvenue à Paris. 次の駅は渋谷です. 123 ABC." (multilingual/edge)
- Acceptance criteria (pass/fail):
  - Intelligibility: WER ≤ 10% (G1), ≤ 15% (G2/G3).
  - Pronunciation: No critical misreads on G2; ≤1 minor across G1–G3.
  - Latency: p95 ≤ 1.5s (≤200 chars); ≤ 3.0s (≤500 chars).
  - Stability: ≥ 99% 2xx over 50 calls; valid audio, duration > 0.5s.
  - Consistency: Duration variance ≤ ±5% over 3 runs.
- Process: Execute `run_all.ps1` per release; collect `run_results.csv`, `wer_results.csv`, and `report.html`. Flag regressions and create tickets if thresholds breached.

### Minimal Script (~25 lines, TypeScript)
```ts
// tts_smoke.ts
import { writeFileSync, mkdirSync, statSync } from "fs";
import { join } from "path";

const API_URL = process.env.TTS_API_URL || "http://localhost:3000/synthesize";
const OUT_DIR = "outputs";
const CASES = [
  { id: "G1_short", text: "Hello world, this is a test." },
  { id: "G2_numeric", text: "The total is $1,234.56 due by 10/12/2025 at 14:30." },
  { id: "G3_multi", text: "Bienvenue à Paris. 次の駅は渋谷です. 123 ABC." }
];

mkdirSync(OUT_DIR, { recursive: true });

async function synthesize(caseId: string, text: string, format = "mp3") {
  const t0 = performance.now();
  const resp = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, format }) });
  const dt = (performance.now() - t0) / 1000;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const file = join(OUT_DIR, `${caseId}.${format}`);
  writeFileSync(file, buf);
  const ok = statSync(file).size > 1000;
  console.log(`${caseId}: ${dt.toFixed(3)}s saved=${ok} file=${file}`);
  return { latency: dt, ok, file };
}

(async () => {
  const results: any[] = [];
  for (const c of CASES) {
    try { results.push({ id: c.id, text: c.text, ...(await synthesize(c.id, c.text)) }); }
    catch { results.push({ id: c.id, text: c.text, ok: false }); }
  }
  const csv = ["case_id,text,latency_sec,ok,file", ...results.map(r => `${r.id},"${r.text.replace(/"/g,'""')}",${r.latency ?? ''},${r.ok},${r.file ?? ''}`)].join("\n");
  writeFileSync(join(OUT_DIR, "run_results.csv"), csv, "utf8");
})();
```

### Result Table (from latest run)

| Case ID | Input Text | Expected Output | Observed Response Time |
|---|---|---|---|
| G1_short | Hello world, this is a test. | Clear, fluent, no artifacts | 1.894 s |
| G2_numeric | The total is $1,234.56 due by 10/12/2025 at 14:30. | Correct currency/date/time pronunciation | 2.406 s |
| G3_multi | Bienvenue à Paris. 次の駅は渋谷です. 123 ABC. | Natural FR/JA; “ABC” spelled correctly | 2.362 s |

Open `outputs/report.html` for a modern, colorful view with audio players and badges (WER if computed).


