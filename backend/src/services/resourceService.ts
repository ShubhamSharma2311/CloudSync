import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import type { GetResourcesQuery } from "../utils/resourceSchemas";
import { AppError } from "../utils/appError";

export const listResources = async (query: GetResourcesQuery) => {
  const where: Prisma.ResourceWhereInput = {
    cloudAccountId: query.cloudAccountId,
    scanId: query.scanId,
    provider: query.provider,
    resourceType: query.resourceType,
    status: query.status,
  };

  const skip = (query.page - 1) * query.limit;

  const [total, items] = await prisma.$transaction([
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
};

export const getResourceById = async (id: string) => {
  const resource = await prisma.resource.findUnique({
    where: { id },
  });

  if (!resource) {
    throw new AppError("Resource not found", 404, "RESOURCE_NOT_FOUND");
  }

  return resource;
};
