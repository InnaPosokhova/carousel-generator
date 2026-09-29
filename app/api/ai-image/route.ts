import { errorResponse, isNonEmptyString } from "../../lib/api-utils";

// Allow long upstream calls on Vercel (Hobby default timeout is too short)
export const maxDuration = 60;

// FLUX.1 schnell on Cloudflare Workers AI: fast, and covered by the free daily
// Workers AI allowance. It takes no seed or size: every call is a new
// 1024x1024 image, which the slide crops to its aspect ratio (object-cover).
const MODEL = "@cf/black-forest-labs/flux-1-schnell";

// Same-origin proxy: keeps the Cloudflare token server-side and returns plain
// image bytes the browser can turn into a blob URL for preview and export.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const prompt = params.get("prompt");

  if (!isNonEmptyString(prompt) || prompt.length > 600) {
    return errorResponse('"prompt" is required (max 600 chars).', 400);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken || apiToken === "your_key_here") {
    return errorResponse(
      "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are not configured. Add them to .env.local (and your Vercel env vars), then restart.",
      500,
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.trim(), steps: 6 }),
        // Stay under maxDuration so we can still send a readable error
        signal: AbortSignal.timeout(55_000),
      },
    );
  } catch {
    return errorResponse(
      "The image service took too long to respond. Try again in a moment.",
      504,
    );
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return errorResponse(
      "Cloudflare rejected the request — check CLOUDFLARE_ACCOUNT_ID and that CLOUDFLARE_API_TOKEN has Workers AI permission.",
      502,
    );
  }
  if (upstream.status === 429) {
    return errorResponse(
      "Today's free AI image allowance is used up. It resets daily — try again tomorrow, or use a stock photo.",
      429,
    );
  }

  const payload = (await upstream.json().catch(() => null)) as {
    success?: boolean;
    result?: { image?: string };
    errors?: Array<{ message?: string }>;
  } | null;
  const base64 = payload?.result?.image;
  if (!upstream.ok || !base64) {
    const detail = payload?.errors?.[0]?.message;
    return errorResponse(
      `The image service returned an error (${upstream.status}${detail ? `: ${detail}` : ""}). Try again in a moment.`,
      502,
    );
  }

  const bytes = Buffer.from(base64, "base64");
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  return new Response(bytes, {
    headers: {
      "Content-Type": isPng ? "image/png" : "image/jpeg",
      // Every call is a new image — never serve a cached one on "regenerate"
      "Cache-Control": "no-store",
    },
  });
}
