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
