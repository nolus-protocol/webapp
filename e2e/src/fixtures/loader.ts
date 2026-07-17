/**
 * Disk access for the fixture set. Pure Node (no Playwright), so it is unit-tested and
 * counted under coverage. Resolves the repo-root `fixtures/` directory relative to this
 * file — the e2e package is a sibling of `fixtures/`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_ROUTES, resolveFixtureRoute } from "./registry.js";
import type { FixtureRoute } from "./registry.js";

/** `<repo-root>/fixtures` (this file lives at `<repo-root>/e2e/src/fixtures/loader.ts`). */
export function fixturesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "fixtures");
}

export function schemasDir(): string {
  return join(fixturesDir(), "schemas");
}

export function fixturePath(file: string): string {
  return join(fixturesDir(), file);
}

export function readFixture(file: string): unknown {
  return JSON.parse(readFileSync(fixturePath(file), "utf8"));
}

export function readSchema(name: string): object {
  return JSON.parse(readFileSync(join(schemasDir(), `${name}.json`), "utf8")) as object;
}

/** The fixture entry whose pattern matches a request pathname, if any. */
export function fixtureForPath(pathname: string): FixtureRoute | undefined {
  return resolveFixtureRoute(pathname);
}

/** Every fixture route paired with its parsed body — for the "all fixtures parse" test. */
export function loadAllFixtures(): { route: FixtureRoute; body: unknown }[] {
  return FIXTURE_ROUTES.map((route) => ({ route, body: readFixture(route.file) }));
}
