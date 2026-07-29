# Competitive landscape — moving and home-services concierge

Compiled 2026-07-28. Every claim carries a tag and, where it is a `[FACT]`, a
public source.

**This document is internal.** Competitor names appear here and nowhere on the
site. The public `/future` pages state capabilities and the reasoning behind
them without naming anyone, because a portfolio piece that ranks a prospective
employer's competitors on their own prospective employer's behalf is presuming
a relationship that does not exist. The reasoning has to be defensible; the
name-calling does not have to be published.

**Tags.** `[FACT]` verified against a public source cited inline. `[INFER]` a
reasonable reading of public evidence, not stated by the company. `[ASSUME]` a
working assumption with no evidence either way. `[HYPO]` a proposal, not a
finding.

---

## A caveat that governs everything below

`[FACT]` All the reach numbers in this document except Porch's are
**company-published marketing claims**, not audited figures. "250,000+ movers
served" and "more than 25% of U.S. moves" are assertions by the companies
making them, using definitions they chose and have not published.

Porch Group is the only public company here, so it is the only one whose
revenue is filed rather than asserted.

`[INFER]` This means the table below supports *positioning* comparisons and
does not support market-share conclusions. Treating a self-reported reach
number as a measured share is the same error this whole project exists to
argue against.

---

## The field

### Move Concierge — the closest direct comparison

`[FACT]` Serves movers with human concierges across internet, electricity, TV,
home security and home warranty. Publicly claims **250,000+ movers since 2009**
and **25,000+ reviews**, and 17+ years in business.
— <https://www.moveconcierge.com/>

`[FACT]` Rated 4.5/5 on Trustpilot across 623 reviews at time of writing, which
is a different and much smaller number than the 25,000+ the company cites — the
larger figure evidently aggregates sources the company has not itemised.
— <https://ca.trustpilot.com/review/www.moveconcierge.com>

`[INFER]` Provider commissions and partner revenue sharing fund a free-to-
consumer service. The brand asset is human trust at scale rather than software.

`[ASSUME]` No publicly marketed customer-facing AI agent. Absence of public
evidence is not evidence of absence — internal AI work would not be visible.

### Updater — the digital distribution play

`[FACT]` Publicly states it powers **more than 25% of all U.S. moves** and
supports more than 2 million multifamily units.
— <https://updater.com/solutions/moving>

`[INFER]` The advantage is not the smartest assistant. It is being invited at
the right moment through brokerages, property managers and transaction systems,
owning the move checklist, and embedding purchase flows inside someone else's
journey.

`[ASSUME]` Public material discusses automation broadly; no currently marketed,
named autonomous moving agent was found.

### LiveEasy — lifetime engagement, and now owned

`[FACT]` White-labeled home-management concierge; publicly cites partnerships
with brokerages representing **more than 150,000 agents**.
— <https://www.liveeasy.com/about-us/>

`[FACT]` **Acquired by AppFolio, announced 23 October 2024**, and folded into
FolioSpace resident onboarding.
— <https://ir.appfolioinc.com/news-releases/news-release-details/appfolio-unveils-foliospacetm-transform-resident-experience-and>
— <https://www.inman.com/2024/10/25/appfolio-acquires-liveeasy-for-next-gen-renter-experience/>

> **Correction to the brief this document was written from.** That brief
> described LiveEasy as an independent competitor. It has been part of AppFolio
> since October 2024. That materially changes the read: the lifetime-engagement
> thesis was valuable enough that a property-management software company bought
> it to own resident onboarding. The strategic lesson is stronger than the brief
> claimed, not weaker.

### Connect (Transactly) — nationwide funnel, assembled by acquisition

`[FACT]` Publicly claims **over 300,000 families** served across **all 50
states**. — <https://connectservices.com/>

`[FACT]` Connect was launched off the acquisition of Rent Engine LLC (dba Cake)
in September 2021, and later expanded by acquiring 360 Home Connect.
— <https://blog.transactly.com/transactly-launches-connect-with-acquisition-of-cake>
— <https://blog.transactly.com/transactly-expands-home-connections-with-acquisition-of-360-home-connect>

`[INFER]` Growth by acquisition rather than by organic integration. That
usually implies several inherited intake paths and provider integrations, which
is precisely the situation where provenance across channels stops being a nice
property and starts being the only way to reconcile the estate.

### Porch Group — the adjacent platform, and the only audited numbers

`[FACT]` **Full year 2024 revenue of $437.8 million.** Q4 2024 GAAP net income
$30.5m; Q4 adjusted EBITDA $41.8m.
— <https://ir.porchgroup.com/investors/news/news-details/2025/Porch-Group-Reports-Fourth-Quarter-2024-Results/default.aspx>

