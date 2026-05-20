const pageSize = 9;
const riskTypePageSize = 8;
const collapsedFilterLimit = 6;
const config = window.APP_CONFIG;

const state = {
  services: [],
  items: [],
  riskTypes: [],
  activeAwsCategory: "all",
  activeGroup: "all",
  activeStatus: "all",
  activeSort: "name",
  query: "",
  page: 1,
  riskTypePage: 1,
  expandedFilters: {},
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function label(key, ...args) {
  const value = config.labels[key];
  return typeof value === "function" ? value(...args) : value;
}

function compact(value, fallback = "N/A") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function findOption(options, value) {
  return options.find((option) => option.value === value);
}

function optionLabel(options, value) {
  return findOption(options, value)?.label || value;
}

function serviceGroupLabel(value) {
  return optionLabel(config.filters.cryptoGroups, value);
}

function serviceStatusLabel(value) {
  return optionLabel(config.filters.statuses, value);
}

function displayAwsCategory(service) {
  if (service.display_aws_category) return service.display_aws_category;
  const id = compact(service.service_id, "");
  return config.categoryOverrides?.[id] || compact(service.aws_category);
}

function splitParts(value) {
  return compact(value, "")
    .split(/;|\n|；/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function statusClass(status) {
  if (status === "not_configurable" || status === "不可配置") return "none";
  if (status === "partially_configurable" || status === "部分可配置") return "partial";
  return "";
}

function riskLevelClass(level) {
  if (level === "high") return "high";
  if (level === "medium") return "medium";
  if (level === "low") return "low";
  return "info";
}

function riskCountsForService(serviceId) {
  return state.items
    .filter((item) => item.service_id === serviceId)
    .reduce(
      (counts, item) => {
        const level = compact(item.risk_level, "").toLowerCase();
        counts.total += 1;
        if (level === "high") counts.high += 1;
        if (level === "medium") counts.medium += 1;
        if (level === "low") counts.low += 1;
        return counts;
      },
      { total: 0, high: 0, medium: 0, low: 0 },
    );
}

function compareServices(left, right) {
  if (state.activeSort === "name") {
    return compact(left.service, "").localeCompare(compact(right.service, ""), config.lang);
  }
  const leftCounts = riskCountsForService(left.service_id);
  const rightCounts = riskCountsForService(right.service_id);
  return (
    rightCounts.high - leftCounts.high ||
    rightCounts.medium - leftCounts.medium ||
    rightCounts.total - leftCounts.total ||
    compact(left.service, "").localeCompare(compact(right.service, ""), config.lang)
  );
}

function countMatches(services, predicate) {
  return services.filter(predicate).length;
}

function serviceMatchesFilters(service, overrides = {}) {
  const query = state.query.toLowerCase();
  const awsCategory = displayAwsCategory(service);
  const activeAwsCategory = overrides.awsCategory ?? state.activeAwsCategory;
  const activeGroup = overrides.group ?? state.activeGroup;
  const activeStatus = overrides.status ?? state.activeStatus;
  const awsCategoryMatches = activeAwsCategory === "all" || awsCategory === activeAwsCategory;
  const groupMatches = activeGroup === "all" || service.service_group === activeGroup;
  const statusMatches = activeStatus === "all" || service.configurable_status === activeStatus;
  const haystack = [
    service.service_id,
    service.service,
    awsCategory,
    service.aws_category,
    service.service_group,
    serviceGroupLabel(service.service_group),
    service.crypto_category,
    service.configurable_status,
    serviceStatusLabel(service.configurable_status),
    service.main_focus,
    service.typical_risks,
  ]
    .join(" ")
    .toLowerCase();
  return awsCategoryMatches && groupMatches && statusMatches && (!query || haystack.includes(query));
}

function updateChrome() {
  document.documentElement.lang = config.lang;
  document.title = config.title;
  $(".brand").textContent = config.title;
  $(".nav").innerHTML = `
    <a href="#/" data-nav="cover">${escapeHtml(label("navCover"))}</a>
    <a href="#/dashboard" data-nav="dashboard">${escapeHtml(label("navDashboard"))}</a>
    <a href="#/risk-types" data-nav="risk-types">${escapeHtml(label("navRiskTypes"))}</a>
  `;
  document.querySelectorAll("[data-lang-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.langPage === config.langKey);
    if (config.languagePages?.[link.dataset.langPage]) {
      link.href = `${config.languagePages[link.dataset.langPage]}${location.hash || ""}`;
    }
  });
}

function setActiveNav(route) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === route);
  });
}

