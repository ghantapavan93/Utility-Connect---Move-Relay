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
    benefits: [
      { title: "Get signed up", body: "Submit company details online or by phone." },
      { title: "Add your branding", body: "Your logo, your colors, on your own microsite." },
      { title: "Refer your clients", body: "Offer the concierge as an extension of your brand." },
    ],
  },
  {
    slug: "property-managers",
    name: "Property Managers",
    glyph: "⌂",
    headline: "A resident move-in they'll remember",
    valueProp:
      "Rentals and apartments are a hot commodity. Give every resident a concierge move-in that sets your properties apart.",
    note: "A great resident move-in experience.",
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
    benefits: [
      { title: "Systems integration", body: "Wire municipal enrollment into a modern flow." },
      { title: "Resident-friendly", body: "One intake instead of many forms." },
      { title: "Auditable handoffs", body: "Every enrollment traceable end to end." },
    ],
  },
];

export const getIndustry = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);
