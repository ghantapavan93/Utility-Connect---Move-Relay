/**
 * The marker the two isolation-harness files share.
 *
 * A plain module rather than an export from the test file itself. Importing a
 * `.test.ts` registers its suites in the importing file, so the first version
 * of this proof ran file A's tests *inside* file B — planting the marker in B's
 * own database and then finding it there. The test reported "5 tests" for a
 * file that defines 3, which was the only visible sign that the proof was
 * proving nothing.
 */
export const MARKER_SLUG = "harness-isolation-marker";
