"use client";

import { motion } from "framer-motion";

/**
 * Scroll-triggered reveal. One motion primitive, reused everywhere, so the whole
 * site shares a single motion language: a short rise and fade as content enters,
 * honouring reduced-motion via Framer's global reduced-motion handling.
 *
 * Deliberately under 300ms and transform/opacity only — the Emil Kowalski rules
 * the design system adopted.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
