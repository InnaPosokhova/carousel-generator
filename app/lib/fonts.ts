export interface FontOption {
  label: string;
  /** CSS stack — the next/font variable plus a safety fallback */
  family: string;
  category: "Clean sans" | "Elegant serif" | "Display";
  /** Heading weights the font actually ships with */
  weights: number[];
}

export const fonts = {
  inter: {
    label: "Inter",
    family: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    category: "Clean sans",
    weights: [400, 700, 800],
  },
  poppins: {
    label: "Poppins",
    family: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
    category: "Clean sans",
    weights: [400, 700, 800],
  },
  playfair: {
    label: "Playfair Display",
    family: "var(--font-playfair), Georgia, serif",
    category: "Elegant serif",
    weights: [400, 700, 800],
  },
  lora: {
    label: "Lora",
    family: "var(--font-lora), Georgia, serif",
    category: "Elegant serif",
    weights: [400, 700],
  },
  spaceGrotesk: {
    label: "Space Grotesk",
    family: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
    category: "Display",
    weights: [400, 700],
  },
  bebas: {
    label: "Bebas Neue",
    family: 'var(--font-bebas), "Arial Narrow", sans-serif',
    category: "Display",
    weights: [400],
  },
} as const satisfies Record<string, FontOption>;

export type FontId = keyof typeof fonts;

export const fontCategories = [
  "Clean sans",
  "Elegant serif",
  "Display",
] as const;

export const HEADING_WEIGHTS = [
  { label: "Regular", value: 400 },
  { label: "Bold", value: 700 },
  { label: "Extra-bold", value: 800 },
] as const;
