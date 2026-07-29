"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";
import { TextRoll, type RollSegment } from "./TextRoll";

/**
 * The opening word, revealed a letter at a time, with a service inside each one.
 *
 * Adapted from the 21st.dev `RevealText` block. Three things changed, and none
 * of them were preference.
 *
 * **The spring is gone.** The original animates each letter with
 * `type: "spring", damping: 8` — a visible overshoot. Bounce easing is on this
 * project's banned list because it reads as motion performing enthusiasm rather
 * than communicating anything. Letters now arrive on `ease-out` in under
 * 280ms each, which is the house rule for every other transition on the site.
 *
 * **The images are ours.** The original points at eight Unsplash URLs. Utility
 * Connect's own photography is off limits here, and remote images would be
 * blocked by the artifact CSP and would make the hero depend on a third party
 * staying up. These are the licensed photographs already in `public/photos`
 * and the project's own renders.
 *
 * **The images mean something.** A word that says CONNECTED, with a different
 * room behind every letter, is the product's claim stated twice — once in
 * language and once in what is being connected. Decorative texture inside type
 * would fail this project's own test; a house per letter does not.
 *
 * Under reduced motion the word is simply present, no reveal and no hover
 * swap — `useStillness()` combines the OS setting with the site's own toggle.
 */

export interface RevealHeadlineProps {
  /**
   * A short line above the word, in the brand cyan.
   *
   * The headline was entirely white, which made the opener the only place on
   * the site where the cyan rule appears without the colour being used for
   * anything. Here it does what it does on their own site: mark the section
   * before the statement lands.
   */
  kicker?: string;
  /** The word to reveal. One word reads best; every letter gets an image. */
  word: string;
  /**
   * Line beneath the word, as segments so it can roll word by word.
   *
   * Segments rather than a node because the roll has to clip each word in its
   * own box, which means the component needs the words themselves rather than
   * arbitrary markup it cannot take apart.
   */
  subline?: RollSegment[];
  /**
   * One image per letter, cycled if shorter than the word.
   * Local paths only — a hero that depends on a remote host is a hero that
   * disappears when that host does.
   */
  images?: string[];
  /** Seconds between letters. */
  letterDelay?: number;
}

/**
 * The interiors and exteriors a move actually connects.
 *
 * Ordered so the sweep reads as walking through a home rather than as a
 * shuffle: approach, entry, the rooms, then the utility itself.
 */
const DEFAULT_IMAGES = [
  "/photos/modern-house-exterior.jpg",
  "/photos/suburban-house.jpg",
  "/photos/moving-in.jpg",
  "/photos/kitchen-island.jpg",
  "/photos/kitchen-interior.jpg",
  "/photos/living-room-tv.jpg",
  "/photos/home-office.jpg",
  "/photos/kitchen-dining.jpg",
  "/renders/utility.webp",
];

