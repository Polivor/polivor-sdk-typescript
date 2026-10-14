import { test } from "node:test";
import assert from "node:assert/strict";
import { createPolivorClient, PRODUCTION_BASE_URL } from "../dist/index.js";

function recordingFetch(responseBody) {
  const calls = [];
  const fetchStub = async (request) => {
    calls.push(request);
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchStub };
}

test("sends the API key as a bearer token to the production host by default", async () => {
  const { calls, fetchStub } = recordingFetch([]);
  const client = createPolivorClient({ apiKey: "pv_test_abc_secret", fetch: fetchStub });
  await client.GET("/v1/keys");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get("authorization"), "Bearer pv_test_abc_secret");
  assert.ok(calls[0].url.startsWith(PRODUCTION_BASE_URL));
});

test("posts a JSON body to the authorize endpoint", async () => {
  const { calls, fetchStub } = recordingFetch({ decision: "ALLOW" });
  const client = createPolivorClient({ apiKey: "pv_test_abc_secret", baseUrl: "https://example.test", fetch: fetchStub });
  await client.POST("/v1/authorize", { body: {}, params: { header: { "Idempotency-Key": "k-1" } } });
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://example.test/v1/authorize");
  assert.equal(calls[0].headers.get("idempotency-key"), "k-1");
});

import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { verifyAuthorization, API_KEY_ENVIRONMENT_VARIABLE, AUTHORIZATION_TOKEN_TYPE } from "../dist/index.js";

test("reads the API key from the environment when none is passed", async () => {
  const { calls, fetchStub } = recordingFetch([]);
  process.env[API_KEY_ENVIRONMENT_VARIABLE] = "pv_test_env_secret";
  try {
    await createPolivorClient({ fetch: fetchStub }).GET("/v1/keys");
  } finally {
    delete process.env[API_KEY_ENVIRONMENT_VARIABLE];
  }
  assert.equal(calls[0].headers.get("authorization"), "Bearer pv_test_env_secret");
});

test("refuses to build a client without any API key", () => {
  delete process.env[API_KEY_ENVIRONMENT_VARIABLE];
  assert.throws(() => createPolivorClient(), /API key missing/);
});

async function signedToken({ typ = AUTHORIZATION_TOKEN_TYPE, audience = "hub", lifetime = "5m" } = {}) {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: "authz-1", alg: "EdDSA" };
  const token = await new SignJWT({ action_sha256: "abc" })
    .setProtectedHeader({ alg: "EdDSA", typ, kid: "authz-1" })
    .setAudience(audience).setIssuedAt().setExpirationTime(lifetime).sign(privateKey);
  return { token, keySet: createLocalJWKSet({ keys: [jwk] }) };
}

test("accepts a valid authorization and returns its claims", async () => {
  const { token, keySet } = await signedToken();
  const claims = await verifyAuthorization(token, { audience: "hub", keySet });
  assert.equal(claims.action_sha256, "abc");
});

test("rejects a wrong audience, a wrong token type, an expired token and a changed claim", async () => {
  const wrongAudience = await signedToken({ audience: "other" });
  await assert.rejects(verifyAuthorization(wrongAudience.token, { audience: "hub", keySet: wrongAudience.keySet }));
  const wrongType = await signedToken({ typ: "polivor-evidence+jwt" });
  await assert.rejects(verifyAuthorization(wrongType.token, { audience: "hub", keySet: wrongType.keySet }));
  const expired = await signedToken({ lifetime: "-1m" });
  await assert.rejects(verifyAuthorization(expired.token, { audience: "hub", keySet: expired.keySet }));
  const valid = await signedToken();
  const [header, , signature] = valid.token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ action_sha256: "evil", aud: "hub" })).toString("base64url");
  await assert.rejects(verifyAuthorization(`${header}.${forgedPayload}.${signature}`, { audience: "hub", keySet: valid.keySet }));
});
