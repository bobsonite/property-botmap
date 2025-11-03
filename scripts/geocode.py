#!/usr/bin/env python3
import os, time, json, hashlib
import pandas as pd
import requests
from pathlib import Path

IN_CSV   = Path("data/processed/merged_properties.csv")   # or merged_rooms.csv
OUT_GJ   = Path("public/data/properties.geojson")         # change name if room-level
CACHE    = Path("data/cache/geocode_cache.json")
CACHE.parent.mkdir(parents=True, exist_ok=True)
OUT_GJ.parent.mkdir(parents=True, exist_ok=True)

TOKEN = os.environ.get("MAPBOX_TOKEN")
assert TOKEN, "Set MAPBOX_TOKEN env var"

def load_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    return {}

def save_cache(c):
    CACHE.write_text(json.dumps(c, indent=2))

def key_for(addr):
    return hashlib.sha1(addr.strip().lower().encode("utf-8")).hexdigest()

def geocode(addr, cache):
    k = key_for(addr)
    if k in cache: return cache[k]
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(addr)}.json"
    r = requests.get(url, params={"access_token": TOKEN, "limit": 1})
    r.raise_for_status()
    data = r.json()
    feat = data["features"][0] if data.get("features") else None
    if feat:
        lng, lat = feat["center"]
        cache[k] = {"lat": lat, "lng": lng}
    else:
        cache[k] = None
    time.sleep(0.1)  # be gentle
    return cache[k]

def main():
    df = pd.read_csv(IN_CSV)
    df["address"] = df["address"].astype(str).str.strip()
    cache = load_cache()
    features = []

    for _, row in df.iterrows():
        addr = row["address"]
        if not addr: continue
        loc = geocode(addr, cache)
        if not loc: continue
        props = row.to_dict()
        # keep only useful numbers as numbers
        for col in ["price_pcm_min","price_pcm_min_available","price_pcm","rooms_total","rooms_available"]:
            if col in props:
                try: props[col] = float(props[col])
                except: pass
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [loc["lng"], loc["lat"]]},
            "properties": props
        })

    save_cache(cache)
    gj = {"type": "FeatureCollection", "features": features}
    OUT_GJ.write_text(json.dumps(gj))
    print(f"✅ wrote {OUT_GJ} with {len(features)} features")

if __name__ == "__main__":
    main()