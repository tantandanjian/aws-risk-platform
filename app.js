const state = {
  services: [],
  items: [],
  riskTypes: [],
  activeGroup: "全部",
  query: "",
};

const groups = [
  "全部",
  "TLS / 安全策略",
  "DNSSEC / 完整性",
  "密钥管理",
  "HSM / 密码机制",
  "证书管理",
  "数字签名",
  "客户端加密 SDK",
  "支付密码",
  "VPN / IPsec",
  "不可直接配置",
];

const groupGuide = [
  ["TLS / 安全策略", "涉及 TLS 版本、安全策略、HTTPS listener、Viewer TLS policy 等配置", "CloudFront、ALB、NLB"],
  ["DNSSEC / 完整性", "涉及 DNS 响应完整性保护", "Route 53"],
  ["密钥管理", "涉及云端密钥创建、用途、规格、轮换和来源", "KMS"],
  ["HSM / 密码机制", "涉及 HSM、PKCS#11、JCE、CNG 等密码机制", "CloudHSM"],
  ["证书管理", "涉及证书申请、导入、验证、续期和绑定", "ACM"],
  ["数字签名", "涉及代码签名、签名 profile 和签名权限", "AWS Signer"],
  ["客户端加密 SDK", "涉及本地加密、keyring、algorithm suite、commitment policy", "AWS Encryption SDK、Database Encryption SDK、S3 Encryption Client"],
  ["支付密码", "涉及支付场景下的密钥、PIN、CVV、TR-31/TR-34 等密码能力", "AWS Payment Cryptography"],
  ["VPN / IPsec", "涉及 IKE、IPsec、Phase 1/2 加密与完整性算法、DH 组", "AWS Site-to-Site VPN"],
  ["不可直接配置", "服务本身不暴露直接密码配置入口", "VPC、PrivateLink、Cloud Map"],
];

const fieldGuide = [
  ["Service", "服务名称", "AWS 服务名称"],
  ["Service_Group", "服务组", "页面中用于组织服务的分类"],
  ["Crypto_Category", "密码类别", "该服务涉及的密码机制类型"],
  ["Configurable_Status", "配置可控性", "用户是否能直接配置密码相关参数"],
  ["Configuration_Item", "配置项", "具体的密码相关配置参数"],
  ["API_Endpoint", "API / 参数", "对应 API、CLI、SDK 或配置字段"],
  ["Recommended_Values", "推荐值", "推荐采用的安全配置"],
  ["Risky_Values", "风险值", "不推荐或存在风险的配置"],
  ["Risk_Reason", "风险原因", "为什么该配置存在风险"],
  ["Security_Value_Reason", "安全原因", "为什么推荐该安全配置"],
  ["References", "参考文档", "官方文档或标准依据"],
];

const standards = [
  ["风险值判断标准", "协议过旧、安全策略过旧、密码套件过旧、证书管理不当、DNS 完整性保护缺失、密钥用途不匹配、生命周期管理不足、SDK 策略不当、上下文绑定不足、搜索加密泄露面过大。"],
  ["安全值判断标准", "使用现代 TLS 策略、有效证书、DNSSEC 完整性保护、合理 KeySpec / KeyUsage、密钥轮换、推荐 SDK 策略、业务语义明确的 encryption context，并控制可搜索加密泄露面。"],
  ["不可直接配置判断", "不将 N/A 直接视为风险值；这类服务应通过上层服务、应用层或关联资源配置 TLS、证书、加密算法、密钥管理和访问控制。"],
];

async function loadData() {
  const [services, items, riskTypes] = await Promise.all([
    fetch("./data/services.json").then((res) => res.json()),
    fetch("./data/config_items.json").then((res) => res.json()),
    fetch("./data/risk_types.json").then((res) => res.json()),
  ]);
  state.services = services;
  state.items = items;
  state.riskTypes = riskTypes;
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compact(value, fallback = "N/A") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function splitParts(value) {
  return compact(value, "")
    .split(/;|；|\/|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function statusClass(status) {
  if (status.includes("不可")) return "none";
  if (status.includes("部分")) return "partial";
  return "";
}

function riskLevelClass(level) {
  if (level === "高") return "high";
  if (level === "中") return "medium";
  if (level === "低") return "low";
  return "info";
}

function setActiveNav(route) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === route);
  });
}

