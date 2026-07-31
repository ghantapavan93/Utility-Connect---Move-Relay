import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The crash surfaces, exercised without crashing anything.
 *
 * `error.tsx` and `global-error.tsx` render only when a real exception occurs,
 * and this repository refuses to ship a crash trigger to test them — so for a
 * while they were the only surfaces verified by nothing but the type checker.
 * That gap closes here with React's own server renderer: `renderToStaticMarkup`
 * runs the actual components against literal props and returns the markup a
 * crashed visitor would receive. No jsdom — ADR-012 rejected DOM simulation,
 * and this is not that; it is the same renderer the framework itself uses on
 * the server, exercising the real component functions.
 *
 * `next/link` is stubbed to a bare anchor because the app-router context it
 * wants does not exist outside a running app — the stub preserves exactly what
 * these assertions read: the href and the label.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

// Imported after the mock so the stub is what they see.
const { default: ErrorPage } = await import("@/app/error");
const { default: GlobalError } = await import("@/app/global-error");

const noop = () => {};

describe("the route crash surface says what it knows, and only that", () => {
  it("separates the render's failure from the records' safety", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorPage, { error: Object.assign(new Error("boom"), {}), reset: noop }),
    );
    expect(html).toContain("The render failed.");
    expect(html).toContain("The records did not.");
    // The epistemics: a client exception proves nothing about the server, and
    // the page must claim exactly that — not "your data is safe", which would
    // be reassurance without evidence.
    expect(html).toContain("which this crash never touched");
    expect(html).toContain("Try the render again");
    expect(html).toContain('href="/dashboard"');
  });

  it("shows the digest when one exists and stays silent when none does", () => {
    const withDigest = renderToStaticMarkup(
      createElement(ErrorPage, {
        error: Object.assign(new Error("boom"), { digest: "abc123def" }),
        reset: noop,
      }),
    );
    expect(withDigest).toContain("digest: abc123def");

    // A digest line with nothing after the colon would read as a bug on the
    // bug page. Absence renders as absence.
    const withoutDigest = renderToStaticMarkup(
      createElement(ErrorPage, { error: new Error("boom"), reset: noop }),
    );
    expect(withoutDigest).not.toContain("digest:");
  });
});

describe("the shell crash surface assumes nothing survived", () => {
  it("renders its own document with inline styles only", () => {
    const html = renderToStaticMarkup(
      createElement(GlobalError, {
        error: Object.assign(new Error("boom"), { digest: "shell9" }),
        reset: noop,
      }),
    );
    /*
      The property that makes this file different from every other page: it
      replaces the root layout, so it must bring its own <html> and <body> and
      may reference no stylesheet — the stylesheet may be the casualty. A class
      attribute appearing here would mean someone "improved" it into depending
      on the thing whose failure it exists to survive.
    */
    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).not.toContain('class="');
    expect(html).toContain("digest: shell9");
    expect(html).toContain("The records are on the server, untouched.");
    expect(html).toContain('href="/dashboard"');
  });
});
