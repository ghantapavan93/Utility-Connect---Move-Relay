# `public/videos/` — the marketing footage

Files here keep whatever name they arrived with. A slot names its file in
[`src/lib/marketing-video.ts`](../../src/lib/marketing-video.ts), so nothing has
to be renamed and the link back to where a clip came from survives.

Adding or swapping a clip is two steps:

1. Drop the file in this folder.
2. Point a slot at it — change one `file:` line in `marketing-video.ts`.

A slot whose file is missing renders **nothing at all** — no black box, no
broken player. The tests fail in both directions: a slot pointing at a missing
file, and a file no slot plays.

---

## The three slots

| Slot | Where it plays | File | Loops |
| --- | --- | --- | --- |
| `opener` | Above the hero, scroll-expansion treatment | `Photoreal_architectural_cinema.mp4` | yes |
| `brand` | Inside the About section | `Create_a_world_class_cinemati.mp4` | no |
| `invitation` | Inside the closing call to action | `Generated Video July 26, 2026 - 2_50AM.mp4` | no |

### Why each one sits where it does

**`opener` — the photoreal architectural clip.** It is the only one of the
three that *can* hold this position, and not by preference. The expansion lays
a large split headline over the footage for the first screen and a half; a clip
carrying its own typography or a logo would collide with that headline and
neither would be readable. This one has no type in it at all — a camera moving
into a house past the wifi, the water and the sensors. That is the product's
subject with nothing competing for it. It loops because it has no ending to
protect.

**`brand` — the world-class cinematic.** It resolves onto the mark, which makes
it a sign-off rather than an argument, and a sign-off belongs beside the
paragraph explaining what this project is and who built it. It does not loop:
the logo is the last thing it says and it should stay on screen.

**`invitation` — the generated film.** It ends on *set up your services* and
*partner with us*. Anywhere else on the page it would close by asking for
something the visitor cannot act on from where they are standing — a call to
action rendered as a picture of a call to action. Sitting directly above the
real buttons, its final frame hands over to controls that are inches away and
actually work. It does not loop, for the same reason.

Only `opener` gets the scroll-expansion treatment. It charges the visitor a
screen and a half of scrolling, which is a fair price exactly once. Three
expanding heroes would make the home page a slideshow you scroll through rather
than a page you can read.

---

## Sound

Every clip loads **muted**, always. That is what makes autoplay permitted in
current browsers, and it is the decent default — nobody opening this page in an
open-plan office should have to hunt for the sound.

Every video carries an **Unmute** control: a real keyboard-reachable button
with an icon for the state and a word for the action, plus `aria-pressed`. A
bare speaker glyph is ambiguous in the one moment it matters — a crossed-out
speaker reads either as *sound is off* or as *press to turn sound off*, and the
two readings suggest opposite actions.

Audio never starts on its own, under any circumstance.

## Reduced motion

If a visitor has asked for stillness — the OS `prefers-reduced-motion` setting
or this site's own accessibility toggle — the opener drops its scroll coupling
entirely and presents one still screen with native controls and **no autoplay**,
and the inline clips do not start on scroll. A visitor who asked for stillness
getting a video that plays itself is exactly the failure that toggle exists to
prevent.

## Loading

Only the opener preloads, and only its metadata. Everything below the fold is
`preload="none"` and costs zero bytes until the visitor scrolls to it, which is
what makes a heavier file defensible low on the page.

---

## Specs, enforced by tests

| | |
| --- | --- |
| Aspect | 16:9 |
| Resolution | 1920×1080 max |
| Codec | H.264 High profile |
| Duration | **under 14s** — checked |
| Size, opener | **under 3 MB** — checked |
| Size, below the fold | **under 8 MB** — checked |
| Fast-start | **required** — checked |
| Poster | optional; JPEG under 350 KB. Without one the frame is black until the first frame decodes |

### Fast-start, and why it is checked

An MP4 keeps its index in the `moov` box. Most encoders write it *after* the
media data, which means a browser cannot draw a single frame until the entire
file has downloaded — a 7 MB clip that would start in half a second instead
shows black for six on a slow connection. There is no error, no console
warning, and nothing on the page to suggest why.

`Generated Video July 26, 2026 - 2_50AM.mp4` arrived in that state and was
remuxed in place. If a future clip fails the check and ffmpeg is not installed:

```bash
node scripts/faststart.mjs "public/videos/your-clip.mp4"
```

It moves the index to the front, relocates every chunk offset, verifies the
media payload is byte-identical, and keeps a `.bak` beside the original. Add
`--dry-run` to see the checks without writing.

With ffmpeg available, encoding correctly in the first place:

```bash
ffmpeg -i source.mov -c:v libx264 -profile:v high -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart public/videos/your-clip.mp4
```

Poster frame, from one second in:

```bash
ffmpeg -i public/videos/your-clip.mp4 -ss 00:00:01 -frames:v 1 -q:v 3 public/videos/your-clip.jpg
```

---

## What does not belong here

The design rule for this project is *if it is decorative, it is wrong*. Stock
footage of cities at dusk, abstract particles, and timelapses of people typing
all fail it — they cost the visitor time and say nothing they could not have
guessed. Every clip should be the product doing the thing the section beside it
claims.

All footage must be original or licensed, and licensed material credited in
[`CREDITS.md`](../../CREDITS.md). Never use Utility Connect's screen recordings
or customer footage.

### Utility Connect's own brand films

Two of them play on the home page — `uc-brand-film.mp4` behind the "same front
door" section and `uc-product-film.mp4` behind "one move arrives through several
channels". That is a deliberate reversal of the rule this section used to state
absolutely, made by the repository owner so the sections survive a Vercel
deploy, and both files are committed.

They are **re-encoded, never the raw download**. The sources were 8.5 MB / 55s
at 720p and 19.8 MB / 60s at 1080p. Both sit under a scrim of 0.58–0.66 plus a
cyan cast, so most of their detail is thrown away before a visitor sees it, and
they encode to 2.6 MB and 3.4 MB with nothing visibly lost:

```
ffmpeg -i INPUT.mp4 \
  -vf "scale='min(960,iw)':-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 31 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 64k -ac 1 \
  -movflags +faststart public/videos/OUTPUT.mp4
```

`ffmpeg-static` is a dev dependency, so `node -e "console.log(require('ffmpeg-static'))"`
gives you a binary without installing anything system-wide.

The raw downloads stay ignored — `YTDown.com_*`, `*_720p.mp4`, `*_1080p.mp4` —
and a test asserts `git check-ignore` still covers that pattern. Dropping a
twenty-megabyte source file in here and wiring a slot at it is the obvious
shortcut when a re-cut is needed in a hurry, and git keeps every version of a
binary forever.

Git keeps every version of a binary forever, and this repository has already
had to purge 143 MB of media out of its own history. Replace a clip rather than
accumulating variants.
