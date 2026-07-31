"use client";

import type { ContinuumVisualKey } from "@/lib/continuum";
import {
  ConciergeVisual,
  ContinuityVisual,
  LaunchpadVisual,
  RelayVisual,
  ScenarioVisual,
  TimelineVisual,
  WalletVisual,
} from "./FutureVisuals";

/**
 * One module's operable diagram, chosen by the key its data carries.
 *
 * A `Record` rather than a `switch` so the compiler enforces the pairing: add a
 * key to `ContinuumVisualKey` without a diagram and this stops building, which
 * is the whole reason the key lives in the data. Exhaustiveness is the point —
 * the previous arrangement had eight diagrams, seven modules, no link between
 * them, and nothing that could notice.
 */
const VISUALS: Record<ContinuumVisualKey, () => React.JSX.Element> = {
  relay: RelayVisual,
  launchpad: LaunchpadVisual,
  concierge: ConciergeVisual,
  scenario: ScenarioVisual,
  wallet: WalletVisual,
  timeline: TimelineVisual,
  continuity: ContinuityVisual,
};

export function ContinuumModuleVisual({ visual }: { visual: ContinuumVisualKey }) {
  const Visual = VISUALS[visual];
  return <Visual />;
}
