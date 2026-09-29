"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Slide, { escapeHtml, type SlideContent } from "./components/Slide";
import {
  downloadDataUrl,
  downloadZip,
  EXPORT_BASE_WIDTH,
  renderSlidePng,
  slugify,
} from "./lib/export";
import {
  aspectRatios,
  defaultAspectRatioId,
  type AspectRatioId,
} from "./lib/aspect-ratios";
import {
  fontCategories,
  fonts,
  HEADING_WEIGHTS,
  type FontId,
} from "./lib/fonts";
import {
  defaultThemeId,
  GRADIENT_PRESETS,
  resolveTheme,
  themes,
  type ResolvedTheme,
  type ThemeId,
  type ThemeOverrides,
} from "./lib/themes";

const placeholderCaption =
  "Better sleep starts with small habits — here are five you can try tonight";

const exampleTopics = [
  "5 tips for better sleep",
  "Beginner budgeting",
  "Book recommendations",
  "Home workout basics",
];

interface UnsplashPhoto {
  id: string;
  alt: string;
  thumbUrl: string;
  fullUrl: string;
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
  downloadLocation: string;
}

const UNSPLASH_UTM = "?utm_source=carousel_generator&utm_medium=referral";

const QUERY_STOPWORDS = new Set([
  "a", "an", "the", "for", "to", "of", "and", "or", "in", "on", "with",
  "your", "my", "best", "top", "tips", "tip", "guide", "beginner",
  "beginners", "how", "ways", "ideas", "basics", "every", "day",
]);

function suggestPhotoQuery(topic: string): string {
  const words = topic
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !QUERY_STOPWORDS.has(word));
  return words.join(" ") || "minimal texture";
}

const AI_VIBE_BY_THEME: Record<ThemeId, string> = {
  minimal: "soft neutral tones, clean and calm, gentle daylight",
  bold: "deep rich saturated colors, dramatic contrast lighting",
  aesthetic: "soft pastel palette, dreamy delicate light, airy",
};

// FLUX ignores negatives like "no text", and an empty scene or the words
// "slide"/"text" make it paint the topic as a big title. A blurred, object-led
// photo avoids that and stays quiet behind the slide copy.
function suggestAiPrompt(topic: string, themeId: ThemeId): string {
  return `Soft-focus close-up photograph of objects related to ${suggestPhotoQuery(topic)}, shallow depth of field, heavily blurred bokeh background, ${AI_VIBE_BY_THEME[themeId]}, abstract and atmospheric, unbranded, no lettering`;
}

// Goes through our /api/ai-image proxy, which keeps the Cloudflare token server-side.
function aiImageUrl(prompt: string): string {
  return `/api/ai-image?prompt=${encodeURIComponent(prompt)}`;
}

const BACKGROUND_PRESETS = ["#ffffff", "#faf9f6", "#111111", "#0f172a", "#fbd3e0", "#d9f2e5"];
const ACCENT_PRESETS = ["#0095F6", "#2563eb", "#f43f5e", "#c084fc", "#10b981", "#f59e0b"];
const TEXT_SIZES = [
  { label: "S", scale: 0.85 },
  { label: "M", scale: 1 },
  { label: "L", scale: 1.15 },
];

