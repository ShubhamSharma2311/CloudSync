"""Generate backend/src/data/cis/{aws,gcp,azure}.ts from parsed JSON rule files.

Output keeps the existing schema-friendly grouping by ResourceType so the
calling code (CIS_RULES[provider][resourceType]) keeps working.

Usage:
    python gen_ts.py
"""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent


REPO = Path(__file__).resolve().parent.parent
SCRIPTS = REPO / "scripts"
OUT_DIR = REPO / "backend" / "src" / "data" / "cis"


HEADER = """// Auto-generated from CIS benchmark PDFs by scripts/gen_ts.py
// Do NOT edit by hand — regenerate via:
//   python scripts/parse_cis.py azure.txt scripts/azure_rules.json azure
//   python scripts/parse_cis.py gcp.txt scripts/gcp_rules.json gcp
//   python scripts/parse_aws.py aws.txt scripts/aws_rules.json
//   python scripts/gen_ts.py
"""


CIS_RULE_TYPE = """export type CISRule = {
  id: string;
  title: string;
  description: string;
  remediation: string;
  rationale: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cisSection?: string;
  profile?: string;
};
"""


def ts_string(value: str) -> str:
    """Emit a TS string literal with backslash + double-quote escaping, on one line."""
    if value is None:
        return '""'
    s = value.replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\n", " ").replace("\r", " ")
    s = " ".join(s.split())  # collapse whitespace
    return f'"{s}"'


def emit_rule(rule: dict) -> str:
    parts = [
        f"    id: {ts_string(rule['id'])},",
        f"    title: {ts_string(rule['title'])},",
        f"    description: {ts_string(rule['description'])},",
        f"    rationale: {ts_string(rule.get('rationale', rule['description']))},",
        f"    remediation: {ts_string(rule['remediation'])},",
        f"    severity: {ts_string(rule['severity'])} as const,",
    ]
    if rule.get("cis_section"):
        parts.append(f"    cisSection: {ts_string(rule['cis_section'])},")
    if rule.get("profile"):
        parts.append(f"    profile: {ts_string(rule['profile'])},")
    body = "\n".join(parts)
    return f"  {{\n{body}\n  }},"


def group_by_resource(rules: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {"IDENTITY": [], "STORAGE": [], "COMPUTE": [], "SERVERLESS": []}
    for r in rules:
        rt = r.get("resourceType") or "COMPUTE"
        out.setdefault(rt, []).append(r)
    return out


def emit_file(provider: str, rules: list[dict], export_name: str, include_type: bool) -> str:
    grouped = group_by_resource(rules)
    blocks = []
    for rt in ("IDENTITY", "STORAGE", "COMPUTE", "SERVERLESS"):
        items = grouped.get(rt, [])
        rule_lines = "\n".join(emit_rule(r) for r in items) if items else ""
        block = f"  {rt}: [\n{rule_lines}\n  ],"
        blocks.append(block)
    body = "\n".join(blocks)

    type_section = f"\n{CIS_RULE_TYPE}\n" if include_type else "\nimport type {{ CISRule }} from \"./aws\";\n".replace("{{", "{").replace("}}", "}")

    return f"""{HEADER}
// {provider} CIS Foundations Benchmark — {len(rules)} controls extracted from the official PDF.
{type_section}
export const {export_name}: Record<string, CISRule[]> = {{
{body}
}};
"""


def main() -> None:
    azure = json.loads((SCRIPTS / "azure_rules.json").read_text(encoding="utf-8"))
    gcp = json.loads((SCRIPTS / "gcp_rules.json").read_text(encoding="utf-8"))
    aws = json.loads((SCRIPTS / "aws_rules.json").read_text(encoding="utf-8"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "aws.ts").write_text(emit_file("AWS", aws, "AWS_CIS", include_type=True), encoding="utf-8")
    (OUT_DIR / "gcp.ts").write_text(emit_file("GCP", gcp, "GCP_CIS", include_type=False), encoding="utf-8")
    (OUT_DIR / "azure.ts").write_text(emit_file("Azure", azure, "AZURE_CIS", include_type=False), encoding="utf-8")

    print(f"Wrote AWS:   {len(aws):3d} controls -> {OUT_DIR / 'aws.ts'}")
    print(f"Wrote GCP:   {len(gcp):3d} rules    -> {OUT_DIR / 'gcp.ts'}")
    print(f"Wrote Azure: {len(azure):3d} rules    -> {OUT_DIR / 'azure.ts'}")


if __name__ == "__main__":
    main()
