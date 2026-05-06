// Reads the source linked from a Resource's rawMetadata, dispatches the
// code-cost agent, and persists each finding as a code_proposals row.
//
// Source ingestion is intentionally minimal: local file read for the demo.
// Real Phase 9 will swap this for a GitHub fetch (octokit) keyed on a
// repo URL + commit SHA.

import * as path from "node:path";
import * as fs from "node:fs/promises";
import { type Prisma, type CostCategory } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getLogger } from "../utils/logger";
import { NotFoundError, ValidationError } from "../utils/errors";
import { analyzeCode } from "../agent/codeAgent";
import type { CodeFinding } from "../agent/codeSchemas";

type SourceRef = {
  kind: "local";
  path: string;
  language?: string;
};

type CodeScanResult = {
  resourceId: string;
  filePath: string;
  findingsCreated: number;
  findingsByCategory: Record<string, number>;
  totalEstimatedSavingsUsd: number;
  summaryNote: string;
  durationMs: number;
};

const SAFE_ROOT = path.resolve(process.cwd()); // backend/

const extractSource = (raw: Prisma.JsonValue | null): SourceRef | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const meta = raw as Record<string, unknown>;
  const src = meta["source"];
  if (!src || typeof src !== "object" || Array.isArray(src)) return null;
  const ref = src as Record<string, unknown>;
  if (ref["kind"] !== "local" || typeof ref["path"] !== "string") return null;
  return {
    kind: "local",
    path: ref["path"],
    language: typeof ref["language"] === "string" ? ref["language"] : undefined,
  };
};

const readLocalSource = async (sourceRef: SourceRef): Promise<string> => {
  // Resolve relative to backend/ and reject path-traversal attempts.
  const resolved = path.resolve(SAFE_ROOT, sourceRef.path);
  if (!resolved.startsWith(SAFE_ROOT + path.sep) && resolved !== SAFE_ROOT) {
    throw new ValidationError("Source path escapes backend root", { path: sourceRef.path });
  }
  return fs.readFile(resolved, "utf8");
};

export const runCodeScanForResource = async (resourceId: string): Promise<CodeScanResult> => {
  const logger = getLogger();
  const start = Date.now();

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) {
    throw new NotFoundError("Resource not found", { resourceId });
  }

  const sourceRef = extractSource(resource.rawMetadata);
  if (!sourceRef) {
    throw new ValidationError(
      "Resource has no linked source code (rawMetadata.source missing or unsupported kind)",
      { resourceId, resourceType: resource.resourceType }
    );
  }

  const sourceText = await readLocalSource(sourceRef);
  logger.info({ resourceId, filePath: sourceRef.path, bytes: sourceText.length }, "code scan start");

  const result = await analyzeCode(resource, sourceRef.path, sourceText);

  // Idempotent re-scan: clear prior findings for this (resource → file) tuple
  // before inserting the fresh batch. Keyed via the scan id we derive below.
  const scanId = resource.scanId; // every Resource is owned by a Scan
  await prisma.codeProposal.deleteMany({
    where: { scanId, filePath: sourceRef.path },
  });

  for (const finding of result.findings) {
    await persistFinding(scanId, resource.cloudAccountId, finding);
  }

  const findingsByCategory: Record<string, number> = {};
  let totalSavings = 0;
  for (const f of result.findings) {
    findingsByCategory[f.costCategory] = (findingsByCategory[f.costCategory] ?? 0) + 1;
    totalSavings += f.billingCorrelationUsd;
  }

  const summary: CodeScanResult = {
    resourceId,
    filePath: sourceRef.path,
    findingsCreated: result.findings.length,
    findingsByCategory,
    totalEstimatedSavingsUsd: Math.round(totalSavings * 100) / 100,
    summaryNote: result.summaryNote,
    durationMs: Date.now() - start,
  };
  logger.info(summary, "code scan complete");
  return summary;
};

const persistFinding = async (
  scanId: string,
  cloudAccountId: string,
  finding: CodeFinding
): Promise<void> => {
  await prisma.codeProposal.create({
    data: {
      scanId,
      cloudAccountId,
      filePath: finding.filePath,
      lineNumber: finding.lineNumber,
      pattern: finding.pattern,
      description: finding.description,
      suggestion: finding.suggestion,
      costCategory: finding.costCategory as CostCategory,
      billingCorrelationUsd: finding.billingCorrelationUsd,
      evidence: {
        confidenceScore: finding.confidenceScore,
        agentRunAt: new Date().toISOString(),
        agentName: "agent.gemini.code",
      } as Prisma.InputJsonValue,
    },
  });
};
