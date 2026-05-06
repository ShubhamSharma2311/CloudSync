# CloudSync Agent Build Plan Reference

This file is the canonical implementation reference for the project. Before building any functionality, validate all changes against this file.

## 1) Product Goals and Scope

- Build an agentic system that monitors cloud platforms, minimizes cost, and suggests best practices.
- Primary providers: AWS, GCP, and Azure.
- Backend AI brain: Gemini (via Gemini API key integration).
- System behavior: detect risks/waste, generate proposals, and only execute infrastructure actions after explicit human approval.

## 2) Non-Negotiable Engineering Requirements

These were explicitly discussed and must hold across the entire codebase:

1. Code must be readable, maintainable, and human-friendly; folder structure must remain clean and intentional.
2. Follow SOLID and clean architecture principles.
3. Optimize implementation choices for time and space complexity.
4. Avoid N+1 database calls and design query paths for efficient retrieval.
5. Avoid long if/else chains; prefer mapping/strategy-driven dispatch.
6. Use performant data structures (Map/Set over arrays where lookup-heavy).
7. Do not store secrets in plaintext; encrypted-at-rest credential handling is mandatory.
8. Keep audit logs immutable and traceable.
9. Use strict validation for input/output contracts and agent JSON schemas.
10. If code violates any requirement above, it is considered incomplete and must be corrected.

## 2A) Confirmed Stack Decisions (locked on 2026-04-22)

| Layer | Choice | Notes |
|---|---|---|
| HTTP framework | Express 5 | Already in `backend/package.json`; not swapping to Fastify. |
| Validation | zod | Env, DTOs, agent JSON — one validator everywhere. |
| Test runner | Jest | With `ts-jest` for TS, coverage via `--coverage`. |
| Logger | pino | Structured JSON logs; secret-shaped fields redacted. |
| LLM provider | Anthropic Claude | Via `ANTHROPIC_API_KEY`. Default model `claude-sonnet-4-6` for per-resource agent calls; `claude-opus-4-7` reserved for high-stakes proposals (destructive remediation, MFA-gated actions). Canonical per this file; overrides any mention of OpenAI or Gemini in earlier drafts. |
| Agent orchestration | LangGraph (TypeScript) | Sub-agents per resource cluster (Compute / Identity / Storage). LangGraph nodes call Claude via `@anthropic-ai/sdk`. |
| Embedding provider | Deferred — no embeddings populated in Phase 6 | When/if accuracy gap forces RAG, evaluate Voyage AI (Anthropic-recommended) or OpenAI text-embedding-3-small. Schema column stays nullable. |
| Database | PostgreSQL + Prisma + pgvector | Schema already scaffolded. |
| Queue (Phase 5) | pg-boss (tentative) | Chosen to avoid adding Redis; may revisit. |
| Frontend | React + TypeScript + Tailwind | Not yet started. |

**Embedding column:** `SecurityPolicy.embedding` stays `vector(1536)?` for now and remains NULL. Phase 6 ships a categorical lookup (`provider + resourceType + severity` SQL filter) instead of vector retrieval. Decision to populate / re-dim is deferred until measurable accuracy regression is observed in agent scans (see 2026-05-06 change log entry).

## 3) Functional and Safety Requirements

1. Multi-cloud support must remain provider-agnostic in orchestration logic.
2. Cloud provider integration must be behind abstraction interfaces.
3. Human-in-the-loop workflow must gate remediation execution.
4. High-risk actions must require MFA.
5. Proposals must expire (stale actions blocked).
6. Pre-execution live state re-check + row lock required for safety.
7. Protected tags/filters must prevent unsafe low-value or sensitive actions.
8. Demo mode with realistic seeded data must support full recruiter walkthrough.

## 4) Current Implementation Status (Updated)

### Completed So Far

