/**
 * Per-industry content for the "Who we work with" pages.
 *
 * Utility Connect's site has a dedicated page for each of these nine industries.
 * The brokers page structure — a bold headline, a value proposition, a
 * how-it-works, and a "Your Branded Microsite" section — is mirrored here for
 * every industry. Copy for the pages not yet individually crawled is written in
 * their voice and marked so; the brokers page uses their verbatim headline.
 */

export interface Industry {
  slug: string;
  name: string;
  glyph: string;
  /** Their verbatim headline where crawled; in-voice otherwise. */
  headline: string;
  verbatim?: boolean;
  valueProp: string;
  note: string;
  benefits: { title: string; body: string }[];
  /**
   * The same integrity engine, in this industry's own words.
   *
   * Every one of these pages sells the concierge and none of them said what is
   * underneath it — a partner learned the value proposition and never learned
   * why a handoff here is different from a handoff anywhere else. Written per
   * industry rather than as one shared paragraph, because "the moment the
   * handoff happens" is a closing for a title company and a lease signature for
   * a property manager, and a generic sentence covering both says nothing to
   * either.
   */
  relay: {
    /** When the handoff actually occurs in this industry's workflow. */
    moment: string;
    /** What goes wrong today, stated without the product in it. */
    risk: string;
    /** What the engine guarantees about it. */
    guarantee: string;
  };

