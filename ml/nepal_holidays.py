"""
Nepal public holidays and festival dates for waste prediction feature engineering.
Covers 2024-2026 with major festivals that cause waste spikes.

Waste impact scale:
  - "major"    → 2x-3x waste spike (Dashain, Tihar, New Year celebrations)
  - "moderate" → 1.3x-1.8x spike (Holi, Chhath, Bisket Jatra)
  - "minor"    → 1.1x-1.3x spike (Buddha Jayanti, smaller holidays)
"""

from datetime import date

# ── Holiday definitions ──────────────────────────────────────────────────────
# Each entry: (date, name, impact)
# Nepal follows Bikram Sambat calendar — dates shift yearly in Gregorian

NEPAL_HOLIDAYS = [
    # ──── 2024 ────
    # Dashain (10-day festival, main days)
    (date(2024, 10, 3), "Ghatasthapana", "major"),
    (date(2024, 10, 10), "Fulpati", "major"),
    (date(2024, 10, 11), "Maha Ashtami", "major"),
    (date(2024, 10, 12), "Maha Navami", "major"),
    (date(2024, 10, 13), "Vijaya Dashami", "major"),
    (date(2024, 10, 14), "Ekadashi", "major"),
    (date(2024, 10, 15), "Dwadashi", "major"),
    (date(2024, 10, 17), "Kojagrat Purnima", "moderate"),

    # Tihar (5-day festival)
    (date(2024, 11, 1), "Kaag Tihar", "major"),
    (date(2024, 11, 2), "Kukur Tihar", "major"),
    (date(2024, 11, 3), "Laxmi Puja", "major"),
    (date(2024, 11, 4), "Govardhan Puja", "major"),
    (date(2024, 11, 5), "Bhai Tika", "major"),

    # Chhath
    (date(2024, 11, 7), "Chhath Parva", "moderate"),
    (date(2024, 11, 8), "Chhath Parva", "moderate"),

    # New Year & Others 2024
    (date(2024, 1, 15), "Maghe Sankranti", "moderate"),
    (date(2024, 1, 30), "Martyrs Day", "minor"),
    (date(2024, 2, 19), "Democracy Day", "minor"),
    (date(2024, 3, 8), "Maha Shivaratri", "moderate"),
    (date(2024, 3, 25), "Holi", "moderate"),
    (date(2024, 4, 14), "Nepali New Year (2081)", "major"),
    (date(2024, 5, 1), "May Day", "minor"),
    (date(2024, 5, 23), "Buddha Jayanti", "minor"),
    (date(2024, 8, 19), "Janai Purnima", "moderate"),
    (date(2024, 8, 26), "Krishna Janmashtami", "minor"),
    (date(2024, 9, 7), "Teej", "moderate"),
    (date(2024, 9, 17), "Indra Jatra", "moderate"),
    (date(2024, 12, 25), "Christmas", "minor"),

    # ──── 2025 ────
    # Dashain 2025
    (date(2025, 9, 22), "Ghatasthapana", "major"),
    (date(2025, 9, 29), "Fulpati", "major"),
    (date(2025, 9, 30), "Maha Ashtami", "major"),
    (date(2025, 10, 1), "Maha Navami", "major"),
    (date(2025, 10, 2), "Vijaya Dashami", "major"),
    (date(2025, 10, 3), "Ekadashi", "major"),
    (date(2025, 10, 4), "Dwadashi", "major"),
    (date(2025, 10, 6), "Kojagrat Purnima", "moderate"),

    # Tihar 2025
    (date(2025, 10, 20), "Kaag Tihar", "major"),
    (date(2025, 10, 21), "Kukur Tihar", "major"),
    (date(2025, 10, 22), "Laxmi Puja", "major"),
    (date(2025, 10, 23), "Govardhan Puja", "major"),
    (date(2025, 10, 24), "Bhai Tika", "major"),

    # Chhath 2025
    (date(2025, 10, 26), "Chhath Parva", "moderate"),
    (date(2025, 10, 27), "Chhath Parva", "moderate"),

    # Other 2025
    (date(2025, 1, 15), "Maghe Sankranti", "moderate"),
    (date(2025, 1, 30), "Martyrs Day", "minor"),
    (date(2025, 2, 19), "Democracy Day", "minor"),
    (date(2025, 2, 26), "Maha Shivaratri", "moderate"),
    (date(2025, 3, 14), "Holi", "moderate"),
    (date(2025, 4, 14), "Nepali New Year (2082)", "major"),
    (date(2025, 4, 18), "Bisket Jatra", "moderate"),
    (date(2025, 5, 1), "May Day", "minor"),
    (date(2025, 5, 12), "Buddha Jayanti", "minor"),
    (date(2025, 8, 9), "Janai Purnima", "moderate"),
    (date(2025, 8, 16), "Krishna Janmashtami", "minor"),
    (date(2025, 8, 26), "Teej", "moderate"),
    (date(2025, 9, 5), "Indra Jatra", "moderate"),
    (date(2025, 12, 25), "Christmas", "minor"),

    # ──── 2026 ────
    # Dashain 2026
    (date(2026, 10, 12), "Ghatasthapana", "major"),
    (date(2026, 10, 19), "Fulpati", "major"),
    (date(2026, 10, 20), "Maha Ashtami", "major"),
    (date(2026, 10, 21), "Maha Navami", "major"),
    (date(2026, 10, 22), "Vijaya Dashami", "major"),
    (date(2026, 10, 23), "Ekadashi", "major"),
    (date(2026, 10, 24), "Dwadashi", "major"),

    # Tihar 2026
    (date(2026, 11, 8), "Kaag Tihar", "major"),
    (date(2026, 11, 9), "Kukur Tihar", "major"),
    (date(2026, 11, 10), "Laxmi Puja", "major"),
    (date(2026, 11, 11), "Govardhan Puja", "major"),
    (date(2026, 11, 12), "Bhai Tika", "major"),

    # Other 2026
    (date(2026, 1, 15), "Maghe Sankranti", "moderate"),
    (date(2026, 3, 4), "Holi", "moderate"),
    (date(2026, 3, 17), "Maha Shivaratri", "moderate"),
    (date(2026, 4, 14), "Nepali New Year (2083)", "major"),
    (date(2026, 5, 1), "May Day", "minor"),
    (date(2026, 5, 31), "Buddha Jayanti", "minor"),
]


