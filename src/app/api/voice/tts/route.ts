import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TtsRequest = {
  text?: string;
};

const MAX_TEXT_LENGTH = 1200;

const runPiper = async (text: string) => {
  const cwd = process.cwd();
  // Fixed paths: assets are in the root /bin directory, not inside nexus/
  const piperExe = path.join(cwd, "..", "bin", "piper", "piper", "piper.exe");
  const modelPath = path.join(cwd, "..", "bin", "piper", "jarvis-high.onnx");
  const outputFile = path.join(os.tmpdir(), `nexus-${randomUUID()}.wav`);

  await fs.access(piperExe);
  await fs.access(modelPath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      piperExe,
      ["--model", modelPath, "--output_file", outputFile, "--quiet"],
      {
        cwd: path.dirname(piperExe),
        windowsHide: true,
      },
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `Piper exited with code ${code ?? -1}`));
    });

    child.stdin.write(text);
    child.stdin.end();
  });

  const audioBuffer = await fs.readFile(outputFile);
  await fs.unlink(outputFile).catch(() => {});
  return audioBuffer;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsRequest;
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const audioBuffer = await runPiper(text);
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