1. Phase 1 schema foundation is implemented in `backend/prisma/schema.prisma`.
2. Core enums are defined: CloudProvider, ResourceType, ResourceStatus, ScanTrigger, ProposalStatus, Severity, ConnectionStatus, CostCategory.
3. Core models are implemented: cloud_accounts, scans, resources, proposals, code_proposals, audit_logs, security_policies.
4. Relations, unique constraints, and major performance indexes are implemented.
5. JSON/metadata flexibility fields are present where needed.
6. Seed scaffold is implemented in `backend/prisma/seed.ts` with demo-oriented dataset and audit trail records.
7. Prisma seed/build scripts are configured in `backend/package.json`.
8. Prisma client generation is aligned to best practice package output (`prisma-client-js`).
9. Seed script is aligned to Prisma docs style (dotenv + pg pool + Prisma adapter + clean disconnect).

### Pending to Fully Close Phase 1

1. Create and commit the first migration after stable `DATABASE_URL` is available.
2. Run migration + seed on the target dev database and verify row counts/constraints.
3. Add SQL-level pgvector index strategy in migration files (if not included by generated migration output).
4. Reconcile `vector(1536)` → `vector(768)` for Gemini `text-embedding-004` (flagged in §2A).

### Phase 2 Progress

1. ✅ Confirmed stack (§2A) and canonical folder layout (§8).
2. ✅ `backend/src/config/env.ts` — `loadConfig()` with zod-validated env + boot-time fail-fast + cached frozen result.
3. ✅ `backend/.env.example` — documents every env key the loader validates.
4. ⏳ `backend/src/utils/logger.ts` — pino logger with credential-field redaction (next).
5. ⏳ `backend/src/utils/errors.ts` — typed error hierarchy.
6. ⏳ `backend/src/db/prisma.ts` — Prisma client singleton.
7. ⏳ `backend/src/server.ts` + `backend/src/index.ts` — Express app wiring and boot entrypoint.
8. ⏳ Jest scaffolding with one smoke test per utility.

## 5) Phased Build Plan (Schema First, Then Features)

### Phase 1: Schema Foundation

- Define enums.
- Build core tables.
- Add foreign keys, unique constraints, immutable audit strategy.
- Add indexes for provider/resource lookup, scan lookup, status filters, proposal expiry/status filters, and vector metadata filters.
- Add seed scaffold for 12-15 demo resources + pre-executed audit trail.

### Phase 2: Clean Architecture Skeleton

- Create domain-first module structure.
- Add repository interfaces, service layer, mapper layer.
- Keep provider-independent domain models centralized.
- Isolate provider SDK logic in adapters.
- Add strict DTO validation and response contracts.

### Phase 3: Cloud Provider Abstraction Layer

- Create CloudProvider interface + factory using mapping-based dispatch.
- Implement AWS/GCP/Azure provider skeleton methods.
- Normalize provider outputs to a unified resource contract.

### Phase 4: Credential Vault + Connection Verifier

- Encrypted credential storage.
- Provider-specific credential verification during onboarding.
- Persist connection status and block scans on invalid credentials.

### Phase 5: Resource Ingestion + Normalization + Scan Runner

- Provider/resource normalizers as pure functions.
- Queue-based scan runner with retries and exponential backoff.
- Persist raw + normalized data with scan metadata.
- Emit real-time progress events.

### Phase 6: Policy Corpus + RAG Readiness

- Ingest policy corpus, chunk, embed, and store with provider tags.
- Provider-scoped retrieval endpoint.

### Phase 7: Agent Core (Claude via @anthropic-ai/sdk + LangGraph)

- Build Compute/Identity/Storage orchestration as LangGraph sub-agents.
- Each sub-agent issues a Claude `messages.create` call with strict JSON tool-use schema for the proposal output.
- Use prompt caching for the static system prompt + rule corpus passages — reduces per-resource cost ~80%.
- Default model `claude-sonnet-4-6`; escalate to `claude-opus-4-7` only for proposals tagged destructive or MFA-gated.
- Confidence scoring (0-100) returned in the structured output.
- Remediation proposal includes Terraform/CLI snippet + estimated_savings_usd.

### Phase 8: Human-in-the-Loop + Safety Layers

