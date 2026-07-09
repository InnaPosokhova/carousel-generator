import { errorResponse, isNonEmptyString } from "../../lib/api-utils";

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";

interface UnsplashApiPhoto {
  id: string;
  alt_description: string | null;
  urls: { small: string; regular: string };
  user: { name: string; links: { html: string } };
  links: { html: string; download_location: string };
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("query");
  if (!isNonEmptyString(query)) {
    return errorResponse('"query" is required.', 400);
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || accessKey === "your_key_here") {
    return errorResponse(
      "UNSPLASH_ACCESS_KEY is not configured. Paste your key into .env.local and restart the dev server.",
      500,
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(query.trim())}&per_page=12&orientation=portrait`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          "Accept-Version": "v1",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    return errorResponse("Could not reach Unsplash.", 502);
  }

  if (response.status === 401) {
    return errorResponse(
      "Unsplash rejected the request — check that UNSPLASH_ACCESS_KEY is valid.",
      502,
    );
  }
  if (response.status === 403 || response.status === 429) {
    return errorResponse(
      "Unsplash rate limit reached — the demo tier allows 50 requests per hour. Try again in a little while.",
      429,
    );
  }
  if (!response.ok) {
    return errorResponse(`Unsplash returned an error (${response.status}).`, 502);
  }

  const data = (await response.json()) as { results?: UnsplashApiPhoto[] };
  const photos = (data.results ?? []).map((photo) => ({
    id: photo.id,
    alt: photo.alt_description ?? "",
    thumbUrl: photo.urls.small,
    fullUrl: photo.urls.regular,
    photographerName: photo.user.name,
    photographerUrl: photo.user.links.html,
    photoUrl: photo.links.html,
    downloadLocation: photo.links.download_location,
  }));

  return Response.json({ photos });
}