`[FACT]` **27,063 average companies** in Q4 2024 — home-services businesses
generating recurring revenue on the platform. Same source.

> **Correction to the brief.** The brief said "roughly 22,000 companies". The
> Q4 2024 filing says 27,063. The revenue figure in the brief ($438m) was
> right; the company count was not.

`[INFER]` Porch's AI is a data-and-risk moat, not a concierge agent: property
condition converted into underwriting signal. The transferable lesson is that
**AI becomes economically defensible when it feeds a proprietary data loop**,
not when it answers questions well.

### Utilify — the visible AI-native challenger

`[FACT]` Describes itself as the first MCP server for utility signup, callable
from Claude, ChatGPT, Cursor, Ollama or LM Studio, covering **all 4,844 Texas
ZIP codes** for electricity, internet, natural gas, water and trash. **No API
key, authentication or tracking required.**
— <https://mcpservers.org/servers/utilify-io/utilify-mcp>

`[INFER]` The bet is that the AI client becomes the front door — distribution
through agents rather than through brokerages.

`[INFER]` The unauthenticated, untracked design is the tell. It is excellent
for adoption and it means there is no actor identity in the loop, so the
questions that dominate this project have no obvious home in that architecture:
what happens after an ambiguous provider response, who confirmed consent, what
prevents a duplicate enrolment, who authorised the change, and what evidence
supports any of it. Comparison of plans is a read. Enrolling a household is a
write, and writes are where those questions bite.

`[ASSUME]` An AI voice-call intake beta. Referenced in the brief; not
independently verified here.

### Verity Relocation — paid concierge, contractual completion

`[ASSUME]` Flat-fee packages, explicit authorisation for sensitive data,
written confirmation, messaging updates. Taken from the brief; not
independently verified.

`[INFER]` A paid model changes the obligation. A provider-funded service is
incentivised toward enrolment; a customer-funded one is incentivised toward
*proof of completion*. That makes a written, evidenced completion artefact a
product requirement rather than a nicety.

---

## What the field does not appear to have

`[INFER]` Across every public surface reviewed, the following are either absent
or invisible:

1. **A stated position on ambiguous provider outcomes.** Nobody publicly
   describes what happens when a provider is sent an order and the reply is
   lost. It is the single most expensive failure in this domain — it either
   double-enrols a household or loses an order that exists — and it is not
   marketed by anyone, presumably because it is not a feature anyone wants to
   admit needing.
2. **Field-level provenance.** Plenty of "we compare plans for you". No public
   claim that every value in a customer record carries who supplied it, through
   which channel, and whether the customer confirmed it.
3. **A published authority boundary for AI.** Utilify exposes tools. Nobody
   publicly states which decisions a model is *forbidden* to make.
4. **Consent scoped to a purpose and a wording version.** Consent appears as a
   checkbox, not as a ledger that can answer "permitted to contact them about
   *this*, under *which* text".

`[HYPO]` That gap is the position. Not "more AI" — a trust layer that lets
human concierges and AI participate in the same move without losing provenance,
authority, or recoverability.

---

## What transfers, per competitor

Each of these is a `[HYPO]` — a proposal for Move Relay, not a claim about
Utility Connect's roadmap.

| Observed in market | Move Relay's version | Why it is different |
| --- | --- | --- |
| Embedded partner journeys (Updater) | Provenance-preserving intake, any channel | The embed keeps source, partner, channel, consent and trust tier on every field |
| Lifetime engagement (LiveEasy) | Home Continuum | The record does not close; consent is re-checked rather than assumed to persist |
| Partner revenue visibility (Move Concierge) | Auditable attribution | Attribution is a queryable chain, not a dashboard figure. **No invented revenue model.** |
| Proprietary data loop (Porch) | Transparent operational intelligence | Which handoffs conflict, which integrations malform, where humans are always needed. Never an opaque customer score. |
| Agent-accessible tools (Utilify) | Permissioned tool gateway | READ and DRAFT allowed; DECIDE blocked. The difference is the authority model, not the tool count. |
| Written completion (Verity) | Verified Move Packet | Evidence-linked, with unresolved items stated rather than omitted |

---

## Explicit non-claims

- No revenue model is proposed for Utility Connect. Attribution is demonstrated
  as *auditable*; what anyone is paid is not this project's business.
- No competitor is asserted to lack a capability internally. Only public
  surfaces were reviewed.
- No market share is claimed, derived, or implied for anyone.
- Nothing here is presented as Utility Connect's roadmap, and the public pages
  say so on the page.
