"""Parse CIS Foundations Benchmark PDFs (extracted to text) into structured JSON.

Handles two CIS dialects:
  - "azure": flat numbering (1.1, 4.1.1) with sections Description / Rationale /
    Audit / Remediation / References / CIS Controls. No explicit severity.
  - "gcp": same shape, sometimes with extra fields. Same parser handles it.

For AWS Security Hub guide we use a different approach (see parse_aws.py).

Usage:
    python parse_cis.py <input.txt> <output.json> <platform>
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


RULE_HEAD_RE = re.compile(
    r"^(?P<num>\d+(?:\.\d+){1,3})\s+(?P<title>.+?)\s*\((?P<scored>Scored|Not Scored|Automated|Manual)\)\s*$"
)

SECTION_NAMES = [
    "Profile Applicability",
    "Description",
    "Rationale",
    "Impact",
    "Audit",
    "Remediation",
    "Default Value",
    "References",
    "CIS Controls",
]
SECTION_RE = re.compile(rf"^(?:{'|'.join(re.escape(s) for s in SECTION_NAMES)}):\s*$")

PAGE_FOOTER_RE = re.compile(r"^\s*\d+\s*\|\s*P\s*a\s*g\s*e\s*$", re.IGNORECASE)


def strip_pages(lines: list[str]) -> list[str]:
    return [ln for ln in lines if not PAGE_FOOTER_RE.match(ln)]


def join_continuation(raw: str) -> str:
    """Collapse rule headings that wrap across lines (e.g. trailing soft break).
    Two consecutive non-blank lines where the first does NOT end with '(Scored)' or
    '(Not Scored)' but the second STARTS with continuation text — merge them.
    Also unify a heading that has the title broken across lines before the (Scored).
    """
    lines = raw.splitlines()
    out: list[str] = []
    head_re = re.compile(r"^\s*(\d+(?:\.\d+){1,3})\s+(.+)$")
    i = 0
    while i < len(lines):
        cur = lines[i]
        m = head_re.match(cur)
        if m and not cur.rstrip().endswith(("(Scored)", "(Not Scored)", "(Automated)", "(Manual)")):
            # Look ahead and merge ONLY across consecutive non-blank lines.
            # Stop at the first blank line or at any line that itself looks like
            # a new numbered heading. This prevents section headings from
            # eating subsequent rule bodies.
            buf = [cur.rstrip()]
            j = i + 1
            merged_ok = False
            while j < len(lines) and j - i < 4:
                nxt_raw = lines[j]
                nxt = nxt_raw.strip()
                if not nxt:
                    break  # blank breaks the merge — section headers are blank-separated
                if head_re.match(nxt_raw):
                    break  # next line is its own heading, do not consume it
                buf.append(nxt)
                if nxt.endswith(("(Scored)", "(Not Scored)", "(Automated)", "(Manual)")):
                    merged_ok = True
                    j += 1
                    break
                j += 1
            if merged_ok:
                out.append(" ".join(buf))
                i = j
                continue
        out.append(cur)
        i += 1
    return "\n".join(out)


def parse(text: str) -> list[dict]:
    """Parse the extracted text into rule dicts."""
    text = join_continuation(text)
    lines = strip_pages(text.splitlines())

    rules: list[dict] = []
    cur: dict | None = None
    cur_section: str | None = None
    section_buf: dict[str, list[str]] = {}

    def flush_section():
        if cur and cur_section:
            cur[cur_section] = "\n".join(section_buf[cur_section]).strip()

    def flush_rule():
        nonlocal cur, cur_section
        if cur is None:
            return
        flush_section()
        rules.append(cur)
        cur = None
        cur_section = None

    for ln in lines:
        stripped = ln.strip()

        head = RULE_HEAD_RE.match(stripped)
        if head:
            flush_rule()
            cur = {
                "id": head.group("num"),
                "title": head.group("title").strip(),
                "scored": head.group("scored") in ("Scored", "Automated"),
            }
            section_buf = {name: [] for name in SECTION_NAMES}
            cur_section = None
            continue

        sect = SECTION_RE.match(stripped)
        if sect and cur is not None:
            flush_section()
            cur_section = stripped[:-1].strip()  # drop trailing ":"
            continue

        if cur is not None and cur_section is not None:
            section_buf[cur_section].append(ln)

    flush_rule()
    return rules


def map_severity(rule: dict) -> str:
    """Heuristic severity mapping. CIS Azure v1.0.0 uses Profile Levels, not severities.
    We map: Level 2 -> HIGH, Level 1 -> MEDIUM, downgrade boring policy hygiene to LOW,
    upgrade obvious data-exposure / public-access / root-account / encryption gaps.
    """
    title = rule.get("title", "").lower()
    rationale = rule.get("Rationale", "").lower()
    text = title + " " + rationale

    critical_kw = [
        "publicly accessible", "public access", "0.0.0.0/0", "open to the internet",
        "root user", "wildcard", "encrypted at rest", "encryption is not", "no mfa for root",
    ]
    high_kw = [
        "multi-factor", "mfa", "ssh ", "rdp ", "privileged", "admin", "key rotation",
        "secrets", "kms", "auditing", "logging", "tls", "ssl", "https",
    ]
    low_kw = [
        "expir", "retention", "tags", "naming", "alert exists", "log profile",
    ]

    if any(k in text for k in critical_kw):
        return "CRITICAL"
    if any(k in text for k in high_kw):
        return "HIGH"
    if any(k in text for k in low_kw):
        return "LOW"

    profile = rule.get("Profile Applicability", "").lower()
    if "level 2" in profile:
        return "HIGH"
    return "MEDIUM"


def classify_resource_type(section_id: str, title: str, platform: str) -> str:
    """Map a rule to one of: IDENTITY, STORAGE, COMPUTE, SERVERLESS.
    Falls back by section number which corresponds to the chapter in the benchmark.
    """
    t = title.lower()
    sec = section_id.split(".")[0]

    if platform == "azure":
        return {
            "1": "IDENTITY",
            "2": "COMPUTE",   # Security Center applies broadly; bucket under COMPUTE
            "3": "STORAGE",
            "4": "STORAGE",   # SQL services
            "5": "COMPUTE",   # Logging & monitoring
            "6": "COMPUTE",   # Networking
            "7": "COMPUTE",   # Virtual Machines
            "8": "IDENTITY",  # Keys / secrets / locks
        }.get(sec, "COMPUTE")

    if platform == "gcp":
        return {
            "1": "IDENTITY",       # IAM
            "2": "COMPUTE",        # Logging & Monitoring
            "3": "COMPUTE",        # Networking
            "4": "COMPUTE",        # VM Instances
            "5": "STORAGE",        # Storage
            "6": "STORAGE",        # Cloud SQL DB Services
            "7": "STORAGE",        # BigQuery
            "8": "COMPUTE",        # Logging
        }.get(sec, "COMPUTE")

    return "COMPUTE"


def normalize_rule(rule: dict, platform: str) -> dict:
    title = re.sub(r"\s+", " ", rule.get("title", "")).strip()
    description = re.sub(r"\s+", " ", rule.get("Description", "")).strip()
    rationale = re.sub(r"\s+", " ", rule.get("Rationale", "")).strip()
    remediation = re.sub(r"\s+", " ", rule.get("Remediation", "")).strip()
    profile = re.sub(r"\s+", " ", rule.get("Profile Applicability", "")).strip()

    rule_id = rule["id"]
    cis_id = f"CIS-{platform.upper()}-{rule_id}"

    return {
        "id": cis_id,
        "cis_section": rule_id,
        "title": title,
        "description": description or title,
        "rationale": rationale or description or title,
        "remediation": remediation or "Refer to the CIS benchmark remediation steps for this control.",
        "severity": map_severity({
            "title": title,
            "Rationale": rationale,
            "Profile Applicability": profile,
        }),
        "scored": rule.get("scored", True),
        "profile": profile,
        "resourceType": classify_resource_type(rule_id, title, platform),
    }


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    in_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    platform = sys.argv[3].lower()

    text = in_path.read_text(encoding="utf-8", errors="ignore")
    raw_rules = parse(text)

    # Drop rules whose title contains another rule numbering pattern (e.g. "6.3.1")
    # — those are section headings that got merged with their first child rule.
    inner_num_re = re.compile(r"\b\d+\.\d+(\.\d+)?\b")
    raw_rules = [r for r in raw_rules if not inner_num_re.search(r["title"])]

    # Drop rules with empty titles (section headers that lost their content).
    raw_rules = [r for r in raw_rules if r["title"].strip()]

    # Drop rules where the ID is a strict prefix of another rule's ID — those
    # are sub-section headings (e.g. "6.2" when "6.2.1" exists). A real CIS rule
    # title always starts with a verb like "Ensure ..." — so as a stronger
    # signal we also drop any rule whose title does NOT start with "Ensure".
    all_ids = {r["id"] for r in raw_rules}
    def is_prefix_of_another(rid: str) -> bool:
        return any(other != rid and other.startswith(rid + ".") for other in all_ids)
    raw_rules = [
        r for r in raw_rules
        if not is_prefix_of_another(r["id"])
        and r["title"].strip().lower().startswith(("ensure ", "use ", "limit ", "restrict "))
    ]

    # Dedupe by id — both TOC entries and body entries match the heading regex.
    # Keep whichever entry has the longest combined Description/Rationale/Remediation.
    by_id: dict[str, dict] = {}
    for r in raw_rules:
        score = sum(len(r.get(k, "")) for k in ("Description", "Rationale", "Remediation"))
        if r["id"] not in by_id or score > by_id[r["id"]]["__score"]:
            r["__score"] = score
            by_id[r["id"]] = r
    for r in by_id.values():
        r.pop("__score", None)

    raw_rules = sorted(
        by_id.values(),
        key=lambda r: tuple(int(p) for p in r["id"].split(".")),
    )
    norm = [normalize_rule(r, platform) for r in raw_rules]

    out_path.write_text(json.dumps(norm, indent=2), encoding="utf-8")
    print(f"Parsed {len(norm)} rules from {in_path.name} -> {out_path.name}")
    by_section = {}
    for r in norm:
        sec = r["cis_section"].split(".")[0]
        by_section[sec] = by_section.get(sec, 0) + 1
    for sec in sorted(by_section.keys(), key=int):
        print(f"  Section {sec}: {by_section[sec]} rules")


if __name__ == "__main__":
    main()
