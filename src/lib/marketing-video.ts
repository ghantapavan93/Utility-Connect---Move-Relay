/**
 * Where the marketing footage plays, and why the files keep their own names.
 *
 * The first version of this module required the filename to *be* the slot key
 * — drop `handoff.mp4` and the page finds it. That is a lovely convention for
 * assets a developer exports, and the wrong one for footage that arrives from
 * a generator with names like `Generated Video July 26, 2026 - 2_50AM.mp4`.
 * Renaming a delivered file breaks the only link back to where it came from,
 * and it has to be redone every time a new cut lands.
 *
 * So the mapping is explicit: a slot names its files. The test suite checks
 * both directions — a slot pointing at a missing file fails, and a file in the
 * folder that no slot plays fails. Neither can rot silently.
 *
 * A slot holds a *list*, because the opener is a two-part film rather than a
 * clip. Sequencing them here rather than in the component keeps the editorial
 * decision — what plays, in what order — next to the reasoning for it.
 *
 * This module is free of `node:fs` so it can be imported by client components.
 */

export const MARKETING_VIDEO_KEYS = ["opener", "invitation"] as const;

export type MarketingVideoKey = (typeof MARKETING_VIDEO_KEYS)[number];

export interface MarketingVideoSlot {
  key: MarketingVideoKey;
  /**
   * Exact filenames inside `public/videos/`, played in order as one film.
   * Spaces and commas are fine — see `marketingVideoUrl`.
   */
  files: string[];
  /** Optional poster frame, same folder. Without one the frame is black until the first frame decodes. */
  poster?: string;
  /** A still behind the frame, from `public/`. Visible before the film opens. */
  backdrop?: string;
  /** One line shown under the frame, or null when the footage speaks for itself. */
  caption: string | null;
  /**
   * Does the film restart when it finishes?
   *
   * Ambient footage with no ending would loop happily. Footage that *resolves*
   * onto something — a logo, a call to action — must not: the final frame is
   * the message, and looping throws it away two seconds after it lands.
   */
  loop: boolean;
  /** What the film has to land. The acceptance test for a re-cut, not a description. */
  intent: string;
}

export const MARKETING_VIDEO_SLOTS: Record<MarketingVideoKey, MarketingVideoSlot> = {
  /**
   * The opener: two clips played as one twenty-second film, above the hero,
   * with the scroll-expansion treatment.
   *
   * Order is the whole argument. The photoreal architectural clip goes first
   * because it carries no typography at all — a camera moving into a house
   * past the wifi, the water and the sensors — which is the only kind of
   * footage that can survive a large headline laid over it. It establishes the
   * subject. The world-class cinematic follows and resolves onto the mark,
   * which is how a film ends rather than how one begins.
   *
   * Reversed, the logo would land while the visitor is still working out what
   * they are looking at, and the quiet architectural footage would be left
   * trailing after the sign-off.
   *
   * The film does not loop, because the mark is the last thing it says.
   */
  opener: {
    key: "opener",
    files: ["Photoreal_architectural_cinema.mp4", "Create_a_world_class_cinemati.mp4"],
    /*
      A still behind the frame, so the first screen is a room rather than a
      black surround with a small rectangle floating in it. It is what the
      expansion opens *out of*, and without it the effect reads as a video
      element that has not loaded yet.
    */
    backdrop: "/photos/modern-house-exterior.jpg",
    caption: null,
    loop: false,
    intent:
      "A house being moved into with its services already live, resolving onto the mark — the product's subject and its signature in one pass.",
  },

  /**
   * The invitation, in the closing section.
   *
   * This clip ends on "set up your services" and "partner with us" — it is a
   * call to action in video form. Placed anywhere else on the page it would
   * end by asking for something the visitor cannot act on from where they are
   * standing, which is the most expensive kind of dead end: a call to action
   * rendered as a picture of a call to action. Sitting immediately above the
   * real buttons, its final frame hands over to controls that work.
   *
   * It does not loop, for the same reason: the ask is the last frame.
   */
  invitation: {
    key: "invitation",
    files: ["Generated Video July 26, 2026 - 2_50AM.mp4"],
    caption: null,
    loop: false,
    intent: "The whole story in eight seconds, ending on the two things a visitor can do next.",
  },
};

/**
 * The public URL for a file in `public/videos/`.
 *
 * `encodeURIComponent` is not decoration here. Two of the delivered filenames
 * contain spaces and one contains a comma; dropped raw into a `src` attribute
 * the browser requests a path that does not exist and the player silently
 * shows nothing — no error, no console warning, no clue.
 */
export function marketingVideoUrl(file: string): string {
  return `/videos/${encodeURIComponent(file)}`;
}

/** Is this string one of the known slots? */
export function isMarketingVideoKey(key: string): key is MarketingVideoKey {
  return (MARKETING_VIDEO_KEYS as readonly string[]).includes(key);
}

/** Every filename inside `public/videos/` that some slot expects to find. */
export function declaredMarketingFiles(): string[] {
  return Object.values(MARKETING_VIDEO_SLOTS).flatMap((slot) =>
    slot.poster ? [...slot.files, slot.poster] : slot.files,
  );
}

/**
 * A slot once the filesystem has been consulted.
 *
 * `sources` holds only the clips that are really on disk, in order. An empty
 * array means the section renders nothing at all — not a black frame, not a
 * broken player. A partially delivered film still plays the parts that arrived.
 */
export interface ResolvedMarketingVideo {
  slot: MarketingVideoSlot;
  sources: string[];
  poster: string | null;
}
