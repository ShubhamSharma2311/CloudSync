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
15. Cloud account connection verification endpoint is implemented with provider-mapped checks and connection status persistence.
16. Scan creation now enforces VERIFIED connection status, blocking invalid/unverified account scans.
17. Resources API vertical is implemented: `GET /api/resources` and `GET /api/resources/:id` with filtering by provider/type/status.
18. Mock Scan Runner is implemented: `POST /api/scans/:id/run` creates a dummy resource + proposal in a transaction for demo walkthrough.
19. CIS rule files are implemented in `backend/src/data/cis/`:
    - `aws.ts` — 79 controls extracted from AWS Security Hub guide (IAM, Account, S3, RDS, EFS, KMS, CloudTrail, EC2, CloudWatch, Config, Lambda).
    - `gcp.ts` — 37 controls (IAM, KMS, Cloud Storage, Cloud SQL, GCE, VPC, Cloud Functions).
    - `azure.ts` — 36 controls (Azure AD, Storage Accounts, SQL, VMs, NSG, Key Vault, Functions).
    - `index.ts` — unified `CIS_RULES[provider][resourceType]` lookup used by the agent at runtime.
20. Retrieval strategy decided: **Hybrid approach** — static rule lookup (`cisRules.ts`) acts as coarse pre-filter by `provider + resourceType`; vector similarity on `security_policies` table will handle semantic precision once DB and embeddings are available.

### Pending to Fully Close Phase 1

1. Create and commit the first migration after stable `DATABASE_URL` is available.
2. Run migration + seed on the target dev database and verify row counts/constraints.
3. Add SQL-level pgvector index strategy in migration files (if not included by generated migration output).

### AWS CIS Rules — Additional Controls Not Yet Added (Future Backlog)

The AWS Security Hub guide (2318 pages) contains many more CIS-tagged controls beyond the 79 currently in `aws.ts`. These are queued for a future expansion pass:

**EC2 (additional):**
- EC2.1 — EBS snapshots should not be publicly restorable
- EC2.3 — Attached EBS volumes should be encrypted at rest
- EC2.4 — Stopped EC2 instances should be removed after allowed number of days
- EC2.9 — EC2 instances should not have a public IPv4 address
- EC2.10 — Amazon EC2 should be configured to use VPC endpoints
- EC2.15 — EC2 subnets should not automatically assign public IP addresses
- EC2.17 — EC2 instances should not use multiple ENIs
- EC2.18 — Security groups should only allow unrestricted incoming traffic for authorized ports
- EC2.19 — Security groups should not allow unrestricted access to high-risk ports
- EC2.20 — Both VPN tunnels for an AWS Site-to-Site VPN connection should be up
- EC2.23 — EC2 Transit Gateways should not automatically accept VPC attachment requests
- EC2.25 — EC2 launch templates should not assign public IPs to network interfaces
- EC2.28 — EBS volumes should be covered by a backup plan
- EC2.51 — EC2 Client VPN endpoints should have client connection logging enabled

**S3 (additional):**
- S3.2 — S3 buckets should prohibit public read access
- S3.3 — S3 buckets should prohibit public write access
- S3.4 — S3 buckets should have server-side encryption enabled
- S3.6 — S3 general purpose bucket policies should restrict access to other AWS accounts
- S3.7 — S3 general purpose buckets should use cross-Region replication
- S3.9 — S3 general purpose buckets should have server access logging enabled
- S3.10 — S3 general purpose buckets with versioning enabled should not be permanently deleted
- S3.11 — S3 general purpose buckets should have event notifications enabled
- S3.13 — S3 general purpose buckets should use lifecycle policies
- S3.14 — S3 general purpose buckets should have versioning enabled

**RDS (additional):**
- RDS.1 — RDS snapshots should be private
- RDS.4 — RDS cluster snapshots and database snapshots should be encrypted at rest
- RDS.6 — Enhanced monitoring should be configured for RDS DB instances
- RDS.7 — RDS clusters should have deletion protection enabled
- RDS.8 — RDS DB instances should have deletion protection enabled
- RDS.9 — RDS DB instances should publish logs to CloudWatch Logs
- RDS.10 — IAM authentication should be configured for RDS instances
- RDS.11 — RDS instances should have automatic backups enabled
- RDS.12 — IAM authentication should be configured for RDS clusters
- RDS.14 — Amazon Aurora clusters should have backtracking enabled
- RDS.16 — RDS DB clusters should be configured to copy tags to snapshots
- RDS.17 — RDS DB instances should be configured to copy tags to snapshots

**Lambda (additional from Security Hub):**
- Lambda.2 (Security Hub) — Lambda functions should use supported runtimes (already added as Lambda.2)
- Lambda.5 (Security Hub) — VPC Lambda functions should operate in multiple Availability Zones

**Networking/VPC (additional):**
- EC2.48 — Amazon VPC should be configured with an interface endpoint for Secrets Manager
- EC2.51 — VPC endpoints should be configured for S3

**GuardDuty:**
- GuardDuty.1 — GuardDuty should be enabled

**SecurityHub:**
- SecurityHub.1 — AWS Security Hub should be enabled for an AWS account

**SNS:**
- SNS.1 — SNS topics should be encrypted at rest using AWS KMS
- SNS.2 — Logging of delivery status should be enabled for notification messages

