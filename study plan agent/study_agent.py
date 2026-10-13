SUBJECT_TOPICS = {
    "OS": [
        "Process Management",
        "CPU Scheduling",
        "Deadlocks",
        "Memory Management",
    ],
    "DBMS": [
        "SQL Queries",
        "Normalization",
        "Transactions",
        "ER Model",
    ],
    "JAVA": [
        "OOP Concepts",
        "Inheritance and Polymorphism",
        "Exception Handling",
        "Collections Framework",
    ],
    "PYTHON": [
        "Data Types and Functions",
        "Lists, Tuples and Dictionaries",
        "OOP in Python",
        "File Handling and Exceptions",
    ],
}


def generate_study_plan(subjects, days, hours_per_day):
    """Generate a schedule using the original agent's round-robin rules."""
    if not isinstance(subjects, list) or not subjects:
        raise ValueError("Choose at least one subject.")

    normalized_subjects = []
    for subject in subjects:
        if not isinstance(subject, str) or subject.strip().upper() not in SUBJECT_TOPICS:
            raise ValueError("Choose subjects from OS, DBMS, Java, or Python.")
        normalized_subjects.append(subject.strip().upper())

    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 365:
        raise ValueError("Days until the exam must be a whole number from 1 to 365.")

    if isinstance(hours_per_day, bool) or not isinstance(hours_per_day, (int, float)):
        raise ValueError("Study hours per day must be a number greater than 0 and no more than 24.")
    if not 0 < hours_per_day <= 24:
        raise ValueError("Study hours per day must be a number greater than 0 and no more than 24.")

    all_topics = [
        (subject, topic)
        for subject in normalized_subjects
        for topic in SUBJECT_TOPICS[subject]
    ]
    scheduled_topics = [[] for _ in range(days)]
    for index, topic in enumerate(all_topics):
        scheduled_topics[index % days].append(topic)

    schedule = []
    for index, day_topics in enumerate(scheduled_topics):
        tasks = []
        if day_topics:
            if hours_per_day > 0.5:
                study_hours = hours_per_day - 0.5
                revision_hours = 0.5
            else:
                study_hours = hours_per_day
                revision_hours = 0

            topic_hours = round(study_hours / len(day_topics), 1)
            for subject, topic in day_topics:
                tasks.append({
                    "kind": "topic",
                    "subject": subject,
                    "topic": topic,
                    "hours": topic_hours,
                })

            if revision_hours > 0:
                tasks.append({
                    "kind": "revision",
                    "topic": "Quick Revision",
                    "hours": revision_hours,
                })
        else:
            tasks.append({
                "kind": "revision",
                "topic": "Revision of all subjects",
                "hours": hours_per_day,
            })
            tasks.append({
                "kind": "practice",
                "topic": "Practice important questions",
                "hours": None,
            })

        schedule.append({"day": index + 1, "tasks": tasks})

    return {
        "subjects": normalized_subjects,
        "days_until_exam": days,
        "hours_per_day": hours_per_day,
        "topic_count": len(all_topics),
        "schedule": schedule,
    }