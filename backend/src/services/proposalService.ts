import { randomUUID } from "node:crypto";
import {
  type Prisma,
  type ProposalStatus,
  type Severity,
} from "@prisma/client";
import { AppError } from "../utils/appError";
import { prisma } from "../utils/prisma";
import type {
  ListProposalsQuery,
  ProposalDecisionPayload,
} from "../utils/proposalSchemas";

const proposalSelect = {
  id: true,
  cloudAccountId: true,
  scanId: true,
  resourceId: true,
  issueType: true,
  severity: true,
  status: true,
  title: true,
  description: true,
  evidence: true,
  remediationCode: true,
  estimatedSavingsUsd: true,
  confidenceScore: true,
  expiresAt: true,
  approvedBy: true,
  approvedAt: true,
  executedAt: true,
  resolvedAt: true,
  executionMetadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProposalSelect;

const decisionStatusMap = new Map<
  ProposalDecisionPayload["decision"],
  ProposalStatus
>([
  ["APPROVE", "APPROVED"],
  ["REJECT", "REJECTED"],
]);

const decisionActionMap = new Map<
  ProposalDecisionPayload["decision"],
  string
>([
  ["APPROVE", "PROPOSAL_APPROVED"],
  ["REJECT", "PROPOSAL_REJECTED"],
]);

const buildExpiryFilter = (
  query: ListProposalsQuery
): Prisma.DateTimeFilter | undefined => {
  const hasBefore = Boolean(query.expiresBefore);
  const hasAfter = Boolean(query.expiresAfter);

  if (!hasBefore && !hasAfter) {
    return undefined;
  }

  return {
    lte: query.expiresBefore,
    gte: query.expiresAfter,
  };
};

export const listProposals = async (query: ListProposalsQuery) => {
  const where: Prisma.ProposalWhereInput = {
    cloudAccountId: query.cloudAccountId,
    scanId: query.scanId,
    resourceId: query.resourceId,
    status: query.status as ProposalStatus | undefined,
    severity: query.severity as Severity | undefined,
    expiresAt: buildExpiryFilter(query),
  };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, items] = await prisma.$transaction([
    prisma.proposal.count({ where }),
    prisma.proposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: proposalSelect,
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const decideProposal = async (
  proposalId: string,
  payload: ProposalDecisionPayload
) => {
  const targetStatus = decisionStatusMap.get(payload.decision);
  const auditAction = decisionActionMap.get(payload.decision);

  if (!targetStatus || !auditAction) {
    throw new AppError("Invalid proposal decision", 400, "INVALID_PROPOSAL_DECISION");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const current = await tx.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        resourceId: true,
        scanId: true,
      },
    });

    if (!current) {
      throw new AppError("Proposal not found", 404, "PROPOSAL_NOT_FOUND");
    }

    if (current.status !== "PENDING") {
      throw new AppError(
        "Only pending proposals can be approved or rejected",
        409,
        "INVALID_PROPOSAL_STATUS_TRANSITION",
        {
          currentStatus: current.status,
        }
      );
    }

    if (current.expiresAt <= now) {
      await tx.proposal.update({
        where: { id: current.id },
        data: {
          status: "EXPIRED",
        },
      });

      throw new AppError(
        "Proposal has expired and cannot be executed",
        409,
        "PROPOSAL_EXPIRED"
      );
    }

    const decisionMetadata = {
      ...(payload.metadata ?? {}),
      decision: payload.decision,
      decidedBy: payload.actorId,
      decidedAt: now.toISOString(),
      reason: payload.reason ?? null,
    } as Prisma.InputJsonValue;

    const updated = await tx.proposal.update({
      where: { id: current.id },
      data: {
        status: targetStatus,
        approvedBy: payload.decision === "APPROVE" ? payload.actorId : null,
        approvedAt: payload.decision === "APPROVE" ? now : null,
        executionMetadata: decisionMetadata,
      },
      select: proposalSelect,
    });

    const previousLog = await tx.auditLog.findFirst({
      where: { proposalId: current.id },
      orderBy: { createdAt: "desc" },
      select: { entryHash: true },
    });

    await tx.auditLog.create({
      data: {
        proposalId: current.id,
        resourceId: current.resourceId,
        scanId: current.scanId,
        actorType: "USER",
        actorId: payload.actorId,
        action: auditAction,
        outcome: "SUCCESS",
        details: {
          reason: payload.reason ?? null,
        } as Prisma.InputJsonValue,
        preState: {
          status: current.status,
        } as Prisma.InputJsonValue,
        postState: {
          status: updated.status,
        } as Prisma.InputJsonValue,
        previousEntryHash: previousLog?.entryHash ?? null,
        entryHash: randomUUID(),
      },
    });

    return updated;
  });
};
