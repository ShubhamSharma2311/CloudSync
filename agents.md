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
10. Phase 2 backend structure has started with only these folders under src: controllers, routes, services, utils.
11. First API vertical is implemented for cloud account onboarding/listing with strict layering.
12. Express app bootstrap, centralized error handling, validation middleware, and request context middleware are in place.
13. Second API vertical is implemented for scan creation/listing with the same strict layering flow.
14. Third API vertical is implemented for proposal listing and approve/reject decisions with expiry/state checks and audit logging.

### Pending to Fully Close Phase 1

1. Create and commit the first migration after stable `DATABASE_URL` is available.
2. Run migration + seed on the target dev database and verify row counts/constraints.
3. Add SQL-level pgvector index strategy in migration files (if not included by generated migration output).

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

### Phase 7: Agent Core (Gemini)

- Build Compute/Identity/Storage orchestration.
- Strict JSON output + schema validation.
- Confidence scoring.
- Remediation proposal generation with estimated savings.

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
6. API implementation order must remain strict: payload validation first, then middleware, then controller, then route wiring.
7. Keep backend source structure minimal at top level: controllers, routes, services, utils.
