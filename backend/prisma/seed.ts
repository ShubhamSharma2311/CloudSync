import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CloudProvider,
  ConnectionStatus,
  CostCategory,
  PrismaClient,
  Prisma,
  ProposalStatus,
  ResourceStatus,
  ResourceType,
  ScanTrigger,
  Severity,
} from "@prisma/client";
import { CIS_RULES, EXTRA_CHECKS, type CISRule } from "../src/data/cis";

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
      // Default CloudWatch metrics only — no CWAgent on this instance, so no
      // memory data. The agent should still flag this as ZOMBIE on CPU+network
      // alone, and recommend installing CWAgent for RAM-based right-sizing.
      rawMetadata: {
        state: "running",
        instanceType: "m5.large",
        instanceSpec: { vcpus: 2, memoryMb: 8192, ebsOptimized: true },
        metrics30d: {
          windowDays: 30,
          source: "cloudwatch",
          cpu: { avgPct: 1.2, p95Pct: 2.8, peakPct: 4.1, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 5400,
            avgOutBytesPerSec: 2100,
            peakInBytesPerSec: 22000,
            peakOutBytesPerSec: 9100,
          },
          diskIO: { avgReadIops: 4, avgWriteIops: 2, peakReadIops: 18, peakWriteIops: 8 },
          // memory: not present — CWAgent not installed
        },
      },
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
      // CWAgent IS installed here → memory data available. Bursts during
      // nightly batch window; idle 23h/day. Strong candidate for Lambda or
      // Fargate Spot.
      rawMetadata: {
        state: "running",
        instanceType: "m5.large",
        instanceSpec: { vcpus: 2, memoryMb: 8192, ebsOptimized: true },
        metrics30d: {
          windowDays: 30,
          source: "cloudwatch",
          cpu: { avgPct: 0.6, p95Pct: 1.4, peakPct: 22.0, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 1100,
            avgOutBytesPerSec: 800,
            peakInBytesPerSec: 540000,
            peakOutBytesPerSec: 290000,
          },
          diskIO: { avgReadIops: 2, avgWriteIops: 1, peakReadIops: 320, peakWriteIops: 180 },
          memory: {
            source: "cwagent",
            avgBytes: 188_743_680, // ~180MB
            p95Bytes: 293_601_280,
            peakBytes: 2_202_009_600, // ~2.1GB during batch
            allocatedBytes: 8_589_934_592, // 8GB
          },
          activeHoursPerDay: 0.8,
        },
      },
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
      // No Ops Agent installed → CPU + network only. Same "install agent for
      // memory" recommendation path as the AWS zombie above.
      rawMetadata: {
        state: "RUNNING",
        instanceType: "e2-medium",
        instanceSpec: { vcpus: 2, memoryMb: 4096, sharedCore: true },
        metrics30d: {
          windowDays: 30,
          source: "cloud-monitoring",
          cpu: { avgPct: 1.0, p95Pct: 2.0, peakPct: 2.5, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 2300,
            avgOutBytesPerSec: 1100,
            peakInBytesPerSec: 8400,
            peakOutBytesPerSec: 3900,
          },
          diskIO: { avgReadIops: 3, avgWriteIops: 1, peakReadIops: 12, peakWriteIops: 5 },
        },
      },
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
      // Lambda Insights extension is enabled → memory data available.
      // 3072MB allocated, peak ~180MB. Massively over-provisioned; could drop
      // to 256MB and still have headroom.
      rawMetadata: {
        runtime: "nodejs20.x",
        instanceSpec: { allocatedMemoryMb: 3072 },
        // Source code linked locally for the code-cost agent. In production
        // this would be a github_url + commit SHA; for demo we ship the file
        // alongside the repo.
        source: {
          kind: "local",
          path: "scripts/sample-code/order-processor.ts",
          language: "typescript",
        },
        metrics30d: {
          windowDays: 30,
          source: "cloudwatch",
          cpu: { avgPct: 8.5, p95Pct: 18.0, peakPct: 32.0, sampleCount: 4320 },
          network: {
            avgInBytesPerSec: 12000,
            avgOutBytesPerSec: 8400,
            peakInBytesPerSec: 180000,
            peakOutBytesPerSec: 95000,
          },
          diskIO: { avgReadIops: 0, avgWriteIops: 0, peakReadIops: 0, peakWriteIops: 0 },
          memory: {
            source: "lambda-insights",
            avgBytes: 134_217_728, // ~128MB
            p95Bytes: 167_772_160,
            peakBytes: 188_743_680, // ~180MB
            allocatedBytes: 3_221_225_472, // 3GB
          },
          serverless: {
            invocations: 2_400_000,
            errors: 1840,
            p50DurationMs: 720,
            p95DurationMs: 1180,
            p99DurationMs: 1520,
            throttles: 0,
            concurrentExecutionsP95: 18,
          },
        },
      },
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
      // RDS managed service → FreeableMemory + DatabaseConnections + IOPS all
      // come from default CloudWatch metrics, no agent needed.
      rawMetadata: {
        engine: "postgres",
        engineVersion: "15.4",
        instanceType: "db.m6g.xlarge",
        instanceSpec: { vcpus: 4, memoryMb: 16384, allocatedStorageGb: 500 },
        multiAz: true,
        metrics30d: {
          windowDays: 30,
          source: "cloudwatch",
          cpu: { avgPct: 44.0, p95Pct: 62.0, peakPct: 78.0, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 410000,
            avgOutBytesPerSec: 1_120_000,
            peakInBytesPerSec: 2_400_000,
            peakOutBytesPerSec: 6_800_000,
          },
          diskIO: {
            avgReadIops: 180,
            avgWriteIops: 220,
            peakReadIops: 890,
            peakWriteIops: 1240,
          },
          memory: {
            source: "rds-default",
            avgBytes: 4_509_715_456, // ~4.2GB used
            p95Bytes: 6_120_000_000,
            peakBytes: 7_300_000_000, // peak ~6.8GB
            allocatedBytes: 17_179_869_184, // 16GB
          },
          database: {
            avgConnections: 18,
            peakConnections: 42,
            avgReadLatencyMs: 0.4,
            avgWriteLatencyMs: 1.2,
            freeStorageBytes: 343_597_383_680, // ~320GB free out of 500
          },
        },
      },
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
      // Azure Monitor Agent installed → memory + diskFree available alongside
      // default CPU/network. CPU peaks ~39% but memory caps at 27% — strong
      // right-sizing candidate (D4s_v5 → D2s_v5 saves ~$65/mo).
      rawMetadata: {
        powerState: "VM running",
        instanceType: "Standard_D4s_v5",
        instanceSpec: { vcpus: 4, memoryMb: 16384, premiumDisk: true },
        osType: "Linux",
        metrics30d: {
          windowDays: 30,
          source: "azure-monitor",
          cpu: { avgPct: 18.0, p95Pct: 32.0, peakPct: 39.0, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 84000,
            avgOutBytesPerSec: 56000,
            peakInBytesPerSec: 320000,
            peakOutBytesPerSec: 210000,
          },
          diskIO: { avgReadIops: 28, avgWriteIops: 14, peakReadIops: 180, peakWriteIops: 92 },
          memory: {
            source: "azure-monitor-agent",
            avgBytes: 3_355_443_200, // ~3.2GB
            p95Bytes: 4_294_967_296, // ~4GB
            peakBytes: 4_700_000_000, // ~4.5GB peak
            allocatedBytes: 17_179_869_184, // 16GB
          },
        },
      },
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
      // ElastiCache managed → all the memory + cache metrics come from default
      // CloudWatch (BytesUsedForCache, Evictions, CacheHitRate, etc.).
      // 0 evictions and only ~22% memory used → over-provisioned.
      rawMetadata: {
        engine: "redis",
        engineVersion: "7.0",
        instanceType: "cache.m5.large",
        instanceSpec: { vcpus: 2, memoryMb: 6379 },
        replicationEnabled: true,
        metrics30d: {
          windowDays: 30,
          source: "cloudwatch",
          cpu: { avgPct: 14.0, p95Pct: 24.0, peakPct: 31.0, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 92000,
            avgOutBytesPerSec: 124000,
            peakInBytesPerSec: 480000,
            peakOutBytesPerSec: 612000,
          },
          diskIO: { avgReadIops: 0, avgWriteIops: 0, peakReadIops: 0, peakWriteIops: 0 },
          memory: {
            source: "elasticache-default",
            avgBytes: 1_476_395_008, // ~1.4GB used
            p95Bytes: 2_147_483_648, // ~2GB
            peakBytes: 2_550_136_832, // ~2.4GB peak
            allocatedBytes: 6_690_088_960, // ~6.4GB
          },
          cache: {
            evictions: 0,
            cacheHitRate: 0.94,
            avgConnections: 78,
            peakConnections: 142,
          },
        },
      },
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
      // Cloud Run managed → memory + invocations from default Cloud Monitoring.
      // 1 min-instance is paid 24/7 even when idle. Healthy P95 latency.
      rawMetadata: {
        runtime: "containerized",
        minInstances: 1,
        maxInstances: 100,
        instanceSpec: { vcpus: 1, memoryMb: 512 },
        source: {
          kind: "local",
          path: "scripts/sample-code/payment-api.js",
          language: "javascript",
        },
        metrics30d: {
          windowDays: 30,
          source: "cloud-monitoring",
          cpu: { avgPct: 22.0, p95Pct: 48.0, peakPct: 71.0, sampleCount: 8640 },
          network: {
            avgInBytesPerSec: 45000,
            avgOutBytesPerSec: 78000,
            peakInBytesPerSec: 240000,
            peakOutBytesPerSec: 410000,
          },
          diskIO: { avgReadIops: 0, avgWriteIops: 0, peakReadIops: 0, peakWriteIops: 0 },
          memory: {
            source: "cloud-run-default",
            avgBytes: 184_549_376, // ~176MB
            p95Bytes: 268_435_456,
            peakBytes: 322_961_408, // ~308MB
            allocatedBytes: 536_870_912, // 512MB
          },
          serverless: {
            invocations: 1_200_000,
            errors: 480,
            p50DurationMs: 110,
            p95DurationMs: 240,
            p99DurationMs: 420,
            avgLatencyMs: 140,
          },
        },
      },
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
  // Load the full CIS rule corpus (240 rules) + project-specific Lambda checks (7)
  // straight from the generated TS data files. Single source of truth — when the
  // CIS extraction scripts regenerate these, re-running this seed updates the DB.

  const PROVIDER_VERSIONS: Record<string, string> = {
    AWS: "5.0.0",
    GCP: "2.0.0",
    AZURE: "1.0.0",
  };

  const composeContent = (r: CISRule): string =>
    [r.description, `Rationale: ${r.rationale}`, `Remediation: ${r.remediation}`]
      .filter(Boolean)
      .join("\n\n");

  // Build a flat list. ruleId uses cisSection if present (Azure/GCP) else id (AWS).
  type PolicyRow = {
    provider: CloudProvider;
    policySource: string;
    documentVersion: string;
    ruleId: string;
    chunkIndex: number;
    title: string;
    content: string;
    severity: Severity;
    metadata: Record<string, unknown>;
  };
  const rows: PolicyRow[] = [];

  for (const [providerKey, byResourceType] of Object.entries(CIS_RULES)) {
    const provider = providerKey as CloudProvider;
    const documentVersion = PROVIDER_VERSIONS[providerKey] ?? "unknown";
    for (const [resourceType, rules] of Object.entries(byResourceType)) {
      for (const rule of rules) {
        rows.push({
          provider,
          policySource: `CIS_${providerKey}_FOUNDATIONS`,
          documentVersion,
          ruleId: rule.cisSection ?? rule.id,
          chunkIndex: 0,
          title: rule.title,
          content: composeContent(rule),
          severity: rule.severity as Severity,
          metadata: {
            resourceType,
            sourceId: rule.id,
            profile: rule.profile ?? null,
            remediation: rule.remediation,
            rationale: rule.rationale,
          },
        });
      }
    }
  }

  // Project-specific Lambda checks (NOT CIS — internal CloudSync rules).
  for (const rule of EXTRA_CHECKS.AWS.LAMBDA) {
    rows.push({
      provider: CloudProvider.AWS,
      policySource: "CLOUDSYNC_LAMBDA_CHECKS",
      documentVersion: "1.0.0",
      ruleId: rule.id,
      chunkIndex: 0,
      title: rule.title,
      content: composeContent(rule),
      severity: rule.severity as Severity,
      metadata: {
        resourceType: "SERVERLESS",
        sourceId: rule.id,
        profile: null,
        remediation: rule.remediation,
        rationale: rule.rationale,
        category: "project-specific",
      },
    });
  }

  // Wipe existing rows so old hand-curated policies don't linger alongside new
  // extracted ones with overlapping ruleIds. Audit logs do not reference
  // security_policies — safe to truncate.
  await prisma.securityPolicy.deleteMany({});
  await prisma.securityPolicy.createMany({
    data: rows.map((r) => ({
      ...r,
      metadata: r.metadata as Prisma.InputJsonValue,
    })),
  });

  // Sanity report so seed log shows a count we can verify against the source.
  console.log(`  seedSecurityPolicies: inserted ${rows.length} rows`);
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
