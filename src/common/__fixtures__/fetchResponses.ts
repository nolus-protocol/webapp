/**
 * Shared fetch Response fixtures for tests.
 *
 * NOTE: These helpers build minimal `Response`-shaped objects with only the
 * fields BackendApi actually touches (ok, status, json, text, headers). The
 * full Response interface is large, so `as unknown as Response` is an
 * intentional narrowing escape hatch in this file. Production code should
 * never do this — it's confined to test fixtures.
 */

export const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" })
  }) as unknown as Response;

export const emptyResponse = (status = 204): Response =>
  ({
    ok: true,
    status,
    json: async () => {
      throw new Error("no body");
    },
    text: async () => "",
    headers: new Headers()
  }) as unknown as Response;

export const malformedErrorResponse = (status = 500): Response =>
  ({
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError("bad json");
    },
    text: async () => "<html>500</html>",
    headers: new Headers()
  }) as unknown as Response;
