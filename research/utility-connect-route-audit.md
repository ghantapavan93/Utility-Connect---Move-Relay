# Utility Connect — Public Route Audit

Crawled 2026-07-23. Source: `utilityconnect.net` (resolves to `www.utilityconnect.net`).

**Status: PARTIAL.** Homepage, `/connect`, `/partnership` inspected. Dropdown menus,
industry pages, careers, vendor, branding, localization, and responsive breakpoints
still outstanding. See "Not yet audited".

Evidence tags: `[FACT]` verified on the live site · `[INFER]` reasonable inference ·
`[ASSUME]` unverified · `[HYPO]` prototype hypothesis.

---

## R1 — `/` Homepage

| | |
|---|---|
| **Purpose** | Convert two audiences from one page: movers and referral partners |
| **Primary user** | Split — consumer *and* partner, toggled by tabs |
| **Primary action** | `Set up Services` → `/connect` · `Partner With Us` → `/partnership` |

**Observed**
- Nav: `HOME`, `WHO WE WORK WITH`, `SIGN UP`, `EN` language toggle, `(877) 587-9566` `[FACT]`
- `WHO WE WORK WITH` and `SIGN UP` are `href="#"` dropdown triggers, not routes `[FACT]`
- Customer flow stated as 3 steps: enrollment form → concierge compares → scheduling + written service summary `[FACT]`
- Self-description: *"a service based company driven by our proprietary technology"* `[FACT]`
- *"bringing consumers and providers together **under your brand**"* — white-label stated publicly `[FACT]`
- `Movologist™` — trademarked internal term for the concierge role `[FACT]`
- HQ: 6800 Windhaven Pkwy Suite 133, The Colony, TX 75056 · info@utilityconnect.net `[FACT]`
- Footer: Contact Us · Careers · Become A Vendor · Branding · Internships `[FACT]`
- 9 named industries: Brokers & Agents, Property Managers, Mortgage & Title, Builders & HOAs, Movers & Relocation, Home Inspectors, Apartment Locators, Transaction Coordinators, **City Municipalities** `[FACT]`
- *"We integrate our systems into cities to streamline the enrollment process for city utilities"* `[FACT]`

**Data-integrity observations — relevant to the product thesis**

1. **Counter values are duplicated.** `1503 HAPPY CUSTOMERS` / `1503 TOTAL CONNECTIONS`, and
   `33 SATISFIED PARTNERS` / `33 POSITIVE REVIEWS`. Two distinct metrics render identical
   numbers in both pairs. `[FACT]`
   Most likely one source value bound to two labels. `[INFER]`
2. **Review timestamps are not chronological and all carry the crawl date.** Every review
   shows `Jul 23rd, 2026` with times out of order (1:57PM, 1:27PM, 5:42PM, 4:57PM, 4:12PM…),
   and the same reviewers repeat within one page render (Ric V., Koffi M., Matt P., Heather M.
   each appear twice). `[FACT]`
   Consistent with a rolling carousel that re-stamps display dates rather than showing the
   real capture time. `[INFER]`
3. A published review names a **competitor** directly: *"I've used Utility Concierge before
   and was not happy with the service."* `[FACT]` Utility Concierge is a real competitor in
   the same category. `[FACT]`

> **Constraint check.** These are presentation-layer observations about the marketing site.
> They are **not** evidence about the internal platform, CRM, or concierge tooling, and must
> never be presented as such. Their only legitimate use is as a *narrative hook*: they make
> "displayed value vs. source value vs. capture time" concrete for a non-technical viewer.

---

## R2 — `/connect` Customer enrollment

| | |
|---|---|
| **Purpose** | Capture a mover and their desired services |
| **Primary user** | Consumer moving into a new home |
| **Primary action** | Request callback / start enrollment |

**Observed**
- Address (required), Unit # (optional), service checkboxes, State (required) `[FACT]`
- Contact form: Name, Email, Phone, State — all required `[FACT]`
- Separate **Mail Forwarding** form: old address, new address, name, last name, suffix,
  moving date, rent/own, email, phone `[FACT]`
