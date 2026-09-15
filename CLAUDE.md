@AGENTS.md

# SuperKuba Agent Orchestration

This repository uses specialized Claude Code project-level subagents, defined in `.claude/agents/`.

Available specialists:

- **cto-architect** — Architecture, major technical decisions and cross-system design.
- **backend-engineer** — APIs, backend services, authentication, authorization and business logic.
- **frontend-engineer** — Dashboard, product UI, responsive UX and frontend/backend integration.
- **database-engineer** — Database schema, migrations, integrity, indexes and production data safety.
- **qa-engineer** — Independent validation, regression testing and production-readiness assessment.
- **security-reviewer** — Security, authorization, tenant isolation and API/tool security.
- **devops-engineer** — Deployment, environments, CI/CD and production operations.
- **ai-agent-engineer** — AI workforce, agent runtime, tools, prompts, memory and orchestration.
- **voice-telephony-engineer** — Voice agents, telephony APIs, realtime calling and call lifecycle.
- **billing-engineer** — Plans, subscriptions, entitlements, checkout and billing lifecycle.

The main Claude session acts as engineering lead.

For substantial work:

1. Inspect the repository and understand the request.
2. Use `cto-architect` for architecture/cross-system decisions.
3. Delegate implementation to the appropriate specialist.
4. Use `database-engineer` when data models/migrations are affected.
5. Use `security-reviewer` for: authentication, authorization, tenant isolation, billing, public APIs, AI tools, webhooks, integrations, sensitive data.
6. Use `ai-agent-engineer` for AI workforce functionality.
7. Use `voice-telephony-engineer` for calling/voice work.
8. Use `billing-engineer` for plans/subscriptions/entitlements.
9. Use `devops-engineer` when production/deployment/environment configuration is involved.
10. Use `qa-engineer` after implementation for independent verification.
11. The main Claude session consolidates findings and determines final completion status.

## Parallelism

Use agents in parallel only when their tasks are independent.

Safe:
- frontend inspection + backend inspection
- security review + QA test planning
- voice provider analysis + UI inspection

Unsafe:
- two agents editing the same API route
- two agents editing the same schema/migration
- multiple agents independently changing the same authentication implementation

Never permit uncontrolled overlapping edits.

## Completion standard

Do not report a SuperKuba feature as complete simply because code was written. Completion requires appropriate validation such as: relevant tests, typecheck, lint, build, API validation, UI validation, security review when relevant, migration validation when relevant, production/deployment review when relevant.

The repository is always the source of truth.