def get_holiday_dates():
    """Return set of all holiday dates for fast lookup."""
    return {h[0] for h in NEPAL_HOLIDAYS}


def get_holiday_info(target_date):
    """
    Get holiday info for a specific date.
    Returns: (name, impact) or (None, None) if not a holiday.
    """
    for h_date, name, impact in NEPAL_HOLIDAYS:
        if h_date == target_date:
            return name, impact
    return None, None


def get_holiday_impact_multiplier(target_date):
    """
    Get waste multiplier based on holiday proximity.
    - On a major holiday: 2.5x
    - On a moderate holiday: 1.5x
    - On a minor holiday: 1.2x
    - 1-2 days before/after major: 1.8x
    - 1-2 days before/after moderate: 1.3x
    - Otherwise: 1.0x
    """
    _, impact = get_holiday_info(target_date)

    if impact == "major":
        return 2.5
    elif impact == "moderate":
        return 1.5
    elif impact == "minor":
        return 1.2

    # Check proximity to holidays (1-2 days before/after)
    holiday_dates = get_holiday_dates()
    for delta in [1, 2]:
        from datetime import timedelta
        for nearby in [target_date - timedelta(days=delta), target_date + timedelta(days=delta)]:
            if nearby in holiday_dates:
                _, nearby_impact = get_holiday_info(nearby)
                if nearby_impact == "major":
                    return 1.8
                elif nearby_impact == "moderate":
                    return 1.3

    return 1.0


def days_to_nearest_holiday(target_date):
    """Return number of days to the nearest holiday (0 if today is a holiday)."""
    holiday_dates = sorted(get_holiday_dates())
    min_dist = 365

    for h_date in holiday_dates:
        dist = abs((h_date - target_date).days)
        if dist < min_dist:
            min_dist = dist

    return min_dist
