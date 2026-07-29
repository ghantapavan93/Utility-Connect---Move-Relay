import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  MARKETING_VIDEO_KEYS,
  MARKETING_VIDEO_SLOTS,
  marketingVideoUrl,
  isMarketingVideoKey,
  declaredMarketingFiles,
} from "../marketing-video";
import { resolveMarketingVideo, hasMarketingMedia } from "../marketing-video.server";
import { readMp4Meta } from "../mp4-meta";

/**
 * The marketing footage, and the four ways it can be wrong without anyone
 * noticing.
 *
 * **A slot pointing at nothing.** The manifest names a file; a typo, a re-cut
 * saved under a new name, or a delete leaves the slot resolving to null and
 * the section quietly vanishing. That is the correct *runtime* behaviour and a
 * terrible thing to discover on a live site, so it fails here instead.
 *
 * **A file nobody plays.** The inverse: footage sits in `public/videos/`,
 * committed and taking up repository weight forever, wired to no slot. It
 * looks like the feature is done and it is not.
 *
 * **A clip that cannot start streaming.** An MP4 whose `moov` index sits after
 * the media data cannot begin playback until the whole file has downloaded.
 * Nothing on the page says so — the visitor just sees black. This is invisible
 * to typecheck, to the build, and to every other test in this repository, so
 * the container gets read directly.
 *
 * **A clip that is too long or too heavy.** Both are judgement calls that
 * drift, and both are cheap to measure.
 *
 * The suite does not require any particular video to exist — an empty folder
 * is a valid state, and the page renders correctly in it.
 */

const root = process.cwd();
const videosDir = join(root, "public", "videos");

/** Files in the drop zone that are media, not documentation. */
function mediaFiles(): string[] {
  return readdirSync(videosDir)
    .filter((name) => statSync(join(videosDir, name)).isFile())
    .filter((name) => name !== "README.md");
}

describe("the marketing video manifest", () => {
  it("has a documented drop zone", () => {
    // The folder is the interface. An undocumented one is a folder whose
    // conventions somebody guesses, and guesses wrong once.
    expect(existsSync(join(videosDir, "README.md"))).toBe(true);
  });

  it("declares a complete slot for every key", () => {
    expect(Object.keys(MARKETING_VIDEO_SLOTS).sort()).toEqual([...MARKETING_VIDEO_KEYS].sort());
    for (const key of MARKETING_VIDEO_KEYS) {
      const slot = MARKETING_VIDEO_SLOTS[key];
      expect(slot.key).toBe(key);
      expect(slot.files.length, `${key} must name at least one clip`).toBeGreaterThan(0);
      // The intent is the acceptance test for a re-cut, not a label.
      expect(slot.intent.length, `${key} needs an intent worth checking footage against`).toBeGreaterThan(40);
    }
  });

  it("rejects a key it does not know rather than inventing a slot", () => {
    expect(isMarketingVideoKey("opener")).toBe(true);
    expect(isMarketingVideoKey("handoff")).toBe(false);
    expect(isMarketingVideoKey("")).toBe(false);
  });

  it("percent-encodes filenames so spaces and commas survive the URL", () => {
    /*
      The delivered filenames include `Generated Video July 26, 2026 - 2_50AM.mp4`.
      Dropped raw into a `src` attribute, the browser requests a path that does
      not exist and the player shows nothing at all — no error, no console
      warning, no clue. This is the check that the encoding never gets removed
      as "unnecessary".
    */
    const url = marketingVideoUrl("Generated Video July 26, 2026 - 2_50AM.mp4");
    expect(url).not.toContain(" ");
    expect(url).toBe("/videos/Generated%20Video%20July%2026%2C%202026%20-%202_50AM.mp4");
    expect(decodeURIComponent(url.replace("/videos/", ""))).toBe(
      "Generated Video July 26, 2026 - 2_50AM.mp4",
    );
  });

  it("points every slot at a file that is really on disk", () => {
    const missing = declaredMarketingFiles().filter(
      (file) => !existsSync(join(videosDir, file)),
    );
    expect(
      missing,
      "these are named in src/lib/marketing-video.ts but absent from public/videos/",
    ).toEqual([]);
  });

  it("plays every file that is on disk", () => {
    const declared = new Set(declaredMarketingFiles());
    const orphans = mediaFiles().filter((name) => !declared.has(name));
    expect(
      orphans,
      "these sit in public/videos/ but no slot plays them — wire them up or delete them",
    ).toEqual([]);
  });

  it("resolves a slot to real URLs, in the order the film plays", () => {
    for (const key of MARKETING_VIDEO_KEYS) {
      const resolved = resolveMarketingVideo(key);

      // Order is editorial, not incidental — the opener establishes its
      // subject before it signs off, and a resolver that reordered the list
      // would invert the film without anything failing.
      const expected = resolved.slot.files
        .filter((file) => existsSync(join(videosDir, file)))
        .map(marketingVideoUrl);
      expect(resolved.sources).toEqual(expected);

      expect(hasMarketingMedia(resolved)).toBe(
        resolved.sources.length > 0 || resolved.poster !== null,
      );
    }
  });

  it("plays the opener as a two-part film, architecture before sign-off", () => {
    /*
      The one ordering that matters enough to pin. The photoreal clip carries
      no typography, which is the only reason a full-screen headline can sit
      over it; the cinematic resolves onto the mark, which is how a film ends
      rather than how one begins. Swap them and the logo lands while the
      visitor is still working out what they are looking at.
    */
    const opener = resolveMarketingVideo("opener");
    expect(opener.sources.length).toBe(2);
    expect(opener.sources[0]).toContain("Photoreal");
    expect(opener.sources[1]).toContain("world_class");
    expect(opener.slot.loop, "the opener ends on the mark and must not loop").toBe(false);
  });
});

