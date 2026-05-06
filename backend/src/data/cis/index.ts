// Central entry point for all CIS benchmark rules.
// Import from this file anywhere in the codebase.
//
// Usage:
//   import { CIS_RULES } from '../data/cis';
//   const rules = CIS_RULES[resource.provider][resource.resourceType];

import { AWS_CIS, type CISRule } from "./aws";
import { GCP_CIS } from "./gcp";
import { AZURE_CIS } from "./azure";
import { LAMBDA_CHECKS } from "./lambda";

export type { CISRule } from "./aws";
export { AWS_CIS, GCP_CIS, AZURE_CIS, LAMBDA_CHECKS };

export const CIS_RULES: Record<string, Record<string, CISRule[]>> = {
  AWS: AWS_CIS,
  GCP: GCP_CIS,
  AZURE: AZURE_CIS,
};

// Project-specific (non-CIS) checks, namespaced by service.
// Use these alongside CIS_RULES when scanning serverless workloads.
export const EXTRA_CHECKS = {
  AWS: {
    LAMBDA: LAMBDA_CHECKS,
  },
} as const;
