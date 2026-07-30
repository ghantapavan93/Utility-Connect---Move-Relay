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
  /*
    The continuum stays exactly what it is — the film. The one addition is the
    route onward: /future/thesis is the same roadmap for the reader who asks
    "and how would that actually work", with failure modes, architecture and
    reality labels enforced by test. An anchor after the film rather than a
    change to it.
  */
  return (
    <>
      <FuturePage />
      <div className="bg-[#04070b] px-6 pb-20 text-center">
        <a
          href="/future/thesis"
          className="inline-flex min-h-11 items-center rounded-full border px-6 text-[12px] font-bold uppercase tracking-wide"
          style={{ borderColor: "rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.75)" }}
        >
          Read the working product thesis — horizons, failure modes, architecture →
        </a>
      </div>
    </>
  );
}
