import csv
import os
import sys
from pathlib import Path
from jiwer import wer, cer
from faster_whisper import WhisperModel

# Usage: python wer_eval.py outputs/run_results.csv

def transcribe_audio(model: WhisperModel, file_path: str) -> str:
    segments, _ = model.transcribe(file_path, beam_size=1)
    return " ".join(seg.text.strip() for seg in segments).strip()

def normalize_text(t: str) -> str:
    return t.replace("\n", " ").strip()

def main(csv_path: str):
    out_dir = Path(csv_path).parent
    model = WhisperModel("small", device="cpu", compute_type="int8")

    rows = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get("ok", "").lower() != "true":
                continue
            rows.append(r)

    results = ["case_id,input_text,asr_text,wer,cer,file"]
    for r in rows:
        file_path = r.get("file", "")
        if not file_path or not os.path.exists(file_path):
            continue
        ref = normalize_text(r.get("text", ""))
        hyp = transcribe_audio(model, file_path)
        w = wer(ref, hyp)
        c = cer(ref, hyp)
        results.append(f"{r['case_id']},\"{ref.replace('"', '""')}\",\"{hyp.replace('"', '""')}\",{w:.4f},{c:.4f},{file_path}")

    out_csv = out_dir / "wer_results.csv"
    with open(out_csv, "w", encoding="utf-8") as f:
        f.write("\n".join(results))
    print(f"Wrote {out_csv}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python wer_eval.py outputs/run_results.csv")
        sys.exit(1)
    main(sys.argv[1])


