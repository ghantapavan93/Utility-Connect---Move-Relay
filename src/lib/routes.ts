import type { Route } from "next";

/**
 * The one place a URL string becomes a typed route.
 *
 * `typedRoutes` verifies string literals at compile time, but a URL built at
 * runtime — `/moves/${id}`, a proof href read from data — is invisible to
 * that check, so every dynamic link needs a cast. The codebase had grown 21
 * of them, and each one was `as never`: a cast that works by claiming the
 * value is *impossible*, which type-checks precisely because anything is
 * assignable from never. A lie that happens to compile, repeated 21 times.
 *
 * `as Route` says what is actually being asserted — "this string is a route
 * this app serves" — and centralising it here means the assertion is made in
 * exactly one greppable place, with its trade-off written down: the compiler
 * cannot verify these, so the browser suite does. Every dynamic route family
 * this function launders (`/moves/:id`, `/future/:slug`, `/industries/:slug`,
 * data-driven proof hrefs) is exercised by a Playwright spec against the real
 * router, which is the only checker these strings can ever have.
 */
export const asRoute = (href: string): Route => href as Route;
