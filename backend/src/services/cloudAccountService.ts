import { randomUUID } from "node:crypto";
import { CloudProvider, type Prisma } from "@prisma/client";
import { AppError } from "../utils/appError";
import type {
  CreateCloudAccountPayload,
  ListCloudAccountsQuery,
  VerifyCloudAccountPayload,
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

type VerificationStatus = "VERIFIED" | "INVALID";

type VerificationResult = {
  status: VerificationStatus;
  reason: string;
  evidence: Record<string, unknown>;
};

type ProviderVerifier = (
  metadata: Prisma.JsonValue | null | undefined
) => VerificationResult;

const asRecord = (
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> | null => {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
};

const readNonEmptyString = (
  record: Record<string, unknown> | null,
  key: string
): string | null => {
  if (!record) {
    return null;
  }

  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const providerVerifierMap = new Map<CloudProvider, ProviderVerifier>([
  [
    CloudProvider.AWS,
    (metadata) => {
      const record = asRecord(metadata);
      const roleArn = readNonEmptyString(record, "roleArn");
      const externalId = readNonEmptyString(record, "externalId");

      if (roleArn) {
        return {
          status: "VERIFIED",
          reason: "AWS metadata includes a roleArn for AssumeRole flow",
          evidence: {
            hasRoleArn: true,
            hasExternalId: Boolean(externalId),
          },
        };
      }

      return {
        status: "INVALID",
        reason: "AWS verification requires roleArn in credentials metadata",
        evidence: {
          hasRoleArn: false,
        },
      };
    },
  ],
  [
    CloudProvider.GCP,
    (metadata) => {
      const record = asRecord(metadata);
      const projectId = readNonEmptyString(record, "projectId");
      const serviceAccountEmail = readNonEmptyString(record, "serviceAccountEmail");

      if (projectId && serviceAccountEmail) {
        return {
          status: "VERIFIED",
          reason: "GCP metadata includes projectId and serviceAccountEmail",
          evidence: {
            hasProjectId: true,
            hasServiceAccountEmail: true,
          },
        };
      }

      return {
        status: "INVALID",
        reason:
          "GCP verification requires both projectId and serviceAccountEmail in metadata",
        evidence: {
          hasProjectId: Boolean(projectId),
          hasServiceAccountEmail: Boolean(serviceAccountEmail),
        },
      };
    },
  ],
  [
    CloudProvider.AZURE,
    (metadata) => {
      const record = asRecord(metadata);
      const tenantId = readNonEmptyString(record, "tenantId");
      const clientId = readNonEmptyString(record, "clientId");
      const subscriptionId = readNonEmptyString(record, "subscriptionId");

      if (tenantId && clientId && subscriptionId) {
        return {
          status: "VERIFIED",
          reason:
            "Azure metadata includes tenantId, clientId, and subscriptionId",
          evidence: {
            hasTenantId: true,
            hasClientId: true,
            hasSubscriptionId: true,
          },
        };
      }

      return {
        status: "INVALID",
        reason:
          "Azure verification requires tenantId, clientId, and subscriptionId in metadata",
        evidence: {
          hasTenantId: Boolean(tenantId),
          hasClientId: Boolean(clientId),
          hasSubscriptionId: Boolean(subscriptionId),
        },
      };
    },
  ],
]);

const verifyByProvider = (
  provider: CloudProvider,
  metadata: Prisma.JsonValue | null | undefined
): VerificationResult => {
  const verifier = providerVerifierMap.get(provider);

  if (!verifier) {
    throw new AppError(
      `No verifier configured for provider ${provider}`,
      500,
      "PROVIDER_VERIFIER_NOT_CONFIGURED"
    );
  }

  return verifier(metadata);
};

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

export const verifyCloudAccountConnection = async (
  cloudAccountId: string,
  payload: VerifyCloudAccountPayload
) => {
  const account = await prisma.cloudAccount.findUnique({
    where: { id: cloudAccountId },
    select: {
      id: true,
      provider: true,
      connectionStatus: true,
      credentialsMetadata: true,
    },
  });

  if (!account) {
    throw new AppError("Cloud account not found", 404, "CLOUD_ACCOUNT_NOT_FOUND");
  }

  const verification = verifyByProvider(
    account.provider,
    account.credentialsMetadata
  );
  const now = new Date();
  const requestMetadata = payload.metadata as Prisma.InputJsonValue | undefined;

  const updatedAccount = await prisma.$transaction(async (tx) => {
    const updated = await tx.cloudAccount.update({
      where: { id: account.id },
      data: {
        connectionStatus: verification.status,
        lastVerifiedAt: verification.status === "VERIFIED" ? now : null,
      },
      select: cloudAccountSelect,
    });

    const previousAuditEntry = await tx.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { entryHash: true },
    });

    await tx.auditLog.create({
      data: {
        actorType: "USER",
        actorId: payload.actorId ?? "api.user",
        action: "CLOUD_ACCOUNT_CONNECTION_VERIFICATION",
        outcome: verification.status === "VERIFIED" ? "SUCCESS" : "FAILED",
        details: {
          provider: account.provider,
          reason: verification.reason,
          evidence: verification.evidence,
          requestMetadata: requestMetadata ?? null,
        } as Prisma.InputJsonValue,
        preState: {
          connectionStatus: account.connectionStatus,
        } as Prisma.InputJsonValue,
        postState: {
          connectionStatus: verification.status,
        } as Prisma.InputJsonValue,
        previousEntryHash: previousAuditEntry?.entryHash ?? null,
        entryHash: randomUUID(),
      },
    });

    return updated;
  });

  return {
    account: updatedAccount,
    verification: {
      status: verification.status,
      reason: verification.reason,
      checkedAt: now,
      evidence: verification.evidence,
    },
  };
};
