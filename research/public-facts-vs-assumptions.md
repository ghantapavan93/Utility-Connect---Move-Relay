# Public Facts vs Assumptions

Compiled 2026-07-23 from `utilityconnect.net` only. Every line is tagged. Nothing is
promoted between tiers silently.

`[FACT]` quoted or directly observed on the live public site
`[INFER]` follows from facts with stated reasoning
`[ASSUME]` plausible, unverified — must never be presented as knowledge
`[HYPO]` prototype hypothesis, deliberately unproven

---

## The three documents that carry the thesis

The homepage sells. The **Privacy Policy** (`/priv`) and **Terms** (`/tos`) describe the
actual data mechanics. They upgraded three core premises from inference to fact.

### F1 — White-label technology is hosted on partner sites, and customer PII flows back to the partner

> "If you create a User account via Utility Connect technology hosted on a third-party
> site … Utility Connect may share your personally-identifiable information with the
> Hosting Business" — `/priv` `[FACT]`

Three things follow, and none require any claim about internal systems:

1. Utility Connect technology runs **on domains they do not own**. `[FACT]`
2. Therefore **more than one customer capture surface exists**. `[FACT — was INFER]`
3. A **partner-facing projection of customer data already exists as a documented
   obligation**, with rules about what may cross the boundary. `[FACT]`

Point 3 is the important one. Screen 8 (Partner-Safe Projection) is not a product idea
invented for a demo. It is a data-governance requirement stated in their own privacy
policy. The prototype implements a boundary they have already declared.

Corroborated by the partner signup form collecting `Domain Name`, `Theme Color`, and
`Company Logo`. `[FACT]`

### F2 — Partners submit customer data directly, in parallel with the customer

Data collected **from partners**:

> "first and last name, email address, old and/or new postal address, phone number,
> certain dates related to your relocation process" — `/priv` `[FACT]`

Data collected **from the customer** at `/connect`: name, email, phone, address, unit,
state, move date, service selections. `[FACT]`

**These two sets overlap almost entirely.** `[FACT]`

The same person's identity, contact details, addresses, and move dates therefore enter
the system through at least two independent doors, at different times, with no
guarantee of agreement. `[INFER — high confidence, directly from the overlap]`

That is the duplicate-and-conflict condition. It is established from their own
disclosures, not assumed. The Maya Patel scenario is a concrete instance of a documented
data flow.

### F3 — Utility Connect is not the system of record for a provider order

> "Service and product offerings … are made and offered directly by the applicable
> service provider." — `/tos` `[FACT]`

> "You are not purchasing or ordering products or services from Utility Connect, LLC
> when you order a service." — `/tos` `[FACT]`

> Utility Connect "facilitates your transaction" and is "not responsible for the
> performance of any service provider." — `/tos` `[FACT]`

This is the strongest architectural fact available publicly.

Order truth lives **inside the provider's system**. Utility Connect holds a belief about
that truth, formed from a network response it may or may not receive. `[INFER]`

So when a provider call times out, the correct state genuinely is `UNKNOWN` — not
"failed", not "succeeded". The only sound recovery is reconciliation against the
provider. A blind retry risks a duplicate order in a system Utility Connect does not
control and is contractually not responsible for. `[INFER]`

**The timeout scenario is not a contrived demo failure.** It is the natural consequence
of a facilitator architecture that their Terms of Service describe explicitly.

---

## Consent — narrower than it first appears

Consent wording at `/connect`, quoted exactly `[FACT]`:

> "By clicking 'REQUEST CALLBACK' you consent to be contacted by Utility Connect via
> phone and/or text (SMS) and/or email … using automated dialing technology regarding
> customer care, utility connection status, account information, and appointment
> details."

Scoped to four named purposes. Not blanket marketing consent. `[INFER]`

> "Mobile information will not be shared with third parties/affiliates for
> marketing/promotional purposes" — `/priv` `[FACT]`

