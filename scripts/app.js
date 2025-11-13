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
const listPane         = document.getElementById('listPane');
const cardsMount       = document.getElementById('cardsMount');
const countBadge       = document.getElementById('countBadge');
const amenityFiltersEl = document.getElementById('amenityFilters');
/* Filters + Saved drawer DOM refs (for collapse/reset/saved) */
const filtersBar    = document.getElementById('filtersBar');
const filtersBody   = document.getElementById('filtersBody');
const filtersToggle = document.getElementById('filtersToggle');
const filtersReset  = document.getElementById('filtersReset');
const savedToggle   = document.getElementById('savedToggle');
const savedCountEl  = document.getElementById('savedCount');
const savedPanel    = document.getElementById('savedPanel');
const placesToggle  = document.getElementById('placesToggle');

/* Filters collapse */
filtersToggle?.addEventListener('click', ()=>{
  const isCollapsed = filtersBar.classList.toggle('collapsed');
  const expanded = !isCollapsed;
  filtersToggle.textContent = expanded ? 'Hide' : 'Show';
  filtersToggle.setAttribute('aria-expanded', String(expanded));
});

/* Reset filters */
function resetFilters(){
  filters.mustAmenities.clear();
  renderAmenityFilters();
  applyFilters();
}
filtersReset?.addEventListener('click', resetFilters);

/* Saved state */
const savedIds = new Set();
function updateSavedCount(){ savedCountEl.textContent = String(savedIds.size); }
function renderSavedPanel(){
  if (!savedPanel) return;
  if (!savedIds.size){
    savedPanel.innerHTML = '<h4>Saved properties</h4><div class="meta">Nothing saved yet.</div>';
    return;
  }
  const rows = currentProps
    .filter(p => savedIds.has(String(p.propID)))
    .map(p => `
      <div class="saved-item">
        <a href="${p.link || '#'}" target="_blank" rel="noopener">${escapeHtml(p.property || 'Property')}</a>
        <button class="rm" data-id="${p.propID}" aria-label="Remove">✕</button>
      </div>
    `).join('');
  savedPanel.innerHTML = `<h4>Saved properties</h4>${rows}`;
  savedPanel.querySelectorAll('.rm').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = String(btn.getAttribute('data-id'));
      savedIds.delete(id);
      updateSavedCount();
      renderSavedPanel();
      // also update buttons in cards if visible
      document.querySelectorAll('.save-btn[data-id="'+CSS.escape(id)+'"]').forEach(b=>b.classList.remove('is-on'));
    });
  });
}
savedToggle?.addEventListener('click', ()=>{
  if (!savedPanel) return;
  const nowHidden = savedPanel.hasAttribute('hidden') ? false : true; // toggle
  if (nowHidden) savedPanel.setAttribute('hidden','');
  else savedPanel.removeAttribute('hidden');
  renderSavedPanel();
});

/* Places toggle */
placesToggle?.addEventListener('click', ()=>{
  showPlaces = !showPlaces;
  placesToggle.setAttribute('aria-pressed', String(showPlaces));
  syncPOIMarkers();
});

/* Universities are now always shown when data is available — no toggle needed. */

/* Mobile sheet toggles */
const botPane       = document.getElementById('botPane');
const toggleChatBtn = document.getElementById('toggleChat');
const toggleListBtn = document.getElementById('toggleList');
const isMobileLike  = () => window.matchMedia('(max-width:1023px)').matches;

/* Header close buttons (mobile/tablet) */
document.querySelectorAll('.sheet-close').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const sel = e.currentTarget.getAttribute('data-close');
    if (!sel) return;
    const el = document.querySelector(sel);
    if (el) { el.classList.remove('active'); map && map.resize(); }
  });
});

/* Open/close sheet helpers */
function openSheet(which){
  if (!isMobileLike()) return; // desktop shows both panels
  if (which === 'chat'){
    const on = !botPane.classList.contains('active');
    botPane.classList.toggle('active', on);
    listPane.classList.remove('active');
  } else if (which === 'list'){
    const on = !listPane.classList.contains('active');
    listPane.classList.toggle('active', on);
    botPane.classList.remove('active');
  }
  map && map.resize();
}

toggleChatBtn?.addEventListener('click', () => openSheet('chat'));
toggleListBtn?.addEventListener('click', () => openSheet('list'));

