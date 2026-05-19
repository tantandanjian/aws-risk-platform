from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "en_config_items.json"
TARGET = ROOT / "data" / "new_config_items.json"


RISK_LABELS = {
    "legacy_protocol_or_policy": "旧协议或兼容性策略风险",
    "weak_or_compatibility_cipher_profile": "弱密码套件或兼容性 cipher 风险",
    "certificate_lifecycle_or_identity_mismatch": "证书生命周期或身份匹配风险",
    "in_transit_encryption_governance_gap": "传输加密治理缺口",
    "dnssec_integrity_or_chain_of_trust_gap": "DNSSEC 完整性或信任链缺口",
    "vpn_ipsec_weak_crypto": "VPN/IPsec 弱密码配置风险",
    "vpn_authentication_secret_or_certificate_gap": "VPN 认证密钥或证书治理缺口",
    "vpn_tls_certificate_governance_gap": "VPN TLS 证书治理缺口",
    "service_discovery_encryption_boundary_gap": "服务发现加密边界误判风险",
    "kms_key_spec_usage_mismatch": "KMS 密钥类型或用途不匹配风险",
    "kms_key_material_origin_or_residency_gap": "KMS 密钥材料来源或驻留治理缺口",
    "kms_rotation_policy_gap": "KMS 密钥轮换策略缺口",
    "kms_key_policy_governance_gap": "KMS 密钥策略治理缺口",
    "hsm_mode_or_mechanism_misconfiguration": "HSM 模式或密码机制配置风险",
    "hsm_key_attribute_or_ownership_gap": "HSM 密钥属性或所有权治理缺口",
    "certificate_private_key_export_gap": "证书私钥导出治理缺口",
    "code_signing_algorithm_or_profile_gap": "代码签名算法或 profile 治理缺口",
    "client_side_encryption_sdk_misconfiguration": "客户端加密 SDK 配置风险",
    "payment_crypto_key_attribute_mismatch": "支付密码密钥属性不匹配风险",
    "payment_crypto_key_exchange_or_export_gap": "支付密钥交换或导出治理缺口",
    "payment_crypto_operation_scope_gap": "支付密码操作范围隔离缺口",
    "payment_crypto_boundary_or_transport_gap": "支付密码边界或传输安全缺口",
    "direct_connect_macsec_gap": "Direct Connect MACsec 治理缺口",
    "managed_interconnect_encryption_boundary_gap": "托管互联加密边界缺口",
    "mesh_tls_or_mtls_governance_gap": "服务网格 TLS/mTLS 治理缺口",
    "rtb_fabric_tls_or_trust_boundary_gap": "应用网络 TLS 或信任边界缺口",
    "verified_access_tls_or_backend_boundary_gap": "Verified Access TLS 或后端边界缺口",
    "iam_long_term_credential_or_certificate_gap": "IAM 长期凭证或证书治理缺口",
    "managed_directory_crypto_boundary_gap": "托管目录密码边界治理缺口",
    "secrets_manager_encryption_or_rotation_gap": "Secrets Manager 加密或轮换治理缺口",
    "iam_identity_center_federation_certificate_or_token_gap": "IAM Identity Center 联邦证书或令牌治理缺口",
    "macie_results_encryption_or_sample_access_gap": "Macie 结果加密或样本访问治理缺口",
    "security_lake_encryption_or_access_boundary_gap": "Security Lake 加密或访问边界缺口",
    "verified_permissions_kms_or_token_validation_gap": "Verified Permissions KMS 或令牌校验缺口",
    "guardduty_findings_export_encryption_gap": "GuardDuty 发现结果导出加密缺口",
    "audit_manager_evidence_encryption_gap": "Audit Manager 证据加密治理缺口",
    "detective_managed_encryption_or_export_boundary_gap": "Detective 托管加密或导出边界缺口",
}


