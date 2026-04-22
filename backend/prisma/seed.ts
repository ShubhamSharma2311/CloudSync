import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CloudProvider,
  ConnectionStatus,
  CostCategory,
  PrismaClient,
  ProposalStatus,
  ResourceStatus,
  ResourceType,
  ScanTrigger,
  Severity,
} from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ids = {
  account: "a20e9911-59fd-4d4f-a6f8-a39b53f15000",
  scan: "6a8fd13b-812d-40fb-90af-d1af3d365e10",
  resources: {
    awsZombieApi: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa101",
    awsZombieBatch: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa102",
    gcpZombieWorker: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa103",
    awsIdentityWildcard: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa104",
    awsPublicBucket: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa105",
    awsOverAllocatedLambda: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa106",
    awsHealthyDb: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa107",
    azureHealthyVm: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa108",
    gcpHealthyBucket: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa109",
    awsHealthyCache: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa110",
    azureHealthyIdentity: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa111",
    gcpHealthyRun: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa112",
    awsHealthyQueue: "f0da7ef6-0ef9-4bd6-adfa-f9de5f5aa113",
  },
  proposals: {
    apiTermination: "d8538898-5cad-4422-b3d3-55bcb5a1e001",
    iamRemediation: "d8538898-5cad-4422-b3d3-55bcb5a1e002",
    bucketRemediation: "d8538898-5cad-4422-b3d3-55bcb5a1e003",
    lambdaRightsize: "d8538898-5cad-4422-b3d3-55bcb5a1e004",
    gcpWorkerTermination: "d8538898-5cad-4422-b3d3-55bcb5a1e005",
  },
  codeProposals: {
    s3InLoop: "f949adf9-35e1-4438-82eb-faec96f0d301",
    missingKeepAlive: "f949adf9-35e1-4438-82eb-faec96f0d302",
  },
};

function demoDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

async function seedCloudAccount(): Promise<void> {
  await prisma.cloudAccount.upsert({
    where: {
      provider_externalAccountId: {
        provider: CloudProvider.AWS,
        externalAccountId: "123456789012",
      },
    },
    update: {
      displayName: "Demo AWS Sandbox",
      region: "us-east-1",
      connectionStatus: ConnectionStatus.VERIFIED,
      lastVerifiedAt: new Date(),
      credentialsMetadata: {
        mode: "demo",
        authType: "assume-role",
        roleArn: "arn:aws:iam::123456789012:role/SentinelDemoRole",
      },
    },
    create: {
      id: ids.account,
      provider: CloudProvider.AWS,
      externalAccountId: "123456789012",
      displayName: "Demo AWS Sandbox",
      region: "us-east-1",
      connectionStatus: ConnectionStatus.VERIFIED,
      lastVerifiedAt: new Date(),
      credentialsCiphertext: Buffer.from("demo-ciphertext-only-not-real-secrets", "utf8"),
      credentialsMetadata: {
        mode: "demo",
        authType: "assume-role",
        roleArn: "arn:aws:iam::123456789012:role/SentinelDemoRole",
      },
    },
  });
}

async function seedScan(): Promise<void> {
  await prisma.scan.upsert({
    where: { id: ids.scan },
    update: {
      provider: CloudProvider.AWS,
      trigger: ScanTrigger.DEMO,
      startedAt: demoDate(1),
      finishedAt: demoDate(1),
      issuesFound: 6,
      summary: {
        totalResources: 13,
        byStatus: {
          healthy: 7,
          zombie: 3,
          breach: 2,
          uncertain: 1,
        },
      },
    },
    create: {
      id: ids.scan,
      cloudAccountId: ids.account,
      provider: CloudProvider.AWS,
      trigger: ScanTrigger.DEMO,
      startedAt: demoDate(1),
      finishedAt: demoDate(1),
      issuesFound: 6,
      summary: {
        totalResources: 13,
        byStatus: {
          healthy: 7,
          zombie: 3,
          breach: 2,
          uncertain: 1,
        },
      },
    },
  });
}

