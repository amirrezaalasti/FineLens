import json

from app.config import settings
from app.models.schemas import UserProfile

DATA_DIR = settings.data_dir_path
PROFILES_FILE = DATA_DIR / "profiles.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not PROFILES_FILE.exists():
        PROFILES_FILE.write_text("{}", encoding="utf-8")


def _load_all() -> dict[str, dict]:
    _ensure_data_dir()
    content = PROFILES_FILE.read_text(encoding="utf-8").strip()
    if not content:
        return {}
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {}


def _save_all(profiles: dict[str, dict]) -> None:
    _ensure_data_dir()
    PROFILES_FILE.write_text(json.dumps(profiles, indent=2, ensure_ascii=False), encoding="utf-8")


def get_profile(user_id: str) -> UserProfile:
    profiles = _load_all()
    data = profiles.get(user_id, {"id": user_id})
    return UserProfile(**data)


def save_profile(profile: UserProfile) -> UserProfile:
    profiles = _load_all()
    profiles[profile.id] = profile.model_dump()
    _save_all(profiles)
    return profile


def update_profile(user_id: str, updates: dict) -> UserProfile:
    profile = get_profile(user_id)
    updated = profile.model_copy(update={k: v for k, v in updates.items() if v is not None})
    return save_profile(updated)
