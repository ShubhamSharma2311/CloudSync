// Project-specific Lambda checks. These are NOT from any CIS Foundations Benchmark
// version — they are CloudSync's own serverless-security and cost anti-pattern checks
// that complement the CIS-tagged controls in aws.ts. Kept in a separate file so the
// CIS regeneration scripts (parse_aws.py, gen_ts.py) never overwrite them.

import type { CISRule } from "./aws";

export const LAMBDA_CHECKS: CISRule[] = [
  {
    id: "Lambda.1",
    title: "Lambda functions should not be publicly accessible via resource-based policies",
    description: "Lambda function resource-based policies should not allow invocation by all principals (*) without restrictive conditions.",
    rationale: "Publicly invokable Lambda functions can be triggered by anyone on the internet, leading to data access, abuse, and unexpected charges.",
    remediation: "Review Lambda resource-based policies. Remove statements with Principal: * that lack restrictive conditions. Require specific IAM principals.",
    severity: "CRITICAL",
  },
  {
    id: "Lambda.2",
    title: "Lambda functions should use supported runtimes",
    description: "This control checks whether the Lambda function runtime is a non-deprecated, supported version. The control fails if the function uses an end-of-life runtime.",
    rationale: "Deprecated runtimes no longer receive security updates, leaving known exploits unpatched in the runtime environment.",
    remediation: "Update Lambda functions to current supported runtimes: nodejs20.x, python3.12, java21, go1.x, dotnet8, ruby3.3.",
    severity: "HIGH",
  },
  {
    id: "Lambda.3",
    title: "Lambda functions should use IAM execution roles with least privilege",
    description: "Lambda execution roles should be tightly scoped to only the permissions the function actually requires.",
    rationale: "Overly permissive execution roles allow a compromised function to perform actions far beyond its intended purpose.",
    remediation: "Review and tighten Lambda execution role policies. Remove Action:* and broad Resource:* permissions. Create a dedicated role per function.",
    severity: "HIGH",
  },
  {
    id: "Lambda.4",
    title: "Lambda functions should not store sensitive data in environment variables",
    description: "API keys, passwords, database credentials, and secrets should not be stored in plaintext Lambda environment variables.",
    rationale: "Lambda environment variables are visible in plaintext to anyone with IAM access to view the function configuration.",
    remediation: "Move sensitive environment variables to AWS Secrets Manager or SSM Parameter Store SecureString. Reference by ARN in the function.",
    severity: "HIGH",
  },
  {
    id: "Lambda.5",
    title: "Lambda functions should have dead letter queues configured",
    description: "Lambda functions triggered asynchronously should have a dead letter queue (SQS or SNS) configured to capture failed invocations.",
    rationale: "Without a DLQ, failed async invocations are silently dropped after retries, causing silent data loss.",
    remediation: "Configure an SQS queue or SNS topic as the DLQ for all async Lambda functions via the Lambda console or IaC.",
    severity: "MEDIUM",
  },
  {
    id: "Lambda.6",
    title: "Over-allocated Lambda functions should be right-sized",
    description: "Lambda functions with significantly more memory than their observed peak utilization waste cost at scale.",
    rationale: "Lambda pricing is GB-seconds. Over-allocated memory directly increases costs at scale without any performance benefit.",
    remediation: "Use the AWS Lambda Power Tuning tool to identify optimal memory. Set memory to approximately 1.5x the observed average peak.",
    severity: "MEDIUM",
  },
  {
    id: "Lambda.7",
    title: "Lambda functions should have X-Ray tracing enabled",
    description: "AWS X-Ray active tracing should be enabled on Lambda functions to provide end-to-end request visibility.",
    rationale: "X-Ray provides distributed trace data for detecting anomalous patterns, performance regressions, and latency spikes.",
    remediation: "Set TracingConfig Mode to Active on all production Lambda functions via the Lambda console or Infrastructure as Code.",
    severity: "LOW",
  },
];