/* Ensure Mapbox resizes when sheets animate or viewport changes */
['transitionend'].forEach(ev => {
  botPane.addEventListener(ev, () => map && map.resize(), true);
  listPane.addEventListener(ev, () => map && map.resize(), true);
});
window.addEventListener('resize', () => { map && map.resize(); });

/* Basic swipe-to-close on mobile: pull down when scrolled to top */
function attachSwipeClose(el){
  let startY = null;
  el.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, {passive:true});
  el.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    const atTop = (el.scrollTop || 0) <= 0;
    if (dy > 80 && atTop) { el.classList.remove('active'); startY = null; map && map.resize(); }
  }, {passive:true});
  el.addEventListener('touchend', () => { startY = null; }, {passive:true});
}
attachSwipeClose(botPane);
attachSwipeClose(listPane);

const markersProp  = new Map(); // propID -> Marker
const markersPOI   = new Map(); // UID   -> Marker
const markersUni   = new Map(); // uniKey -> Marker

let baseProps       = []; // raw from DB (with coords)
let currentProps    = []; // filtered + decorated
let amenityIndex    = new Map(); // pid -> { amen[], serv[] }
let galleryIndex    = new Map(); // pid -> [{url, order}]
let roomsIndex      = new Map(); // pid -> [{ room_type, price_per_week, available, tenure }]
let currentRingsGeo = null;
let hideRingsTimer  = null;

let showPlaces       = false;
let uniIndex         = null; // { campuses: Map, nearestByProp: Map }

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
/* --- Canonical label normaliser for filters/utility detection --- */
const CANON = [
  { key:'all_bills',     label:'All bills included',  tests:[/all (utilities|utility bills|bills) included/i, /\bbills included\b/i] },
  { key:'internet',      label:'Internet / Wi-Fi',     tests:[/wi[- ]?fi/i, /internet/i, /broadband/i, /high[- ]?speed/i] },
  { key:'electricity',   label:'Electricity included', tests:[/electric(ity)? included/i, /\belectric(ity)?\b/i] },
  { key:'water',         label:'Water included',       tests:[/water included/i, /\bwater\b/i] },
  { key:'gas',           label:'Gas included',         tests:[/gas included/i, /\bgas\b/i] },
  { key:'contents_ins',  label:'Contents insurance',   tests:[/contents? insurance/i] },
];

function canonKeyFor(label=''){
  for (const c of CANON){ if (c.tests.some(rx => rx.test(label))) return c.key; }
  return null;
}
function canonLabelForKey(key){ return (CANON.find(c=>c.key===key)||{}).label || key; }
function isUtilityLabel(label){ return !!canonKeyFor(label); }

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

/* Walking time/distance formatting */
function formatWalkMins(mins){
  if (mins == null) return null;
  const m = Number(mins);
  if (!Number.isFinite(m)) return null;
  return `${m} min walk`;
}
function formatWalkDistance(meters){
  if (meters == null) return null;
  const v = Number(meters);
  if (!Number.isFinite(v)) return null;

  if (v >= 1000){
    const km = v / 1000;
    const fixed = km.toFixed(1);              // 1.2
    const trimmed = fixed.replace(/\.0$/,''); // 1.0 -> 1
    return `${trimmed} km walk`;
  }
  const rounded = Math.round(v);
  return `${rounded.toLocaleString('en-GB')} m walk`;
}

function clearPOIMarkers(){
  for (const m of markersPOI.values()) m.remove();
  markersPOI.clear();
}
function clearUniMarkers(){
  for (const m of markersUni.values()) m.remove();
  markersUni.clear();
}

