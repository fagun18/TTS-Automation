import { test, expect, request } from "@playwright/test";
import { writeFileSync, mkdirSync, statSync } from "fs";
import { join } from "path";

const API_URL = process.env.TTS_API_URL || "http://localhost:8000/synthesize";
const OUT_DIR = "outputs";
const CASES = [
  { id: "G1_short", text: "Hello world, this is a test.", maxSLA: 1.5 },
  { id: "G2_numeric", text: "The total is $1,234.56 due by 10/12/2025 at 14:30.", maxSLA: 2.0 },
  { id: "G3_multi", text: "Bienvenue à Paris. 次の駅は渋谷です. 123 ABC.", maxSLA: 3.0 }
];

test("TTS golden dataset latency and file checks", async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const ctx = await request.newContext();

  for (const c of CASES) {
    const t0 = Date.now();
    const resp = await ctx.post(API_URL, {
      data: { text: c.text, format: "mp3" },
      headers: { "Content-Type": "application/json" },
      timeout: 30_000
    });
    const dt = (Date.now() - t0) / 1000;
    expect(resp.ok()).toBeTruthy();
    const buf = Buffer.from(await resp.body());
    const file = join(OUT_DIR, `${c.id}.mp3`);
    writeFileSync(file, buf);
    expect(statSync(file).size).toBeGreaterThan(1000);
    expect(dt).toBeLessThanOrEqual(c.maxSLA);
    console.log(`${c.id}: ${dt.toFixed(3)}s file=${file}`);
  }
});


