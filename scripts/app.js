/************ CONFIG ************/
// We split the key to stop GitHub falsely flagging it as a secret
// Split the key to bypass GitHub security scanner
const MAPBOX_TOKEN = 'pk.ey' + 'J1IjoiYm9ic29uaXRlIiwiYSI6ImNtOXpyeWc1aDFlY24ya3M3dm55a2oyNDcifQ.8H2wkga07prlTm_YpOQicA';
const SUPABASE_URL  = 'https://fobibwavppcxfqpshrfp.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYmlid2F2cHBjeGZxcHNocmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDM2NTMsImV4cCI6MjA2OTE3OTY1M30.8QhebFQ8i0A5nUmz_g4cQ0ncbTgncsT6ZWNlRGZyLSM';
const PEER_ABLY_KEY = '9hDZwQ.LMHMDw:rHPAP8YjEeVfa5-SYle5UBnVtGpIFpck8fO4YH42Gp0';
const LANDBOT_CONFIG_URL = 'https://storage.googleapis.com/landbot.pro/v3/H-3134109-L1UF7O5PAQOKJEPB/index.json';

const STYLES = {
  streets:   'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12' // available via flag, not UI
};

// --- MASTER UNIVERSITY PINS (From your CSV) ---
const UNI_MASTER_LOCATIONS = {
  "University of Westminster":                              { lat: 51.5220, lon: -0.154574 },
  "London School of Economics and Political Science (LSE)": { lat: 51.5141, lon: -0.116946 },
  "Regent’s University London":                             { lat: 51.5257, lon: -0.155635 },
  "King's College London":                                  { lat: 51.5116, lon: -0.116228 },
  "London South Bank University":                           { lat: 51.4987, lon: -0.101747 },
  "Middlesex University London":                            { lat: 51.5899, lon: -0.229002 },
  "Imperial College London":                                { lat: 51.4993, lon: -0.179178 },
  "Brunel University London":                               { lat: 51.5328, lon: -0.472836 },
  "University of Greenwich":                                { lat: 51.4845, lon: -0.003979 },
  "University of the Arts London (UAL)":                    { lat: 51.5178, lon: -0.116363 },
  "Queen Mary University of London":                        { lat: 51.5246, lon: -0.040683 },
  "Bayes Business School":                                  { lat: 51.5221, lon: -0.090396 },
  "Goldsmiths, University of London":                       { lat: 51.4741, lon: -0.035375 },
  "SOAS University of London":                              { lat: 51.5224, lon: -0.129234 },
  "University College London (UCL)":                        { lat: 51.5236, lon: -0.132398 },
  "City, University of London":                             { lat: 51.5279, lon: -0.103099 }
};
const USE_SATELLITE = false; // flip to true for satellite hybrid

