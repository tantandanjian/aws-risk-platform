from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def save(name: str, records):
    (DATA / name).write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug(value: str) -> str:
    value = value.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:64]


def make_item(service_id, config, api, recommended, risky, risk_type, level, reason, safe_reason, refs):
    return {
        "item_id": f"{service_id}_{slug(config)}",
        "service_id": service_id,
        "configuration_item": config,
        "api_endpoint": api,
        "recommended_values": recommended,
        "risky_values": risky,
        "risk_type": risk_type,
        "risk_level": level,
        "risk_reason": reason,
        "security_value_reason": safe_reason,
        "references": refs,
    }


ELB_RECOMMENDED = (
    "ELBSecurityPolicy-TLS13-1-3-2021-06; "
    "ELBSecurityPolicy-TLS13-1-3-PQ-2025-09; "
    "ELBSecurityPolicy-TLS13-1-2-Res-2021-06; "
    "ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09; "
    "ELBSecurityPolicy-TLS13-1-3-FIPS-2023-04; "
    "ELBSecurityPolicy-TLS13-1-3-FIPS-PQ-2025-09; "
    "ELBSecurityPolicy-TLS13-1-2-Res-FIPS-2023-04; "
    "ELBSecurityPolicy-TLS13-1-2-Res-FIPS-PQ-2025-09; "
    "ELBSecurityPolicy-FS-1-2-Res-2020-10"
)

ELB_RISKY_ALB = (
    "ELBSecurityPolicy-TLS13-1-2-2021-06; "
    "ELBSecurityPolicy-TLS13-1-2-PQ-2025-09; "
    "ELBSecurityPolicy-TLS13-1-2-Ext2-2021-06; "
    "ELBSecurityPolicy-TLS13-1-2-Ext2-PQ-2025-09; "
    "ELBSecurityPolicy-TLS13-1-2-Ext1-2021-06; "
    "ELBSecurityPolicy-TLS13-1-2-Ext1-PQ-2025-09; "
    "ELBSecurityPolicy-TLS13-1-1-2021-06; "
    "ELBSecurityPolicy-TLS13-1-0-2021-06; "
    "ELBSecurityPolicy-TLS13-1-0-PQ-2025-09; "
    "ELBSecurityPolicy-TLS-1-2-Ext-2018-06; "
    "ELBSecurityPolicy-TLS-1-2-2017-01; "
    "ELBSecurityPolicy-TLS-1-1-2017-01; "
    "ELBSecurityPolicy-2016-08; "
    "FIPS Ext/Ext0/Ext1/Ext2 or TLS 1.1/1.0 policies where they introduce CBC, SHA1, TLS 1.0/1.1, or non-FS compatibility"
)

ELB_RISKY_NLB = ELB_RISKY_ALB + "; ELBSecurityPolicy-2015-05"

ELB_REASON = (
    "主工作日报 0410/0413 的 TLS 表将 TLS 1.0/1.1、CBC、SHA1、缺少前向安全或偏兼容的安全策略标为风险；"
    "总结表把 TLS 1.3-only、Res、PQ、FIPS Res 和 FS Res 作为更优先的安全策略。"
)

ELB_SAFE = (
    "优先选择 TLS 1.3-only 或 TLS 1.2/1.3 Res/PQ/FIPS Res 策略；若因客户端兼容必须使用 Ext/旧策略，应记录例外并限制范围。"
)

VPN_REASON = (
    "Site-to-Site VPN 的风险集中在 IKE 版本、Phase 1/2 加密算法、完整性算法和 DH 组。"
    "0410 工作日报列出了这些配置项，但推荐/风险列对 IKE、SHA、DH 等存在反向填写；AWS 官方最佳实践强烈建议 IKEv2，并支持 SHA2、AES-GCM 和更高 DH 组。"
)

VPN_SAFE = (
    "按 AWS 官方最佳实践使用 IKEv2、AES-GCM 或强 AES 配置、SHA2-256 及以上完整性算法，以及 DH group 14/19/20/21 等更高强度组。"
)


