from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

services = json.loads((ROOT / "data" / "services.json").read_text(encoding="utf-8"))
app = (ROOT / "app.js").read_text(encoding="utf-8")

match = re.search(r"const groups = \[(.*?)\];", app, re.S)
groups = re.findall(r'"(.*?)"', match.group(1)) if match else []
app_groups = [group for group in groups if group != "全部"]
service_groups = sorted({service["service_group"] for service in services})

old_groups = [
    "TLS / HTTPS 安全策略",
    "DNSSEC",
    "证书与 TLS",
    "代码签名",
    "支付密码学",
    "无直接密码套件配置",
]
services_text = (ROOT / "data" / "services.json").read_text(encoding="utf-8")

print("app_groups:", app_groups)
print("service_groups:", service_groups)
print("missing_in_app:", sorted(set(service_groups) - set(app_groups)))
print("unused_app_groups:", sorted(set(app_groups) - set(service_groups)))
print("old_group_leftovers:", [group for group in old_groups if group in services_text])
print("service_group_counts:")
for group, count in Counter(service["service_group"] for service in services).items():
    print(f"  {count} {group}")
