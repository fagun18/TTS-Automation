import argparse
import asyncio
import base64
import sys
import tempfile
import os
import edge_tts

# Simple wrapper: synthesize text to stdout as WAV bytes (base64 or raw)

async def synthesize(text: str, voice: str, format: str):
    # Edge TTS produces mp3/ogg/webm; we'll default to mp3 and return bytes
    fmt = "audio-mp3" if format.lower() == "mp3" else "audio-wav"
    communicate = edge_tts.Communicate(text, voice=voice)
    with tempfile.TemporaryDirectory() as td:
        out_path = os.path.join(td, f"out.{format}")
        await communicate.save(out_path)
        with open(out_path, "rb") as f:
            data = f.read()
    sys.stdout.buffer.write(data)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", default="en-US-JennyNeural")
    parser.add_argument("--format", default="mp3")
    args = parser.parse_args()
    asyncio.run(synthesize(args.text, args.voice, args.format))

if __name__ == "__main__":
    main()


