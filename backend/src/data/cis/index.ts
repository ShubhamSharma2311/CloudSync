// Central entry point for all CIS benchmark rules.
// Import from this file anywhere in the codebase.
//
// Usage:
//   import { CIS_RULES } from '../data/cis';
//   const rules = CIS_RULES[resource.provider][resource.resourceType];

export type { CISRule } from "./aws";
export { AWS_CIS } from "./aws";
export { GCP_CIS } from "./gcp";
export { AZURE_CIS } from "./azure";

import { AWS_CIS } from "./aws";
import { GCP_CIS } from "./gcp";
import { AZURE_CIS } from "./azure";

export const CIS_RULES: Record<string, Record<string, ReturnType<typeof Object.values>[0]>> = {
  AWS: AWS_CIS,
  GCP: GCP_CIS,
  AZURE: AZURE_CIS,
};
