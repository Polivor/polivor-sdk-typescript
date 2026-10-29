import { createPolivorClient } from "@polivor/sdk";

const client = createPolivorClient({ apiKey: "pv_test_not_a_real_key" });
const result = await client.GET("/v1/keys");
const keys: unknown = result.data;
// @ts-expect-error an unknown path must not type-check
client.GET("/v1/does-not-exist");
const answer = await client.POST("/v1/authorize", { body: {} as never, params: { header: { "Idempotency-Key": "types-only" } } });
const denialCode: "AGENT_NOT_ENABLED" | "OUTSIDE_AUTHORITY" | "APPROVAL_REQUIRED" | "UNAVAILABLE" | "APPROVER_DENIED" | "APPROVAL_EXPIRED" | undefined = answer.data?.denial?.code;
const retryable: boolean | undefined = answer.data?.denial?.retryable;
// @ts-expect-error an agent's answer carries no reasons
answer.data?.reasons;
export { keys, denialCode, retryable };