async function seedResources(): Promise<void> {
  const resources = [
    {
      id: ids.resources.awsZombieApi,
      provider: CloudProvider.AWS,
      providerResourceId: "i-0demoapi01",
      resourceType: ResourceType.COMPUTE,
      name: "api-worker-legacy",
      region: "us-east-1",
      status: ResourceStatus.ZOMBIE,
      costMonthly: "78.40",
      lastSeenActive: demoDate(47),
      rawMetadata: { cpuAvg30d: 1.2, state: "running" },
      tags: { env: "dev", owner: "platform" },
    },
    {
      id: ids.resources.awsZombieBatch,
      provider: CloudProvider.AWS,
      providerResourceId: "i-0demobatch02",
      resourceType: ResourceType.COMPUTE,
      name: "nightly-batch-old",
      region: "us-east-1",
      status: ResourceStatus.ZOMBIE,
      costMonthly: "62.10",
      lastSeenActive: demoDate(61),
      rawMetadata: { cpuAvg30d: 0.6, state: "running" },
      tags: { env: "staging" },
    },
    {
      id: ids.resources.gcpZombieWorker,
      provider: CloudProvider.GCP,
      providerResourceId: "projects/demo/zones/us-central1-a/instances/legacy-worker",
      resourceType: ResourceType.COMPUTE,
      name: "legacy-gcp-worker",
      region: "us-central1",
      status: ResourceStatus.ZOMBIE,
      costMonthly: "54.25",
      lastSeenActive: demoDate(39),
      rawMetadata: { cpuAvg30d: 1.0, state: "RUNNING" },
      tags: { env: "qa" },
    },
    {
      id: ids.resources.awsIdentityWildcard,
      provider: CloudProvider.AWS,
      providerResourceId: "arn:aws:iam::123456789012:role/AdminLikeRole",
      resourceType: ResourceType.IDENTITY,
      name: "AdminLikeRole",
      region: "global",
      status: ResourceStatus.BREACH,
      costMonthly: null,
      lastSeenActive: demoDate(2),
      rawMetadata: { policy: { Action: "*", Resource: "*" } },
      tags: { env: "prod", managedBy: "manual" },
    },
    {
      id: ids.resources.awsPublicBucket,
      provider: CloudProvider.AWS,
      providerResourceId: "sentinel-demo-public-assets",
      resourceType: ResourceType.STORAGE,
      name: "sentinel-demo-public-assets",
      region: "us-east-1",
      status: ResourceStatus.BREACH,
      costMonthly: "18.90",
      lastSeenActive: demoDate(1),
      rawMetadata: { publicAccessBlock: false, accessLogging: false },
      tags: { env: "demo" },
    },
    {
      id: ids.resources.awsOverAllocatedLambda,
      provider: CloudProvider.AWS,
      providerResourceId: "arn:aws:lambda:us-east-1:123456789012:function:order-processor",
      resourceType: ResourceType.SERVERLESS,
      name: "order-processor",
      region: "us-east-1",
      status: ResourceStatus.UNCERTAIN,
      costMonthly: "31.75",
      lastSeenActive: demoDate(0),
      rawMetadata: { memoryMb: 3072, avgMemoryMb: 128, avgDurationMs: 920 },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.awsHealthyDb,
      provider: CloudProvider.AWS,
      providerResourceId: "db-demo-primary-1",
      resourceType: ResourceType.COMPUTE,
      name: "orders-db-primary",
      region: "us-east-1",
      status: ResourceStatus.HEALTHY,
      costMonthly: "210.00",
      lastSeenActive: demoDate(0),
      rawMetadata: { cpuAvg7d: 44, storageFreeGb: 320 },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.azureHealthyVm,
      provider: CloudProvider.AZURE,
      providerResourceId: "/subscriptions/demo-sub/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/app-vm-1",
      resourceType: ResourceType.COMPUTE,
      name: "app-vm-1",
      region: "eastus",
      status: ResourceStatus.HEALTHY,
      costMonthly: "134.00",
      lastSeenActive: demoDate(0),
      rawMetadata: { powerState: "VM running", cpuAvg7d: 39 },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.gcpHealthyBucket,
      provider: CloudProvider.GCP,
      providerResourceId: "sentinel-demo-private-logs",
      resourceType: ResourceType.STORAGE,
      name: "sentinel-demo-private-logs",
      region: "us-central1",
      status: ResourceStatus.HEALTHY,
      costMonthly: "8.55",
      lastSeenActive: demoDate(0),
      rawMetadata: { uniformBucketLevelAccess: true, publicAccess: false },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.awsHealthyCache,
      provider: CloudProvider.AWS,
      providerResourceId: "elasticache-demo-cluster-1",
      resourceType: ResourceType.COMPUTE,
      name: "session-cache",
      region: "us-east-1",
      status: ResourceStatus.HEALTHY,
      costMonthly: "49.20",
      lastSeenActive: demoDate(0),
      rawMetadata: { engine: "redis", evictionsPerHour: 0 },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.azureHealthyIdentity,
      provider: CloudProvider.AZURE,
      providerResourceId: "principal://sentinel-app-reader",
      resourceType: ResourceType.IDENTITY,
      name: "sentinel-app-reader",
      region: "global",
      status: ResourceStatus.HEALTHY,
      costMonthly: null,
      lastSeenActive: demoDate(1),
      rawMetadata: { role: "Reader", scope: "subscription" },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.gcpHealthyRun,
      provider: CloudProvider.GCP,
      providerResourceId: "projects/demo/locations/us-central1/services/payment-api",
      resourceType: ResourceType.SERVERLESS,
      name: "payment-api",
      region: "us-central1",
      status: ResourceStatus.HEALTHY,
      costMonthly: "26.10",
      lastSeenActive: demoDate(0),
      rawMetadata: { minInstances: 1, avgLatencyMs: 140 },
      tags: { env: "prod" },
    },
    {
      id: ids.resources.awsHealthyQueue,
      provider: CloudProvider.AWS,
      providerResourceId: "https://sqs.us-east-1.amazonaws.com/123456789012/order-events",
      resourceType: ResourceType.STORAGE,
      name: "order-events",
      region: "us-east-1",
      status: ResourceStatus.HEALTHY,
      costMonthly: "4.90",
      lastSeenActive: demoDate(0),
      rawMetadata: { visibleMessages: 12, dlqEnabled: true },
      tags: { env: "prod" },
    },
  ] as const;

  for (const resource of resources) {
    await prisma.resource.upsert({
      where: { id: resource.id },
      update: {
        cloudAccountId: ids.account,
        scanId: ids.scan,
        provider: resource.provider,
        providerResourceId: resource.providerResourceId,
        resourceType: resource.resourceType,
        name: resource.name,
        region: resource.region,
        status: resource.status,
        costMonthly: resource.costMonthly,
        lastSeenActive: resource.lastSeenActive,
        rawMetadata: resource.rawMetadata,
        tags: resource.tags,
      },
      create: {
        id: resource.id,
        cloudAccountId: ids.account,
        scanId: ids.scan,
        provider: resource.provider,
        providerResourceId: resource.providerResourceId,
        resourceType: resource.resourceType,
        name: resource.name,
        region: resource.region,
        status: resource.status,
        costMonthly: resource.costMonthly,
        lastSeenActive: resource.lastSeenActive,
        rawMetadata: resource.rawMetadata,
        tags: resource.tags,
      },
    });
  }
}

