import { errorResponse, isNonEmptyString } from "../../lib/api-utils";

// Same-origin proxy for Pollinations: their CDN 403s browser fetch() calls
// (Origin header), which would break both generation and html-to-image export.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const prompt = params.get("prompt");
  const seed = Number(params.get("seed") ?? "42");
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));

  if (!isNonEmptyString(prompt) || prompt.length > 600) {
    return errorResponse('"prompt" is required (max 600 chars).', 400);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 999_999) {
    return errorResponse('"seed" must be an integer between 0 and 999999.', 400);
  }
  const validDimension = (n: number) => Number.isInteger(n) && n >= 256 && n <= 2048;
  if (!validDimension(width) || !validDimension(height)) {
    return errorResponse('"width" and "height" must be 256-2048.', 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?width=${width}&height=${height}&seed=${seed}&nologo=true`,
      { signal: AbortSignal.timeout(90_000) },
    );
  } catch {
    return errorResponse("Could not reach the image service.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    return errorResponse(
      `The image service returned an error (${upstream.status}). Try again in a moment.`,
      502,
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      // Same prompt+seed+size is deterministic enough to cache
      "Cache-Control": "public, max-age=86400",
    },
  });
}