function renderFilterOptions(container, options, settings) {
  const expanded = Boolean(state.expandedFilters[settings.key]);
  const shouldCollapse = options.length > collapsedFilterLimit;
  let visibleOptions = shouldCollapse && !expanded ? options.slice(0, collapsedFilterLimit) : options;
  const activeValue = settings.activeValue?.();
  if (shouldCollapse && !expanded && activeValue && !visibleOptions.some((option) => option.value === activeValue)) {
    const activeOption = findOption(options, activeValue);
    if (activeOption) visibleOptions = [...visibleOptions, activeOption];
  }
  const hiddenCount = options.length - visibleOptions.length;
  container.innerHTML = `
    ${visibleOptions
      .map((option) => {
        const count = settings.countFor ? settings.countFor(option.value) : null;
        const content =
          count === null
            ? escapeHtml(option.label)
            : `<span class="chip-label">${escapeHtml(option.label)}</span><span class="chip-count">${escapeHtml(count)}</span>`;
        return `<button class="chip" type="button" ${settings.attribute}="${escapeHtml(option.value)}">${content}</button>`;
      })
      .join("")}
    ${shouldCollapse ? `<button class="chip chip-toggle" type="button" data-filter-toggle="${settings.key}" aria-expanded="${expanded}">${expanded ? escapeHtml(label("showLess")) : escapeHtml(label("showMore", hiddenCount))}</button>` : ""}
  `;
}

function render() {
  const hash = location.hash || "#/";
  if (hash.startsWith("#/services/")) {
    renderDetail(hash.replace("#/services/", ""));
  } else if (hash === "#/dashboard") {
    renderHome();
  } else if (hash === "#/risk-types") {
    renderRiskTypes();
  } else {
    renderCover();
  }
}

function renderCover() {
  setActiveNav("cover");
  $("#app").innerHTML = `
    <section class="cover-page">
      <div class="cover-panel">
        <p class="eyebrow">${escapeHtml(label("coverEyebrow"))}</p>
        <h1>${escapeHtml(label("coverTitle"))}</h1>
        <p class="cover-copy">${escapeHtml(label("coverCopy"))}</p>
        <div class="cover-actions">
          <a class="primary-button" href="#/dashboard">${escapeHtml(label("enterDashboard"))}</a>
          <a class="secondary-link" href="#/risk-types">${escapeHtml(label("viewRiskTypes"))}</a>
        </div>
      </div>
      <div class="cover-visual" aria-label="${escapeHtml(label("coverGraphicLabel"))}">
        <div class="risk-orbit">
          <span class="node node-main">AWS</span>
          <span class="node node-a">TLS</span>
          <span class="node node-b">KMS</span>
          <span class="node node-c">HSM</span>
          <span class="node node-d">SDK</span>
        </div>
      </div>
    </section>
    <section class="cover-stats" aria-label="${escapeHtml(label("platformSummaryLabel"))}">
      ${renderStat(state.services.length, label("servicesCovered"))}
      ${renderStat(state.items.length, label("configItems"))}
      ${renderStat(new Set(state.services.map(displayAwsCategory)).size, label("officialCategories"))}
    </section>
  `;
}

function renderStat(value, title) {
  return `<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(title)}</span></div>`;
}

