import { request } from "undici";
import type { Dispatcher } from "undici";

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

export async function getJson(url: string, dispatcher: Dispatcher | undefined): Promise<unknown> {
  const response = await request(url, {
    method: "GET",
    headers: { accept: "application/json" },
    ...(dispatcher ? { dispatcher } : {})
  });

  const body = await response.body.text();

  if (response.statusCode < HTTP_OK_MIN || response.statusCode > HTTP_OK_MAX) {
    throw new Error(`GET ${url} returned HTTP ${response.statusCode}: ${body.slice(0, 200)}`);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`GET ${url} returned a non-JSON body`);
  }
}
