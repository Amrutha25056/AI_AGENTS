"""Flask routes for the local TravelMate AI trip planner."""

import math
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

import travel_agent


PROJECT_DIR = Path(__file__).resolve().parent
DESTINATIONS = {"Mysuru", "Ooty"}
PREFERENCES = {"Nature", "History", "Relaxation"}
app = Flask(__name__)


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/destinations")
def get_destinations():
    try:
        return jsonify(travel_agent.load_places())
    except (OSError, ValueError):
        app.logger.exception("Could not load local destination data")
        return jsonify({"error": "Sample destination data is unavailable."}), 500


@app.get("/api/memory")
def get_memory():
    return jsonify(travel_agent.load_memory())


def validate_trip(payload):
    errors = {}
    if not isinstance(payload, dict):
        return {"request": "Send trip details as a JSON object."}

    destination = payload.get("destination")
    days = payload.get("days")
    budget = payload.get("budget")
    preference = payload.get("preference")

    if not isinstance(destination, str) or not destination.strip():
        errors["destination"] = "Enter a destination name."
    if isinstance(days, bool) or not (isinstance(days, int) or (isinstance(days, str) and days.isdigit())):
        errors["days"] = "Days must be a positive whole number."
    elif int(days) <= 0 or int(days) > 60:
        errors["days"] = "Choose a trip length from 1 to 60 days."
    valid_budget = isinstance(budget, (int, float)) and not isinstance(budget, bool)
    if valid_budget:
        try:
            valid_budget = math.isfinite(float(budget)) and budget >= 0
        except (OverflowError, TypeError, ValueError):
            valid_budget = False
    if not valid_budget:
        errors["budget"] = "Enter a valid, non-negative budget in rupees."
    if not isinstance(preference, str) or preference not in PREFERENCES:
        errors["preference"] = "Choose Nature, History, or Relaxation."
    return errors


@app.post("/api/plan")
def create_plan():
    payload = request.get_json(silent=True)
    errors = validate_trip(payload)
    if errors:
        return jsonify({"error": "Please correct the trip details.", "fields": errors}), 400

    try:
        days = int(payload["days"])
        destination = str(payload["destination"]).strip()
        plan = travel_agent.plan_trip(destination, days, payload["budget"], payload["preference"])
        memory = travel_agent.load_memory()
        memory["preferences"]["travel_style"] = payload["preference"]
        memory["last_trip"] = {
            "destination": plan["destination"],
            "days": plan["days"],
            "budget": plan["budget_breakdown"]["budget"],
            "preference": plan["preference"],
            "estimated_cost": plan["estimated_total"],
        }
        travel_agent.save_memory(memory)
        return jsonify(plan)
    except (OSError, ValueError):
        app.logger.exception("Could not create or save the trip plan")
        return jsonify({"error": "The trip could not be saved. Please try again."}), 500


@app.post("/api/booking-approval")
def booking_approval():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("approved"), bool):
        return jsonify({"error": "Choose yes or no for the demo approval decision."}), 400
    if payload["approved"]:
        return jsonify({
            "approved": True,
            "message": "Demo approval recorded. No reservation, payment, or external action was made.",
        })
    return jsonify({"approved": False, "message": "Demo approval declined. No booking was made."})


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "API endpoint not found."}), 404
    return "Page not found", 404


@app.errorhandler(Exception)
def unexpected_error(error):
    if isinstance(error, HTTPException):
        return error
    app.logger.exception("Unexpected application error")
    if request.path.startswith("/api/"):
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 500
    return "An unexpected error occurred. Please try again.", 500


if __name__ == "__main__":
    app.run(debug=True)