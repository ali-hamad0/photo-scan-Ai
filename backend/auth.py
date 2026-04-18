import datetime
from datetime import timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import ALGORITHM, RATE_LIMIT_LOGIN, RATE_LIMIT_REGISTER, SECRET_KEY, TOKEN_EXPIRE_HOURS
from database import User, get_db
from limiter import limiter

router = APIRouter()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ── SCHEMAS ──────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── ROUTES ───────────────────────────────────────────────────────

@router.post("/auth/register")
@limiter.limit(RATE_LIMIT_REGISTER)
def register(request: Request, data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = _hash_password(data.password)
    user = User(name=data.name, email=data.email, password_hash=hashed)
    db.add(user)
    db.commit()

    return {"message": "Account created successfully"}


@router.post("/auth/login")
@limiter.limit(RATE_LIMIT_LOGIN)
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Email not found")

    if not _verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Wrong password")

    token = jwt.encode(
        {
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "exp": datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=TOKEN_EXPIRE_HOURS),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    return {
        "message": "Login successful",
        "token": token,
        "name": user.name,
    }
