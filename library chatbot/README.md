# College Library Chatbot

A beginner-friendly web application for checking the availability of books in a small college library. Students can ask a simple question in the chat window, browse the five-book collection, or use one of the suggested questions. A Python Flask backend reads the current inventory from `books.json` and returns factual answers; it does not use an external AI service.

## Problem Statement

Students need a quick way to find out whether a library book is on the shelf or currently borrowed. This project demonstrates how a small Python web server, a local JSON data file, and a browser interface can work together to answer that question.

## Objectives

- Build a usable library chatbot with HTML, CSS, JavaScript, and Flask.
- Keep book records in one editable local JSON file.
- Practice HTTP routes, JSON requests and responses, and JavaScript `fetch()`.
- Handle invalid input and unavailable titles clearly.

## Features

- Checks whether a listed book is available or currently borrowed.
- Matches book titles without case sensitivity.
- Clearly reports when a title is not in the inventory.
- Shows all inventory records and availability in the page.
- Includes suggested questions, a list-books action, timestamps, a typing indicator, and a Clear chat button.
- Accepts Enter as well as the Send button.
- Reports invalid requests and network errors instead of showing false success.
- Runs locally with Flask and does not require an AI service or external API.

## Technologies

- Python 3.10 or newer
- Flask 3.x
- HTML, CSS, and vanilla JavaScript
- Local JSON data (`books.json`)

## Project Structure

```text
library-chatbot/
|-- app.py
|-- books.json
|-- requirements.txt
|-- README.md
|-- .gitignore
|-- test_app.py
|-- library_chatbot.py          # Original console version, retained
|-- templates/
|   `-- index.html
`-- static/
    |-- style.css
    `-- script.js
```

## Prerequisites

- Windows 10 or 11
- Python 3.10+ installed and available in PowerShell as `py` or `python`
- Visual Studio Code (recommended)

## Install and Run on Windows

Open the project folder in VS Code. In its integrated PowerShell terminal, run:

```powershell
cd "C:\Users\amrut\OneDrive\Documents\library chatbot"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
```

If `py` is not available, use `python -m venv .venv` in its place. If PowerShell blocks environment activation, run this for the current terminal only, then activate the environment again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Keep the terminal running and open [http://127.0.0.1:5000](http://127.0.0.1:5000/) in a browser. Stop the development server with `Ctrl+C`.

Run the automated backend checks from another terminal with the virtual environment activated:

```powershell
python -m unittest
```

## Example Questions

| Question | Expected response |
| --- | --- |
| `Do you have The Hobbit?` | `The book is currently borrowed.` |
| `Do you have The Little Prince?` | `The book is available.` |
| `Do you have Percy Jackson?` | `That book is not available in our library.` |
| `list books` | Displays all five titles, authors, and their status. |
| `exit` | `Goodbye!` |

An empty message or a request that is not a JSON object containing a text `message` is rejected with HTTP 400 and a clear error. The browser prevents blank submissions before sending them.

## Book Inventory

`books.json` is the sole source for book titles, authors, and availability:

| Title | Author | Status |
| --- | --- | --- |
| Harry Potter and the Philosopher's Stone | J. K. Rowling | Available |
| The Hobbit | J. R. R. Tolkien | Currently borrowed |
| The Diary of a Young Girl | Anne Frank | Available |
| Charlotte's Web | E. B. White | Currently borrowed |
| The Little Prince | Antoine de Saint-Exupéry | Available |

The frontend gets this collection from the Flask `GET /books` endpoint. Chat messages are sent as JSON to `POST /chat`.

## Customize the Inventory

Open `books.json` in a text editor and update a book's `title`, `author`, or boolean `available` value. Use `true` when the book is available and `false` when it is borrowed. Keep the file as a valid JSON array; each entry must have all three fields. Restart or refresh the app to see the updated collection. No second inventory list needs to be changed in Python or JavaScript.

## Screenshots

There are no screenshots included yet. To add one later, run the app, open it in a browser, take a screenshot, and save it in a new `screenshots/` folder. Then reference it here, for example:

```markdown
![College Library Chatbot](screenshots/library-chatbot.png)
```

## Troubleshooting

- **`py` or `python` is not recognized:** Install Python from the official Python website and enable the option to add it to PATH, or use the launcher command available on your computer.
- **`ModuleNotFoundError: No module named 'flask'`:** Activate `.venv` and run `pip install -r requirements.txt` from the project folder.
- **PowerShell refuses to activate `.venv`:** Use the process-scoped execution policy command in the installation section, then activate again.
- **The browser cannot connect:** Confirm `python app.py` is still running, then visit `http://127.0.0.1:5000`.
- **Inventory is missing or fails to load:** Make sure `books.json` is alongside `app.py` and contains valid JSON with the required fields.
- **Port 5000 is already in use:** Stop the other local server using that port, then run the Flask app again.

## Upload to GitHub

Create a new, empty repository on GitHub (do not initialize it with a README or license). In PowerShell, from this project folder, replace `YOUR-USERNAME` with your GitHub username and run:

```powershell
cd "C:\Users\amrut\OneDrive\Documents\library chatbot"
git init
git add .
git commit -m "Build college library chatbot web app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/library-chatbot.git
git push -u origin main
```

GitHub may ask you to authenticate through its configured credential manager or browser sign-in. Do not add passwords, tokens, or other secrets to the project.

## Future Enhancements

- Add a librarian view for updating availability.
- Store lending history in a small database.
- Add filters for browsing by author or availability.
- Add automated browser tests for the chat interface.

## Conclusion

This project is a compact example of a complete web application: a responsive browser interface sends requests to a Flask backend, which answers using a locally maintained JSON inventory. It is designed to be easy to run, inspect, and extend as a college class activity.