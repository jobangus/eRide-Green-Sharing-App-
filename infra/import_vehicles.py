#!/usr/bin/env python3
"""
Import vehicle CO2 data from the Green Vehicle Guide CSV into the vehicles table.

Usage:
    python import_vehicles.py <path-to-csv>

The CSV is tab-separated with headers matching the Green Vehicle Guide format.
"""

import csv
import os
import sys
import uuid
import psycopg

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://moride:moride_secret@localhost:5432/moride"
)


def parse_int(val):
    try:
        return int(float(val.strip())) if val and val.strip() else None
    except (ValueError, AttributeError):
        return None


def parse_float(val):
    try:
        return float(val.strip()) if val and val.strip() else None
    except (ValueError, AttributeError):
        return None


def parse_str(val):
    s = val.strip() if val else None
    return s if s else None


def import_csv(csv_path: str):
    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    inserted = 0
    skipped = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=",")
        for row in reader:
            year = parse_int(row.get("ModelReleaseYear", ""))
            make = parse_str(row.get("Make", ""))
            model = parse_str(row.get("Model", ""))

            if not year or not make or not model:
                skipped += 1
                continue

            cur.execute(
                """INSERT INTO vehicles (
                    id, make, model, year, variant, fuel_type, body_style,
                    transmission, engine_displacement, engine_cylinders,
                    engine_induction, co2_combined_g_per_km, co2_urban_g_per_km,
                    co2_extra_urban_g_per_km, fuel_consumption_combined, seating_capacity
                ) VALUES (
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                )""",
                (
                    str(uuid.uuid4()),
                    make,
                    model,
                    year,
                    parse_str(row.get("Variant", "")),
                    parse_str(row.get("FuelType", "")),
                    parse_str(row.get("BodyStyle", "")),
                    parse_str(row.get("TransmissionTypeDescription", "")),
                    parse_float(row.get("EngineDisplacement", "")),
                    parse_str(row.get("EngineConfiguration", "")),
                    parse_str(row.get("EngineInduction", "")),
                    parse_int(row.get("CO2EmissionsCombined", "")),
                    parse_int(row.get("CO2EmissionsUrban", "")),
                    parse_int(row.get("CO2EmissionsExtraUrban", "")),
                    parse_float(row.get("FuelConsumptionCombined", "")),
                    parse_int(row.get("SeatingCapacity", "")),
                ),
            )
            inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Done: {inserted} vehicles inserted, {skipped} rows skipped.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-csv>")
        sys.exit(1)
    import_csv(sys.argv[1])