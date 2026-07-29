"use client";

import { useEffect, useRef, useState } from "react";

import { useStillness } from "@/lib/use-stillness";

/**
 * Text that arrives one character at a time, once, when it is looked at.
 *
 * The effect is a cliché in the wrong place and exactly right in this one. The
 * section it serves is about a record being *assembled* from sources that
 * disagree — a sentence that types itself is the same claim in the same
 * grammar, which is the only justification a typewriter ever has. Used as
 * decoration it is a gimmick that costs the reader time they did not agree to
 * spend.
 *
 * Three things this gets right that the naive version does not.
 *
 * **The layout does not move.** Growing a string inside a block reflows every
 * line under it on nearly every frame, so the paragraph below jitters for the
 * whole animation and the section never settles. The finished text is rendered
 * at full size and made invisible to both eye and screen reader, and the typed
 * copy is painted over it. The box is its final height from the first frame.
 *
 * **A screen reader gets the sentence, not the stutter.** The complete text is
 * in the accessibility tree from the first frame and never leaves it; only the
 * painted overlay is `aria-hidden`. The obvious implementation hides the real
 * text with `visibility: hidden` while the effect runs, which also removes it
 * from the accessibility tree — so the sentence exists only for people who can
 * watch it arrive. Announcing a live region per character is the other common
 * version, and it is unusable.
 *
 * **Stillness collapses pacing, never content.** This is the rule the reduced
 * motion suite in this repository exists to hold: a visitor who asked for no
 * animation gets the finished sentence immediately, not an empty box. That was
 * a real defect here once — a `draw()` helper with two identical branches left
 * seven scenes frozen at their first frame — so the still path returns the
 * final state rather than skipping the render.
 */
export function Typewriter({
  text,
  className,
  /** Milliseconds per character. Whole words per second, not a stutter. */
  speed = 28,
  /** Delay before the first character, for staggering several lines. */
  delay = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  as?: "span" | "p" | "h2" | "h3";
}) {
  const still = useStillness();
  const [typed, setTyped] = useState(0);
  const hostRef = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (still) return;
    const node = hostRef.current;
    if (!node) return;

    /*
      Typing starts when the sentence is actually on screen. Started on mount,
      a section below the fold finishes long before the visitor arrives and
      they meet static text — all of the cost, none of the effect.
    */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || startedRef.current) return;
        startedRef.current = true;
        observer.disconnect();

        /*
          Character count is derived from elapsed time, not accumulated one
          timer at a time.

          The obvious loop — `setTimeout(next, speed)`, incrementing an index —
          was measured on this page at roughly 700ms per character against a
          nominal 26ms. A `setTimeout` chain does not schedule work at a rate;
          it schedules the *next* step after the previous one is delivered, so
          every frame the main thread is busy is added to the total and never
          given back. This section runs a WebGL render loop and a decoding
          video behind it, which is exactly the load that starves it. A
          fifty-six character sentence took over half a minute and was still
          going.

          Reading the clock each frame makes the animation self-correcting: a
          dropped frame is skipped over rather than paid for, so the sentence
          lands on schedule whatever else is competing for the thread.
        */
        const started = performance.now();
        let raf = 0;
        const frame = (now: number) => {
          const elapsed = now - started - delay;
          const shown = elapsed <= 0 ? 0 : Math.min(text.length, Math.floor(elapsed / speed));
          setTyped(shown);
          if (shown < text.length) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        cleanupRef.current = () => cancelAnimationFrame(raf);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cleanupRef.current?.();
    };
  }, [text, speed, delay, still]);

  // Stillness, or a finished run: the whole sentence, no overlay, no caret.
  const done = still || typed >= text.length;

  return (
    <Tag ref={hostRef as never} className={className} style={{ position: "relative" }}>
      {/*
        The finished sentence, holding the box open at its true size and
        readable by assistive tech the entire time.

        `color: transparent` rather than `visibility: hidden`, and the
        difference is the whole point. `visibility: hidden` takes an element out
        of the accessibility tree as well as off the screen, so a screen reader
        reaching this heading mid-animation would find an empty box and move on
        — the sentence would exist only for people watching it arrive. Making
        the glyphs transparent keeps the node rendered, measured and announced
        while the overlay paints the visible characters on top.
      */}
      <span style={done ? undefined : { color: "transparent" }}>{text}</span>

      {!done && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            // The overlay must wrap exactly like the layer beneath it.
            whiteSpace: "pre-wrap",
          }}
        >
          {text.slice(0, typed)}
          <span
            style={{
              display: "inline-block",
              width: "0.06em",
              height: "1em",
              marginLeft: "0.08em",
              verticalAlign: "-0.12em",
              background: "var(--uc-cyan-ink)",
              // No blink. A caret that flashes competes with the characters
              // arriving beside it, which is the thing worth watching.
              opacity: 0.9,
            }}
          />
        </span>
      )}
    </Tag>
  );
}
