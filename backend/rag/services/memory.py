from rag.config import MAX_HISTORY_TURNS

_histories: dict[str, list[dict]] = {}


def get_history(session_id: str) -> list[dict]:
    return _histories.get(session_id, [])


def format_history(session_id: str) -> str:
    history = _histories.get(session_id, [])
    if not history:
        return "No prior conversation."
    lines = []
    for msg in history[-(MAX_HISTORY_TURNS * 2):]:
        role = "User" if msg["role"] == "human" else "MedBot"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def update_history(session_id: str, question: str, answer: str) -> None:
    h = _histories.setdefault(session_id, [])
    h.append({"role": "human",     "content": question})
    h.append({"role": "assistant", "content": answer})
    _histories[session_id] = h[-(MAX_HISTORY_TURNS * 2):]


def seed(session_id: str, messages: list[dict]) -> None:
    """Populate history from DB records so it survives server restarts."""
    if session_id not in _histories and messages:
        _histories[session_id] = messages[-(MAX_HISTORY_TURNS * 2):]


def clear(session_id: str) -> None:
    _histories.pop(session_id, None)