async function seedProposals(): Promise<void> {
  const proposalRecords = [
    {
      id: ids.proposals.apiTermination,
      resourceId: ids.resources.awsZombieApi,
      issueType: "zombie_compute",
      severity: Severity.MEDIUM,
      status: ProposalStatus.RESOLVED,
      title: "Terminate idle EC2 instance api-worker-legacy",
      description: "Resource has been idle for 47 days with <2% CPU.",
      remediationCode: "aws ec2 terminate-instances --instance-ids i-0demoapi01",
      estimatedSavingsUsd: "78.40",
      confidenceScore: 93,
      expiresAt: demoDate(-3),
      approvedBy: "demo.admin",
      approvedAt: demoDate(3),
      executedAt: demoDate(3),
      resolvedAt: demoDate(3),
      evidence: {
        cpuAvg30d: 1.2,
        lastSeenActive: demoDate(47).toISOString(),
      },
      executionMetadata: { executionId: "exec-demo-001", verification: "terminated" },
    },
    {
      id: ids.proposals.iamRemediation,
      resourceId: ids.resources.awsIdentityWildcard,
      issueType: "over_privileged_identity",
      severity: Severity.HIGH,
      status: ProposalStatus.RESOLVED,
      title: "Replace wildcard IAM policy on AdminLikeRole",
      description: "Role contains wildcard Action and Resource permissions.",
      remediationCode:
        "aws iam put-role-policy --role-name AdminLikeRole --policy-name RestrictedAccess --policy-document file://restricted-policy.json",
      estimatedSavingsUsd: null,
      confidenceScore: 96,
      expiresAt: demoDate(-3),
      approvedBy: "demo.admin",
      approvedAt: demoDate(2),
      executedAt: demoDate(2),
      resolvedAt: demoDate(2),
      evidence: {
        actionWildcard: true,
        resourceWildcard: true,
      },
      executionMetadata: { executionId: "exec-demo-002", verification: "policy_restricted" },
    },
    {
      id: ids.proposals.bucketRemediation,
      resourceId: ids.resources.awsPublicBucket,
      issueType: "public_storage",
      severity: Severity.HIGH,
      status: ProposalStatus.RESOLVED,
      title: "Block public access for sentinel-demo-public-assets",
      description: "Bucket has public access enabled and access logging disabled.",
      remediationCode:
        "aws s3api put-public-access-block --bucket sentinel-demo-public-assets --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
      estimatedSavingsUsd: null,
      confidenceScore: 94,
      expiresAt: demoDate(-2),
      approvedBy: "demo.admin",
      approvedAt: demoDate(1),
      executedAt: demoDate(1),
      resolvedAt: demoDate(1),
      evidence: {
        publicAccessBlock: false,
        accessLogging: false,
      },
      executionMetadata: { executionId: "exec-demo-003", verification: "public_blocked" },
    },
    {
      id: ids.proposals.lambdaRightsize,
      resourceId: ids.resources.awsOverAllocatedLambda,
      issueType: "over_allocated_serverless",
      severity: Severity.MEDIUM,
      status: ProposalStatus.PENDING,
      title: "Right-size Lambda memory for order-processor",
      description: "Configured memory is 3072 MB while average usage is 128 MB.",
      remediationCode:
        "aws lambda update-function-configuration --function-name order-processor --memory-size 512",
      estimatedSavingsUsd: "19.30",
      confidenceScore: 88,
      expiresAt: demoDate(-1),
      approvedBy: null,
      approvedAt: null,
      executedAt: null,
      resolvedAt: null,
      evidence: {
        configuredMemoryMb: 3072,
        avgMemoryMb: 128,
        avgDurationMs: 920,
      },
      executionMetadata: undefined,
    },
    {
      id: ids.proposals.gcpWorkerTermination,
      resourceId: ids.resources.gcpZombieWorker,
      issueType: "zombie_compute",
      severity: Severity.MEDIUM,
      status: ProposalStatus.PENDING,
      title: "Terminate idle GCP instance legacy-gcp-worker",
      description: "Instance has been idle for 39 days with low CPU usage.",
      remediationCode:
        "gcloud compute instances delete legacy-worker --zone us-central1-a --project demo",
      estimatedSavingsUsd: "54.25",
      confidenceScore: 91,
      expiresAt: demoDate(-1),
      approvedBy: null,
      approvedAt: null,
      executedAt: null,
      resolvedAt: null,
      evidence: {
        cpuAvg30d: 1.0,
        lastSeenActive: demoDate(39).toISOString(),
      },
      executionMetadata: undefined,
    },
  ] as const;

  for (const proposal of proposalRecords) {
    await prisma.proposal.upsert({
      where: { id: proposal.id },
      update: {
        cloudAccountId: ids.account,
        scanId: ids.scan,
        resourceId: proposal.resourceId,
        issueType: proposal.issueType,
        severity: proposal.severity,
        status: proposal.status,
        title: proposal.title,
        description: proposal.description,
        evidence: proposal.evidence,
        remediationCode: proposal.remediationCode,
        estimatedSavingsUsd: proposal.estimatedSavingsUsd,
        confidenceScore: proposal.confidenceScore,
        expiresAt: proposal.expiresAt,
        approvedBy: proposal.approvedBy,
        approvedAt: proposal.approvedAt,
        executedAt: proposal.executedAt,
        resolvedAt: proposal.resolvedAt,
        executionMetadata: proposal.executionMetadata,
      },
      create: {
        id: proposal.id,
        cloudAccountId: ids.account,
        scanId: ids.scan,
        resourceId: proposal.resourceId,
        issueType: proposal.issueType,
        severity: proposal.severity,
        status: proposal.status,
        title: proposal.title,
        description: proposal.description,
        evidence: proposal.evidence,
        remediationCode: proposal.remediationCode,
        estimatedSavingsUsd: proposal.estimatedSavingsUsd,
        confidenceScore: proposal.confidenceScore,
        expiresAt: proposal.expiresAt,
        approvedBy: proposal.approvedBy,
        approvedAt: proposal.approvedAt,
        executedAt: proposal.executedAt,
        resolvedAt: proposal.resolvedAt,
        executionMetadata: proposal.executionMetadata,
      },
    });
  }
}