Revocation: "STOP, QUIT, END, REVOKE, OPT OUT, CANCEL, or UNSUBSCRIBE" `[FACT]`
Deletion: "within 7-30 business days" `[FACT]`
California rights at `/ccpa` `[FACT]`

**Design consequence.** Consent is per-channel, per-purpose, revocable at any moment,
and captured at a specific timestamp. A boolean `consent = true` column cannot express
this. The prototype's `consent_events` ledger is modelling a real constraint, and every
outbound communication must resolve against the consent version in force at that moment.
`[INFER]`

## PII — the stakes are real

Registered users: "name, postal address, e-mail address, telephone number, **social
security number**" `[FACT]`

Utility enrolment commonly requires SSN for provider credit checks. `[ASSUME]`

This makes the AI boundary rules load-bearing rather than decorative. A record that may
carry an SSN must never be passed wholesale into an LLM prompt. Build Ledger entry #2
("PII sent unnecessarily to an LLM") stops being a hypothetical teaching example and
becomes a real hazard the architecture must prevent. `[INFER]`

Analytics: Google Analytics Remarketing, Display Network Impression Reporting,
DoubleClick integrations. `[FACT]`

---

## Operational scale and shape

| Observation | Tag |
|---|---|
| 18 selectable services | `[FACT]` |
| 9 named partner industries, including City Municipalities | `[FACT]` |
| 5 partner roles: Agent, Admin, Manager, Owner, Regional | `[FACT]` |
| "We integrate our systems into cities to streamline the enrollment process" | `[FACT]` |
| "a service based company driven by our proprietary technology" | `[FACT]` |
| `Movologist™` — trademarked concierge role | `[FACT]` |
| Concierge shops providers, schedules installs, sends written summary | `[FACT]` |
| 5 roles implies org-scoped, role-scoped access control | `[INFER]` |
| Municipal integrations imply heterogeneous, non-standard interfaces | `[INFER]` |
| 18 services × 9 industries × 5 roles is a real combinatorial surface | `[FACT]` |

## Marketing-layer defects — quarantined

Homepage counters duplicate across distinct labels (`1503`/`1503`, `33`/`33`); reviews
all carry the crawl date, out of chronological order, with names repeating in one
render. `[FACT]`

**These describe a marketing page and nothing else.** They are not evidence about the
internal platform, the CRM, or the concierge tooling, and any deck or README that
implies otherwise must be rewritten. Their only sanctioned use is as a 10-second
narrative device for "displayed value vs source value vs capture time" — and even then,
only about the public site.

See ADR-007.

---

## What remains genuinely unknown

Never assume these. Never imply the prototype fills these gaps.

- Whether duplicate detection, provenance, attribution tracking, or reconciliation
  already exist internally. **Most likely at least partly yes.** `[ASSUME]`
- Internal CRM architecture, data model, integration layer
- Whether provider submissions are automated or concierge-manual
- Real provider APIs, contracts, SLAs, error semantics
- Actual volumes, conversion, partner mix, revenue model
- Exact technical implementation, commercial terms, adoption volume, or integration
  state behind the LeadingRE relationship. The partnership itself is public; nothing
  about how it is wired is. Treated as a strategic signal only — see
  `leadership-and-product-signals.md`
- VendorHub's stack, production status, data model, pricing, customer count, or
  corporate relationship to Utility Connect. Its stated purpose is public; none of
  the above is
- Whether a partner microsite is a subdomain, a full domain, or an embed

## The argument, in five lines

1. Utility Connect technology runs on partner-owned domains and shares customer PII back
   to those partners. `[FACT]`
2. Partners and customers independently submit the same overlapping fields. `[FACT]`
3. Consent is scoped, timestamped, per-channel, and revocable. `[FACT]`
4. Provider systems — not Utility Connect — are the system of record for orders. `[FACT]`
5. Therefore provenance, conflict resolution, consent versioning, and reconciliation are
   intrinsic to the business as publicly described. `[INFER]`

Move Relay is an additive layer that makes those four facts explicit, inspectable, and
reversible. It never claims they are currently absent.