function render() {
  const hash = location.hash || "#/";
  if (hash.startsWith("#/services/")) {
    renderDetail(hash.replace("#/services/", ""));
  } else if (hash === "#/risk-types") {
    renderRiskTypes();
  } else {
    renderHome();
  }
}

function renderHome() {
  setActiveNav("home");
  const app = $("#app");
  app.innerHTML = $("#home-template").innerHTML;

  $("[data-count='services']").textContent = state.services.length;
  $("[data-count='items']").textContent = state.items.length;
  $("[data-count='groups']").textContent = new Set(state.services.map((service) => service.service_group)).size;

  const filterWrap = $("#group-filters");
  filterWrap.innerHTML = groups.map((group) => `<button class="chip" type="button" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`).join("");
  filterWrap.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");
    if (!button) return;
    state.activeGroup = button.dataset.group;
    updateHomeResults();
  });

  const input = $("#search-input");
  input.value = state.query;
  input.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    updateHomeResults();
  });

  updateHomeResults();
}

function updateHomeResults() {
  document.querySelectorAll("[data-group]").forEach((button) => {
    button.classList.toggle("active", button.dataset.group === state.activeGroup);
  });

  const query = state.query.toLowerCase();
  const filtered = state.services.filter((service) => {
    const groupMatches = state.activeGroup === "全部" || service.service_group === state.activeGroup;
    const haystack = [
      service.service_id,
      service.service,
      service.service_group,
      service.crypto_category,
      service.configurable_status,
      service.main_focus,
      service.typical_risks,
    ].join(" ").toLowerCase();
    return groupMatches && (!query || haystack.includes(query));
  });

  $("#result-summary").textContent = `共 ${filtered.length} 个服务匹配当前条件`;
  const grid = $("#service-grid");
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">没有匹配的服务。可以清空搜索词，或切换到“全部”分类。</div>`;
    return;
  }
  grid.innerHTML = filtered.map(renderServiceCard).join("");
}

function renderServiceCard(service) {
  const status = compact(service.configurable_status);
  return `
    <article class="service-card">
      <div class="tag-row">
        <span class="tag ${statusClass(status)}">${escapeHtml(status)}</span>
        <span class="tag">${escapeHtml(service.service_group)}</span>
      </div>
      <h3>${escapeHtml(service.service)}</h3>
      <dl class="meta-list">
        <div><dt>密码类别</dt><dd>${escapeHtml(service.crypto_category)}</dd></div>
        <div><dt>主要关注点</dt><dd>${escapeHtml(service.main_focus)}</dd></div>
        <div><dt>典型风险</dt><dd>${escapeHtml(service.typical_risks)}</dd></div>
      </dl>
      <div class="card-actions">
        <a class="primary-button" href="${escapeHtml(service.detail_path)}">查看详情</a>
      </div>
    </article>
  `;
}

function renderDetail(serviceId) {
  setActiveNav("home");
  const app = $("#app");
  app.innerHTML = $("#detail-template").innerHTML;
  const service = state.services.find((item) => item.service_id === serviceId);
  const serviceItems = state.items.filter((item) => item.service_id === serviceId);

  if (!service) {
    $("#service-detail").innerHTML = `<div class="empty-state">未找到 service_id 为 ${escapeHtml(serviceId)} 的服务。<a class="detail-link" href="#/">返回首页</a></div>`;
    return;
  }

  const riskFocus = splitParts(service.typical_risks).map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
  $("#service-detail").innerHTML = `
    <div class="detail-header">
      <p class="eyebrow">${escapeHtml(service.aws_category)}</p>
      <h1>${escapeHtml(service.service)}</h1>
      <p class="detail-intro">${escapeHtml(service.service_intro)}</p>
      <div class="info-grid">
        ${renderKpi("服务组", service.service_group)}
        ${renderKpi("密码类别", service.crypto_category)}
        ${renderKpi("配置可控性", service.configurable_status)}
        ${renderKpi("配置项", `${serviceItems.length}`)}
        ${renderKpi("风险关注", splitParts(service.typical_risks)[0] || "N/A")}
      </div>
    </div>
    <section class="risk-focus">
      <h2>主要风险关注点</h2>
      <ul>${riskFocus || "<li>该服务暂无配置项风险，属于说明性展示。</li>"}</ul>
    </section>
    <section class="analysis-table-wrap">
      ${renderItemsTable(serviceItems)}
    </section>
  `;

  $("#service-detail").addEventListener("click", (event) => {
    const button = event.target.closest("[data-expand]");
    if (!button) return;
    const row = document.getElementById(button.dataset.expand);
    const expanded = row.hidden;
    row.hidden = !expanded;
    button.textContent = expanded ? "收起" : "展开";
  });
}

