# Public Marketing-Site Technology — Observation

Recorded 2026-07-24 from a public technology fingerprint of `utilityconnect.net`.

**Read this constraint first, because it governs how any of the following may be
used.** These are facts about the **public marketing website's front-end
delivery**. They are *not* evidence about Utility Connect's internal platform,
CRM, integrations, concierge tooling, or engineering team, and must never be
presented as such. The founder has years of proprietary platform experience; a
dated marketing site says nothing about that. The only sanctioned use of this
section is the *additive* framing in the last block: modernizing the front door.

## Observed stack `[FACT — public fingerprint]`

| Layer | Detected | Age / status |
|---|---|---|
| Language | PHP **5.6.40** | Security EOL **31 Dec 2018** |
| Web server | Apache **2.2.22** | Released 2012; 2.2.x branch retired **2017** |
| OS | Debian | — |
| CSS framework | Bootstrap **3.3.1** | ~2014; superseded by 4 (2018) and 5 (2021) |
| JS core | jQuery **1.11.3** | 2015 |
| Carousels / galleries | OWL Carousel, prettyPhoto, Slider Revolution | jQuery-era plugins |
| Layout | Masonry, Isotope | jQuery-era |
| Polyfills | core-js 3.32.2 | present |
| Analytics / tags | GA4, Facebook Pixel, Microsoft Clarity, Google Tag Manager | current |
| Marketing / chat | HubSpot, HubSpot Chat | current |
| Icons | Font Awesome | — |
| Commerce (uncertain) | Shopify (~50% confidence) | — |

## What is fair to conclude — and what is not

**Fair `[INFER]`**
- The public site is a classic WordPress-era LAMP marketing build: PHP + Apache +
  jQuery + Bootstrap 3, assembled from jQuery carousel/gallery plugins.
- Its **front-end delivery** technology predates the modern component era. PHP 5.6
  and Apache 2.2.22 are both past end of life for security support.
- Their **marketing and analytics** layer, by contrast, is current (GA4, Clarity,
  HubSpot) — this is a business that invests in measurement.

**Not fair — do not say, imply, or design toward `[CONSTRAINT]`**
- That their internal platform is old. The marketing site and the operating
  platform are different systems; the fingerprint sees only the former.
- That their team lacks modern skills.
- That an EOL PHP version is a security finding about customer data. The intake
  forms post elsewhere; this fingerprint does not establish where PII is handled.

## The only sanctioned use: the additive front-door argument

This is the honest, non-insulting way the observation earns its place in the
proof of work:

> Utility Connect's public marketing site is a capable, well-measured WordPress-era
> build. It is also the one part of the company a prospective partner or customer
> touches first, and it is delivered on a front-end stack from the early 2010s.
> This redesign shows what that same front door looks like rebuilt on a current
> component stack — **React 19, Next.js 16, TypeScript, WebGL, accessible motion**
> — without touching, replacing, or judging anything behind it.

Framed that way it demonstrates exactly what the role asks for: the candidate can
modernize a real presentation layer, respects the systems already in place, and
draws the line between "the public front door" and "the platform" without
overclaiming.

### Concrete before / after (front-end only)

| | Their public site | This redesign |
|---|---|---|
| Rendering | PHP 5.6 server-rendered templates | Next.js 16 (React 19), static + server |
| CSS | Bootstrap 3.3.1 | Tailwind 4, tokens measured from their brand |
| Interactivity | jQuery 1.11.3 + plugins | React components, typed with TypeScript |
| Motion | OWL Carousel / prettyPhoto | Framer Motion, sub-300ms, reduced-motion aware |
| Signature visual | Slider Revolution banners | WebGL handoff constellation on real state |
| Delivery | Apache 2.2.22 | Edge-deployable, standalone build |

Every row is a front-end statement. None is a claim about the platform.
