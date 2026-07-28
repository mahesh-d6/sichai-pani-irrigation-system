"""
Shared helper for saving user-uploaded files (payment proofs, complaint
photos, farmer documents) to disk and returning a URL the frontend can
load directly.

Files are saved under `settings.upload_dir` (served statically at
`/uploads` -- see main.py) using a random UUID filename so the original
name never touches the filesystem path (avoids path traversal / overwrite
attacks). Only a small allow-list of extensions is accepted and files are
capped at `settings.max_upload_size_mb`.
"""
import os
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile

from .config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


def _safe_extension(filename: Optional[str]) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '{ext or 'unknown'}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    return ext


def save_upload(file: UploadFile, subfolder: str) -> str:
    """
    Saves an UploadFile under uploads/<subfolder>/<uuid><ext> and returns
    the public URL path (e.g. "/uploads/payment_proofs/ab12....jpg").
    Raises HTTPException(400) for disallowed types or oversized files.
    """
    ext = _safe_extension(file.filename)

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    contents = file.file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise HTTPException(400, f"File too large. Maximum size is {settings.max_upload_size_mb}MB.")
    if len(contents) == 0:
        raise HTTPException(400, "Uploaded file is empty.")

    target_dir = os.path.join(settings.upload_dir, subfolder)
    os.makedirs(target_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{ext}"
    full_path = os.path.join(target_dir, stored_name)
    with open(full_path, "wb") as out:
        out.write(contents)

    return f"/uploads/{subfolder}/{stored_name}"
