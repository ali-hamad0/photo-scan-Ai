from typing import Optional

APP_SCAN_TYPE_TO_DB_SCAN_TYPE = {
    "chest_xray": "xray",
    "bone_xray": "xray",
    "brain_mri": "mri",
}

DB_SCAN_TYPES = {"xray", "ct", "mri", "other"}
PATIENT_GENDERS = {"male", "female", "other"}


def get_db_scan_type(scan_type: str) -> Optional[str]:
    normalized = (scan_type or "").strip().lower()
    if normalized in APP_SCAN_TYPE_TO_DB_SCAN_TYPE:
        return APP_SCAN_TYPE_TO_DB_SCAN_TYPE[normalized]
    if normalized in DB_SCAN_TYPES:
        return normalized
    return None


def infer_analysis_type(scan_type: str, prediction: Optional[str] = None, image_path: Optional[str] = None) -> str:
    normalized = (scan_type or "").strip().lower()
    if normalized in APP_SCAN_TYPE_TO_DB_SCAN_TYPE:
        return normalized
    if normalized == "mri":
        return "brain_mri"
    if normalized != "xray":
        return normalized or "other"

    image_hint = (image_path or "").strip().lower()
    if "chest_xray" in image_hint:
        return "chest_xray"
    if "bone_xray" in image_hint:
        return "bone_xray"

    prediction_hint = (prediction or "").strip().lower()
    if prediction_hint in {"normal", "pneumonia"}:
        return "chest_xray"
    if prediction_hint in {"fractured", "not fractured"}:
        return "bone_xray"
    return "xray"


def normalize_patient_gender(gender: Optional[str]) -> Optional[str]:
    if not gender:
        return None
    normalized = gender.strip().lower()
    return normalized if normalized in PATIENT_GENDERS else None


def format_patient_gender(gender: Optional[str]) -> Optional[str]:
    if not gender:
        return None
    return gender.capitalize()