- Approval workflow.
- Expiry + pre-execution re-fetch + row locking.
- Immutable audit trail.
- MFA gate for destructive actions.

### Phase 9: Code Cost Optimizer

- AST-based anti-pattern scanner.
- Billing correlation for dollar impact.
- Store findings in code_proposals (non-executable workflow).

### Phase 10: Hardening and Quality Gates

- Tests for normalizers, repositories, adapters, safety logic.
- Query/performance checks.
- Maintainability checks with strategy/mapping patterns and Map/Set where appropriate.

## 6) Working Rules for Every Implementation Step

1. Read this file before writing code.
2. Implement one phase at a time.
3. Verify each change against all non-negotiable requirements.
4. If a requirement is violated, fix it immediately before moving forward.
5. Keep this file updated with current status after meaningful progress.
6. **Per-function review gate (added 2026-04-22).** After writing each individual *function* (not each file, not each phase), STOP and present a review block containing:
   1. Purpose — one-sentence description.
   2. Why this design — which non-negotiable requirement(s) it satisfies; alternatives considered.
   3. How it works — step-by-step mechanism.
   4. Time complexity — in Big-O, with what `n` represents.
   5. Space complexity — in Big-O, with what `n` represents.
   6. Failure modes / edge cases handled.

   Do not proceed to the next function until the user explicitly approves. Trivial re-exports may be bundled, but anything with logic gets its own review. This rule applies to every phase going forward.

## 7) Change Log (append-only, most recent first)

- **2026-05-06** — Stack pivot: agent LLM switched from Google Gemini to Anthropic Claude (default `claude-sonnet-4-6` for per-resource calls, `claude-opus-4-7` for destructive-action proposals). `ANTHROPIC_API_KEY` replaces `GEMINI_API_KEY` in env loader. Embedding generation deferred entirely — no vector population in Phase 6; categorical SQL retrieval instead. CIS rule index expanded from ~170 hand-curated rules to 240 extracted from official PDFs (AWS 65 / GCP 83 / Azure 92). Added `utils/logger.ts` (pino with secret redaction) and `utils/errors.ts` (typed AppError hierarchy). Wired pino into Express error handler.
- **2026-04-22** — Implemented `loadConfig()` in `backend/src/config/env.ts` + `.env.example`. Installed `typescript` as devDependency. Typecheck passes for the new file (pre-existing seed errors deferred to migration step).
- **2026-04-22** — Adopted flat Express folder layout (see §8). Dropped hexagonal/DDD scaffolding. zod lives next to what it validates: env in `config/`, DTOs in `services/`, agent JSON in `agent/`.
- **2026-04-22** — Confirmed stack decisions (§2A added). Instituted per-function review gate (§6.6). Flagged `vector(1536)` vs Gemini 768-dim mismatch for migration step. Phase 2 (Clean Architecture Skeleton) kicked off.

## 8) Canonical Backend Folder Layout

```
backend/
├── prisma/                 # schema, migrations, seed
├── src/
│   ├── config/             # env.ts — validated env only
│   ├── routes/             # express routers, one file per domain
│   ├── controllers/        # thin request handlers
│   ├── services/           # business logic + zod DTO schemas
│   ├── middleware/         # error handler, auth, mfa-gate
│   ├── providers/          # base.ts, aws.ts, gcp.ts, azure.ts, index.ts (factory)
│   ├── agent/              # LangGraph graph + agent-output zod schemas
│   ├── db/                 # prisma client + repositories
│   ├── utils/              # logger, crypto, errors
│   ├── server.ts           # express wiring
│   └── index.ts            # boot entrypoint
```

Rules:
- Folder name = what the folder contains. No abstract DDD terminology.
- zod schemas live next to the code that consumes them — not in a central validators folder.
- Cross-provider logic never imports from `providers/aws|gcp|azure` directly; it goes through `providers/index.ts` factory + `providers/base.ts` interface (satisfies §3.1, §3.2).
- `db/` owns the Prisma client singleton and repositories; services never `new PrismaClient()` themselves.
