"""Focused API tests; run with python -m unittest."""

import tempfile
import unittest
from pathlib import Path

import app as minimovie
import database


class MiniMovieApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.original_database_path = database.DATABASE_PATH
        database.DATABASE_PATH = Path(self.temp_directory.name) / "test.db"
        database.initialize_database()
        minimovie.app.config.update(TESTING=True)
        self.client = minimovie.app.test_client()
        self.movie_data = {
            "title": "The Paper Moon",
            "genre": "Sci-Fi",
            "plot": "A student finds a paper moon that can predict tomorrow.",
            "characters": [
                {"name": "Mira", "description": "A curious student"},
                {"name": "Sol", "description": "A careful friend"},
            ],
            "duration": 3,
            "mood": "Mysterious",
            "poster_url": "",
        }

    def tearDown(self):
        database.DATABASE_PATH = self.original_database_path
        self.temp_directory.cleanup()

    def test_movie_crud_and_script_generation(self):
        created_response = self.client.post("/api/movies", json=self.movie_data)
        self.assertEqual(created_response.status_code, 201)
        movie = created_response.get_json()
        movie_id = movie["id"]

        self.assertEqual(self.client.get(f"/api/movies/{movie_id}").status_code, 200)
        self.assertEqual(len(self.client.get("/api/movies").get_json()), 1)

        updated_data = {**self.movie_data, "title": "The Paper Moon Returns"}
        update_response = self.client.put(f"/api/movies/{movie_id}", json=updated_data)
        self.assertEqual(update_response.get_json()["title"], "The Paper Moon Returns")

        script_response = self.client.post(f"/api/movies/{movie_id}/generate-script")
        self.assertEqual(script_response.status_code, 200)
        script_movie = script_response.get_json()
        self.assertIn("Mira (A curious student)", script_movie["script"])
        self.assertIn("PAPER MOON", script_movie["script"])
        self.assertEqual(self.client.get(f"/api/movies/{movie_id}").get_json()["script"], script_movie["script"])

        self.assertEqual(self.client.delete(f"/api/movies/{movie_id}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/movies/{movie_id}").status_code, 404)

    def test_invalid_movie_is_rejected(self):
        invalid_data = {**self.movie_data, "genre": "Space Opera", "duration": 2}
        response = self.client.post("/api/movies", json=invalid_data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("genre", response.get_json()["fields"])
        self.assertEqual(self.client.get("/api/movies").get_json(), [])

    def test_malformed_field_types_return_validation_errors(self):
        invalid_data = {**self.movie_data, "genre": [], "mood": {}, "poster_url": "http://[broken"}
        response = self.client.post("/api/movies", json=invalid_data)
        self.assertEqual(response.status_code, 400)
        fields = response.get_json()["fields"]
        self.assertIn("genre", fields)
        self.assertIn("mood", fields)
        self.assertIn("poster_url", fields)


if __name__ == "__main__":
    unittest.main()