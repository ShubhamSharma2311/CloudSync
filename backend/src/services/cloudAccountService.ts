import { CloudProvider, type Prisma } from "@prisma/client";
import { AppError } from "../utils/appError";
import type {
  CreateCloudAccountPayload,
  ListCloudAccountsQuery,
} from "../utils/cloudAccountSchemas";
import { prisma } from "../utils/prisma";

const providerDefaultRegion = new Map<CloudProvider, string>([
  [CloudProvider.AWS, "us-east-1"],
  [CloudProvider.GCP, "us-central1"],
  [CloudProvider.AZURE, "eastus"],
]);

const cloudAccountSelect = {
  id: true,
  provider: true,
  externalAccountId: true,
  displayName: true,
  region: true,
  connectionStatus: true,
  lastVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CloudAccountSelect;

const decodeCiphertext = (
  encodedCiphertext: string
): Uint8Array<ArrayBuffer> => {
  const trimmed = encodedCiphertext.trim();
  const decoded = Buffer.from(trimmed, "base64");
  const normalizedInput = trimmed.replace(/=+$/, "");
  const normalizedOutput = decoded.toString("base64").replace(/=+$/, "");

  if (decoded.length === 0 || normalizedInput !== normalizedOutput) {
    throw new AppError(
      "credentialsCiphertextBase64 must be a valid base64 value",
      400,
      "INVALID_CREDENTIALS_CIPHERTEXT"
    );
  }

  const arrayBuffer = new ArrayBuffer(decoded.byteLength);
  const bytes = new Uint8Array(arrayBuffer) as Uint8Array<ArrayBuffer>;
  bytes.set(decoded);

  return bytes;
};

const resolveRegion = (provider: CloudProvider, region?: string): string | null => {
  if (region) {
    return region;
  }

  return providerDefaultRegion.get(provider) ?? null;
};

export const createCloudAccount = async (payload: CreateCloudAccountPayload) => {
  const provider = payload.provider as CloudProvider;
  const credentialsCiphertext = decodeCiphertext(payload.credentialsCiphertextBase64);
  const region = resolveRegion(provider, payload.region);
  const credentialsMetadata =
    payload.credentialsMetadata as Prisma.InputJsonValue | undefined;

  const account = await prisma.cloudAccount.upsert({
    where: {
      provider_externalAccountId: {
        provider,
        externalAccountId: payload.externalAccountId,
      },
    },
    update: {
      displayName: payload.displayName,
      region,
      credentialsCiphertext,
      credentialsMetadata,
      connectionStatus: "UNKNOWN",
      lastVerifiedAt: null,
    },
    create: {
      provider,
      externalAccountId: payload.externalAccountId,
      displayName: payload.displayName,
      region,
      credentialsCiphertext,
      credentialsMetadata,
      connectionStatus: "UNKNOWN",
    },
    select: cloudAccountSelect,
  });

  return account;
};

export const listCloudAccounts = async (query: ListCloudAccountsQuery) => {
  const provider = query.provider as CloudProvider | undefined;
  const where: Prisma.CloudAccountWhereInput = {
    provider,
    connectionStatus: query.connectionStatus,
  };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, items] = await prisma.$transaction([
    prisma.cloudAccount.count({ where }),
    prisma.cloudAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: cloudAccountSelect,
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
