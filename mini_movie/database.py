"""SQLite helpers for the MiniMovie application."""

import json
import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "instance" / "minimovie.db"


class ClosingConnection(sqlite3.Connection):
    """Close SQLite handles when leaving their context manager."""

    def __exit__(self, exception_type, exception_value, traceback):
        try:
            return super().__exit__(exception_type, exception_value, traceback)
        finally:
            self.close()


def get_connection(database_path=None):
    """Open a database connection and return rows by column name."""
    path = Path(database_path) if database_path else DATABASE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, factory=ClosingConnection)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(database_path=None):
    """Create the movies table when the application starts."""
    with get_connection(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS movies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                genre TEXT NOT NULL,
                plot TEXT NOT NULL,
                characters TEXT NOT NULL,
                duration INTEGER NOT NULL,
                mood TEXT NOT NULL,
                poster_url TEXT NOT NULL DEFAULT '',
                script TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )
            """
        )


def movie_from_row(row):
    """Convert a SQLite row into the JSON-friendly movie shape."""
    movie = dict(row)
    movie["characters"] = json.loads(movie["characters"])
    return movie