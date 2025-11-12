/************ CONFIG ************/
const MAPBOX_TOKEN  = 'pk.eyJ1IjoiYm9ic29uaXRlIiwiYSI6ImNtOXpyeWc1aDFlY24ya3M3dm55a2oyNDcifQ.8H2wkga07prlTm_YpOQicA';
const SUPABASE_URL  = 'https://fobibwavppcxfqpshrfp.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYmlid2F2cHBjeGZxcHNocmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDM2NTMsImV4cCI6MjA2OTE3OTY1M30.8QhebFQ8i0A5nUmz_g4cQ0ncbTgncsT6ZWNlRGZyLSM';
const PEER_ABLY_KEY = '9hDZwQ.LMHMDw:rHPAP8YjEeVfa5-SYle5UBnVtGpIFpck8fO4YH42Gp0';
const LANDBOT_CONFIG_URL = 'https://storage.googleapis.com/landbot.pro/v3/H-3134109-L1UF7O5PAQOKJEPB/index.json';

const STYLES = {
  streets:   'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12' // available via flag, not UI
};
const USE_SATELLITE = false; // flip to true for satellite hybrid

/************ Session + bot ************/
const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const params = new URLSearchParams(location.search);
const sessionId = params.get('session_id') || newId();
document.getElementById('sid').textContent = sessionId;

new window.Landbot.Container({
  container: '#botPane',
  configUrl: LANDBOT_CONFIG_URL,
  variables: { session_id: sessionId }
});

/************ Map ************/
mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
  container: 'map',
  style: USE_SATELLITE ? STYLES.satellite : STYLES.streets,
  center: [-0.1276, 51.5072],
  zoom: 9
});

/************ Supabase + Ably ************/
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ably     = new Ably.Realtime(PEER_ABLY_KEY);
const propsCh  = ably.channels.get('props');

/************ State + helpers ************/
const listPane      = document.getElementById('listPane');
const cardsMount    = document.getElementById('cardsMount');
const countBadge    = document.getElementById('countBadge');
const amenityFiltersEl = document.getElementById('amenityFilters');

const markersProp  = new Map(); // propID -> Marker
const markersPOI   = new Map(); // UID   -> Marker

let baseProps      = []; // raw from DB (with coords)
let currentProps   = []; // filtered + decorated
let amenityIndex   = new Map(); // pid -> { amen[], serv[] }
let galleryIndex   = new Map(); // pid -> [{url, order}]
let currentRingsGeo = null;
let hideRingsTimer  = null;

const filters = {
  mustAmenities: new Set(), // labels (case-insensitive compare)
};

const escapeHtml = (s='') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const emojiForType = (t='') => {
  const x = String(t).toLowerCase();
  if (x.includes('cafe') || x.includes('coffee')) return '☕';
  if (x.includes('bar')  || x.includes('pub'))    return '🍺';
  if (x.includes('restaurant') || x.includes('food')) return '🍽️';
  if (x.includes('supermarket') || x.includes('grocery')) return '🛒';
  if (x.includes('gym')) return '💪';
  if (x.includes('park')) return '🌳';
  return '📍';
};

function emojiForAmenityOrService(label=''){
  const s = String(label).toLowerCase();
  if (/\b(cctv|security|secure|key fob|keycard|access control)\b/.test(s)) return '🛡️';
  if (/\b(24.?hour|24\/7|reception|on.?site team|maintenance)\b/.test(s)) return '👥';
  if (/\b(wifi|wi[- ]?fi|internet|broadband|high[- ]?speed)\b/.test(s))    return '📶';
  if (/\b(utility|utilities|bills|electricity|gas|water)\b/.test(s))       return '💡';
  if (/\b(laundry|washer|dryer)\b/.test(s))                                 return '🧺';
  if (/\b(bike|cycle|bicycle)\b/.test(s))                                   return '🚲';
  if (/\b(parking|car|garage|charge)\b/.test(s))                            return '🅿️';
  if (/\b(gym|fitness|yoga|wellness)\b/.test(s))                             return '💪';
  if (/\b(cinema|movie|tv lounge|karaoke|games?)\b/.test(s))                return '🎬';
  if (/\b(study|desk|library|booth|hub)\b/.test(s))                          return '📚';
  if (/\b(roof|terrace|sky lounge|garden|courtyard|outdoor)\b/.test(s))     return '🌿';
  if (/\b(accessible|wheelchair|access ramp|lift|elevator)\b/.test(s))      return '♿';
  if (/\b(air.?con(ditioning)?|ac)\b/.test(s))                               return '❄️';
  if (/\b(dining|kitchen|hosting)\b/.test(s))                                return '🍽️';
  if (/\b(insurance|howden)\b/.test(s))                                      return '🧾';
  return '🏷️';
}

