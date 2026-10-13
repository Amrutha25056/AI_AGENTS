import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request


app = Flask(__name__)
BOOKS_FILE = Path(__file__).resolve().parent / "books.json"


class InventoryError(Exception):
    """Raised when the local book inventory cannot be read safely."""


def load_books():
    try:
        with BOOKS_FILE.open("r", encoding="utf-8") as books_file:
            books = json.load(books_file)
    except (OSError, json.JSONDecodeError) as error:
        raise InventoryError("The book inventory could not be loaded.") from error

    if not isinstance(books, list):
        raise InventoryError("The book inventory has an invalid format.")

    for book in books:
        if (
            not isinstance(book, dict)
            or not isinstance(book.get("title"), str)
            or not isinstance(book.get("author"), str)
            or not isinstance(book.get("available"), bool)
        ):
            raise InventoryError("The book inventory has an invalid format.")

    return books


def make_inventory_error_response():
    return jsonify({"error": "The book inventory could not be loaded."}), 500


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/books")
def get_books():
    try:
        return jsonify({"books": load_books()})
    except InventoryError:
        return make_inventory_error_response()


@app.post("/chat")
def chat():
    if not request.is_json:
        return jsonify({"error": "Invalid request. Send a JSON object with a message."}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or "message" not in data:
        return jsonify({"error": "Invalid request. Send a JSON object with a message."}), 400

    message = data["message"]
    if not isinstance(message, str):
        return jsonify({"error": "The message must be text."}), 400

    message = message.strip()
    if not message:
        return jsonify({"error": "Please enter a message."}), 400

    normalized_message = message.casefold()
    if normalized_message in {"exit", "quit", "goodbye", "bye"}:
        return jsonify({"reply": "Goodbye!"})

    if normalized_message in {"list", "list books", "show books", "inventory"}:
        try:
            books = load_books()
        except InventoryError:
            return make_inventory_error_response()

        lines = ["Here are the books in our library:"]
        for book in books:
            status = "available" if book["available"] else "currently borrowed"
            lines.append(f"{book['title']} by {book['author']} - {status}.")
        return jsonify({"reply": "\n".join(lines)})

    try:
        books = load_books()
    except InventoryError:
        return make_inventory_error_response()

    for book in books:
        if book["title"].casefold() in normalized_message:
            if book["available"]:
                reply = "The book is available."
            else:
                reply = "The book is currently borrowed."
            return jsonify({"reply": reply})

    return jsonify({"reply": "That book is not available in our library."})


if __name__ == "__main__":
    app.run(debug=True)