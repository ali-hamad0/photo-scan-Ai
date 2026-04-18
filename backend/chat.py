"""
backend/chat.py - PathoScan AI Chat Endpoints
"""

import datetime
import json
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import ALGORITHM, RATE_LIMIT_CHAT, SECRET_KEY
from database import ChatMessage, ChatSession, Patient, Scan, ScanResult, get_db
from limiter import limiter
from scan_utils import format_patient_gender, infer_analysis_type

router = APIRouter()

SCAN_LABELS = {
    "chest_xray": "Chest X-Ray",
    "bone_xray": "Bone X-Ray",
    "brain_mri": "Brain MRI",
    "xray": "X-Ray",
    "ct": "CT Scan",
    "mri": "MRI",
    "other": "Other Scan",
}


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    history: list = []
    scan_id: Optional[int] = None


def _get_scan_rows(db: Session, user_id: int, limit: Optional[int] = None, result_id: Optional[int] = None):
    query = (
        db.query(ScanResult, Scan, Patient)
        .join(Scan, ScanResult.scan_id == Scan.scan_id)
        .outerjoin(Patient, Scan.patient_id == Patient.patient_id)
        .filter(Scan.user_id == user_id)
        .order_by(ScanResult.created_at.desc())
    )
    if result_id is not None:
        query = query.filter(ScanResult.result_id == result_id)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def _serialize_scan(result: ScanResult, scan: Scan, patient: Optional[Patient]) -> dict:
    return {
        "result_id": result.result_id,
        "scan_type": infer_analysis_type(scan.scan_type, result.prediction, scan.image_path),
        "prediction": result.prediction,
        "confidence": result.confidence,
        "patient_name": patient.name if patient else None,
        "patient_age": patient.age if patient else None,
        "patient_gender": format_patient_gender(patient.gender) if patient else None,
        "created_at": result.created_at.strftime("%b %d, %Y") if result.created_at else "",
    }


def _build_scan_context(rows: list) -> str:
    if not rows:
        return ""

    lines = []
    for result, scan, patient in rows:
        analysis_type = infer_analysis_type(scan.scan_type, result.prediction, scan.image_path)
        label = SCAN_LABELS.get(analysis_type, analysis_type)
        line = f"- {label}: {result.prediction} ({result.confidence}% confidence)"

        if patient and patient.name:
            line += f" | Patient: {patient.name}"
            if patient.age:
                line += f", age {patient.age}"
            if patient.gender:
                line += f", {format_patient_gender(patient.gender)}"
        if patient and patient.notes:
            line += f" | Notes: {patient.notes}"
        if result.explanation:
            line += f" | AI explanation: {result.explanation}"
        if result.created_at:
            line += f" | Date: {result.created_at.strftime('%b %d, %Y')}"
        lines.append(line)

    return "\n".join(lines)


def get_user_id(request: Request) -> Optional[int]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
            return int(payload.get("user_id", 0)) or None
        except JWTError:
            pass
    return None


def ensure_session(
    db: Session,
    session_id: str,
    user_id: int,
    title: str = "New Conversation",
    scan_id: Optional[int] = None,
):
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not session:
        session = ChatSession(session_id=session_id, user_id=user_id, title=title, scan_id=scan_id)
        db.add(session)
        db.commit()
        return session

    if scan_id is not None:
        session.scan_id = scan_id
    db.commit()
    return session


def save_message(db: Session, session_id: str, role: str, content: str):
    db_role = "assistant" if role in {"bot", "assistant"} else role
    msg = ChatMessage(session_id=session_id, role=db_role, content=content)
    db.add(msg)
    db.query(ChatSession).filter(ChatSession.session_id == session_id).update(
        {"updated_at": datetime.datetime.now(datetime.timezone.utc)}
    )
    db.commit()


