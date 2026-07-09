import { errorResponse, isNonEmptyString } from "../../lib/api-utils";

// Same-origin proxy for remote background images so html-to-image can embed
// them at export time without canvas tainting or upstream CORS surprises.
const ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
  "image.pollinations.ai",
]);

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url");
  if (!isNonEmptyString(raw)) {
    return errorResponse('"url" is required.', 400);
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return errorResponse('"url" must be a valid absolute URL.', 400);
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return errorResponse("This image host is not allowed.", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { signal: AbortSignal.timeout(60_000) });
  } catch {
    return errorResponse("Could not fetch the image.", 502);
  }
  if (!upstream.ok || !upstream.body) {
    return errorResponse(`The image host returned an error (${upstream.status}).`, 502);
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
