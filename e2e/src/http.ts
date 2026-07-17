import { request } from "undici";
import type { Dispatcher } from "undici";

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HEADERS_TIMEOUT_MS = 15_000;
const BODY_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5_000_000;
const ERROR_BODY_PREVIEW_LENGTH = 200;

async function readCappedText(method: string, url: string, body: Dispatcher.ResponseData["body"]): Promise<string> {
  // Sanctioned assertion: a Node Readable's async iterator is typed as yielding `any`;
  // undici streams Buffer chunks here, so narrowing the iterable lets us bound total
  // bytes without an unchecked `any` binding per chunk.
  const stream = body as AsyncIterable<Buffer>;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > MAX_RESPONSE_BYTES) {
      throw new Error(`${method} ${url} response body exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function getJson(url: string, dispatcher: Dispatcher | undefined): Promise<unknown> {
  const response = await request(url, {
    method: "GET",
    headers: { accept: "application/json" },
    headersTimeout: HEADERS_TIMEOUT_MS,
    bodyTimeout: BODY_TIMEOUT_MS,
    ...(dispatcher ? { dispatcher } : {})
  });

  const body = await readCappedText("GET", url, response.body);

  if (response.statusCode < HTTP_OK_MIN || response.statusCode > HTTP_OK_MAX) {
    throw new Error(`GET ${url} returned HTTP ${response.statusCode}: ${body.slice(0, ERROR_BODY_PREVIEW_LENGTH)}`);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`GET ${url} returned a non-JSON body`);
  }
}

export async function postJson(url: string, payload: unknown, dispatcher: Dispatcher | undefined): Promise<unknown> {
  const response = await request(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(payload),
    headersTimeout: HEADERS_TIMEOUT_MS,
    bodyTimeout: BODY_TIMEOUT_MS,
    ...(dispatcher ? { dispatcher } : {})
  });

  const body = await readCappedText("POST", url, response.body);

  if (response.statusCode < HTTP_OK_MIN || response.statusCode > HTTP_OK_MAX) {
    throw new Error(`POST ${url} returned HTTP ${response.statusCode}: ${body.slice(0, ERROR_BODY_PREVIEW_LENGTH)}`);
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`POST ${url} returned a non-JSON body`);
  }
}
