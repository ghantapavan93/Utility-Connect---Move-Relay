"use client";

import { useRef, useState, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { useStillness } from "@/lib/use-stillness";
import type { ResolvedMarketingVideo } from "@/lib/marketing-video";

/**
 * A full-bleed film playing behind readable content.
 *
 * `MarketingVideoBand` frames a clip and asks you to watch it. This is the
 * opposite arrangement: the footage is the room, the words are the point, and
 * the visitor never has to decide whether to sit through anything. The two
 * exist separately because the compromise — one component with a `variant`
 * prop — would put a caption, a figure element and an aspect-ratio box into a
 * thing that has none of those.
 *
 * ## Legibility is enforced, not hoped for
 *
 * Text over video is the most reliable way to ship unreadable type. A frame
 * that is dark for nine seconds and white for one leaves the copy invisible
 * exactly once, and nobody screenshots that second. So the scrim is not a
 * tasteful wash: it is two stacked layers sized to guarantee contrast against
 * the *brightest* frame the clip can produce, and the content sits above both.
 *
 * ## Cost
 *
 * `preload="none"` with playback gated on intersection means a section below
 * the fold costs zero bytes until the visitor reaches it. That is what makes a
 * long clip defensible here — these films run about a minute, far past what a
 * committed marketing clip is allowed, and they are only affordable because
 * nobody downloads one they never scroll to.
 *
 * ## Sound
 *
 * Muted at first frame, always, with a real control. Autoplaying audio is
 * taking something from the visitor that they did not offer, and every browser
 * blocks it anyway — so the honest version is a button that says what it will
 * do and does it.
 */
export function AmbientVideoStage({
  media,
  children,
  /** Extra darkness for sections whose copy is small or long. 0–1. */
  scrim = 0.62,
  /** Cyan cast over the footage, tying it to the state palette. */
  tint = 0.18,
  className = "",
  minHeight = "min-h-[620px]",
}: {
  media: ResolvedMarketingVideo;
  children: ReactNode;
  scrim?: number;
  tint?: number;
  className?: string;
  minHeight?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const still = useStillness();

  const src = media.sources[0] ?? null;

  const attachObserver = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          /*
            Even under stillness the film plays — it is ambient texture behind
            text, not an animation that conveys meaning, and the reduced-motion
            contract in this project is that pacing collapses while content
            stays. A visitor who wants it gone has the browser's own controls;
            what they must never get is an empty stage where a section was.
          */
          void node.play().catch(() => {
            /* Autoplay refusal leaves the poster frame, which is a valid state. */
          });
        } else {
          node.pause();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    /*
      Drive the DOM property and mirror it into state. React does not reliably
      reflect `muted` through the attribute, and a video still making noise
      after someone pressed Mute is worse than shipping no control.
    */
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    if (!next && video.paused) void video.play().catch(() => {});
  };

  /*
    A `div`, not a `section`. This is a stage a section is composed *on* — one
    usage sits inside an existing landmark and one stands alone — and a
    component that silently emits a second sectioning element would put a
    heading-less entry in the document outline everywhere it is nested.
  */
  return (
    <div className={`relative isolate overflow-hidden ${minHeight} ${className}`}>
      {src && (
        <video
          ref={attachObserver}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}

      {/*
        Two layers, not one. The flat wash holds a contrast floor against a
        blown-out frame; the vertical gradient keeps the top and bottom edges
        dark so the section meets its neighbours instead of ending in a hard
        seam. The cyan is the brand's single saturated colour, used here as a
        cast over footage rather than as a meaning — the state palette is
        carried by the constellation, never by the room.
      */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(
              to bottom,
              rgba(9,14,19,0.94) 0%,
              rgba(9,14,19,${scrim}) 32%,
              rgba(9,14,19,${scrim}) 68%,
              rgba(9,14,19,0.94) 100%
            ),
            radial-gradient(120% 90% at 50% 45%, rgba(0,135,181,${tint}) 0%, rgba(9,14,19,0) 70%)`,
        }}
      />

      {children}

      {src && (
        <button
          type="button"
          onClick={toggleMuted}
          aria-pressed={!muted}
          aria-label={muted ? "Unmute the background film" : "Mute the background film"}
          className="absolute bottom-5 right-5 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/15"
          style={{ borderColor: "rgba(255,255,255,0.4)", background: "rgba(9,14,19,0.66)" }}
        >
          {muted ? <VolumeX size={13} aria-hidden /> : <Volume2 size={13} aria-hidden />}
          {muted ? "Unmute" : "Mute"}
        </button>
      )}
    </div>
  );
}
