import type { Metadata } from "next";
import FuturePage from "@/components/cinematic/FuturePage";

export const metadata: Metadata = {
  title: "The Continuum — Move Relay",
  description:
    "The move is the acquisition; the home is the product. Seven modules extending one provenance kernel — each labelled built, concept, or hypothesis.",
  openGraph: {
    title: "The Continuum — Move Relay",
    description:
      "Seven modules extending one provenance, consent and attribution kernel across the home relationship.",
    type: "website",
  },
};

export default function FutureRoute() {
  return <FuturePage />;
}
