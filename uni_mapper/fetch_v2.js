const queryOverpass = require('query-overpass');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
// Switching to Kumi Systems mirror which is reliable for batch queries
const API_OPTIONS = {
    overpassUrl: 'https://overpass.kumi.systems/api/interpreter'
};

const DELAY_MS = 10000; // 10 seconds wait between requests
const RETRY_DELAY_MS = 60000; // 60 seconds wait if we get blocked (429)

const OUTPUT_DIR = path.join(__dirname, 'campuses');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// --- THE LIST ---
const UNIVERSITIES = [
    // London & SE
    { id: 'imperial', name: 'Imperial College London', lat: 51.4988, lon: -0.1749 },
    { id: 'ucl', name: 'University College London', lat: 51.5246, lon: -0.1340 },
    { id: 'kcl', name: 'King\'s College London', lat: 51.5115, lon: -0.1160 },
    { id: 'lse', name: 'London School of Economics', lat: 51.5144, lon: -0.1165 },
    { id: 'royal_holloway', name: 'Royal Holloway', lat: 51.4257, lon: -0.5630 },
    { id: 'surrey', name: 'University of Surrey', lat: 51.2435, lon: -0.5895 },
    { id: 'southampton', name: 'University of Southampton', lat: 50.9353, lon: -1.3970 },
    { id: 'portsmouth', name: 'University of Portsmouth', lat: 50.7963, lon: -1.0965 },
    { id: 'sussex', name: 'University of Sussex', lat: 50.8671, lon: -0.0879 },
    { id: 'kent', name: 'University of Kent', lat: 51.2974, lon: 1.0697 },
    { id: 'reading', name: 'University of Reading', lat: 51.4418, lon: -0.9413 },
    { id: 'winchester', name: 'University of Winchester', lat: 51.0607, lon: -1.3263 },
    { id: 'oxford', name: 'University of Oxford', lat: 51.7548, lon: -1.2544 },
    // South West
    { id: 'bristol', name: 'University of Bristol', lat: 51.4584, lon: -2.6030 },
    { id: 'bath', name: 'University of Bath', lat: 51.3783, lon: -2.3262 },
    { id: 'exeter', name: 'University of Exeter', lat: 50.7371, lon: -3.5351 },
    { id: 'falmouth', name: 'Falmouth University', lat: 50.1581, lon: -5.0932 },
    { id: 'plymouth', name: 'University of Plymouth', lat: 50.3744, lon: -4.1396 },
    { id: 'gloucestershire', name: 'University of Gloucestershire', lat: 51.8906, lon: -2.0886 },
    { id: 'bournemouth', name: 'Bournemouth University', lat: 50.7431, lon: -1.8967 },
    // Midlands
    { id: 'birmingham', name: 'University of Birmingham', lat: 52.4508, lon: -1.9305 },
    { id: 'warwick', name: 'University of Warwick', lat: 52.3793, lon: -1.5615 },
    { id: 'nottingham', name: 'University of Nottingham', lat: 52.9378, lon: -1.1969 },
    { id: 'leicester', name: 'University of Leicester', lat: 52.6209, lon: -1.1246 },
    { id: 'lincoln', name: 'University of Lincoln', lat: 53.2285, lon: -0.5478 },
    { id: 'derby', name: 'University of Derby', lat: 52.9377, lon: -1.4967 },
    { id: 'staffordshire', name: 'Staffordshire University', lat: 53.0097, lon: -2.1748 },
    // North
    { id: 'manchester', name: 'University of Manchester', lat: 53.4668, lon: -2.2331 },
    { id: 'leeds', name: 'University of Leeds', lat: 53.8068, lon: -1.5550 },
    { id: 'liverpool', name: 'University of Liverpool', lat: 53.4056, lon: -2.9644 },
    { id: 'sheffield', name: 'University of Sheffield', lat: 53.3814, lon: -1.4884 },
    { id: 'york', name: 'University of York', lat: 53.9463, lon: -1.0532 },
    { id: 'newcastle', name: 'Newcastle University', lat: 54.9783, lon: -1.6178 },
    { id: 'durham', name: 'Durham University', lat: 54.7675, lon: -1.5714 },
    { id: 'lancaster', name: 'Lancaster University', lat: 54.0104, lon: -2.7877 },
    { id: 'chester', name: 'University of Chester', lat: 53.1994, lon: -2.8944 },
    // Scotland
    { id: 'edinburgh', name: 'University of Edinburgh', lat: 55.9442, lon: -3.1884 },
    { id: 'glasgow', name: 'University of Glasgow', lat: 55.8722, lon: -4.2882 },
    { id: 'aberdeen', name: 'University of Aberdeen', lat: 57.1652, lon: -2.1026 },
    { id: 'dundee', name: 'University of Dundee', lat: 56.4623, lon: -2.9814 },
    // Ireland / NI
    { id: 'trinity_dublin', name: 'Trinity College Dublin', lat: 53.3438, lon: -6.2546 },
    { id: 'queens_belfast', name: 'Queen\'s University Belfast', lat: 54.5846, lon: -5.9340 },
    { id: 'galway', name: 'University of Galway', lat: 53.2794, lon: -9.0627 },
    { id: 'ucc_cork', name: 'University College Cork', lat: 51.8923, lon: -8.4927 }
];

