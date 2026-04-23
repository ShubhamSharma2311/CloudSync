import { type CloudProvider, type Prisma, type ScanTrigger } from "@prisma/client";
import { AppError } from "../utils/appError";
import { prisma } from "../utils/prisma";
import type { CreateScanPayload, ListScansQuery } from "../utils/scanSchemas";

const scanSelect = {
  id: true,
  cloudAccountId: true,
  provider: true,
  trigger: true,
  startedAt: true,
  finishedAt: true,
  issuesFound: true,
  summary: true,
  createdAt: true,
} satisfies Prisma.ScanSelect;

const buildStartedAtFilter = (
  query: ListScansQuery
): Prisma.DateTimeFilter | undefined => {
  const hasFrom = Boolean(query.startedFrom);
  const hasTo = Boolean(query.startedTo);

  if (!hasFrom && !hasTo) {
    return undefined;
  }

  return {
    gte: query.startedFrom,
    lte: query.startedTo,
  };
};

export const createScan = async (payload: CreateScanPayload) => {
  const account = await prisma.cloudAccount.findUnique({
    where: { id: payload.cloudAccountId },
    select: {
      id: true,
      provider: true,
      connectionStatus: true,
    },
  });

  if (!account) {
    throw new AppError("Cloud account not found", 404, "CLOUD_ACCOUNT_NOT_FOUND");
  }

  if (account.connectionStatus !== "VERIFIED") {
    throw new AppError(
      "Cloud account connection must be VERIFIED before scans can start",
      409,
      "CLOUD_ACCOUNT_NOT_VERIFIED",
      {
        connectionStatus: account.connectionStatus,
      }
    );
  }

  const scan = await prisma.scan.create({
    data: {
      cloudAccountId: account.id,
      provider: account.provider,
      trigger: payload.trigger as ScanTrigger,
      startedAt: payload.startedAt ?? new Date(),
      issuesFound: 0,
      summary: {
        source: "api",
        state: "queued",
      } as Prisma.InputJsonValue,
    },
    select: scanSelect,
  });

  return scan;
};

export const listScans = async (query: ListScansQuery) => {
  const where: Prisma.ScanWhereInput = {
    cloudAccountId: query.cloudAccountId,
    provider: query.provider as CloudProvider | undefined,
    trigger: query.trigger as ScanTrigger | undefined,
    startedAt: buildStartedAtFilter(query),
  };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, items] = await prisma.$transaction([
    prisma.scan.count({ where }),
    prisma.scan.findMany({
      where,
      orderBy: {
        startedAt: "desc",
      },
      skip,
      take: limit,
      select: scanSelect,
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

export const runMockScan = async (scanId: string) => {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
  });

  if (!scan) {
    throw new AppError("Scan not found", 404, "SCAN_NOT_FOUND");
  }

  if (scan.finishedAt) {
    throw new AppError("Scan already completed", 400, "SCAN_ALREADY_COMPLETED");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create a mock resource
    const mockResource = await tx.resource.create({
      data: {
        cloudAccountId: scan.cloudAccountId,
        scanId: scan.id,
        provider: scan.provider,
        providerResourceId: `mock-resource-${Date.now()}`,
        resourceType: "COMPUTE",
        name: "Mock Demo Server",
        region: "us-east-1",
        status: "BREACH",
        rawMetadata: { createdBy: "MockScanRunner" },
      },
    });

    // 2. Create a mock proposal for the resource
    const mockProposal = await tx.proposal.create({
      data: {
        cloudAccountId: scan.cloudAccountId,
        scanId: scan.id,
        resourceId: mockResource.id,
        issueType: "OPEN_PORT_22",
        severity: "HIGH",
        status: "PENDING",
        title: "Mock: Close Open SSH Port",
        description: "A demo policy violation was found with an open port 22.",
        remediationCode: "sudo ufw deny 22",
        estimatedSavingsUsd: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    });

    // 3. Complete the scan
    const updatedScan = await tx.scan.update({
      where: { id: scan.id },
      data: {
        finishedAt: new Date(),
        issuesFound: { increment: 1 },
        summary: {
          source: "mock-runner",
          state: "completed",
        } as Prisma.InputJsonValue,
      },
    });

    return { scan: updatedScan, mockResource, mockProposal };
  });

  return result;
};
