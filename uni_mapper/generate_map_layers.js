const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const distance = require('@turf/distance').default;
const centroid = require('@turf/centroid').default;
const circle = require('@turf/circle').default;
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const { point } = require('@turf/helpers');

// --- CONFIG ---
const SUPABASE_URL = 'https://ihcmbujuniueazzrehbp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY21idWp1bml1ZWF6enJlaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY2NDM0NiwiZXhwIjoyMDgwMjQwMzQ2fQ.TTHl_u760k4A7MdYrGjskeb1ECzIuK6g4hnY5bJXSqs'; 

const RAW_DIR = path.join(__dirname, 'campuses'); 
const OUT_DIR = path.join(__dirname, 'final_maps');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateLayers() {
    console.log("🎨 Starting Smart Map Generation...");

    const { data: goldenBuildings, error } = await supabase.from('university_buildings').select('*');
    if (error) { console.error("DB Error:", error); return; }
    console.log(`Loaded ${goldenBuildings.length} Golden Buildings.`);

    const uniGroups = {};
    goldenBuildings.forEach(b => {
        if (!uniGroups[b.university_id]) uniGroups[b.university_id] = [];
        uniGroups[b.university_id].push(b);
    });

    for (const [uniKey, targets] of Object.entries(uniGroups)) {
        let rawFeatures = [];
        try {
            const rawPath = path.join(RAW_DIR, `${uniKey}.json`);
            if (fs.existsSync(rawPath)) {
                rawFeatures = JSON.parse(fs.readFileSync(rawPath)).features || [];
            }
        } catch (e) { }

        const finalFeatures = [];
        let polygonCount = 0;
        let circleCount = 0;

        for (const target of targets) {
            const targetPoint = point([target.long, target.lat]);
            let bestPoly = null;
            let minDistance = 150; // Increased tolerance to 150 meters

            // --- STRATEGY 1: EXACT MATCH (Is Point Inside?) ---
            for (const feature of rawFeatures) {
                if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') continue;
                if (booleanPointInPolygon(targetPoint, feature)) {
                    bestPoly = feature;
                    minDistance = 0; // It's inside, distance is zero
                    break; 
                }
            }

            // --- STRATEGY 2: NEARBY MATCH (If not inside, is it close?) ---
            if (!bestPoly) {
                for (const feature of rawFeatures) {
                    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') continue;
                    
                    const polyCenter = centroid(feature);
                    const d = distance(targetPoint, polyCenter, { units: 'kilometers' }) * 1000;
                    
                    // If matches, verify name similarity (Optional advanced step) or just trust distance
                    if (d < minDistance) {
                        minDistance = d;
                        bestPoly = feature;
                    }
                }
            }

            let finalFeature;
            if (bestPoly) {
                finalFeature = bestPoly;
                polygonCount++;
            } else {
                // FALLBACK: Circle
                finalFeature = circle(targetPoint, 0.04, { steps: 64, units: 'kilometers' });
                circleCount++;
            }

            // Inject Data
            finalFeature.properties = {
                building_id: target.building_id,
                name: target.name,
                subjects: target.subjects,
                university_id: target.university_id,
                type: 'academic_building'
            };

            finalFeatures.push(finalFeature);
        }

        const outputGeoJSON = { type: "FeatureCollection", features: finalFeatures };
        fs.writeFileSync(path.join(OUT_DIR, `${uniKey}.json`), JSON.stringify(outputGeoJSON));
        
        console.log(`✅ [${uniKey}] Footprints: ${polygonCount}, Circles: ${circleCount}`);
    }
}

generateLayers();