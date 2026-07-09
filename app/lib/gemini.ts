const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TONE_BY_THEME: Record<string, string> = {
  minimal: "clear and practical — plain language, concrete advice, no fluff",
  bold: "punchy and short — high energy, direct, confident",
  aesthetic: "elegant and warm — graceful phrasing, calm and inviting",
};

export function toneForTheme(theme: string | undefined): string {
  return TONE_BY_THEME[theme ?? "minimal"] ?? TONE_BY_THEME.minimal;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// Gemini is asked for pure JSON, but may still wrap it in fences or prose.
function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export type GeminiJsonResult =
  | { data: unknown; error?: never }
  | { data?: never; error: Response };

export async function generateJson(prompt: string): Promise<GeminiJsonResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return {
      error: errorResponse(
        "GEMINI_API_KEY is not configured. Paste your key into .env.local and restart the dev server.",
        500,
      ),
    };
  }

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { error: errorResponse("Could not reach the Gemini API.", 502) };
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 400 || status === 401 || status === 403) {
      return {
        error: errorResponse(
          "The Gemini API rejected the request — check that your API key is valid.",
          502,
        ),
      };
    }
    if (status === 429) {
      return {
        error: errorResponse(
          "Gemini rate limit reached — the free tier allows a limited number of requests per day. Wait a moment and try again.",
          429,
        ),
      };
    }
    return {
      error: errorResponse(`The Gemini API returned an error (${status}).`, 502),
    };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  if (!text) {
    return { error: errorResponse("The Gemini API returned an empty response.", 502) };
  }

  const data = extractJson(text);
  if (data === null) {
    return {
      error: errorResponse("The model response was not valid JSON. Try again.", 502),
    };
  }
  return { data };
}
