"""
Synthetic waste data generator for Kathmandu Valley districts.
Generates ~14,600 records (20 areas x 365 days x 2 years) with
realistic patterns for Nepal context.
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta
from nepal_holidays import (
    get_holiday_info,
    get_holiday_impact_multiplier,
    days_to_nearest_holiday,
)

# ── Random seed for reproducibility ──────────────────────────────────────────
np.random.seed(42)

# ── District definitions ─────────────────────────────────────────────────────
# Nepal-context: Kathmandu Valley municipalities and areas
DISTRICTS = {
    # ── Kathmandu (8 areas) ──────────────────────────────────────────────────
    "Kathmandu-Core": {
        "type": "commercial",
        "base_waste_kg": 4500,   # Dense commercial hub (New Road, Thamel, Asan)
        "weekend_effect": -0.15,
        "monsoon_effect": -0.25,
    },
    "Baneshwor": {
        "type": "commercial",
        "base_waste_kg": 3600,   # Major commercial zone, offices, banks
        "weekend_effect": -0.12,
        "monsoon_effect": -0.20,
    },
    "Koteshwor": {
        "type": "commercial",
        "base_waste_kg": 3400,   # Transport hub, markets
        "weekend_effect": -0.10,
        "monsoon_effect": -0.18,
    },
    "Balaju": {
        "type": "residential",
        "base_waste_kg": 2200,   # Industrial park + residential
        "weekend_effect": 0.15,
        "monsoon_effect": -0.12,
    },
    "Maharajgunj": {
        "type": "residential",
        "base_waste_kg": 2000,   # Embassies, hospitals, residential
        "weekend_effect": 0.10,
        "monsoon_effect": -0.10,
    },
    "Budhanilkantha": {
        "type": "suburban",
        "base_waste_kg": 1200,   # Suburban, schools, embassies
        "weekend_effect": 0.10,
        "monsoon_effect": -0.15,
    },
    "Tokha": {
        "type": "suburban",
        "base_waste_kg": 1000,   # Developing suburban area
        "weekend_effect": 0.10,
        "monsoon_effect": -0.15,
    },
    "Chandragiri": {
        "type": "rural",
        "base_waste_kg": 600,    # Semi-rural, hilly
        "weekend_effect": 0.05,
        "monsoon_effect": -0.20,
    },
    # ── Lalitpur (7 areas) ───────────────────────────────────────────────────
    "Lalitpur": {
        "type": "commercial",
        "base_waste_kg": 3800,   # Patan — mix of commercial + heritage
        "weekend_effect": -0.10,
        "monsoon_effect": -0.20,
    },
    "Satdobato": {
        "type": "commercial",
        "base_waste_kg": 3000,   # Ring road junction, markets
        "weekend_effect": -0.08,
        "monsoon_effect": -0.18,
    },
    "Kirtipur": {
        "type": "residential",
        "base_waste_kg": 1800,   # University area + residential
        "weekend_effect": 0.20,
        "monsoon_effect": -0.10,
    },
    "Imadol": {
        "type": "residential",
        "base_waste_kg": 1600,   # Growing residential suburb
        "weekend_effect": 0.18,
        "monsoon_effect": -0.12,
    },
    "Lubhu": {
        "type": "suburban",
        "base_waste_kg": 900,    # Small town, weaving industry
        "weekend_effect": 0.08,
        "monsoon_effect": -0.15,
    },
    "Godawari": {
        "type": "rural",
        "base_waste_kg": 500,    # Rural, botanical garden area
        "weekend_effect": 0.15,
        "monsoon_effect": -0.15,
    },
    "Dakshinkali": {
        "type": "rural",
        "base_waste_kg": 400,    # Remote, temple area
        "weekend_effect": 0.25,  # Saturday temple visits = waste spike
        "monsoon_effect": -0.20,
    },
    # ── Bhaktapur (5 areas) ──────────────────────────────────────────────────
    "Bhaktapur": {
        "type": "commercial",
        "base_waste_kg": 3200,   # Tourism + pottery + commercial
        "weekend_effect": 0.10,
        "monsoon_effect": -0.30,
    },
    "Madhyapur Thimi": {
        "type": "residential",
        "base_waste_kg": 2000,   # Growing residential area
        "weekend_effect": 0.15,
        "monsoon_effect": -0.10,
    },
    "Suryabinayak": {
        "type": "suburban",
        "base_waste_kg": 1100,   # Temple area + suburban growth
        "weekend_effect": 0.12,
        "monsoon_effect": -0.15,
    },
    "Changunarayan": {
        "type": "rural",
        "base_waste_kg": 550,    # UNESCO heritage, rural surroundings
        "weekend_effect": 0.20,
        "monsoon_effect": -0.18,
    },
    "Nagarkot": {
        "type": "rural",
        "base_waste_kg": 350,    # Hill station, tourism-dependent
        "weekend_effect": 0.30,  # Weekend tourists
        "monsoon_effect": -0.35, # Very few visitors in monsoon
    },
}

# ── Nepal seasons ────────────────────────────────────────────────────────────
def get_season(month):
    """Nepal seasonal classification."""
    if month in [6, 7, 8, 9]:       # June-Sept: Monsoon (Barkha)
        return "monsoon"
    elif month in [10, 11, 12]:      # Oct-Dec: Autumn/Early Winter (Sharad/Hemanta)
        return "autumn"
    elif month in [1, 2]:            # Jan-Feb: Winter (Shishir)
        return "winter"
    else:                            # Mar-May: Spring/Pre-monsoon (Basanta/Grishma)
        return "spring"


def is_monsoon(month):
    return month in [6, 7, 8, 9]


# ── Season waste multiplier ─────────────────────────────────────────────────
def season_multiplier(month):
    """
    Seasonal effect on waste beyond monsoon.
    Spring festivals + warm weather = more waste.
    Winter = slightly less.
    """
    multipliers = {
        1: 0.90,   # Cold January
        2: 0.92,   # Still cold
        3: 1.05,   # Holi season, warming up
        4: 1.10,   # New Year celebrations, spring
        5: 1.05,   # Warming up
        6: 0.85,   # Monsoon starts
        7: 0.80,   # Peak monsoon
        8: 0.82,   # Monsoon continues
        9: 0.88,   # Monsoon ending, Teej
        10: 1.15,  # Dashain! Post-monsoon cleanup
        11: 1.10,  # Tihar, Chhath
        12: 0.95,  # Cooling down
    }
    return multipliers.get(month, 1.0)


# ── Data generation ──────────────────────────────────────────────────────────
def generate_dataset(start_date=date(2024, 1, 1), end_date=date(2025, 12, 31)):
    """
    Generate synthetic daily waste data for all districts.
    Returns a pandas DataFrame.
    """
    records = []

    current = start_date
    while current <= end_date:
        day_of_week = current.weekday()       # 0=Monday, 6=Sunday
        month = current.month
        is_weekend = 1 if day_of_week >= 5 else 0
        season = get_season(month)

        # Holiday info
        holiday_name, holiday_impact = get_holiday_info(current)
        is_holiday = 1 if holiday_name else 0
        holiday_multiplier = get_holiday_impact_multiplier(current)
        holiday_proximity = days_to_nearest_holiday(current)

        for district_name, config in DISTRICTS.items():
            base = config["base_waste_kg"]

            # 1. Apply seasonal multiplier
            waste = base * season_multiplier(month)

            # 2. Apply monsoon effect (district-specific)
            if is_monsoon(month):
                waste *= (1 + config["monsoon_effect"])

            # 3. Apply weekend effect (district-specific)
            if is_weekend:
                waste *= (1 + config["weekend_effect"])

            # 4. Apply holiday multiplier
            waste *= holiday_multiplier

            # 5. Day-of-week variation (slight patterns)
            # Fridays tend to have more waste (pre-weekend shopping)
            if day_of_week == 4:  # Friday
                waste *= 1.08
            elif day_of_week == 0:  # Monday
                waste *= 0.95

            # 6. Add realistic noise (10-15% variation)
            noise = np.random.normal(1.0, 0.12)
            noise = max(0.7, min(1.3, noise))  # Clamp to avoid extremes
            waste *= noise

            # 7. Floor at 0, round to 1 decimal
            waste = max(0, round(waste, 1))

            records.append({
                "district": district_name,
                "date": current.isoformat(),
                "day_of_week": day_of_week,
                "month": month,
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "holiday_name": holiday_name or "",
                "holiday_proximity": holiday_proximity,
                "season": season,
                "district_type": config["type"],
                "waste_kg": waste,
            })

        current += timedelta(days=1)

    df = pd.DataFrame(records)
    return df


def save_dataset(output_path="./data/kathmandu_waste_data.csv"):
    """Generate and save dataset to CSV."""
    print("Generating synthetic waste data for Kathmandu Valley...")
    df = generate_dataset()

    print(f"  Total records: {len(df)}")
    print(f"  Date range: {df['date'].min()} to {df['date'].max()}")
    print(f"  Districts: {df['district'].nunique()}")
    print(f"\n  Waste stats by district type:")
    print(df.groupby("district_type")["waste_kg"].describe().round(1).to_string())

    df.to_csv(output_path, index=False)
    print(f"\n  Saved to {output_path}")
    return df


if __name__ == "__main__":
    save_dataset()