async function seedCodeProposals(): Promise<void> {
  await prisma.codeProposal.upsert({
    where: { id: ids.codeProposals.s3InLoop },
    update: {
      scanId: ids.scan,
      cloudAccountId: ids.account,
      filePath: "services/order-processor/src/handlers/syncOrders.ts",
      lineNumber: 84,
      pattern: "s3_call_inside_loop",
      description: "S3 GetObject is called inside a for-loop for each order.",
      suggestion:
        "Collect object keys first and fetch in batched async calls with Promise.all and bounded concurrency.",
      costCategory: CostCategory.HIGH,
      status: ProposalStatus.PENDING,
      billingCorrelationUsd: "180.00",
      evidence: {
        estimatedInvocationsPerMonth: 2000000,
        dominantBillingService: "Amazon S3 Requests",
      },
    },
    create: {
      id: ids.codeProposals.s3InLoop,
      scanId: ids.scan,
      cloudAccountId: ids.account,
      filePath: "services/order-processor/src/handlers/syncOrders.ts",
      lineNumber: 84,
      pattern: "s3_call_inside_loop",
      description: "S3 GetObject is called inside a for-loop for each order.",
      suggestion:
        "Collect object keys first and fetch in batched async calls with Promise.all and bounded concurrency.",
      costCategory: CostCategory.HIGH,
      status: ProposalStatus.PENDING,
      billingCorrelationUsd: "180.00",
      evidence: {
        estimatedInvocationsPerMonth: 2000000,
        dominantBillingService: "Amazon S3 Requests",
      },
    },
  });

  await prisma.codeProposal.upsert({
    where: { id: ids.codeProposals.missingKeepAlive },
    update: {
      scanId: ids.scan,
      cloudAccountId: ids.account,
      filePath: "services/payment-api/src/lambda/handler.ts",
      lineNumber: 23,
      pattern: "missing_http_keep_alive",
      description: "HTTPS agent is created without keepAlive, increasing connection overhead.",
      suggestion: "Use new https.Agent({ keepAlive: true }) and reuse it across invocations.",
      costCategory: CostCategory.MEDIUM,
      status: ProposalStatus.PENDING,
      billingCorrelationUsd: "41.50",
      evidence: {
        p95DurationIncreaseMs: 66,
      },
    },
    create: {
      id: ids.codeProposals.missingKeepAlive,
      scanId: ids.scan,
      cloudAccountId: ids.account,
      filePath: "services/payment-api/src/lambda/handler.ts",
      lineNumber: 23,
      pattern: "missing_http_keep_alive",
      description: "HTTPS agent is created without keepAlive, increasing connection overhead.",
      suggestion: "Use new https.Agent({ keepAlive: true }) and reuse it across invocations.",
      costCategory: CostCategory.MEDIUM,
      status: ProposalStatus.PENDING,
      billingCorrelationUsd: "41.50",
      evidence: {
        p95DurationIncreaseMs: 66,
      },
    },
  });
}