describe("every slot is wired into the home page", () => {
  const homePage = () =>
    readFileSync(join(root, "src/app/page.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("resolves each key rather than leaving it declared and unused", () => {
    const src = homePage();
    for (const key of MARKETING_VIDEO_KEYS) {
      expect(
        src.includes(`resolveMarketingVideo("${key}")`),
        `src/app/page.tsx never resolves the "${key}" slot`,
      ).toBe(true);
    }
  });

  it("guards every slot so an absent file leaves no trace on the page", () => {
    /*
      The load-bearing guarantee. An ungated slot whose file is missing is a
      black 16:9 box on the live site, and the only person who would find it is
      the one whose opinion matters.
    */
    const src = homePage();
    const guards = [...src.matchAll(/hasMarketingMedia\((\w+)\)/g)].map((m) => m[1]!);
    expect(guards.length, "each slot needs its own hasMarketingMedia guard").toBe(
      MARKETING_VIDEO_KEYS.length,
    );
    for (const variable of guards) {
      expect(
        new RegExp(`const ${variable}\\s*=\\s*resolveMarketingVideo\\(`).test(src),
        `${variable} is guarded but never resolved`,
      ).toBe(true);
    }
  });
});

describe("committed footage is fit to serve", () => {
  /*
    This repository has already shipped 25 MB of PNG once and had to purge
    143 MB of media out of its own history. Git keeps every version of a binary
    forever, so the ceilings are checked here rather than trusted to whoever
    does the encode.

    Every clip in the opener gets the tighter limit, because all of them load
    near the top of the page — the second half of the film preloads while the
    first half plays, so it is on the wire early even though it is seen late.
    Everything else is `preload="none"` and costs nothing until the visitor
    scrolls to it, which is what makes a heavier file defensible below the fold.
  */
  const OPENER_CEILING = 3 * 1024 * 1024;
  const BELOW_FOLD_CEILING = 8 * 1024 * 1024;
  const MAX_SECONDS = 14;

  const openerFiles = new Set(MARKETING_VIDEO_SLOTS.opener.files);

  it("keeps every committed clip under its ceiling", () => {
    const oversized = mediaFiles()
      .map((name) => ({ name, bytes: statSync(join(videosDir, name)).size }))
      .filter(({ name, bytes }) =>
        bytes > (openerFiles.has(name) ? OPENER_CEILING : BELOW_FOLD_CEILING),
      )
      .map(({ name, bytes }) => `${name} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);

    expect(oversized, "re-encode these — see the ffmpeg recipe in public/videos/README.md").toEqual(
      [],
    );
  });

  it("keeps every clip short enough to be watched rather than sat through", () => {
    const tooLong = mediaFiles()
      .filter((name) => name.toLowerCase().endsWith(".mp4"))
      .map((name) => ({ name, meta: readMp4Meta(readFileSync(join(videosDir, name))) }))
      .filter(({ meta }) => meta.seconds !== null && meta.seconds > MAX_SECONDS)
      .map(({ name, meta }) => `${name} (${meta.seconds!.toFixed(1)}s)`);

    expect(tooLong, `clips must run under ${MAX_SECONDS}s`).toEqual([]);
  });

  it("can begin playing before it has finished downloading", () => {
    /*
      The failure this catches has no other symptom. Without `+faststart` the
      `moov` index sits after the media data, so the player cannot draw a
      single frame until the last byte arrives. On a slow connection that is
      the difference between a hero that plays and a hero that is a black
      rectangle for six seconds, and nothing anywhere reports it.
    */
      const blocked = mediaFiles()
      .filter((name) => name.toLowerCase().endsWith(".mp4"))
      .map((name) => ({ name, meta: readMp4Meta(readFileSync(join(videosDir, name))) }))
      .filter(({ meta }) => !meta.faststart)
      .map(({ name }) => name);

    expect(
      blocked,
      "re-encode with `-movflags +faststart` — see public/videos/README.md",
    ).toEqual([]);
  });
});
