// ✅ Pon aquí tu endpoint público del Worker
const GP_REPORT_URL = "https://mute-moon-e712.hectora-b43.workers.dev/gp-report";

const DEFAULT_PRODUCT_IMAGE_URL = "https://jewells-com.s3.amazonaws.com/Logo/logo-red.png";
const NEWSTORE_CATALOG_BASE_URL = "https://manager.jewells.p.newstore.net/catalog/catalog-gb/locales/en-gb/products";

let raw = null;
let rows = [];
let filtered = [];

let page = 1;
const pageSize = 120;

const el = (id) => document.getElementById(id);

function fmtGBP(x){
  const n = Number(x || 0);
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(x){
  const n = Number(x || 0);
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtPct(x){
  if (x === null || x === undefined || isNaN(Number(x))) return "—";
  return (Number(x) * 100).toFixed(2) + "%";
}

function uniq(arr){
  return [...new Set(arr)]
    .filter(v => v !== null && v !== undefined && v !== "")
    .sort();
}

function displayYear(r){
  return Number(r.ReportingYear ?? r.reportingyear ?? r.ISOYear ?? r.isoyear ?? 0);
}

function displayWeek(r){
  return Number(r.WeekReporting ?? r.weekreporting ?? r.ISOWeek ?? r.isoweek ?? 0);
}

function weekKey(r){
  const y = displayYear(r);
  const w = displayWeek(r);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

function escapeHtml(v){
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildCatalogUrl(sku){
  const safeSku = encodeURIComponent(String(sku || "").trim());
  return `${NEWSTORE_CATALOG_BASE_URL}/${safeSku}?lastCount=10&lastOffset=0&lastQuery=${safeSku}`;
}

function normalizeData(payload){
  const data = payload.data || [];

  return data.map((r) => {
    const sku = String(r.SKU ?? r.sku ?? "").trim();

    return {
      Store: String(r.Store ?? r.store ?? ""),
      SKU: sku,
      ISOYear: Number(r.ISOYear ?? r.isoyear ?? 0),
      ISOWeek: Number(r.ISOWeek ?? r.isoweek ?? 0),
      ReportingStartYear: Number(r.ReportingStartYear ?? r.reportingstartyear ?? 0),
      ReportingYear: Number(r.ReportingYear ?? r.reportingyear ?? r.ISOYear ?? r.isoyear ?? 0),
      WeekReporting: Number(r.WeekReporting ?? r.weekreporting ?? r.ISOWeek ?? r.isoweek ?? 0),
      WeekReportingActual: Number(r.WeekReportingActual ?? r.weekreportingactual ?? 0),
      WeekReporting1: Number(r.WeekReporting1 ?? r.weekreporting1 ?? 0),
      WeekReporting2: Number(r.WeekReporting2 ?? r.weekreporting2 ?? 0),
      WeekReporting3: Number(r.WeekReporting3 ?? r.weekreporting3 ?? 0),
      WeekReporting4: Number(r.WeekReporting4 ?? r.weekreporting4 ?? 0),
      ReportingYearActual: Number(r.ReportingYearActual ?? r.reportingyearactual ?? 0),
      ReportingYear1: Number(r.ReportingYear1 ?? r.reportingyear1 ?? 0),
      ReportingYear2: Number(r.ReportingYear2 ?? r.reportingyear2 ?? 0),
      ReportingYear3: Number(r.ReportingYear3 ?? r.reportingyear3 ?? 0),
      ReportingYear4: Number(r.ReportingYear4 ?? r.reportingyear4 ?? 0),
      Units: Number(r.Units_NewStore ?? r.units_newstore ?? r.Units ?? r.units ?? 0),
      ExecutionStockQty: Number(r.ExecutionStockQty ?? r.executionstockqty ?? 0),
      NetSales: Number(r.NetSales ?? r.netsales ?? 0),
      COGS: Number(r.COGS ?? r.cogs ?? 0),
      GrossProfit: Number(r.GrossProfit ?? r.grossprofit ?? 0),
      GrossMarginPct: r.GrossMarginPct ?? r.grossmarginpct ?? null,
      WeightedUnitCost: Number(r.WeightedUnitCost ?? r.weightedunitcost ?? 0),
      _merge: String(r._merge ?? ""),

      ProductImageFile: String(r.ProductImageFile ?? r.productimagefile ?? "logo-red.png"),
      ProductImageUrl: String(r.ProductImageUrl ?? r.productimageurl ?? DEFAULT_PRODUCT_IMAGE_URL),
      ProductImageMatchType: String(r.ProductImageMatchType ?? r.productimagematchtype ?? "fallback"),
      CatalogUrl: String(r.CatalogUrl ?? r.catalogurl ?? buildCatalogUrl(sku)),
    };
  });
}

// -------------------- Export (CSV) --------------------
function nowStamp(){
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadBlob(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function csvEscape(v){
  if (v === null || v === undefined) return "";
  const s = String(v);
  const needs = /[",\n\r]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

function getExportRows(){
  return (filtered || []).map(r => ({
    Store: r.Store,
    SKU: r.SKU,
    CatalogUrl: r.CatalogUrl,
    ReportingYear: displayYear(r),
    WeekReporting: displayWeek(r),
    ISOYear: r.ISOYear,
    ISOWeek: r.ISOWeek,
    Units: Number(r.Units || 0),
    In_Stock: Number(r.ExecutionStockQty || 0),
    NetSales: Number(r.NetSales || 0),
    COGS: Number(r.COGS || 0),
    GrossProfit: Number(r.GrossProfit || 0),
    GrossMarginPct: (r.GrossMarginPct === null || r.GrossMarginPct === undefined)
      ? ""
      : Number(r.GrossMarginPct),
    WeightedUnitCost: Number(r.WeightedUnitCost || 0)
  }));
}

function exportCsv(){
  const data = getExportRows();
  if (!data.length){
    alert("No rows to export (check your filters).");
    return;
  }

  const headers = Object.keys(data[0]);
  const lines = [];
  lines.push("sep=,");
  lines.push(headers.join(","));

  for (const row of data){
    lines.push(headers.map(h => csvEscape(row[h])).join(","));
  }

  const csv = "\ufeff" + lines.join("\n");
  downloadBlob(`gp_report_${nowStamp()}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

// -------------------- MultiSelect (checkbox dropdown) --------------------
const state = {
  stores: new Set(),
  weeks: new Set(),
  unitsSort: null,
};

let __openMs = null;

function selectionSummary(set, allLabel = "All"){
  if (!set || set.size === 0) return allLabel;
  if (set.size === 1) return [...set][0];
  return `${set.size} selected`;
}

function sortWeekKeys(keys){
  return [...keys].sort((a, b) => {
    const [ay, aw] = a.split("-W").map(Number);
    const [by, bw] = b.split("-W").map(Number);
    if (ay !== by) return by - ay;
    return bw - aw;
  });
}

function normalizeWeeklyTopGrossProfitMap(source){
  const out = {};
  const input = source && typeof source === "object" ? source : {};

  for (const [week, items] of Object.entries(input)) {
    if (!Array.isArray(items)) {
      out[String(week)] = [];
      continue;
    }

    out[String(week)] = items.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return {
          sku: String(item.sku ?? item.SKU ?? "").trim(),
          grossProfit: Number(item.gross_profit ?? item.grossProfit ?? item.GrossProfit ?? 0),
          units: Number(item.units ?? item.Units ?? 0),
          netSales: Number(item.net_sales ?? item.netSales ?? item.NetSales ?? 0),
          cogs: Number(item.cogs ?? item.COGS ?? 0),
        };
      }

      return {
        sku: String(item ?? "").trim(),
        grossProfit: null,
        units: null,
        netSales: null,
        cogs: null,
      };
    }).filter((item) => item.sku);
  }

  return out;
}

function buildWeeklyTopGrossProfitFromRows(list, topN = 5){
  const weekMap = new Map();

  for (const r of (list || [])) {
    const week = weekKey(r);
    const sku = String(r.SKU || "").trim();
    const grossProfit = Number(r.GrossProfit || 0);
    const units = Number(r.Units || 0);
    const netSales = Number(r.NetSales || 0);
    const cogs = Number(r.COGS || 0);

    if (!sku) continue;

    if (!weekMap.has(week)) weekMap.set(week, new Map());
    const skuMap = weekMap.get(week);

    if (!skuMap.has(sku)) {
      skuMap.set(sku, { sku, grossProfit: 0, units: 0, netSales: 0, cogs: 0 });
    }

    const item = skuMap.get(sku);
    item.grossProfit += grossProfit;
    item.units += units;
    item.netSales += netSales;
    item.cogs += cogs;
  }

  const out = {};

  for (const [week, skuMap] of weekMap.entries()) {
    out[week] = [...skuMap.values()]
      .sort((a, b) => {
        if (b.grossProfit !== a.grossProfit) return b.grossProfit - a.grossProfit;
        return a.sku.localeCompare(b.sku);
      })
      .slice(0, topN);
  }

  return out;
}

function getSkuFilterText(){
  return el("skuSearch")?.value.trim() || "";
}

function hasSkuFilter(){
  return !!getSkuFilterText();
}

function hasActiveFilters(){
  return state.stores.size > 0 || state.weeks.size > 0 || hasSkuFilter();
}

function distinctWeekKeys(list){
  return sortWeekKeys(uniq((list || []).map(weekKey)));
}

function distinctStores(list){
  return uniq((list || []).map((r) => String(r.Store || "").trim()));
}

function distinctSkus(list){
  return uniq((list || []).map((r) => String(r.SKU || "").trim()));
}

function unitsValueLabel(units){
  if (units === null || units === undefined || Number.isNaN(Number(units))) return "";
  return `${fmtNum(units)}u`;
}

function grossProfitValueLabel(grossProfit){
  if (grossProfit === null || grossProfit === undefined || Number.isNaN(Number(grossProfit))) return "";
  return fmtGBP(grossProfit);
}

function topSellerItemsHtml(items){
  if (!Array.isArray(items) || items.length === 0) {
    return `<div class="top-sellers-empty">—</div>`;
  }

  return items.map((item, idx) => {
    const sku = String(item.sku || "").trim();
    const grossProfit = grossProfitValueLabel(item.grossProfit ?? item.gross_profit);
    const units = unitsValueLabel(item.units);
    const href = escapeHtml(buildCatalogUrl(sku));
    const inlineMeta = units ? `<span class="top-seller-inline-meta">${escapeHtml(units)}</span>` : "";

    return `
      <div class="top-seller-item">
        <span class="top-seller-rank">${idx + 1}.</span>
        <div class="top-seller-main top-seller-main-inline">
          <a class="top-seller-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(sku)}</a>
          ${inlineMeta}
        </div>
        <span class="top-seller-units">${escapeHtml(grossProfit)}</span>
      </div>
    `;
  }).join("");
}

function topSellerWeekCardHtml(week, items){
  return `
    <div class="top-sellers-week-card">
      <div class="top-sellers-week-title">${escapeHtml(week)}</div>
      <div class="top-sellers-list">${topSellerItemsHtml(items)}</div>
    </div>
  `;
}

function renderInsightShell({ title, hint, bodyHtml, modifier = "" }){
  const mount = el("topSellersKpi");
  if (!mount) return;

  mount.innerHTML = `
    <div class="kpi-strip insight-strip ${modifier}">
      <div class="kpi-strip-head insight-strip-head">
        <div>
          <div class="kpi-strip-label insight-title">${escapeHtml(title)}</div>
          <div class="kpi-strip-hint insight-hint">${escapeHtml(hint)}</div>
        </div>
      </div>
      ${bodyHtml}
    </div>
  `;
}

function buildTopGrossProfitTitle(list){
  const stores = distinctStores(list);
  if (stores.length === 1) return `Top Gross Profit · ${stores[0]}`;
  if (stores.length > 1 && state.stores.size > 0) return `Top Gross Profit · ${stores.length} Stores`;
  return "Top Gross Profit per Week";
}

function buildTopGrossProfitHint(list, weeks){
  const stores = distinctStores(list);
  if (weeks.length <= 1) {
    if (stores.length === 1) return `Top 5 SKUs by Gross Profit in ${weeks[0]} · ${stores[0]}.`;
    return `Top 5 SKUs by Gross Profit in ${weeks[0]}.`;
  }

  if (stores.length === 1) return `Top 5 SKUs by Gross Profit in ${stores[0]} across selected reporting weeks.`;
  return `Top 5 SKUs by Gross Profit for each reporting week.`;
}

function renderTopGrossProfitAdaptive(list){
  const source = (!hasActiveFilters() && raw && raw.weekly_top_gross_profit)
    ? normalizeWeeklyTopGrossProfitMap(raw.weekly_top_gross_profit)
    : buildWeeklyTopGrossProfitFromRows(list, 5);

  const weeks = sortWeekKeys(Object.keys(source || {}));
  const title = buildTopGrossProfitTitle(list);
  const hint = buildTopGrossProfitHint(list, weeks);

  if (weeks.length === 0) {
    renderInsightShell({
      title,
      hint,
      bodyHtml: `<div class="top-sellers-empty-block">—</div>`,
      modifier: "top-sellers-strip top-gross-profit-strip"
    });
    return;
  }

  if (weeks.length === 1) {
    const week = weeks[0];
    const items = Array.isArray(source[week]) ? source[week] : [];
    const hero = items[0] || null;
    const rest = items.slice(1, 5);

    const heroHtml = hero ? `
      <div class="top-seller-hero-primary">
        <div class="top-seller-hero-badge">#1 · ${escapeHtml(week)}</div>
        <div class="top-seller-hero-row">
          <div class="top-seller-hero-line">
            <a class="top-seller-hero-sku" href="${escapeHtml(buildCatalogUrl(hero.sku))}" target="_blank" rel="noopener noreferrer">${escapeHtml(hero.sku)}</a>
            <span class="top-seller-hero-inline-meta">${escapeHtml(unitsValueLabel(hero.units))}</span>
          </div>
          <div class="top-seller-hero-gp">${escapeHtml(grossProfitValueLabel(hero.grossProfit ?? hero.gross_profit))}</div>
        </div>
      </div>
    ` : `<div class="top-sellers-empty-block">—</div>`;

    const restHtml = rest.length
      ? `<div class="top-seller-hero-list">${topSellerItemsHtml(rest)}</div>`
      : `<div class="top-sellers-empty-block">No more ranked SKUs in this view.</div>`;

    renderInsightShell({
      title,
      hint,
      bodyHtml: `
        <div class="top-seller-hero-grid">
          ${heroHtml}
          <div class="top-seller-hero-side">
            <div class="top-seller-hero-side-title">Top 2–5 by Gross Profit · ${escapeHtml(week)}</div>
            ${restHtml}
          </div>
        </div>
      `,
      modifier: "top-sellers-strip top-sellers-strip-single top-gross-profit-strip"
    });
    return;
  }

  if (weeks.length <= 3) {
    const cards = weeks.map((week) => topSellerWeekCardHtml(week, source[week])).join("");
    renderInsightShell({
      title,
      hint,
      bodyHtml: `<div class="top-sellers-grid top-sellers-grid-few">${cards}</div>`,
      modifier: "top-sellers-strip top-sellers-strip-few top-gross-profit-strip"
    });
    return;
  }

  const cols = weeks.map((week) => `
    <div class="top-sellers-week">
      <div class="top-sellers-week-title">${escapeHtml(week)}</div>
      <div class="top-sellers-list">${topSellerItemsHtml(source[week])}</div>
    </div>
  `).join("");

  renderInsightShell({
    title,
    hint,
    bodyHtml: `<div class="top-sellers-grid top-sellers-grid-multi">${cols}</div>`,
    modifier: "top-sellers-strip top-sellers-strip-multi top-gross-profit-strip"
  });
}

function renderSkuPerformance(list){
  const skuFilter = getSkuFilterText();
  const skus = distinctSkus(list);
  const weeks = distinctWeekKeys(list);
  const stores = distinctStores(list);

  const title = skus.length === 1
    ? `SKU Performance · ${skus[0]}`
    : `Filtered SKU Performance`;

  const hint = skus.length === 1
    ? `${fmtNum(stores.length)} store(s) · ${fmtNum(weeks.length)} reporting week(s) selected`
    : `${fmtNum(skus.length)} SKU(s) · ${fmtNum(stores.length)} store(s) · ${fmtNum(weeks.length)} reporting week(s) · search: ${skuFilter}`;

  const weeklyMap = aggregateByWeek(list);
  const weekCards = sortWeekKeys([...weeklyMap.keys()]).map((week) => {
    const a = weeklyMap.get(week);
    const weekGp = a.net - a.cogs;
    const weekGm = a.net !== 0 ? weekGp / a.net : null;
    return `
      <div class="week-summary-card">
        <div class="week-summary-title">${escapeHtml(week)}</div>
        <div class="week-summary-row"><span>Units</span><strong>${fmtNum(a.units)}</strong></div>
        <div class="week-summary-row"><span>Net Sales</span><strong>${fmtGBP(a.net)}</strong></div>
        <div class="week-summary-row"><span>Gross Profit</span><strong>${fmtGBP(weekGp)}</strong></div>
        <div class="week-summary-row"><span>Margin</span><strong>${weekGm === null ? "—" : fmtPct(weekGm)}</strong></div>
      </div>
    `;
  }).join("");

  const bodyHtml = `
    <div class="week-summary-grid">${weekCards || `<div class="top-sellers-empty-block">—</div>`}</div>
  `;

  renderInsightShell({
    title,
    hint,
    bodyHtml,
    modifier: "sku-performance-strip sku-performance-strip-compact"
  });
}

function renderInsightPanel(list){
  if (hasSkuFilter()) {
    renderSkuPerformance(list);
    return;
  }
  renderTopGrossProfitAdaptive(list);
}

function compareDefaultRows(a, b){
  const aYear = displayYear(a);
  const bYear = displayYear(b);
  if (aYear !== bYear) return bYear - aYear;

  const aWeek = displayWeek(a);
  const bWeek = displayWeek(b);
  if (aWeek !== bWeek) return bWeek - aWeek;

  if (a.Store !== b.Store) return a.Store.localeCompare(b.Store);
  return a.SKU.localeCompare(b.SKU);
}

function compareUnitsRows(a, b, direction = "desc") {
  const diff = Number(a.Units || 0) - Number(b.Units || 0);
  if (diff !== 0) return direction === "asc" ? diff : -diff;
  return compareDefaultRows(a, b);
}

function updateUnitsSortUi(){
  const btn = el("unitsSortBtn");
  const icon = el("unitsSortIcon");
  if (!btn || !icon) return;

  const mode = state.unitsSort;
  const symbol = mode === "desc" ? "↓" : mode === "asc" ? "↑" : "↕";
  const label = mode === "desc" ? "Units sorted descending" : mode === "asc" ? "Units sorted ascending" : "Sort by units";

  icon.textContent = symbol;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", `${label}. Click to toggle.`);
  btn.dataset.sort = mode || "none";
}

function buildMultiSelect({ mountId, title, options, getSet, onChange }){
  const mount = el(mountId);

  mount.innerHTML = `
    <button class="ms-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="ms-title">${title}</span>
      <span class="ms-value" data-ms-value>All</span>
      <span class="ms-caret">▾</span>
    </button>
    <div class="ms-panel" role="listbox" aria-multiselectable="true">
      <input class="ms-search" type="text" placeholder="Search…" />
      <div class="ms-actions">
        <button class="ms-link" type="button" data-act="all">Select all</button>
        <button class="ms-link" type="button" data-act="none">Clear</button>
      </div>
      <div class="ms-list" data-ms-list></div>
    </div>
  `;

  const btn = mount.querySelector(".ms-btn");
  const list = mount.querySelector("[data-ms-list]");
  const valEl = mount.querySelector("[data-ms-value]");
  const search = mount.querySelector(".ms-search");

  const render = () => {
    const set = getSet();
    valEl.textContent = selectionSummary(set, "All");
    btn.setAttribute("aria-expanded", mount.classList.contains("open") ? "true" : "false");

    const q = (search.value || "").trim().toLowerCase();
    const filteredOpts = q
      ? options.filter(o =>
          (o.label || "").toLowerCase().includes(q) ||
          (o.value || "").toLowerCase().includes(q)
        )
      : options;

    list.innerHTML = filteredOpts.map(o => {
      const checked = set.has(o.value) ? "checked" : "";
      const safe = String(o.value).replace(/"/g, "&quot;");
      return `
        <label class="ms-item">
          <input type="checkbox" value="${safe}" ${checked} />
          <span>${o.label}</span>
        </label>
      `;
    }).join("");
  };

  const open = () => {
    if (__openMs && __openMs !== mount) __openMs.classList.remove("open");
    __openMs = mount;
    mount.classList.add("open");
    render();
    search.focus();
    search.select();
  };

  const close = () => {
    mount.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    if (__openMs === mount) __openMs = null;
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (mount.classList.contains("open")) close();
    else open();
  });

  mount.querySelector(".ms-actions").addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.act) return;

    const set = getSet();
    set.clear();

    if (t.dataset.act === "all") {
      options.forEach(o => set.add(o.value));
    }

    render();
    onChange();
    e.preventDefault();
  });

  list.addEventListener("change", (e) => {
    const inp = e.target;
    if (!inp || inp.tagName !== "INPUT") return;

    const v = String(inp.value);
    const set = getSet();

    if (inp.checked) set.add(v);
    else set.delete(v);

    render();
    onChange();
  });

  search.addEventListener("input", () => render());

  document.addEventListener("click", (e) => {
    if (!mount.classList.contains("open")) return;
    if (mount.contains(e.target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mount.classList.contains("open")) close();
  });

  render();

  return { render, close, open };
}

// -------------------- KPIs with weekly breakdown --------------------
function aggregateByWeek(list){
  const map = new Map();

  for (const r of list){
    const k = weekKey(r);
    if (!map.has(k)) map.set(k, { net: 0, cogs: 0, units: 0 });

    const a = map.get(k);
    a.net += (r.NetSales || 0);
    a.cogs += (r.COGS || 0);
    a.units += (r.Units || 0);
  }

  return map;
}

function weeklyLinesHtml(weeklyMap, metric){
  const keys = sortWeekKeys([...weeklyMap.keys()]);
  if (keys.length === 0) return `<div class="kpi-weekly empty">—</div>`;

  const rowsHtml = keys.map(k => {
    const a = weeklyMap.get(k);
    const net = a.net;
    const cogs = a.cogs;
    const gp = net - cogs;
    const gm = net !== 0 ? gp / net : null;

    let v = "—";
    if (metric === "net") v = fmtGBP(net);
    if (metric === "cogs") v = fmtGBP(cogs);
    if (metric === "gp") v = fmtGBP(gp);
    if (metric === "gm") v = gm === null ? "—" : fmtPct(gm);

    return `<div class="kpi-week-row"><span>${k}</span><span class="num">${v}</span></div>`;
  }).join("");

  return `<div class="kpi-weekly">${rowsHtml}</div>`;
}

function renderKpis(list){
  const net = list.reduce((a, r) => a + (r.NetSales || 0), 0);
  const cogs = list.reduce((a, r) => a + (r.COGS || 0), 0);
  const gp = net - cogs;
  const gm = net !== 0 ? gp / net : null;

  const weekly = aggregateByWeek(list);

  const kpis = [
    { label: "Net Sales (£)", value: fmtGBP(net), hint: "Gross Sales – Discounts – Returns (Ex VAT)", metric: "net" },
    { label: "COGS (£)", value: fmtGBP(cogs), hint: "Σ (Units Sold × Cost per Unit at time of sale (Ex VAT))", metric: "cogs" },
    { label: "Gross Profit (£)", value: fmtGBP(gp), hint: "Net Sales – COGS", metric: "gp" },
    { label: "Gross Margin (%)", value: gm === null ? "—" : fmtPct(gm), hint: "Gross Profit ÷ Net Sales", metric: "gm" },
  ];

  el("kpis").innerHTML = kpis.map(k => `
    <div class="card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-hint">${k.hint}</div>
      ${weeklyLinesHtml(weekly, k.metric)}
    </div>
  `).join("");

  renderInsightPanel(list);
}

// -------------------- Table --------------------
function renderTable(){
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  el("tbody").innerHTML = slice.map(r => `
    <tr>
      <td>${escapeHtml(r.Store)}</td>
      <td>
        <a class="sku-link" href="${escapeHtml(r.CatalogUrl)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(r.SKU)}
        </a>
      </td>
      <td class="thumb-cell">
        <a
          class="product-image-link"
          href="${escapeHtml(r.ProductImageUrl || DEFAULT_PRODUCT_IMAGE_URL)}"
          target="_blank"
          rel="noopener noreferrer"
          title="Open product image"
        >
          <img
            class="prod-thumb"
            src="${escapeHtml(r.ProductImageUrl || DEFAULT_PRODUCT_IMAGE_URL)}"
            alt="${escapeHtml(r.SKU)}"
            loading="lazy"
          />
        </a>
      </td>
      <td>${displayYear(r)}</td>
      <td>${displayWeek(r)}</td>
      <td class="num">${fmtNum(r.Units)}</td>
      <td class="num">${fmtNum(r.ExecutionStockQty)}</td>
      <td class="num">${fmtGBP(r.NetSales)}</td>
      <td class="num">${fmtGBP(r.COGS)}</td>
      <td class="num">${fmtGBP(r.GrossProfit)}</td>
      <td class="num">${fmtPct(r.GrossMarginPct)}</td>
      <td class="num">${Number(r.WeightedUnitCost || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  el("pageInfo").textContent = `Rows: ${filtered.length} · Page ${page}/${totalPages}`;
  el("prevBtn").disabled = page <= 1;
  el("nextBtn").disabled = page >= totalPages;
}

function applyFilters(){
  const sku = el("skuSearch").value.trim().toLowerCase();

  filtered = rows.filter(r => {
    if (state.stores.size > 0 && !state.stores.has(r.Store)) return false;
    if (state.weeks.size > 0 && !state.weeks.has(weekKey(r))) return false;
    if (sku && !r.SKU.toLowerCase().includes(sku)) return false;
    return true;
  });

  if (state.unitsSort === "desc" || state.unitsSort === "asc") {
    filtered.sort((a, b) => compareUnitsRows(a, b, state.unitsSort));
  } else {
    filtered.sort(compareDefaultRows);
  }

  updateUnitsSortUi();

  page = 1;
  renderKpis(filtered);
  renderTable();
}

let msStore = null;
let msWeek = null;

function fillFilters(){
  const stores = uniq(rows.map(r => r.Store));
  const weeks = uniq(rows.map(weekKey));
  const weeksSorted = sortWeekKeys(weeks);

  msStore = buildMultiSelect({
    mountId: "storeMs",
    title: "",
    options: stores.map(s => ({ value: s, label: s })),
    getSet: () => state.stores,
    onChange: applyFilters,
  });

  msWeek = buildMultiSelect({
    mountId: "weekMs",
    title: "",
    options: weeksSorted.map(w => ({ value: w, label: w })),
    getSet: () => state.weeks,
    onChange: applyFilters,
  });
}

function formatGeneratedAtUtc(value){
  if (!value) return "—";

  const s = String(value).trim();

  // Si ya viene con zona explícita, normalizamos
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }

  // Si el backend dice que es UTC pero viene "naive",
  // evitamos que el navegador lo trate como hora local
  return s.replace(" ", "T") + "Z";
}

async function load(){
  el("meta").textContent = "Loading…";

  const res = await fetch(GP_REPORT_URL, { cache: "no-store" });

  /*const res = await fetch(GP_REPORT_URL, {
    cache: "no-store",
    credentials: "include"
  });*/

  if (!res.ok){
    el("meta").textContent = `Error loading data (${res.status})`;
    throw new Error(`GET failed: ${res.status}`);
  }

  raw = await res.json();
  rows = normalizeData(raw);
  filtered = [...rows];

  // const ts = raw.generated_at_utc ? new Date(raw.generated_at_utc).toISOString() : "—";
  const ts = formatGeneratedAtUtc(raw.generated_at_utc);
  el("meta").textContent = `Updated (UTC): ${ts} · Rows: ${rows.length}`;

  fillFilters();
  applyFilters();
}

function wire(){
  el("skuSearch").addEventListener("input", () => {
    window.clearTimeout(window.__t);
    window.__t = window.setTimeout(applyFilters, 150);
  });

  el("clearBtn").addEventListener("click", () => {
    state.stores.clear();
    state.weeks.clear();
    el("skuSearch").value = "";

    if (msStore) msStore.render();
    if (msWeek) msWeek.render();

    applyFilters();
  });

  const exportWrap = document.querySelector(".export");
  const exportBtn = el("exportBtn");
  const exportMenu = el("exportMenu");
  const exportCsvItem = el("exportCsv");

  if (exportBtn && exportWrap && exportMenu){
    const closeExport = () => exportWrap.classList.remove("open");

    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      exportWrap.classList.toggle("open");
    });

    if (exportCsvItem){
      exportCsvItem.addEventListener("click", (e) => {
        e.preventDefault();
        closeExport();
        exportCsv();
      });
    }

    document.addEventListener("click", (e) => {
      if (!exportWrap.classList.contains("open")) return;
      if (exportWrap.contains(e.target)) return;
      closeExport();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeExport();
    });
  }

  el("prevBtn").addEventListener("click", () => {
    page--;
    renderTable();
  });

  el("nextBtn").addEventListener("click", () => {
    page++;
    renderTable();
  });

  const unitsSortBtn = el("unitsSortBtn");
  if (unitsSortBtn) {
    unitsSortBtn.addEventListener("click", () => {
      state.unitsSort = state.unitsSort === "desc" ? "asc" : "desc";
      applyFilters();
    });
  }

  updateUnitsSortUi();
  el("refreshBtn").addEventListener("click", load);
}

wire();
load().catch(err => console.error(err));
