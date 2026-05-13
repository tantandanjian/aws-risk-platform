from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

import openpyxl


SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
DATA = SITE / "data"


def clean(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()


def docx_text(path: Path) -> str:
    out = []
    with zipfile.ZipFile(path) as zf:
        for name in zf.namelist():
            if name.startswith("word/") and name.endswith(".xml"):
                try:
                    root = ET.fromstring(zf.read(name))
                except ET.ParseError:
                    continue
                for node in root.iter():
                    if node.tag.endswith("}t") and node.text:
                        out.append(node.text)
    return clean(" ".join(out))


def xlsx_rows(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    for ws in wb.worksheets:
        rows = []
        for row in ws.iter_rows(values_only=True):
            vals = [clean(v) for v in row]
            if any(vals):
                rows.append(vals)
        yield ws.title, rows


def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def sniff_mojibake(text: str) -> bool:
    markers = ["é", "æ", "ç", "å", "è", "î", "â‚", "ã", "Ñ"]
    return sum(text.count(m) for m in markers) >= 2


def main():
    services = load_json("services.json")
    risks = load_json("risk_types.json")
    items = load_json("config_items.json")

    print("JSON counts:", len(services), "services,", len(risks), "risk types,", len(items), "config items")
    print("Service ids:", ", ".join(s["service_id"] for s in services))
    print()

    by_service = defaultdict(list)
    for item in items:
        by_service[item["service_id"]].append(item)
    print("Config counts by service:")
    for sid, count in sorted((sid, len(vals)) for sid, vals in by_service.items()):
        print(f"  {sid}: {count}")
    print()

    print("Mojibake scan:")
    for name, records in [("services", services), ("risk_types", risks), ("config_items", items)]:
        total = 0
        bad = 0
        fields = Counter()
        for rec in records:
            for k, v in rec.items():
                if isinstance(v, str):
                    total += 1
                    if sniff_mojibake(v):
                        bad += 1
                        fields[k] += 1
        print(f"  {name}: {bad}/{total} text fields look mojibaked; top fields {fields.most_common(8)}")
    print()

    print("Key JSON rows:")
    for sid in ["alb", "nlb", "kms", "cloudhsm"]:
        print(f"## {sid}")
        for item in by_service.get(sid, []):
            print(json.dumps({
                "configuration_item": item.get("configuration_item"),
                "api_endpoint": item.get("api_endpoint"),
                "recommended_values": item.get("recommended_values"),
                "risky_values": item.get("risky_values"),
                "risk_type": item.get("risk_type"),
                "risk_level": item.get("risk_level"),
                "references": item.get("references"),
            }, ensure_ascii=False))
        print()

    print("Workbook summaries matching ALB/NLB/KMS/HSM:")
    keywords = ["ALB", "NLB", "KMS", "HSM", "ELB", "TLS", "SslPolicy"]
    for path in sorted(ROOT.glob("*.xlsx")):
        name = path.name
        if not any(k.lower() in name.lower() for k in keywords):
            continue
        print(f"### {name}")
        for sheet, rows in xlsx_rows(path):
            print(f"  Sheet {sheet}: {len(rows)} non-empty rows")
            for row in rows[:12]:
                joined = " | ".join(row[:8])
                print(f"    {joined[:260]}")
        print()

    print("Docx hits:")
    for path in sorted(ROOT.glob("*.docx")):
        if path.name.startswith("~$"):
            continue
        text = docx_text(path)
        hits = [k for k in ["ALB", "NLB", "ELB", "KMS", "CloudHSM", "HSM", "TLS", "SslPolicy"] if k.lower() in text.lower()]
        if hits:
            print(f"### {path.name}: {', '.join(hits)}")
            for k in hits:
                i = text.lower().find(k.lower())
                print(f"  {k}: {text[max(0, i-80): i+220]}")
            print()


if __name__ == "__main__":
    main()