  /**
   * Per-industry accent. Utility Connect color-themes each industry page (their
   * branded-microsite "color theme your page" feature made real): Builders is
   * green, Home Inspectors teal, and so on. Each page reskins its accent to this.
   */
  accent: string;
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "brokers-and-agents",
    name: "Brokers & Agents",
    glyph: "◈",
    headline: "Shake up the real estate industry",
    verbatim: true,
    valueProp:
      "Offer our free relocation tools to help acquire, assist, engage & convert more customers — and keep them coming back.",
    note: "Add value beyond the transaction.",
        relay: {
      moment: "The moment your client accepts an offer and you hand their details on.",
      risk: "You send a referral and it disappears. Nobody can tell you whether the client was contacted, which services were set up, or whether your office got credit for it.",
      guarantee: "The referral keeps your attribution on every field it produced, and your partner view shows that move's progress without exposing anyone else's.",
    },
accent: "#0087b5",
    benefits: [
      { title: "Get signed up", body: "Submit company details online or by phone." },
      { title: "Add your branding", body: "Your logo, your colors, on your own microsite." },
      { title: "Refer your clients", body: "Offer the concierge as an extension of your brand." },
    ],
  },
  {
    // Their live URL is /property-management, not /property-managers — the one
    // slug in the set that is not the plural of the audience name. Confirmed
    // against a capture of the real page. [FACT]
    slug: "property-management",
    name: "Property Managers",
    glyph: "⌂",
    headline: "A resident move-in they'll remember",
    valueProp:
      "Rentals and apartments are a hot commodity. Give every resident a concierge move-in that sets your properties apart.",
    note: "A great resident move-in experience.",
        relay: {
      moment: "The moment a lease is signed and a resident needs the unit live on day one.",
      risk: "Utilities are set up from a spreadsheet a leasing agent keeps, so a resident arrives to a unit with no power and the first ticket of the tenancy is your fault.",
      guarantee: "Every resident's services are one record with a source for each value, so a wrong move-in date surfaces as a conflict before the day rather than as a complaint after it.",
    },
accent: "#7c4dff",
    benefits: [
      { title: "One handoff per lease", body: "Every new resident routed to a concierge automatically." },
      { title: "Branded to your property", body: "Residents see your brand, not ours." },
      { title: "Fewer day-one tickets", body: "Utilities set up before they arrive." },
    ],
  },
  {
    slug: "mortgage-and-title",
    name: "Mortgage & Title",
    glyph: "▤",
    headline: "A free concierge that sets you apart",
    valueProp:
      "Mortgage lenders are restricted in what they can offer. Stand out with a complimentary concierge that costs your borrower nothing.",
    note: "A free concierge that sets you apart.",
        relay: {
      moment: "The moment the closing date is set and the borrower is handed the keys.",
      risk: "A closing slips by two days and nobody downstream is told, so the electricity is scheduled for a house the borrower does not yet own.",
      guarantee: "A changed date arrives as a new source against the same record, keeps the old one visible, and needs a named person to make it canonical.",
    },
accent: "#e8a33d",
    benefits: [
      { title: "Compliant by design", body: "A value-add that stays clear of RESPA concerns." },
      { title: "Borrower goodwill", body: "Reduce the stress of the move around closing." },
      { title: "Traceable attribution", body: "Every referral tied back to your office." },
    ],
  },
  {
    slug: "builders-and-hoas",
    name: "Builders & HOAs",
    glyph: "◇",
    headline: "Handle expectations at handover",
    valueProp:
      "Developers, builders and HOAs own the presentation. Let us handle the move-in experience so the handover feels effortless.",
    note: "Handle expectations at handover.",
        relay: {
      moment: "The moment a certificate of occupancy issues and the home changes hands.",
      risk: "Handover is a spreadsheet passed between the builder, the HOA and the buyer, and every copy diverges the moment one of them edits it.",
      guarantee: "One record, many contributors, and each value carries who supplied it — so three parties disagreeing produces a decision rather than three spreadsheets.",
    },
accent: "#5aa832",
    benefits: [
      { title: "Community-ready", body: "New owners connected before the keys change hands." },
      { title: "One integration", body: "Wire a whole community in through a single channel." },
      { title: "Consistent brand", body: "The same premium experience for every home." },
    ],
  },
  {
    slug: "movers-and-relocation",
    name: "Movers & Relocation",
    glyph: "⇄",
    headline: "You locate. We set up the home.",
    valueProp:
      "Relocating a client has many challenges. Locating the property is your specialty; setting up the home services is ours.",
    note: "You locate; we set up the home.",
        relay: {
      moment: "The moment the move date is confirmed and the truck is booked.",
      risk: "The move date changes with the truck and nobody tells the utility, so a family arrives to a dark house on the day they actually moved.",
      guarantee: "The date is one field with a history, and changing it is a decision with an actor and a reason attached, not an overwrite.",
    },
accent: "#e5484d",
    benefits: [
      { title: "Complementary, not competing", body: "We handle services, never the move itself." },
      { title: "Warm handoff", body: "Your client is expected, not cold-transferred." },
      { title: "Verified follow-through", body: "Every service tracked to completion." },
    ],
  },
  {
    slug: "home-inspectors",
    name: "Home Inspectors",
    glyph: "◉",
    headline: "A service they won't stop talking about",
    valueProp:
      "Inspecting a home is vital but rarely celebrated. Add a concierge service that turns a routine touchpoint into a referral.",
    note: "A service they won't stop talking about.",
        relay: {
      moment: "The moment the inspection completes and the buyer is deciding what happens next.",
      risk: "You hand a buyer a recommendation and lose sight of it. Whether anything came of it is unknowable, so the goodwill you generated is unmeasurable.",
      guarantee: "The referral is attributed to you and stays attributed through every later step, so the follow-through is visible rather than assumed.",
    },
accent: "#12b5b0",
    benefits: [
      { title: "Add-on value", body: "Hand the buyer something memorable after the inspection." },
      { title: "Zero overhead", body: "No cost to you or the buyer." },
      { title: "Referral engine", body: "Turn goodwill into repeat business." },
    ],
  },
  {
    slug: "apartment-locators",
    name: "Apartment Locators",
    glyph: "⊞",
    headline: "Locate the home, and the home services",
    valueProp:
      "You already locate apartments for busy clients. Offer a concierge to locate their home services too.",
    note: "Concierge for their home services too.",
        relay: {
      moment: "The moment your client signs and needs the unit connected.",
      risk: "You solved the apartment and the client is left to solve the utilities alone, which is the part of the move they will remember.",
      guarantee: "The services they asked for become tracked requests with real provider outcomes, including the ones that are still uncertain.",
    },
accent: "#d6478f",
    benefits: [
      { title: "Full-service impression", body: "You solved the apartment and the utilities." },
      { title: "Branded microsite", body: "Your locator brand, our concierge engine." },
      { title: "Traceable leads", body: "Every client attributed back to you." },
    ],
  },
  {
    slug: "transaction-coordinators",
    name: "Transaction Coordinators",
    glyph: "⟐",
    headline: "Alleviate stress across every party",
    valueProp:
      "You liaise between seller, buyer, agents and third parties. Offer the concierge to take the home-services stress off everyone's plate.",
    note: "Alleviate stress across every party.",
        relay: {
      moment: "The moment every party has signed and someone has to chase the rest.",
      risk: "You are the one holding four threads, and the home-services thread is the one with no system behind it — so it lives in your inbox.",
      guarantee: "Each thread is a service request with its own state, and an ambiguous provider outcome is held as unknown rather than quietly marked done.",
    },
accent: "#3d7ae5",
    benefits: [
      { title: "One less handoff to chase", body: "Utilities coordinated without your involvement." },
      { title: "Clean attribution", body: "Referrals traceable across every party." },
      { title: "Smoother closings", body: "Fewer move-in surprises to manage." },
    ],
  },
  {
    slug: "city-municipalities",
    name: "City Municipalities",
    glyph: "▣",
    headline: "Streamline enrollment for city utilities",
    valueProp:
      "Cities are often old-school. We integrate our systems into municipal workflows to streamline the enrollment process for city utilities.",
    note: "Integrated enrollment for city utilities.",
        relay: {
      moment: "The moment a resident establishes service at a new address.",
      risk: "Enrollment arrives through several forms and channels that were never designed together, so the same household is entered twice under different spellings.",
      guarantee: "Duplicate detection is deterministic and inspectable, and a probable match attaches as a second source rather than becoming a second household.",
    },
accent: "#0f9b6c",
    benefits: [
      { title: "Systems integration", body: "Wire municipal enrollment into a modern flow." },
      { title: "Resident-friendly", body: "One intake instead of many forms." },
      { title: "Auditable handoffs", body: "Every enrollment traceable end to end." },
    ],
  },
];

export const getIndustry = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);