function clearAllMarkers(){
  for (const m of markersProp.values()) m.remove(); markersProp.clear();
  clearPOIMarkers();
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

/************ POI + Campus helpers ************/
function syncPOIMarkers(){
  if (!showPlaces){
    clearPOIMarkers();
    return;
  }
  if (!baseProps.length) return;
  const centers = new Map(baseProps.map(p => [String(p.propID), { lat:p.lat, lon:p.lon }]));
  const ids = baseProps.map(p => String(p.propID));
  fetchPOIsForProps(ids, { types:['cafe','bar','restaurant','gym','park'], perTypeLimit:8, radiusMeters:800 }, centers)
    .then(({ list }) => {
      clearPOIMarkers();
      list.forEach(drawPOI);
    })
    .catch(err => console.error('[POI] sync error', err));
}

function drawCampusMarkers(){
  if (!uniIndex) return;
  clearUniMarkers();
  for (const [key, campus] of uniIndex.campuses.entries()){
    if (campus.lon == null || campus.lat == null) continue;
    const el = makePin('pin--uni','🎓');
    const cityHtml  = campus.city ? `<div class="meta">${escapeHtml(campus.city)}</div>` : '';
    const count     = campus.propIDs ? campus.propIDs.size : 0;
    const popupHtml = `
      <div style="font-size:13px; line-height:1.35">
        <div style="font-weight:700">${escapeHtml(campus.name||'')}</div>
        ${cityHtml}
        <div class="meta">${count} linked properties</div>
      </div>`;

    const m = new mapboxgl.Marker({ element: el, anchor:'bottom' })
      .setLngLat([campus.lon, campus.lat])
      .setPopup(new mapboxgl.Popup({ offset:8 }).setHTML(popupHtml))
      .addTo(map);
    markersUni.set(key, m);
  }
}

/************ University distance data ************/
async function fetchUniDataForProps(propIDs){
  if (!propIDs?.length) return { campuses:new Map(), nearestByProp:new Map() };

  const ids = propIDs.map(String);

  // NOTE: column names are all lower-case and exactly as in Supabase:
  // "university_distance_final" with:
  //   - "university"
  //   - "university_postcode"
  //   - "city"
  //   - "propid"
  //   - "metric"
  //   - "value"
  const { data, error } = await supabase
    .from('university_distance_final')
    .select('university, university_postcode, city, propid, metric, value')
    .in('propid', ids);

  if (error || !data?.length){
    console.error('[supabase] university_distance_final error or empty', error);
    return { campuses:new Map(), nearestByProp:new Map() };
  }

  const campuses     = new Map(); // uniKey -> { name, postcode, city, lat, lon, propIDs:Set }
  const nearestByProp = new Map(); // pid -> { name, walkSecs, walkMins, walkMeters }

  for (const r of data){
    const pid      = String(r.propid);
    const uniName  = String(r.university || '').trim();
    const postcode = String(r.university_postcode || '').trim();
    const city     = r.city || '';

    if (!pid || !uniName || !postcode) continue;

    const uniKey = `${uniName}|${postcode}`;
    let campus = campuses.get(uniKey);
    if (!campus){
      campus = { name: uniName, postcode, city, lat: null, lon: null, propIDs: new Set() };
      campuses.set(uniKey, campus);
    }
    campus.propIDs.add(pid);

    const metricKey = String(r.metric || '').toLowerCase();
    const val       = Number(r.value);
    if (!Number.isFinite(val)) continue;

    // Assumptions based on your data:
    //  - time_* metrics (e.g. time_walking, Time_walking) are in SECONDS
    //  - distance_* metrics (e.g. distance_walking) are in METRES
    const existing = nearestByProp.get(pid) || {
      name: uniName,
      walkSecs:  null,
      walkMins:  null,
      walkMeters:null
    };

    const isWalkTime     = metricKey.startsWith('time_')     && metricKey.includes('walk');
    const isWalkDistance = metricKey.startsWith('distance_') && metricKey.includes('walk');

    if (isWalkTime){
      const secs = val;
      const mins = Math.round(secs / 60);
      // keep the university with the shortest walking time for this property
      if (existing.walkSecs == null || secs < existing.walkSecs){
        nearestByProp.set(pid, {
          ...existing,
          name: uniName,
          walkSecs: secs,
          walkMins: mins
        });
      }
    } else if (isWalkDistance){
      const meters = Math.round(val);
      const cur = nearestByProp.get(pid) || existing;
      nearestByProp.set(pid, {
        ...cur,
        name: uniName,
        walkMeters: meters
      });
    }
    // other metrics (time_cycling, time_driving, distance_cycling, etc.)
    // are ignored for now but are available for future use.
  }

  // Geocode each campus using the university_postcode
  for (const campus of campuses.values()){
    const g = await geocodeAddress(campus.postcode);
    if (g){
      campus.lat = g.lat;
      campus.lon = g.lon;
    }
  }

  return { campuses, nearestByProp };
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

/************ Rooms (price / type) ************/
async function fetchRooms(propIDs){
  const ids = (propIDs || []).map(String);
  if (!ids.length) return new Map();

  // Table: "room_price"
  // Columns: "room_type", "price_per_week", "available", "tenure", "propid"
  const { data, error } = await supabase
    .from('room_price')
    .select('room_type, price_per_week, available, tenure, propid')
    .in('propid', ids)
    .limit(10000);

  if (error){
    console.error('[supabase] room_price error', error);
    return new Map();
  }

  const by = new Map();
  for (const r of (data || [])){
    const pid = String(r.propid);
    if (!pid) continue;
    if (!by.has(pid)) by.set(pid, []);
    by.get(pid).push({
      room_type:      r.room_type || '',
      price_per_week: (r.price_per_week != null ? Number(r.price_per_week) : null),
      available:      r.available,
      tenure:         (r.tenure != null ? Number(r.tenure) : null)
    });
  }
  return by;
}

/* Helper: summary string used in cards */
function roomSummaryHtml(pid){
  const rooms = roomsIndex.get(String(pid)) || [];
  if (!rooms.length) return '';

  // Prefer available rooms; fall back to any room if all are unavailable
  const pool = rooms.filter(r =>
    r.available === true || String(r.available).toLowerCase() === 'true'
  );
  const candidates = pool.length ? pool : rooms;

  const priced = candidates.filter(r => Number.isFinite(r.price_per_week));
  if (!priced.length) return '';

  priced.sort((a,b) => a.price_per_week - b.price_per_week);
  const best = priced[0];

  const priceStr  = `£${best.price_per_week.toLocaleString('en-GB')}/week`;
  const tenureStr = Number.isFinite(best.tenure) ? ` · ${best.tenure}-week` : '';
  const typeStr   = best.room_type ? ` · ${escapeHtml(best.room_type)}` : '';

  const availabilityNote = pool.length ? '' : ' (not currently available)';

  return `<div class="meta">From ${priceStr}${tenureStr}${typeStr}${availabilityNote}</div>`;
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
  // Drop utility-style labels from card display (they move to Filters)
  const nonUtility = [...amen, ...serv].filter(it => !isUtilityLabel(it.label));
  const items = nonUtility.slice(0, maxTotal).map((x)=> ({...x, _t: amen.includes(x) ? 'amen' : 'serv'}));
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
function makePopupPoiSummary(a){
  const bits = [];
  if (a.cafe)       bits.push(`☕ ${a.cafe} cafés`);
  if (a.bar)        bits.push(`🍺 ${a.bar} bars/pubs`);
  if (a.restaurant) bits.push(`🍽️ ${a.restaurant} restaurants`);
  if (a.gym)        bits.push(`💪 ${a.gym} gyms`);
  if (a.park)       bits.push(`🌳 ${a.park} parks`);
  if (!bits.length) return '';
  const txt = bits.join(' · ');
  return `<div class="meta">Nearby: ${escapeHtml(txt)}</div>`;
}

function drawProperty(p){
  const id = String(p.propID);
  const el = makePin('pin--prop','🏠');
  const marker = markersProp.get(id) ?? new mapboxgl.Marker({ element: el, anchor:'bottom' });

  const ownerHtml   = p.owner ? `<div class="meta">${escapeHtml(p.owner)}</div>` : '';
  const addrHtml    = p.adress ? `<div class="addr">${escapeHtml(p.adress)}</div>` : '';
  const uniHtml     = (() => {
    const u = p._nearestUni;
    if (!u || !u.name) return '';

    const timePart = formatWalkMins(u.walkMins);
    const distPart = formatWalkDistance(u.walkMeters);

    let detail = '';
    if (timePart && distPart) detail = `${timePart} (${distPart})`;
    else detail = timePart || distPart;

    const suffix = detail ? ` · ${detail}` : '';
    return `<div class="meta">Nearest uni: ${escapeHtml(u.name)}${suffix}</div>`;
  })();
  const poiSummary  = p._amenityCounts ? makePopupPoiSummary(p._amenityCounts) : '';
  const linkHtml    = p.link
    ? `<div class="link"><a href="${p.link}" target="_blank" rel="noopener">Open page →</a></div>`
    : '';

  const html = `
    <div style="font-size:13px; line-height:1.35; max-width:260px">
      <div style="font-weight:700">${escapeHtml(p.property||'')}</div>
      ${ownerHtml}
      ${addrHtml}
      ${uniHtml}
      ${poiSummary}
      ${linkHtml}
    </div>`;

  marker
    .setLngLat([p.lon, p.lat])
    .setPopup(new mapboxgl.Popup({ offset:8, maxWidth:'340px' }).setHTML(html))
    .addTo(map);

  markersProp.set(id, marker);

  // Rings + card scroll on map marker hover
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
  if (a.cafe)       bits.push(`<span class="chip chip--poi" data-tip="Cafés nearby" aria-label="Cafés nearby">☕ <b>${a.cafe}</b></span>`);
  if (a.bar)        bits.push(`<span class="chip chip--poi" data-tip="Bars & pubs nearby" aria-label="Bars & pubs nearby">🍺 <b>${a.bar}</b></span>`);
  if (a.restaurant) bits.push(`<span class="chip chip--poi" data-tip="Restaurants nearby" aria-label="Restaurants nearby">🍽️ <b>${a.restaurant}</b></span>`);
  if (a.gym)        bits.push(`<span class="chip chip--poi" data-tip="Gyms nearby" aria-label="Gyms nearby">💪 <b>${a.gym}</b></span>`);
  if (a.park)       bits.push(`<span class="chip chip--poi" data-tip="Parks & green spaces nearby" aria-label="Parks & green spaces nearby">🌳 <b>${a.park}</b></span>`);
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

  cardsMount.innerHTML = props.map(p => {
    const savedOn     = savedIds.has(String(p.propID)) ? ' is-on' : '';
    const metaCity    = p.city ? escapeHtml(p.city) : '';
    const addrHtml    = p.adress ? `<div class="addr">${escapeHtml(p.adress)}</div>` : '';
    const priceHtml   = roomSummaryHtml(p.propID);
    const uniHtml     = (() => {
      const u = p._nearestUni;
      if (!u || !u.name) return '';
      const timePart = formatWalkMins(u.walkMins);
      const distPart = formatWalkDistance(u.walkMeters);
      let detail = '';
      if (timePart && distPart) detail = `${timePart} (${distPart})`;
      else detail = timePart || distPart;
      return detail
        ? `<div class="decision">Nearest uni: ${escapeHtml(u.name)} · ${detail}</div>`
        : `<div class="decision">Nearest uni: ${escapeHtml(u.name)}</div>`;
    })();
      const descHtml    = p.property_description
      ? `<div class="desc">${escapeHtml(p.property_description)}</div>`
      : '';
    const amenRow     = p._amenServ ? makeAmenityServiceRow(p._amenServ) : ''; // computed but not rendered (filters handle this now)
    const linkHtml    = p.link
      ? `<div class="link"><a href="${p.link}" target="_blank" rel="noopener">Open page →</a></div>`
      : '';

    return `
      <article class="card" data-id="${p.propID}">
        <button class="save-btn${savedOn}" data-id="${p.propID}" aria-label="Save property">❤</button>
        <h3>${escapeHtml(p.property||'')}${p.owner ? ' · ' + escapeHtml(p.owner) : ''}</h3>
        <div class="meta">${metaCity}</div>
        ${addrHtml}
        ${galleryHtml(p.propID)}
        ${descHtml}
        ${priceHtml}
        ${uniHtml}
        ${linkHtml}
      </article>`;
  }).join('');

  // Wire Save buttons here so they exist for this render (and don’t bubble to the card)
  cardsMount.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = String(btn.getAttribute('data-id'));
      if (savedIds.has(id)) { savedIds.delete(id); btn.classList.remove('is-on'); }
      else { savedIds.add(id); btn.classList.add('is-on'); }
      updateSavedCount();
      renderSavedPanel();
    });
  });

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
  if (on){
    card.classList.add('is-active');
    card.scrollIntoView({ block:'start', behavior:'smooth' });
  } else {
    card.classList.remove('is-active');
  }
}

