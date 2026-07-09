export interface AspectRatio {
  label: string;
  width: number;
  height: number;
}

export const aspectRatios = {
  portrait: { label: "Portrait 4:5", width: 1080, height: 1350 },
  square: { label: "Square 1:1", width: 1080, height: 1080 },
  story: { label: "Story 9:16", width: 1080, height: 1920 },
} as const satisfies Record<string, AspectRatio>;

export type AspectRatioId = keyof typeof aspectRatios;

export const defaultAspectRatioId: AspectRatioId = "portrait";
