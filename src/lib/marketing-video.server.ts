import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  MARKETING_VIDEO_SLOTS,
  marketingVideoUrl,
  type MarketingVideoKey,
  type ResolvedMarketingVideo,
} from "./marketing-video";

/**
 * Which of this slot's clips are actually on disk?
 *
 * Presence is read from the filesystem rather than declared in a boolean so
 * that a slot pointing at a file nobody delivered renders as nothing at all,
 * rather than as a black player the visitor has to work out. A hand-maintained
 * `hasVideo: true` has exactly one failure mode and it is the bad one: the
 * flag says yes, the file is missing, and the broken frame ships.
 *
 * Missing clips are dropped from the list rather than failing the whole slot,
 * so a two-part film whose second half has not been delivered still plays its
 * first half instead of vanishing.
 *
 * This runs on the server during render — the home page is already an async
 * server component, so it costs a handful of `existsSync` calls and is baked
 * into the payload for a static build.
 *
 * The `.server.ts` suffix is the only guard against importing this from a
 * client component. The `server-only` package would make that mistake a build
 * error, but it is not a dependency here and adding one requires an ADR, which
 * is a poor trade for a convention that already exists. The client-safe half
 * is `marketing-video.ts`.
 */
export function resolveMarketingVideo(key: MarketingVideoKey): ResolvedMarketingVideo {
  const slot = MARKETING_VIDEO_SLOTS[key];
  const onDisk = (file: string) => existsSync(join(process.cwd(), "public", "videos", file));

  return {
    slot,
    sources: slot.files.filter(onDisk).map(marketingVideoUrl),
    poster: slot.poster && onDisk(slot.poster) ? marketingVideoUrl(slot.poster) : null,
  };
}

/**
 * Has this slot got anything to show?
 *
 * A poster with no footage is a valid, useful state — the layout is real and
 * reviewable while a cut is still being made — so either one is enough.
 */
export function hasMarketingMedia(resolved: ResolvedMarketingVideo): boolean {
  return resolved.sources.length > 0 || resolved.poster !== null;
}
