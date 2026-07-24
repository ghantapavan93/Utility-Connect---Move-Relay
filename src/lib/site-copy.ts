/**
 * Bilingual site copy — the EN/ES toggle Utility Connect's own site carries.
 *
 * Their public site ships an English/Spanish language selector; a faithful
 * clone does too. The translated surface covers the customer-facing marketing
 * sections (hero, how-it-works, stats, features, CTA). The added platform
 * sections — provenance hook, engineering panels — remain English, as they are
 * additions to the site, not part of the clone.
 */

export type Lang = "en" | "es";

export interface Track {
  n: number;
  title: string;
  body: string;
}

export interface SiteCopy {
  hero: { badge: string; h1a: string; h1accent: string; p: string; ctaPrimary: string; ctaSecondary: string };
  trust: string;
  how: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    customersLabel: string;
    partnersLabel: string;
    customers: Track[];
    partners: Track[];
    watchStory: string;
  };
  stats: { happy: string; partners: string; reviews: string; connections: string; attribution: string };
  features: { eyebrow: string; title: string; titleAccent: string };
  cta: { title: string; p: string; primary: string; secondary: string };
}

export const SITE_COPY: Record<Lang, SiteCopy> = {
  en: {
    hero: {
      badge: "Concierge · Technology · Verified handoffs",
      h1a: "Compare all",
      h1accent: "home services",
      p: "Simplify your move and save time. Compare providers, hear special offers, and connect every essential service — with a dedicated concierge and a platform that keeps every handoff visible, attributable, and verified.",
      ctaPrimary: "Set up services",
      ctaSecondary: "Partner with us",
    },
    trust: "Connecting 18 home services across 3,500+ vendors nationwide",
    how: {
      eyebrow: "Get started today",
      title: "How Utility Connect",
      titleAccent: "works",
      customersLabel: "For customers",
      partnersLabel: "For partners",
      customers: [
        { n: 1, title: "Start enrollment", body: "Submit your details online or over the phone. One form, one place." },
        { n: 2, title: "Compare service options", body: "A dedicated concierge shops and compares every utility and home service for your address." },
        { n: 3, title: "We handle the rest", body: "Installations scheduled, a written service summary sent. You move in ready." },
      ],
      partners: [
        { n: 1, title: "Connect your channel", body: "Branded microsite, API, widget, or CSV — refer a client the way that fits your workflow." },
        { n: 2, title: "Every handoff stays verified", body: "Move Relay preserves who referred whom, through which channel, with attribution intact." },
        { n: 3, title: "See safe, live status", body: "A partner-safe view of engagement and progress — never another partner's pipeline." },
      ],
      watchStory: "Watch the story",
    },
    stats: {
      happy: "Happy customers",
      partners: "Satisfied partners",
      reviews: "Positive reviews",
      connections: "Total connections",
      attribution: "Figures as published on utilityconnect.net. See “which number is the source of truth?” below.",
    },
    features: { eyebrow: "Just to list a few", title: "Features Utility Connect", titleAccent: "offers" },
    cta: {
      title: "Get your own Utility Connect account.",
      p: "Ready to get the ball rolling? Bring the concierge and the verified platform to your brand.",
      primary: "Get started",
      secondary: "Watch the live demo",
    },
  },
  es: {
    hero: {
      badge: "Concierge · Tecnología · Traspasos verificados",
      h1a: "Compare todos los",
      h1accent: "servicios del hogar",
      p: "Simplifique su mudanza y ahorre tiempo. Compare proveedores, escuche ofertas especiales y conecte cada servicio esencial — con un concierge dedicado y una plataforma que mantiene cada traspaso visible, atribuible y verificado.",
      ctaPrimary: "Configurar servicios",
      ctaSecondary: "Sea nuestro socio",
    },
    trust: "Conectamos 18 servicios del hogar con más de 3,500 proveedores en todo el país",
    how: {
      eyebrow: "Comience hoy",
      title: "Cómo funciona",
      titleAccent: "Utility Connect",
      customersLabel: "Para clientes",
      partnersLabel: "Para socios",
      customers: [
        { n: 1, title: "Inicie su inscripción", body: "Envíe sus datos en línea o por teléfono. Un formulario, un solo lugar." },
        { n: 2, title: "Compare sus opciones", body: "Un concierge dedicado busca y compara cada servicio del hogar para su dirección." },
        { n: 3, title: "Nosotros hacemos el resto", body: "Instalaciones programadas y un resumen escrito de sus servicios. Llegue a su hogar listo." },
      ],
      partners: [
        { n: 1, title: "Conecte su canal", body: "Micrositio con su marca, API, widget o CSV — refiera clientes como mejor le convenga." },
        { n: 2, title: "Cada traspaso queda verificado", body: "Move Relay preserva quién refirió a quién, por qué canal, con la atribución intacta." },
        { n: 3, title: "Vea el estado en vivo", body: "Una vista segura del progreso — nunca la cartera de otro socio." },
      ],
      watchStory: "Vea la historia",
    },
    stats: {
      happy: "Clientes satisfechos",
      partners: "Socios satisfechos",
      reviews: "Reseñas positivas",
      connections: "Conexiones totales",
      attribution: "Cifras publicadas en utilityconnect.net. Vea “¿cuál número es la fuente de la verdad?” más abajo.",
    },
    features: { eyebrow: "Solo por mencionar algunas", title: "Funciones que Utility Connect", titleAccent: "ofrece" },
    cta: {
      title: "Obtenga su propia cuenta de Utility Connect.",
      p: "¿Listo para comenzar? Lleve el concierge y la plataforma verificada a su marca.",
      primary: "Comenzar",
      secondary: "Vea la demostración en vivo",
    },
  },
};

export const getLang = (raw: string | string[] | undefined): Lang =>
  raw === "es" ? "es" : "en";