const makePin = (cls, text) => {
  const el = document.createElement('div');
  el.className = `pin ${cls}`;
  el.textContent = text;
  return el;
};

const _geoCache = new Map();
async function geocodeAddress(q){
  if (!q) return null;
  const key = q.trim().toLowerCase();
  if (_geoCache.has(key)) return _geoCache.get(key);
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('limit','1');
  try {
    const r = await fetch(url); const j = await r.json(); const f = j.features?.[0];
    if (f?.center?.length===2){ const val = { lon:f.center[0], lat:f.center[1] }; _geoCache.set(key, val); return val; }
  } catch(e){ console.error('geocode fail', e); }
  return null;
}

function metersBetween(a,b){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const la1=toRad(a.lat), la2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function clearAllMarkers(){
  for (const m of markersProp.values()) m.remove(); markersProp.clear();
  for (const m of markersPOI.values())  m.remove();  markersPOI.clear();
  removeRings();
}

function fitToAllMarkers(pad=64){
  const all = [...markersProp.values(), ...markersPOI.values()];
  const coords = all.map(m => m.getLngLat());
  if (!coords.length) return;
  if (coords.length === 1){ map.flyTo({ center: coords[0], zoom: 13.5, duration: 700 }); return; }
  const b = new mapboxgl.LngLatBounds(coords[0], coords[0]); coords.forEach(c => b.extend(c));
  map.fitBounds(b, { padding: pad, duration: 800, maxZoom: 14 });
}

/************ Data fetchers ************/
async function fetchPropsByIds(propIDs){
  if (!Array.isArray(propIDs) || !propIDs.length) return [];
  const { data, error } = await supabase
    .from('test_prop')
    .select('propID, property, city, adress, Long, Lat, link, owner, property_description')
    .in('propID', propIDs.map(String));
  if (error) { console.error('[supabase] test_prop error', error); return []; }

  const out = [];
  for (const r of data){
    let lat = r.Lat ?? null, lon = r.Long ?? null;
    if (lat==null || lon==null){
      const g = await geocodeAddress(r.adress || `${r.property||''}, ${r.city||''}, UK`);
      if (g){ lat=g.lat; lon=g.lon; }
    }
    if (lat==null || lon==null) continue;
    out.push({ ...r, lat, lon });
  }
  return out;
}

async function fetchAllProps(){
  const { data, error } = await supabase
    .from('test_prop')
    .select('propID, property, city, adress, Long, Lat, link, owner, property_description')
    .limit(500);
  if (error) { console.error('[supabase] fetchAllProps error', error); return []; }

  const out = [];
  for (const r of data){
    let lat = r.Lat ?? null, lon = r.Long ?? null;
    if (lat==null || lon==null){
      const g = await geocodeAddress(r.adress || `${r.property||''}, ${r.city||''}, UK`);
      if (g){ lat=g.lat; lon=g.lon; }
    }
    if (lat==null || lon==null) continue;
    out.push({ ...r, lat, lon });
  }
  return out;
}

async function fetchPOIsForProps(propIDs, { types=['cafe','bar','restaurant','gym','park'], perTypeLimit=8, radiusMeters=800 } = {}, centersByProp = new Map()){
  if (!propIDs?.length) return { list:[], counts:new Map() };

  const { data, error } = await supabase
    .from('Places_final')
    .select('UID, name, Address, type_single, propID')
    .in('propID', propIDs.map(String))
    .limit(2000);
  if (error) { console.error('[supabase] Places_final error', error); return { list:[], counts:new Map() }; }

  const want = new Set(types.map(t => String(t).toLowerCase()));
  const perType = new Map();
  const counts = new Map();
  const list = [];

  for (const r of data){
    const t = String(r.type_single||'').toLowerCase();
    if (types.length && !want.has(t)) continue;

    const g = await geocodeAddress(r.Address);
    if (!g) continue;

    const center = centersByProp.get(String(r.propID));
    const d = center ? metersBetween(center, g) : null;
    if (center && d!=null && d > radiusMeters) continue;

    const pid = String(r.propID);
    if (!counts.has(pid)) counts.set(pid, { cafe:0, bar:0, restaurant:0, gym:0, park:0 });
    const bucket = counts.get(pid);
    if (t.includes('cafe') || t.includes('coffee')) bucket.cafe++;
    else if (t.includes('bar') || t.includes('pub')) bucket.bar++;
    else if (t.includes('restaurant') || t.includes('food')) bucket.restaurant++;
    else if (t.includes('gym')) bucket.gym++;
    else if (t.includes('park')) bucket.park++;

    const used = perType.get(t) || 0;
    if (used < perTypeLimit){
      list.push({ id:r.UID, name:r.name, address:r.Address, type:r.type_single, propID:r.propID, lat:g.lat, lon:g.lon, _distance_m:d!=null?Math.round(d):null });
      perType.set(t, used+1);
    }
  }
  list.sort((a,b)=> (a._distance_m??1e12) - (b._distance_m??1e12));
  return { list, counts };
}

// amenities + services
async function fetchAmenAndServices(propIDs){
  const ids = (propIDs||[]).map(String);
  const byProp = new Map(ids.map(id => [id, { amen:[], serv:[] }]));

  // amenities
  {
    const { data, error } = await supabase
      .from('amenities')
      .select('property_id, propid, Amenity')
      .in('property_id', ids)
      .limit(5000);
    const rows = (!error && data?.length) ? data : (await supabase
      .from('amenities').select('propid, Amenity').in('propid', ids).limit(5000)).data || [];
    for (const r of rows){
      const pid = String(r.property_id ?? r.propid ?? '');
      const label = String(r.Amenity || '').trim();
      if (byProp.has(pid) && label) byProp.get(pid).amen.push(label);
    }
  }
  // services
  {
    const { data, error } = await supabase
      .from('services')
      .select('property_id, propid, service')
      .in('property_id', ids)
      .limit(5000);
    const rows = (!error && data?.length) ? data : (await supabase
      .from('services').select('propid, service').in('propid', ids).limit(5000)).data || [];
    for (const r of rows){
      const pid = String(r.property_id ?? r.propid ?? '');
      const label = String(r.service || '').trim();
      if (byProp.has(pid) && label) byProp.get(pid).serv.push(label);
    }
  }

  // Dedup per property (by label), map to icon
  const result = new Map();
  for (const [pid, {amen, serv}] of byProp.entries()){
    const uniq = (arr)=> [...new Map(arr.map(s => [s.toLowerCase(), s])).values()];
    const amenList = uniq(amen).slice(0, 48).map(label => ({ icon:emojiForAmenityOrService(label), label }));
    const servList = uniq(serv).slice(0, 48).map(label => ({ icon:emojiForAmenityOrService(label), label }));
    result.set(pid, { amen: amenList, serv: servList });
  }
  return result;
}

// gallery
async function fetchGallery(propIDs){
  if (!propIDs?.length) return new Map();
  const { data, error } = await supabase
    .from('gallery')
    .select('propid, image_url, image_order')
    .in('propid', propIDs.map(String))
    .limit(10000);
  if (error){ console.error('[supabase] gallery error', error); return new Map(); }
  const by = new Map();
  for (const r of data){
    const pid = String(r.propid);
    if (!by.has(pid)) by.set(pid, []);
    by.get(pid).push({ url:r.image_url, order: Number(r.image_order ?? 0) });
  }
  for (const [pid, arr] of by.entries()){
    arr.sort((a,b)=> a.order - b.order);
  }
  return by;
}

/************ Proximity rings ************/
function destPoint(lon,lat,distMeters,bearingDeg){
  const R=6371000, br=bearingDeg*Math.PI/180, φ1=lat*Math.PI/180, λ1=lon*Math.PI/180, d=distMeters/R;
  const φ2=Math.asin(Math.sin(φ1)*Math.cos(d)+Math.cos(φ1)*Math.sin(d)*Math.cos(br));
  const λ2=λ1+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(φ1),Math.cos(d)-Math.sin(φ1)*Math.sin(φ2));
  return [λ2*180/Math.PI, φ2*180/Math.PI];
}
function circlePolygon(lon, lat, radiusMeters, points=64){
  const coords = [];
  for (let i=0;i<=points;i++){
    const br = (i/points)*360;
    coords.push(destPoint(lon,lat,radiusMeters,br));
  }
  return { type:'Polygon', coordinates:[coords] };
}
function minsForRadius(r){ return Math.round(r/80); }
function ringsGeo(lon,lat){
  const radii=[500,1000,2000];
  const features=[];
  for (const r of radii){
    features.push({ type:'Feature', properties:{ kind:'ring', id:r }, geometry: circlePolygon(lon,lat,r) });
    const [lx,ly] = destPoint(lon,lat,r,95);
    const mins = minsForRadius(r);
    features.push({ type:'Feature', properties:{ kind:'label', id:r, text:`≈${mins} min walk` }, geometry:{ type:'Point', coordinates:[lx,ly] } });
  }
  return { type:'FeatureCollection', features };
}
function addRingLayers(geo){
  const SRC='rings-src', FILL='rings-fill', LINE='rings-line', LBL='rings-lbl';
  if (map.getLayer(LBL)) map.removeLayer(LBL);
  if (map.getLayer(LINE)) map.removeLayer(LINE);
  if (map.getLayer(FILL)) map.removeLayer(FILL);
  if (map.getSource(SRC)) map.removeSource(SRC);

  map.addSource(SRC, { type:'geojson', data: geo });

  map.addLayer({ id:FILL, type:'fill', source:SRC, filter:['==',['get','kind'],'ring'], paint:{
    'fill-color': ['match',['get','id'],
      500, getComputedStyle(document.documentElement).getPropertyValue('--ring-500').trim(),
      1000, getComputedStyle(document.documentElement).getPropertyValue('--ring-1000').trim(),
      2000, getComputedStyle(document.documentElement).getPropertyValue('--ring-2000').trim(),
      'rgba(37,99,235,0.08)'
    ],
    'fill-opacity': 1
  }});
  map.addLayer({ id:LINE, type:'line', source:SRC, filter:['==',['get','kind'],'ring'], paint:{
    'line-color': getComputedStyle(document.documentElement).getPropertyValue('--ring-stroke').trim(),
    'line-width': 1.2
  }});
  map.addLayer({ id:LBL, type:'symbol', source:SRC, filter:['==',['get','kind'],'label'], layout:{
    'text-field': ['get','text'],
    'text-font': ['Inter Medium','Open Sans Semibold','Arial Unicode MS Bold'],
    'text-size': 12,
    'text-offset': [0,0]
  }, paint:{
    'text-color': getComputedStyle(document.documentElement).getPropertyValue('--ring-label').trim(),
    'text-halo-color': getComputedStyle(document.documentElement).getPropertyValue('--ring-halo').trim(),
    'text-halo-width': 1.2
  }});
}
function removeRings(){
  const SRC='rings-src', FILL='rings-fill', LINE='rings-line', LBL='rings-lbl';
  if (map.getLayer(LBL))  map.removeLayer(LBL);
  if (map.getLayer(LINE)) map.removeLayer(LINE);
  if (map.getLayer(FILL)) map.removeLayer(FILL);
  if (map.getSource(SRC)) map.removeSource(SRC);
  currentRingsGeo = null;
}
function showRingsAt({lon,lat}){
  clearTimeout(hideRingsTimer);
  const geo = ringsGeo(lon,lat);
  currentRingsGeo = geo;
  addRingLayers(geo);
}
function scheduleHideRings(){
  clearTimeout(hideRingsTimer);
  hideRingsTimer = setTimeout(removeRings, 180);
}

