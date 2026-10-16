# Atlas runtime loading

The deployed custom atlas intermittently returned `500 FUNCTION_INVOCATION_FAILED`, which the previous frontend misidentified as a missing map server. The old function decrypted, decompressed and parsed the whole 238 MiB editorial JSON on every cold start, even to return only the opening overview. A local measurement reached approximately 1.8 GB RSS. The same function could sometimes succeed once warm, making retry behavior misleading.

The production loader now reads independently encrypted sections from `server/atlas-runtime/`. The overview, search directory, analysis, demographics and other top-level records each have their own section. District, division, region, tehsil and province geometry is stored in the existing 20-feature API pages. The runtime index carries collection metadata and counts. Each request decrypts only the necessary sections, with an 8 MiB serialized-data budget for the completed-value LRU cache. Offset pagination still supports arbitrary nonnegative integers, including offsets crossing stored page boundaries. Invalid ownership, origin, method and pagination checks remain in place.

All 502 sections use the existing AES-256-GCM key and `UAT1` encoding. The original encrypted archive remains unchanged as the editorial/CLI input and is excluded from the deployed function bundle. `vercel.json` explicitly includes the runtime directory. Production refuses to load the monolith if the runtime index is missing; old local deployment fixtures can still use their small legacy archive. The runtime directory is blocked from direct Vite requests and is never copied into the public static build. API responses remain private/no-store.

The sections are committed encrypted artifacts, so deploying does not need a new build-time credential or external storage service. The existing server `PRIVATE_ATLAS_DATA_KEY` remains required. `prebuild:vercel` verifies their source archive SHA-256 and every file size, preventing a stale or incomplete runtime from being deployed. `scripts/pack-private-atlas.mjs` also regenerates the sections after publishing a new archive. For an existing archive, run:

```sh
npm run data:atlas-runtime
npm run check:atlas-runtime
npm run check:private-atlas
npm run build:vercel
```

`check:atlas-runtime` independently compares every decoded section and all 494 geometry pages against the original archive. It then creates an isolated production-style function directory containing only the handler, store and runtime sections, with no monolithic archive. A child Node process with a 128 MiB heap opens all 43 province outlines, pages all 193 Punjab tehsils, verifies unaligned/end pagination, demographic totals, aliases, origin restrictions, method validation and missing-key diagnostics. The initial measured run used about 212 MiB peak RSS and returned the cold overview in 566 ms; timing and memory vary by host. All administrative identifiers, geometries, names, ownership and statistics are unchanged.

For non-JSON server failures the frontend now reports the actual HTTP server failure, rather than incorrectly directing deployed users to a different application. Successful HTML responses still identify a missing/misrouted API deployment.