RISK_IMPACTS = {
    "legacy_protocol_or_policy": "可能允许 SSL/TLS 旧版本或兼容性策略继续生效，增加降级攻击、弱加密协商和明文链路暴露的可能性。",
    "weak_or_compatibility_cipher_profile": "可能保留 CBC、SHA1、缺少前向保密或其他兼容性 cipher，使 TLS 连接无法达到现代密码基线。",
    "certificate_lifecycle_or_identity_mismatch": "可能导致证书过期、域名不匹配、证书链不完整或客户端信任失败，从而削弱 TLS 身份校验。",
    "in_transit_encryption_governance_gap": "可能缺少对明文流量的发现、监控和强制能力，使传输加密要求难以落地。",
    "dnssec_integrity_or_chain_of_trust_gap": "可能导致 DNS 响应完整性无法验证，或因 KSK/KMS/DS 链路配置错误破坏 DNSSEC 信任链。",
    "vpn_ipsec_weak_crypto": "可能保留旧 IKE 版本、弱 DH group、SHA1 或非 AEAD 加密，降低 VPN 隧道的密码强度。",
    "vpn_authentication_secret_or_certificate_gap": "可能导致 PSK、私有证书或证书链缺少安全存储、轮换和生命周期治理。",
    "vpn_tls_certificate_governance_gap": "可能导致远程接入 VPN 的证书、CRL、客户端私钥或认证规则失控。",
    "service_discovery_encryption_boundary_gap": "可能把服务发现误认为加密边界，导致真正的数据传输链路没有落实 TLS 或 DNS 完整性控制。",
    "kms_key_spec_usage_mismatch": "可能导致密钥类型、用途或算法与业务场景不匹配，造成密钥误用或 AWS 服务集成失败。",
    "kms_key_material_origin_or_residency_gap": "可能使密钥材料来源、外部密钥库、自定义密钥库或多区域策略与可用性、驻留和合规要求不一致。",
    "kms_rotation_policy_gap": "可能让密钥长期不轮换，或误以为不支持自动轮换的密钥类型已经被自动治理。",
    "kms_key_policy_governance_gap": "可能扩大密钥管理或使用权限，甚至造成策略锁定、越权使用或缺少算法约束。",
    "hsm_mode_or_mechanism_misconfiguration": "可能在 HSM 中长期使用 DES3、SHA1、RSA-PKCS、AES-ECB 等兼容性机制。",
    "hsm_key_attribute_or_ownership_gap": "可能让敏感密钥可导出、可被过度使用，或因 CU 所有权不清导致 HSM 隔离目标被削弱。",
    "certificate_private_key_export_gap": "可能扩大证书私钥离开 ACM 后的信任边界，增加私钥泄露、弱口令和吊销流程缺失风险。",
    "code_signing_algorithm_or_profile_gap": "可能使用旧签名算法、过长有效期或过宽签名权限，扩大制品签名被滥用后的影响范围。",
    "client_side_encryption_sdk_misconfiguration": "可能削弱 key commitment、keyring 边界、字段级加密动作或可搜索加密泄露面控制。",
    "payment_crypto_key_attribute_mismatch": "可能让支付密钥算法、用途或操作模式过宽，不满足支付场景的最小权限和密钥分离要求。",
    "payment_crypto_key_exchange_or_export_gap": "可能让支付密钥导入导出路径、key block 格式或 KEK 生命周期不符合安全与合规要求。",
    "payment_crypto_operation_scope_gap": "可能在 PIN、CVV、MAC、数据加密或测试/生产环境之间复用密钥和权限，削弱审计与隔离。",
    "payment_crypto_boundary_or_transport_gap": "可能误解 HSM 边界或 API 传输边界，导致客户端 TLS、PrivateLink 或敏感元数据治理不足。",
    "direct_connect_macsec_gap": "可能让专线链路缺少 MACsec 加密、密钥轮换或连接状态监控。",
    "managed_interconnect_encryption_boundary_gap": "可能把托管互联或私有连接误认为默认端到端加密边界，忽略上层 TLS/IPsec 控制。",
    "mesh_tls_or_mtls_governance_gap": "可能导致服务网格内东西向流量缺少 TLS/mTLS、证书轮换或信任域治理。",
    "rtb_fabric_tls_or_trust_boundary_gap": "可能导致应用网络、服务网络或后端目标之间的 TLS 与信任边界不清晰。",
    "verified_access_tls_or_backend_boundary_gap": "可能只保护入口访问而忽略后端 TLS、设备信任、身份上下文或目标组边界。",
    "iam_long_term_credential_or_certificate_gap": "可能让长期访问密钥、签名证书或服务凭证缺少轮换、吊销和最小权限治理。",
    "managed_directory_crypto_boundary_gap": "可能误判托管目录服务的密码边界，忽略 LDAP/TLS、Kerberos、证书或同步链路安全。",
    "secrets_manager_encryption_or_rotation_gap": "可能导致 secret 缺少合适 KMS 加密、自动轮换、访问边界或敏感字段治理。",
    "iam_identity_center_federation_certificate_or_token_gap": "可能导致联邦证书、SAML/OIDC 令牌、会话时长或身份提供方信任链治理不足。",
    "macie_results_encryption_or_sample_access_gap": "可能导致敏感数据发现结果、样本或导出内容缺少加密和访问控制。",
    "security_lake_encryption_or_access_boundary_gap": "可能让安全日志湖数据的 KMS 加密、跨账户访问或订阅边界不清晰。",
    "verified_permissions_kms_or_token_validation_gap": "可能导致策略存储加密、授权令牌校验或身份上下文验证不足。",
    "guardduty_findings_export_encryption_gap": "可能让威胁发现结果导出到 S3 或跨账户时缺少加密和访问治理。",
    "audit_manager_evidence_encryption_gap": "可能导致审计证据、评估导出或跨服务访问缺少加密和权限边界。",
    "detective_managed_encryption_or_export_boundary_gap": "可能误判 Detective 托管加密边界，或在导出分析数据时缺少额外加密和访问控制。",
}


def short(value: object, limit: int = 170) -> str:
    parts = [part.strip() for part in str(value or "").replace("\n", "；").split("；") if part.strip()]
    text = "；".join(parts)
    if len(text) > limit:
        return text[:limit].rstrip() + "…"
    return text or "未列出"


def main() -> None:
    items = json.loads(SOURCE.read_text(encoding="utf-8"))
    for item in items:
        risk_type = item.get("risk_type", "")
        risk_name = RISK_LABELS.get(risk_type, "密码学配置风险")
        impact = RISK_IMPACTS.get(risk_type, "可能导致密码能力降级、治理边界变宽或与业务用途不匹配。")
        config_item = item.get("configuration_item") or "该配置项"
        risky = short(item.get("risky_values"))
        recommended = short(item.get("recommended_values"))

        item["risk_reason"] = (
            f"{config_item} 属于“{risk_name}”。如果配置为风险值（{risky}），{impact}"
            "因此需要将这些值视为需要整改、替换或明确例外审批的配置。"
        )
        item["security_value_reason"] = (
            f"建议采用推荐值（{recommended}）。这些配置更符合现代密码学基线、最小权限和托管生命周期治理要求，"
            "有助于降低弱协议、弱算法、密钥误用、证书失效或加密边界不清带来的风险；实际落地时仍应结合业务兼容性和合规要求验证。"
        )

    TARGET.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {TARGET} with {len(items)} Chinese risk explanations.")


if __name__ == "__main__":
    main()
