import { type CloudProvider, type Prisma, type Severity } from "@prisma/client";
import { prisma } from "../utils/prisma";
import type { ListPoliciesQuery } from "../utils/policySchemas";

const policySelect = {
  id: true,
  provider: true,
  policySource: true,
  documentVersion: true,
  ruleId: true,
  title: true,
  content: true,
  severity: true,
  metadata: true,
  chunkIndex: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SecurityPolicySelect;

export const listPolicies = async (query: ListPoliciesQuery) => {
  const where: Prisma.SecurityPolicyWhereInput = {
    provider: query.provider as CloudProvider | undefined,
    severity: query.severity as Severity | undefined,
    policySource: query.source,
  };

  // resourceType lives in metadata JSON because security_policies has no
  // dedicated column for it. Filter via Postgres jsonb path operator.
  if (query.resourceType) {
    where.metadata = {
      path: ["resourceType"],
      equals: query.resourceType,
    };
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { ruleId: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, items] = await prisma.$transaction([
    prisma.securityPolicy.count({ where }),
    prisma.securityPolicy.findMany({
      where,
      orderBy: [{ provider: "asc" }, { ruleId: "asc" }],
      skip,
      take: limit,
      select: policySelect,
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