export function RevealHeadline({
  kicker,
  word,
  subline,
  images = DEFAULT_IMAGES,
  letterDelay = 0.09,
}: RevealHeadlineProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [sublineIn, setSublineIn] = useState(false);
  const still = useStillness();

  const letters = [...word];

  /**
   * Which letter the light is currently passing through.
   *
   * The photographs used to appear only on hover, which meant almost nobody
   * saw them: a visitor who does not know a headline is interactive has no
   * reason to try. The sweep shows the idea once, unprompted, and hover
   * remains for anyone who wants to stop on a letter.
   */
  const [sweep, setSweep] = useState<number | null>(null);

  /** Outline first, then filled. The two halves of the draw. */
  const [drawn, setDrawn] = useState(false);

  const count = letters.length;
  const drawMs = (count - 1) * letterDelay * 1000 + 620;

  useEffect(() => {
    if (still) {
      setDrawn(true);
      setSublineIn(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // The stroke finishes, then the letters take their fill — the moment the
    // word stops being drawn and starts being read.
    timers.push(setTimeout(() => setDrawn(true), drawMs));

    /*
      The subline waits rather than racing. Two things animating at once means
      neither is read; the word lands, then the sentence that explains it.
    */
    timers.push(setTimeout(() => setSublineIn(true), drawMs + 260));

    /*
      One pass of light across the word, then a long rest before it comes
      round again. Continuous motion in a hero becomes wallpaper within
      seconds and this project treats motion that says nothing as a defect —
      so the interval is long enough that the sweep reads as an event rather
      than as an animation that is simply running.
    */
    /*
      70ms a letter: fast enough to read as a single pass of light travelling
      across the word rather than as nine separate images being shown. A
      visitor gives an opening a second or two, so the whole sweep is over in
      about six hundred milliseconds and leaves an impression rather than a
      demonstration.
    */
    const step = 70;
    const startSweep = () => {
      for (let i = 0; i < count; i++) {
        timers.push(setTimeout(() => setSweep(i), i * step));
      }
      timers.push(setTimeout(() => setSweep(null), count * step + 260));
    };

    timers.push(setTimeout(startSweep, drawMs + 520));
    const loop = setInterval(startSweep, 9000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
    /*
      Depends on the letter *count*, never on the array.

      `letters` is rebuilt by `[...word]` on every render, so a dependency on
      it made this effect re-run continuously: each pass cleared the timers the
      previous pass had set, so `drawn` flipped early and the sweep never got
      past the second letter. Measured, the lit letter alternated between 0 and
      1 for a second and a half and the outline layer never appeared at all.
      A primitive dependency is stable; an array literal is not.
    */
  }, [count, letterDelay, still, drawMs]);

  /*
    Which letter is showing its photograph. A pointer beats the sweep: if
    someone has deliberately stopped on a letter, the automatic pass should not
    pull the image out from under them.
  */
  const lit = hovered ?? sweep;

  return (
    <div className="relative flex flex-col items-center text-center">
      {/*
        A soft floor under the type, and only under the type.

        The word sits on moving footage whose brightness is not ours to
        control — the opener's second clip is a lit interior, and white text on
        it was genuinely hard to read. A radial pool centred on the headline
        keeps the copy legible without flattening the film the section exists
        to show, which a full-frame scrim would do.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-24 -inset-y-16"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(9,14,19,0.62) 0%, rgba(9,14,19,0.38) 45%, transparent 75%)",
        }}
      />

      {kicker && (
        <motion.div
          className="relative mb-5 text-xs font-bold uppercase tracking-[0.34em] sm:text-sm"
          style={{ color: "var(--uc-cyan-ink)", textShadow: "0 2px 16px rgba(9,14,19,0.9)" }}
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {kicker}
        </motion.div>
      )}

      <h1
        className="relative flex flex-wrap justify-center font-black uppercase leading-[0.85] tracking-[-0.03em] text-white"
        style={{
          fontSize: "clamp(52px,11vw,168px)",
          textShadow: "0 4px 40px rgba(9,14,19,0.7)",
        }}
        aria-label={word}
      >
        {letters.map((letter, i) => (
          <motion.span
            key={`${letter}-${i}`}
            aria-hidden
            className="relative inline-block cursor-default"
            onMouseEnter={() => !still && setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            /*
              Transform and opacity only, and no overshoot. The letter rises a
              little and settles — the same easing curve the rest of the site
              uses, so the hero does not announce itself in a different accent
              from everything after it.
            */
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.22,
              delay: still ? 0 : i * letterDelay,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/*
              Three layers of the same glyph, stacked and cross-faded.

              The first attempt animated `-webkit-text-stroke-width` on one
              element from 2px to 0. Measured, the computed value never left
              `0px`: the longhand does not apply reliably through React's style
              object and transitioning it is worse supported still. Separate
              layers cross-fading on opacity work everywhere and are the same
              mechanism the rest of this file already uses.

              The first layer sizes the letter and is never seen — it holds the
              width so nothing reflows when the visible layers swap.
            */}
            <span style={{ color: "transparent" }}>{letter}</span>

            {/* Outline, in the brand cyan: the word being drawn. */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                color: "transparent",
                WebkitTextStroke: "2px var(--uc-cyan-ink)",
                opacity: drawn ? 0 : 1,
                transition: "opacity 380ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {letter}
            </span>

            {/* Filled: the word finished, and readable. */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                color: "#fff",
                opacity: drawn && lit !== i ? 1 : 0,
                transition: "opacity 380ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {letter}
            </span>

            {/*
              Filled with a photograph, when the sweep reaches this letter or a
              pointer stops on it. The sweep is what makes the idea visible at
              all: nobody hovers a headline they have no reason to believe is
              interactive.
            */}
            {!still && (
              <span
                aria-hidden
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url('${images[i % images.length]}')`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  opacity: drawn && lit === i ? 1 : 0,
                  transition: "opacity 300ms ease-out",
                }}
              >
                {letter}
              </span>
            )}
          </motion.span>
        ))}
      </h1>

      {/*
        Their signature rule, under the headline as it is under every heading on
        their site. It is the one repeated mark that ties the sections into a
        single identity, and cyan here is legitimate: it is the site's
        verified-blue used as the brand rule, not as a claim about a value.
      */}
      <motion.div
        className="relative mt-6 h-1 w-20 rounded-full"
        style={{ background: "var(--color-state-verified)" }}
        initial={still ? false : { scaleX: 0 }}
        animate={{ scaleX: sublineIn ? 1 : 0 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      />

      {/*
        The sentence rolls in word by word once the word above has landed.

        Mounted only after `sublineIn` so the roll starts from its own clipped
        boxes rather than having already played invisibly behind an opacity of
        zero — a staggered animation that runs while hidden arrives finished,
        which is the most common way this effect gets built and never seen.
      */}
      {subline && sublineIn && (
        <p
          className="relative mt-6 max-w-2xl text-lg leading-relaxed text-white sm:text-xl"
          style={{ textShadow: "0 2px 18px rgba(9,14,19,0.85)" }}
        >
          <TextRoll segments={subline} />
        </p>
      )}
    </div>
  );
}
