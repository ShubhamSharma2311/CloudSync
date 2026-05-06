// Notification dispatcher. For now this is a thin wrapper around audit_logs —
// when a proposal is created at MEDIUM+ severity, we record a NOTIFICATION_SENT
// audit entry that a future Slack/email/webhook integration can consume.
//
// Channels are intentionally unbuilt: Phase 8.x will add Slack webhook + email
// dispatch. For now the API surface is stable so the agent runner can call
// notify() unconditionally.

import { randomUUID } from "node:crypto";
import { type Prisma, type Severity } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getLogger } from "../utils/logger";

type NotifyParams = {
  proposalId: string;
  resourceId: string;
  scanId: string;
  severity: Severity;
  issueType: string;
  title: string;
  estimatedSavingsUsd: number;
};

const NOTIFY_SEVERITIES = new Set<Severity>(["MEDIUM", "HIGH", "CRITICAL"]);

export const notifyOnProposal = async (params: NotifyParams): Promise<void> => {
  if (!NOTIFY_SEVERITIES.has(params.severity)) return;

  const logger = getLogger();

  // The audit log row IS the notification record. When real dispatch channels
  // land, they'll read pending NOTIFICATION_SENT rows and ship them out.
  await prisma.auditLog.create({
    data: {
      proposalId: params.proposalId,
      resourceId: params.resourceId,
      scanId: params.scanId,
      actorType: "NOTIFICATION_DISPATCHER",
      actorId: "system.notify",
      action: "NOTIFICATION_SENT",
      outcome: "PENDING_DELIVERY",
      details: {
        channel: "in-app", // placeholder; Phase 8.x will add slack/email/webhook
        severity: params.severity,
        issueType: params.issueType,
        title: params.title,
        estimatedSavingsUsd: params.estimatedSavingsUsd,
      } as Prisma.InputJsonValue,
      preState: { delivered: false } as Prisma.InputJsonValue,
      postState: { delivered: false, queuedAt: new Date().toISOString() } as Prisma.InputJsonValue,
      previousEntryHash: null,
      entryHash: randomUUID(),
    },
  });

  logger.info(
    {
      proposalId: params.proposalId,
      severity: params.severity,
      issueType: params.issueType,
    },
    "notification queued"
  );
};

export const listNotifications = async (limit = 50) => {
  const rows = await prisma.auditLog.findMany({
    where: { actorType: "NOTIFICATION_DISPATCHER" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      proposalId: true,
      resourceId: true,
      scanId: true,
      action: true,
      outcome: true,
      details: true,
      createdAt: true,
    },
  });
  return rows;
};
