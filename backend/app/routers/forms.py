from fastapi import APIRouter, HTTPException

from app.models.schemas import LegalForm
from app.services.form_templates import build_form, list_all_forms
from app.services.user_store import get_profile

router = APIRouter(prefix="/forms", tags=["forms"])


def _resolve_language(language: str | None, profile) -> str:
    if language in ("de", "en"):
        return language
    pref = getattr(profile, "preferred_language", None)
    if pref in ("de", "en"):
        return pref
    return "de"


@router.get("", response_model=list[LegalForm])
async def all_forms(user_id: str = "default", language: str | None = None) -> list[LegalForm]:
    profile = get_profile(user_id)
    lang = _resolve_language(language, profile)
    return list_all_forms(profile, lang)


@router.get("/{form_id}", response_model=LegalForm)
async def get_form(
    form_id: str,
    user_id: str = "default",
    language: str | None = None,
) -> LegalForm:
    profile = get_profile(user_id)
    lang = _resolve_language(language, profile)
    form = build_form(form_id, profile, lang)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form
