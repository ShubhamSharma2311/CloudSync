"""Parse AWS Security Hub User Guide PDF (extracted) for CIS-tagged controls.

The guide lists CIS-tagged controls in four blocks (one per CIS version: 5.0.0,
3.0.0, 1.4.0, 1.2.0). We take the union, then for each control ID we locate the
control's dedicated section in the guide and extract its description, severity,
and remediation.

Each control's dedicated section follows this rough layout:
    [ID] Title
    Category: ...
    Severity: HIGH/MEDIUM/LOW/CRITICAL
    Resource type: ...
    AWS Config rule: ...
    Schedule type: ...
    Parameters: ...

    This control checks ...

    ...

    Remediation
    To remediate this issue, ...

Usage:
    python parse_aws.py aws.txt scripts/aws_rules.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


CIS_BLOCK_RE = re.compile(
    r"Controls that apply to CIS AWS Foundations Benchmark version [\d.]+\n(.*?)(?=Controls that apply to CIS AWS Foundations Benchmark version|Version comparison for CIS AWS Foundations Benchmark)",
    re.DOTALL,
)

CONTROL_ID_RE = re.compile(r"^\[([A-Za-z][A-Za-z0-9]*\.\d+)\]\s+(.+?)$", re.MULTILINE)


def extract_cis_control_ids(text: str) -> dict[str, str]:
    """Return a dict of {control_id: title} from CIS version blocks.
    Title comes from the FIRST occurrence; later versions may use slightly different phrasing.
    """
    ids: dict[str, str] = {}
    for block in CIS_BLOCK_RE.findall(text):
        for m in CONTROL_ID_RE.finditer(block):
            cid = m.group(1)
            title = re.sub(r"\s+", " ", m.group(2)).strip()
            if cid not in ids:
                ids[cid] = title
    return ids


CONTROL_HEADER_RE = lambda cid: re.compile(
    rf"^\s*\[{re.escape(cid)}\]\s+(.+?)\s*$", re.MULTILINE
)


def find_control_body(text: str, cid: str) -> dict | None:
    """Locate a control's body section. The dedicated control page begins with
    a line `[CID] Title` AT THE START OF THE LINE and contains structured
    metadata (Category, Severity, Resource type, ...).
    The control listing lines in the version blocks ALSO match `[CID]` but
    are followed by the next bracketed control or end-of-block — they don't
    contain "Severity:" or "Category:". We use that to disambiguate.
    """
    pattern = re.compile(
        rf"\[{re.escape(cid)}\]\s+(?P<title>[^\n]+)\n(?P<body>.*?)(?=\n\[[A-Za-z][A-Za-z0-9]*\.\d+\][^\n]+\n|\nDocument history\n|\nStandards reference\s+\d+\n)",
        re.DOTALL,
    )
    best: dict | None = None
    for m in pattern.finditer(text):
        body = m.group("body")
        # Real control bodies contain at least Severity: and "checks whether"
        if "Severity:" in body and "Category:" in body:
            entry = {
                "title": re.sub(r"\s+", " ", m.group("title")).strip(),
                "body": body,
            }
            if best is None or len(body) > len(best["body"]):
                best = entry
    return best


def parse_severity(body: str) -> str:
    m = re.search(r"^\s*Severity:\s*(\w+)", body, re.MULTILINE)
    if not m:
        return "MEDIUM"
    val = m.group(1).upper()
    if val in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
        return val
    return "MEDIUM"


def parse_resource_type_field(body: str) -> str:
    m = re.search(r"^\s*Resource type:\s*([^\n]+)", body, re.MULTILINE)
    return m.group(1).strip() if m else ""


def classify(cid: str, resource_field: str) -> str:
    head = cid.split(".")[0].lower()
    if head in {"iam", "account", "accessanalyzer", "secretsmanager"}:
        return "IDENTITY"
    if head in {"s3", "rds", "efs", "kms", "dynamodb", "elasticache", "documentdb",
                 "redshift", "neptune", "backup", "cloudtrail", "athena"}:
        return "STORAGE"
    if head in {"lambda", "stepfunctions", "appsync", "apigateway", "appflow"}:
        return "SERVERLESS"
    return "COMPUTE"


def extract_first_paragraph(body: str) -> str:
    """Return the first 1-3 sentence description after the metadata block.
    Metadata lines look like: 'Category:', 'Severity:', 'Resource type:', etc.
    The description starts after the first blank line following these.
    """
    # Strip metadata block (first contiguous block of lines containing ':' near top)
    lines = body.splitlines()
    desc_lines: list[str] = []
    capture = False
    for ln in lines:
        s = ln.strip()
        if not capture:
            if s.startswith("This control checks") or s.startswith("This AWS control") or \
               s.startswith("This AWS Config rule") or s.startswith("This control"):
                capture = True
                desc_lines.append(s)
                continue
            continue
        if not s:
            if desc_lines:
                break
            continue
        # Stop when we hit another section heading
        if s.endswith(":") and len(s) < 40:
            break
        desc_lines.append(s)
        if len(" ".join(desc_lines)) > 600:
            break
    return re.sub(r"\s+", " ", " ".join(desc_lines)).strip()


def extract_remediation(body: str) -> str:
    m = re.search(
        r"\n\s*(Remediation|To remediate this issue|To resolve this finding)\s*\n+(?P<r>.*?)(?=\n\s*(See also|For more information|Learn more)\b|\Z)",
        body,
        re.DOTALL,
    )
    if not m:
        # Try shorter form
        m2 = re.search(r"To remediate this issue.*?(?:\n\n|\Z)", body, re.DOTALL)
        if not m2:
            return ""
        chunk = m2.group(0)
    else:
        chunk = m.group("r")
    chunk = re.sub(r"\s+", " ", chunk).strip()
    if len(chunk) > 800:
        chunk = chunk[:800].rsplit(".", 1)[0] + "."
    return chunk


def parse(text: str) -> list[dict]:
    cis_ids = extract_cis_control_ids(text)
    out: list[dict] = []
    for cid, listing_title in cis_ids.items():
        found = find_control_body(text, cid)
        title = found["title"] if found else listing_title
        body = found["body"] if found else ""
        severity = parse_severity(body) if body else "MEDIUM"
        resource_field = parse_resource_type_field(body)
        description = extract_first_paragraph(body) if body else listing_title
        remediation = extract_remediation(body) if body else ""
        out.append({
            "id": cid,
            "title": re.sub(r"\s+", " ", title).strip(),
            "description": description or listing_title,
            "rationale": description or listing_title,
            "remediation": remediation or "Refer to AWS Security Hub control documentation for remediation.",
            "severity": severity,
            "resourceType": classify(cid, resource_field),
            "awsResourceType": resource_field,
        })
    out.sort(key=lambda r: (r["id"].split(".")[0], int(r["id"].split(".")[1])))
    return out


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    in_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    text = in_path.read_text(encoding="utf-8", errors="ignore")
    rules = parse(text)
    out_path.write_text(json.dumps(rules, indent=2), encoding="utf-8")
    print(f"Parsed {len(rules)} CIS-tagged AWS controls -> {out_path.name}")
    by_prefix: dict[str, int] = {}
    for r in rules:
        head = r["id"].split(".")[0]
        by_prefix[head] = by_prefix.get(head, 0) + 1
    for k in sorted(by_prefix):
        print(f"  {k}: {by_prefix[k]} controls")


if __name__ == "__main__":
    main()
