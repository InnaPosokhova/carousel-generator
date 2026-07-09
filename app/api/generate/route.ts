import {
  errorResponse,
  generateJson,
  isNonEmptyString,
  toneForTheme,
} from "../../lib/gemini";

const MIN_SLIDES = 5;
const MAX_SLIDES = 7;
// Instagram works best with at most 5 hashtags — hard cap whatever comes back.
const MAX_HASHTAGS = 5;

interface SlideContent {
  title: string;
  body: string;
}

interface GenerateResult {
  slides: SlideContent[];
  caption: string;
  hashtags: string[];
}

function buildPrompt(topic: string, theme: string | undefined): string {
  return `You write Instagram carousel content.

Topic: "${topic}"
Writing tone: ${toneForTheme(theme)}.

Return ONLY valid JSON — no markdown fences, no commentary — in exactly this shape:
{
  "slides": [ { "title": string, "body": string } ],
  "caption": string,
  "hashtags": string[]
}

Rules:
- ${MIN_SLIDES} to ${MAX_SLIDES} slides.
- Slide 1 is a strong hook/title for the whole carousel.
- Each middle slide covers exactly one clear idea.
- The last slide is a call to action ("Save & follow" or similar).
- Number the slide titles ("1. …", "2. …") ONLY if the topic itself implies a counted or ranked list (like "5 tips" or "top 10"). For any other kind of topic, leave every title unnumbered.
- Never start a title with "Slide N".
- Keep every slide body short — at most 30 words, so it fits on a slide.
- "caption": a 1-2 sentence Instagram caption for the post.
- "hashtags": exactly 5 relevant hashtags, each starting with "#" (Instagram works best with at most 5).`;
}

function validateResult(data: unknown): GenerateResult | null {
  if (typeof data !== "object" || data === null) return null;
  const { slides, caption, hashtags } = data as Record<string, unknown>;

  if (!Array.isArray(slides) || slides.length < MIN_SLIDES) return null;
  const validSlides: SlideContent[] = [];
  for (const slide of slides) {
    if (typeof slide !== "object" || slide === null) return null;
    const { title, body } = slide as Record<string, unknown>;
    if (!isNonEmptyString(title) || !isNonEmptyString(body)) return null;
    validSlides.push({ title: title.trim(), body: body.trim() });
  }

  if (!isNonEmptyString(caption)) return null;
  if (!Array.isArray(hashtags) || !hashtags.every(isNonEmptyString)) {
    return null;
  }

  return {
    slides: validSlides.slice(0, MAX_SLIDES),
    caption: caption.trim(),
    hashtags: hashtags.map((h) => h.trim()).slice(0, MAX_HASHTAGS),
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const { topic, theme } = (body ?? {}) as Record<string, unknown>;
  if (!isNonEmptyString(topic)) {
    return errorResponse('"topic" is required and must be a non-empty string.', 400);
  }
  if (theme !== undefined && typeof theme !== "string") {
    return errorResponse('"theme" must be a string.', 400);
  }

  const result = await generateJson(buildPrompt(topic.trim(), theme));
  if (result.error) return result.error;

  const validated = validateResult(result.data);
  if (!validated) {
    return errorResponse(
      "The model response was not valid carousel JSON. Try again.",
      502,
    );
  }

  return Response.json(validated);
}
