"""Travel planning logic shared by the Flask app and the console demo."""

import json
import os
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
PLACES_FILE = PROJECT_DIR / "places.json"
MEMORY_FILE = PROJECT_DIR / "travel_memory.json"


def default_memory():
    return {"preferences": {}, "last_trip": {}}


def load_places():
    """Load the single local source of sample attraction data."""
    with PLACES_FILE.open("r", encoding="utf-8") as places_file:
        return json.load(places_file)


    PLACES = load_places()


def load_memory(memory_file=None):
    """Read travel memory safely, using defaults for missing or invalid JSON."""
    path = Path(memory_file) if memory_file else MEMORY_FILE
    try:
        with path.open("r", encoding="utf-8") as file:
            memory = json.load(file)
        if not isinstance(memory, dict):
            return default_memory()
        preferences = memory.get("preferences", {})
        last_trip = memory.get("last_trip", {})
        if not isinstance(preferences, dict) or not isinstance(last_trip, dict):
            return default_memory()
        return {"preferences": preferences, "last_trip": last_trip}
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return default_memory()


def save_memory(memory, memory_file=None):
    """Write memory atomically so an interrupted write will not corrupt JSON."""
    path = Path(memory_file) if memory_file else MEMORY_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_name(f"{path.name}.tmp")
    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(memory, file, indent=2, ensure_ascii=False)
    os.replace(temporary_path, path)


def generate_custom_places(destination, preference="Nature"):
    """Create a travel-ready sample plan when the user enters a custom destination."""
    preference_key = str(preference or "Nature").lower()
    templates = {
        "nature": [
            (f"Scenic Trail in {destination}", 350),
            (f"Lake View in {destination}", 220),
            (f"Forest Walk in {destination}", 180),
        ],
        "history": [
            (f"Historic District in {destination}", 300),
            (f"Museum Visit in {destination}", 260),
            (f"Old Town Walk in {destination}", 190),
        ],
        "relaxation": [
            (f"Sunset Point in {destination}", 280),
            (f"Spa Morning in {destination}", 240),
            (f"Cafe & Leisure Walk in {destination}", 170),
        ],
    }
    attractions = templates.get(preference_key, templates["nature"])
    return [{"name": name, "cost": cost, "open": True} for name, cost in attractions]


def search_places(destination, preference="Nature"):
    """Return attraction data for a known destination or a generated custom destination."""
    places = load_places()
    return places.get(destination, generate_custom_places(destination, preference))


def calculate_budget(places, days, budget):
    """Estimate attraction expenses and compare them with the entered budget."""
    attraction_cost = sum(place["cost"] for place in places)
    food_cost = days * 500
    transport_cost = days * 300
    total = attraction_cost + food_cost + transport_cost
    return {
        "attraction_cost": attraction_cost,
        "food_cost": food_cost,
        "transport_cost": transport_cost,
        "total": total,
        "budget": budget,
        "within_budget": total <= budget,
    }


def check_opening_status(place):
    """Return opening status from demonstration data, not live information."""
    return bool(place["open"])


def plan_trip(destination, days, budget, preference):
    """Create a budget-aware plan and a day-by-day sample itinerary."""
    all_places = search_places(destination, preference)
    available_places = [place.copy() for place in all_places if check_opening_status(place)]
    initial_budget = calculate_budget(available_places, days, budget)
    remaining_places = available_places.copy()
    removed_places = []
    final_budget = initial_budget.copy()

    while not final_budget["within_budget"] and remaining_places:
        removed = max(remaining_places, key=lambda place: place["cost"])
        if removed["cost"] == 0:
            break
        remaining_places.remove(removed)
        removed_places.append(removed)
        final_budget = calculate_budget(remaining_places, days, budget)

    itinerary = []
    for day_number in range(1, days + 1):
        if day_number <= len(remaining_places):
            place = remaining_places[day_number - 1]
            plan = {
                "day": day_number,
                "activity": f"Visit {place['name']}",
                "attraction": place["name"],
                "estimated_attraction_cost": place["cost"],
                "free_day": False,
            }
        else:
            plan = {
                "day": day_number,
                "activity": "Free exploration / rest day",
                "attraction": None,
                "estimated_attraction_cost": 0,
                "free_day": True,
            }
        itinerary.append(plan)

    return {
        "destination": destination,
        "days": days,
        "preference": preference,
        "attractions": all_places,
        "available_attractions": available_places,
        "planned_attractions": remaining_places,
        "removed_attractions": removed_places,
        "initial_budget": initial_budget,
        "budget_breakdown": final_budget,
        "estimated_total": final_budget["total"],
        "within_budget": final_budget["within_budget"],
        "itinerary": itinerary,
    }


def request_approval(action):
    """Ask for approval in the preserved command-line demonstration."""
    print("\nApproval required for:", action)
    answer = input("Do you approve? (yes/no): ").strip().lower()
    return answer == "yes"


def travel_agent(destination, days, budget, preference):
    """Run the original interactive-style console plan and approval flow."""
    plan = plan_trip(destination, days, budget, preference)
    print("\n===== TravelMate AI =====")
    print("Destination:", destination)
    print("Duration:", days, "days")
    print("Budget: Rs.", budget)
    print("Preference:", preference)
    print("\nStep 1: Sample attractions found")
    for place in plan["attractions"]:
        status = "Open in sample data" if place["open"] else "Closed in sample data"
        print(f"- {place['name']} — Rs. {place['cost']} — {status}")
    print("\nStep 2: Budget analysis")
    print("Initial estimate: Rs.", plan["initial_budget"]["total"])
    for place in plan["removed_attractions"]:
        print("Removed during replanning:", place["name"])
    for key in ("attraction_cost", "food_cost", "transport_cost", "total"):
        print(f"{key.replace('_', ' ').title()}: Rs. {plan['budget_breakdown'][key]}")
    print("\n===== FINAL ITINERARY =====")
    for day in plan["itinerary"]:
        print(f"Day {day['day']}: {day['activity']}")
    if plan["within_budget"]:
        print("Status: Within budget")
    else:
        print("Status: No feasible plan found; consider increasing the budget or changing trip details.")

    print("\nNo booking has been made.")
    if request_approval("Proceed with a real booking"):
        print("Approval received. Demo only: no booking or payment was made.")
    else:
        print("Booking not approved. No booking made.")

    memory = load_memory()
    memory["preferences"]["travel_style"] = preference
    memory["last_trip"] = {
        "destination": destination,
        "days": days,
        "budget": budget,
        "preference": preference,
        "estimated_cost": plan["estimated_total"],
    }
    save_memory(memory)
    print("\nMemory saved successfully.")
    return plan


if __name__ == "__main__":
    print("Welcome to TravelMate AI!")
    destination = input("Choose destination (Mysuru/Ooty): ").strip().title()
    days = int(input("Enter number of days: "))
    budget = int(input("Enter budget in rupees: "))
    preference = input("Enter preference (nature/history/relaxation): ").strip().title()
    travel_agent(destination, days, budget, preference)