/************ Filters ************/
function buildAmenityUniverse(){
  // Tally canonical utilities
  const canonCounts = new Map();        // key -> count
  const canonLabels = new Map();        // key -> nice label
  // Tally non-utility labels
  const amenCounts = new Map();         // labelLower -> count
  const amenDisplay = new Map();        // labelLower -> display

  for (const [, as] of amenityIndex.entries()){
    const seenCanon = new Set();
    const seenAmen  = new Set();
    const allItems = [...(as.amen||[]), ...(as.serv||[])];

    for (const it of allItems){
      const label = String(it.label||'').trim();
      if (!label) continue;
      const ckey = canonKeyFor(label);

      if (ckey){
        if (!seenCanon.has(ckey)){
          seenCanon.add(ckey);
          canonCounts.set(ckey, (canonCounts.get(ckey)||0)+1);
          canonLabels.set(ckey, canonLabelForKey(ckey));
        }
      } else {
        const low = label.toLowerCase();
        if (!seenAmen.has(low)){
          seenAmen.add(low);
          amenCounts.set(low, (amenCounts.get(low)||0)+1);
          amenDisplay.set(low, label);
        }
      }
    }
  }

  // Essentials (sorted by frequency)
  const essentials = [...canonCounts.entries()]
    .sort((a,b)=> b[1]-a[1])
    .map(([key]) => ({ kind:'canon', key, label: canonLabels.get(key) }));

  // Amenities/Services (top N, excluding utilities)
  const MAX_AMEN = 12;
  const amenities = [...amenCounts.entries()]
    .sort((a,b)=> (b[1]||0)-(a[1]||0))
    .slice(0, MAX_AMEN)
    .map(([low]) => ({ kind:'label', key: low, label: amenDisplay.get(low) }));

  return { essentials, amenities };
}