// <input type="color"> only accepts 6-digit hex; gradients etc. fall back.
function toHexColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        {title}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {/* grid-rows trick: contents stay mounted (state preserved), height animates */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-zinc-100 p-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <span className="shrink-0 text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-zinc-200">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={option.disabled}
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
            value === option.value
              ? "bg-zinc-900 text-white"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FontId;
  onChange: (id: FontId) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as FontId)}
        className="max-w-[11rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800"
        style={{ fontFamily: fonts[value].family }}
      >
        {fontCategories.map((category) => (
          <optgroup key={category} label={category}>
            {(Object.keys(fonts) as FontId[])
              .filter((id) => fonts[id].category === category)
              .map((id) => (
                <option
                  key={id}
                  value={id}
                  style={{ fontFamily: fonts[id].family }}
                >
                  {fonts[id].label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function ColorControl({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <div className="flex items-center gap-1.5">
        {presets?.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`${label}: ${preset}`}
            onClick={() => onChange(preset)}
            className={`h-5 w-5 rounded-full ring-1 ring-inset ring-black/10 transition hover:scale-110 ${
              value.toLowerCase() === preset.toLowerCase()
                ? "outline outline-2 outline-offset-1 outline-[#0095F6]"
                : ""
            }`}
            style={{ background: preset }}
          />
        ))}
        <input
          type="color"
          value={value}
          aria-label={`${label} color picker`}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded-md border border-zinc-200 bg-white"
        />
      </div>
    </div>
  );
}

interface GeneratedCarousel {
  slides: { title: string; body: string }[];
  caption: string;
  hashtags: string[];
}

export default function Home() {
  const [themeId, setThemeId] = useState<ThemeId>(defaultThemeId);
  const [aspectRatioId, setAspectRatioId] =
    useState<AspectRatioId>(defaultAspectRatioId);
  const [topic, setTopic] = useState("");
  const [generatedTopic, setGeneratedTopic] = useState("");
  const [generated, setGenerated] = useState<GeneratedCarousel | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"none" | "one" | "all">("none");
  const [exportError, setExportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [overrides, setOverrides] = useState<ThemeOverrides>({});
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [photoQuery, setPhotoQuery] = useState("");
  const [photoResults, setPhotoResults] = useState<UnsplashPhoto[] | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [creditInCaption, setCreditInCaption] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [imagePerSlide, setImagePerSlide] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});
  const [usedPhotos, setUsedPhotos] = useState<Record<string, UnsplashPhoto>>({});
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);

  const theme = useMemo(
    () => resolveTheme(themes[themeId], overrides),
    [themeId, overrides],
  );
  const aspectRatio = aspectRatios[aspectRatioId];

  const slideCount = generated?.slides.length ?? 0;
  const slide: SlideContent | null = generated
    ? generated.slides[currentSlide]
    : null;

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Type a topic first — or tap one of the examples below.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, theme: themeId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data as { error?: string } | null)?.error ??
            "Something went wrong. Please try again.",
        );
        return;
      }
      setGenerated(data as GeneratedCarousel);
      setGeneratedTopic(trimmed);
      setCurrentSlide(0);
      setRegenError(null);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateSlide(index: number, field: "title" | "body", value: string) {
    setGenerated((prev) =>
      prev
        ? {
            ...prev,
            slides: prev.slides.map((s, i) =>
              i === index ? { ...s, [field]: value } : s,
            ),
          }
        : prev,
    );
  }

  function updateCaption(value: string) {
    setGenerated((prev) => (prev ? { ...prev, caption: value } : prev));
  }

  async function handleRegenerateSlide() {
    if (!generated || regenerating) return;
    const index = currentSlide;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/regenerate-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: generatedTopic,
          theme: themeId,
          slideIndex: index,
          slides: generated.slides,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRegenError(
          (data as { error?: string } | null)?.error ??
            "Something went wrong. Please try again.",
        );
        return;
      }
      const newSlide = data as { title: string; body: string };
      setGenerated((prev) =>
        prev
          ? {
              ...prev,
              slides: prev.slides.map((s, i) => (i === index ? newSlide : s)),
            }
          : prev,
      );
    } catch {
      setRegenError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDownloadSlide() {
    const el = exportRefs.current[currentSlide];
    if (!generated || !el || exporting !== "none") return;
    setExporting("one");
    setExportError(null);
    try {
      const dataUrl = await renderSlidePng(el, aspectRatio);
      downloadDataUrl(
        dataUrl,
        `${slugify(generatedTopic)}-slide-${currentSlide + 1}.png`,
      );
    } catch {
      setExportError("Could not export the slide. Please try again.");
    } finally {
      setExporting("none");
    }
  }

  async function handleDownloadAll() {
    if (!generated || exporting !== "none") return;
    setExporting("all");
    setExportError(null);
    try {
      const files: { name: string; dataUrl: string }[] = [];
      const slug = slugify(generatedTopic);
      for (let i = 0; i < generated.slides.length; i++) {
        const el = exportRefs.current[i];
        if (!el) throw new Error(`slide ${i + 1} not rendered`);
        files.push({
          name: `${slug}-slide-${i + 1}.png`,
          dataUrl: await renderSlidePng(el, aspectRatio),
        });
      }
      await downloadZip(files, `${slug}.zip`);
    } catch {
      setExportError("Could not export the slides. Please try again.");
    } finally {
      setExporting("none");
    }
  }

  async function searchPhotos(query: string) {
    const trimmed = query.trim();
    if (!trimmed || photoLoading) return;
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/photos?query=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPhotoError(
          (data as { error?: string } | null)?.error ?? "Photo search failed.",
        );
        setPhotoResults(null);
        return;
      }
      setPhotoResults((data as { photos: UnsplashPhoto[] }).photos);
    } catch {
      setPhotoError("Could not reach the server. Check your connection.");
    } finally {
      setPhotoLoading(false);
    }
  }

  function selectPhoto(photo: UnsplashPhoto) {
    setSelectedPhoto(photo);
    // Unsplash guidelines require hotlinking the original image URL; their CDN
    // sends ACAO:* so html-to-image can still embed it at export time
    // (crossOrigin="anonymous" on the img). /api/image-proxy stays available
    // as a fallback for hosts without CORS.
    if (imagePerSlide && generated) {
      const target = currentSlide;
      setSlideImages((m) => ({ ...m, [target]: photo.fullUrl }));
      setUsedPhotos((m) => ({ ...m, [target]: photo }));
    } else {
      setOverrides((o) => ({ ...o, backgroundImageUrl: photo.fullUrl }));
      setSlideImages({});
      setUsedPhotos({ all: photo });
    }
    // Unsplash guidelines: report the download when a photo is actually used.
    fetch("/api/photos/track-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
    }).catch(() => {});
  }

  async function generateAiImage() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;
    const targetSlide = currentSlide;
    setAiLoading(true);
    setAiError(null);
    try {
      // Download once and keep the bytes as a blob URL, so export reuses the
      // exact image in the preview instead of calling the AI service again
      // (slow, and it spends the free daily allowance).
      const res = await fetch(aiImageUrl(prompt), {
        cache: "no-store",
        signal: AbortSignal.timeout(70_000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAiError(
          (data as { error?: string } | null)?.error ??
            `Could not generate the image (error ${res.status}). Try again.`,
        );
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (imagePerSlide && generated) {
        setSlideImages((m) => ({ ...m, [targetSlide]: url }));
        setUsedPhotos((m) => {
          const copy = { ...m };
          delete copy[targetSlide];
          return copy;
        });
      } else {
        setOverrides((o) => ({ ...o, backgroundImageUrl: url }));
        setSlideImages({});
        setUsedPhotos({});
      }
    } catch {
      // Keep whatever image is already showing — a failed regenerate
      // shouldn't throw away the background the user had.
      setAiError(
        "Could not generate the image (it may have timed out). Please try again.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  // Per-slide images (photo or AI) override the shared background for that
  // slide only.
  function themeForSlide(index: number): ResolvedTheme {
    const url =
      theme.backgroundType === "ai" || theme.backgroundType === "photo"
        ? slideImages[index]
        : undefined;
    return url ? { ...theme, backgroundImageUrl: url } : theme;
  }

  const usedPhotographers = [
    ...new Set(Object.values(usedPhotos).map((p) => p.photographerName)),
  ];
  // Attribution in the picker follows the photo actually on the current slide.
  const attributionPhoto =
    usedPhotos[String(currentSlide)] ?? usedPhotos.all ?? selectedPhoto;
  const photoCreditText =
    creditInCaption && usedPhotographers.length > 0
      ? usedPhotographers.length === 1
        ? `Photo by ${usedPhotographers[0]} on Unsplash`
        : `Photos by ${usedPhotographers.join(", ")} on Unsplash`
      : null;

  async function handleCopyCaption() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(
        `${generated.caption}\n\n${generated.hashtags.join(" ")}${
          photoCreditText ? `\n\n${photoCreditText}` : ""
        }`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setExportError("Could not access the clipboard.");
    }
  }

  return (
    <div className="flex-1 bg-zinc-50 font-sans text-zinc-900">
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-10 lg:justify-center lg:grid-cols-[minmax(0,26rem)_minmax(0,24rem)] lg:gap-16 lg:px-10 lg:py-16">
        {/* Left panel — controls */}
        <section className="flex flex-col gap-8 lg:sticky lg:top-16 lg:self-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Carousel Generator
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Turn a topic into a swipeable Instagram carousel. Type an idea,
              hit generate, and preview it on the right.
            </p>
          </div>

          <form
            onSubmit={handleGenerate}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 sm:p-8"
          >
            <label
              htmlFor="topic"
              className="block text-sm font-medium text-zinc-700"
            >
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 tips for better sleep"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 focus:border-[#0095F6] focus:outline-none focus:ring-2 focus:ring-[#0095F6]/25"
            />
            <span className="mt-6 block text-sm font-medium text-zinc-700">
              Theme
            </span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(Object.keys(themes) as ThemeId[]).map((id) => {
                const t = themes[id];
                const selected = id === themeId;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setThemeId(id);
                      setOverrides({});
                      setSelectedPhoto(null);
                      setSlideImages({});
                      setUsedPhotos({});
                    }}
                    className={`rounded-xl p-1 ring-2 transition ${
                      selected
                        ? "ring-[#0095F6]"
                        : "ring-transparent hover:ring-zinc-200"
                    }`}
                  >
                    <span
                      className="flex h-14 items-center justify-center rounded-lg border border-zinc-200/60"
                      style={{ background: resolveTheme(t).background }}
                    >
                      <span
                        className="text-lg"
                        style={{
                          color: t.textColor,
                          fontFamily: fonts[t.headingFontId].family,
                          fontWeight: t.headingWeight,
                        }}
                      >
                        Aa
                        <span style={{ color: t.accentColor }}>.</span>
                      </span>
                    </span>
                    <span className="mt-1.5 block text-center text-xs font-medium text-zinc-600">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-expanded={customizeOpen}
              onClick={() => setCustomizeOpen((open) => !open)}
              className="mt-5 flex w-full items-center justify-between text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Customize theme
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 transition-transform ${customizeOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {customizeOpen && (
              <div className="mt-3 flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
                <Row label="Background">
                  <Segmented
                    value={theme.backgroundType}
                    onChange={(backgroundType) => {
                      setOverrides((o) => ({ ...o, backgroundType }));
                      setAiError(null);
                      // The source's own controls live in this section
                      setOpenSections((s) => ({ ...s, image: true }));
                      if (
                        backgroundType === "photo" &&
                        photoResults === null &&
                        !photoLoading
                      ) {
                        const suggestion = suggestPhotoQuery(
                          generatedTopic || topic,
                        );
                        setPhotoQuery(suggestion);
                        searchPhotos(suggestion);
                      }
                      if (backgroundType === "ai" && !aiPrompt) {
                        setAiPrompt(
                          suggestAiPrompt(generatedTopic || topic, themeId),
                        );
                      }
                    }}
                    options={[
                      { label: "Solid", value: "solid" as const },
                      { label: "Gradient", value: "gradient" as const },
                      { label: "Subtle", value: "subtle" as const },
                      { label: "Stock photo", value: "photo" as const },
                      { label: "AI", value: "ai" as const },
                    ]}
                  />
                </Row>
                {/* Panel-level so it survives the auto-revert to gradient on AI failure */}
                {aiError && (
                  <p role="alert" className="text-xs text-rose-600">
                    {aiError}
                  </p>
                )}
                <AccordionSection
                  title="Background & Image"
                  open={!!openSections.image}
                  onToggle={() => toggleSection("image")}
                >
                {(theme.backgroundType === "photo" ||
                  theme.backgroundType === "ai") && (
                  <>
                    <Row label="Scrim">
                      <Segmented
                        value={theme.scrimStrength}
                        onChange={(scrimStrength) =>
                          setOverrides((o) => ({ ...o, scrimStrength }))
                        }
                        options={[
                          { label: "None", value: "none" as const },
                          { label: "Light", value: "light" as const },
                          { label: "Medium", value: "medium" as const },
                          { label: "Strong", value: "strong" as const },
                        ]}
                      />
                    </Row>
                    <Row label="Scrim tone">
                      <Segmented
                        value={theme.scrimTone}
                        onChange={(scrimTone) =>
                          setOverrides((o) => ({ ...o, scrimTone }))
                        }
                        options={[
                          { label: "Dark", value: "dark" as const },
                          { label: "Light", value: "light" as const },
                        ]}
                      />
                    </Row>
                    {generated && (
                      <Row label="Apply to">
                        <Segmented
                          value={imagePerSlide ? "one" : "all"}
                          onChange={(v) => setImagePerSlide(v === "one")}
                          options={[
                            { label: "All slides", value: "all" as const },
                            { label: "This slide", value: "one" as const },
                          ]}
                        />
                      </Row>
                    )}
                    {theme.backgroundType === "photo" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={photoQuery}
                            onChange={(e) => setPhotoQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                searchPhotos(photoQuery);
                              }
                            }}
                            placeholder="Search Unsplash photos…"
                            aria-label="Search Unsplash photos"
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-zinc-400 focus:border-[#0095F6] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => searchPhotos(photoQuery)}
                            disabled={photoLoading}
                            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                          >
                            {photoLoading ? "Searching…" : "Search"}
                          </button>
                        </div>
                        {photoError && (
                          <p role="alert" className="text-xs text-rose-600">
                            {photoError}
                          </p>
                        )}
                        {photoResults && photoResults.length === 0 && !photoError && (
                          <p className="text-xs text-zinc-400">
                            No photos found — try another search.
                          </p>
                        )}
                        {photoResults && photoResults.length > 0 && (
                          <div className="grid grid-cols-4 gap-1.5">
                            {photoResults.map((photo) => (
                              <button
                                key={photo.id}
                                type="button"
                                title={photo.alt || "Use this photo"}
                                onClick={() => selectPhoto(photo)}
                                className={`aspect-square overflow-hidden rounded-md ring-2 transition ${
                                  selectedPhoto?.id === photo.id
                                    ? "ring-[#0095F6]"
                                    : "ring-transparent hover:ring-zinc-300"
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photo.thumbUrl}
                                  alt={photo.alt}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        {attributionPhoto && (
                          <>
                            <p className="text-[11px] leading-4 text-zinc-500">
                              Photo by{" "}
                              <a
                                href={`${attributionPhoto.photographerUrl}${UNSPLASH_UTM}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-zinc-700"
                              >
                                {attributionPhoto.photographerName}
                              </a>{" "}
                              on{" "}
                              <a
                                href={`https://unsplash.com/${UNSPLASH_UTM}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-zinc-700"
                              >
                                Unsplash
                              </a>
                            </p>
                            <label className="flex items-center gap-2 text-xs text-zinc-600">
                              <input
                                type="checkbox"
                                checked={creditInCaption}
                                onChange={(e) => setCreditInCaption(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#0095F6]"
                              />
                              Add photo credit to the caption
                            </label>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          rows={3}
                          aria-label="AI image prompt"
                          placeholder="Describe the background image…"
                          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs leading-5 placeholder:text-zinc-400 focus:border-[#0095F6] focus:outline-none"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => generateAiImage()}
                            disabled={aiLoading || !aiPrompt.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                          >
                            {aiLoading && (
                              <span
                                className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
                                aria-hidden="true"
                              />
                            )}
                            {aiLoading ? "Generating…" : "Generate image"}
                          </button>
                        </div>
                        <p className="text-[11px] leading-4 text-zinc-400">
                          Each click makes a new image with FLUX on Cloudflare
                          Workers AI (free daily allowance). Takes a few seconds.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {theme.backgroundType === "gradient" ? (
                  <>
                    <Row label="Presets">
                      <div className="flex items-center gap-1.5">
                        {GRADIENT_PRESETS.map((g) => (
                          <button
                            key={g.label}
                            type="button"
                            title={g.label}
                            aria-label={`Gradient: ${g.label}`}
                            onClick={() =>
                              setOverrides((o) => ({
                                ...o,
                                gradientFrom: g.from,
                                gradientTo: g.to,
                              }))
                            }
                            className={`h-6 w-9 rounded-md ring-1 ring-inset ring-black/10 transition hover:scale-105 ${
                              theme.gradientFrom === g.from &&
                              theme.gradientTo === g.to
                                ? "outline outline-2 outline-offset-1 outline-[#0095F6]"
                                : ""
                            }`}
                            style={{
                              background: `linear-gradient(160deg, ${g.from}, ${g.to})`,
                            }}
                          />
                        ))}
                      </div>
                    </Row>
                    <ColorControl
                      label="From"
                      value={toHexColor(theme.gradientFrom, "#fbd3e0")}
                      onChange={(gradientFrom) =>
                        setOverrides((o) => ({ ...o, gradientFrom }))
                      }
                    />
                    <ColorControl
                      label="To"
                      value={toHexColor(theme.gradientTo, "#ffe9d9")}
                      onChange={(gradientTo) =>
                        setOverrides((o) => ({ ...o, gradientTo }))
                      }
                    />
                  </>
                ) : theme.backgroundType === "photo" ||
                  theme.backgroundType === "ai" ? null : (
                  <ColorControl
                    label="Color"
                    value={toHexColor(theme.backgroundColor, "#ffffff")}
                    presets={BACKGROUND_PRESETS}
                    onChange={(backgroundColor) =>
                      setOverrides((o) => ({ ...o, backgroundColor }))
                    }
                  />
                )}
                </AccordionSection>
                <AccordionSection
                  title="Colors"
                  open={!!openSections.colors}
                  onToggle={() => toggleSection("colors")}
                >
                <ColorControl
                  label="Text"
                  value={toHexColor(theme.textColor, "#111111")}
                  onChange={(textColor) =>
                    setOverrides((o) => ({ ...o, textColor }))
                  }
                />
                <ColorControl
                  label="Accent"
                  value={toHexColor(theme.accentColor, "#0095F6")}
                  presets={ACCENT_PRESETS}
                  onChange={(accentColor) =>
                    setOverrides((o) => ({ ...o, accentColor }))
                  }
                />
                </AccordionSection>
                <AccordionSection
                  title="Typography"
                  open={!!openSections.typography}
                  onToggle={() => toggleSection("typography")}
                >
                <FontSelect
                  label="Heading font"
                  value={theme.headingFontId}
                  onChange={(headingFontId) =>
                    setOverrides((o) => ({ ...o, headingFontId }))
                  }
                />
                <FontSelect
                  label="Body font"
                  value={theme.bodyFontId}
                  onChange={(bodyFontId) =>
                    setOverrides((o) => ({ ...o, bodyFontId }))
                  }
                />
                <Row label="Heading weight">
                  <Segmented
                    value={theme.headingWeight}
                    onChange={(headingWeight) =>
                      setOverrides((o) => ({ ...o, headingWeight }))
                    }
                    options={HEADING_WEIGHTS.map(({ label, value }) => {
                      const supported = (
                        fonts[theme.headingFontId].weights as readonly number[]
                      ).includes(value);
                      return {
                        label,
                        value,
                        disabled: !supported,
                        title: supported
                          ? undefined
                          : `${fonts[theme.headingFontId].label} doesn't ship this weight`,
                      };
                    })}
                  />
                </Row>
                <Row label="Title accent">
                  <Segmented
                    value={theme.titleAccent}
                    onChange={(titleAccent) =>
                      setOverrides((o) => ({ ...o, titleAccent }))
                    }
                    options={[
                      { label: "None", value: "none" as const },
                      { label: "Bar", value: "bar" as const },
                      { label: "Underline", value: "underline" as const },
                      { label: "Highlight", value: "highlight" as const },
                    ]}
                  />
                </Row>
                <Row label="Text size">
                  <Segmented
                    value={theme.textScale}
                    onChange={(textScale) =>
                      setOverrides((o) => ({ ...o, textScale }))
                    }
                    options={TEXT_SIZES.map(({ label, scale }) => ({
                      label,
                      value: scale,
                    }))}
                  />
                </Row>
                </AccordionSection>
                <AccordionSection
                  title="Layout"
                  open={!!openSections.layout}
                  onToggle={() => toggleSection("layout")}
                >
                <Row label="Alignment">
                  <Segmented
                    value={theme.textAlign}
                    onChange={(textAlign) =>
                      setOverrides((o) => ({ ...o, textAlign }))
                    }
                    options={[
                      { label: "Left", value: "left" as const },
                      { label: "Center", value: "center" as const },
                    ]}
                  />
                </Row>
                <Row label="Vertical">
                  <Segmented
                    value={theme.verticalAlign}
                    onChange={(verticalAlign) =>
                      setOverrides((o) => ({ ...o, verticalAlign }))
                    }
                    options={[
                      { label: "Top", value: "top" as const },
                      { label: "Center", value: "center" as const },
                    ]}
                  />
                </Row>
                <Row label="Padding">
                  <Segmented
                    value={theme.padding}
                    onChange={(padding) =>
                      setOverrides((o) => ({ ...o, padding }))
                    }
                    options={[
                      { label: "Comfortable", value: "comfortable" as const },
                      { label: "Spacious", value: "spacious" as const },
                    ]}
                  />
                </Row>
                <Row label="Slide number">
                  <Segmented
                    value={theme.slideNumberStyle}
                    onChange={(slideNumberStyle) =>
                      setOverrides((o) => ({ ...o, slideNumberStyle }))
                    }
                    options={[
                      { label: "None", value: "none" as const },
                      { label: "Chip", value: "chip" as const },
                      { label: "01 / 06", value: "minimal" as const },
                    ]}
                  />
                </Row>
                {theme.slideNumberStyle !== "none" && (
                  <Row label="Number position">
                    <Segmented
                      value={theme.slideNumberPosition}
                      onChange={(slideNumberPosition) =>
                        setOverrides((o) => ({ ...o, slideNumberPosition }))
                      }
                      options={[
                        { label: "Top", value: "top" as const },
                        { label: "Bottom", value: "bottom" as const },
                      ]}
                    />
                  </Row>
                )}
                </AccordionSection>
                <button
                  type="button"
                  onClick={() => {
                    setOverrides({});
                    setSelectedPhoto(null);
                    setSlideImages({});
                    setUsedPhotos({});
                  }}
                  className="self-start text-xs font-medium text-[#0095F6] hover:underline"
                >
                  Reset to theme default
                </button>
              </div>
            )}

            <span className="mt-6 block text-sm font-medium text-zinc-700">
              Aspect ratio
            </span>
            <div className="mt-2 flex gap-1 rounded-xl bg-zinc-100 p-1">
              {(Object.keys(aspectRatios) as AspectRatioId[]).map((id) => {
                const selected = id === aspectRatioId;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAspectRatioId(id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      selected
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {aspectRatios[id].label}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0095F6] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#0095F6]/25 transition-colors hover:bg-[#0082d9] active:bg-[#0074c2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {loading ? "Generating…" : "Generate"}
            </button>
            {error ? (
              <p role="alert" className="mt-4 text-xs leading-5 text-rose-600">
                {error}
              </p>
            ) : (
              <p className="mt-4 text-xs leading-5 text-zinc-400">
                {generated
                  ? "Swipe through your carousel on the right — dots and arrows page between slides."
                  : "Nothing generated yet — type a topic above or tap an example in the preview."}
              </p>
            )}
          </form>
        </section>

        {/* Right panel — phone preview */}
        <section className="flex justify-center lg:justify-start">
          <div className="w-full max-w-sm">
            {/* Phone frame */}
            <div className="rounded-[2.5rem] border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-200/60">
              <div className="overflow-hidden rounded-[2rem] bg-white">
                {/* Post header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/ip-logo.svg"
                        alt="Profile avatar"
                        className="h-3 w-auto"
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold">yourhandle</span>
                  <span className="ml-auto text-lg leading-none tracking-widest text-zinc-400">
                    …
                  </span>
                </div>

                <div
                  className="relative"
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    touchStart.current = { x: t.clientX, y: t.clientY };
                  }}
                  onTouchEnd={(e) => {
                    const start = touchStart.current;
                    touchStart.current = null;
                    if (!generated || !start) return;
                    const t = e.changedTouches[0];
                    const dx = t.clientX - start.x;
                    const dy = t.clientY - start.y;
                    // Real horizontal swipes only — not taps (to edit) or scrolls
                    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) {
                      return;
                    }
                    setCurrentSlide((i) =>
                      dx < 0 ? Math.min(slideCount - 1, i + 1) : Math.max(0, i - 1),
                    );
                  }}
                >
                  {generated && slide ? (
                    <div key={currentSlide} className="animate-slide-in">
                      <Slide
                        theme={themeForSlide(currentSlide)}
                        aspectRatio={aspectRatio}
                        content={slide}
                        slideIndex={currentSlide}
                        slideCount={slideCount}
                        onEdit={(field, value) =>
                          updateSlide(currentSlide, field, value)
                        }
                      />
                    </div>
                  ) : (
                    /* Empty state — themed, with explainer and example chips */
                    <div
                      className={`relative flex w-full flex-col justify-center gap-4 overflow-hidden px-8 transition-[background,color] duration-300 ${
                        theme.textAlign === "center"
                          ? "items-center text-center"
                          : "items-start text-left"
                      }`}
                      style={{
                        aspectRatio: `${aspectRatio.width} / ${aspectRatio.height}`,
                        background: theme.background,
                        color: theme.textColor,
                        fontFamily: theme.fontFamily,
                      }}
                    >
                      {theme.backgroundImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={theme.backgroundImageUrl}
                          alt=""
                          aria-hidden
                          crossOrigin="anonymous"
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                        />
                      )}
                      {theme.backgroundImageUrl && theme.scrimCss && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0"
                          style={{ background: theme.scrimCss }}
                        />
                      )}
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="z-10 h-8 w-8"
                        style={{ color: theme.accentColor }}
                        aria-hidden="true"
                      >
                        <path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9l2-6.5Z" />
                        <path
                          d="m19 15.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z"
                          opacity=".7"
                        />
                      </svg>
                      <h2
                        className={`z-10 ${theme.headingClassName}`}
                        style={{
                          fontFamily: theme.headingFontFamily,
                          fontWeight: theme.headingWeight,
                          fontSize: `${theme.headingRem * 0.8 * theme.textScale}rem`,
                        }}
                      >
                        Your carousel appears here
                      </h2>
                      <p
                        className="z-10 max-w-[15rem] leading-relaxed opacity-75"
                        style={{ fontSize: `${0.875 * theme.textScale}rem` }}
                      >
                        Type a topic and hit Generate — or start from an
                        example:
                      </p>
                      <div
                        className={`z-10 flex max-w-[16rem] flex-wrap gap-2 ${
                          theme.textAlign === "center" ? "justify-center" : "justify-start"
                        }`}
                      >
                        {exampleTopics.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => {
                              setTopic(example);
                              document.getElementById("topic")?.focus();
                            }}
                            className="rounded-full border border-current/25 px-3 py-1.5 text-xs font-medium transition-colors hover:border-current/60"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(regenerating || aiLoading) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                      <span
                        className="h-8 w-8 animate-spin rounded-full border-[3px] border-zinc-400/40 border-t-zinc-600"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  {generated && slideCount > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous slide"
                        disabled={currentSlide === 0}
                        onClick={() => setCurrentSlide((i) => Math.max(0, i - 1))}
                        className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-md transition hover:bg-white disabled:opacity-0"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next slide"
                        disabled={currentSlide === slideCount - 1}
                        onClick={() =>
                          setCurrentSlide((i) => Math.min(slideCount - 1, i + 1))
                        }
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-md transition hover:bg-white disabled:opacity-0"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Dot page indicators */}
            {generated && (
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {Array.from({ length: slideCount }).map((_, i) => {
                  const active = i === currentSlide;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to slide ${i + 1}`}
                      onClick={() => setCurrentSlide(i)}
                      className={`h-1.5 w-1.5 cursor-pointer rounded-full transition-colors ${
                        active ? "" : "bg-zinc-300 hover:bg-zinc-400"
                      }`}
                      style={
                        active ? { backgroundColor: theme.accentColor } : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            {generated && (
              <div className="mt-3 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRegenerateSlide}
                  disabled={regenerating || loading}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:border-[#0095F6]/40 hover:text-[#0095F6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {regenerating ? (
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  )}
                  {regenerating ? "Regenerating…" : "Regenerate this slide"}
                </button>
                {regenError ? (
                  <p role="alert" className="text-xs text-rose-600">
                    {regenError}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400">
                    Click any text on the slide or caption to edit it.
                  </p>
                )}
              </div>
            )}

            {/* Caption block */}
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
              <div className="flex items-center gap-4 text-zinc-800">
                {/* Heart */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
                {/* Comment */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.7 8.7 0 0 1-3.8-.9L3 20l1.2-5.3a8.1 8.1 0 0 1-.7-3.2A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
                </svg>
                {/* Share */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22l-4-9-9-4Z" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-semibold">1,248 likes</p>
              <p className="mt-1 text-sm leading-6 text-zinc-800">
                <span className="font-semibold">@yourhandle</span>{" "}
                <span
                  {...(generated
                    ? {
                        contentEditable: true,
                        suppressContentEditableWarning: true,
                        spellCheck: false,
                        title: "Click to edit",
                        className:
                          "cursor-text rounded outline-1 outline-dashed outline-transparent outline-offset-2 transition hover:outline-zinc-400/70 focus:outline-zinc-400",
                        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        },
                        onBlur: (e: React.FocusEvent<HTMLElement>) => {
                          const value = (e.currentTarget.textContent ?? "")
                            .replace(/\s+/g, " ")
                            .trim();
                          if (!value || value === generated.caption) {
                            e.currentTarget.textContent = generated.caption;
                            return;
                          }
                          updateCaption(value);
                        },
                      }
                    : {})}
                  dangerouslySetInnerHTML={{
                    __html: escapeHtml(
                      generated ? generated.caption : placeholderCaption,
                    ),
                  }}
                />
                {generated ? (
                  <>
                    {" "}
                    <span className="text-[#0095F6]">
                      {generated.hashtags.join(" ")}
                    </span>
                    {photoCreditText && (
                      <span className="text-zinc-500"> {photoCreditText}</span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-400"> …more</span>
                )}
              </p>
            </div>

            {/* Export actions */}
            {generated && (
              <>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSlide}
                    disabled={exporting !== "none"}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:border-[#0095F6]/40 hover:text-[#0095F6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting === "one" ? (
                      <span
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="m7 10 5 5 5-5" />
                        <path d="M12 15V3" />
                      </svg>
                    )}
                    {exporting === "one" ? "Exporting…" : "Download this slide"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={exporting !== "none"}
                    className="flex items-center gap-1.5 rounded-full bg-[#0095F6] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0082d9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting === "all" ? (
                      <span
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        aria-hidden="true"
                      />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="m7 10 5 5 5-5" />
                        <path d="M12 15V3" />
                      </svg>
                    )}
                    {exporting === "all" ? "Zipping slides…" : "Download all slides"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:border-[#0095F6]/40 hover:text-[#0095F6]"
                  >
                    {copied ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5 text-emerald-500"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                    {copied ? "Copied!" : "Copy caption"}
                  </button>
                </div>
                {exportError && (
                  <p role="alert" className="mt-2 text-center text-xs text-rose-600">
                    {exportError}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-center text-xs text-zinc-400 lg:px-10">
        Built by{" "}
        <a
          href="https://innaposokhova.ca/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-500 transition-colors hover:text-[#0095F6]"
        >
          Inna Posokhova
        </a>{" "}
        · Next.js + Claude Code
      </footer>

      {/* Off-screen full-res export renders (no dimension watermark, not editable) */}
      {generated && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0"
          style={{ left: -10_000, width: EXPORT_BASE_WIDTH }}
        >
          {generated.slides.map((s, i) => (
            <div
              key={i}
              ref={(el) => {
                exportRefs.current[i] = el;
              }}
              style={{ width: EXPORT_BASE_WIDTH }}
            >
              <Slide
                theme={themeForSlide(i)}
                aspectRatio={aspectRatio}
                content={s}
                slideIndex={i}
                slideCount={generated.slides.length}
                showDimensionsTag={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
