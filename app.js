// ✅ Pon aquí tu endpoint público del Worker
const GP_REPORT_URL = "https://mute-moon-e712.hectora-b43.workers.dev/gp-report";

let raw = null;
let rows = [];
let filtered = [];

let page = 1;
const pageSize = 120;

const el = (id) => document.getElementById(id);

function fmtGBP(x){
  const n = Number(x || 0);
  return n.toLocaleString("en-GB", { style:"currency", currency:"GBP", minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtNum(x){
  const n = Number(x || 0);
  return n.toLocaleString("en-GB", { minimumFractionDigits:0, maximumFractionDigits:0 });
}
function fmtPct(x){
  if (x === null || x === undefined || isNaN(Number(x))) return "—";
  return (Number(x) * 100).toFixed(2) + "%";
}

function uniq(arr){
  return [...new Set(arr)].filter(v => v !== null && v !== undefined && v !== "").sort();
}

function weekKey(r){
  const y = Number(r.ISOYear ?? r.isoyear ?? 0);
  const w = Number(r.ISOWeek ?? r.isoweek ?? 0);
  return `${y}-W${String(w).padStart(2,"0")}`;
}

function normalizeData(payload){
  const data = payload.data || [];
  return data.map((r) => ({
    Store: String(r.Store ?? r.store ?? ""),
    SKU: String(r.SKU ?? r.sku ?? ""),
    ISOYear: Number(r.ISOYear ?? r.isoyear ?? 0),
    ISOWeek: Number(r.ISOWeek ?? r.isoweek ?? 0),
    Units: Number(r.Units_NewStore ?? r.units_newstore ?? r.units ?? 0),
    NetSales: Number(r.NetSales ?? r.netsales ?? 0),
    COGS: Number(r.COGS ?? r.cogs ?? 0),
    GrossProfit: Number(r.GrossProfit ?? r.grossprofit ?? 0),
    GrossMarginPct: r.GrossMarginPct ?? r.grossmarginpct ?? null,
    WeightedUnitCost: Number(r.WeightedUnitCost ?? r.weightedunitcost ?? 0),
    _merge: String(r._merge ?? ""),
  }));
}

function renderKpis(list){
  const net = list.reduce((a,r)=>a + (r.NetSales||0),0);
  const cogs = list.reduce((a,r)=>a + (r.COGS||0),0);
  const gp = net - cogs;
  const gm = net !== 0 ? gp / net : null;

  const kpis = [
    { label:"Net Sales (£)", value: fmtGBP(net), hint:"Gross Sales – Discounts – Returns (Ex VAT)" },
    { label:"COGS (£)", value: fmtGBP(cogs), hint:"Σ (Units Sold × Cost per Unit at time of sale)" },
    { label:"Gross Profit (£)", value: fmtGBP(gp), hint:"Net Sales – COGS" },
    { label:"Gross Margin (%)", value: gm === null ? "—" : fmtPct(gm), hint:"Gross Profit ÷ Net Sales" },
  ];

  el("kpis").innerHTML = kpis.map(k => `
    <div class="card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-hint">${k.hint}</div>
    </div>
  `).join("");
}

function renderTable(){
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  el("tbody").innerHTML = slice.map(r => `
    <tr>
      <td>${r.Store}</td>
      <td>${r.SKU}</td>
      <td>${r.ISOYear}</td>
      <td>${r.ISOWeek}</td>
      <td class="num">${fmtNum(r.Units)}</td>
      <td class="num">${fmtGBP(r.NetSales)}</td>
      <td class="num">${fmtGBP(r.COGS)}</td>
      <td class="num">${fmtGBP(r.GrossProfit)}</td>
      <td class="num">${fmtPct(r.GrossMarginPct)}</td>
      <td class="num">${Number(r.WeightedUnitCost||0).toFixed(2)}</td>
      <td class="muted">${r._merge}</td>
    </tr>
  `).join("");

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  el("pageInfo").textContent = `Rows: ${filtered.length} · Page ${page}/${totalPages}`;
  el("prevBtn").disabled = page <= 1;
  el("nextBtn").disabled = page >= totalPages;
}

function applyFilters(){
  const store = el("storeSel").value;
  const week = el("weekSel").value;
  const sku = el("skuSearch").value.trim().toLowerCase();

  filtered = rows.filter(r => {
    if (store !== "__ALL__" && r.Store !== store) return false;
    if (week !== "__ALL__" && weekKey(r) !== week) return false;
    if (sku && !r.SKU.toLowerCase().includes(sku)) return false;
    return true;
  });

  // orden tipo reporte: ISOYear/ISOWeek desc, Store, SKU
  filtered.sort((a,b)=>{
    if (a.ISOYear !== b.ISOYear) return b.ISOYear - a.ISOYear;
    if (a.ISOWeek !== b.ISOWeek) return b.ISOWeek - a.ISOWeek;
    if (a.Store !== b.Store) return a.Store.localeCompare(b.Store);
    return a.SKU.localeCompare(b.SKU);
  });

  page = 1;
  renderKpis(filtered);
  renderTable();
}

function fillFilters(){
  const stores = uniq(rows.map(r => r.Store));
  const weeks = uniq(rows.map(weekKey));

  el("storeSel").innerHTML =
    `<option value="__ALL__">All</option>` +
    stores.map(s => `<option value="${s}">${s}</option>`).join("");

  el("weekSel").innerHTML =
    `<option value="__ALL__">All</option>` +
    weeks.map(w => `<option value="${w}">${w}</option>`).join("");
}

async function load(){
  el("meta").textContent = "Loading…";
  const res = await fetch(GP_REPORT_URL, { cache: "no-store" });
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
  el("storeSel").addEventListener("change", applyFilters);
  el("weekSel").addEventListener("change", applyFilters);
  el("skuSearch").addEventListener("input", () => {
    window.clearTimeout(window.__t);
    window.__t = window.setTimeout(applyFilters, 150);
  });

  el("clearBtn").addEventListener("click", () => {
    el("storeSel").value = "__ALL__";
    el("weekSel").value = "__ALL__";
    el("skuSearch").value = "";
    applyFilters();
  });

  el("prevBtn").addEventListener("click", () => { page--; renderTable(); });
  el("nextBtn").addEventListener("click", () => { page++; renderTable(); });
  el("refreshBtn").addEventListener("click", load);
}

wire();
load().catch(err => console.error(err));