async function seedSecurityPolicies(): Promise<void> {
  const policies = [
    {
      id: "10fb39fc-44e2-4547-9f62-b9d53deea201",
      provider: CloudProvider.AWS,
      policySource: "CIS_AWS_FOUNDATIONS",
      documentVersion: "1.5.0",
      ruleId: "1.12",
      chunkIndex: 0,
      title: "Ensure no root user account access key exists",
      content: "The root account should not have active access keys.",
      severity: Severity.CRITICAL,
    },
    {
      id: "10fb39fc-44e2-4547-9f62-b9d53deea202",
      provider: CloudProvider.AWS,
      policySource: "CIS_AWS_FOUNDATIONS",
      documentVersion: "1.5.0",
      ruleId: "2.1.1",
      chunkIndex: 0,
      title: "Ensure S3 buckets are not publicly accessible",
      content: "Block public access settings should be enabled for all S3 buckets.",
      severity: Severity.HIGH,
    },
    {
      id: "10fb39fc-44e2-4547-9f62-b9d53deea203",
      provider: CloudProvider.GCP,
      policySource: "CIS_GCP_FOUNDATIONS",
      documentVersion: "2.0.0",
      ruleId: "2.1",
      chunkIndex: 0,
      title: "Ensure cloud storage buckets are not anonymously accessible",
      content: "IAM bindings must not grant allUsers or allAuthenticatedUsers broad access.",
      severity: Severity.HIGH,
    },
    {
      id: "10fb39fc-44e2-4547-9f62-b9d53deea204",
      provider: CloudProvider.GCP,
      policySource: "CIS_GCP_FOUNDATIONS",
      documentVersion: "2.0.0",
      ruleId: "5.1",
      chunkIndex: 0,
      title: "Ensure service accounts are not over-privileged",
      content: "Avoid assigning primitive roles such as Owner and Editor to service accounts.",
      severity: Severity.HIGH,
    },
    {
      id: "10fb39fc-44e2-4547-9f62-b9d53deea205",
      provider: CloudProvider.AZURE,
      policySource: "CIS_AZURE_FOUNDATIONS",
      documentVersion: "2.0.0",
      ruleId: "3.1",
      chunkIndex: 0,
      title: "Ensure that public network access is disabled for storage accounts",
      content: "Storage accounts should not allow unrestricted network access.",
      severity: Severity.HIGH,
    },
    {
      id: "10fb39fc-44e2-4547-9f62-b9d53deea206",
      provider: CloudProvider.AZURE,
      policySource: "CIS_AZURE_FOUNDATIONS",
      documentVersion: "2.0.0",
      ruleId: "1.5",
      chunkIndex: 0,
      title: "Ensure multifactor authentication is enabled for all users",
      content: "MFA should be required for privileged and non-privileged users.",
      severity: Severity.CRITICAL,
    },
  ] as const;

  for (const policy of policies) {
    await prisma.securityPolicy.upsert({
      where: {
        provider_policySource_ruleId_chunkIndex: {
          provider: policy.provider,
          policySource: policy.policySource,
          ruleId: policy.ruleId,
          chunkIndex: policy.chunkIndex,
        },
      },
      update: {
        documentVersion: policy.documentVersion,
        title: policy.title,
        content: policy.content,
        severity: policy.severity,
        metadata: { seeded: true },
      },
      create: {
        id: policy.id,
        provider: policy.provider,
        policySource: policy.policySource,
        documentVersion: policy.documentVersion,
        ruleId: policy.ruleId,
        title: policy.title,
        content: policy.content,
        severity: policy.severity,
        chunkIndex: policy.chunkIndex,
        metadata: { seeded: true },
      },
    });
  }
}

