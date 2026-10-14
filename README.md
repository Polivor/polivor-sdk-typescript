# @polivor/sdk

[![ci](https://github.com/Polivor/polivor-sdk-typescript/actions/workflows/ci.yml/badge.svg)](https://github.com/Polivor/polivor-sdk-typescript/actions/workflows/ci.yml) [![license](https://img.shields.io/github/license/Polivor/polivor-sdk-typescript)](LICENSE)

TypeScript client for the Polivor API, generated from its OpenAPI file. The package holds no keys or secrets: you bring your own API key.

```ts
import { createPolivorClient, verifyAuthorization } from "@polivor/sdk";

const client = createPolivorClient({ apiKey: process.env.POLIVOR_API_KEY }); // or omit apiKey: POLIVOR_API_KEY is read
const { data } = await client.POST("/v1/authorize", { body, params: { header: { "Idempotency-Key": key } } });

// Enforcement point: no API key needed, only Polivor's public keys.
const claims = await verifyAuthorization(data.authorization.jws, { audience: "your-enforcement-point" });
```

- Keys have a role: `agent` (ask for authority), `enforcer` (report execution), `admin` (manage). Give each component only its own role, and never put an `admin` key in browser or mobile code.
- Keys starting with `pv_test_` are sandbox keys. Polivor decides and records; it never moves money.
- Base URLs: `PRODUCTION_BASE_URL`, `STAGING_BASE_URL`; pass `baseUrl` to choose.

## Development

`openapi/polivor.yaml` is a copy of the published API description. A scheduled workflow refreshes it and opens a pull request when it changes. Generated code is never edited by hand.

## License

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
