import { createPolivorClient } from "@polivor/sdk";

const client = createPolivorClient({ apiKey: "pv_test_not_a_real_key" });
const result = await client.GET("/v1/keys");
const keys: unknown = result.data;
// @ts-expect-error an unknown path must not type-check
client.GET("/v1/does-not-exist");
export { keys };