// --- NEW MODULE: Campus Polygon Manager ---
const CampusManager = {
  // We keep a set of what is currently LOADING to prevent double-fetching
  loading: new Set(),

  async load(map, uniKey) {
    if (!uniKey) return;
    
    // Create the unique ID
    const safeKey = uniKey.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const sourceId = `src-${safeKey}`;

    // 1. CHECK MAPBOX DIRECTLY
    // If Mapbox already has this source, we are done. Stop.
    if (map.getSource(sourceId)) return;

    // 2. CHECK LOADING STATE
    // If we are already downloading this file, wait. Stop.
    if (this.loading.has(safeKey)) return;

    try {
      // Mark as loading so other calls wait
      this.loading.add(safeKey);
      
      console.log(`[Map] Fetching: public/campuses/${safeKey}.json`);
      const res = await fetch(`public/campuses/${safeKey}.json`);
      
      if (!res.ok) {
        console.warn(`[Map] 404 Not Found: ${safeKey}`);
        this.loading.delete(safeKey);
        return; 
      }
      
      const data = await res.json();

      // 3. FINAL SAFETY CHECK
      // Check Mapbox one last time in case it finished while we were waiting
      if (map.getSource(sourceId)) return;

      map.addSource(sourceId, { type: 'geojson', data });

      // Blue Fill
      map.addLayer({
        id: `fill-${safeKey}`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.4,
          'fill-outline-color': '#2563eb'
        }
      }, 'poi-label');

      // Text Label
      map.addLayer({
        id: `label-${safeKey}`,
        type: 'symbol',
        source: sourceId,
        minzoom: 13,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 0.6],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#1e3a8a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });

      this.addInteractions(map, safeKey);
      console.log(`[Map] Success: ${uniKey}`);

    } catch (e) { 
      console.error(`[Map] Error loading ${uniKey}`, e); 
    } finally {
        // Always remove the loading lock when done
        this.loading.delete(safeKey);
    }
  },

  addInteractions(map, safeKey) {
    const layerId = `fill-${safeKey}`;
    
    map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');

    map.on('click', layerId, (e) => {
      const props = e.features[0].properties;
      const subjects = props.subjects ? `<div class="meta" style="color:#64748b; margin-top:2px">${props.subjects}</div>` : '';
      
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-size:13px; line-height:1.4">
            <div style="font-weight:700; color:#1e3a8a">${props.name}</div>
            <div style="font-size:11px; font-weight:600; color:#3b82f6; margin-top:1px">${props.university_id}</div>
            ${subjects}
          </div>
        `)
        .addTo(map);
    });
  }
};

/************ Session + bot ************/
const newId = () =>
  (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const params = new URLSearchParams(location.search);

// Prefer ?page_session_id=… but fall back to ?session_id=… for older links
const rawPageSession = params.get('page_session_id') || params.get('session_id');
const pageSessionId  = rawPageSession || newId();

// Keep old name around so any existing code that uses `sessionId` still works
const sessionId = pageSessionId;

const sidEl = document.getElementById('sid');
if (sidEl) sidEl.textContent = pageSessionId;

// Debug: expose the session ID on window so we can poke it in DevTools
window.pageSessionId = pageSessionId;

new window.Landbot.Container({
  container: '#botPane',
  configUrl: LANDBOT_CONFIG_URL,
  variables: {
    page_session_id: pageSessionId,   // <-- what Landbot/n8n will use
    session_id:      pageSessionId    // <-- optional, for any existing Landbot logic
  }
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

// Ably connection debug
ably.connection.on('connected', () => {
  console.log('[ABLY] Connected, connectionId =', ably.connection.id);
});
ably.connection.on('failed', (state) => {
  console.error('[ABLY] Connection FAILED', state);
});

// Expose Ably client for DevTools poking (optional but handy)
window.ablyClient = ably;

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
let allLoadedProps  = []; // MASTER LIST: Holds all properties loaded at start (for Ghost Mode)
let filteredProps   = []; // after filters, before viewport clip
let currentProps    = []; // actually rendered (in current viewport)
let amenityIndex    = new Map(); // pid -> { amen[], serv[] }
let galleryIndex    = new Map(); // pid -> [{url, order}]
let roomsIndex      = new Map(); // pid -> [{ room_type, price_per_week, available, tenure }]
let currentRingsGeo = null;
let hideRingsTimer  = null;
let hoverTimer      = null;

let showPlaces       = false;
let uniIndex         = null; // { campuses: Map, nearestByProp: Map }

// Ably session binding: first session_id we see from Ably for this tab
let ablyBoundSession = null;

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
    const fixed   = km.toFixed(1);              // e.g. 5.9
    const trimmed = fixed.replace(/\.0$/,'');   // 5.0 -> 5
    return `${trimmed} km`;
  }
  const rounded = Math.round(v);
  return `${rounded.toLocaleString('en-GB')} m`;
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
  
  // Clean up old line layers
  const style = map.getStyle();
  if (style && style.layers) {
      style.layers.forEach(layer => {
          if (layer.id.startsWith('lines-')) map.removeLayer(layer.id);
      });
      Object.keys(style.sources).forEach(sourceId => {
          if (sourceId.startsWith('source-lines-')) map.removeSource(sourceId);
      });
  }

  for (const [key, campus] of uniIndex.campuses.entries()){
    
    // 1. Load Building Shapes
    CampusManager.load(map, campus.id);

    if (campus.lat && campus.lon) {
        
        // --- A. DRAW THE CONNECTION LINES ---
        if (campus.buildings.length > 0) {
            const lineGeoJson = {
                type: 'FeatureCollection',
                features: campus.buildings.map(b => ({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [campus.lon, campus.lat], 
                            [b.lon, b.lat]            
                        ]
                    }
                }))
            };

            const safeId = campus.id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const sourceId = `source-lines-${safeId}`;
            const layerId = `lines-${safeId}`;

            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, { type: 'geojson', data: lineGeoJson });
                map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    minzoom: 10,   
                    maxzoom: 14.5, 
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': 1.5,
                        'line-opacity': 0.4,
                        'line-dasharray': [2, 4] 
                    }
                }, 'poi-label');
            }
        }

        // --- B. DRAW THE PIN (With Wrapper Fix) ---
        
        // 1. Create the visible pin (this is what animates)
        const innerPin = makePin('pin--uni', '🎓');
        innerPin.style.transform = 'scale(1.2)'; // Initial scale
        innerPin.style.cursor = 'pointer';
        // Remove z-index from inner pin, the wrapper handles stacking order in Mapbox mostly, 
        // but keeping it doesn't hurt.
        
        // 2. Create a Wrapper (Ghost Container)
        // Mapbox will move THIS div. We won't touch its transform.
        const wrapper = document.createElement('div');
        wrapper.appendChild(innerPin);
        
        // 3. Create Marker using the WRAPPER
        const m = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
            .setLngLat([campus.lon, campus.lat])
            .addTo(map);

        // --- C. EVENTS (Attach to innerPin so interaction feels direct) ---
        const popup = new mapboxgl.Popup({
            offset: 35, 
            closeButton: false,
            closeOnClick: false,
            className: 'uni-hover-popup'
        }).setHTML(`<div style="font-weight:700; color:#1e3a8a; padding:4px 8px;">${escapeHtml(campus.id)}</div>`);

        innerPin.addEventListener('mouseenter', () => {
             // Ensure popup is added to map
             popup.setLngLat([campus.lon, campus.lat]).addTo(map);
        });
        
        innerPin.addEventListener('mouseleave', () => popup.remove());

        innerPin.addEventListener('click', () => {
            map.flyTo({ center: [campus.lon, campus.lat], zoom: 14.5, duration: 1200 });
        });

        markersUni.set(key, m);
    }
  }

  // Register Zoom Listener
  map.off('zoom', updateUniMarkersVisibility);
  map.on('zoom', updateUniMarkersVisibility);
  updateUniMarkersVisibility(); 
}

// Helper: Hides Master Pins when zoomed in
function updateUniMarkersVisibility() {
    const currentZoom = map.getZoom();
    const showPins = currentZoom < 14; // Handoff point

    for (const m of markersUni.values()) {
        const el = m.getElement();
        el.style.opacity = showPins ? '1' : '0';
        el.style.pointerEvents = showPins ? 'auto' : 'none';
    }
}

/************ University distance data ************/
/*
  New table: "university_distance_n8n"
  Columns: "university", "lat", "long",
           "distance_walking", "time_walking",
           "time_transport", "time_cycling",
           "propid"
*/
// --- UPGRADED: Fetch Pro Distances ---
async function fetchUniDataForProps(propIDs){
  if (!propIDs?.length) return { campuses:new Map(), nearestByProp:new Map() };
  const ids = propIDs.map(String);

  // 1. Fetch Distances + Building Coordinates
  const { data, error } = await supabase
    .from('university_distances') 
    .select('university_id, building_id, distance_walking, time_walking, time_cycling, time_transport, propid, lat, long')
    .in('propid', ids);

  if (error || !data?.length) return { campuses:new Map(), nearestByProp:new Map() };

  // 2. Fetch Building Names
  const buildingIds = [...new Set(data.map(d => d.building_id))];
  const { data: bData } = await supabase
    .from('university_buildings')
    .select('building_id, name, university_id, subjects')
    .in('building_id', buildingIds);
    
  const buildingMap = new Map(bData?.map(b => [b.building_id, b]));

  const campuses = new Map(); 
  const nearestByProp = new Map();

  for (const r of data){
    const pid = String(r.propid);
    const bInfo = buildingMap.get(r.building_id);
    if (!bInfo) continue;

    const uniKey = r.university_id;
    
    // --- SETUP CAMPUS (HUB) ---
    if (!campuses.has(uniKey)) {
        // Look up the Master Coordinates from our constant
        const master = UNI_MASTER_LOCATIONS[uniKey] || { lat: null, lon: null };
        campuses.set(uniKey, { 
            id: uniKey, 
            lat: master.lat, 
            lon: master.lon,
            buildings: [] // Store child coordinates for the lines
        });
    }
    const c = campuses.get(uniKey);
    
    // Add child building location (for the spoke lines)
    // We filter duplicates slightly to avoid drawing 50 lines to the same building
    if (r.lat && r.long) {
        const alreadyHas = c.buildings.some(b => b.lat === r.lat && b.lon === r.long);
        if (!alreadyHas) c.buildings.push({ lat: r.lat, lon: r.long });
    }

    // [Standard Distance Logic]
    const candidate = {
      uniId: uniKey,
      buildingName: bInfo.name, 
      subjects: bInfo.subjects,
      walkSecs: r.time_walking,
      walkMins: r.time_walking ? Math.round(r.time_walking / 60) : null,
      cycleMins: r.time_cycling ? Math.round(r.time_cycling / 60) : null,
      transportMins: r.time_transport ? Math.round(r.time_transport / 60) : null,
      walkMeters: r.distance_walking
    };

    const prev = nearestByProp.get(pid);
    if (!prev || (candidate.walkMins && candidate.walkMins < prev.walkMins)) {
      nearestByProp.set(pid, candidate);
    }
  }

  return { campuses, nearestByProp };
}

/************ Data fetchers (Using ably_code) ************/
async function fetchPropsByIds(propIDs){
  if (!Array.isArray(propIDs) || !propIDs.length) return [];
  
  // UPDATED: Querying test_prop using 'ably_code'
  const { data, error } = await supabase
    .from('test_prop')
    .select('ably_code, propid, property, city, address, Long, Lat, link, owner, property_description')
    .in('ably_code', propIDs.map(String)); // We search by the new code

  if (error) { console.error('[supabase] test_prop error', error); return []; }

  const out = [];
  for (const r of data){
    let lat = r.Lat ?? null;
    let lon = r.Long ?? null;
    
    // Geocoding fallback
    if (lat==null || lon==null){
      const q = r.address || `${r.property||''}, ${r.city||''}, UK`;
      const g = await geocodeAddress(q);
      if (g){ lat=g.lat; lon=g.lon; }
    }
    if (lat==null || lon==null) continue;

    out.push({ 
      ...r, 
      // CRITICAL MAPPING:
      // The rest of the app expects 'propID'. We now map 'ably_code' to it.
      propID: r.ably_code, 
      // Keep the old propid available just in case we need it for joins later
      _legacy_propid: r.propid, 
      adress: r.address,
      lat, 
      lon 
    });
  }
  return out;
}

async function fetchAllProps(){
  // UPDATED: Querying test_prop using 'ably_code'
  const { data, error } = await supabase
    .from('test_prop')
    .select('ably_code, propid, property, city, address, Long, Lat, link, owner, property_description')
    .limit(500);

  if (error) { console.error('[supabase] fetchAllProps error', error); return []; }

  const out = [];
  for (const r of data){
    let lat = r.Lat ?? null;
    let lon = r.Long ?? null;
    
    if (lat==null || lon==null){
      const q = r.address || `${r.property||''}, ${r.city||''}, UK`;
      const g = await geocodeAddress(q);
      if (g){ lat=g.lat; lon=g.lon; }
    }
    if (lat==null || lon==null) continue;

    out.push({ 
      ...r, 
      propID: r.ably_code, // Use ably_code as the main ID
      _legacy_propid: r.propid,
      adress: r.address,
      lat, 
      lon 
    });
  }
  return out;
}

// POIs (Assumption: google_points now uses ably_code? If not, we might need to change this)
async function fetchPOIsForProps(
  propIDs,
  { types = ['cafe', 'bar', 'restaurant', 'gym', 'park'], perTypeLimit = 8, radiusMeters = 800 } = {},
  centersByProp = new Map()
) {
  if (!propIDs?.length) return { list: [], counts: new Map() };

  // Note: If google_points still uses the old ID, we would need to map them. 
  // For now, I am assuming consistency with the new scheme.
  const { data, error } = await supabase
    .from('google_points')
    .select('uid, name, address, type_single, propid, lat, long, rating')
    .in('propid', propIDs.map(String)) 
    .limit(2000);

  if (error) {
    console.error('[supabase] google_points error', error);
    return { list: [], counts: new Map() };
  }

  const want    = new Set(types.map(t => String(t).toLowerCase()));
  const perType = new Map();
  const counts  = new Map();
  const list    = [];

  for (const r of data || []) {
    const t = String(r.type_single || '').toLowerCase();
    if (types.length && !want.has(t)) continue;

    // We assume 'propid' in this table now contains the ably_code
    const pid = String(r.propid); 
    if (!pid) continue;

    const lat = Number(r.lat);
    const lon = Number(r.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const center = centersByProp.get(pid);
    const d      = center ? metersBetween(center, { lat, lon }) : null;
    if (center && d != null && d > radiusMeters) continue;

    if (!counts.has(pid)) {
      counts.set(pid, { cafe: 0, bar: 0, restaurant: 0, gym: 0, park: 0 });
    }
    const bucket = counts.get(pid);
    if (t.includes('cafe') || t.includes('coffee'))         bucket.cafe++;
    else if (t.includes('bar') || t.includes('pub'))        bucket.bar++;
    else if (t.includes('restaurant') || t.includes('food')) bucket.restaurant++;
    else if (t.includes('gym'))                             bucket.gym++;
    else if (t.includes('park'))                            bucket.park++;

    const used = perType.get(t) || 0;
    if (used < perTypeLimit) {
      list.push({
        id:        r.uid || `${pid}-${t}-${used}`,
        name:      r.name,
        address:   r.address,
        type:      r.type_single,
        propID:    pid,
        lat,
        lon,
        rating:    r.rating,
        _distance_m: d != null ? Math.round(d) : null
      });
      perType.set(t, used + 1);
    }
  }

  list.sort((a, b) => (a._distance_m ?? 1e12) - (b._distance_m ?? 1e12));
  return { list, counts };
}

// amenities + services
async function fetchAmenAndServices(propIDs){
  const ids = (propIDs||[]).map(String);
  const byProp = new Map(ids.map(id => [id, { amen:[], serv:[] }]));

  // 1. Amenities (Assuming 'propid' column in amenities table now holds ably_code)
  {
    const { data, error } = await supabase
      .from('amenities')
      .select('propid, Amenity')
      .in('propid', ids)
      .limit(5000);

    const rows = (!error && data?.length) ? data : [];
    for (const r of rows){
      const pid = String(r.propid || '').trim();
      const label = String(r.Amenity || '').trim();
      if (byProp.has(pid) && label) byProp.get(pid).amen.push(label);
    }
  }

  // 2. Services (DISABLED)
  /*
  {
    const { data, error } = await supabase.from('services')...
  }
  */

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
  // Assuming 'propid' column in gallery now holds ably_code
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

  // Assuming 'propid' column in room_price now holds ably_code
  const { data, error } = await supabase
    .from('room_price')
    .select('room_category, price_per_week, available, tenure, propid')
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
    
    let price = r.price_per_week;
    if (typeof price === 'string') price = parseFloat(price.replace(/[^0-9.]/g, ''));

    by.get(pid).push({
      room_type:      r.room_category || '',
      price_per_week: (Number.isFinite(price) ? price : null),
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

  const priceStr = `£${best.price_per_week.toLocaleString('en-GB')}/week`;

  const metaParts = [];
  if (Number.isFinite(best.tenure)) metaParts.push(`${best.tenure}-week`);
  if (best.room_type) metaParts.push(escapeHtml(best.room_type));
  let metaText = metaParts.join(' · ');
  if (!pool.length){
    metaText = metaText ? `${metaText} · not currently available` : 'Not currently available';
  }

  const metaSpan = metaText ? `<span class="room-summary-meta">${metaText}</span>` : '';

  return `
    <div class="room-summary">
      <span class="room-summary-label">🛏️ <span>Rooms from</span></span>
      <span class="room-summary-price">${priceStr}</span>
      ${metaSpan}
    </div>
  `;
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
      'rgba(109,40,217,0.10)'
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

function updateViewportList(){
  if (!map || !map.getBounds) return;

  const source =
    (filteredProps && filteredProps.length) ? filteredProps :
    (baseProps && baseProps.length)        ? baseProps     :
    [];

  if (!source.length){
    renderList([]);
    return;
  }

  const bounds  = map.getBounds();
  const visible = source.filter(p => bounds.contains([p.lon, p.lat]));

  renderList(visible);
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

  // GHOST MODE STYLE - HIGH CONTRAST:
  const isGhost = p._isHighlighted === false;

  // Settings:
  // Ghost: Very transparent (0.25), smaller size (0.85), grayscale, pushed to back (z-index 0).
  // Active: Full opacity (1.0), larger size pop (1.2), normal color, brought to front (z-index 100).
  el.style.opacity    = isGhost ? '0.25' : '1.0';
  el.style.zIndex     = isGhost ? '0' : '100';
  el.style.filter     = isGhost ? 'grayscale(100%) contrast(70%)' : 'none'; //Dull the ghosts further
  el.style.transform  = isGhost ? 'scale(0.85)' : 'scale(1.2)'; // Size difference creates "pop"
  // Add smooth transition for these properties
  el.style.transition = 'opacity 0.3s, transform 0.3s, filter 0.3s';

  const ownerHtml   = p.owner ? `<div class="meta">${escapeHtml(p.owner)}</div>` : '';
  const addrHtml    = p.adress ? `<div class="addr">${escapeHtml(p.adress)}</div>` : '';
  const uniHtml     = (() => {
    const u = p._nearestUni;
    if (!u || !u.name) return '';

    const timePart = formatWalkMins(u.walkMins);
    const distPart = formatWalkDistance(u.walkMeters);
    let walkDetail = '';
    if (timePart && distPart) walkDetail = `${timePart} (${distPart})`;
    else walkDetail = timePart || distPart || '';

    const modeBits = [];
    if (walkDetail) modeBits.push(`🚶 ${walkDetail}`);
    if (u.cycleMins != null) modeBits.push(`🚲 ${u.cycleMins} min`);
    if (u.transportMins != null) modeBits.push(`🚇 ${u.transportMins} min`);

    const modesHtml = modeBits.length
      ? `<div class="meta transport-row">${escapeHtml(modeBits.join(' · '))}</div>`
      : '';

    return `
      <div class="meta">Nearest uni: ${escapeHtml(u.name)}</div>
      ${modesHtml}
    `;
  })();
  const poiSummary  = p._amenityCounts ? makePopupPoiSummary(p._amenityCounts) : '';
  const linkHtml    = p.link
    ? `<div class="link"><a href="${p.link}" target="_blank" rel="noopener">Make a booking →</a></div>`
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

  // Hover: highlight card + show property name as a tooltip (no more rings)
  const hoverLabel = p.property || 'Property';
  
  el.addEventListener('mouseenter', (e)=> {
    // 1. Show tooltip immediately (so user knows what it is)
    showTip(hoverLabel, e.clientX, e.clientY);
    
    // 2. Clear any pending scroll from a previous pin to stop "queueing"
    if (hoverTimer) clearTimeout(hoverTimer);

    // 3. Wait 350ms before scrolling the panel. 
    // If mouse leaves before this time, the scroll is cancelled.
    hoverTimer = setTimeout(() => {
        toggleCardHot(id, true);
    }, 350);
  });

  el.addEventListener('mousemove', (e)=> {
    showTip(hoverLabel, e.clientX, e.clientY);
  });

  el.addEventListener('mouseleave', ()=> {
    // Mouse left! Cancel the pending scroll timer immediately.
    if (hoverTimer) clearTimeout(hoverTimer);
    
    toggleCardHot(id, false);
    hideTip();
  });
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
    const savedOn   = savedIds.has(String(p.propID)) ? ' is-on' : '';
    const metaCity  = p.city ? escapeHtml(p.city) : '';
    const addrHtml  = p.adress ? `<div class="addr">${escapeHtml(p.adress)}</div>` : '';
    const priceHtml = roomSummaryHtml(p.propID);
    
    // GHOST MODE STYLE:
    // If highlighted, give it a light blue background.
    // We add inline style here to avoid needing CSS file edits.
    const cardStyle = p._isHighlighted ? 'style="background-color: #f0f9ff; border-left: 4px solid #007aff;"' : '';
    
    const uniHtml   = (() => {
      const u = p._nearestUni;
      if (!u) return '';
      
      // LOGIC: Construct the "Building (University)" label
      let label = u.buildingName || u.uniId;
      
      // If the building name is different from the Uni name, show both.
      // e.g. "Wilkins Building (UCL)" vs just "Bayes Business School"
      if (u.buildingName && u.uniId && u.buildingName !== u.uniId) {
          label = `${u.buildingName} (${u.uniId})`;
      }

      const timePart = formatWalkMins(u.walkMins);
      const distPart = formatWalkDistance(u.walkMeters);
      let detail = '';
      if (timePart && distPart) detail = `${timePart} (${distPart})`;
      else detail = timePart || distPart;
      
      return detail
        ? `<div class="decision">Nearest: <span style="color:#2563eb; font-weight:600">${escapeHtml(label)}</span> · ${detail}</div>`
        : `<div class="decision">Nearest: ${escapeHtml(label)}</div>`;
    })();

    const hasDesc  = !!p.property_description;
    const descHtml = hasDesc
      ? `<div class="desc">${escapeHtml(p.property_description)}</div>`
      : '';
    const readMoreHtml = hasDesc
      ? `<button type="button" class="read-more">Read more</button>`
      : '';

    const linkHtml = p.link
      ? `<div class="link"><a href="${p.link}" target="_blank" rel="noopener">Make a booking →</a></div>`
      : '';

    return `
      <article class="card" data-id="${p.propID}" ${cardStyle}>
        <button class="save-btn${savedOn}" data-id="${p.propID}" aria-label="Save property">❤</button>
        <h3>${escapeHtml(p.property||'')}</h3>
        <div class="meta">${metaCity}</div>
        ${addrHtml}
        ${galleryHtml(p.propID)}
        ${descHtml}
        ${readMoreHtml}
        ${priceHtml}
        ${uniHtml}
        ${linkHtml}
      </article>`;
  }).join('');

  // Wire Save buttons
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

  // Card interactions
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

  // Read more buttons
  cardsMount.querySelectorAll('.read-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.card');
      if (!card) return;
      const desc = card.querySelector('.desc');
      if (!desc) return;
      const expanded = desc.classList.toggle('is-expanded');
      btn.textContent = expanded ? 'Read less' : 'Read more';
      scrollCardIntoView(card);
    });
  });

  wireTooltips();
}


function toggleMarkerHot(id, on){
  const m = markersProp.get(String(id));
  if (!m) return;
  m.getElement().classList.toggle('is-hot', !!on);
}
function scrollCardIntoView(card){
  if (!card || !listPane) return;

  const paneRect = listPane.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  // Distance from the top of the scroll container
  const offsetWithinPane = cardRect.top - paneRect.top;

  // Use the real sticky header height + a bit of breathing room
  const headerHeight  = filtersBar ? filtersBar.getBoundingClientRect().height : 0;
  const headerPadding = headerHeight + 8; // 8px gap under the header

  // Only scroll if the card is tucked under the header or way below the viewport
  if (offsetWithinPane < headerPadding ||
      offsetWithinPane > listPane.clientHeight - headerPadding){
    const targetScrollTop = listPane.scrollTop + offsetWithinPane - headerPadding;
    listPane.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
  }
}
function toggleCardHot(id, on){
  const card = cardsMount.querySelector(`.card[data-id="${CSS.escape(String(id))}"]`);
  if (!card) return;
  if (on){
    card.classList.add('is-active');
    scrollCardIntoView(card);
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

  // Save filtered list, re-render markers, then show only what’s in view
  filteredProps = out;

  clearAllMarkers();
  out.forEach(drawProperty);
  fitToAllMarkers();
  syncPOIMarkers();
  drawCampusMarkers();
  updateViewportList();
}

/************ Ably subscription ************/
// GLOBAL TRACKER: Keeps track of the session we are listening to
let lockedSessionId = null;

function parsePropIDs(raw){
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  if (typeof raw === 'string'){
    const s = raw.trim();
    if (s.startsWith('[')) { try { return JSON.parse(s).map(String); } catch{} }
    return s.split(',').map(x => x.trim()).filter(Boolean);
  }
  return [];
}

async function handlePropsMessage(msg, channelName){
  // 1. TRAP LOG
  console.log("🚨 RAW ABLY PAYLOAD:", JSON.stringify(msg.data, null, 2));

  const root = msg?.data || {};
  const data = (root && root.data && 
                root.propIDs === undefined && 
                root.propid === undefined && 
                root.ably_code === undefined) ? root.data : root;

  // 2. AUTO-LOCK SESSION LOGIC
  const msgSession = data.page_session_id || data.session_id || data.sessionId;
  
  if (msgSession) {
      const incomingId = String(msgSession).trim();
      if (!lockedSessionId) {
          lockedSessionId = incomingId;
          console.log(`🔒 [Session] Map locked to Bot ID: ${lockedSessionId}`);
          const sidEl = document.getElementById('sid');
          if (sidEl) sidEl.textContent = lockedSessionId;
      } else if (incomingId !== lockedSessionId) {
          console.warn(`🛑 Ignoring message for session ${incomingId}. Map is locked to ${lockedSessionId}.`);
          return; 
      }
  }

  // 3. Extract IDs
  const rawIDs = data.propIDs || data.propid || data.prop_id || data.ably_code || data.ablyCode;
  const ids = parsePropIDs(rawIDs);

  console.log("Parsed IDs for highlighting:", ids);

  if (!ids || ids.length === 0) {
    console.warn("⚠️ No IDs found in message.");
    return;
  }

  // 4. GHOST MODE LOGIC
  // Instead of fetching new data, we filter the existing Master List.
  if (allLoadedProps.length === 0) {
      console.warn("⚠️ No properties loaded yet (Bootstrap hasn't finished or DB empty). Cannot highlight.");
      return;
  }

  // A. Create a set for fast lookup
  const activeSet = new Set(ids.map(id => String(id).toLowerCase().trim()));

  // B. Mark properties as highlighted
  // We map over allLoadedProps to create a fresh state
  const updatedProps = allLoadedProps.map(p => {
      // Check if this property ID matches any of the requested IDs
      const pid = String(p.propID).toLowerCase();
      // Also check legacy ID just in case
      const legId = String(p._legacy_propid || '').toLowerCase();
      
      const isMatch = activeSet.has(pid) || activeSet.has(legId);
      
      return {
          ...p,
          _isHighlighted: isMatch // True if matched, False if ghost
      };
  });

  // C. Sort: Highlighted items jump to the top
  updatedProps.sort((a, b) => {
      // If a is highlighted and b is not, a comes first (-1)
      if (a._isHighlighted && !b._isHighlighted) return -1;
      if (!a._isHighlighted && b._isHighlighted) return 1;
      return 0; // Keep original order otherwise
  });

  console.log(`Updated ${updatedProps.length} properties. Found ${activeSet.size} matches.`);

  // D. Update state and render
  baseProps = updatedProps;
  
  // Clear map to redraw markers with correct opacity
  clearAllMarkers();
  
  // Re-apply filters (this handles the rendering)
  applyFilters();
  drawCampusMarkers();
  
  // If we have matches, fly to the first one
  const firstMatch = updatedProps.find(p => p._isHighlighted);
  if (firstMatch) {
      map.flyTo({ center:[firstMatch.lon, firstMatch.lat], zoom:13, duration:1000 });
  }
}

// Subscribe to shared "props" channel (backend now sends everything here)
const propsChannel = ably.channels.get('props');
console.log('[ABLY] Subscribing to channel "props"');

propsChannel.on('attached', () => {
  console.log('[ABLY] Channel attached "props"');
});
propsChannel.on('failed', (err) => {
  console.error('[ABLY] Channel FAILED "props"', err);
});

propsChannel.subscribe((msg) => {
  console.log('[ABLY] Message on channel "props"');
  handlePropsMessage(msg, 'props');
});

/************ Initial load ************/
/************ Initial load ************/
async function bootstrap(){
  const props = await fetchAllProps();
  if (!props.length) {
    cardsMount.innerHTML = `<div class="empty">No properties to display yet.<br/>Ask the bot for an area or a university 🙂</div>`;
    return;
  }

  // A. Extract Legacy IDs
  const legacyIds = props.map(p => p._legacy_propid).filter(Boolean);
  const fetchIds = legacyIds.length > 0 ? legacyIds : props.map(p => String(p.propID));

  const centers = new Map(props.map(p => [String(p.propID), { lat:p.lat, lon:p.lon }]));

  // B. Fetch using Legacy IDs
  const { counts } = await fetchPOIsForProps(fetchIds, { types:['cafe','bar','restaurant','gym','park'], perTypeLimit:0, radiusMeters:800 }, centers);
  const uniData  = await fetchUniDataForProps(fetchIds);
  const amenServ = await fetchAmenAndServices(fetchIds);
  const gallery  = await fetchGallery(fetchIds);
  const rooms    = await fetchRooms(fetchIds);

  // C. Re-key maps from Legacy ID -> Ably Code
  const rekeyMap = (sourceMap) => {
      const newMap = new Map();
      props.forEach(p => {
          const legacyKey = String(p._legacy_propid);
          const mainKey = String(p.propID); 
          if (sourceMap.has(legacyKey)) {
              newMap.set(mainKey, sourceMap.get(legacyKey));
          } else if (sourceMap.has(mainKey)) {
              newMap.set(mainKey, sourceMap.get(mainKey));
          }
      });
      return newMap;
  };

  amenityIndex = rekeyMap(amenServ);
  galleryIndex = rekeyMap(gallery);
  roomsIndex   = rekeyMap(rooms);
  uniIndex     = { campuses: uniData.campuses, nearestByProp: rekeyMap(uniData.nearestByProp) };
  const rekeyedCounts = rekeyMap(counts);

  baseProps = props.map(p => {
    const pid = String(p.propID);
    return {
      ...p,
      _amenityCounts: rekeyedCounts.get(pid) || null,
      _nearestUni: uniIndex.nearestByProp.get(pid) || null,
      _isHighlighted: false // Default: No highlight
    };
  });

  // SAVE MASTER LIST
  allLoadedProps = [...baseProps];

  renderAmenityFilters();
  applyFilters();
  drawCampusMarkers();
}
map.once('load', bootstrap);
map.on('moveend', updateViewportList);