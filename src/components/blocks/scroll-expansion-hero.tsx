"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

import { useStillness } from "@/lib/use-stillness";

/**
 * A film that opens into the viewport as you scroll past it.
 *
 * Adapted from the 21st.dev `scroll-expansion-hero` block. Four things are
 * different, and none of them were optional.
 *
 * **1. It does not hijack the wheel.** The original listens for `wheel` and
 * `touchmove`, calls `preventDefault()`, and advances its own private scroll
 * counter until the media is fully open. That traps the page: Page Down, the
 * space bar, End, a screen reader's own scrolling and a trackpad flick all
 * stop meaning what they mean everywhere else, and the scrollbar lies about
 * position. This is a normal tall section with a sticky stage inside it,
 * driven by `useScroll` — the browser scrolls as it always does and the
 * animation reads the position rather than owning it.
 *
 * **2. The frame is a real 16:9 card.** The first version scaled a full-bleed
 * element down, which meant the resting frame inherited the *viewport's* shape
 * — a thin letterbox on a wide monitor, floating in black. It read as a video
 * that had failed to load. Now the card is explicitly 16:9 with its own
 * corners, and it scales up until it covers the viewport, which is the shape
 * the effect is supposed to have.
 *
 * **3. It animates `transform` and `opacity` only.** The original interpolates
 * width and height in viewport units, relayouting every frame with a video
 * inside it. Scaling produces the same picture and stays on the compositor.
 *
 * **4. Stillness is honoured for real.** `useStillness()` combines the OS
 * `prefers-reduced-motion` with this site's own accessibility toggle. When
 * either is set the scroll coupling is removed entirely and the clips are
 * presented at rest with native controls and no autoplay, because a CSS
 * duration override cannot stop a per-frame inline transform, and a visitor
 * who asked for stillness getting a video that plays itself is the exact
 * failure that toggle exists to prevent.
 *
 * Audio is muted until the visitor asks otherwise. That is what makes autoplay
 * permitted in every current browser, and it is also just decent: nobody
 * opening a page in an open-plan office should have to hunt for the sound.
 */
export interface ScrollExpandMediaProps {
  /**
   * The clips, played in order as one film.
   *
   * Every clip is mounted at once and stacked, with only the active one
   * visible and playing. That costs a few idle video elements and buys a clean
   * join: the next clip has buffered while the current one played, so the cut
   * does not flash black the way swapping `src` on a single element does.
   */
  sources: string[];
  /** Poster for the first clip. Without one the frame is black until the first frame decodes. */
  posterSrc?: string | null;
  /** A still behind the frame, receding as the film opens. */
  bgImageSrc?: string | null;
  /** The claim. Splits apart as the film opens. */
  title: string;
  /**
   * The trailing half of the title, which travels right and carries the
   * verified cyan.
   *
   * Must be a suffix of `title`. Naming it explicitly rather than splitting on
   * the last space is a colour decision, not a typographic one: `#0087B5`
   * means *verified* here and nothing else, so the accented half has to be the
   * half actually making a claim about verification. Splitting on whitespace
   * would put the brand colour on whichever word happened to be last, which is
   * how a palette with one meaning quietly acquires two.
   */
  accent?: string;
  /**
   * Replaces the split title entirely.
   *
   * The split treatment parts two halves of a sentence around the opening
   * frame, which suits a claim. A single revealed word wants the middle of the
   * stage to itself, so it takes over rather than being wedged into a layout
   * built for two halves.
   */
  headline?: ReactNode;
  /** The scroll affordance. Fades out once scrolling has begun. */
  scrollToExpand?: string;
  /** Restart the film when it finishes. False when it resolves onto something. */
  loop?: boolean;
  /** Anything that should read as part of the opener, below the stage. */
  children?: ReactNode;
}

