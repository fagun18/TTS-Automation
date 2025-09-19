import http from "http";
import { spawn } from "child_process";
import { existsSync } from "fs";

function generateSineWav(durationSec = 1, freq = 440, sampleRate = 22050) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2; // 16-bit PCM
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // PCM samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    const int16 = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    buffer.writeInt16LE(int16, 44 + i * 2);
  }
  return buffer;
}

function chooseVoice(text: string, fallback: string): string {
  if (/[\u3040-\u30ff\u31f0-\u31ff\uff10-\uff9f]/.test(text)) return "ja-JP-NanamiNeural";
  if (/[àâçéèêëîïôûùüÿœÀÂÇÉÈÊËÎÏÔÛÙÜŸŒ]/.test(text)) return "fr-FR-DeniseNeural";
  return fallback;
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/synthesize") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const format = (payload.format || "mp3").toLowerCase();
        const useReal = process.env.MOCK_REAL_VOICE === "1";
        if (useReal) {
          const text = String(payload.text || "Hello from mock");
          const defaultVoice = process.env.MOCK_VOICE || "en-US-JennyNeural";
          const voice = chooseVoice(text, defaultVoice);
          const pyExe = process.platform === 'win32'
            ? (existsSync('.\\.venv\\Scripts\\python.exe') ? '.\\.venv\\Scripts\\python.exe' : 'python')
            : (existsSync('./.venv/bin/python') ? './.venv/bin/python' : 'python3');
          const py = spawn(pyExe, [
            "voice_tts.py",
            "--text", text,
            "--voice", voice,
            "--format", format
          ], { cwd: process.cwd() });
          const chunks: Buffer[] = [];
          py.stdout.on("data", d => chunks.push(Buffer.from(d)));
          py.stderr.on("data", d => console.error("voice_tts:", d.toString()));
          py.on("close", code => {
            if (code === 0) {
              const buf = Buffer.concat(chunks);
              res.writeHead(200, { "Content-Type": format === 'mp3' ? "audio/mpeg" : "audio/wav" });
              res.end(buf);
            } else {
              const wav = generateSineWav(1.0, 440, 22050);
              res.writeHead(200, { "Content-Type": "audio/wav" });
              res.end(wav);
            }
          });
        } else {
          const wav = generateSineWav(1.0, 440, 22050);
          res.writeHead(200, { "Content-Type": format === 'mp3' ? "audio/mpeg" : "audio/wav" });
          res.end(wav);
        }
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad_request" }));
      }
    });
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => {
  console.log(`Mock TTS listening on http://localhost:${PORT}`);
});


