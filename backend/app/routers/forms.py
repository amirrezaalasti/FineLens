from fastapi import APIRouter, HTTPException

from app.models.schemas import LegalForm
from app.services.form_templates import build_form, list_all_forms
from app.services.user_store import get_profile

router = APIRouter(prefix="/forms", tags=["forms"])


@router.get("", response_model=list[LegalForm])
async def all_forms(user_id: str = "default") -> list[LegalForm]:
    profile = get_profile(user_id)
    return list_all_forms(profile)


@router.get("/{form_id}", response_model=LegalForm)
async def get_form(form_id: str, user_id: str = "default") -> LegalForm:
    profile = get_profile(user_id)
    form = build_form(form_id, profile)
    if not form:
        raise HTTPException(status_code=404, detail="Formular nicht gefunden")
    return form
