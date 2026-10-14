import createClient from "openapi-fetch";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { paths } from "./schema.js";

export type { paths, components, operations } from "./schema.js";

export const PRODUCTION_BASE_URL = "https://api.polivor.com";
export const STAGING_BASE_URL = "https://api.staging.polivor.com";
export const API_KEY_ENVIRONMENT_VARIABLE = "POLIVOR_API_KEY";
export const AUTHORIZATION_TOKEN_TYPE = "polivor-authz+jwt";
export const AUTHORIZATION_SIGNING_ALGORITHM = "EdDSA";
export const JWKS_PATH = "/.well-known/jwks.json";

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
}

/** Checks signature, algorithm, token type, audience and expiry of an authorization artifact with Polivor's public keys; needs no API key. */
export async function verifyAuthorization(token: string, options: VerifyAuthorizationOptions): Promise<JWTPayload> {
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(JWKS_PATH, options.baseUrl ?? PRODUCTION_BASE_URL));
  const { payload } = await jwtVerify(token, keySet, {
    algorithms: [AUTHORIZATION_SIGNING_ALGORITHM],
    typ: AUTHORIZATION_TOKEN_TYPE,
    audience: options.audience,
  });
  return payload;
}
