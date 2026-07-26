import Image from "next/image";

/**
 * A full-bleed photograph with a line of copy over it.
 *
 * The marketing pages were almost entirely type on flat colour, which reads as
 * a document rather than a brand. This is the counterweight: a photograph given
 * the full width, at a height that makes it a moment in the scroll rather than
 * an illustration beside a paragraph.
 *
 * Every photograph gets the same grade as the hero — desaturated under a navy
 * wash, darkened from the side the text sits on. That consistency is what makes
 * a set of stock photographs read as one brand's photography instead of a
 * gallery of things found on the internet. It is also what lets white type sit
 * on any of them without hand-tuning each one.
 *
 * Sources and licences are recorded in `public/photos/CREDITS.md`.
 */
export function PhotoBand({
  src,
  alt,
  eyebrow,
  title,
  body,
  align = "left",
  height = "tall",
  priority = false,
}: {
  src: string;
  alt: string;
  eyebrow?: string;
  title: React.ReactNode;
  body?: string;
  align?: "left" | "center";
  height?: "tall" | "short";
  priority?: boolean;
}) {
  const centred = align === "center";

  return (
    <section
      className={`relative flex overflow-hidden ${
        height === "tall" ? "min-h-[64vh]" : "min-h-[44vh]"
      }`}
      style={{ background: "var(--uc-navy-1)" }}
    >
      {/*
        `alt` is empty when the photograph is decorative and the heading above
        already carries the meaning — announcing "a family carrying boxes" to a
        screen reader after it has read the heading adds nothing and costs time.
        Callers pass real alt text when the image itself is the information.
      */}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
        style={{ filter: "saturate(0.5) contrast(1.1) brightness(0.92)" }}
      />

      {/* The grade, in two passes: a brand wash, then a directional darkening
          under wherever the text lands. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "var(--uc-navy-1)", opacity: 0.38, mixBlendMode: "multiply" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: centred
            ? "radial-gradient(ellipse at center, rgba(16,22,28,0.74) 0%, rgba(16,22,28,0.5) 70%)"
            : "linear-gradient(90deg, rgba(16,22,28,0.82) 0%, rgba(16,22,28,0.36) 55%, rgba(16,22,28,0.08) 100%)",
        }}
      />

      <div className="relative flex w-full items-center">
        <div
          className={`mx-auto w-full max-w-6xl px-6 py-20 ${centred ? "text-center" : ""}`}
        >
          {eyebrow && (
            <div
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--color-state-verified)" }}
            >
              {eyebrow}
            </div>
          )}
          <h2
            className={`mt-3 font-semibold leading-[1.08] tracking-tight text-white ${
              centred ? "mx-auto max-w-3xl" : "max-w-2xl"
            }`}
            style={{ fontSize: "clamp(26px,4vw,52px)" }}
          >
            {title}
          </h2>
          {body && (
            <p
              className={`mt-4 text-base leading-relaxed text-white/75 sm:text-lg ${
                centred ? "mx-auto max-w-2xl" : "max-w-xl"
              }`}
            >
              {body}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