- **18 selectable services** `[FACT]`: Electric, Security, Telephone, Cable, Satellite,
  Water, Internet, Insurance, Gas, Solar Energy, Cleaning, Pest Control, Home Warranty,
  Lawn Care, Furniture, Mail Forwarding, Appliance Rentals, Storage

**Consent language, quoted exactly** `[FACT]`

> "By clicking 'REQUEST CALLBACK' you consent to be contacted by Utility Connect via phone
> and/or text (SMS) and/or email at the phone number(s) and or email(s) provided using
> automated dialing technology regarding customer care, utility connection status, account
> information, and appointment details."

Plus: *"Message and data rates may apply. Msg frequency varies. Reply STOP to unsubscribe
or HELP if you need additional assistance."*

This is TCPA-style express written consent, scoped to named purposes. `[INFER]`

**Attribution gap**
- No visible field on the public customer form for *who referred me*. `[FACT]`
- **Not** evidence that attribution is unsolved. Far more likely it is carried by partner
  microsite domain, a link parameter, or the partner's own submission path. `[INFER]`
- Framing for the prototype: attribution arrives **out-of-band from the customer**, so the
  customer cannot confirm or correct it at capture time. `[HYPO]`

---

## R3 — `/partnership` Partner onboarding

| | |
|---|---|
| **Purpose** | Recruit referral partners |
| **Primary user** | Agent, brokerage, property manager, lender, builder |
| **Primary action** | Partner registration |

**Observed form fields** `[FACT]`
First Name, Last Name, Email, Mobile Phone, **Domain Name**, **Theme Color**, Company Name,
Company Address, Company Website, Company Phone, **Company Logo** (file upload), Company Type.

Role selector: `Agent · Admin · Manager · Owner · Regional` `[FACT]`
Consent checkbox for phone/email/SMS contact `[FACT]`

**This is the single most important finding of the crawl.**

`Domain Name` + `Theme Color` + `Company Logo` collected at signup is a **white-label
microsite provisioning form**. `[INFER — high confidence]` Partners get a branded capture
surface on their own domain.

Consequences that follow directly:
- At least two customer-facing capture surfaces exist: the main site and per-partner
  branded microsites. `[INFER]`
- The same human can plausibly arrive through more than one surface. `[HYPO]`
- Five distinct partner roles implies org-scoped, role-scoped access. `[INFER]`

Marketing copy describes benefits (satisfaction, brand elevation, referral volume,
vendor exposure) but names **no** integration mechanism, dashboard, or reporting tool
publicly. `[FACT]` Absence from marketing copy is not absence from the product. `[ASSUME
NOTHING]`

---

## What this establishes for Move Relay

The wedge does **not** depend on Utility Connect lacking anything. It depends only on
publicly verifiable structure:

1. Multiple capture surfaces exist — main site, branded partner microsites, phone.
   `[INFER from R3]`
2. Consent is captured with specific scoped wording at a specific moment. `[FACT from R2]`
3. Attribution originates outside the customer's own input. `[INFER from R2]`
4. 18 services × 9 industries × 5 partner roles = genuine combinatorial surface. `[FACT]`
5. Concierge is a named, trademarked human role central to delivery. `[FACT from R1]`

Provenance matters wherever the same fact can enter from more than one door and a human
later has to act on it. Points 1–3 establish that condition from public evidence alone.
That is the whole argument. It never requires a claim about their internals.

---

## Not yet audited

- `WHO WE WORK WITH` dropdown → 9 industry pages
- `SIGN UP` dropdown targets
- Careers · Become A Vendor · Branding · Internships · Contact Us
- Terms of Use · Privacy Policy — **high value**, likely names data handling and sharing
- `EN` localization behaviour
- Mobile / tablet / ultra-wide layouts
- Validation, error, empty, and success states
- A real partner microsite on a partner domain — would confirm R3 outright
- LeadingRE partnership material, founder background, VendorHub — user-supplied, not yet provided
