// app.js - LixCap Trade Flow Dashboard v16
// Two separate bar charts for compare mode - each showing its own true Top N

const FLOWS_URL = "data/flows_agg.csv";
const CENTROIDS_URL = "data/Country_Centroid.ISO.with_xy.csv";

const COMPARE_COLORS = {
  light: { country1: '#0F4878', country2: '#E07A24' },
  dark: { country1: '#2d7fc4', country2: '#F5A623' }
};

const COLORS = {
  dark: {
    primary: '#2d7fc4', secondary: '#0F4878', target: '#ef4444', text: '#ffffff',
    grid: 'rgba(255,255,255,0.1)', paper: 'rgba(0,0,0,0)',
    barGradient: ['#05293F', '#0a3a5c', '#0F4878', '#1a6ba8', '#2d7fc4', '#4a9ed6', '#6bb3e0', '#8cc8ea', '#adddf4', '#ceeeff'],
    lines: ['#2d7fc4', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'],
    total: '#ffffff'
  },
  light: {
    primary: '#0F4878', secondary: '#05293F', target: '#dc2626', text: '#05293F',
    grid: 'rgba(0,0,0,0.1)', paper: 'rgba(0,0,0,0)',
    barGradient: ['#ceeeff', '#adddf4', '#8cc8ea', '#6bb3e0', '#4a9ed6', '#2d7fc4', '#1a6ba8', '#0F4878', '#0a3a5c', '#05293F'],
    lines: ['#0F4878', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5'],
    total: '#05293F'
  }
};

const els = {
  partner: document.getElementById("partner"),
  partner2: document.getElementById("partner2"),
  partner2Label: document.getElementById("partner2Label"),
  year: document.getElementById("year"),
  year2: document.getElementById("year2"),
  year2Label: document.getElementById("year2Label"),
  temp: document.getElementById("temp"),
  temp2: document.getElementById("temp2"),
  temp2Label: document.getElementById("temp2Label"),
  compareMode: document.getElementById("compareMode"),
  compareType: document.getElementById("compareType"),
  compareTypeWrapper: document.getElementById("compareTypeWrapper"),
  compareLegend: document.getElementById("compareLegend"),
  legend1Name: document.getElementById("legend1Name"),
  legend2Name: document.getElementById("legend2Name"),
  legend1Item: document.getElementById("legend1Item"),
  legend2Item: document.getElementById("legend2Item"),
  partner1Dot: document.getElementById("partner1Dot"),
  year1Dot: document.getElementById("year1Dot"),
  temp1Dot: document.getElementById("temp1Dot"),
  usaCard1: document.getElementById("usaCard1"),
  usaCard2: document.getElementById("usaCard2"),
  singleGrid: document.getElementById("singleGrid"),
  compareGrid: document.getElementById("compareGrid"),
  topn: document.getElementById("topn"),
  product: document.getElementById("product"),
  metric: document.getElementById("metric"),
  reset: document.getElementById("reset"),
  themeToggle: document.getElementById("themeToggle"),
};

let flows = [], centroids = new Map();
let map, mapCompare, layerGroup, layerGroupCompare, tileLayer, tileLayerCompare;
let currentTheme = 'light', currentAnimationId = 0, showTotal = true, showBreakdown = false;
let compareMode = false;
let compareType = 'countries';
let show1 = true, show2 = true;

// Theme
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  currentTheme = t;
  localStorage.setItem('lixcap-theme', t);
  updateMapTiles();
  rerender();
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
function initTheme() {
  const s = localStorage.getItem('lixcap-theme');
  currentTheme = s || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
}

// Utils
function uniq(a) { return [...new Set(a)].filter(v => v != null && v !== ""); }
function fillSelect(sel, vals, all = "All") {
  sel.innerHTML = `<option value="">${all}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join('');
}
function parseNum(x) { const n = Number(x); return isFinite(n) ? n : 0; }
function formatNumber(n) {
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toFixed(0);
}
function loadCSV(url) {
  return fetch(url).then(r => r.ok ? r.text() : Promise.reject(url))
    .then(t => Papa.parse(t, {header:true, skipEmptyLines:true}).data);
}

// Maps
let mapCompareInitialized = false;

function initMap() {
  map = L.map("map", {worldCopyJump:true, zoomControl:true, preferCanvas:true}).setView([25,20],2);
  layerGroup = L.layerGroup().addTo(map);
  updateMapTiles();
}

function initMapCompare() {
  if (mapCompareInitialized) {
    mapCompare.invalidateSize();
    return;
  }
  mapCompare = L.map("mapCompare", {worldCopyJump:true, zoomControl:true, preferCanvas:true}).setView([25,20],2);
  layerGroupCompare = L.layerGroup().addTo(mapCompare);
  
  const url = getTheme()==='dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  tileLayerCompare = L.tileLayer(url, {maxZoom:10, attribution:"© OSM © CartoDB"}).addTo(mapCompare);
  
  mapCompareInitialized = true;
}

function updateMapTiles() {
  const url = getTheme()==='dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(url, {maxZoom:10, attribution:"© OSM © CartoDB"}).addTo(map);
  
  if (mapCompareInitialized && mapCompare) {
    if (tileLayerCompare) mapCompare.removeLayer(tileLayerCompare);
    tileLayerCompare = L.tileLayer(url, {maxZoom:10, attribution:"© OSM © CartoDB"}).addTo(mapCompare);
  }
}

// Filters
function getFilters() {
  return {
    partner: els.partner.value,
    partner2: els.partner2.value,
    year: els.year.value,
    year2: els.year2.value,
    temp: els.temp.value,
    temp2: els.temp2.value,
    topn: Number(els.topn.value||10),
    product: els.product.value,
    metric: els.metric.value
  };
}

function applyFiltersCustom(partnerISO, year, temp, ignoreYear = false) {
  const f = getFilters();
  return flows.filter(r =>
    (!partnerISO || r.PartnerISO3 === partnerISO) &&
    (ignoreYear || !year || String(r.Year) === String(year)) &&
    (!f.product || r["Value chains"] === f.product) &&
    (!temp || r.Temperature === temp)
  );
}

function topNReporters(filtered, metric, n) {
  const m = new Map();
  filtered.forEach(r => { if(r.ReporterISO3) m.set(r.ReporterISO3, (m.get(r.ReporterISO3)||0)+parseNum(r[metric])); });
  return [...m.entries()].filter(d=>d[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,n);
}

function getUSAData(filtered, metric) {
  const m = new Map();
  filtered.forEach(r => { 
    if(r.ReporterISO3) m.set(r.ReporterISO3, (m.get(r.ReporterISO3)||0)+parseNum(r[metric])); 
  });
  const sorted = [...m.entries()].filter(d=>d[1]>0).sort((a,b)=>b[1]-a[1]);
  const usaIndex = sorted.findIndex(d => d[0] === 'USA');
  return {
    rank: usaIndex >= 0 ? usaIndex + 1 : null,
    value: m.get('USA') || 0,
    total: sorted.length
  };
}

function updateUSACards() {
  const f = getFilters();
  const metric = f.metric;
  const unit = metric === 'value_usd' ? 'USD' : 'MT';
  
  if (compareMode) {
    let filtered1, filtered2, title1, title2;
    
    if (compareType === 'countries') {
      filtered1 = applyFiltersCustom(f.partner, f.year, f.temp, false);
      filtered2 = applyFiltersCustom(f.partner2, f.year, f.temp, false);
      const name1 = centroids.get(f.partner)?.Country || f.partner;
      const name2 = centroids.get(f.partner2)?.Country || f.partner2;
      title1 = `USA → ${name1}`;
      title2 = `USA → ${name2}`;
    } else if (compareType === 'years') {
      filtered1 = applyFiltersCustom(f.partner, f.year, f.temp, false);
      filtered2 = applyFiltersCustom(f.partner, f.year2, f.temp, false);
      title1 = `USA (${f.year || 'All'})`;
      title2 = `USA (${f.year2 || 'All'})`;
    } else {
      filtered1 = applyFiltersCustom(f.partner, f.year, f.temp, false);
      filtered2 = applyFiltersCustom(f.partner, f.year, f.temp2, false);
      title1 = `USA (${f.temp || 'All'})`;
      title2 = `USA (${f.temp2 || 'All'})`;
    }
    
    const usa1 = getUSAData(filtered1, metric);
    const usa2 = getUSAData(filtered2, metric);
    
    document.getElementById('usaCardTitle1').textContent = title1;
    document.getElementById('usaValue1').textContent = usa1.value > 0 ? formatNumber(usa1.value) : 'N/A';
    document.getElementById('usaUnit1').textContent = unit;
    document.getElementById('usaRank1').textContent = usa1.rank ? `Rank #${usa1.rank} of ${usa1.total}` : 'No data';
    
    document.getElementById('usaCardTitle2').textContent = title2;
    document.getElementById('usaValue2').textContent = usa2.value > 0 ? formatNumber(usa2.value) : 'N/A';
    document.getElementById('usaUnit2').textContent = unit;
    document.getElementById('usaRank2').textContent = usa2.rank ? `Rank #${usa2.rank} of ${usa2.total}` : 'No data';
    
    els.usaCard2.classList.remove('hidden');
  } else {
    const filtered = applyFiltersCustom(f.partner, f.year, f.temp, false);
    const usa = getUSAData(filtered, metric);
    
    document.getElementById('usaCardTitle1').textContent = 'Imports from USA';
    document.getElementById('usaValue1').textContent = usa.value > 0 ? formatNumber(usa.value) : 'N/A';
    document.getElementById('usaUnit1').textContent = unit;
    document.getElementById('usaRank1').textContent = usa.rank ? `Rank #${usa.rank} of ${usa.total}` : 'No data';
    
    els.usaCard2.classList.add('hidden');
  }
}

function toggleCompareMode() {
  compareMode = els.compareMode.checked;
  show1 = true; show2 = true;
  
  if (compareMode) {
    els.compareTypeWrapper.classList.remove('hidden');
    els.compareLegend.classList.remove('hidden');
    els.singleGrid.classList.add('hidden');
    els.compareGrid.classList.remove('hidden');
    updateCompareType();
    
    // Initialize compare map AFTER the container is visible
    setTimeout(() => {
      initMapCompare();
      setTimeout(() => {
        mapCompare.invalidateSize();
        rerender();
      }, 100);
    }, 50);
  } else {
    els.compareTypeWrapper.classList.add('hidden');
    els.compareLegend.classList.add('hidden');
    els.singleGrid.classList.remove('hidden');
    els.compareGrid.classList.add('hidden');
    hideAllCompareFields();
    setTimeout(() => {
      map.invalidateSize();
      rerender();
    }, 100);
  }
}

function updateCompareType() {
  compareType = els.compareType.value;
  hideAllCompareFields();
  show1 = true; show2 = true;
  
  if (compareType === 'countries') {
    els.partner2Label.classList.remove('hidden');
    els.partner1Dot.classList.remove('hidden');
    setDefaultCompareValue('partner');
  } else if (compareType === 'years') {
    els.year2Label.classList.remove('hidden');
    els.year1Dot.classList.remove('hidden');
    setDefaultCompareValue('year');
  } else if (compareType === 'temperature') {
    els.temp2Label.classList.remove('hidden');
    els.temp1Dot.classList.remove('hidden');
    setDefaultCompareValue('temp');
  }
  
  rerender();
}

function hideAllCompareFields() {
  els.partner2Label.classList.add('hidden');
  els.year2Label.classList.add('hidden');
  els.temp2Label.classList.add('hidden');
  els.partner1Dot.classList.add('hidden');
  els.year1Dot.classList.add('hidden');
  els.temp1Dot.classList.add('hidden');
}

function setDefaultCompareValue(type) {
  if (type === 'partner') {
    const options = Array.from(els.partner.options).map(o => o.value).filter(v => v && v !== els.partner.value);
    if (options.length && !els.partner2.value) els.partner2.value = options[0];
  } else if (type === 'year') {
    const options = Array.from(els.year.options).map(o => o.value).filter(v => v && v !== els.year.value);
    if (options.length && !els.year2.value) els.year2.value = options[0];
  } else if (type === 'temp') {
    const options = Array.from(els.temp.options).map(o => o.value).filter(v => v && v !== els.temp.value);
    if (options.length && !els.temp2.value) els.temp2.value = options[0];
  }
}

function getCompareLabels() {
  const f = getFilters();
  
  if (compareType === 'countries') {
    return {
      label1: centroids.get(f.partner)?.Country || f.partner || 'Country 1',
      label2: centroids.get(f.partner2)?.Country || f.partner2 || 'Country 2'
    };
  } else if (compareType === 'years') {
    return {
      label1: f.year || 'All Years',
      label2: f.year2 || 'All Years'
    };
  } else {
    return {
      label1: f.temp || 'All Temps',
      label2: f.temp2 || 'All Temps'
    };
  }
}

function setupLegendToggle() {
  const item1 = els.legend1Item;
  const item2 = els.legend2Item;
  
  if (item1) {
    item1.onclick = () => {
      show1 = !show1;
      if (!show1 && !show2) show2 = true;
      item1.classList.toggle('disabled', !show1);
      rerender();
    };
  }
  
  if (item2) {
    item2.onclick = () => {
      show2 = !show2;
      if (!show1 && !show2) show1 = true;
      item2.classList.toggle('disabled', !show2);
      rerender();
    };
  }
}

// ============================================
// BAR CHARTS
// ============================================

// Single bar chart (original)
function renderBarSingle(top, metric, containerId = 'bar') {
  const theme = getTheme(), colors = COLORS[theme];
  const y = top.map(d => centroids.get(d[0])?.Country || d[0]).reverse();
  const x = top.map(d => d[1]).reverse();
  const barColors = x.map((_,i) => colors.barGradient[Math.floor((i/(x.length-1||1))*(colors.barGradient.length-1))]);

  Plotly.react(containerId, [{
    type:"bar", orientation:"h", x, y,
    marker:{color:barColors, line:{color:'rgba(255,255,255,0.2)',width:1}},
    hovertemplate:'<b>%{y}</b><br>%{x:,.0f}<extra></extra>'
  }], {
    margin:{l:90,r:10,t:5,b:30},
    paper_bgcolor:colors.paper, plot_bgcolor:colors.paper,
    font:{color:colors.text, size:9, family:'Inter,sans-serif'},
    xaxis:{title:{text:metric==="value_usd"?"Value (USD)":"Qty (MT)", font:{size:8}}, gridcolor:colors.grid, tickfont:{size:8}},
    yaxis:{gridcolor:colors.grid, tickfont:{size:8}},
    hoverlabel:{bgcolor:theme==='dark'?'#05293F':'#fff', font:{size:9}}
  }, {displayModeBar:false, responsive:true});
}

// Separate bar chart with specific color
function renderBarSeparate(top, metric, containerId, color, label) {
  const theme = getTheme(), colors = COLORS[theme];
  const y = top.map(d => centroids.get(d[0])?.Country || d[0]).reverse();
  const x = top.map(d => d[1]).reverse();

  Plotly.react(containerId, [{
    type:"bar", orientation:"h", x, y,
    marker:{color: color, line:{color:'rgba(255,255,255,0.3)',width:1}},
    hovertemplate:`<b>%{y}</b><br>${label}: %{x:,.0f}<extra></extra>`
  }], {
    margin:{l:85,r:10,t:5,b:30},
    paper_bgcolor:colors.paper, plot_bgcolor:colors.paper,
    font:{color:colors.text, size:9, family:'Inter,sans-serif'},
    xaxis:{title:{text:metric==="value_usd"?"Value (USD)":"Qty (MT)", font:{size:8}}, gridcolor:colors.grid, tickfont:{size:8}},
    yaxis:{gridcolor:colors.grid, tickfont:{size:8}},
    hoverlabel:{bgcolor:theme==='dark'?'#05293F':'#fff', font:{size:9}}
  }, {displayModeBar:false, responsive:true});
}

// ============================================
// LINE CHARTS
// ============================================

function renderLineSingle(filtered, metric, topN) {
  const theme = getTheme();
  const colors = COLORS[theme];

  let allYears = [...new Set(filtered.map(r => String(r.Year)))]
    .filter(y => y && y !== "undefined")
    .sort((a, b) => Number(a) - Number(b));

  const totalByYear = new Map();
  allYears.forEach(y => totalByYear.set(y, 0));
  for (const r of filtered) {
    const y = String(r.Year);
    if (totalByYear.has(y)) totalByYear.set(y, (totalByYear.get(y) || 0) + parseNum(r[metric]));
  }

  const traces = [];
  if (showTotal) {
    traces.push({
      type: "scatter", mode: "lines+markers", name: "TOTAL",
      x: allYears, y: allYears.map(y => totalByYear.get(y) || 0),
      line: { color: colors.total, width: 3, shape: "spline" },
      marker: { size: 5 },
      hovertemplate: `<b>TOTAL</b><br>%{x}: %{y:,.0f}<extra></extra>`
    });
  }

  if (showBreakdown) {
    const reporterTotals = new Map();
    filtered.forEach(r => {
      if (r.ReporterISO3) reporterTotals.set(r.ReporterISO3, (reporterTotals.get(r.ReporterISO3)||0) + parseNum(r[metric]));
    });
    const topReporters = [...reporterTotals.entries()].sort((a,b) => b[1]-a[1]).slice(0, topN).map(d => d[0]);

    topReporters.forEach((iso3, idx) => {
      const countryData = new Map();
      allYears.forEach(y => countryData.set(y, 0));
      filtered.filter(r => r.ReporterISO3 === iso3).forEach(r => {
        const y = String(r.Year);
        if (countryData.has(y)) countryData.set(y, (countryData.get(y)||0) + parseNum(r[metric]));
      });
      traces.push({
        type: "scatter", mode: "lines+markers", name: centroids.get(iso3)?.Country || iso3,
        x: allYears, y: allYears.map(y => countryData.get(y) || 0),
        line: { color: colors.lines[idx % colors.lines.length], width: 2, shape: "spline" },
        marker: { size: 4 },
        hovertemplate: `<b>${centroids.get(iso3)?.Country || iso3}</b><br>%{x}: %{y:,.0f}<extra></extra>`
      });
    });
  }

  const maxY = Math.max(1, ...traces.flatMap(t => t.y || []));

  Plotly.react("line", traces, {
    margin: { l: 50, r: 10, t: 5, b: 55 },
    paper_bgcolor: colors.paper, plot_bgcolor: colors.paper,
    font: { color: colors.text, size: 9, family: "Inter" },
    xaxis: {
      type: "category", gridcolor: colors.grid, tickfont: { size: 8 },
      rangeslider: { visible: true, thickness: 0.06 }
    },
    yaxis: { title: { text: metric === "value_usd" ? "USD" : "MT", font: { size: 8 } }, gridcolor: colors.grid, range: [0, maxY * 1.1], tickformat: "~s", tickfont: { size: 8 } },
    legend: { orientation: "h", y: -0.32, x: 0.5, xanchor: "center", font: { size: 8 } },
    hovermode: "x unified"
  }, { displayModeBar: false, responsive: true });
}

function renderLineCompare(filtered1, filtered2, metric, label1, label2) {
  const theme = getTheme();
  const colors = COLORS[theme];
  const cColors = COMPARE_COLORS[theme];

  const years1 = new Set(filtered1.map(r => String(r.Year)));
  const years2 = new Set(filtered2.map(r => String(r.Year)));
  let allYears = [...new Set([...years1, ...years2])]
    .filter(y => y && y !== "undefined")
    .sort((a, b) => Number(a) - Number(b));

  const totalByYear1 = new Map(), totalByYear2 = new Map();
  allYears.forEach(y => { totalByYear1.set(y, 0); totalByYear2.set(y, 0); });

  filtered1.forEach(r => {
    const y = String(r.Year);
    if (totalByYear1.has(y)) totalByYear1.set(y, (totalByYear1.get(y)||0) + parseNum(r[metric]));
  });
  filtered2.forEach(r => {
    const y = String(r.Year);
    if (totalByYear2.has(y)) totalByYear2.set(y, (totalByYear2.get(y)||0) + parseNum(r[metric]));
  });

  const traces = [];
  
  if (show1) {
    traces.push({
      type: "scatter", mode: "lines+markers", name: label1,
      x: allYears, y: allYears.map(y => totalByYear1.get(y) || 0),
      line: { color: cColors.country1, width: 3, shape: "spline" },
      marker: { size: 5 },
      hovertemplate: `<b>${label1}</b><br>%{x}: %{y:,.0f}<extra></extra>`
    });
  }
  
  if (show2) {
    traces.push({
      type: "scatter", mode: "lines+markers", name: label2,
      x: allYears, y: allYears.map(y => totalByYear2.get(y) || 0),
      line: { color: cColors.country2, width: 3, shape: "spline" },
      marker: { size: 5 },
      hovertemplate: `<b>${label2}</b><br>%{x}: %{y:,.0f}<extra></extra>`
    });
  }

  const maxY = Math.max(1, ...traces.flatMap(t => t.y || []));

  Plotly.react("lineCompare", traces, {
    margin: { l: 50, r: 10, t: 5, b: 70 },
    paper_bgcolor: colors.paper, plot_bgcolor: colors.paper,
    font: { color: colors.text, size: 9, family: "Inter" },
    xaxis: {
      type: "category", gridcolor: colors.grid, tickfont: { size: 8 },
      rangeslider: { visible: true, thickness: 0.08 }
    },
    yaxis: { title: { text: metric === "value_usd" ? "USD" : "MT", font: { size: 8 } }, gridcolor: colors.grid, range: [0, maxY * 1.1], tickformat: "~s", tickfont: { size: 8 } },
    legend: { orientation: "h", y: -0.42, x: 0.5, xanchor: "center", font: { size: 9 } },
    hovermode: "x unified"
  }, { displayModeBar: false, responsive: true });
}

// ============================================
// MAPS
// ============================================

function drawArc(from, to, weight, color) {
  if (typeof L.curve === 'function') {
    const midLat = (from.lat + to.lat) / 2 + Math.abs(from.lon - to.lon) * 0.12;
    const midLon = (from.lon + to.lon) / 2;
    return L.curve(["M", [from.lat, from.lon], "Q", [midLat, midLon], [to.lat, to.lon]], { weight, opacity: 0.7, color, fill: false, interactive: false });
  }
  return L.polyline([[from.lat, from.lon], [to.lat, to.lon]], { weight, opacity: 0.6, color, interactive: false });
}

function clearMapLegend(mapEl) {
  mapEl.querySelectorAll('.map-legend').forEach(el => el.remove());
}

function renderMapSingle(partnerISO, top, metric) {
  const theme = getTheme(), colors = COLORS[theme];
  const thisId = ++currentAnimationId;
  layerGroup.clearLayers();
  clearMapLegend(document.getElementById('map'));

  const dest = centroids.get(partnerISO);
  if (!dest || !top?.length) return;

  const maxVal = Math.max(...top.map(d => d[1]), 1);
  const maxScaled = Math.sqrt(maxVal);
  const boundsPts = [[dest.lat, dest.lon]];

  L.circleMarker([dest.lat, dest.lon], { radius: 10, weight: 2, color: '#fff', fillColor: colors.target, fillOpacity: 0.95 })
    .bindTooltip(`<b>${dest.Country}</b>`, { permanent: true, direction: 'bottom', className: 'importer-tooltip' }).addTo(layerGroup);

  top.forEach(([iso3, val]) => {
    if (currentAnimationId !== thisId) return;
    const src = centroids.get(iso3);
    if (!src) return;
    boundsPts.push([src.lat, src.lon]);
    const t = Math.sqrt(val) / maxScaled;
    drawArc(src, dest, 1.5 + 5 * t, colors.primary).addTo(layerGroup);
    L.circleMarker([src.lat, src.lon], { radius: 5 + 12 * t, weight: 2, color: '#fff', fillColor: colors.primary, fillOpacity: 0.85 })
      .bindTooltip(`<b>${src.Country}</b><br>${formatNumber(val)} ${metric === "value_usd" ? "USD" : "MT"}`, { sticky: true }).addTo(layerGroup);
  });

  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = `
    <div class="legend-title">Flow Size</div>
    <div class="legend-items">
      <div class="legend-item"><svg width="22" height="22"><circle cx="11" cy="11" r="10" fill="${colors.primary}" fill-opacity="0.85" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal)}</span></div>
      <div class="legend-item"><svg width="22" height="22"><circle cx="11" cy="11" r="5" fill="${colors.primary}" fill-opacity="0.85" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal * 0.1)}</span></div>
    </div>
    <div class="legend-unit">${metric === "value_usd" ? "USD" : "MT"}</div>`;
  document.getElementById('map').appendChild(legend);

  map.flyToBounds(L.latLngBounds(boundsPts).pad(0.15), { duration: 0.8 });
}

function renderMapCompare(p1, p2, top1, top2, metric, label1, label2) {
  if (!mapCompareInitialized || !mapCompare) {
    console.log('Map compare not ready yet');
    return;
  }
  
  const theme = getTheme(), colors = COLORS[theme], cColors = COMPARE_COLORS[theme];
  const thisId = ++currentAnimationId;
  layerGroupCompare.clearLayers();
  clearMapLegend(document.getElementById('mapCompare'));

  const dest1 = centroids.get(p1), dest2 = centroids.get(p2);
  if (!dest1 && !dest2) return;

  const boundsPts = [];
  const allVals = [...(show1 ? top1.map(d => d[1]) : []), ...(show2 ? top2.map(d => d[1]) : [])];
  const maxVal = Math.max(...allVals, 1);
  const maxScaled = Math.sqrt(maxVal);

  if (show1 && dest1) {
    boundsPts.push([dest1.lat, dest1.lon]);
    L.circleMarker([dest1.lat, dest1.lon], { radius: 10, weight: 2, color: '#fff', fillColor: cColors.country1, fillOpacity: 0.95 })
      .bindTooltip(`<b>${label1}</b>`, { permanent: true, direction: 'bottom', className: 'importer-tooltip' }).addTo(layerGroupCompare);
    
    top1.forEach(([iso3, val]) => {
      if (currentAnimationId !== thisId) return;
      const src = centroids.get(iso3);
      if (!src) return;
      boundsPts.push([src.lat, src.lon]);
      const t = Math.sqrt(val) / maxScaled;
      drawArc(src, dest1, 1.5 + 4 * t, cColors.country1).addTo(layerGroupCompare);
      L.circleMarker([src.lat, src.lon], { radius: 5 + 10 * t, weight: 2, color: '#fff', fillColor: cColors.country1, fillOpacity: 0.85 })
        .bindTooltip(`<b>${src.Country}</b> → ${label1}<br>${formatNumber(val)}`, { sticky: true }).addTo(layerGroupCompare);
    });
  }

  if (show2 && dest2) {
    boundsPts.push([dest2.lat, dest2.lon]);
    L.circleMarker([dest2.lat, dest2.lon], { radius: 10, weight: 2, color: '#fff', fillColor: cColors.country2, fillOpacity: 0.95 })
      .bindTooltip(`<b>${label2}</b>`, { permanent: true, direction: 'bottom', className: 'importer-tooltip' }).addTo(layerGroupCompare);
    
    top2.forEach(([iso3, val]) => {
      if (currentAnimationId !== thisId) return;
      const src = centroids.get(iso3);
      if (!src) return;
      boundsPts.push([src.lat, src.lon]);
      const t = Math.sqrt(val) / maxScaled;
      drawArc(src, dest2, 1.5 + 4 * t, cColors.country2).addTo(layerGroupCompare);
      const existing = show1 && top1.find(d => d[0] === iso3);
      const offset = existing ? 0.5 : 0;
      L.circleMarker([src.lat + offset, src.lon + offset], { radius: 5 + 10 * t, weight: 2, color: '#fff', fillColor: cColors.country2, fillOpacity: 0.85 })
        .bindTooltip(`<b>${src.Country}</b> → ${label2}<br>${formatNumber(val)}`, { sticky: true }).addTo(layerGroupCompare);
    });
  }

  // Legend - bigger with 3 circle sizes
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = `
    <div class="legend-title">Importers</div>
    <div class="legend-items">
      ${show1 ? `<div class="legend-item"><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="${cColors.country1}" stroke="white" stroke-width="1.5"/></svg><span>${label1}</span></div>` : ''}
      ${show2 ? `<div class="legend-item"><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="${cColors.country2}" stroke="white" stroke-width="1.5"/></svg><span>${label2}</span></div>` : ''}
    </div>
    <div class="legend-title" style="margin-top:8px;">Flow Size</div>
    <div class="legend-items">
      <div class="legend-item"><svg width="32" height="32"><circle cx="16" cy="16" r="14" fill="${colors.primary}" fill-opacity="0.7" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal)}</span></div>
      <div class="legend-item"><svg width="24" height="24"><circle cx="12" cy="12" r="9" fill="${colors.primary}" fill-opacity="0.7" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal*0.5)}</span></div>
      <div class="legend-item"><svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="${colors.primary}" fill-opacity="0.7" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal*0.1)}</span></div>
    </div>
    <div class="legend-unit">${metric === "value_usd" ? "USD" : "MT"}</div>`;
  document.getElementById('mapCompare').appendChild(legend);

  if (boundsPts.length) {
    mapCompare.flyToBounds(L.latLngBounds(boundsPts).pad(0.2), { duration: 0.8 });
  }
}

function renderMapCompareOverlay(partnerISO, top1, top2, metric, label1, label2) {
  if (!mapCompareInitialized || !mapCompare) {
    console.log('Map compare not ready yet');
    return;
  }
  
  const theme = getTheme(), colors = COLORS[theme], cColors = COMPARE_COLORS[theme];
  const thisId = ++currentAnimationId;
  layerGroupCompare.clearLayers();
  clearMapLegend(document.getElementById('mapCompare'));

  const dest = centroids.get(partnerISO);
  if (!dest) return;

  const boundsPts = [[dest.lat, dest.lon]];
  const allVals = [...(show1 ? top1.map(d => d[1]) : []), ...(show2 ? top2.map(d => d[1]) : [])];
  const maxVal = Math.max(...allVals, 1);
  const maxScaled = Math.sqrt(maxVal);

  L.circleMarker([dest.lat, dest.lon], { radius: 10, weight: 2, color: '#fff', fillColor: colors.target, fillOpacity: 0.95 })
    .bindTooltip(`<b>${dest.Country}</b>`, { permanent: true, direction: 'bottom', className: 'importer-tooltip' }).addTo(layerGroupCompare);

  if (show1) {
    top1.forEach(([iso3, val]) => {
      if (currentAnimationId !== thisId) return;
      const src = centroids.get(iso3);
      if (!src) return;
      boundsPts.push([src.lat, src.lon]);
      const t = Math.sqrt(val) / maxScaled;
      drawArc(src, dest, 1.5 + 4 * t, cColors.country1).addTo(layerGroupCompare);
      L.circleMarker([src.lat - 0.3, src.lon - 0.3], { radius: 5 + 9 * t, weight: 2, color: '#fff', fillColor: cColors.country1, fillOpacity: 0.85 })
        .bindTooltip(`<b>${src.Country}</b> (${label1})<br>${formatNumber(val)}`, { sticky: true }).addTo(layerGroupCompare);
    });
  }

  if (show2) {
    top2.forEach(([iso3, val]) => {
      if (currentAnimationId !== thisId) return;
      const src = centroids.get(iso3);
      if (!src) return;
      boundsPts.push([src.lat, src.lon]);
      const t = Math.sqrt(val) / maxScaled;
      drawArc(src, dest, 1.5 + 4 * t, cColors.country2).addTo(layerGroupCompare);
      L.circleMarker([src.lat + 0.3, src.lon + 0.3], { radius: 5 + 9 * t, weight: 2, color: '#fff', fillColor: cColors.country2, fillOpacity: 0.85 })
        .bindTooltip(`<b>${src.Country}</b> (${label2})<br>${formatNumber(val)}`, { sticky: true }).addTo(layerGroupCompare);
    });
  }

  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = `
    <div class="legend-title">Compare</div>
    <div class="legend-items">
      ${show1 ? `<div class="legend-item"><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="${cColors.country1}" stroke="white" stroke-width="1.5"/></svg><span>${label1}</span></div>` : ''}
      ${show2 ? `<div class="legend-item"><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="${cColors.country2}" stroke="white" stroke-width="1.5"/></svg><span>${label2}</span></div>` : ''}
    </div>
    <div class="legend-title" style="margin-top:8px;">Flow Size</div>
    <div class="legend-items">
      <div class="legend-item"><svg width="32" height="32"><circle cx="16" cy="16" r="14" fill="${colors.primary}" fill-opacity="0.7" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal)}</span></div>
      <div class="legend-item"><svg width="24" height="24"><circle cx="12" cy="12" r="9" fill="${colors.primary}" fill-opacity="0.7" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal*0.5)}</span></div>
      <div class="legend-item"><svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="${colors.primary}" fill-opacity="0.7" stroke="white" stroke-width="1.5"/></svg><span>${formatNumber(maxVal*0.1)}</span></div>
    </div>
    <div class="legend-unit">${metric === "value_usd" ? "USD" : "MT"}</div>`;
  document.getElementById('mapCompare').appendChild(legend);

  mapCompare.flyToBounds(L.latLngBounds(boundsPts).pad(0.15), { duration: 0.8 });
}

// ============================================
// Setup & Main Render
// ============================================

function setupControls() {
  const card = document.querySelector('#singleGrid .card:has(#line)');
  if (!card || document.getElementById('totalToggle')) return;
  
  const header = card.querySelector('.card-header');
  const toggle = document.createElement('div');
  toggle.className = 'header-controls';
  toggle.id = 'lineControls';
  toggle.innerHTML = `
    <div class="toggle-item">
      <label class="toggle-switch"><input type="checkbox" id="totalToggle" checked><span class="toggle-slider"></span></label>
      <span>Total</span>
    </div>
    <div class="toggle-item">
      <label class="toggle-switch"><input type="checkbox" id="breakdownToggle"><span class="toggle-slider"></span></label>
      <span>Breakdown</span>
    </div>`;
  header.appendChild(toggle);
  
  const totalEl = document.getElementById('totalToggle');
  const breakdownEl = document.getElementById('breakdownToggle');

  function enforceToggles(changed) {
    if (changed === 'breakdown' && breakdownEl.checked) totalEl.checked = false;
    if (changed === 'total' && totalEl.checked) breakdownEl.checked = false;
    if (!totalEl.checked && !breakdownEl.checked) totalEl.checked = true;
    showTotal = totalEl.checked;
    showBreakdown = breakdownEl.checked;
  }

  totalEl.addEventListener('change', () => { enforceToggles('total'); rerender(); });
  breakdownEl.addEventListener('change', () => { enforceToggles('breakdown'); rerender(); });

  showTotal = totalEl.checked;
  showBreakdown = breakdownEl.checked;
}

function rerender() {
  const f = getFilters();
  const labels = getCompareLabels();
  const metricLabel = f.metric === "value_usd" ? "Value (USD)" : "Quantity (MT)";
  const topLabel = `Top ${f.topn}`;
  const cColors = COMPARE_COLORS[getTheme()];

  if (els.legend1Name) els.legend1Name.textContent = labels.label1;
  if (els.legend2Name) els.legend2Name.textContent = labels.label2;
  if (els.legend1Item) els.legend1Item.classList.toggle('disabled', !show1);
  if (els.legend2Item) els.legend2Item.classList.toggle('disabled', !show2);

  if (compareMode) {
    // COMPARE MODE - Two separate bar charts
    let filtered1, filtered2;
    
    if (compareType === 'countries') {
      filtered1 = applyFiltersCustom(f.partner, f.year, f.temp, false);
      filtered2 = applyFiltersCustom(f.partner2, f.year, f.temp, false);
    } else if (compareType === 'years') {
      filtered1 = applyFiltersCustom(f.partner, f.year, f.temp, false);
      filtered2 = applyFiltersCustom(f.partner, f.year2, f.temp, false);
    } else {
      filtered1 = applyFiltersCustom(f.partner, f.year, f.temp, false);
      filtered2 = applyFiltersCustom(f.partner, f.year, f.temp2, false);
    }

    const top1 = topNReporters(filtered1, f.metric, f.topn);
    const top2 = topNReporters(filtered2, f.metric, f.topn);

    // Titles
    document.getElementById("mapTitleCompare").textContent = `${topLabel} Sources — ${labels.label1} vs ${labels.label2}`;
    document.getElementById("barTitle1").innerHTML = `<span class="title-dot country-1-color"></span> ${topLabel} to ${labels.label1}`;
    document.getElementById("barTitle2").innerHTML = `<span class="title-dot country-2-color"></span> ${topLabel} to ${labels.label2}`;
    document.getElementById("lineTitleCompare").textContent = `Over Time — ${labels.label1} vs ${labels.label2}`;

    // Render two separate bar charts (each with its own true Top N!)
    if (show1) renderBarSeparate(top1, f.metric, 'bar1', cColors.country1, labels.label1);
    if (show2) renderBarSeparate(top2, f.metric, 'bar2', cColors.country2, labels.label2);

    // Line chart
    let filteredLine1, filteredLine2;
    if (compareType === 'countries') {
      filteredLine1 = applyFiltersCustom(f.partner, null, f.temp, true);
      filteredLine2 = applyFiltersCustom(f.partner2, null, f.temp, true);
    } else if (compareType === 'years') {
      filteredLine1 = applyFiltersCustom(f.partner, null, f.temp, true);
      filteredLine2 = filteredLine1;
    } else {
      filteredLine1 = applyFiltersCustom(f.partner, null, f.temp, true);
      filteredLine2 = applyFiltersCustom(f.partner, null, f.temp2, true);
    }
    renderLineCompare(filteredLine1, filteredLine2, f.metric, labels.label1, labels.label2);

    // Map
    if (compareType === 'countries') {
      renderMapCompare(f.partner, f.partner2, top1, top2, f.metric, labels.label1, labels.label2);
    } else {
      renderMapCompareOverlay(f.partner, top1, top2, f.metric, labels.label1, labels.label2);
    }

  } else {
    // SINGLE MODE
    const filtered = applyFiltersCustom(f.partner, f.year, f.temp, false);
    const top = topNReporters(filtered, f.metric, f.topn);
    const filteredLine = applyFiltersCustom(f.partner, null, f.temp, true);

    const importerName = centroids.get(f.partner)?.Country || f.partner || "Importer";
    document.getElementById("mapTitle").textContent = f.partner ? `${topLabel} Sources to ${importerName}` : `Top Sources`;
    document.getElementById("barTitle").textContent = f.partner ? `${topLabel} Exporters to ${importerName}` : `${topLabel} Exporters`;
    document.getElementById("lineTitle").textContent = f.partner ? `Imports to ${importerName}` : `Over Time`;

    renderBarSingle(top, f.metric);
    setupControls();
    renderLineSingle(filteredLine, f.metric, f.topn);

    if (f.partner) {
      renderMapSingle(f.partner, top, f.metric);
    } else {
      layerGroup.clearLayers();
      clearMapLegend(document.getElementById('map'));
      map.setView([25, 20], 2);
    }
  }

  updateUSACards();
}

// ============================================
// Init
// ============================================

async function main() {
  initTheme();
  initMap();
  setupLegendToggle();

  try {
    const centroidData = await loadCSV(CENTROIDS_URL);
    centroidData.forEach(r => {
      const iso = String(r.ReporterISO3 || '').trim();
      const lat = parseNum(r.y_lat), lon = parseNum(r.x_lon);
      if (iso && isFinite(lat) && isFinite(lon)) centroids.set(iso, { lat, lon, Country: r.Country });
    });

    flows = await loadCSV(FLOWS_URL);
    flows.forEach(r => { r.value_usd = parseNum(r.value_usd); r.quantity_mt = parseNum(r.quantity_mt); });

    const partners = uniq(flows.map(r => r.PartnerISO3)).sort();
    const years = uniq(flows.map(r => String(r.Year))).sort((a, b) => b - a);
    const temps = uniq(flows.map(r => r.Temperature)).sort();

    els.partner.innerHTML = '';
    els.partner2.innerHTML = '';
    partners.forEach(iso => {
      const c = centroids.get(iso);
      const text = c ? `${c.Country} (${iso})` : iso;
      els.partner.innerHTML += `<option value="${iso}">${text}</option>`;
      els.partner2.innerHTML += `<option value="${iso}">${text}</option>`;
    });
    if (partners.length) {
      els.partner.value = partners[0];
      els.partner2.value = partners[1] || partners[0];
    }

    fillSelect(els.year, years);
    fillSelect(els.year2, years);
    fillSelect(els.temp, temps);
    fillSelect(els.temp2, temps);
    fillSelect(els.product, uniq(flows.map(r => r["Value chains"])).sort());

    [els.partner, els.partner2, els.year, els.year2, els.temp, els.temp2, els.topn, els.product, els.metric].forEach(el => {
      el.addEventListener("change", rerender);
    });

    els.compareMode.addEventListener("change", toggleCompareMode);
    els.compareType.addEventListener("change", updateCompareType);

    els.reset.addEventListener("click", () => {
      els.partner.value = partners[0] || "";
      els.partner2.value = partners[1] || partners[0] || "";
      els.year.value = ""; els.year2.value = "";
      els.temp.value = ""; els.temp2.value = "";
      els.product.value = "";
      els.topn.value = "10";
      els.metric.value = "value_usd";
      compareMode = false;
      els.compareMode.checked = false;
      els.compareTypeWrapper.classList.add('hidden');
      els.compareLegend.classList.add('hidden');
      els.singleGrid.classList.remove('hidden');
      els.compareGrid.classList.add('hidden');
      hideAllCompareFields();
      showTotal = true; showBreakdown = false;
      show1 = true; show2 = true;
      const t = document.getElementById('totalToggle'); if (t) t.checked = true;
      const b = document.getElementById('breakdownToggle'); if (b) b.checked = false;
      if (els.legend1Item) els.legend1Item.classList.remove('disabled');
      if (els.legend2Item) els.legend2Item.classList.remove('disabled');
      setTimeout(() => map.invalidateSize(), 100);
      rerender();
    });

    els.themeToggle.addEventListener("click", toggleTheme);
    rerender();
  } catch (err) {
    console.error(err);
    alert("Failed to load data. Please use a local server.\n\n" + err);
  }
}

main();
