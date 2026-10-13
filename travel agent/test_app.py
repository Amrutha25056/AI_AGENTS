"""Automated API and memory tests for TravelMate AI."""

import json
import tempfile
import unittest
from pathlib import Path

import app as travel_app
import travel_agent


class TravelMateApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.original_memory_file = travel_agent.MEMORY_FILE
        travel_agent.MEMORY_FILE = Path(self.temp_directory.name) / "travel_memory.json"
        travel_app.app.config.update(TESTING=True)
        self.client = travel_app.app.test_client()

    def tearDown(self):
        travel_agent.MEMORY_FILE = self.original_memory_file
        self.temp_directory.cleanup()

    def plan(self, destination, days, budget, preference):
        return self.client.post("/api/plan", json={
            "destination": destination,
            "days": days,
            "budget": budget,
            "preference": preference,
        })

    def test_destinations_preserve_supplied_sample_data(self):
        destinations = self.client.get("/api/destinations").get_json()
        self.assertEqual(destinations["Mysuru"], [
            {"name": "Mysore Palace", "cost": 100, "open": True},
            {"name": "Brindavan Gardens", "cost": 50, "open": True},
            {"name": "Chamundi Hills", "cost": 0, "open": True},
        ])
        self.assertEqual(destinations["Ooty"][2], {"name": "Toy Train", "cost": 250, "open": False})

    def test_mysuru_plan_and_memory(self):
        response = self.plan("Mysuru", 2, 5000, "History")
        self.assertEqual(response.status_code, 200)
        plan = response.get_json()
        self.assertEqual(len(plan["attractions"]), 3)
        self.assertEqual(plan["initial_budget"]["attraction_cost"], 150)
        self.assertEqual(plan["initial_budget"]["food_cost"], 1000)
        self.assertEqual(plan["initial_budget"]["transport_cost"], 600)
        self.assertEqual(plan["estimated_total"], 1750)
        self.assertTrue(plan["within_budget"])
        self.assertEqual(len(plan["itinerary"]), 2)
        memory = self.client.get("/api/memory").get_json()
        self.assertEqual(memory["last_trip"]["destination"], "Mysuru")
        self.assertEqual(memory["last_trip"]["estimated_cost"], 1750)
        self.assertEqual(memory["preferences"]["travel_style"], "History")

    def test_ooty_plan_excludes_closed_toy_train(self):
        response = self.plan("Ooty", 2, 5000, "Nature")
        plan = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(plan["attractions"]), 3)
        self.assertEqual([place["name"] for place in plan["available_attractions"]], ["Botanical Garden", "Ooty Lake"])
        self.assertEqual(plan["estimated_total"], 1680)
        self.assertEqual(plan["budget_breakdown"]["attraction_cost"], 80)

    def test_custom_destination_plan_works_for_user_entry(self):
        response = self.plan("Paris", 3, 6000, "History")
        self.assertEqual(response.status_code, 200)
        plan = response.get_json()
        self.assertEqual(plan["destination"], "Paris")
        self.assertGreater(len(plan["attractions"]), 0)
        self.assertEqual(plan["days"], 3)
        self.assertIn("Paris", plan["itinerary"][0]["activity"] or "")

    def test_low_budget_removes_most_expensive_until_plan_still_infeasible(self):
        response = self.plan("Ooty", 2, 100, "Relaxation")
        plan = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(plan["initial_budget"]["total"], 1680)
        self.assertEqual([place["name"] for place in plan["removed_attractions"]], ["Botanical Garden", "Ooty Lake"])
        self.assertEqual(plan["estimated_total"], 1600)
        self.assertFalse(plan["within_budget"])
        self.assertEqual([day["free_day"] for day in plan["itinerary"]], [True, True])
        self.assertEqual(plan["budget_breakdown"]["budget"], 100)

    def test_invalid_and_malformed_requests_return_400(self):
        invalid_requests = [
            ({"destination": "", "days": 2, "budget": 5000, "preference": "Nature"}, None),
            ({"destination": "Mysuru", "days": 0, "budget": 5000, "preference": "Nature"}, None),
            ({"destination": "Mysuru", "days": -1, "budget": 5000, "preference": "Nature"}, None),
            ({"destination": "Mysuru", "days": 2, "budget": "nope", "preference": "Nature"}, None),
            ({"destination": "Mysuru", "days": 2, "budget": -1, "preference": "Nature"}, None),
            ({"destination": "   ", "days": 2, "budget": 5000, "preference": "Nature"}, None),
            ({"destination": [], "days": 2, "budget": 5000, "preference": {}}, None),
            ({"destination": "Mysuru"}, None),
            (None, "{not-json"),
        ]
        for payload, raw_data in invalid_requests:
            with self.subTest(payload=payload, raw_data=raw_data):
                if raw_data is None:
                    response = self.client.post("/api/plan", json=payload)
                else:
                    response = self.client.post("/api/plan", data=raw_data, content_type="application/json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.get_json())

    def test_missing_or_invalid_memory_uses_defaults(self):
        memory_path = Path(self.temp_directory.name) / "travel_memory.json"
        self.assertEqual(travel_agent.load_memory(), {"preferences": {}, "last_trip": {}})
        memory_path.write_text("not json", encoding="utf-8")
        self.assertEqual(travel_agent.load_memory(), {"preferences": {}, "last_trip": {}})
        self.assertEqual(memory_path.read_text(encoding="utf-8"), "not json")

    def test_booking_approval_is_demo_only(self):
        declined = self.client.post("/api/booking-approval", json={"approved": False})
        approved = self.client.post("/api/booking-approval", json={"approved": True})
        invalid = self.client.post("/api/booking-approval", json={})
        self.assertEqual(declined.status_code, 200)
        self.assertIn("No booking was made", declined.get_json()["message"])
        self.assertEqual(approved.status_code, 200)
        self.assertIn("No reservation, payment, or external action was made", approved.get_json()["message"])
        self.assertEqual(invalid.status_code, 400)


if __name__ == "__main__":
    unittest.main()