function renderHome() {
  setActiveNav("dashboard");
  $("#app").innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">${escapeHtml(label("coverEyebrow"))}</p>
        <h1>${escapeHtml(label("dashboardTitle"))}</h1>
        <p class="hero-copy">${escapeHtml(label("dashboardCopy"))}</p>
      </div>
      <div class="hero-metrics" aria-label="${escapeHtml(label("platformMetricsLabel"))}">
        ${renderStat(state.services.length, label("services"))}
        ${renderStat(state.items.length, label("configItems"))}
        ${renderStat(new Set(state.services.map(displayAwsCategory)).size, label("officialCategories"))}
      </div>
    </section>
    <section class="dashboard-layout">
      <aside class="filters" aria-label="${escapeHtml(label("serviceFiltersLabel"))}">
        <div class="filter-toolbar">
          <label class="sort-box">
            <span>${escapeHtml(label("sortLabel"))}</span>
            <select id="sort-select">
              <option value="name">${escapeHtml(label("sortName"))}</option>
              <option value="risk">${escapeHtml(label("sortRiskFirst"))}</option>
            </select>
          </label>
          <button id="clear-filters" class="secondary-button" type="button">${escapeHtml(label("clearFilters"))}</button>
        </div>
        <div class="filter-block">
          <span class="filter-label">${escapeHtml(label("awsServiceCategory"))}</span>
          <div id="group-filters" class="chips" role="list"></div>
        </div>
        <div class="filter-block">
          <span class="filter-label">${escapeHtml(label("cryptoDimension"))}</span>
          <div id="crypto-filters" class="chips" role="list"></div>
        </div>
        <div class="filter-block">
          <span class="filter-label">${escapeHtml(label("controllability"))}</span>
          <div id="status-filters" class="chips" role="list"></div>
        </div>
      </aside>
      <div class="results-panel">
        <div class="results-toolbar">
          <label class="search-box result-search">
            <span>${escapeHtml(label("searchLabel"))}</span>
            <input id="search-input" type="search" placeholder="${escapeHtml(label("searchPlaceholder"))}" autocomplete="off" />
          </label>
          <div id="pagination-slot" class="pagination-slot"></div>
        </div>
        <section class="section-head">
          <div>
            <h2>${escapeHtml(label("serviceOverview"))}</h2>
            <p id="result-summary"></p>
          </div>
          <a class="secondary-link" href="#/risk-types">${escapeHtml(label("viewRiskTypes"))}</a>
        </section>
        <section id="service-grid" class="service-grid" aria-label="${escapeHtml(label("serviceCardsLabel"))}"></section>
      </div>
    </section>
  `;

  wireHomeFilters();
  updateHomeResults();
}

function wireHomeFilters() {
  const categoryWrap = $("#group-filters");
  categoryWrap.addEventListener("click", (event) => {
    handleFilterClick(event, "data-aws-category", "activeAwsCategory");
  });

  const cryptoWrap = $("#crypto-filters");
  cryptoWrap.addEventListener("click", (event) => {
    handleFilterClick(event, "data-group", "activeGroup");
  });

  const statusWrap = $("#status-filters");
  statusWrap.addEventListener("click", (event) => {
    handleFilterClick(event, "data-status", "activeStatus");
  });

  const input = $("#search-input");
  input.value = state.query;
  input.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.page = 1;
    updateHomeResults();
  });

  const sortSelect = $("#sort-select");
  sortSelect.value = state.activeSort;
  sortSelect.addEventListener("change", (event) => {
    state.activeSort = event.target.value;
    state.page = 1;
    updateHomeResults();
  });

  $("#clear-filters").addEventListener("click", () => {
    state.activeAwsCategory = "all";
    state.activeGroup = "all";
    state.activeStatus = "all";
    state.query = "";
    state.activeSort = "name";
    state.page = 1;
    $("#search-input").value = "";
    $("#sort-select").value = state.activeSort;
    updateHomeResults();
  });
}

function renderHomeFilterOptions() {
  renderFilterOptions($("#group-filters"), config.filters.awsCategories, {
    key: "awsCategory",
    attribute: "data-aws-category",
    activeValue: () => state.activeAwsCategory,
    countFor: (value) => countMatches(state.services, (service) => serviceMatchesFilters(service, { awsCategory: value })),
  });
  renderFilterOptions($("#crypto-filters"), config.filters.cryptoGroups, {
    key: "cryptoGroup",
    attribute: "data-group",
    activeValue: () => state.activeGroup,
    countFor: (value) => countMatches(state.services, (service) => serviceMatchesFilters(service, { group: value })),
  });
  renderFilterOptions($("#status-filters"), config.filters.statuses, {
    key: "status",
    attribute: "data-status",
    activeValue: () => state.activeStatus,
    countFor: (value) => countMatches(state.services, (service) => serviceMatchesFilters(service, { status: value })),
  });
}

function handleFilterClick(event, attribute, stateKey) {
  const toggle = event.target.closest("[data-filter-toggle]");
  if (toggle) {
    state.expandedFilters[toggle.dataset.filterToggle] = !state.expandedFilters[toggle.dataset.filterToggle];
    updateHomeResults();
    return;
  }
  const button = event.target.closest(`[${attribute}]`);
  if (!button) return;
  state[stateKey] = button.getAttribute(attribute);
  state.page = 1;
  updateHomeResults();
}

function updateHomeResults() {
  renderHomeFilterOptions();
  document.querySelectorAll("[data-aws-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.awsCategory === state.activeAwsCategory);
  });
  document.querySelectorAll("[data-group]").forEach((button) => {
    button.classList.toggle("active", button.dataset.group === state.activeGroup);
  });
  document.querySelectorAll("[data-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === state.activeStatus);
  });
  $("#clear-filters").disabled = !hasActiveFilters();

  const filtered = state.services.filter((service) => serviceMatchesFilters(service)).sort(compareServices);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const startIndex = (state.page - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  $("#result-summary").textContent = label("matchingSummary", filtered.length, state.page, totalPages);
  const grid = $("#service-grid");
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(label("emptyResults"))}</div>`;
    renderPagination(0, 1);
    return;
  }
  grid.innerHTML = pageItems.map(renderServiceCard).join("");
  renderPagination(filtered.length, totalPages);
}

