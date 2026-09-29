"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import type { AspectRatio } from "../lib/aspect-ratios";
import type { ResolvedTheme } from "../lib/themes";

export interface SlideContent {
  title: string;
  body?: string;
}

export type EditableSlideField = "title" | "body";

// Only transition the outline — animating font-size would race the
// measurement-based auto-fit below.
const EDITABLE_CLASS =
  "cursor-text rounded-md outline-1 outline-dashed outline-transparent outline-offset-4 transition-[outline-color] hover:outline-zinc-400/70 focus:outline-zinc-400";

// The cover (slide 1) gets a visibly larger title than content slides.
const COVER_TITLE_BOOST = 1.18;

// contentEditable text must be rendered via dangerouslySetInnerHTML: if React
// manages the children, user edits replace the text nodes React owns and the
// next state commit crashes the reconciler (remounting the whole page).
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function blurOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

// Long text shrinks instead of overflowing the fixed-ratio slide; the root's
// overflow-hidden is the last-resort clip for absurd lengths.
function titleScale(length: number): number {
  if (length <= 45) return 1;
  if (length <= 80) return 0.85;
  if (length <= 130) return 0.72;
  return 0.6;
}

function bodyScale(length: number): number {
  if (length <= 170) return 1;
  if (length <= 280) return 0.85;
  if (length <= 450) return 0.78;
  return 0.7;
}

// Wraps the first real word in a soft accent mark ("highlight" title accent).
function highlightFirstKeyword(escapedTitle: string, accent: string): string {
  const words = escapedTitle.split(" ");
  const index = words.findIndex((word) => /[a-zA-Z]/.test(word));
  if (index === -1) return escapedTitle;
  words[index] =
    `<span style="background:color-mix(in srgb, ${accent} 30%, transparent);` +
    `padding:0 0.12em;border-radius:0.15em;` +
    `-webkit-box-decoration-break:clone;box-decoration-break:clone">` +
    `${words[index]}</span>`;
  return words.join(" ");
}