function renderAmenityFilters(){
  const { essentials, amenities } = buildAmenityUniverse();

  const group = (title, items) => `
    <div class="filters-label" style="margin-top:6px;">${escapeHtml(title)}</div>
    <div class="filters-chips">
      ${items.map(it => `
        <button class="filter-chip" data-kind="${it.kind}" data-key="${it.key}">
          ${escapeHtml(it.label)}
        </button>
      `).join('')}
    </div>
  `;

  amenityFiltersEl.innerHTML = `
    ${group('Essentials (bills & internet)', essentials)}
    ${group('Amenities', amenities)}
  `;

  amenityFiltersEl.querySelectorAll('.filter-chip').forEach(btn => {
    const kind = btn.getAttribute('data-kind');  // 'canon' or 'label'
    const key  = btn.getAttribute('data-key');   // canon key or lowercased label
    const token = `${kind}:${key}`;
    if (filters.mustAmenities.has(token)) btn.classList.add('is-on');

    btn.addEventListener('click', ()=>{
      if (filters.mustAmenities.has(token)) filters.mustAmenities.delete(token);
      else filters.mustAmenities.add(token);
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

  // Build per-property lookup: canonical utilities + raw labels (lowercased)
  function propSets(p){
    const raw = new Set([...(p._amenServ.amen||[]), ...(p._amenServ.serv||[])]
      .map(it => String(it.label).toLowerCase()));
    const canon = new Set();
    raw.forEach(lbl => { const k = canonKeyFor(lbl); if (k) canon.add(k); });
    return { raw, canon };
  }

  // must-include (supports tokens like 'canon:internet' and 'label:roof terrace')
  if (filters.mustAmenities.size){
    const req = [...filters.mustAmenities];
    out = out.filter(p => {
      const { raw, canon } = propSets(p);
      return req.every(tok => {
        const [kind, key] = tok.split(':');
        if (kind === 'canon') return canon.has(key);
        if (kind === 'label') return raw.has(key);
        return false;
      });
    });
  }

  // re-render markers & list
  clearAllMarkers();
  out.forEach(drawProperty);
  renderList(out);
  fitToAllMarkers();
  syncPOIMarkers();
  drawCampusMarkers();
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

  const { counts } = await fetchPOIsForProps(ids, { types:['cafe','bar','restaurant','gym','park'], perTypeLimit:0, radiusMeters:800 }, centers);
  const uniData  = await fetchUniDataForProps(ids);
  const amenServ = await fetchAmenAndServices(ids);
  const gallery  = await fetchGallery(ids);
  const rooms    = await fetchRooms(ids);

  amenityIndex = amenServ;
  galleryIndex = gallery;
  roomsIndex   = rooms;
  uniIndex     = uniData;

  baseProps = props.map(p => {
    const pid = String(p.propID);
    return {
      ...p,
      _amenityCounts: counts.get(pid) || null,
      _nearestUni: uniData.nearestByProp.get(pid) || null
    };
  });

  // initial render (no filters applied yet)
  renderAmenityFilters();
  applyFilters(); // will draw markers + list and sync POIs
  drawCampusMarkers(); // campuses always visible when data available
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
  const uniData  = await fetchUniDataForProps(ids);
  const amenServ = await fetchAmenAndServices(ids);
  const gallery  = await fetchGallery(ids);
  const rooms    = await fetchRooms(ids);

  amenityIndex = amenServ;
  galleryIndex = gallery;
  roomsIndex   = rooms;
  uniIndex     = uniData;

  baseProps = props.map(p => {
    const pid = String(p.propID);
    return {
      ...p,
      _amenityCounts: counts.get(pid) || null,
      _nearestUni: uniData.nearestByProp.get(pid) || null
    };
  });

  renderAmenityFilters();
  applyFilters();
  drawCampusMarkers();
}
map.once('load', bootstrap);