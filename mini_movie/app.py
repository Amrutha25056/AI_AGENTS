"""MiniMovie: a small Flask app for planning short classroom films."""

import json
import re
from urllib.parse import urlparse

from flask import Flask, jsonify, render_template, request

import database


GENRES = {"Action", "Comedy", "Romance", "Thriller", "Horror", "Sci-Fi", "Drama"}
MOODS = {"Hopeful", "Mysterious", "Joyful", "Tense", "Dreamy", "Bittersweet"}
DURATIONS = {1, 3, 5}

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
database.initialize_database()


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/create")
def create_page():
    return render_template("create.html")


@app.get("/library")
def library_page():
    return render_template("library.html")


@app.get("/movies/<int:movie_id>")
def details_page(movie_id):
    return render_template("details.html", movie_id=movie_id)


def validate_movie(payload):
    """Return cleaned movie data, or a field-to-error mapping."""
    if not isinstance(payload, dict):
        return {}, {"request": "Send movie details as a JSON object."}

    errors = {}
    title = payload.get("title", "")
    genre = payload.get("genre", "")
    plot = payload.get("plot", "")
    characters = payload.get("characters", [])
    mood = payload.get("mood", "")
    duration = payload.get("duration")
    poster_url = payload.get("poster_url", "")

    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 100:
        errors["title"] = "Enter a title of 1 to 100 characters."
    if not isinstance(genre, str) or genre not in GENRES:
        errors["genre"] = "Choose a genre from the list."
    if not isinstance(plot, str) or not plot.strip() or len(plot.strip()) > 1200:
        errors["plot"] = "Write a plot of 1 to 1,200 characters."
    if not isinstance(characters, list) or not 1 <= len(characters) <= 6:
        errors["characters"] = "Add between 1 and 6 characters."
    else:
        cleaned_characters = []
        for index, character in enumerate(characters):
            if not isinstance(character, dict):
                errors["characters"] = "Each character needs a name and description."
                break
            name = character.get("name", "")
            description = character.get("description", "")
            if (not isinstance(name, str) or not name.strip() or len(name.strip()) > 40
                    or not isinstance(description, str) or len(description.strip()) > 180):
                errors[f"character_{index}"] = "Character names are required; descriptions can be up to 180 characters."
                continue
            cleaned_characters.append({"name": name.strip(), "description": description.strip()})
    if not isinstance(mood, str) or mood not in MOODS:
        errors["mood"] = "Choose a movie mood from the list."
    if isinstance(duration, bool) or not str(duration).isdigit() or int(duration) not in DURATIONS:
        errors["duration"] = "Choose a duration of 1, 3, or 5 minutes."
    if not isinstance(poster_url, str) or len(poster_url) > 500:
        errors["poster_url"] = "Poster URL must be 500 characters or fewer."
    elif poster_url.strip():
        try:
            parsed_url = urlparse(poster_url.strip())
            valid_url = parsed_url.scheme in {"http", "https"} and bool(parsed_url.netloc)
        except ValueError:
            valid_url = False
        if not valid_url:
            errors["poster_url"] = "Use a complete http or https image URL."

    if errors:
        return {}, errors
    return {
        "title": title.strip(),
        "genre": genre,
        "plot": plot.strip(),
        "characters": cleaned_characters,
        "duration": int(duration),
        "mood": mood,
        "poster_url": poster_url.strip(),
    }, {}


def fetch_movie(movie_id):
    with database.get_connection() as connection:
        row = connection.execute("SELECT * FROM movies WHERE id = ?", (movie_id,)).fetchone()
    return database.movie_from_row(row) if row else None


@app.get("/api/movies")
def list_movies():
    with database.get_connection() as connection:
        rows = connection.execute("SELECT * FROM movies ORDER BY created_at DESC, id DESC").fetchall()
    return jsonify([database.movie_from_row(row) for row in rows])


@app.get("/api/movies/<int:movie_id>")
def get_movie(movie_id):
    movie = fetch_movie(movie_id)
    if movie is None:
        return jsonify({"error": "Movie not found."}), 404
    return jsonify(movie)


