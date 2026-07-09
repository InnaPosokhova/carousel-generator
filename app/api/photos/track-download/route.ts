import { errorResponse, isNonEmptyString } from "../../../lib/api-utils";

// Allow long upstream calls on Vercel (Hobby default timeout is too short)
export const maxDuration = 30;

// Unsplash API guidelines require hitting the photo's download_location
// endpoint when a photo is actually used.
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const { downloadLocation } = (body ?? {}) as Record<string, unknown>;
  if (
    !isNonEmptyString(downloadLocation) ||
    !downloadLocation.startsWith("https://api.unsplash.com/")
  ) {
    return errorResponse(
      '"downloadLocation" must be an api.unsplash.com URL.',
      400,
    );
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || accessKey === "your_key_here") {
    return errorResponse("UNSPLASH_ACCESS_KEY is not configured.", 500);
  }

  try {
    await fetch(downloadLocation, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Tracking is best-effort; don't fail the user's flow over it.
  }

  return Response.json({ ok: true });
}
