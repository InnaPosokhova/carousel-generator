import { fonts, type FontId } from "./fonts";

export type TextAlign = "left" | "center";
export type VerticalAlign = "top" | "center";
export type BackgroundType = "solid" | "gradient" | "subtle" | "photo" | "ai";
export type ScrimStrength = "none" | "light" | "medium" | "strong";
export type ScrimTone = "dark" | "light";
export type TitleAccent = "none" | "bar" | "underline" | "highlight";

// Hardcoded samples until the real photo/AI sources are wired up.
export const PLACEHOLDER_IMAGES: Record<"photo" | "ai", string> = {
  photo: "/sample-photo.jpg",
  ai: "/sample-ai.jpg",
};
export type PaddingSize = "comfortable" | "spacious";
export type SlideNumberStyle = "none" | "chip" | "minimal";
export type SlideNumberPosition = "top" | "bottom";

export interface Theme {
  label: string;
  backgroundType: BackgroundType;
  /** Used by "solid" and as the base of "subtle" */
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
  accentColor: string;
  scrimStrength: ScrimStrength;
  scrimTone: ScrimTone;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  padding: PaddingSize;
  titleAccent: TitleAccent;
  slideNumberStyle: SlideNumberStyle;
  slideNumberPosition: SlideNumberPosition;
  headingFontId: FontId;
  bodyFontId: FontId;
  headingWeight: number;
  /** Tracking/case only — weight and size are resolved separately */
  headingClassName: string;
  headingRem: number;
}

export const GRADIENT_PRESETS = [
  { label: "Blush", from: "#fbd3e0", to: "#ffe9d9" },
  { label: "Sky", from: "#dbeafe", to: "#ede9fe" },
  { label: "Mint", from: "#d1fae5", to: "#ecfccb" },
  { label: "Dusk", from: "#312e81", to: "#0f172a" },
  { label: "Cream", from: "#fef3c7", to: "#fee2e2" },
] as const;

