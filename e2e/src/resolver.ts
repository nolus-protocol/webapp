import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { buildConnector } from "undici";

export interface HostResolverParse {
  overrides: Map<string, string>;
  errors: string[];
}

export function parseHostResolver(raw: string | undefined): HostResolverParse {
  const overrides = new Map<string, string>();
  const errors: string[] = [];

  const trimmed = raw?.trim();
  if (!trimmed) {
    return { overrides, errors };
  }

  const entries = trimmed.split(",");
  entries.forEach((entry, index) => {
    const position = index + 1;
    const separator = entry.indexOf("=");
    if (separator === -1) {
      errors.push(`pair ${position} is missing "=" (expected host=target)`);
      return;
    }
    const host = entry.slice(0, separator).trim();
    const target = entry.slice(separator + 1).trim();
    if (host.length === 0) {
      errors.push(`pair ${position} has an empty host`);
      return;
    }
    if (target.length === 0) {
      errors.push(`pair ${position} has an empty target`);
      return;
    }
    overrides.set(host, target);
  });

  return { overrides, errors };
}

export function createLookup(overrides: Map<string, string>): LookupFunction {
  return (hostname, options, callback) => {
    const target = overrides.get(hostname) ?? hostname;
    dnsLookup(target, options, callback);
  };
}

export function buildHostResolverRules(overrides: Map<string, string>): string {
  return [...overrides].map(([host, target]) => `MAP ${host} ${target}`).join(", ");
}

export function createUndiciConnector(overrides: Map<string, string>): buildConnector.connector {
  const base = buildConnector({});
  return (options, callback) => {
    const target = overrides.get(options.hostname);
    if (target === undefined) {
      base(options, callback);
      return;
    }
    base({ ...options, hostname: target }, callback);
  };
}
