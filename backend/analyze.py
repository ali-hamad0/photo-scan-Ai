import logging
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import ALGORITHM, RATE_LIMIT_ANALYZE, SECRET_KEY
from database import Patient, Scan, ScanResult, get_db
from limiter import limiter
from scan_utils import format_patient_gender, get_db_scan_type, infer_analysis_type, normalize_patient_gender
from services.analyzer import (
    MIN_CONFIDENCE,
    generate_gradcam,
    get_explanation,
    preprocess_image,
    validate_scan_image,
)

router = APIRouter()
models = {}

logger = logging.getLogger(__name__)

MODEL_PREPROCESS = {
    "chest_xray": "resnet",
    "bone_xray": "resnet",
    "brain_mri": "densenet",
}

SCAN_CONFIG = {
    "chest_xray": {
        "classes": ["Normal", "Pneumonia"],
        "binary": True,
        "threshold": 0.5,
    },
    "bone_xray": {
        "classes": ["fractured", "not fractured"],
        "binary": True,
        "threshold": 0.5,
    },
    "brain_mri": {
        "classes": ["Glioma", "Meningioma", "No Tumor", "Pituitary"],
        "binary": False,
    },
}


def load_models():
    import os
    import tensorflow as tf

    model_paths = {
        "chest_xray": "models/chest_xray_model.h5",
        "bone_xray": "models/bone_xray_model.h5",
        "brain_mri": "models/brain_mri_model.h5",
    }

    for name, path in model_paths.items():
        if os.path.exists(path):
            models[name] = tf.keras.models.load_model(path)
            logger.info("Loaded model: %s", name)
        else:
            logger.warning("Model not found: %s — skipping", name)


def get_user_id_from_token(request: Request) -> int:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(user_id)


def _clean_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _serialize_scan_row(result: ScanResult, scan: Scan, patient: Optional[Patient]) -> dict:
    return {
        "result_id": result.result_id,
        "scan_type": infer_analysis_type(scan.scan_type, result.prediction, scan.image_path),
        "prediction": result.prediction,
        "confidence": result.confidence,
        "explanation": result.explanation,
        "patient_name": patient.name if patient else None,
        "patient_age": patient.age if patient else None,
        "patient_gender": format_patient_gender(patient.gender) if patient else None,
        "patient_notes": patient.notes if patient else None,
        "heatmap": result.heatmap_path,
        "created_at": result.created_at.strftime("%b %d, %Y %H:%M") if result.created_at else "",
    }


def _get_scan_rows(db: Session, user_id: int, limit: Optional[int] = None):
    query = (
        db.query(ScanResult, Scan, Patient)
        .join(Scan, ScanResult.scan_id == Scan.scan_id)
        .outerjoin(Patient, Scan.patient_id == Patient.patient_id)
        .filter(Scan.user_id == user_id)
        .order_by(ScanResult.created_at.desc())
    )
    if limit is not None:
        query = query.limit(limit)
    return query.all()


def _count_other_scans_for_patient(db: Session, patient_id: int, exclude_scan_id: Optional[int] = None) -> int:
    query = db.query(Scan).filter(Scan.patient_id == patient_id)
    if exclude_scan_id is not None:
        query = query.filter(Scan.scan_id != exclude_scan_id)
    return query.count()


def _delete_orphan_patient(db: Session, patient: Optional[Patient], exclude_scan_id: Optional[int] = None):
    if not patient:
        return
    if _count_other_scans_for_patient(db, patient.patient_id, exclude_scan_id=exclude_scan_id) == 0:
        db.delete(patient)


def _set_scan_patient(
    db: Session,
    scan: Scan,
    patient_name: Optional[str],
    patient_age: Optional[int],
    patient_gender: Optional[str],
    patient_notes: Optional[str],
):
    clean_name = _clean_optional_text(patient_name)
    clean_notes = _clean_optional_text(patient_notes)
    normalized_gender = normalize_patient_gender(patient_gender)

    has_any_patient_data = any(
        value is not None
        for value in (clean_name, patient_age, normalized_gender, clean_notes)
    )

    current_patient = scan.patient
    if not has_any_patient_data:
        if current_patient:
            scan.patient = None
            scan.patient_id = None
            _delete_orphan_patient(db, current_patient, exclude_scan_id=scan.scan_id)
        return

    if not current_patient and not clean_name:
        raise HTTPException(status_code=400, detail="Patient name is required when saving patient info")

    if not current_patient:
        current_patient = Patient(
            user_id=scan.user_id,
            name=clean_name,
            age=patient_age,
            gender=normalized_gender,
            notes=clean_notes,
        )
        db.add(current_patient)
        db.flush()
        scan.patient = current_patient
        scan.patient_id = current_patient.patient_id
        return

    if clean_name:
        current_patient.name = clean_name
    current_patient.age = patient_age
    current_patient.gender = normalized_gender
    current_patient.notes = clean_notes