/************ UI helpers ************/
function setCount(n){
  countBadge.textContent = `${n} ${n===1?'property':'properties'} in view`;
}

/* Legend (kept) */
function renderLegend(){
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <span><span class="dot poi"></span> POIs</span>
    <span><span class="dot amen"></span> Amenities</span>
    <span><span class="dot serv"></span> Services</span>`;
  cardsMount.prepend(legend);
}

/* Amenity/Service chips with tooltips */
function makeAmenityServiceRow({ amen=[], serv=[] } = {}, maxTotal=10){
  const items = [...amen.map(x => ({...x, _t:'amen'})), ...serv.map(x => ({...x, _t:'serv'}))].slice(0, maxTotal);
  if (!items.length) return '';
  const html = items.map(({icon,label,_t}) =>
    `<span class="chip chip--${_t}" data-tip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon}</span>`
  ).join('');
  return `<div class="chips">${html}</div>`;
}
function wireTooltips(){
  const chips = document.querySelectorAll('.chip[data-tip]');
  chips.forEach(ch => {
    ch.addEventListener('mouseenter', (e)=> showTip(ch.getAttribute('data-tip')||'', e.clientX, e.clientY));
    ch.addEventListener('mousemove', (e)=> showTip(ch.getAttribute('data-tip')||'', e.clientX, e.clientY));
    ch.addEventListener('mouseleave', hideTip);
    ch.addEventListener('click', (e)=> {
      e.stopPropagation();
      const r = ch.getBoundingClientRect();
      showTip(ch.getAttribute('data-tip')||'', r.right, r.top);
      const once = () => { hideTip(); document.removeEventListener('click', once, true); };
      document.addEventListener('click', once, true);
    });
  });
}
let ttEl = null;
function ensureTooltip(){
  if (!ttEl){
    ttEl = document.createElement('div');
    ttEl.className = 'tt';
    ttEl.style.display = 'none';
    document.body.appendChild(ttEl);
  }
  return ttEl;
}
function showTip(text, x, y){
  const el = ensureTooltip();
  el.textContent = text;
  el.style.left = `${Math.min(window.innerWidth-220, x+10)}px`;
  el.style.top  = `${Math.max(8, y+10)}px`;
  el.style.display = 'block';
}
function hideTip(){
  if (ttEl) ttEl.style.display = 'none';
}

/************ Gallery helpers ************/
function galleryHtml(pid){
  const imgs = galleryIndex.get(String(pid)) || [];
  if (!imgs.length) return '';
  const inner = imgs.slice(0,6).map(x => `<img src="${x.url}" alt="">`).join('');
  return `<div class="gallery">${inner}</div>`;
}
function firstImage(pid){
  const arr = galleryIndex.get(String(pid)) || [];
  return arr.length ? arr[0].url : null;
}

/************ Draw ************/
function drawProperty(p){
  const id = String(p.propID);
  const el = makePin('pin--prop','🏠');
  const marker = markersProp.get(id) ?? new mapboxgl.Marker({ element: el, anchor:'bottom' });

  const chipsPOI = p._amenityCounts ? makeChipRow(p._amenityCounts) : '';
  const chipsAS  = p._amenServ ? makeAmenityServiceRow(p._amenServ) : '';

  const img = firstImage(id);
  const imgHtml = img ? `<img src="${img}" alt="" style="width:100%;height:auto;border-radius:10px;margin-bottom:6px;border:1px solid var(--card-border);" />` : '';

  const html = `
    <div style="font-size:13px; line-height:1.35; max-width:320px">
      ${imgHtml}
      <div style="font-weight:700">${escapeHtml(p.property||'')}</div>
      <div class="meta">${escapeHtml(p.city||'')}${p.owner ? ' · '+escapeHtml(p.owner) : ''}</div>
      ${p.adress ? `<div class="addr">${escapeHtml(p.adress)}</div>` : ''}
      ${chipsPOI}${chipsAS}
      ${p.link ? `<div class="link"><a href="${p.link}" target="_blank" rel="noopener">Open page →</a></div>` : ''}
    </div>`;

  marker
    .setLngLat([p.lon, p.lat])
    .setPopup(new mapboxgl.Popup({ offset:8, maxWidth:'340px' }).setHTML(html))
    .addTo(map);

  markersProp.set(id, marker);

  // Rings ONLY on map marker hover
  el.addEventListener('mouseenter', ()=> { toggleCardHot(id, true);  showRingsAt({lon:p.lon, lat:p.lat}); });
  el.addEventListener('mouseleave', ()=> { toggleCardHot(id, false); scheduleHideRings(); });
}

function drawPOI(r){
  const id = String(r.id);
  if (markersPOI.has(id)) return;
  const el = makePin('pin--poi', emojiForType(r.type));
  const m = new mapboxgl.Marker({ element: el, anchor:'bottom' })
    .setLngLat([r.lon, r.lat])
    .setPopup(new mapboxgl.Popup({ offset:8 }).setHTML(`
      <div style="font-size:13px; line-height:1.35">
        <div style="font-weight:700">${escapeHtml(r.name||'')}</div>
        <div class="meta">${escapeHtml(r.type||'')}</div>
        ${r.address ? `<div class="addr">${escapeHtml(r.address)}</div>` : ''}
      </div>`))
    .addTo(map);
  markersPOI.set(id, m);
}

/* POI chips (counts) */
function makeChipRow(a){
  const bits = [];
  if (a.cafe)       bits.push(`<span class="chip chip--poi" aria-label="Nearby cafés">☕ <b>${a.cafe}</b></span>`);
  if (a.bar)        bits.push(`<span class="chip chip--poi" aria-label="Nearby bars">🍺 <b>${a.bar}</b></span>`);
  if (a.restaurant) bits.push(`<span class="chip chip--poi" aria-label="Nearby restaurants">🍽️ <b>${a.restaurant}</b></span>`);
  if (a.gym)        bits.push(`<span class="chip chip--poi" aria-label="Nearby gyms">💪 <b>${a.gym}</b></span>`);
  if (a.park)       bits.push(`<span class="chip chip--poi" aria-label="Nearby parks">🌳 <b>${a.park}</b></span>`);
  return bits.length ? `<div class="chips">${bits.join('')}</div>` : '';
}

/************ Right-panel list ************/
function renderList(props){
  currentProps = props;
  setCount(props.length);

  if (!props.length){
    cardsMount.innerHTML = `<div class="empty">No properties to display yet.<br/>Ask the bot for an area or a university 🙂</div>`;
    return;
  }

  cardsMount.innerHTML = props.map(p => `
    <article class="card" data-id="${p.propID}">
      <h3>${escapeHtml(p.property||'')}</h3>
      <div class="meta">${escapeHtml(p.city||'')}${p.owner ? ' · ' + escapeHtml(p.owner) : ''}</div>
      ${p.adress ? `<div class="addr">${escapeHtml(p.adress)}</div>` : ''}
      ${galleryHtml(p.propID)}
      ${p.property_description ? `<div class="desc">${escapeHtml(p.property_description)}</div>` : ''}
      ${p._amenityCounts ? makeChipRow(p._amenityCounts) : ''}
      ${p._amenServ ? makeAmenityServiceRow(p._amenServ) : ''}
      ${p.link ? `<div class="link"><a href="${p.link}" target="_blank" rel="noopener">Open page →</a></div>` : ''}
    </article>
  `).join('');

  // legend on top (but below filter bar)
  renderLegend();

  // Card interactions — highlight only (no rings here)
  cardsMount.querySelectorAll('.card').forEach(card => {
    const id = card.getAttribute('data-id');
    const row = () => currentProps.find(r => String(r.propID)===String(id));
    card.addEventListener('mouseenter', ()=> {
      toggleMarkerHot(id, true);
    });
    card.addEventListener('mouseleave', ()=> {
      toggleMarkerHot(id, false);
    });
    card.addEventListener('click', ()=> {
      const r = row(); const m = markersProp.get(String(id));
      if (!m || !r) return;
      map.flyTo({ center:[r.lon,r.lat], zoom:14, duration:600 });
      setTimeout(()=> m.togglePopup(), 650);
    });
  });

  wireTooltips();
}

function toggleMarkerHot(id, on){
  const m = markersProp.get(String(id));
  if (!m) return;
  m.getElement().classList.toggle('is-hot', !!on);
}
function toggleCardHot(id, on){
  const card = cardsMount.querySelector(`.card[data-id="${CSS.escape(String(id))}"]`);
  if (!card) return;
  card.classList.toggle('is-active', !!on);
}

/************ Filters ************/
function buildAmenityUniverse(){
  const all = new Map(); // labelLower -> DisplayLabel
  for (const [pid, as] of amenityIndex.entries()){
    for (const item of [...(as.amen||[]), ...(as.serv||[])]){
      const low = String(item.label).toLowerCase();
      if (!all.has(low)) all.set(low, item.label);
    }
  }
  // choose top ~12 common ones for MVP
  const counts = {};
  for (const [pid, as] of amenityIndex.entries()){
    const seen = new Set();
    for (const item of [...(as.amen||[]), ...(as.serv||[])]){
      const low = String(item.label).toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      counts[low] = (counts[low]||0)+1;
    }
  }
  return [...all.entries()]
    .sort((a,b)=> (counts[b[0]]||0)-(counts[a[0]]||0))
    .slice(0, 12) // keep concise
    .map(([low, disp]) => ({ low, disp }));
}

function renderAmenityFilters(){
  const opts = buildAmenityUniverse();
  amenityFiltersEl.innerHTML = opts.map(({low, disp}) => `
    <button class="filter-chip" data-key="${low}">${escapeHtml(disp)}</button>
  `).join('');
  amenityFiltersEl.querySelectorAll('.filter-chip').forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (filters.mustAmenities.has(key)) btn.classList.add('is-on');
    btn.addEventListener('click', ()=>{
      if (filters.mustAmenities.has(key)) filters.mustAmenities.delete(key);
      else filters.mustAmenities.add(key);
      btn.classList.toggle('is-on');
      applyFilters();
    });
  });
}

function applyFilters(){
  // Start from baseProps (already decorated)
  let out = baseProps.map(p => ({
    ...p,
    _amenServ: amenityIndex.get(String(p.propID)) || {amen:[], serv:[]}
  }));

  // must-include amenities
  if (filters.mustAmenities.size){
    const keys = [...filters.mustAmenities];
    out = out.filter(p => {
      const have = new Set([...(p._amenServ.amen||[]), ...(p._amenServ.serv||[])]
        .map(it => String(it.label).toLowerCase()));
      return keys.every(k => have.has(k));
    });
  }

  // re-render markers & list
  clearAllMarkers();
  // POI counts not recomputed here for speed; optional later
  out.forEach(drawProperty);
  renderList(out);
  fitToAllMarkers();
}

/************ Ably subscription ************/
function parsePropIDs(raw){
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  if (typeof raw === 'string'){
    const s = raw.trim();
    if (s.startsWith('[')) { try { return JSON.parse(s).map(String); } catch{} }
    return s.split(',').map(x => x.trim()).filter(Boolean);
  }
  return [];
}

propsCh.subscribe(async (msg) => {
  const ids = parsePropIDs(msg?.data?.propIDs);
  if (!ids.length) return;

  clearAllMarkers();

  const props = await fetchPropsByIds(ids);
  const centers = new Map(props.map(p => [String(p.propID), { lat:p.lat, lon:p.lon }]));

  const { list: pois, counts } = await fetchPOIsForProps(ids, { types:['cafe','bar','restaurant','gym','park'], perTypeLimit:8, radiusMeters:800 }, centers);
  const amenServ = await fetchAmenAndServices(ids);
  const gallery  = await fetchGallery(ids);

  amenityIndex = amenServ;
  galleryIndex = gallery;

  baseProps = props.map(p => {
    const pid = String(p.propID);
    return {
      ...p,
      _amenityCounts: counts.get(pid) || null
    };
  });

  // initial render (no filters applied yet)
  renderAmenityFilters();
  applyFilters(); // will draw markers + list
  pois.forEach(drawPOI);
});

/************ Initial load ************/
async function bootstrap(){
  const props = await fetchAllProps();
  if (!props.length) {
    cardsMount.innerHTML = `<div class="empty">No properties to display yet.<br/>Ask the bot for an area or a university 🙂</div>`;
    return;
  }

  const centers = new Map(props.map(p => [String(p.propID), { lat:p.lat, lon:p.lon }]));
  const ids = props.map(p => String(p.propID));
  const { counts } = await fetchPOIsForProps(ids, { types:['cafe','bar','restaurant','gym','park'], perTypeLimit:0, radiusMeters:800 }, centers);
  const amenServ = await fetchAmenAndServices(ids);
  const gallery  = await fetchGallery(ids);

  amenityIndex = amenServ;
  galleryIndex = gallery;

  baseProps = props.map(p => {
    const pid = String(p.propID);
    return { ...p, _amenityCounts: counts.get(pid) || null };
  });

  renderAmenityFilters();
  applyFilters();
}
map.once('load', bootstrap);