function hasActiveFilters() {
  return Boolean(state.query) || state.activeAwsCategory !== "all" || state.activeGroup !== "all" || state.activeStatus !== "all" || state.activeSort !== "name";
}

function renderPagination(totalItems, totalPages) {
  let pagination = $("#pagination");
  if (!pagination) {
    pagination = document.createElement("nav");
    pagination.id = "pagination";
    pagination.className = "pagination";
    pagination.setAttribute("aria-label", label("paginationLabel"));
    $("#pagination-slot").appendChild(pagination);
    pagination.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button || button.disabled) return;
      state.page = Number(button.dataset.page);
      updateHomeResults();
    });
  }

  if (totalItems <= pageSize) {
    pagination.innerHTML = "";
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  pagination.innerHTML = `
    <button type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>${escapeHtml(label("previous"))}</button>
    <div class="pagination-pages">
      ${pages.map((page) => `<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}" aria-current="${page === state.page ? "page" : "false"}">${page}</button>`).join("")}
    </div>
    <button type="button" data-page="${state.page + 1}" ${state.page === totalPages ? "disabled" : ""}>${escapeHtml(label("next"))}</button>
  `;
}

function renderServiceCard(service) {
  const status = compact(service.configurable_status);
  const awsCategory = displayAwsCategory(service);
  const counts = riskCountsForService(service.service_id);
  return `
    <article class="service-card">
      <div class="tag-row">
        <span class="tag official">${escapeHtml(awsCategory)}</span>
        <span class="tag ${statusClass(status)}">${escapeHtml(serviceStatusLabel(status))}</span>
        <span class="tag">${escapeHtml(serviceGroupLabel(service.service_group))}</span>
      </div>
      <h3>${escapeHtml(service.service)}</h3>
      <div class="risk-counts" aria-label="${escapeHtml(label("riskCounts"))}">
        ${renderRiskCount("high", label("riskLevel_high"), counts.high)}
        ${renderRiskCount("medium", label("riskLevel_medium"), counts.medium)}
        ${renderRiskCount("info", label("configItems"), counts.total)}
      </div>
      <dl class="meta-list">
        <div><dt>${escapeHtml(label("cryptoDimension"))}</dt><dd>${escapeHtml(serviceGroupLabel(service.service_group))}</dd></div>
        <div><dt>${escapeHtml(label("cryptoCategory"))}</dt><dd>${escapeHtml(service.crypto_category)}</dd></div>
        <div><dt>${escapeHtml(label("mainFocus"))}</dt><dd>${escapeHtml(service.main_focus)}</dd></div>
      </dl>
      <div class="card-actions">
        <a class="primary-button" href="${escapeHtml(service.detail_path)}">${escapeHtml(label("viewDetails"))}</a>
      </div>
    </article>
  `;
}

function renderRiskCount(level, title, value) {
  return `
    <span class="risk-count ${level}">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(title)}</span>
    </span>
  `;
}

function renderDetail(serviceId) {
  setActiveNav("dashboard");
  const service = state.services.find((item) => item.service_id === serviceId);
  const serviceItems = state.items.filter((item) => item.service_id === serviceId);

  if (!service) {
    $("#app").innerHTML = `<div class="empty-state">${escapeHtml(label("serviceNotFound", serviceId))} <a class="detail-link" href="#/dashboard">${escapeHtml(label("backDashboard"))}</a></div>`;
    return;
  }

  const awsCategory = displayAwsCategory(service);
  const riskFocus = splitParts(service.typical_risks).map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
  $("#app").innerHTML = `
    <a class="back-link" href="#/dashboard">${escapeHtml(label("backDashboard"))}</a>
    <section id="service-detail" class="detail">
      <div class="detail-header">
        <p class="eyebrow">${escapeHtml(awsCategory)}</p>
        <h1>${escapeHtml(service.service)}</h1>
        <p class="detail-intro">${escapeHtml(service.service_intro)}</p>
        <div class="info-grid">
          ${renderKpi(label("awsCategory"), awsCategory)}
          ${renderKpi(label("cryptoDimension"), serviceGroupLabel(service.service_group))}
          ${renderKpi(label("cryptoCategory"), service.crypto_category)}
          ${renderKpi(label("controllability"), serviceStatusLabel(service.configurable_status))}
          ${renderKpi(label("configurationItems"), `${serviceItems.length}`)}
        </div>
      </div>
      <section class="risk-focus">
        <h2>${escapeHtml(label("riskFocus"))}</h2>
        <ul>${riskFocus || `<li>${escapeHtml(label("noConfigRisk"))}</li>`}</ul>
      </section>
      <section class="analysis-table-wrap">
        ${renderItemsTable(serviceItems)}
      </section>
    </section>
  `;

  $("#service-detail").addEventListener("click", (event) => {
    const button = event.target.closest("[data-expand]");
    if (!button) return;
    const row = document.getElementById(button.dataset.expand);
    const expanded = row.hidden;
    row.hidden = !expanded;
    button.textContent = expanded ? label("collapse") : label("expand");
    button.setAttribute("aria-expanded", String(expanded));
  });
}

function renderKpi(title, value) {
  return `
    <div class="kpi">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(compact(value))}</strong>
    </div>
  `;
}

function renderItemsTable(items) {
  if (!items.length) {
    return `<div class="empty-state">${escapeHtml(label("noItems"))}</div>`;
  }

  const rows = items
    .map((item, index) => {
      const detailId = `detail-row-${index}`;
      return `
        <tr>
          <td data-label="${escapeHtml(label("configurationItem"))}">${escapeHtml(item.configuration_item)}</td>
          <td data-label="${escapeHtml(label("apiEndpoint"))}">${escapeHtml(item.api_endpoint)}</td>
          <td data-label="${escapeHtml(label("recommendedValues"))}">${escapeHtml(item.recommended_values)}</td>
          <td data-label="${escapeHtml(label("riskyValues"))}">${escapeHtml(item.risky_values)}</td>
          <td data-label="${escapeHtml(label("riskLevel"))}"><span class="tag ${riskLevelClass(item.risk_level)}">${escapeHtml(label(`riskLevel_${item.risk_level}`) || item.risk_level)}</span></td>
          <td data-label="${escapeHtml(label("references"))}">${renderReference(item.references)}</td>
          <td data-label="${escapeHtml(label("action"))}"><button class="expand-button" type="button" data-expand="${detailId}" aria-controls="${detailId}" aria-expanded="false">${escapeHtml(label("expand"))}</button></td>
        </tr>
        <tr id="${detailId}" class="detail-row" hidden>
          <td colspan="7">
            <div class="reason-grid">
              <div>
                <h4>${escapeHtml(label("riskReason"))}</h4>
                <p>${escapeHtml(item.risk_reason)}</p>
              </div>
              <div>
                <h4>${escapeHtml(label("securityValueReason"))}</h4>
                <p>${escapeHtml(item.security_value_reason)}</p>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="analysis-table">
      <colgroup>
        <col class="col-config" />
        <col class="col-api" />
        <col class="col-recommended" />
        <col class="col-risky" />
        <col class="col-level" />
        <col class="col-reference" />
        <col class="col-action" />
      </colgroup>
      <thead>
        <tr>
          <th>${escapeHtml(label("configurationItem"))}</th>
          <th>${escapeHtml(label("apiEndpoint"))}</th>
          <th>${escapeHtml(label("recommendedValues"))}</th>
          <th>${escapeHtml(label("riskyValues"))}</th>
          <th>${escapeHtml(label("riskLevel"))}</th>
          <th>${escapeHtml(label("references"))}</th>
          <th>${escapeHtml(label("action"))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderReference(value) {
  const text = compact(value, label("referenceLink"));
  const firstUrl = text.match(/https?:\/\/[^\s;]+/);
  if (!firstUrl) return escapeHtml(text);
  return `<a class="detail-link" href="${escapeHtml(firstUrl[0])}" target="_blank" rel="noreferrer">${escapeHtml(label("referenceLink"))}</a>`;
}

function renderRiskTypes() {
  setActiveNav("risk-types");
  $("#app").innerHTML = `
    <section class="page-title">
      <p class="eyebrow">${escapeHtml(label("riskTaxonomyEyebrow"))}</p>
      <h1>${escapeHtml(label("riskTaxonomyTitle"))}</h1>
      <p>${escapeHtml(label("riskTaxonomyCopy"))}</p>
    </section>
    <section class="info-band important">
      <h2>${escapeHtml(label("naTitle"))}</h2>
      <p>${escapeHtml(label("naCopy"))}</p>
    </section>
    <section class="accordion-section">
      <div class="risk-list-head">
        <div>
          <h2>${escapeHtml(label("riskTypeList"))}</h2>
          <p id="risk-type-summary"></p>
        </div>
        <nav id="risk-pagination" class="pagination compact-pagination" aria-label="${escapeHtml(label("riskTypePaginationLabel"))}"></nav>
      </div>
      <div id="risk-list" class="accordion-list"></div>
    </section>
    <section class="two-column">
      <div>
        <h2>${escapeHtml(label("groupGuide"))}</h2>
        <div id="group-guide" class="compact-table"></div>
      </div>
      <div>
        <h2>${escapeHtml(label("fieldGuide"))}</h2>
        <div id="field-guide" class="compact-table"></div>
      </div>
    </section>
    <section class="accordion-section">
      <h2>${escapeHtml(label("standardGuide"))}</h2>
      <div id="standard-list" class="accordion-list"></div>
    </section>
  `;

  renderRiskTypePage();
  $("#group-guide").innerHTML = renderGuideTable(config.guides.groupHeaders, config.guides.groupRows);
  $("#field-guide").innerHTML = renderGuideTable(config.guides.fieldHeaders, config.guides.fieldRows);
  $("#standard-list").innerHTML = config.guides.standardRows
    .map(([title, body]) => `
      <details open>
        <summary>${escapeHtml(title)}</summary>
        <div class="panel"><p>${escapeHtml(body)}</p></div>
      </details>
    `)
    .join("");
}

function renderRiskTypePage() {
  const totalPages = Math.max(1, Math.ceil(state.riskTypes.length / riskTypePageSize));
  state.riskTypePage = Math.min(Math.max(1, state.riskTypePage), totalPages);
  const startIndex = (state.riskTypePage - 1) * riskTypePageSize;
  const pageItems = state.riskTypes.slice(startIndex, startIndex + riskTypePageSize);
  $("#risk-type-summary").textContent = label("riskTypeSummary", state.riskTypes.length, state.riskTypePage, totalPages);
  $("#risk-list").innerHTML = pageItems.map(renderRiskType).join("");
  renderRiskTypePagination(totalPages);
}

function renderRiskTypePagination(totalPages) {
  const pagination = $("#risk-pagination");
  if (totalPages <= 1) {
    pagination.hidden = true;
    pagination.innerHTML = "";
    return;
  }
  pagination.hidden = false;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  pagination.innerHTML = `
    <button type="button" data-risk-page="${state.riskTypePage - 1}" ${state.riskTypePage === 1 ? "disabled" : ""}>${escapeHtml(label("previous"))}</button>
    <div class="pagination-pages">
      ${pages.map((page) => `<button type="button" data-risk-page="${page}" class="${page === state.riskTypePage ? "active" : ""}" aria-current="${page === state.riskTypePage ? "page" : "false"}">${page}</button>`).join("")}
    </div>
    <button type="button" data-risk-page="${state.riskTypePage + 1}" ${state.riskTypePage === totalPages ? "disabled" : ""}>${escapeHtml(label("next"))}</button>
  `;
  pagination.onclick = (event) => {
    const button = event.target.closest("[data-risk-page]");
    if (!button || button.disabled) return;
    state.riskTypePage = Number(button.dataset.riskPage);
    renderRiskTypePage();
  };
}

function renderRiskType(risk) {
  return `
    <details>
      <summary>${escapeHtml(risk.risk_type)}</summary>
      <div class="panel">
        <p>${escapeHtml(risk.risk_description)}</p>
        <p><strong>${escapeHtml(label("relatedServices"))}</strong>${escapeHtml(risk.related_services)}</p>
        <p><strong>${escapeHtml(label("typicalRiskyValues"))}</strong>${escapeHtml(risk.typical_risky_values)}</p>
        <p><strong>${escapeHtml(label("recommendedDirection"))}</strong>${escapeHtml(risk.recommended_direction)}</p>
      </div>
    </details>
  `;
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

async function loadData() {
  const [services, items, riskTypes] = await Promise.all([
    fetch(config.data.services).then((res) => res.json()),
    fetch(config.data.items).then((res) => res.json()),
    fetch(config.data.riskTypes).then((res) => res.json()),
  ]);
  state.services = services;
  state.items = items;
  state.riskTypes = riskTypes;
}

updateChrome();
window.addEventListener("hashchange", render);
window.addEventListener("hashchange", updateChrome);

loadData()
  .then(render)
  .catch((error) => {
    $("#app").innerHTML = `
      <div class="empty-state">
        ${escapeHtml(label("loadError"))}
        <pre>${escapeHtml(error.message)}</pre>
      </div>
    `;
  });
