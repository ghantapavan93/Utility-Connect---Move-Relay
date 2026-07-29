# `public/brands/` — provider marks, and where each one came from

These are the logos in the provider row of `TrustStrip`. Every file here is
public domain or CC0. Nothing was traced, redrawn, or taken from a company's
press page or website.

**The artwork licence is not the trademark.** A `PD-textlogo` file is free to
copy because a wordmark below the threshold of originality is not copyrightable
in the US. The trademark still belongs to its owner, and the row is captioned
accordingly: illustrative of the provider categories a platform like this
integrates with, on a build that states on every screen that it is unaffiliated
and synthetic. No partnership or endorsement is implied by any mark here.

## The files

| File | Provider | Source | Licence |
|---|---|---|---|
| `adt.svg` | ADT | Wikimedia Commons — *ADT Security Services Logo.svg* | Public domain |
| `atandt.svg` | AT&T | [Simple Icons](https://simpleicons.org) | CC0 1.0 |
| `frontier.svg` | Frontier Communications | Wikimedia Commons — *Frontier Communications logo 2022.svg* | Public domain |
| `spectrum.svg` | Spectrum | [Simple Icons](https://simpleicons.org) | CC0 1.0 |
| `vivint.svg` | Vivint | [Simple Icons](https://simpleicons.org) | CC0 1.0 |
| `xfinity.svg` | Xfinity | Wikimedia Commons — *Xfinity logo 2021.svg* | Public domain |

## Colour

The Simple Icons files ship with no `fill`, which renders black and disappears
against a dark ground. Each carries the brand hex its own dataset publishes, and
that value — not one sampled off a screenshot — is set on the `<svg>` element:
AT&T `#009FDB`, Spectrum `#7B16FF`, Vivint `#212721`. The Commons files already
carry their own fills: ADT `#0061aa`, Frontier `#FF0037`, Xfinity `#6135f6`.

All six are drawn on the light plate `ProviderMark` renders, because that is the
ground they are specified against. Recolouring a brand asset to suit a dark
background is the one edit a logo may not have made to it.

## Two providers with no mark

**Direct Energy** and **Frontier Utilities** are set as wordmarks because no
correct freely-licensed asset was found for either.

This is worth stating precisely, because the near-misses are the trap. A search
for Direct Energy returns *Direct Énergie* — a different, French company — and
several unrelated firms. **Frontier Utilities** is a Texas retail electricity
provider and a different company from **Frontier** Communications, whose logo is
in the table above; using one for the other would put the wrong company's mark
on the page.

`logo` is optional on `Provider` for this reason. Drop a correct, freely-licensed
file here, add the filename, and it renders; leave it out and the wordmark
stands. Do not fill the gap with a lookalike.
