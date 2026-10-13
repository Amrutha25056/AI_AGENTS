import unittest

from app import app
from study_agent import generate_study_plan


class StudyPlanApiTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_subjects_endpoint_returns_original_choices(self):
        response = self.client.get("/api/subjects")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [subject["name"] for subject in response.json["subjects"]],
            ["OS", "DBMS", "JAVA", "PYTHON"],
        )

    def test_plan_endpoint_preserves_topic_order_and_revision_days(self):
        response = self.client.post(
            "/api/plan",
            json={"subjects": ["OS"], "days": 6, "hours_per_day": 0.5},
        )

        self.assertEqual(response.status_code, 200)
        schedule = response.json["plan"]["schedule"]
        topics = [task["topic"] for day in schedule[:4] for task in day["tasks"]]
        self.assertEqual(
            topics,
            ["Process Management", "CPU Scheduling", "Deadlocks", "Memory Management"],
        )
        self.assertTrue(all(day["tasks"][0]["kind"] == "revision" for day in schedule[4:]))
        self.assertTrue(all(day["tasks"][1]["kind"] == "practice" for day in schedule[4:]))

    def test_plan_endpoint_rejects_missing_and_invalid_values(self):
        invalid_requests = [
            {},
            {"subjects": ["Astronomy"], "days": 5, "hours_per_day": 2},
            {"subjects": ["OS"], "days": 0, "hours_per_day": 2},
            {"subjects": ["OS"], "days": 5, "hours_per_day": 25},
        ]

        for payload in invalid_requests:
            with self.subTest(payload=payload):
                response = self.client.post("/api/plan", json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)

    def test_plan_endpoint_rejects_malformed_json(self):
        response = self.client.post(
            "/api/plan",
            data="{not valid json",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json)

    def test_planner_rejects_extremely_large_study_hours(self):
        with self.assertRaises(ValueError):
            generate_study_plan(["OS"], 1, 10 ** 1000)


if __name__ == "__main__":
    unittest.main()