-- CreateEnum
CREATE TYPE "CloudProvider" AS ENUM ('AWS', 'GCP', 'AZURE');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('COMPUTE', 'STORAGE', 'IDENTITY', 'SERVERLESS');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('HEALTHY', 'ZOMBIE', 'BREACH', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ScanTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'EVENT_WEBHOOK', 'DEMO');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('UNKNOWN', 'VERIFIED', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "cloud_accounts" (
    "id" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "region" TEXT,
    "credentials_ciphertext" BYTEA NOT NULL,
    "credentials_metadata" JSONB,
    "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "cloud_account_id" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "trigger" "ScanTrigger" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "issues_found" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "cloud_account_id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "provider_resource_id" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'HEALTHY',
    "cost_monthly" DECIMAL(12,2),
    "last_seen_active" TIMESTAMP(3),
    "raw_metadata" JSONB NOT NULL,
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "cloud_account_id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "issue_type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB,
    "remediation_code" TEXT NOT NULL,
    "estimated_savings_usd" DECIMAL(12,2),
    "confidence_score" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "execution_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_proposals" (
    "id" UUID NOT NULL,
    "scan_id" UUID,
    "cloud_account_id" UUID,
    "file_path" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "cost_category" "CostCategory" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "billing_correlation_usd" DECIMAL(12,2),
    "evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "proposal_id" UUID,
    "resource_id" UUID,
    "scan_id" UUID,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "details" JSONB,
    "pre_state" JSONB,
    "post_state" JSONB,
    "previous_entry_hash" TEXT,
    "entry_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_policies" (
    "id" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "policy_source" TEXT NOT NULL,
    "document_version" TEXT,
    "rule_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "severity" "Severity",
    "metadata" JSONB,
    "embedding" vector(1536),
    "chunk_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cloud_accounts_provider_connection_status_idx" ON "cloud_accounts"("provider", "connection_status");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_accounts_provider_external_account_id_key" ON "cloud_accounts"("provider", "external_account_id");

-- CreateIndex
CREATE INDEX "scans_cloud_account_id_started_at_idx" ON "scans"("cloud_account_id", "started_at");

-- CreateIndex
CREATE INDEX "scans_provider_started_at_idx" ON "scans"("provider", "started_at");

-- CreateIndex
CREATE INDEX "resources_provider_provider_resource_id_idx" ON "resources"("provider", "provider_resource_id");

-- CreateIndex
CREATE INDEX "resources_scan_id_idx" ON "resources"("scan_id");

-- CreateIndex
CREATE INDEX "resources_status_provider_idx" ON "resources"("status", "provider");

-- CreateIndex
CREATE INDEX "resources_cloud_account_id_status_idx" ON "resources"("cloud_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "resources_cloud_account_id_provider_provider_resource_id_key" ON "resources"("cloud_account_id", "provider", "provider_resource_id");

-- CreateIndex
CREATE INDEX "proposals_scan_id_idx" ON "proposals"("scan_id");

-- CreateIndex
CREATE INDEX "proposals_resource_id_status_idx" ON "proposals"("resource_id", "status");

-- CreateIndex
CREATE INDEX "proposals_status_expires_at_idx" ON "proposals"("status", "expires_at");

-- CreateIndex
CREATE INDEX "proposals_cloud_account_id_status_idx" ON "proposals"("cloud_account_id", "status");

-- CreateIndex
CREATE INDEX "code_proposals_status_cost_category_idx" ON "code_proposals"("status", "cost_category");

-- CreateIndex
CREATE INDEX "code_proposals_file_path_idx" ON "code_proposals"("file_path");

-- CreateIndex
CREATE INDEX "code_proposals_scan_id_idx" ON "code_proposals"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "code_proposals_scan_id_file_path_line_number_pattern_key" ON "code_proposals"("scan_id", "file_path", "line_number", "pattern");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_entry_hash_key" ON "audit_logs"("entry_hash");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_proposal_id_idx" ON "audit_logs"("proposal_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_id_idx" ON "audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_scan_id_idx" ON "audit_logs"("scan_id");

-- CreateIndex
CREATE INDEX "secpol_provider_source_idx" ON "security_policies"("provider", "policy_source");

-- CreateIndex
CREATE INDEX "security_policies_provider_rule_id_idx" ON "security_policies"("provider", "rule_id");

-- CreateIndex
CREATE INDEX "security_policies_provider_severity_idx" ON "security_policies"("provider", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "secpol_provider_source_rule_chunk_key" ON "security_policies"("provider", "policy_source", "rule_id", "chunk_index");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_cloud_account_id_fkey" FOREIGN KEY ("cloud_account_id") REFERENCES "cloud_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_cloud_account_id_fkey" FOREIGN KEY ("cloud_account_id") REFERENCES "cloud_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_cloud_account_id_fkey" FOREIGN KEY ("cloud_account_id") REFERENCES "cloud_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_proposals" ADD CONSTRAINT "code_proposals_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_proposals" ADD CONSTRAINT "code_proposals_cloud_account_id_fkey" FOREIGN KEY ("cloud_account_id") REFERENCES "cloud_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
