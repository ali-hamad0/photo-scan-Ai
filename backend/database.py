import datetime

from sqlalchemy import Column, Enum, Float, ForeignKey, Integer, String, Text, TIMESTAMP, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from config import DATABASE_URL

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

_now = lambda: datetime.datetime.now(datetime.timezone.utc)


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("admin", "doctor", "user", name="user_role"), default="user", nullable=False)
    created_at = Column(TIMESTAMP, default=_now)
    updated_at = Column(TIMESTAMP, default=_now, onupdate=_now)

    patients = relationship("Patient", back_populates="user")
    scans = relationship("Scan", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")


class Patient(Base):
    __tablename__ = "patients"

    patient_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer)
    gender = Column(Enum("male", "female", "other", name="patient_gender"), nullable=True)
    notes = Column(Text)
    created_at = Column(TIMESTAMP, default=_now)

    user = relationship("User", back_populates="patients")
    scans = relationship("Scan", back_populates="patient")


class Scan(Base):
    __tablename__ = "scans"

    scan_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id", ondelete="SET NULL"), nullable=True, index=True)
    scan_type = Column(Enum("xray", "ct", "mri", "other", name="scan_type"), nullable=False)
    image_path = Column(Text)
    status = Column(Enum("pending", "completed", "failed", name="scan_status"), default="pending", nullable=False)
    created_at = Column(TIMESTAMP, default=_now)

    user = relationship("User", back_populates="scans")
    patient = relationship("Patient", back_populates="scans")
    results = relationship("ScanResult", back_populates="scan", cascade="all, delete-orphan", passive_deletes=True)
    chat_sessions = relationship("ChatSession", back_populates="scan")


class ScanResult(Base):
    __tablename__ = "scan_results"

    result_id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(Integer, ForeignKey("scans.scan_id", ondelete="CASCADE"), nullable=False, index=True)
    prediction = Column(String(100))
    confidence = Column(Float)
    explanation = Column(Text)
    heatmap_path = Column(Text)
    created_at = Column(TIMESTAMP, default=_now)

    scan = relationship("Scan", back_populates="results")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    scan_id = Column(Integer, ForeignKey("scans.scan_id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), default="New Conversation")
    created_at = Column(TIMESTAMP, default=_now)
    updated_at = Column(TIMESTAMP, default=_now, onupdate=_now)

    user = relationship("User", back_populates="chat_sessions")
    scan = relationship("Scan", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        String(64),
        ForeignKey("chat_sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(Enum("user", "assistant", "system", name="chat_role"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, default=_now)

    session = relationship("ChatSession", back_populates="messages")


def create_tables():
    Base.metadata.create_all(engine)
    print("Tables created successfully")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
