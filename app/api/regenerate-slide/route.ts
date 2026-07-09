import {
  errorResponse,
  generateJson,
  isNonEmptyString,
  toneForTheme,
} from "../../lib/gemini";

// Allow long upstream calls on Vercel (Hobby default timeout is too short)
export const maxDuration = 60;

interface SlideContent {
  title: string;
  body: string;
}

function slideRole(index: number, count: number): string {
  if (index === 0) {
    return "the opening hook slide — a strong title that makes people want to swipe";
  }
  if (index === count - 1) {
    return 'the closing call-to-action slide ("Save & follow" or similar)';
  }
  return "a middle slide covering exactly one clear idea";
}

const TITLE_NUMBER_PREFIX = /^(\d+)[.):]\s*/;

function buildPrompt(
  topic: string,
  theme: string | undefined,
  slideIndex: number,
  slides: SlideContent[],
): string {
  const numberPrefix = slides[slideIndex].title.match(TITLE_NUMBER_PREFIX);
  const numberingRule = numberPrefix
    ? `- The current title starts with "${numberPrefix[1]}." — the new title MUST keep that exact "${numberPrefix[1]}." prefix so the sequence stays in order.`
    : `- Do not add a number prefix to the title.`;

  return `You write Instagram carousel content.

Topic: "${topic}"
Writing tone: ${toneForTheme(theme)}.

Here is the current carousel as JSON:
${JSON.stringify(slides, null, 2)}

Rewrite ONLY slide ${slideIndex + 1} of ${slides.length}. Its role: ${slideRole(slideIndex, slides.length)}.

Rules:
- Give it a fresh take — do not just rephrase the current slide ${slideIndex + 1}.
- Do not duplicate ideas already covered by the other slides.
- Keep the body short — at most 30 words, so it fits on a slide.
- Match the writing tone above.
${numberingRule}
- Never start the title with "Slide N".

Return ONLY valid JSON — no markdown fences, no commentary — in exactly this shape:
{ "title": string, "body": string }`;
}

function validateSlide(data: unknown): SlideContent | null {
  if (typeof data !== "object" || data === null) return null;
  const { title, body } = data as Record<string, unknown>;
  if (!isNonEmptyString(title) || !isNonEmptyString(body)) return null;
  return { title: title.trim(), body: body.trim() };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const { topic, theme, slideIndex, slides } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (!isNonEmptyString(topic)) {
    return errorResponse('"topic" is required and must be a non-empty string.', 400);
  }
  if (theme !== undefined && typeof theme !== "string") {
    return errorResponse('"theme" must be a string.', 400);
  }
  if (
    !Array.isArray(slides) ||
    slides.length < 2 ||
    !slides.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        isNonEmptyString((s as Record<string, unknown>).title) &&
        isNonEmptyString((s as Record<string, unknown>).body),
    )
  ) {
    return errorResponse(
      '"slides" must be an array of at least 2 slides with "title" and "body".',
      400,
    );
  }
  if (
    typeof slideIndex !== "number" ||
    !Number.isInteger(slideIndex) ||
    slideIndex < 0 ||
    slideIndex >= slides.length
  ) {
    return errorResponse(
      '"slideIndex" must be a valid index into "slides".',
      400,
    );
  }

  const cleanSlides = (slides as Array<Record<string, string>>).map((s) => ({
    title: s.title.trim(),
    body: s.body.trim(),
  }));

  const result = await generateJson(
    buildPrompt(topic.trim(), theme, slideIndex, cleanSlides),
  );
  if (result.error) return result.error;

  const validated = validateSlide(result.data);
  if (!validated) {
    return errorResponse(
      "The model response was not a valid slide. Try again.",
      502,
    );
  }

  // Enforce the numbering contract regardless of what the model did: the new
  // title keeps the original slide's number prefix, or stays unnumbered.
  const originalPrefix = cleanSlides[slideIndex].title.match(TITLE_NUMBER_PREFIX);
  let title = validated.title.replace(TITLE_NUMBER_PREFIX, "");
  if (originalPrefix) title = `${originalPrefix[1]}. ${title}`;

  return Response.json({ title, body: validated.body });
}