export const themes = {
  minimal: {
    label: "Minimal",
    backgroundType: "solid",
    backgroundColor: "#faf9f6",
    gradientFrom: "#dbeafe",
    gradientTo: "#ede9fe",
    textColor: "#111111",
    accentColor: "#2563eb",
    scrimStrength: "medium",
    scrimTone: "dark",
    textAlign: "left",
    verticalAlign: "center",
    padding: "comfortable",
    titleAccent: "bar",
    slideNumberStyle: "minimal",
    slideNumberPosition: "top",
    headingFontId: "inter",
    bodyFontId: "inter",
    headingWeight: 700,
    headingClassName: "tracking-tight",
    headingRem: 1.5,
  },
  bold: {
    label: "Bold",
    backgroundType: "solid",
    backgroundColor: "#111111",
    gradientFrom: "#312e81",
    gradientTo: "#0f172a",
    textColor: "#ffffff",
    accentColor: "#f43f5e",
    scrimStrength: "medium",
    scrimTone: "dark",
    textAlign: "center",
    verticalAlign: "center",
    padding: "comfortable",
    titleAccent: "highlight",
    slideNumberStyle: "chip",
    slideNumberPosition: "top",
    headingFontId: "poppins",
    bodyFontId: "poppins",
    headingWeight: 800,
    headingClassName: "uppercase tracking-tight",
    headingRem: 1.875,
  },
  aesthetic: {
    label: "Aesthetic",
    backgroundType: "gradient",
    backgroundColor: "#fff7f0",
    gradientFrom: "#fbd3e0",
    gradientTo: "#ffe9d9",
    textColor: "#3a2e2e",
    accentColor: "#c084fc",
    scrimStrength: "medium",
    scrimTone: "dark",
    textAlign: "center",
    verticalAlign: "center",
    padding: "spacious",
    titleAccent: "underline",
    slideNumberStyle: "minimal",
    slideNumberPosition: "bottom",
    headingFontId: "playfair",
    bodyFontId: "lora",
    headingWeight: 700,
    headingClassName: "tracking-tight",
    headingRem: 1.875,
  },
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof themes;

export const defaultThemeId: ThemeId = "minimal";

/** User tweaks from the Customize panel; anything unset falls back to the base theme. */
export interface ThemeOverrides {
  backgroundType?: BackgroundType;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  textColor?: string;
  accentColor?: string;
  backgroundImageUrl?: string;
  scrimStrength?: ScrimStrength;
  scrimTone?: ScrimTone;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  padding?: PaddingSize;
  titleAccent?: TitleAccent;
  slideNumberStyle?: SlideNumberStyle;
  slideNumberPosition?: SlideNumberPosition;
  textScale?: number;
  headingFontId?: FontId;
  bodyFontId?: FontId;
  headingWeight?: number;
}

export interface ResolvedTheme extends Theme {
  /** Computed CSS background from backgroundType + colors */
  background: string;
  /** Image URL when backgroundType is photo/ai (null otherwise) */
  backgroundImageUrl: string | null;
  /** CSS for the legibility overlay between image and text (null = no scrim) */
  scrimCss: string | null;
  textScale: number;
  headingFontFamily: string;
  fontFamily: string;
}

const SCRIM_ALPHAS: Record<Exclude<ScrimStrength, "none">, [number, number]> = {
  light: [0.35, 0.15],
  medium: [0.55, 0.35],
  strong: [0.75, 0.55],
};

function computeScrim(strength: ScrimStrength, tone: ScrimTone): string | null {
  if (strength === "none") return null;
  const [edge, middle] = SCRIM_ALPHAS[strength];
  const rgb = tone === "light" ? "255, 255, 255" : "0, 0, 0";
  return `linear-gradient(180deg, rgba(${rgb}, ${edge}) 0%, rgba(${rgb}, ${middle}) 50%, rgba(${rgb}, ${edge}) 100%)`;
}

function computeBackground(theme: Theme): string {
  switch (theme.backgroundType) {
    case "gradient":
      return `linear-gradient(160deg, ${theme.gradientFrom} 0%, ${theme.gradientTo} 100%)`;
    case "subtle":
      // Soft accent tint from one corner over the solid base
      return `radial-gradient(circle at 84% 12%, color-mix(in srgb, ${theme.accentColor} 14%, transparent) 0%, transparent 55%), ${theme.backgroundColor}`;
    default:
      return theme.backgroundColor;
  }
}

export function resolveTheme(
  base: Theme,
  overrides: ThemeOverrides = {},
): ResolvedTheme {
  const headingFontId = overrides.headingFontId ?? base.headingFontId;
  const bodyFontId = overrides.bodyFontId ?? base.bodyFontId;
  const headingFont = fonts[headingFontId];
  const supportedWeights = headingFont.weights as readonly number[];
  const wantedWeight = overrides.headingWeight ?? base.headingWeight;
  // Fonts that don't ship the requested weight get their heaviest available.
  const headingWeight = supportedWeights.includes(wantedWeight)
    ? wantedWeight
    : supportedWeights[supportedWeights.length - 1];

  const merged: Theme = {
    ...base,
    backgroundType: overrides.backgroundType ?? base.backgroundType,
    backgroundColor: overrides.backgroundColor ?? base.backgroundColor,
    gradientFrom: overrides.gradientFrom ?? base.gradientFrom,
    gradientTo: overrides.gradientTo ?? base.gradientTo,
    textColor: overrides.textColor ?? base.textColor,
    accentColor: overrides.accentColor ?? base.accentColor,
    scrimStrength: overrides.scrimStrength ?? base.scrimStrength,
    scrimTone: overrides.scrimTone ?? base.scrimTone,
    textAlign: overrides.textAlign ?? base.textAlign,
    verticalAlign: overrides.verticalAlign ?? base.verticalAlign,
    padding: overrides.padding ?? base.padding,
    titleAccent: overrides.titleAccent ?? base.titleAccent,
    slideNumberStyle: overrides.slideNumberStyle ?? base.slideNumberStyle,
    slideNumberPosition:
      overrides.slideNumberPosition ?? base.slideNumberPosition,
    headingFontId,
    bodyFontId,
    headingWeight,
  };

  const isImage =
    merged.backgroundType === "photo" || merged.backgroundType === "ai";
  const backgroundImageUrl = isImage
    ? (overrides.backgroundImageUrl ??
      PLACEHOLDER_IMAGES[merged.backgroundType as "photo" | "ai"])
    : null;
  // Over an image with no explicit text color, pick the readable default for
  // the scrim tone (dark scrim -> light text, light scrim -> dark text).
  if (isImage && overrides.textColor === undefined) {
    merged.textColor = merged.scrimTone === "light" ? "#111111" : "#ffffff";
  }

  return {
    ...merged,
    background: computeBackground(merged),
    backgroundImageUrl,
    scrimCss: isImage
      ? computeScrim(merged.scrimStrength, merged.scrimTone)
      : null,
    textScale: overrides.textScale ?? 1,
    headingFontFamily: headingFont.family,
    fontFamily: fonts[bodyFontId].family,
  };
}
