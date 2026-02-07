import requests
import uuid
import time
from supabase import create_client, Client

# --- CONFIGURATION ---
SUPABASE_URL = 'https://ihcmbujuniueazzrehbp.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY21idWp1bml1ZWF6enJlaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY2NDM0NiwiZXhwIjoyMDgwMjQwMzQ2fQ.TTHl_u760k4A7MdYrGjskeb1ECzIuK6g4hnY5bJXSqs' # Must be the Service Role Key (starts with eyJ...)
GOOGLE_API_KEY = "AIzaSyDBeJDCQIVsYF7CmvKDjn4B-eXlhAz1voM"

# Search radius in meters (e.g., 1km)
RADIUS = 1000 

# Types of places to search for (Google Places API types)
SEARCH_TYPES = ["gym", "cafe", "bar", "restaurant", "park"]

# --- SETUP ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_properties():
    """Fetch all properties that need POIs"""
    print("📡 Fetching properties from Supabase...")
    # Select ID and coordinates. Capitalization matches your specific table setup.
    response = supabase.table("test_prop").select('propID, Lat, Long, property').execute()
    return response.data

def search_google_places(lat, lng, place_type):
    """Query Google Places API for a specific type near a location"""
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": RADIUS,
        "type": place_type,
        "key": GOOGLE_API_KEY
    }
    
    try:
        res = requests.get(url, params=params)
        data = res.json()
        if data.get('status') == 'OK':
            return data.get('results', [])
        else:
            print(f"   ⚠️ Google API Status: {data.get('status')}")
            return []
    except Exception as e:
        print(f"   ❌ API Request failed: {e}")
        return []

def run():
    props = get_properties()
    print(f"✅ Found {len(props)} properties. Starting POI search...")

    all_points = []
    
    # Loop through every property
    for i, p in enumerate(props):
        pid = p.get('propID')
        lat = p.get('Lat')
        lon = p.get('Long')
        name = p.get('property')

        if not lat or not lon:
            print(f"⏩ Skipping {name} (Missing Lat/Long)")
            continue

        print(f"📍 [{i+1}/{len(props)}] Searching near: {name} ({pid})")

        # Search for each type (Gym, Cafe, etc.)
        for p_type in SEARCH_TYPES:
            results = search_google_places(lat, lon, p_type)
            
            # Process up to 10 results per type to save DB space
            for place in results[:10]: 
                # Create a row matching your NEW google_points schema
                point = {
                    "uid2": str(uuid.uuid4()),        # Unique ID for Supabase
                    "uid": place.get("place_id"),     # Google's ID
                    "name": place.get("name"),
                    "address": place.get("vicinity"),
                    "type_single": p_type,            # e.g., 'gym'
                    "rating": place.get("rating"),
                    "lat": place["geometry"]["location"]["lat"],
                    "long": place["geometry"]["location"]["lng"],
                    "propid": str(pid),               # Link to the property
                    "business_status": place.get("business_status"),
                    "property": name                  # Helpful for the chatbot
                }
                all_points.append(point)
            
            # Sleep briefly to be nice to the API
            time.sleep(0.1)

    if not all_points:
        print("❌ No points found. Check your API key and quotas.")
        return

    print(f"\n🚀 Uploading {len(all_points)} POIs to Supabase...")

    # Upload in batches of 100
    batch_size = 100
    for i in range(0, len(all_points), batch_size):
        batch = all_points[i : i + batch_size]
        try:
            supabase.table("google_points").insert(batch).execute()
            print(f"   ✅ Uploaded batch {i} - {i + len(batch)}")
        except Exception as e:
            print(f"   ❌ Batch upload failed: {e}")

    print("\n✨ Done! Your map is now fully populated.")

if __name__ == "__main__":
    run()