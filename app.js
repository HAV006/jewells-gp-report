// ✅ Pon aquí tu endpoint público del Worker
const GP_REPORT_URL = "https://mute-moon-e712.hectora-b43.workers.dev/gp-report";

const ITEM_IMAGE_BASE_URL = "https://jewells-com.s3.amazonaws.com/ITEM%20JPG";
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

function weekKey(r){
  const y = Number(r.ISOYear ?? r.isoyear ?? 0);
  const w = Number(r.ISOWeek ?? r.isoweek ?? 0);
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

function buildProductImageUrl(sku, index){
  const safeSku = encodeURIComponent(String(sku || "").trim());
  return `${ITEM_IMAGE_BASE_URL}/${safeSku}_${index}.png`;
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
      Units: Number(r.Units_NewStore ?? r.units_newstore ?? r.Units ?? r.units ?? 0),
      NetSales: Number(r.NetSales ?? r.netsales ?? 0),
      COGS: Number(r.COGS ?? r.cogs ?? 0),
      GrossProfit: Number(r.GrossProfit ?? r.grossprofit ?? 0),
      GrossMarginPct: r.GrossMarginPct ?? r.grossmarginpct ?? null,
      WeightedUnitCost: Number(r.WeightedUnitCost ?? r.weightedunitcost ?? 0),
      _merge: String(r._merge ?? ""),

      ProductImageUrl1: buildProductImageUrl(sku, 1),
      ProductImageUrl2: buildProductImageUrl(sku, 2),
      ProductImageFallback: DEFAULT_PRODUCT_IMAGE_URL,
      CatalogUrl: buildCatalogUrl(sku),
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
    ISOYear: r.ISOYear,
    ISOWeek: r.ISOWeek,
    Units: Number(r.Units || 0),
    NetSales: Number(r.NetSales || 0),
    COGS: Number(r.COGS || 0),
    GrossProfit: Number(r.GrossProfit || 0),
    GrossMarginPct: (r.GrossMarginPct === null || r.GrossMarginPct === undefined)
      ? ""
      : Number(r.GrossMarginPct),
    WeightedUnitCost: Number(r.WeightedUnitCost || 0) //,
    // Merge: r._merge || "",
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
  const panel = mount.querySelector(".ms-panel");
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
}

// -------------------- Product thumbs --------------------
function wireProductThumbs(scope = document){
  scope.querySelectorAll("img[data-product-thumb]").forEach((img) => {
    if (img.dataset.wired === "1") return;
    img.dataset.wired = "1";

    const link = img.closest("a");

    if (link) {
      link.href = img.currentSrc || img.src;
    }

    img.addEventListener("load", () => {
      if (link) {
        link.href = img.currentSrc || img.src;
      }
    });

    img.addEventListener("error", () => {
      const currentStage = img.dataset.stage || "1";

      if (currentStage === "1") {
        img.dataset.stage = "2";
        img.src = img.dataset.src2;
        if (link) link.href = img.dataset.src2;
        return;
      }

      img.dataset.stage = "fallback";
      img.onerror = null;
      img.src = img.dataset.fallback;
      if (link) link.href = img.dataset.fallback;
    });
  });
}

// -------------------- Table --------------------
function renderTable(){
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  el("tbody").innerHTML = slice.map(r => `
    <tr>
      <td>${escapeHtml(r.Store)}</td>
      <td>
        <a class="sku-link" href="${r.CatalogUrl}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(r.SKU)}
        </a>
      </td>
      <td class="thumb-cell">
        <a
          class="product-image-link"
          href="${r.ProductImageUrl1}"
          target="_blank"
          rel="noopener noreferrer"
          title="Open product image"
        >
          <img
            class="prod-thumb"
            data-product-thumb="1"
            data-stage="1"
            data-src2="${r.ProductImageUrl2}"
            data-fallback="${r.ProductImageFallback}"
            src="${r.ProductImageUrl1}"
            alt="${escapeHtml(r.SKU)}"
            loading="lazy"
          />
        </a>
      </td>
      <td>${r.ISOYear}</td>
      <td>${r.ISOWeek}</td>
      <td class="num">${fmtNum(r.Units)}</td>
      <td class="num">${fmtGBP(r.NetSales)}</td>
      <td class="num">${fmtGBP(r.COGS)}</td>
      <td class="num">${fmtGBP(r.GrossProfit)}</td>
      <td class="num">${fmtPct(r.GrossMarginPct)}</td>
      <td class="num">${Number(r.WeightedUnitCost || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  wireProductThumbs(el("tbody"));

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

  filtered.sort((a, b) => {
    if (a.ISOYear !== b.ISOYear) return b.ISOYear - a.ISOYear;
    if (a.ISOWeek !== b.ISOWeek) return b.ISOWeek - a.ISOWeek;
    if (a.Store !== b.Store) return a.Store.localeCompare(b.Store);
    return a.SKU.localeCompare(b.SKU);
  });

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

  const ts = raw.generated_at_utc ? new Date(raw.generated_at_utc).toISOString() : "—";
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

  el("refreshBtn").addEventListener("click", load);
}

wire();
load().catch(err => console.error(err));
