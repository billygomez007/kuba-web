# Staging-only tests

Tests in this directory are intentionally **excluded** from `npm test`
(the root glob `tests/*.test.mjs` does not recurse into subdirectories).

They differ from every other test in this repository:

- They call the real OpenAI API through the real research-only agent
  (`mastra/agents/outreach-researcher.ts`), with real web search and real
  page fetches against the live internet. They cost real tokens/dollars.
- They write to the **real staging Turso database** (the same
  `Realtegic` / `Kuba Outreach` business used for prior manual staging
  validation), not a disposable local SQLite file.
- Because they depend on live model behavior against real, sometimes
  intentionally obscure or ambiguous real-world businesses, they are not
  fully deterministic run to run.

Run them explicitly and deliberately:

```
npm run test:outreach-adversarial-staging
```

Do not add this directory to the default `npm test` glob. Regular
CI/local test runs must stay fast, free, deterministic, and untied to a
live external database.
