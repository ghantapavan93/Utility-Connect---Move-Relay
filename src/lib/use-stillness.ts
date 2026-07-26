"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Has this visitor asked for stillness, by either route?
 *
 * There are two, and the accessibility menu shipped only half working because
 * of it. The OS-level `prefers-reduced-motion` is what `useReducedMotion`
 * reads. The in-page toggle sets `data-a11y-still` on the document root, which
 * the stylesheet honours by collapsing animation and transition durations.
 *
 * That covers CSS animation and transitions and nothing else. Scroll-driven
 * motion — the hero parallax, the focus pull, the drifting photo bands — is a
 * per-frame inline style write, not a transition, so a CSS duration override
 * cannot touch it. The toggle read as working, the page kept moving, and the
 * visitor who most needed it was the only one who would find out.
 *
 * This hook is the missing half: it reports true if *either* signal is set, and
 * watches the attribute so flipping the toggle stops the motion immediately
 * rather than at the next navigation.
 */
export function useStillness(): boolean {
  const osPreference = useReducedMotion();
  const [pageToggle, setPageToggle] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setPageToggle(root.hasAttribute("data-a11y-still"));
    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-a11y-still"] });
    return () => observer.disconnect();
  }, []);

  return !!osPreference || pageToggle;
}
