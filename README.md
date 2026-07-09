# Carousel Generator

**Turn any topic into a polished, ready-to-post Instagram carousel — AI-written slides, designer themes, and full-resolution PNG export.**

## Why I built this

Making a decent-looking carousel usually means bouncing between ChatGPT for copy, Canva for design, and a folder of exports that never quite match. I wanted the whole loop in one place: type a topic, get a designed, editable carousel, tweak it live, and download post-ready images — built as a portfolio piece to show end-to-end product thinking (API design, AI integration, design systems, and export pipelines) in a single Next.js app.

## Demo

<!-- TODO: Add a demo GIF or screenshot here. Record the flow: type topic → Generate → switch theme → customize → export.
     Drop the file in e.g. `docs/demo.gif` and embed it: ![Demo](docs/demo.gif) -->

**Live demo:** [carousel.innaposokhova.ca](https://carousel.innaposokhova.ca)

## Features

- **AI slide generation** — Gemini writes 5–7 slides (hook → one idea per slide → call-to-action), a caption, and 5 hashtags, tone-matched to the selected theme. Titles are numbered only when the topic is a list ("5 tips…"), not for every topic.
- **3 base themes, fully customizable** — Minimal, Bold, and Aesthetic ship as distinct font pairings + palettes. A collapsible customize panel (Background & Image / Colors / Typography / Layout) exposes everything without overwhelming the UI:
  - colors (pickers + presets), gradients (5 presets or custom two-color)
  - 6 curated Google Fonts (clean sans / elegant serif / display) with heading-weight control
  - title accents (bar, underline, keyword highlight), text size, alignment, vertical position, padding, slide-number styling
  - cover slide is automatically distinct (larger title, accent shape)
- **Aspect ratios** — Portrait 4:5 (1080×1350), Square 1:1 (1080×1080), and Story 9:16 (1080×1920); adding formats is a one-line config change.
- **Image backgrounds** — Unsplash stock search (auto-suggested query from the topic) and Pollinations AI generation (prompt auto-built from topic + theme vibe, editable, with seed control), applied to all slides or per slide, with an adjustable legibility scrim (strength + dark/light tone) so text always stays readable.
- **Edit everything inline** — click any slide title, body, or the caption to edit; regenerate any single slide with full deck context so it doesn't repeat the others.
- **Export** — download any slide as a full-resolution PNG or all slides as a zip; text auto-scales so no layout breaks, and web fonts/images are fully loaded before rendering so exports match the preview exactly.

## Tech stack

| Choice | Why |
|---|---|
| **Next.js (App Router) + TypeScript** | One codebase for UI and serverless API routes; typed theme/config objects keep the customization system maintainable. |
| **Tailwind CSS** | Fast iteration on a design-heavy UI; theme values that must be dynamic (user-picked colors, fonts, scales) are applied via a single resolved-theme object instead of generated classes. |
| **Google Gemini (`gemini-2.5-flash`)** | Free-tier friendly text generation with JSON output mode; responses are parsed and schema-validated server-side before reaching the client. |
| **Unsplash API** | High-quality stock backgrounds with a proper compliance story (attribution + download tracking). |
| **Pollinations.ai** | Keyless AI image generation for custom backgrounds. |
| **`next/font`** | Self-hosts the curated Google Fonts, so exports never race a font CDN. |
| **`html-to-image` + `jszip`** | Client-side rendering of the actual slide DOM to PNG at 3× (true 1080-width output) and zip packaging — no server rendering needed. |

### Security & reliability notes

- **API keys never reach the browser.** Gemini and Unsplash calls happen exclusively inside serverless API routes (`/api/generate`, `/api/regenerate-slide`, `/api/photos`); keys live in `.env.local` (gitignored) and are read from `process.env` server-side only.
- **Exports can't be broken by remote images.** Pollinations images are fetched through a same-origin proxy (`/api/ai-image`) and kept as blob URLs, because their CDN rejects browser `fetch()` calls; Unsplash images are hotlinked (their guideline) which works because their CDN sends CORS headers — and a same-origin `/api/image-proxy` with a host allowlist exists as a fallback. Slides load images with `crossOrigin="anonymous"`, and the export pipeline substitutes a neutral placeholder if an image can't be fetched, so a bad image never kills an export.
- Friendly, specific error states throughout: empty topic, invalid/missing keys, Gemini free-tier rate limits, Unsplash demo-tier limit (50/hr), AI-image failures (auto-revert to gradient).

## Local setup

```bash
git clone <this-repo>
cd carousel-generator
npm install
```

1. **Gemini key (free):** create one at [Google AI Studio](https://aistudio.google.com) → API keys. The free tier is plenty for development.
2. **Unsplash key (free):** create an app at [unsplash.com/oauth/applications](https://unsplash.com/oauth/applications) and copy the **Access Key** (demo tier: 50 requests/hour).
3. Add both to `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_gemini_key
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

4. Run it:

```bash
npm run dev
# open http://localhost:3000
```

**Pollinations needs no key** — AI image backgrounds work out of the box.

Quick API smoke test (server must be running): `sh scripts/test-generate.sh "your topic" minimal`

## Unsplash API compliance

- Photos are **hotlinked** to their original `images.unsplash.com` URLs.
- Selecting a photo **triggers the download endpoint** (`links.download_location`) server-side, as required.
- Attribution — *"Photo by {photographer} on Unsplash"* with UTM-tagged links — is shown in the picker, and an optional toggle appends photo credits to the generated caption for posting.
- The app is visually distinct from Unsplash and doesn't use the name.

## What I'd add next

- **Story templates** — 9:16 export exists; add Story-specific layouts and safe zones for the reply bar.
- **Logo / handle stamping** — watermark each slide with a user's handle or logo.
- **Tone selector** — decouple writing tone (casual, expert, playful) from the visual theme.
- **Saved carousels** — persistence (local or accounts) so drafts survive a refresh.
- **Image upload** — user-provided backgrounds alongside stock and AI.

---

Built by [Inna Posokhova](https://innaposokhova.ca/) · Next.js + Gemini
