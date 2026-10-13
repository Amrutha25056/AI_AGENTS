from flask import Flask, jsonify, render_template, request

from study_agent import SUBJECT_TOPICS, generate_study_plan


app = Flask(__name__)


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/subjects")
def get_subjects():
    subjects = [
        {"name": name, "topics": topics}
        for name, topics in SUBJECT_TOPICS.items()
    ]
    return jsonify({"subjects": subjects})


@app.post("/api/plan")
def create_plan():
    if not request.is_json:
        return jsonify({"error": "Send the study details as JSON."}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "The request body must be a valid JSON object."}), 400

    try:
        plan = generate_study_plan(
            subjects=data.get("subjects"),
            days=data.get("days"),
            hours_per_day=data.get("hours_per_day"),
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Study plan generation failed")
        return jsonify({"error": "The study plan could not be generated. Please try again."}), 500

    return jsonify({"plan": plan})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)