function renderKpi(label, value) {
  return `
    <div class="kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(compact(value))}</strong>
    </div>
  `;
}

function renderItemsTable(items) {
  if (!items.length) {
    return `<div class="empty-state">该服务本身不暴露直接密码套件、TLS policy 或算法选择入口。请在上层服务或应用层查看 TLS、证书、加密算法、密钥管理和访问控制配置。</div>`;
  }

  const rows = items
    .map((item, index) => {
      const detailId = `detail-row-${index}`;
      return `
        <tr>
          <td>${escapeHtml(item.configuration_item)}</td>
          <td>${escapeHtml(item.api_endpoint)}</td>
          <td>${escapeHtml(item.recommended_values)}</td>
          <td>${escapeHtml(item.risky_values)}</td>
          <td><span class="tag ${riskLevelClass(item.risk_level)}">${escapeHtml(item.risk_level)}</span></td>
          <td>${renderReference(item.references)}</td>
          <td><button class="expand-button" type="button" data-expand="${detailId}">展开</button></td>
        </tr>
        <tr id="${detailId}" class="detail-row" hidden>
          <td colspan="7">
            <div class="reason-grid">
              <div>
                <h4>风险原因</h4>
                <p>${escapeHtml(item.risk_reason)}</p>
              </div>
              <div>
                <h4>安全原因</h4>
                <p>${escapeHtml(item.security_value_reason)}</p>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>配置项</th>
          <th>API / 参数</th>
          <th>推荐值</th>
          <th>风险值</th>
          <th>风险等级</th>
          <th>参考文档</th>
          <th>详情</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderReference(value) {
  const text = compact(value, "AWS 官方文档");
  const firstUrl = text.match(/https?:\/\/[^\s;；)）]+/);
  if (!firstUrl) return escapeHtml(text);
  return `<a class="detail-link" href="${escapeHtml(firstUrl[0])}" target="_blank" rel="noreferrer">官方文档</a>`;
}

function renderRiskTypes() {
  setActiveNav("risk-types");
  const app = $("#app");
  app.innerHTML = $("#risk-template").innerHTML;
  $("#risk-list").innerHTML = state.riskTypes
    .map((risk) => `
      <details>
        <summary>${escapeHtml(risk.risk_type)}</summary>
        <div class="panel">
          <p>${escapeHtml(risk.risk_description)}</p>
          <p><strong>涉及服务：</strong>${escapeHtml(risk.related_services)}</p>
          <p><strong>典型风险值：</strong>${escapeHtml(risk.typical_risky_values)}</p>
          <p><strong>推荐方向：</strong>${escapeHtml(risk.recommended_direction)}</p>
        </div>
      </details>
    `)
    .join("");

  $("#group-guide").innerHTML = renderGuideTable(["服务组", "含义", "代表服务"], groupGuide);
  $("#field-guide").innerHTML = renderGuideTable(["字段", "页面名称", "含义"], fieldGuide);
  $("#standard-list").innerHTML = standards
    .map(([title, body]) => `
      <details open>
        <summary>${escapeHtml(title)}</summary>
        <div class="panel"><p>${escapeHtml(body)}</p></div>
      </details>
    `)
    .join("");
}

function renderGuideTable(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

window.addEventListener("hashchange", render);

loadData()
  .then(render)
  .catch((error) => {
    $("#app").innerHTML = `
      <div class="empty-state">
        数据加载失败。请通过本地 HTTP 服务打开本页面，而不是直接双击 HTML 文件。
        <pre>${escapeHtml(error.message)}</pre>
      </div>
    `;
  });