def _get_owned_result(db: Session, user_id: int, result_id: int):
    row = (
        db.query(ScanResult, Scan, Patient)
        .join(Scan, ScanResult.scan_id == Scan.scan_id)
        .outerjoin(Patient, Scan.patient_id == Patient.patient_id)
        .filter(ScanResult.result_id == result_id, Scan.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    return row


@router.post("/analyze")
@limiter.limit(RATE_LIMIT_ANALYZE)
async def analyze(
    request: Request,
    scan_type: str = Form(...),
    file: UploadFile = File(...),
    patient_name: Optional[str] = Form(None),
    patient_age: Optional[int] = Form(None),
    patient_gender: Optional[str] = Form(None),
    patient_notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    if scan_type not in SCAN_CONFIG:
        raise HTTPException(status_code=400, detail=f"Unknown scan type: {scan_type}")

    if scan_type not in models:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model for '{scan_type}' is not loaded. "
                "Make sure the .h5 file exists in backend/models/"
            ),
        )

    user_id = get_user_id_from_token(request)
    db_scan_type = get_db_scan_type(scan_type)
    if not db_scan_type:
        raise HTTPException(status_code=400, detail=f"Unsupported scan type: {scan_type}")

    clean_patient_name = _clean_optional_text(patient_name)
    clean_patient_notes = _clean_optional_text(patient_notes)
    normalized_gender = normalize_patient_gender(patient_gender)
    if not clean_patient_name and any(
        value is not None for value in (patient_age, normalized_gender, clean_patient_notes)
    ):
        raise HTTPException(status_code=400, detail="Patient name is required when saving patient info")

    contents = await file.read()

    # --- Layer 1: grayscale check (rejects color photos / wrong modality) ---
    is_valid, reason = validate_scan_image(contents, scan_type)
    if not is_valid:
        raise HTTPException(status_code=422, detail=reason)

    model_type = MODEL_PREPROCESS.get(scan_type, "resnet")
    img_array = preprocess_image(contents, model_type=model_type)

    config = SCAN_CONFIG[scan_type]
    model = models[scan_type]
    prediction = model.predict(img_array, verbose=0)

    if config["binary"]:
        confidence = float(prediction[0][0])
        threshold = config.get("threshold", 0.5)
        if confidence > threshold:
            predicted_class = config["classes"][1]
            cam_class_idx = 0
        else:
            predicted_class = config["classes"][0]
            confidence = 1 - confidence
            cam_class_idx = 0
    else:
        class_idx = int(np.argmax(prediction[0]))
        confidence = float(prediction[0][class_idx])
        predicted_class = config["classes"][class_idx]
        cam_class_idx = class_idx

    # --- Layer 2: confidence floor (rejects wrong-modality grayscale images) ---
    min_conf = MIN_CONFIDENCE.get(scan_type, 0.60)
    if confidence < min_conf:
        raise HTTPException(
            status_code=422,
            detail=(
                f"The model could not confidently analyse this image as a "
                f"{scan_type.replace('_', ' ')} "
                f"(confidence {confidence * 100:.1f}% < {min_conf * 100:.0f}% minimum). "
                f"Please upload a valid {scan_type.replace('_', ' ')} scan."
            ),
        )

    confidence_pct = round(confidence * 100, 1)
    explanation = get_explanation(scan_type, predicted_class, confidence_pct)

    # Only generate Grad-CAM for abnormal predictions — on a Normal/negative result
    # the heatmap would just amplify noise and mislead the reader.
    _normal_classes = {"Normal", "not fractured", "No Tumor"}
    heatmap_b64 = (
        generate_gradcam(model, img_array, cam_class_idx, contents)
        if predicted_class not in _normal_classes
        else None
    )

    patient = None
    if clean_patient_name:
        patient = Patient(
            user_id=user_id,
            name=clean_patient_name,
            age=patient_age,
            gender=normalized_gender,
            notes=clean_patient_notes,
        )
        db.add(patient)
        db.flush()

    scan = Scan(
        user_id=user_id,
        patient_id=patient.patient_id if patient else None,
        scan_type=db_scan_type,
        image_path=file.filename or None,
        status="pending",
    )
    db.add(scan)
    db.flush()

    result = ScanResult(
        scan_id=scan.scan_id,
        prediction=predicted_class,
        confidence=confidence_pct,
        explanation=explanation,
        heatmap_path=heatmap_b64,
    )
    db.add(result)
    scan.status = "completed"
    db.commit()

    return {
        "scan_type": scan_type,
        "prediction": predicted_class,
        "confidence": confidence_pct,
        "explanation": explanation,
        "heatmap": heatmap_b64,
    }


@router.get("/history")
def get_history(
    request: Request,
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 20,
):
    page = max(1, page)
    page_size = min(max(1, page_size), 100)  # cap at 100 per page
    user_id = get_user_id_from_token(request)

    query = (
        db.query(ScanResult, Scan, Patient)
        .join(Scan, ScanResult.scan_id == Scan.scan_id)
        .outerjoin(Patient, Scan.patient_id == Patient.patient_id)
        .filter(Scan.user_id == user_id)
        .order_by(ScanResult.created_at.desc())
    )
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "history": [_serialize_scan_row(result, scan, patient) for result, scan, patient in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.delete("/history/{result_id}")
def delete_scan(result_id: int, request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id_from_token(request)
    result, scan, patient = _get_owned_result(db, user_id, result_id)
    db.delete(result)
    db.delete(scan)
    _delete_orphan_patient(db, patient, exclude_scan_id=scan.scan_id)
    db.commit()
    return {"ok": True}


class PatientUpdate(BaseModel):
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_notes: Optional[str] = None


@router.patch("/history/{result_id}")
def update_scan(result_id: int, body: PatientUpdate, request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id_from_token(request)
    _, scan, _ = _get_owned_result(db, user_id, result_id)
    _set_scan_patient(
        db,
        scan,
        patient_name=body.patient_name,
        patient_age=body.patient_age,
        patient_gender=body.patient_gender,
        patient_notes=body.patient_notes,
    )
    db.commit()
    return {"ok": True}


@router.get("/patients")
def get_patients(request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id_from_token(request)
    rows = _get_scan_rows(db, user_id)

    patients = {}
    for result, scan, patient in rows:
        if not patient or not patient.name:
            continue

        name = patient.name
        if name not in patients:
            patients[name] = {
                "patient_name": name,
                "patient_age": patient.age,
                "patient_gender": format_patient_gender(patient.gender),
                "scan_count": 0,
                "last_scan": result.created_at.strftime("%b %d, %Y") if result.created_at else "",
                "scan_types": [],
                "scans": [],
            }

        patient_group = patients[name]
        scan_type = infer_analysis_type(scan.scan_type, result.prediction, scan.image_path)
        patient_group["scan_count"] += 1
        if scan_type not in patient_group["scan_types"]:
            patient_group["scan_types"].append(scan_type)
        patient_group["scans"].append(
            {
                "result_id": result.result_id,
                "scan_type": scan_type,
                "prediction": result.prediction,
                "confidence": result.confidence,
                "explanation": result.explanation,
                "patient_notes": patient.notes,
                "heatmap": result.heatmap_path,
                "created_at": result.created_at.strftime("%b %d, %Y %H:%M") if result.created_at else "",
            }
        )

    return {"patients": list(patients.values())}


@router.get("/stats")
def get_stats(request: Request, db: Session = Depends(get_db)):
    user_id = get_user_id_from_token(request)
    rows = _get_scan_rows(db, user_id)

    stats = {"total": len(rows), "chest": 0, "bone": 0, "brain": 0}
    for result, scan, _ in rows:
        scan_type = infer_analysis_type(scan.scan_type, result.prediction, scan.image_path)
        if scan_type == "chest_xray":
            stats["chest"] += 1
        elif scan_type == "bone_xray":
            stats["bone"] += 1
        elif scan_type == "brain_mri":
            stats["brain"] += 1

    return stats
