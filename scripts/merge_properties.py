#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
from unidecode import unidecode
import re

# ----------------- FILES (your exact names) -----------------
RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
OUT = Path(__file__).resolve().parents[1] / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

FILES = {
    "properties": RAW / "properties_rows.csv",                        # master list
    "unis":       RAW / "universities_exploded_rows.csv",
    "amenities":  RAW / "amenities_exploded_rows.csv",
    "services":   RAW / "services_included_exploded_rows.csv",
    "prices":     RAW / "room_price_processed_rows.csv",
}

JOIN_PREF          = ["property", "source_uid", "name", "id", "uid"]
ADDRESS_CANDIDATES = ["address", "adress", "addr"]
NAME_CANDIDATES    = ["property", "name", "title"]

OUT_PROP  = OUT / "merged_properties.csv"  # 1 row per property
OUT_ROOMS = OUT / "merged_rooms.csv"       # 1 row per (property, room_type)
REPORT    = OUT / "merge_report.txt"
# ------------------------------------------------------------


def load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8", dtype=str, keep_default_na=False)
    df.columns = [c.strip().lower() for c in df.columns]
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].map(clean_text)
    return df


def clean_text(x):
    if x is None:
        return None
    s = str(x)
    if not s:
        return s
    replacements = {
        "Â": "", "â€™": "’", "â€˜": "‘", "â€œ": "“", "â€": "”",
        "â€“": "–", "â€”": "—", "â€¢": "•",
        "Ã©": "é", "Ã£": "ã", "Ã¡": "á", "Ã±": "ñ",
        "Ã¼": "ü", "Ã¶": "ö", "Ã¤": "ä", "Ã¢": "â",
        "Ã": "À", "‚Äì": "–", "‚Äô": "’", "‚Äú": "“", "‚Äù": "”",
        "‚Ä¢": "•", "â€": "'",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s


def pick_first(df: pd.DataFrame, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return None


def normalise_key(s: str) -> str | None:
    if s is None: return None
    s = unidecode(str(s)).strip().lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def add_join_key(df: pd.DataFrame):
    key = pick_first(df, JOIN_PREF)
    if not key:
        raise ValueError(f"No usable id in columns: {df.columns.tolist()}")
    df["join_key"] = df[key].map(normalise_key)
    return df, key


def aggregate_list(df: pd.DataFrame, value_col: str, out_name: str) -> pd.DataFrame:
    if df is None or value_col not in df.columns:
        return pd.DataFrame(columns=["join_key", f"{out_name}_str"])
    tmp = df[["join_key", value_col]].copy()
    tmp = tmp[(tmp["join_key"].notna()) & (tmp[value_col].astype(str).str.strip() != "")]
    if tmp.empty:
        return pd.DataFrame(columns=["join_key", f"{out_name}_str"])
    agg = (
        tmp.groupby("join_key")[value_col]
           .apply(lambda s: ", ".join(sorted(set(x.strip() for x in s if x.strip()))))
           .reset_index(name=f"{out_name}_str")
    )
    return agg


def aggregate_unis(df: pd.DataFrame) -> pd.DataFrame:
    if df is None:
        return pd.DataFrame(columns=["join_key", "universities_str", "public_transport_time_str"])
    uni_col  = "university"
    pt_col   = "public_transport_time" if "public_transport_time" in df.columns else None
    parts = []
    parts.append(aggregate_list(df, uni_col, "universities") if uni_col in df.columns
                 else pd.DataFrame(columns=["join_key","universities_str"]))
    parts.append(aggregate_list(df, pt_col, "public_transport_time") if pt_col
                 else pd.DataFrame(columns=["join_key","public_transport_time_str"]))
    out = parts[0]
    for p in parts[1:]:
        out = out.merge(p, on="join_key", how="outer")
    return out


def extras(aux_df, base_keys):
    if aux_df is None or aux_df.empty: return []
    aux_keys = set(aux_df["join_key"].dropna())
    return sorted(k for k in aux_keys - base_keys if k)


def main():
    report = []

    # 1) master properties
    props = load_csv(FILES["properties"])
    props, _ = add_join_key(props)

    addr_col = pick_first(props, ADDRESS_CANDIDATES)
    if not addr_col:
        raise ValueError("No address/adress column in properties_rows.csv")
    if addr_col != "address":
        props = props.rename(columns={addr_col: "address"})
        addr_col = "address"

    base_keys = set(props["join_key"].dropna())

    # 2) Load aux tables with consistent join_key
    def maybe_load(path):
        try:
            df = load_csv(path)
            df, _ = add_join_key(df)
            return df
        except FileNotFoundError:
            return None

    unis = maybe_load(FILES["unis"])
    am   = maybe_load(FILES["amenities"])
    sv   = maybe_load(FILES["services"])
    pr   = maybe_load(FILES["prices"])

    # mismatch report
    ex_u = extras(unis, base_keys)
    ex_a = extras(am,   base_keys)
    ex_s = extras(sv,   base_keys)
    ex_p = extras(pr,   base_keys)
    if any([ex_u, ex_a, ex_s, ex_p]):
        report.append("⚠️  Rows in aux tables reference properties NOT in properties_rows.csv:")
        if ex_u: report.append(f"  - universities_exploded_rows: {len(ex_u)} (e.g. {ex_u[:3]})")
        if ex_a: report.append(f"  - amenities_exploded_rows: {len(ex_a)} (e.g. {ex_a[:3]})")
        if ex_s: report.append(f"  - services_included_exploded_rows: {len(ex_s)} (e.g. {ex_s[:3]})")
        if ex_p: report.append(f"  - room_price_processed_rows: {len(ex_p)} (e.g. {ex_p[:3]})")
    else:
        report.append("✅ No mismatches detected.")

    # 3) Aggregations (property-level)
    unis_agg = aggregate_unis(unis)
    amenities_agg = aggregate_list(am, "amenity", "amenities")
    services_agg  = aggregate_list(sv, "service", "services_included")

    # 4) PROPERTY-LEVEL MERGE (as before)
    prop_lvl = (props
                .merge(unis_agg,     on="join_key", how="left")
                .merge(amenities_agg,on="join_key", how="left")
                .merge(services_agg, on="join_key", how="left"))

    # Drop blank addresses
    before = len(prop_lvl)
    prop_lvl["address"] = prop_lvl["address"].fillna("").astype(str).str.strip()
    prop_lvl = prop_lvl[prop_lvl["address"] != ""].copy()
    after = len(prop_lvl)
    report.append(f"🧹 Dropped {before - after} properties with empty address (property-level).")

    # Column order
    keep_first = [c for c in ["property","owner","property description","address","link"] if c in prop_lvl.columns]
    ordered = keep_first + [
        "universities_str", "public_transport_time_str",
        "amenities_str", "services_included_str"
    ]
    ordered = [c for c in ordered if c in prop_lvl.columns]
    remaining = [c for c in prop_lvl.columns if c not in ordered and c not in ("join_key",)]
    final_props = prop_lvl[ordered + remaining]
    final_props.to_csv(OUT_PROP, index=False)

    # 5) ROOM-LEVEL MERGE (❗️one row per room)
    if pr is not None and not pr.empty:
        pr2 = pr.copy()
        # normalise price & available
        pr2["price"] = pd.to_numeric(pr2.get("price", ""), errors="coerce")
        pr2["available_bool"] = pr2.get("available","").astype(str).str.upper().isin(["TRUE","T","YES","1"])

        # Minimal room fields to keep
        room_cols = ["join_key"]
        if "room_type" in pr2.columns: room_cols.append("room_type")
        room_cols += ["price", "available", "available_bool"]
        room_cols = [c for c in room_cols if c in pr2.columns]
        pr3 = pr2[room_cols].copy()

        # Attach property columns (property, owner, address, link, desc) + aggregates
        base_cols = ["join_key"] + [c for c in ["property","owner","property description","address","link"] if c in props.columns]
        props_min = props[base_cols].copy()

        room_join = (pr3.merge(props_min,  on="join_key", how="left")
                         .merge(unis_agg,   on="join_key", how="left")
                         .merge(amenities_agg, on="join_key", how="left")
                         .merge(services_agg,  on="join_key", how="left"))

        # Drop rows where address is blank (for geocoding sanity)
        before_r = len(room_join)
        room_join["address"] = room_join["address"].fillna("").astype(str).str.strip()
        room_join = room_join[room_join["address"] != ""].copy()
        after_r = len(room_join)
        report.append(f"🧹 Dropped {before_r - after_r} room rows with empty address (room-level).")

        # Final order
        room_first = [c for c in ["property","owner","address","link","property description"] if c in room_join.columns]
        room_fields = [c for c in ["room_type","price","available","available_bool"] if c in room_join.columns]
        agg_fields  = [c for c in ["universities_str","public_transport_time_str","amenities_str","services_included_str"] if c in room_join.columns]
        keep_rooms  = room_first + agg_fields + room_fields
        other_rooms = [c for c in room_join.columns if c not in keep_rooms and c != "join_key"]
        final_rooms = room_join[keep_rooms + other_rooms]

        final_rooms.rename(columns={"price":"price_pcm"}, inplace=True)
        final_rooms.to_csv(OUT_ROOMS, index=False)
    else:
        report.append("ℹ️ No room_price_processed_rows.csv data found; skipped room-level file.")

    # 6) Report
    REPORT.write_text("\n".join(report), encoding="utf-8")
    print(f"✅ Wrote {OUT_PROP}")
    if OUT_ROOMS.exists():
        print(f"✅ Wrote {OUT_ROOMS}")
    print(f"📝 Report: {REPORT}")


if __name__ == "__main__":
    main()