export function ScrollExpandMedia({
  sources,
  posterSrc,
  bgImageSrc,
  title,
  accent,
  headline,
  scrollToExpand,
  loop = false,
  children,
}: ScrollExpandMediaProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [coverScale, setCoverScale] = useState(1.6);
  const still = useStillness();

  /*
    How far the card has to grow to fill the screen.

    A fixed number cannot work: the card is 16:9 and the viewport is whatever
    the visitor's window happens to be, so the scale that just covers a 21:9
    monitor leaves bars on a 4:3 one. It is measured instead, and re-measured
    on resize.

    Portrait viewports deliberately cover by *width* only. Covering a tall
    phone screen with 16:9 footage means scaling it past four times, which
    crops away everything except the middle of the frame — the visitor sees a
    detail of a wall rather than a house. Full width, centred, with the
    backdrop showing above and below, keeps the shot intact.
  */
  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = Math.min(vw * 0.92, 1120);
    const cardH = (cardW * 9) / 16;
    const landscape = vw >= vh;
    setCoverScale(
      landscape ? Math.max(vw / cardW, vh / cardH) : Math.max(vw / cardW, 1),
    );
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /*
    `end end` rather than `end start`: the animation must finish when the
    bottom of the track reaches the bottom of the viewport, which is the exact
    moment the sticky stage stops being sticky. With `end start` the film would
    still be growing after the stage had begun scrolling away, and the last
    third of the motion would happen off screen.
  */
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  /*
    Raw page scroll, for anything that must never reverse.

    The element-relative progress above is right for the expansion — it has to
    track this section's position — but it is not monotonic in practice, and
    anything that fades *out* needs an input that only ever increases.
  */
  const { scrollY: pageScrollY } = useScroll();

  const scale = useTransform(scrollYProgress, [0, 0.85], [1, coverScale]);
  const radius = useTransform(scrollYProgress, [0, 0.85], [18, 0]);
  const shadow = useTransform(
    scrollYProgress,
    [0, 0.85],
    ["0 30px 90px rgba(0,0,0,0.55)", "0 0 0 rgba(0,0,0,0)"],
  );
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.16]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  /*
    The title halves part around the opening frame. They travel in `vw` so the
    gap tracks the viewport rather than a fixed pixel distance that would be a
    chasm on a phone and a nudge on a 4K display.
  */
  const leftX = useTransform(scrollYProgress, [0, 0.85], ["0vw", "-30vw"]);
  const rightX = useTransform(scrollYProgress, [0, 0.85], ["0vw", "30vw"]);
  /*
    The type clears out immediately, completely, and only once.

    Driven by raw page scroll rather than by progress through this section, and
    that is the whole point. Measured against the element, the opacity read
    1.000 at the top, 0.117 at 150px, then *0.402 and 0.611* further down: the
    headline faded out and then faded back in over the film. The element-
    relative progress oscillates as the sticky stage and the scaling card keep
    changing what there is to measure. Page scroll cannot do that — it only
    goes one way — so the fade is monotonic by construction.

    220px is about a third of a screen: the words own the opening and are gone
    before the footage has anything to say. Pointer events drop with them, so a
    headline nobody can see cannot still swallow a hover over the video.
  */
  const titleOpacity = useTransform(pageScrollY, [0, 220], [1, 0]);
  const titleGone = useTransform(pageScrollY, [0, 220], ["auto", "none"]);
  // Same reasoning as the headline: it fades out, so it needs page scroll.
  const cueOpacity = useTransform(pageScrollY, [0, 140], [1, 0]);

  /*
    Where the title parts. An `accent` that is not a suffix of the title is a
    caller mistake, and the safe reading of a mistake here is "no accent" — a
    title rendered whole is correct and plain, whereas guessing a split point
    would paint the brand colour onto an arbitrary word.
  */
  const accentIsSuffix = !!accent && accent.length < title.length && title.endsWith(accent);
  const titleHead = accentIsSuffix ? title.slice(0, title.length - accent.length).trimEnd() : title;
  const titleTail = accentIsSuffix ? accent : "";

  /** Advance to the next clip, or hold the last frame when the film is over. */
  const handleEnded = (index: number) => {
    if (index < sources.length - 1) {
      setActive(index + 1);
    } else if (loop) {
      setActive(0);
    }
    // Otherwise: do nothing. The final frame stays on screen, which is the
    // point of a film that resolves onto a mark.
  };

  /* Play whichever clip just became active, and pause the rest. */
  useEffect(() => {
    if (still) return;
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === active) {
        video.muted = muted;
        video.currentTime = 0;
        void video.play().catch(() => {
          /* Autoplay can still be refused; the first frame stays, which is fine. */
        });
      } else {
        video.pause();
      }
    });
    // `muted` is deliberately absent: re-running this on every mute toggle
    // would restart the clip from zero, which is not what pressing a sound
    // button should do. The toggle drives the element directly instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, still]);

  const toggleMuted = () => {
    /*
      Drive every element and mirror the result into state, rather than
      driving them from a React prop. `muted` is one of the DOM properties
      React does not reliably reflect through the attribute, and a video that
      keeps playing silently after a visitor pressed "Unmute" is worse than
      having no control at all. Every clip is set, not just the active one, so
      the sound does not switch itself back off at the cut.
    */
    const next = !muted;
    setMuted(next);
    videoRefs.current.forEach((video) => {
      if (video) video.muted = next;
    });
    const current = videoRefs.current[active];
    if (!next && current?.paused) void current.play().catch(() => {});
  };

  if (sources.length === 0) return null;

  const soundButton = (
    /*
      Deliberately not a bare speaker glyph. A muted video with no visible
      control is a video whose soundtrack the visitor never learns exists, and
      an icon on its own is ambiguous in the exact moment it matters — a
      crossed-out speaker reads either as "sound is off" or as "press to turn
      sound off", and the two readings suggest opposite actions. The icon
      carries the state, the word carries the action, `aria-pressed` carries
      both to anyone not looking at it.
    */
    <button
      type="button"
      onClick={toggleMuted}
      aria-pressed={!muted}
      aria-label={muted ? "Unmute video" : "Mute video"}
      className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/20"
      style={{ borderColor: "rgba(255,255,255,0.45)", background: "rgba(9,14,19,0.62)" }}
    >
      {muted ? <VolumeX size={15} aria-hidden /> : <Volume2 size={15} aria-hidden />}
      {muted ? "Unmute" : "Mute"}
    </button>
  );

  /*
    Stillness: no track, no stickiness, no scroll coupling. The clips are laid
    out plainly with native controls. Every hook above still ran — they are
    simply not consulted.
  */
  if (still) {
    return (
      <section className="relative" style={{ background: "var(--uc-navy-1)" }}>
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <h2 className="max-w-3xl text-4xl font-extrabold uppercase leading-[1.02] tracking-tight text-white">
            {titleHead}
            {titleTail ? <span style={{ color: "var(--uc-cyan-ink)" }}> {titleTail}</span> : null}
          </h2>
          <div
            className="mt-6 h-1 w-16 rounded-full"
            style={{ background: "var(--color-state-verified)" }}
          />
          <div className="mt-8 grid gap-4">
            {sources.map((src) => (
              <video
                key={src}
                className="aspect-video w-full rounded-xl bg-black object-cover"
                poster={posterSrc ?? undefined}
                controls
                muted
                playsInline
                preload="metadata"
                src={src}
              />
            ))}
          </div>
          {children ? <div className="mt-10">{children}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section ref={trackRef} className="relative h-[240vh]" style={{ background: "var(--uc-navy-0)" }}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/*
          The room the film opens out of. It scales *up* rather than down as
          the frame grows, so the two move against each other and the frame
          reads as coming towards the viewer instead of the whole scene
          zooming as one flat picture.
        */}
        {bgImageSrc ? (
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImageSrc})`, scale: bgScale, opacity: bgOpacity }}
          />
        ) : null}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "rgba(9,14,19,0.62)", opacity: bgOpacity }}
        />

        <motion.div
          className="relative aspect-video w-[92vw] max-w-[1120px] overflow-hidden bg-black"
          style={{ scale, borderRadius: radius, boxShadow: shadow }}
        >
          {sources.map((src, index) => (
            <video
              key={src}
              ref={(node) => {
                videoRefs.current[index] = node;
              }}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
              style={{ opacity: index === active ? 1 : 0 }}
              poster={index === 0 ? (posterSrc ?? undefined) : undefined}
              /*
                Only the first clip autoplays. The rest are started by the
                effect above when their turn comes — but they preload, so by
                the time the cut arrives they have buffered and the join does
                not flash black.
              */
              autoPlay={index === 0}
              muted
              playsInline
              preload="auto"
              onEnded={() => handleEnded(index)}
              src={src}
            />
          ))}
          {/*
            A floor of shade under the type only. A full-frame scrim would
            flatten the footage the whole section exists to show.
          */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{ background: "linear-gradient(to top, rgba(9,14,19,0.7), transparent)" }}
          />
        </motion.div>

        {/*
          A single revealed word takes the stage whole. It stays interactive —
          the per-letter photographs need pointer events — while the split
          title below remains inert, because two halves sliding apart are
          something to watch rather than touch.
        */}
        {headline ? (
          <motion.div
            /*
              `pt-28` keeps the headline clear of the sticky header. The stage
              centres its contents in the full viewport, which put a 168px word
              directly behind the logo at common laptop heights — the type was
              vertically centred and the header was not part of that maths.
            */
            className="absolute flex w-full items-center justify-center px-6 pt-28 sm:pt-24"
            style={{ opacity: titleOpacity, pointerEvents: titleGone }}
          >
            {headline}
          </motion.div>
        ) : (
        <motion.div
          className="pointer-events-none absolute flex w-full items-center justify-center px-6 text-center"
          style={{ opacity: titleOpacity }}
        >
          <motion.span
            className="font-extrabold uppercase leading-[0.95] tracking-tight text-white"
            style={{ x: leftX, fontSize: "clamp(28px,5.6vw,74px)", textShadow: "0 4px 30px rgba(0,0,0,0.55)" }}
          >
            {titleHead}
          </motion.span>
          {titleTail ? (
            <motion.span
              className="ml-[0.28em] font-extrabold uppercase leading-[0.95] tracking-tight"
              style={{
                x: rightX,
                fontSize: "clamp(28px,5.6vw,74px)",
                color: "var(--uc-cyan-ink)",
                textShadow: "0 4px 30px rgba(0,0,0,0.55)",
              }}
            >
              {titleTail}
            </motion.span>
          ) : null}
        </motion.div>
        )}

        {scrollToExpand ? (
          <motion.div
            className="pointer-events-none absolute bottom-[7vh] text-xs font-semibold uppercase tracking-[0.22em] text-white/75"
            style={{ opacity: cueOpacity }}
          >
            {scrollToExpand}
          </motion.div>
        ) : null}

        <div className="absolute bottom-6 right-6">{soundButton}</div>
      </div>

      {children ? <div className="relative">{children}</div> : null}
    </section>
  );
}