def main():
    services = load("services.json")
    items = load("config_items.json")
    risks = load("risk_types.json")

    items = [it for it in items if it["service_id"] not in {"alb", "nlb", "vpn-site-to-site"}]

    items.extend([
        make_item(
            "alb",
            "ELB Application Load Balancer SSL security policy",
            "CreateListener.SslPolicy / ModifyListener.SslPolicy",
            ELB_RECOMMENDED,
            ELB_RISKY_ALB,
            "TLS 安全策略过旧风险",
            "高",
            ELB_REASON,
            ELB_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx 总结/TLS/FIPS/FS 表；https://docs.aws.amazon.com/elasticloadbalancing/latest/application/describe-ssl-policies.html",
        ),
        make_item(
            "alb",
            "HTTPS listener certificate",
            "Listener.Certificates / modify-listener --certificates",
            "ACM-managed certificate; valid certificate chain; certificate matches domain",
            "Expired certificate; weak or unmanaged imported certificate; domain mismatch",
            "证书管理风险",
            "中",
            "ALB HTTPS listener 需要绑定服务器证书；证书过期、链错误或域名不匹配会导致身份认证失败或连接不可用。",
            "使用 ACM 托管证书并监控续期，确保域名、证书链和私钥算法满足目标服务要求。",
            "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html ; https://docs.aws.amazon.com/acm/latest/userguide/acm-services.html",
        ),
        make_item(
            "nlb",
            "ELB Network Load Balancer TLS security policy",
            "CreateListener.SslPolicy / ModifyListener.SslPolicy",
            ELB_RECOMMENDED,
            ELB_RISKY_NLB,
            "TLS 安全策略过旧风险",
            "高",
            ELB_REASON,
            ELB_SAFE,
            "张聪艺工作日报0413_NLB.xlsx 总结/TLS/FIPS/FS 表；https://docs.aws.amazon.com/elasticloadbalancing/latest/network/describe-ssl-policies.html",
        ),
        make_item(
            "nlb",
            "TLS listener certificate",
            "Listener.Certificates",
            "ACM certificate; valid certificate chain; certificate matches domain",
            "Expired certificate; unmanaged imported certificate; certificate mismatch",
            "证书管理风险",
            "中",
            "NLB TLS listener 需要证书完成服务端身份认证；证书生命周期或链配置错误会破坏 TLS 信任。",
            "使用 ACM 证书，保持证书链完整，并对导入证书设置续期和监控流程。",
            "https://docs.aws.amazon.com/elasticloadbalancing/latest/network/create-tls-listener.html ; https://docs.aws.amazon.com/acm/latest/userguide/acm-services.html",
        ),
        make_item(
            "vpn-site-to-site",
            "IKE version",
            "modify-vpn-tunnel-options.IKEVersions",
            "ikev2",
            "ikev1 unless required for legacy customer gateway compatibility",
            "VPN / IPsec 参数风险",
            "高",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1/总结；https://docs.aws.amazon.com/vpn/latest/s2svpn/cgw-best-practice.html ; https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
        make_item(
            "vpn-site-to-site",
            "Phase 1 encryption algorithms",
            "modify-vpn-tunnel-options.Phase1EncryptionAlgorithms",
            "AES256-GCM-16; AES128-GCM-16; AES256 where GCM is not supported",
            "Weak or compatibility-only choices; allowing broad algorithm negotiation without need",
            "VPN / IPsec 参数风险",
            "中",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1；https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
        make_item(
            "vpn-site-to-site",
            "Phase 2 encryption algorithms",
            "modify-vpn-tunnel-options.Phase2EncryptionAlgorithms",
            "AES256-GCM-16; AES128-GCM-16; AES256 where GCM is not supported",
            "Weak or compatibility-only choices; allowing broad algorithm negotiation without need",
            "VPN / IPsec 参数风险",
            "中",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1；https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
        make_item(
            "vpn-site-to-site",
            "Phase 1 integrity algorithms",
            "modify-vpn-tunnel-options.Phase1IntegrityAlgorithms",
            "SHA2-256; SHA2-384; SHA2-512",
            "SHA1 retained without compatibility requirement",
            "VPN / IPsec 参数风险",
            "中",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1；https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
        make_item(
            "vpn-site-to-site",
            "Phase 2 integrity algorithms",
            "modify-vpn-tunnel-options.Phase2IntegrityAlgorithms",
            "SHA2-256; SHA2-384; SHA2-512",
            "SHA1 retained without compatibility requirement",
            "VPN / IPsec 参数风险",
            "中",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1；https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
        make_item(
            "vpn-site-to-site",
            "Phase 1 Diffie-Hellman groups",
            "modify-vpn-tunnel-options.Phase1DHGroupNumbers",
            "14 or above; prefer 19/20/21 where supported",
            "Group 2 retained without compatibility requirement",
            "VPN / IPsec 参数风险",
            "中",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1；https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
        make_item(
            "vpn-site-to-site",
            "Phase 2 Diffie-Hellman groups",
            "modify-vpn-tunnel-options.Phase2DHGroupNumbers",
            "14 or above; prefer 19/20/21 where supported",
            "Group 2 or 5 retained without compatibility requirement",
            "VPN / IPsec 参数风险",
            "中",
            VPN_REASON,
            VPN_SAFE,
            "张聪艺_工作日报0410_ALB完整统计.xlsx Sheet1；https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-vpn-tunnel-options.html",
        ),
    ])

    by_id = {svc["service_id"]: svc for svc in services}
    by_id.setdefault("vpn-site-to-site", {
        "service_id": "vpn-site-to-site",
        "service": "AWS Site-to-Site VPN",
        "aws_category": "Networking & Content Delivery",
        "service_group": "VPN / IPsec",
        "crypto_category": "IPsec; IKE; Encryption; Integrity; Diffie-Hellman",
        "configurable_status": "可配置",
        "main_focus": "IKEVersions; Phase1/Phase2 encryption algorithms; Phase1/Phase2 integrity algorithms; Phase1/Phase2 DH groups",
        "typical_risks": "VPN / IPsec 参数风险",
        "service_intro": "AWS Site-to-Site VPN 使用 IPsec 隧道连接本地网络与 AWS。密码相关配置集中在 IKE 版本、阶段 1/2 加密算法、完整性算法和 Diffie-Hellman 组。",
        "detail_path": "#/services/vpn-site-to-site",
    })
    by_id["alb"].update({
        "main_focus": "CreateListener.SslPolicy / ModifyListener.SslPolicy; HTTPS listener certificate",
        "typical_risks": "TLS 安全策略过旧风险; 证书管理风险",
        "service_intro": "Application Load Balancer 属于 Elastic Load Balancing。根据 0410 总结表，ALB 的重点是 ELB Security Policy：TLS 1.3-only、Res、PQ、FIPS Res 和 FS Res 更推荐，兼容性策略、TLS 1.0/1.1、CBC/SHA1 或非前向安全套件应作为风险或例外处理。",
    })
    by_id["nlb"].update({
        "main_focus": "CreateListener.SslPolicy / ModifyListener.SslPolicy; TLS listener certificate",
        "typical_risks": "TLS 安全策略过旧风险; 证书管理风险",
        "service_intro": "Network Load Balancer 的 TLS listener 可配置 ELB Security Policy。根据 0413 NLB 工作日报，NLB 与 ALB 使用同类策略判断：优先 TLS 1.3-only、Res/PQ/FIPS Res/FS Res，避免 TLS 1.0/1.1、CBC、SHA1 和非前向安全套件。",
    })

    existing_order = [svc["service_id"] for svc in services]
    if "vpn-site-to-site" not in existing_order:
        existing_order.append("vpn-site-to-site")
    services = [by_id[sid] for sid in existing_order if sid in by_id]

    if not any(r["risk_id"] == "vpn-ipsec" for r in risks):
        risks.append({
            "risk_id": "vpn-ipsec",
            "risk_type": "VPN / IPsec 参数风险",
            "risk_description": "Site-to-Site VPN 中 IKE 版本、Phase 1/2 加密算法、完整性算法和 DH 组配置偏弱或过度兼容，会降低 IPsec 隧道安全基线。",
            "related_services": "AWS Site-to-Site VPN",
            "typical_risky_values": "ikev1; SHA1; DH group 2/5; weak or overly broad algorithm negotiation",
            "recommended_direction": "优先 IKEv2、AES-GCM、SHA2-256 及以上、DH group 14+，并仅为遗留设备保留例外。",
            "notes": "根据 0410 工作日报列出的 VPN 配置项，并结合 AWS 官方最佳实践校准推荐/风险方向。",
        })

    save("services.json", services)
    save("config_items.json", items)
    save("risk_types.json", risks)
    print(f"services={len(services)} config_items={len(items)} risk_types={len(risks)}")


if __name__ == "__main__":
    main()
