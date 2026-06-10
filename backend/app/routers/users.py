from fastapi import APIRouter

from app.graphiti_client import add_user_episode
from app.models.schemas import UserProfile
from app.services.user_store import get_profile, save_profile, update_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserProfile)
async def read_profile(user_id: str) -> UserProfile:
    return get_profile(user_id)


@router.put("/{user_id}", response_model=UserProfile)
async def write_profile(user_id: str, profile: UserProfile) -> UserProfile:
    profile.id = user_id
    saved = save_profile(profile)
    try:
        summary = (
            f"Nutzer: {saved.first_name} {saved.last_name}, "
            f"Ort: {saved.city}, Thema: {saved.legal_topic}, "
            f"Fall: {saved.case_description}"
        )
        await add_user_episode(user_id, summary, label="profile_update")
    except Exception:
        pass
    return saved


@router.patch("/{user_id}", response_model=UserProfile)
async def patch_profile(user_id: str, updates: dict) -> UserProfile:
    return update_profile(user_id, updates)