async function seedAuditTrail(): Promise<void> {
  const auditEntries = [
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871001",
      proposalId: ids.proposals.apiTermination,
      resourceId: ids.resources.awsZombieApi,
      scanId: ids.scan,
      actorType: "SYSTEM",
      actorId: "agent.sentinel",
      action: "PROPOSAL_CREATED",
      outcome: "SUCCESS",
      details: { proposalStatus: "pending" },
      preState: { state: "running" },
      postState: { proposalStatus: "pending" },
      previousEntryHash: null,
      entryHash: "demo-hash-001",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871002",
      proposalId: ids.proposals.apiTermination,
      resourceId: ids.resources.awsZombieApi,
      scanId: ids.scan,
      actorType: "USER",
      actorId: "demo.admin",
      action: "PROPOSAL_APPROVED",
      outcome: "SUCCESS",
      details: { mfaRequired: true, mfaVerified: true },
      preState: { proposalStatus: "pending" },
      postState: { proposalStatus: "approved" },
      previousEntryHash: "demo-hash-001",
      entryHash: "demo-hash-002",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871003",
      proposalId: ids.proposals.apiTermination,
      resourceId: ids.resources.awsZombieApi,
      scanId: ids.scan,
      actorType: "SYSTEM",
      actorId: "executor.sentinel",
      action: "REMEDIATION_EXECUTED",
      outcome: "SUCCESS",
      details: { command: "aws ec2 terminate-instances ...", verification: "terminated" },
      preState: { state: "running" },
      postState: { state: "terminated" },
      previousEntryHash: "demo-hash-002",
      entryHash: "demo-hash-003",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871004",
      proposalId: ids.proposals.iamRemediation,
      resourceId: ids.resources.awsIdentityWildcard,
      scanId: ids.scan,
      actorType: "SYSTEM",
      actorId: "agent.sentinel",
      action: "PROPOSAL_CREATED",
      outcome: "SUCCESS",
      details: { proposalStatus: "pending" },
      preState: { hasWildcard: true },
      postState: { proposalStatus: "pending" },
      previousEntryHash: null,
      entryHash: "demo-hash-004",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871005",
      proposalId: ids.proposals.iamRemediation,
      resourceId: ids.resources.awsIdentityWildcard,
      scanId: ids.scan,
      actorType: "USER",
      actorId: "demo.admin",
      action: "PROPOSAL_APPROVED",
      outcome: "SUCCESS",
      details: { mfaRequired: false },
      preState: { proposalStatus: "pending" },
      postState: { proposalStatus: "approved" },
      previousEntryHash: "demo-hash-004",
      entryHash: "demo-hash-005",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871006",
      proposalId: ids.proposals.iamRemediation,
      resourceId: ids.resources.awsIdentityWildcard,
      scanId: ids.scan,
      actorType: "SYSTEM",
      actorId: "executor.sentinel",
      action: "REMEDIATION_EXECUTED",
      outcome: "SUCCESS",
      details: { command: "aws iam put-role-policy ...", verification: "policy_restricted" },
      preState: { hasWildcard: true },
      postState: { hasWildcard: false },
      previousEntryHash: "demo-hash-005",
      entryHash: "demo-hash-006",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871007",
      proposalId: ids.proposals.bucketRemediation,
      resourceId: ids.resources.awsPublicBucket,
      scanId: ids.scan,
      actorType: "SYSTEM",
      actorId: "agent.sentinel",
      action: "PROPOSAL_CREATED",
      outcome: "SUCCESS",
      details: { proposalStatus: "pending" },
      preState: { publicAccess: true },
      postState: { proposalStatus: "pending" },
      previousEntryHash: null,
      entryHash: "demo-hash-007",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871008",
      proposalId: ids.proposals.bucketRemediation,
      resourceId: ids.resources.awsPublicBucket,
      scanId: ids.scan,
      actorType: "USER",
      actorId: "demo.admin",
      action: "PROPOSAL_APPROVED",
      outcome: "SUCCESS",
      details: { mfaRequired: true, mfaVerified: true },
      preState: { proposalStatus: "pending" },
      postState: { proposalStatus: "approved" },
      previousEntryHash: "demo-hash-007",
      entryHash: "demo-hash-008",
    },
    {
      id: "9f7dc2f6-4a89-47f6-8a9b-27d719871009",
      proposalId: ids.proposals.bucketRemediation,
      resourceId: ids.resources.awsPublicBucket,
      scanId: ids.scan,
      actorType: "SYSTEM",
      actorId: "executor.sentinel",
      action: "REMEDIATION_EXECUTED",
      outcome: "SUCCESS",
      details: {
        command: "aws s3api put-public-access-block ...",
        verification: "bucket_no_longer_public",
      },
      preState: { publicAccess: true },
      postState: { publicAccess: false },
      previousEntryHash: "demo-hash-008",
      entryHash: "demo-hash-009",
    },
  ] as const;

  for (const entry of auditEntries) {
    await prisma.auditLog.upsert({
      where: { id: entry.id },
      update: {
        proposalId: entry.proposalId,
        resourceId: entry.resourceId,
        scanId: entry.scanId,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        outcome: entry.outcome,
        details: entry.details,
        preState: entry.preState,
        postState: entry.postState,
        previousEntryHash: entry.previousEntryHash,
        entryHash: entry.entryHash,
      },
      create: {
        id: entry.id,
        proposalId: entry.proposalId,
        resourceId: entry.resourceId,
        scanId: entry.scanId,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        outcome: entry.outcome,
        details: entry.details,
        preState: entry.preState,
        postState: entry.postState,
        previousEntryHash: entry.previousEntryHash,
        entryHash: entry.entryHash,
      },
    });
  }
}

async function main(): Promise<void> {
  await seedCloudAccount();
  await seedScan();
  await seedResources();
  await seedProposals();
  await seedCodeProposals();
  await seedSecurityPolicies();
  await seedAuditTrail();

  console.log("Seed completed: 1 account, 1 scan, 13 resources, 5 proposals, 2 code proposals, 6 policies, 9 audit logs.");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
