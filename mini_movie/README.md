# MiniMovie – Mini Movie Studio

MiniMovie is a small, beginner-friendly Flask web app for planning short classroom films. Create a movie with a story and cast, keep it in a local SQLite library, and generate a rule-based screenplay draft from the saved details. It uses no accounts, paid APIs, or external AI services.

## Open in VS Code

1. Open VS Code.
2. Choose **File → Open Folder...**.
3. Select the `mini_movie` folder.
4. Open the integrated terminal with **Terminal → New Terminal**.

## Run on Windows

Open PowerShell in the `mini_movie` project folder, then run:

```powershell
py -m venv .venv
```

Activate the virtual environment:

```powershell
.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, either allow scripts for just this terminal with `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and activate again, or use Command Prompt and run `.venv\Scripts\activate.bat`.

Install the dependency and start the server:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000** in your browser. Leave the terminal running while you use the app; press **Ctrl+C** to stop the development server.

## Try the features

1. Choose **Create a movie**, enter a title, genre, plot, at least one character, duration, and mood. A poster image URL is optional. Submit to save the movie.
2. On the movie details page, check the saved plot and cast. Choose **Edit movie** to change the information or **Delete movie** and confirm to remove it.
3. Choose **Generate Script**. The app creates a starter screenplay from the saved title, plot, genre, mood, and characters, then saves it to that movie. **Copy Script** puts the saved draft on the clipboard where browser clipboard permissions allow it.
4. On a movie's details page, press **Play** in **Movie preview** to watch a 26-second animated storyboard. Use the seek bar, pause, or fullscreen controls. **Download video** records the preview as a silent WebM video in browsers that support MediaRecorder.
5. In **Movie library**, search titles and filter by genre. Open a card to return to its details.
6. Stop and restart Flask, then revisit the library. Movies remain saved in `instance\\minimovie.db`.

Run the automated API checks from the project folder with:

```powershell
python -m unittest
```

## How it works

- **Frontend:** HTML templates provide the home, create/edit, library, and details pages. `static\css\style.css` styles them; `static\js\app.js` uses `fetch()` to call the backend and update the page.
- **Backend:** `app.py` serves the pages and implements JSON REST endpoints for movie create, read, update, delete, and script generation. It validates submitted data and returns HTTP status codes with JSON error messages.
- **Database:** `database.py` creates and opens the SQLite database. The table is initialized automatically when Flask starts. SQL statements use parameters for user-provided values. The generated screenplay is stored on the corresponding movie row.
- **Script generation:** This is a local, rule-based template, not an AI service. It uses the saved movie data to assemble opening, dialogue, genre-specific conflict, and mood-specific closing sections.
- **Movie preview:** The details page draws a short animated storyboard from the movie's title, plot, genre, mood, and cast. It is an illustrated, silent preview rather than live-action footage. The browser can record it as a WebM download when recording support is available.

## Project files

```text
mini_movie/
├── app.py
├── database.py
├── requirements.txt
├── test_app.py
├── templates/
│   ├── index.html
│   ├── create.html
│   ├── library.html
│   └── details.html
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   └── images/placeholder.svg
└── instance/             # Created automatically; contains minimovie.db
```