@router.get("/chat/scans")
def get_user_scans(request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    rows = _get_scan_rows(db, user_id, limit=10)
    return {"scans": [_serialize_scan(result, scan, patient) for result, scan, patient in rows]}


@router.get("/chat/sessions")
def list_sessions(request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
        .all()
    )

    return {
        "sessions": [
            {
                "session_id": session.session_id,
                "title": session.title,
                "created_at": session.created_at.strftime("%b %d, %Y") if session.created_at else "",
                "updated_at": session.updated_at.strftime("%b %d, %Y %H:%M") if session.updated_at else "",
            }
            for session in sessions
        ]
    }


@router.get("/chat/sessions/{session_id}/messages")
def get_messages(session_id: str, request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    session = (
        db.query(ChatSession)
        .filter(ChatSession.session_id == session_id, ChatSession.user_id == user_id)
        .first()
    )
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return {
        "messages": [
            {
                "role": "bot" if message.role == "assistant" else message.role,
                "content": message.content,
                "created_at": message.created_at.strftime("%H:%M") if message.created_at else "",
            }
            for message in messages
        ]
    }


@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        from rag.agent import ask

        result = ask(req.message, session_id=req.session_id)
        return JSONResponse(
            content={
                "answer": result["answer"],
                "sources": result.get("sources", []),
                "session_id": result.get("session_id", req.session_id),
            }
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "answer": "Sorry, the AI service is currently unavailable.",
                "sources": [],
                "session_id": req.session_id,
            },
        )


@router.post("/chat/stream")
@limiter.limit(RATE_LIMIT_CHAT)
async def chat_stream(req: ChatRequest, request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id(request)

    scan_context = ""
    session_scan_id = None
    if user_id and req.scan_id:
        rows = _get_scan_rows(db, user_id, result_id=req.scan_id)
        if rows:
            scan_context = _build_scan_context(rows)
            session_scan_id = rows[0][1].scan_id

    # Restore conversation context from DB so history survives server restarts
    if user_id and req.session_id and req.session_id != "default":
        from rag.agent import MAX_HISTORY_TURNS, seed_history

        existing_msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == req.session_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(MAX_HISTORY_TURNS * 2)
            .all()
        )
        if existing_msgs:
            seed_history(
                req.session_id,
                [
                    {
                        "role": "human" if m.role == "user" else "assistant",
                        "content": m.content,
                    }
                    for m in existing_msgs
                ],
            )

    async def event_generator():
        bot_text = []
        try:
            if user_id and req.session_id and req.session_id != "default":
                is_new = db.query(ChatSession).filter(ChatSession.session_id == req.session_id).first() is None
                title = req.message[:60] if is_new else None
                ensure_session(db, req.session_id, user_id, title or "New Conversation", scan_id=session_scan_id)
                save_message(db, req.session_id, "user", req.message)

            if scan_context:
                yield f"data: {json.dumps({'type': 'scan_context_active', 'content': True})}\n\n"

            from rag.agent import ask_stream

            async for event in ask_stream(req.message, session_id=req.session_id, scan_context=scan_context):
                if event.get("type") == "token":
                    bot_text.append(event.get("content", ""))
                yield f"data: {json.dumps(event)}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

            if user_id and req.session_id and req.session_id != "default" and bot_text:
                save_message(db, req.session_id, "assistant", "".join(bot_text))

        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.delete("/chat/session/{session_id}")
async def clear_session(session_id: str, request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id(request)

    if user_id:
        owned_session = (
            db.query(ChatSession.session_id)
            .filter(ChatSession.session_id == session_id, ChatSession.user_id == user_id)
            .first()
        )
        if owned_session:
            db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete(
                synchronize_session=False
            )
            db.query(ChatSession).filter(
                ChatSession.session_id == session_id,
                ChatSession.user_id == user_id,
            ).delete(synchronize_session=False)
            db.commit()

    try:
        from rag.agent import clear_session as clear_rag_session

        clear_rag_session(session_id)
    except Exception:
        pass

    return JSONResponse(content={"cleared": True, "session_id": session_id})
