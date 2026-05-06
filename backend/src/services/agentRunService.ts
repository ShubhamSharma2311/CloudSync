// Compute-cluster agent runner. For a given scan, walks every Resource owned
// by that scan, asks Gemini to analyze each one against the applicable CIS
// rules, and persists the agent's findings as Proposal rows.
//
// This is the "minimal Phase 7" runner — single-threaded, sequential, no
// LangGraph state machine yet. The shape is right for swapping in LangGraph
// later (the Compute/Identity/Storage sub-agents will dispatch from here).

import { randomUUID } from "node:crypto";
import {
  type Prisma,
  type Resource,
  type SecurityPolicy,
  ProposalStatus,
  type Severity,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getLogger } from "../utils/logger";
import { NotFoundError } from "../utils/errors";
import { analyzeResource } from "../agent/gemini";
import type { AgentProposal } from "../agent/schemas";

type RunAgentResult = {
  scanId: string;
  resourcesAnalyzed: number;
  proposalsCreated: number;
  flagsByIssueType: Record<string, number>;
  durationMs: number;
};

const PROPOSAL_TTL_HOURS = 24;

export const runAgentForScan = async (scanId: string): Promise<RunAgentResult> => {
  const logger = getLogger();
  const start = Date.now();

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true, cloudAccountId: true, provider: true },
  });
  if (!scan) {
    throw new NotFoundError("Scan not found", { scanId });
  }

  const resources = await prisma.resource.findMany({
    where: { scanId },
    orderBy: { createdAt: "asc" },
  });

  // Idempotent re-run: clear any prior proposals for this scan so the agent's
  // output is the single source of truth. The seeded demo proposals from
  // prisma/seed.ts only exist on the demo scan and get overwritten here.
  await prisma.proposal.deleteMany({ where: { scanId } });

  logger.info({ scanId, resourceCount: resources.length }, "agent run start");

  const flagsByIssueType: Record<string, number> = {};
  let proposalsCreated = 0;

  for (const resource of resources) {
    const rules = await fetchRulesFor(resource);

    let proposal: AgentProposal;
    try {
      // Always use the default (flash) model for now. The high-stakes
      // pro path will come back once we have a real reason to escalate.
      proposal = await analyzeResource(resource, rules);
    } catch (err) {
      // One resource failing should not abort the whole scan run.
      logger.error({ err, resourceId: resource.id }, "agent failed for resource — skipping");
      continue;
    }

    if (!proposal.shouldFlag) continue;

    await persistProposal(scan, resource, proposal);
    proposalsCreated += 1;
    flagsByIssueType[proposal.issueType] = (flagsByIssueType[proposal.issueType] ?? 0) + 1;
  }

  // Mark the scan as finished and stamp it with the agent's tally.
  await prisma.scan.update({
    where: { id: scanId },
    data: {
      finishedAt: new Date(),
      issuesFound: proposalsCreated,
      summary: {
        source: "agent",
        flagsByIssueType,
        resourcesAnalyzed: resources.length,
        proposalsCreated,
      } as Prisma.InputJsonValue,
    },
  });

  const result: RunAgentResult = {
    scanId,
    resourcesAnalyzed: resources.length,
    proposalsCreated,
    flagsByIssueType,
    durationMs: Date.now() - start,
  };
  logger.info(result, "agent run complete");
  return result;
};

const fetchRulesFor = async (resource: Resource): Promise<SecurityPolicy[]> => {
  return prisma.securityPolicy.findMany({
    where: {
      provider: resource.provider,
      metadata: { path: ["resourceType"], equals: resource.resourceType },
    },
    take: 40,
  });
};

const persistProposal = async (
  scan: { id: string; cloudAccountId: string },
  resource: Resource,
  proposal: AgentProposal
): Promise<void> => {
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_HOURS * 60 * 60 * 1000);

  const created = await prisma.proposal.create({
    data: {
      cloudAccountId: scan.cloudAccountId,
      scanId: scan.id,
      resourceId: resource.id,
      issueType: proposal.issueType,
      severity: proposal.severity as Severity,
      status: ProposalStatus.PENDING,
      title: proposal.title,
      description: proposal.description,
      remediationCode: proposal.remediationCode,
      estimatedSavingsUsd: proposal.estimatedSavingsUsd,
      confidenceScore: proposal.confidenceScore,
      expiresAt,
      evidence: {
        citedRuleIds: proposal.citedRuleIds,
        observedStatus: resource.status,
        agentRunAt: new Date().toISOString(),
        whyItMatters: proposal.whyItMatters,
        humanReadableSteps: proposal.humanReadableSteps,
      } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  // Audit log: PROPOSAL_GENERATED is the genesis entry on this proposal's
  // chain. Subsequent entries (APPROVED, EXECUTED, etc.) link via
  // previousEntryHash so the full lineage is verifiable.
  await prisma.auditLog.create({
    data: {
      proposalId: created.id,
      resourceId: resource.id,
      scanId: scan.id,
      actorType: "AGENT",
      actorId: "agent.gemini.compute",
      action: "PROPOSAL_GENERATED",
      outcome: "SUCCESS",
      details: {
        issueType: proposal.issueType,
        severity: proposal.severity,
        confidenceScore: proposal.confidenceScore,
      } as Prisma.InputJsonValue,
      preState: { proposalExists: false } as Prisma.InputJsonValue,
      postState: { proposalStatus: "PENDING" } as Prisma.InputJsonValue,
      previousEntryHash: null,
      entryHash: randomUUID(),
    },
  });
};
