const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ================= CONFIGURATION =================
const SUPABASE_URL = 'https://ihcmbujuniueazzrehbp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY21idWp1bml1ZWF6enJlaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY2NDM0NiwiZXhwIjoyMDgwMjQwMzQ2fQ.TTHl_u760k4A7MdYrGjskeb1ECzIuK6g4hnY5bJXSqs'; 
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYm9ic29uaXRlIiwiYSI6ImNtOXpyeWc1aDFlY24ya3M3dm55a2oyNDcifQ.8H2wkga07prlTm_YpOQicA';

const MAX_SEARCH_RADIUS = 5000; // 5km search radius

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= HELPER FUNCTIONS =================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Validates coordinates (Mapbox limits: Lat +/-90, Long +/-180)
function isValidCoordinate(lat, lng) {
    if (!lat || !lng) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
}

function getDirectDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2) * Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchWithRetry(url, retries = 3) {
    try {
        return await axios.get(url);
    } catch (error) {
        if (error.response && error.response.status === 429 && retries > 0) {
            console.warn(`   ⚠️ Rate Limit hit. Pausing 5 seconds...`);
            await sleep(5000);
            return fetchWithRetry(url, retries - 1);
        }
        throw error;
    }
}

async function getTravelMatrix(startLat, startLon, buildings) {
    const coordinates = [
        `${startLon},${startLat}`, 
        ...buildings.map(b => `${b.long},${b.lat}`)
    ].join(';');

    const sources = '0';
    const destinations = buildings.map((_, i) => i + 1).join(';');
    const results = {};
    const profiles = ['walking', 'cycling', 'driving'];

    for (const profile of profiles) {
        try {
            const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coordinates}?sources=${sources}&destinations=${destinations}&annotations=duration,distance&access_token=${MAPBOX_TOKEN}`;
            const res = await fetchWithRetry(url);
            
            res.data.durations[0].forEach((seconds, index) => {
                const buildingId = buildings[index].building_id;
                if (!results[buildingId]) results[buildingId] = {};
                
                results[buildingId][`time_${profile}`] = Math.round(seconds);
                if (profile === 'walking') {
                    results[buildingId]['distance_walking'] = Math.round(res.data.distances[0][index]);
                }
            });

        } catch (error) {
            // Enhanced Error Logging
            if (error.response && error.response.status === 422) {
                console.error(`   ❌ 422 Error (${profile}): Bad Coordinates. Checked: ${startLat},${startLon}`);
            } else {
                console.error(`   ❌ Failed ${profile}: ${error.message}`);
            }
        }
        await sleep(200); // Small delay between profiles
    }
    return results;
}

// ================= MAIN WORKER =================

async function runCalculation() {
    console.log("🚀 Starting Optimized Distance Calculation...");

    const { data: props, error: propError } = await supabase
        .from('test_prop')
        .select('propid, lat, long')
        .not('lat', 'is', null); // Initial filter for nulls

    if (propError) { console.error("DB Error (Props):", propError); return; }
    console.log(`📍 Loaded ${props.length} properties.`);

    const { data: buildings, error: buildError } = await supabase
        .from('university_buildings')
        .select('*');

    if (buildError) { console.error("DB Error (Buildings):", buildError); return; }
    console.log(`🏛️ Loaded ${buildings.length} university buildings.`);

    let totalSaved = 0;
    let skipped = 0;

    for (let i = 0; i < props.length; i++) {
        const prop = props[i];

        // 1. Validate Coordinate
        if (!isValidCoordinate(prop.lat, prop.long)) {
            console.warn(`[${i+1}/${props.length}] ⚠️ Prop ${prop.propid}: Invalid Coordinates (${prop.lat}, ${prop.long}). Skipping.`);
            skipped++;
            continue;
        }
        
        // 2. Filter Nearby Buildings
        const nearbyBuildings = buildings.filter(b => 
            getDirectDistance(prop.lat, prop.long, b.lat, b.long) < MAX_SEARCH_RADIUS
        );

        if (nearbyBuildings.length === 0) continue;

        console.log(`[${i+1}/${props.length}] Prop ${prop.propid}: Found ${nearbyBuildings.length} nearby. Calculating...`);

        // 3. Fetch Data
        const matrix = await getTravelMatrix(prop.lat, prop.long, nearbyBuildings);

        // 4. Transform for DB
        const rowsToInsert = nearbyBuildings.map(b => {
            const data = matrix[b.building_id];
            if (!data) return null;

            return {
                propid: prop.propid,
                university_id: b.university_id,
                building_id: b.building_id,
                lat: b.lat,
                long: b.long,
                distance_walking: data.distance_walking,
                time_walking: data.time_walking,
                time_cycling: data.time_cycling,
                time_transport: data.time_driving ? Math.round(data.time_driving * 1.2) : null
            };
        }).filter(row => row !== null);

        // 5. Save
        if (rowsToInsert.length > 0) {
            const { error } = await supabase
                .from('university_distances')
                .upsert(rowsToInsert, { onConflict: 'propid, building_id' });

            if (error) console.error("   ❌ Save Error:", error.message);
            else totalSaved += rowsToInsert.length;
        }

        // Reduced delay to 300ms (Safe but faster)
        await sleep(300);
    }

    console.log(`✅ JOB DONE. Calculated: ${totalSaved}. Skipped Invalid: ${skipped}.`);
}

runCalculation();