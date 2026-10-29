import createClient from "openapi-fetch";
import { errors, importJWK, jwtVerify, type JWK, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { paths } from "./schema.js";

export type { paths, components, operations } from "./schema.js";

export const PRODUCTION_BASE_URL = "https://api.polivor.com";
export const STAGING_BASE_URL = "https://api.staging.polivor.com";
export const API_KEY_ENVIRONMENT_VARIABLE = "POLIVOR_API_KEY";
export const AUTHORIZATION_TOKEN_TYPE = "polivor-authz+jwt";
export const AUTHORIZATION_SIGNING_ALGORITHM = "EdDSA";
export const JWKS_PATH = "/.well-known/jwks.json";
export const AUTHORIZATION_KEY_USE = "authz";
const AUTHORIZATION_KEY_CURVE = "Ed25519";
const KEY_SET_REFRESH_COOLDOWN_MS = 30_000;

export interface PolivorClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export function createPolivorClient(options: PolivorClientOptions = {}) {
  const apiKey = options.apiKey ?? process.env[API_KEY_ENVIRONMENT_VARIABLE];
  if (!apiKey) {
    throw new Error(`Polivor API key missing: pass apiKey or set ${API_KEY_ENVIRONMENT_VARIABLE}`);
  }
  return createClient<paths>({
    baseUrl: options.baseUrl ?? PRODUCTION_BASE_URL,
    headers: { Authorization: `Bearer ${apiKey}` },
    fetch: options.fetch,
  });
}

export interface VerifyAuthorizationOptions {
  audience: string;
  baseUrl?: string;
  keySet?: JWTVerifyGetKey;
  fetch?: typeof globalThis.fetch;
}

/**
 * Polivor labels its keys `use: "authz"` and `use: "evidence"`, not the standard `sig`, so the key sets of the standard libraries skip every one of them.
 * This one picks the key by its id and by that use, and fetches the set again (at most every 30 seconds) only when an id is unknown. Create it once and pass it as `keySet` to keep the cache.
 */
export function authorizationKeySet(baseUrl: string = PRODUCTION_BASE_URL, fetcher: typeof globalThis.fetch = globalThis.fetch): JWTVerifyGetKey {
  let keys: JWK[] = [];
  let fetchedAt = 0;
  const find = (keyId?: string) => keys.find((key) => key.kid === keyId && key.use === AUTHORIZATION_KEY_USE && key.crv === AUTHORIZATION_KEY_CURVE);
  async function refresh() {
    const response = await fetcher(new URL(JWKS_PATH, baseUrl));
    if (!response.ok) throw new Error(`Polivor key set unavailable: HTTP ${response.status}`);
    keys = ((await response.json()) as { keys: JWK[] }).keys;
    fetchedAt = Date.now();
  }
  return async (header) => {
    if (!find(header.kid) && Date.now() - fetchedAt >= KEY_SET_REFRESH_COOLDOWN_MS) await refresh();
    const key = find(header.kid);
    if (!key) throw new errors.JWKSNoMatchingKey();
    return importJWK({ kty: key.kty, crv: key.crv, x: key.x }, AUTHORIZATION_SIGNING_ALGORITHM);
  };
}

/** Checks signature, algorithm, token type, audience and expiry of an authorization artifact with Polivor's public keys; needs no API key. */
export async function verifyAuthorization(token: string, options: VerifyAuthorizationOptions): Promise<JWTPayload> {
  const keySet = options.keySet ?? authorizationKeySet(options.baseUrl ?? PRODUCTION_BASE_URL, options.fetch);
  const { payload } = await jwtVerify(token, keySet, {
    algorithms: [AUTHORIZATION_SIGNING_ALGORITHM],
    typ: AUTHORIZATION_TOKEN_TYPE,
    audience: options.audience,
  });
  return payload;
}
