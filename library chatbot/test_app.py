import unittest

from app import app


class LibraryChatbotTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def ask(self, message):
        return self.client.post("/chat", json={"message": message})

    def test_known_book_availability(self):
        cases = {
            "Do you have The Hobbit?": "The book is currently borrowed.",
            "Do you have The Little Prince?": "The book is available.",
            "Do you have Percy Jackson?": "That book is not available in our library.",
        }
        for message, expected in cases.items():
            with self.subTest(message=message):
                response = self.ask(message)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json()["reply"], expected)

    def test_title_matching_is_case_insensitive(self):
        response = self.ask("is THE LITTLE PRINCE available?")
        self.assertEqual(response.get_json()["reply"], "The book is available.")

    def test_empty_and_invalid_requests_return_client_errors(self):
        empty = self.ask("   ")
        malformed = self.client.post(
            "/chat", data="{bad", content_type="application/json"
        )
        non_json = self.client.post("/chat", data="message=hello")

        self.assertEqual(empty.status_code, 400)
        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(non_json.status_code, 400)

    def test_inventory_lists_exactly_five_books(self):
        response = self.client.get("/books")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["books"]), 5)

        chat_response = self.ask("list books")
        self.assertEqual(chat_response.status_code, 200)
        self.assertEqual(chat_response.get_json()["reply"].count(" by "), 5)

    def test_goodbye_and_homepage(self):
        goodbye = self.ask("exit")
        homepage = self.client.get("/")

        self.assertEqual(goodbye.get_json()["reply"], "Goodbye!")
        self.assertEqual(homepage.status_code, 200)
        self.assertIn(b"College Library Chatbot", homepage.data)


if __name__ == "__main__":
    unittest.main()