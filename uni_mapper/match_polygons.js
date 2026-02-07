const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const distance = require('@turf/distance').default;
const centroid = require('@turf/centroid').default;
const { point } = require('@turf/helpers');

// --- CONFIG ---
const SUPABASE_URL = 'https://ihcmbujuniueazzrehbp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY21idWp1bml1ZWF6enJlaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY2NDM0NiwiZXhwIjoyMDgwMjQwMzQ2fQ.TTHl_u760k4A7MdYrGjskeb1ECzIuK6g4hnY5bJXSqs'; 
const CAMPUS_DIR = path.join(__dirname, 'campuses');
const MATCH_THRESHOLD_METERS = 50; // Max distance allowed to match a building

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMatchmaker() {
    console.log("💘 Starting Robust Matchmaking...");

    // 1. Fetch Golden Data
    const { data: goldenBuildings, error } = await supabase
        .from('university_buildings')
        .select('*');

    if (error) { console.error("DB Error:", error); return; }
    console.log(`Loaded ${goldenBuildings.length} golden buildings.`);

    // 2. Process Files
    const files = fs.readdirSync(CAMPUS_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
        const uniKey = file.replace('.json', '');
        
        // Filter DB for this uni
        const uniTargets = goldenBuildings.filter(b => b.university_id === uniKey);
        
        if (uniTargets.length === 0) continue;

        const filePath = path.join(CAMPUS_DIR, file);
        let geojson;
        try {
            geojson = JSON.parse(fs.readFileSync(filePath));
        } catch (e) { continue; }

        let matches = 0;

        // 3. Find the Nearest Polygon for each Golden Building
        for (const target of uniTargets) {
            const targetPoint = point([target.long, target.lat]);
            
            let bestMatch = null;
            let minDistance = Infinity;

            // Check every polygon in the file
            for (const feature of geojson.features) {
                // Only look at Polygons
                if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) continue;

                // Measure distance from Golden Point to Polygon Center
                const polyCenter = centroid(feature);
                const dist = distance(targetPoint, polyCenter, { units: 'kilometers' }) * 1000; // Convert to meters

                // If it's close and better than previous match, keep it
                if (dist < MATCH_THRESHOLD_METERS && dist < minDistance) {
                    minDistance = dist;
                    bestMatch = feature;
                }
            }

            // If we found a match within 50m, Update it!
            if (bestMatch) {
                bestMatch.properties.building_id = target.building_id;
                bestMatch.properties.name = target.name;
                bestMatch.properties.subjects = target.subjects;
                bestMatch.properties.is_key_building = true;
                
                // Style: Make matched buildings BRIGHTER
                bestMatch.properties['fill-opacity'] = 0.9;
                
                matches++;
            }
        }

        if (matches > 0) {
            fs.writeFileSync(filePath, JSON.stringify(geojson));
            console.log(`✅ [${uniKey}] Matched ${matches}/${uniTargets.length} key buildings.`);
        } else {
            console.log(`⚠️ [${uniKey}] Still no matches (Try increasing radius?).`);
        }
    }
}

runMatchmaker();