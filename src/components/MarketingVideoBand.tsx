"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { useStillness } from "@/lib/use-stillness";
import type { ResolvedMarketingVideo } from "@/lib/marketing-video";

/**
 * An inline marketing clip, for the slots below the opener.
 *
 * Deliberately *not* the scroll-expansion hero. That component charges the
 * visitor a screen and a half of scrolling to open one frame, which is a fair
 * price exactly once — for the thesis at the top. Paying it three times would
 * turn the home page into a slideshow you have to scroll through rather than a
 * page you can read, and the sections these clips sit beside are the ones a
 * reviewer is actually trying to reach.
 *
 * So this is the quiet version: a framed 16:9 clip that plays when it is on
 * screen and stops when it is not. Nothing moves as you scroll.
 *
 * Playback is gated on visibility rather than started on mount for two
 * reasons. Several videos decoding at once is a measurable frame-rate cost for
 * footage nobody is looking at — and with `preload="none"`, a clip below the
 * fold costs zero bytes until the visitor actually arrives at it. That second
 * point matters more than it looks: it is what makes it safe to place a large
 * file low on the page.
 */
export function MarketingVideoBand({ media }: { media: ResolvedMarketingVideo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const still = useStillness();
  const { slot } = media;

  const attachObserver = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node || still) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          void node.play().catch(() => {
            /* Autoplay can still be refused; the first frame stays, which is fine. */
          });
        } else if (slot.loop) {
          /*
            Only pause looping footage on the way out. A clip that does not
            loop is one that ends on something — a logo, a call to action — and
            pausing it half-finished because the visitor scrolled a little too
            far means they never see the frame the whole clip was built to
            reach. Let those play out; they are ten seconds at most.
          */
          node.pause();
        }
      },
      /*
        0.35 rather than any-pixel-visible: a clip that starts the instant its
        top edge appears has usually spent its first second before the visitor
        can see enough of it to know what it is.
      */
      { threshold: 0.35 },
    );
    observer.observe(node);
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    /*
      Drive the element and mirror it into state, rather than driving it from a
      React prop. `muted` is one of the DOM properties React does not reliably
      reflect through the attribute, and a video that keeps playing silently
      after a visitor pressed "Unmute" is worse than having no control at all.
    */
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    if (!next && video.paused) void video.play().catch(() => {});
  };

  /*
    One clip per band. A slot holding several is a *film*, which is what the
    opener is for — sequencing two clips inside a quiet inline frame would be
    a second, weaker version of that component. Taking the first is the honest
    reduction, and the manifest test makes the extra clips visible rather than
    silently dropped.
  */
  const src = media.sources[0] ?? null;

  if (!src && !media.poster) return null;

  return (
    <figure>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {src ? (
          <video
            ref={attachObserver}
            className="h-full w-full object-cover"
            poster={media.poster ?? undefined}
            muted
            loop={slot.loop}
            playsInline
            preload="none"
            controls={still}
          >
            <source src={src} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- art-directed still standing in for footage not yet cut
          <img src={media.poster!} alt="" className="h-full w-full object-cover" />
        )}

        {src && !still ? (
          <button
            type="button"
            onClick={toggleMuted}
            aria-pressed={!muted}
            aria-label={muted ? "Unmute video" : "Mute video"}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            style={{ borderColor: "rgba(255,255,255,0.45)", background: "rgba(9,14,19,0.62)" }}
          >
            {muted ? <VolumeX size={13} aria-hidden /> : <Volume2 size={13} aria-hidden />}
            {muted ? "Unmute" : "Mute"}
          </button>
        ) : null}
      </div>
      {slot.caption ? (
        <figcaption className="mt-3 text-sm" style={{ color: "var(--color-text-lo)" }}>
          {slot.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
