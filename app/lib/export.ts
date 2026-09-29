import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { AspectRatio } from "./aspect-ratios";

// Slides are rendered off-screen at this CSS width, then rasterized with
// pixelRatio = target / base so the PNG comes out at the true resolution
// (e.g. 1080 / 360 = 3x) with crisp text.
export const EXPORT_BASE_WIDTH = 360;

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "carousel"
  );
}

// Neutral stand-in when a background image can't be fetched at export time —
// the export succeeds with a plain background instead of failing outright.
const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="100%" height="100%" fill="#e4e4e7"/></svg>',
  );

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") ? await blobToDataUrl(blob) : null;
  } catch {
    return null;
  }
}

// Exporting all slides usually embeds the same photo several times.
const dataUrlCache = new Map<string, Promise<string | null>>();

// Remote images go through our same-origin proxy first: html-to-image's own
// re-fetch of a cross-origin URL fails intermittently (browser cache entries
// without CORS headers, CDN hiccups), and then the placeholder gray ends up
// in the PNG instead of the photo.
function imageDataUrl(src: string): Promise<string | null> {
  let cached = dataUrlCache.get(src);
  if (!cached) {
    const isRemote =
      /^https?:/i.test(src) && new URL(src).origin !== window.location.origin;
    cached = (async () =>
      (isRemote
        ? await fetchDataUrl(`/api/image-proxy?url=${encodeURIComponent(src)}`)
        : null) ?? (await fetchDataUrl(src)))();
    // Don't cache failures — the next export should retry.
    cached.then((result) => {
      if (!result) dataUrlCache.delete(src);
    });
    dataUrlCache.set(src, cached);
  }
  return cached;
}

// Swaps every <img> in the slide for an embedded data URL, waits for it to
// decode, and returns a function that puts the original sources back.
async function inlineImages(element: HTMLElement): Promise<() => void> {
  const restores: (() => void)[] = [];
  await Promise.all(
    Array.from(element.querySelectorAll("img")).map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await imageDataUrl(src);
      if (!dataUrl) return; // html-to-image will try, then use the placeholder
      img.src = dataUrl;
      restores.push(() => {
        img.src = src;
      });
      await img.decode().catch(() => {});
    }),
  );
  return () => restores.forEach((restore) => restore());
}

export async function renderSlidePng(
  element: HTMLElement,
  aspectRatio: AspectRatio,
): Promise<string> {
  // Web fonts must be fully loaded or html-to-image bakes the fallback
  // font into the PNG.
  await document.fonts.ready;
  const restoreImages = await inlineImages(element);
  try {
    return await toPng(element, {
      pixelRatio: aspectRatio.width / EXPORT_BASE_WIDTH,
      imagePlaceholder: IMAGE_PLACEHOLDER,
    });
  } finally {
    restoreImages();
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function downloadZip(
  files: { name: string; dataUrl: string }[],
  zipName: string,
): Promise<void> {
  const zip = new JSZip();
  for (const { name, dataUrl } of files) {
    zip.file(name, dataUrl.slice(dataUrl.indexOf(",") + 1), { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
