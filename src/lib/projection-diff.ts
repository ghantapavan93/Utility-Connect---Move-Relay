/**
 * What one audience receives that another does not.
 *
 * The Views page makes a negative claim — the partner does not get the
 * provider's order id, the customer does not get the internal error category —
 * and a negative is the one thing a screenshot cannot show. Three panels that
 * merely *look* different prove nothing: a field could be present in the
 * payload and simply not rendered by that component, which is exactly the bug
 * this page exists to rule out.
 *
 * So the difference is computed here, from the real responses, by comparing the
 * leaf paths each audience actually received. If a projection ever leaked a
 * field, it would stop appearing in the withheld list rather than the page
 * continuing to assert an absence that was no longer true.
 *
 * The direction of risk matters and shapes every function below: claiming a
 * field was withheld when the server in fact sent it is a false reassurance
 * about privacy, which is worse than showing nothing at all. `withheld`
 * therefore only ever reports a path it has confirmed absent from a payload it
 * actually holds.
 */

/**
 * Every leaf path in a payload, in dotted form.
 *
 * Arrays collapse to a single `[]` segment because the claim is about the
 * *shape* a projection returns, not how many rows came back — `services[0]` and
 * `services[1]` carry the same fields, and enumerating both would make a longer
 * move look like a broader disclosure.
 */
export function leafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    const path = `${prefix}[]`;
    // An empty array discloses nothing about its element shape, so it is a leaf.
    if (value.length === 0) return [path];
    // Union across elements: a field present on any row was disclosed.
    return [...new Set(value.flatMap((v) => leafPaths(v, path)))];
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return prefix ? [prefix] : [];
    return entries.flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
  }

  return prefix ? [prefix] : [];
}

/**
 * Paths the reference audience received and this one did not.
 *
 * `reference` is the most-privileged projection rather than "everything" —
 * there is no view in this system that returns every column, and describing one
 * as such would be a claim the code does not support.
 */
export function withheld(reference: unknown, audience: unknown): string[] {
  const mine = new Set(leafPaths(audience));
  return leafPaths(reference)
    .filter((p) => !mine.has(p))
    .sort();
}

/** Paths this audience received that the reference did not. */
export function additional(reference: unknown, audience: unknown): string[] {
  return withheld(audience, reference);
}

/**
 * Paths every audience receives.
 *
 * Useful as the honest counterweight to the withheld list: some fields are
 * shared by all three, and a page that only ever showed subtraction would
 * imply the projections have nothing in common.
 */
export function shared(payloads: unknown[]): string[] {
  if (payloads.length === 0) return [];
  const sets = payloads.map((p) => new Set(leafPaths(p)));
  return [...sets[0]!].filter((p) => sets.every((s) => s.has(p))).sort();
}