@app.post("/api/movies")
def create_movie():
    movie, errors = validate_movie(request.get_json(silent=True))
    if errors:
        return jsonify({"error": "Please check the movie details.", "fields": errors}), 400
    with database.get_connection() as connection:
        cursor = connection.execute(
            """INSERT INTO movies (title, genre, plot, characters, duration, mood, poster_url)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (movie["title"], movie["genre"], movie["plot"], json.dumps(movie["characters"]),
             movie["duration"], movie["mood"], movie["poster_url"]),
        )
        movie_id = cursor.lastrowid
    return jsonify(fetch_movie(movie_id)), 201


@app.put("/api/movies/<int:movie_id>")
def update_movie(movie_id):
    movie, errors = validate_movie(request.get_json(silent=True))
    if errors:
        return jsonify({"error": "Please check the movie details.", "fields": errors}), 400
    with database.get_connection() as connection:
        cursor = connection.execute(
            """UPDATE movies SET title = ?, genre = ?, plot = ?, characters = ?, duration = ?,
               mood = ?, poster_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
               WHERE id = ?""",
            (movie["title"], movie["genre"], movie["plot"], json.dumps(movie["characters"]),
             movie["duration"], movie["mood"], movie["poster_url"], movie_id),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Movie not found."}), 404
    return jsonify(fetch_movie(movie_id))


@app.delete("/api/movies/<int:movie_id>")
def delete_movie(movie_id):
    with database.get_connection() as connection:
        cursor = connection.execute("DELETE FROM movies WHERE id = ?", (movie_id,))
    if cursor.rowcount == 0:
        return jsonify({"error": "Movie not found."}), 404
    return jsonify({"message": "Movie deleted."})


def generate_screenplay(movie):
    """Build a short screenplay from the movie's saved classroom notes."""
    characters = movie["characters"]
    lead = characters[0]
    partner = characters[1] if len(characters) > 1 else {"name": "The Stranger", "description": "a voice from nearby"}
    plot = re.sub(r"\s+", " ", movie["plot"]).strip()
    lead_description = lead["description"] or "ready to take a chance"
    partner_description = partner["description"] or "trying to make sense of it all"
    genre_beats = {
        "Action": "A sudden obstacle blocks the way forward.",
        "Comedy": "A small misunderstanding turns the plan upside down.",
        "Romance": "A quiet, honest moment changes what they thought they knew.",
        "Thriller": "A new clue reveals that someone is closer than they expected.",
        "Horror": "A strange sound answers from the empty room.",
        "Sci-Fi": "The device flashes, and the rules of the world shift.",
        "Drama": "An old disagreement finally comes into the open.",
    }
    closing = {
        "Hopeful": "They step into the next day with a little more courage.",
        "Mysterious": "One unanswered detail remains, waiting beyond the frame.",
        "Joyful": "The tension breaks into laughter as they move forward together.",
        "Tense": "They make their choice just as the final warning sounds.",
        "Dreamy": "The scene fades as the moment becomes a memory.",
        "Bittersweet": "They part with gratitude for what the moment gave them.",
    }
    dialogue = f'"{plot[:150]}"' if len(plot) <= 150 else f'"{plot[:147].rstrip()}..."'
    return "\n".join([
        f"{movie['title'].upper()} — A {movie['duration']}-MINUTE {movie['genre'].upper()}",
        "",
        "FADE IN:",
        f"\nINT. A PLACE BETWEEN PLANS — DAY ({movie['mood'].upper()} MOOD)",
        f"{lead['name']} ({lead_description}) studies the moment described in the story: {plot}",
        f"{lead['name']}: {dialogue}",
        f"{partner['name']} ({partner_description}) steps closer.",
        f"{partner['name']}: We can still decide what happens next.",
        "",
        "THE TURN",
        genre_beats[movie["genre"]],
        f"{lead['name']}: Then let's face it together.",
        f"{partner['name']} nods. The characters act on the choice at the heart of the plot.",
        "",
        "THE LAST SHOT",
        closing[movie["mood"]],
        "",
        "FADE OUT.",
    ])


@app.post("/api/movies/<int:movie_id>/generate-script")
def create_script(movie_id):
    movie = fetch_movie(movie_id)
    if movie is None:
        return jsonify({"error": "Movie not found."}), 404
    script = generate_screenplay(movie)
    with database.get_connection() as connection:
        connection.execute(
            "UPDATE movies SET script = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
            (script, movie_id),
        )
    movie["script"] = script
    return jsonify(movie)


@app.errorhandler(404)
def page_not_found(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Endpoint not found."}), 404
    return "Page not found", 404


if __name__ == "__main__":
    app.run(debug=True)