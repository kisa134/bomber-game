import "dotenv/config";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const BASE = "https://api.wavespeed.ai/api/v3";
const KEY = process.env.WAVESPEED_API_KEY;

/** Max edge for reference images sent to the model. Encoded as JPEG so the
 *  request body stays well under this host's large-POST limit (~250KB) while
 *  keeping full visual detail for identity transfer. */
const REF_MAX = 1024;
const REF_QUALITY = 82;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function auth(): Record<string, string> {
  if (!KEY) throw new Error("WAVESPEED_API_KEY not set — copy .env.example to .env");
  return { Authorization: `Bearer ${KEY}` };
}

/** fetch that retries transient network failures (flaky DNS / resets seen on
 *  this host: EAI_AGAIN, ETIMEDOUT, ECONNRESET, UND_ERR_*). */
async function rfetch(url: string, init?: RequestInit, tries = 6): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw last;
}

/** Downscale a buffer and encode it as a JPEG data URI for the `images` field. */
export async function encodeReference(buf: Buffer): Promise<string> {
  const jpg = await sharp(buf)
    .resize(REF_MAX, REF_MAX, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: REF_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

/** Read a local image file and encode it as a downscaled reference data URI. */
export async function toDataUri(filePath: string): Promise<string> {
  return encodeReference(await readFile(filePath));
}

/** Encode a buffer as a high-quality 1024px JPEG data URI for matting input —
 *  enough detail for a clean cutout (final sprite is 256px) while staying under
 *  this host's large-POST limit. Flatten is a no-op on an opaque frame. */
async function encodeForCutout(buf: Buffer): Promise<string> {
  const jpg = await sharp(buf)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#808080" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

/** Cut the background out of an image with WaveSpeed's dedicated matting model
 *  (wavespeed-ai/image-background-remover, ~$0.004/run). Returns a transparent
 *  PNG buffer — far cleaner than the flood-fill keyer for non-flat backgrounds. */
export async function removeBackground(buf: Buffer): Promise<Buffer> {
  const outs = await runModel("wavespeed-ai/image-background-remover", {
    image: await encodeForCutout(buf),
  });
  if (!outs.length) throw new Error("background remover returned no output");
  return download(outs[0]);
}

/**
 * Submit a generation and return the output image URLs.
 * Handles both sync responses and the submit -> poll flow.
 */
export async function runModel(
  modelId: string,
  body: Record<string, unknown>
): Promise<string[]> {
  const res = await rfetch(`${BASE}/${modelId}`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`submit ${modelId} -> ${res.status} ${await res.text()}`);
  }
  const json: any = await res.json();
  const data = json.data ?? json;

  // enable_sync_mode may return outputs immediately.
  if (Array.isArray(data.outputs) && data.outputs.length) return data.outputs;

  const pollUrl: string = data.urls?.get ?? `${BASE}/predictions/${data.id}/result`;
  return pollResult(pollUrl);
}

async function pollResult(url: string): Promise<string[]> {
  for (let i = 0; i < 360; i++) {
    const res = await rfetch(url, { headers: auth() });
    if (!res.ok) throw new Error(`poll -> ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const data = json.data ?? json;
    const status: string = data.status;
    if (status === "completed") return data.outputs ?? [];
    if (status === "failed") {
      throw new Error(`generation failed: ${data.error ?? "unknown error"}`);
    }
    await sleep(2000);
  }
  throw new Error("poll timeout after ~5 min");
}

export async function download(url: string): Promise<Buffer> {
  // Outputs may already be data URIs (enable_base64_output) or http URLs.
  if (url.startsWith("data:")) {
    return Buffer.from(url.split(",")[1] ?? "", "base64");
  }
  const res = await rfetch(url);
  if (!res.ok) throw new Error(`download ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