**SQS:**
- SQS.1 — Amazon SQS queues should be encrypted at rest

**SSM:**
- SSM.1 — EC2 instances should be managed by AWS Systems Manager
- SSM.2 — All EC2 instances managed by Systems Manager should be compliant with patching
- SSM.3 — EC2 instances managed by Systems Manager should have patch compliance status of COMPLIANT

## 5) Phased Build Plan (Schema First, Then Features)

### Phase 1: Schema Foundation ✅ DONE (migration pending DB setup)

- Define enums. ✅
- Build core tables. ✅
- Add foreign keys, unique constraints, immutable audit strategy. ✅
- Add indexes for provider/resource lookup, scan lookup, status filters, proposal expiry/status filters, and vector metadata filters. ✅
- Add seed scaffold for 12-15 demo resources + pre-executed audit trail. ✅

### Phase 2: Clean Architecture Skeleton ✅ DONE

- Create domain-first module structure. ✅
- Service layer, controller layer, route layer with strict ordering. ✅
- Add strict DTO validation and response contracts. ✅

### Phase 3: Cloud Provider Abstraction Layer ⚠️ SIMPLIFIED

- Simple provider verification using metadata field checks (no live SDK calls yet). ✅
- Full SDK integration deferred until DB is live and real credentials can be tested.

### Phase 4: Credential Vault + Connection Verifier ⚠️ PARTIAL

- Connection verifier endpoint done. ✅
- Real AES-256 credential encryption: ❌ pending (schema field exists, no real encryption yet).

### Phase 5: Resource Ingestion + Normalization + Scan Runner ⚠️ PARTIAL

- Mock scan runner done. ✅
- Real resource normalizers: ❌ pending (deferred until SDK integration and DB are live).
- Queue-based scan runner with retries: ❌ pending.
- Socket.io real-time progress events: ❌ pending.

### Phase 6: Policy Corpus + CIS Rules ✅ DONE (static) / ❌ Embeddings Pending

- Static CIS rule files created for AWS (79 rules), GCP (37 rules), Azure (36 rules). ✅
- Unified `CIS_RULES[provider][resourceType]` lookup ready for agent use. ✅
- Hybrid retrieval strategy decided: static pre-filter + pgvector semantic search. ✅
- PDF chunking + embedding pipeline into `security_policies` table: ❌ pending DB setup.

### Phase 7: Agent Core (Gemini) ❌ NOT STARTED — NEXT PRIORITY

**What to build:**
1. Install `@google/generative-ai` npm package.
2. Create `backend/src/services/agentService.ts`:
   - Accept a scan ID.
   - Fetch all resources from that scan.
   - For each resource: look up `CIS_RULES[provider][resourceType]` → get relevant rules.
   - Build a Gemini prompt with resource state + rules.
   - Call `gemini-2.0-flash` with structured JSON output mode.
   - Validate response schema (resource_id, issue, recommendation, severity, confidence_score).
   - Create a proposal record for each finding.
3. Create `backend/src/controllers/agentController.ts`.
4. Create `backend/src/routes/agentRoutes.ts` with `POST /api/agent/analyze/:scanId`.
5. Wire into `backend/src/routes/index.ts`.

**Gemini prompt output schema (strict JSON):**
```json
{
  "resource_id": "string",
  "issue": "string",
  "recommendation": "string",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "confidence_score": 0-100,
  "estimated_monthly_savings_usd": number | null,
  "cis_rule_ids": ["string"]
}
```

### Phase 8: Human-in-the-Loop + Safety Layers ⚠️ PARTIAL

- Proposal approve/reject with expiry check: ✅ done.
- Pre-execution live resource re-fetch: ❌ pending.
- PostgreSQL row lock on approve: ❌ pending.
- MFA gate for high-risk actions: ❌ pending.
- Rule-based pre-filter (protected tags, 30-day idle, $5 threshold): ❌ pending.
- Confidence score gate (< 80 = no execute button): ❌ pending (frontend).

### Phase 9: Code Cost Optimizer ❌ NOT STARTED

- AST-based anti-pattern scanner using `@typescript-eslint/parser`.
- Billing correlation for dollar impact.
- Store findings in `code_proposals` table (non-executable, no MFA gate).

### Phase 10: Database Setup ❌ BLOCKING — DO FIRST

- Set up a free Postgres instance (Neon / Railway / Supabase).
- Enable `pgvector` extension: `CREATE EXTENSION vector;`
- Run `npx prisma migrate dev` against the live DB.
- Run `npx prisma db seed` to populate demo data.
- Verify row counts and constraint behavior.

### Phase 11: Frontend Dashboard ❌ NOT STARTED

- React or Next.js dashboard.
- Cloud accounts list + add account form.
- Scan trigger button + real-time progress log (Socket.io).
- Resource list with severity badges.
- Proposal cards with approve/reject/MFA flow.
- Demo mode toggle.

## 6) Working Rules for Every Implementation Step

1. Read this file before writing code.
2. Implement one phase at a time.
3. Verify each change against all non-negotiable requirements.
4. If a requirement is violated, fix it immediately before moving forward.
5. Keep this file updated with current status after meaningful progress.
6. API implementation order must remain strict: first the payload monitoring/validation, then the middleware if needed, then the controller, followed by route wiring.
7. Keep backend source structure minimal at top level: controllers, routes, services, utils, data.