// --- HELPER FUNCTION: SLEEP ---
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- THE WORKER ---
async function fetchWithRetry(uni, attempt = 1) {
    if (attempt > 3) {
        console.log(`[${uni.id}] ❌ Failed after 3 attempts. Skipping.`);
        return;
    }

    console.log(`[${uni.id}] ⏳ Fetching (Attempt ${attempt})...`);

    // IMPROVED QUERY:
    // 1. Find the university campus area (relation/way) OR
    // 2. Find buildings owned by the university OR
    // 3. Find buildings strictly tagged as university
    const query = `
        [out:json][timeout:90];
        (
          way["amenity"="university"](around:1000, ${uni.lat}, ${uni.lon});
          relation["amenity"="university"](around:1000, ${uni.lat}, ${uni.lon});
        )->.campus;
        (
          way(area.campus)["building"];
          way["building"]["amenity"="university"](around:1500, ${uni.lat}, ${uni.lon});
          way["building"]["operator"~"${uni.name}",i](around:1500, ${uni.lat}, ${uni.lon});
        );
        out geom;
    `;

    return new Promise((resolve) => {
        queryOverpass(query, async (error, data) => {
            if (error) {
                // If Rate Limited (429) or Timeout (504), wait and retry
                if (error.statusCode === 429 || error.statusCode === 504) {
                    console.log(`[${uni.id}] ⚠️ Rate Limited/Timeout. Waiting 60s...`);
                    await wait(RETRY_DELAY_MS);
                    await fetchWithRetry(uni, attempt + 1);
                    resolve();
                } else {
                    console.log(`[${uni.id}] ❌ Error: ${error.message}`);
                    resolve();
                }
                return;
            }

            // Success handling
            if (data && data.features && data.features.length > 0) {
                data.features.forEach(f => {
                    f.properties.building_id = `${uni.id}_${f.id}`;
                    f.properties.university_id = uni.id;
                    f.properties.name = f.properties.name || "University Building";
                });
                const filePath = path.join(OUTPUT_DIR, `${uni.id}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data));
                console.log(`[${uni.id}] ✅ SUCCESS: Saved ${data.features.length} buildings.`);
            } else {
                console.log(`[${uni.id}] ⚠️ Query finished but found 0 buildings.`);
            }
            resolve();
        }, API_OPTIONS);
    });
}

// --- MAIN LOOP ---
async function runBatch() {
    console.log(`🚀 Starting batch download for ${UNIVERSITIES.length} universities...`);
    
    for (const uni of UNIVERSITIES) {
        await fetchWithRetry(uni);
        // Polite delay between successful requests
        await wait(DELAY_MS); 
    }
    
    console.log("🎉 All Done!");
}

runBatch();