export default function Slide({
  theme,
  aspectRatio,
  content,
  slideIndex,
  slideCount,
  onEdit,
  showDimensionsTag = true,
}: {
  theme: ResolvedTheme;
  aspectRatio: AspectRatio;
  content: SlideContent;
  slideIndex?: number;
  slideCount?: number;
  onEdit?: (field: EditableSlideField, value: string) => void;
  showDimensionsTag?: boolean;
}) {
  const centered = theme.textAlign === "center";
  const isCover = slideIndex === 0;
  const paddingRem = theme.padding === "spacious" ? 3.5 : 2.5;

  // Measurement-based auto-fit: whatever combination of boost/scale/padding is
  // active, shrink the content block until it fits the fixed-ratio frame.
  const innerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useLayoutEffect(() => {
    setFitScale(1);
  }, [
    content.title,
    content.body,
    theme.textScale,
    theme.padding,
    theme.headingRem,
    theme.headingFontId,
    theme.headingWeight,
    theme.titleAccent,
    aspectRatio,
  ]);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const root = inner?.parentElement;
    if (!inner || !root) return;
    const style = getComputedStyle(root);
    const available =
      root.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom);
    if (inner.scrollHeight > available + 1 && fitScale > 0.45) {
      setFitScale(
        Math.max(0.45, fitScale * (available / inner.scrollHeight) * 0.98),
      );
    }
  });

  function commit(
    field: EditableSlideField,
    original: string,
    event: FocusEvent<HTMLElement>,
  ) {
    const value = (event.currentTarget.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!value || value === original) {
      // Restore the DOM by hand — React won't re-render since state is unchanged.
      event.currentTarget.textContent = original;
      return;
    }
    onEdit?.(field, value);
  }

  const editableProps = onEdit
    ? {
        contentEditable: true,
        suppressContentEditableWarning: true,
        spellCheck: false,
        onKeyDown: blurOnEnter,
        title: "Click to edit",
      }
    : {};

  const titleRem =
    theme.headingRem *
    titleScale(content.title.length) *
    theme.textScale *
    (isCover ? COVER_TITLE_BOOST : 1) *
    fitScale;

  const titleHtml =
    theme.titleAccent === "highlight"
      ? highlightFirstKeyword(escapeHtml(content.title), theme.accentColor)
      : escapeHtml(content.title);

  const numberPositionClass =
    theme.slideNumberPosition === "bottom" ? "bottom-4 left-4" : "top-4 left-4";

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden transition-[background,color] duration-300 ${
        theme.verticalAlign === "top" ? "justify-start" : "justify-center"
      }`}
      style={{
        aspectRatio: `${aspectRatio.width} / ${aspectRatio.height}`,
        background: theme.background,
        color: theme.textColor,
        fontFamily: theme.fontFamily,
        padding: `${paddingRem}rem`,
      }}
    >
      {/* Image background + legibility scrim (photo / AI sources) */}
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

      {/* Subtle background: light geometric ring in a corner */}
      {theme.backgroundType === "subtle" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full border-8"
          style={{
            borderColor: `color-mix(in srgb, ${theme.accentColor} 16%, transparent)`,
          }}
        />
      )}
      {/* Cover slides get a soft accent shape (not over photos/AI images) */}
      {isCover && !theme.backgroundImageUrl && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -right-12 h-44 w-44 rounded-full"
          style={{
            background: `color-mix(in srgb, ${theme.accentColor} 16%, transparent)`,
          }}
        />
      )}

      {slideIndex !== undefined &&
        slideCount !== undefined &&
        theme.slideNumberStyle !== "none" &&
        (theme.slideNumberStyle === "chip" ? (
          <span
            className={`absolute z-10 ${numberPositionClass} rounded-full px-3 py-1 font-semibold uppercase tracking-wide text-white`}
            style={{
              backgroundColor: theme.accentColor,
              fontSize: `${0.6875 * theme.textScale}rem`,
            }}
          >
            Slide {slideIndex + 1} of {slideCount}
          </span>
        ) : (
          <span
            className={`absolute z-10 ${numberPositionClass} font-semibold tracking-[0.2em]`}
            style={{
              color: theme.accentColor,
              fontSize: `${0.6875 * theme.textScale}rem`,
            }}
          >
            {String(slideIndex + 1).padStart(2, "0")} /{" "}
            {String(slideCount).padStart(2, "0")}
          </span>
        ))}

      <div
        ref={innerRef}
        className={`relative z-10 flex w-full flex-col gap-3 ${
          centered ? "items-center text-center" : "items-start text-left"
        }`}
      >
        {theme.titleAccent === "bar" && (
          <span
            aria-hidden
            className="h-1 w-10 rounded-full"
            style={{ background: theme.accentColor }}
          />
        )}

        <h2
        className={`${theme.headingClassName} leading-snug ${onEdit ? EDITABLE_CLASS : ""}`}
        style={{
          fontFamily: theme.headingFontFamily,
          fontWeight: theme.headingWeight,
          fontSize: `${titleRem}rem`,
          ...(theme.titleAccent === "underline"
            ? {
                textDecorationLine: "underline",
                textDecorationColor: theme.accentColor,
                textDecorationThickness: "0.12em",
                textUnderlineOffset: "0.18em",
              }
            : {}),
        }}
          {...editableProps}
          onBlur={onEdit ? (e) => commit("title", content.title, e) : undefined}
          dangerouslySetInnerHTML={{ __html: titleHtml }}
        />
        {content.body !== undefined && (
          <p
            className={`leading-relaxed opacity-75 ${onEdit ? EDITABLE_CLASS : ""}`}
            style={{
              fontSize: `${0.875 * bodyScale(content.body.length) * theme.textScale * fitScale}rem`,
            }}
            {...editableProps}
            onBlur={onEdit ? (e) => commit("body", content.body ?? "", e) : undefined}
            dangerouslySetInnerHTML={{ __html: escapeHtml(content.body) }}
          />
        )}
      </div>
      {showDimensionsTag && (
        <span className="absolute bottom-3 right-4 text-[10px] font-medium opacity-50">
          {aspectRatio.width} × {aspectRatio.height}
        </span>
      )}
    </div>
  );
}
