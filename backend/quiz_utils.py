import os
import random
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
DIAGRAM_BUCKET = "question-diagrams"


def diagram_url(path):
    if not path:
        return None
    return f"{SUPABASE_URL}/storage/v1/object/public/{DIAGRAM_BUCKET}/{path}"


def prepare_question(q: dict, seed=None) -> dict:
    """Return a client-safe copy of a question.

    Options are shuffled, and each option keeps its ORIGINAL letter in "key".
    The frontend shows them as A-D by position but sends back the key, so
    grading on the server is unchanged. The correct answer is never sent.

    If a seed is given, the shuffle is repeatable (used so a resumed
    diagnostic shows the same option order the student already saw).
    """
    options = [
        {"key": "A", "text": q["option_a"]},
        {"key": "B", "text": q["option_b"]},
        {"key": "C", "text": q["option_c"]},
        {"key": "D", "text": q["option_d"]},
    ]
    # Questions flagged shuffle_options = false keep their fixed order
    if q.get("shuffle_options") is not False:
        rng = random.Random(seed) if seed else random
        rng.shuffle(options)

    return {
        "id": q["id"],
        "subject": q["subject"],
        "topic": q["topic"],
        "difficulty": q["difficulty"],
        "question_text": q["question_text"],
        "options": options,
        "diagram_url": diagram_url(q.get("diagram_path")),
        "diagram_alt": q.get("diagram_alt"),
    }