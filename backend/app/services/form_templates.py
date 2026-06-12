from app.models.schemas import FormField, LegalForm, UserProfile

FORM_TEMPLATES: dict[str, dict] = {
    "mietwiderspruch": {
        "title": "Widerspruch gegen Mieterhöhung",
        "description": "Formular zur Geltendmachung eines Widerspruchs gegen eine Mieterhöhung nach § 558 BGB.",
        "category": "Mietrecht",
        "legal_basis": ["§ 558 BGB", "§ 558a BGB"],
        "source_url": "https://www.gesetze-im-internet.de/bgb/__558.html",
        "field_map": {
            "tenant_name": ("last_name", "first_name"),
            "tenant_street": ("street",),
            "tenant_city": ("postal_code", "city"),
            "tenant_email": ("email",),
            "landlord_name": None,
            "rental_address": ("street", "postal_code", "city"),
            "current_rent": None,
            "proposed_rent": None,
            "objection_reason": ("case_description",),
        },
        "fields": [
            {"id": "tenant_name", "label": "Name des Mieters", "required": True},
            {"id": "tenant_street", "label": "Straße und Hausnummer", "required": True},
            {"id": "tenant_city", "label": "PLZ und Ort", "required": True},
            {"id": "tenant_email", "label": "E-Mail", "type": "email"},
            {"id": "landlord_name", "label": "Name des Vermieters", "required": True},
            {"id": "rental_address", "label": "Adresse der Mietwohnung", "required": True},
            {"id": "current_rent", "label": "Aktuelle Kaltmiete (€)", "type": "number", "required": True},
            {"id": "proposed_rent", "label": "Geforderte neue Miete (€)", "type": "number", "required": True},
            {
                "id": "objection_reason",
                "label": "Begründung des Widerspruchs",
                "type": "textarea",
                "required": True,
                "placeholder": "z.B. Die Mieterhöhung übersteigt die ortsübliche Vergleichsmiete...",
            },
        ],
    },
    "kuendigung-widerspruch": {
        "title": "Widerspruch gegen Kündigung",
        "description": "Schreiben zum Widerspruch gegen eine außerordentliche oder ordentliche Kündigung.",
        "category": "Mietrecht",
        "legal_basis": ["§ 574 BGB", "§ 543 BGB"],
        "source_url": "https://www.gesetze-im-internet.de/bgb/__574.html",
        "field_map": {
            "tenant_name": ("last_name", "first_name"),
            "tenant_address": ("street", "postal_code", "city"),
            "landlord_name": None,
            "termination_date": None,
            "widerspruch_reason": ("case_description",),
        },
        "fields": [
            {"id": "tenant_name", "label": "Name", "required": True},
            {"id": "tenant_address", "label": "Ihre Adresse", "required": True},
            {"id": "landlord_name", "label": "Vermieter", "required": True},
            {"id": "termination_date", "label": "Kündigungsdatum", "type": "date", "required": True},
            {
                "id": "widerspruch_reason",
                "label": "Begründung (z.B. Härtefall nach § 574 BGB)",
                "type": "textarea",
                "required": True,
            },
        ],
    },
    "datenschutz-auskunft": {
        "title": "Auskunftsanfrage nach Art. 15 DSGVO",
        "description": "Anfrage auf Auskunft über gespeicherte personenbezogene Daten.",
        "category": "Datenschutz",
        "legal_basis": ["Art. 15 DSGVO", "Art. 12 DSGVO"],
        "source_url": "https://www.gesetze-im-internet.de/dsgvo/__15.html",
        "field_map": {
            "requester_name": ("last_name", "first_name"),
            "requester_email": ("email",),
            "requester_address": ("street", "postal_code", "city"),
            "company_name": None,
            "data_categories": ("legal_topic",),
        },
        "fields": [
            {"id": "requester_name", "label": "Ihr vollständiger Name", "required": True},
            {"id": "requester_email", "label": "E-Mail-Adresse", "type": "email", "required": True},
            {"id": "requester_address", "label": "Ihre Adresse", "required": True},
            {"id": "company_name", "label": "Unternehmen (Datenverantwortlicher)", "required": True},
            {
                "id": "data_categories",
                "label": "Welche Daten möchten Sie einsehen?",
                "type": "textarea",
                "placeholder": "z.B. Kontodaten, Kommunikationsverlauf, Profildaten",
            },
        ],
    },
    "arbeitszeugnis": {
        "title": "Anforderung eines qualifizierten Arbeitszeugnisses",
        "description": "Antrag auf Ausstellung eines qualifizierten Arbeitszeugnisses nach § 630 BGB.",
        "category": "Arbeitsrecht",
        "legal_basis": ["§ 630 BGB"],
        "source_url": "https://www.gesetze-im-internet.de/bgb/__630.html",
        "field_map": {
            "employee_name": ("last_name", "first_name"),
            "employee_address": ("street", "postal_code", "city"),
            "employer_name": None,
            "employment_period": None,
            "position": ("legal_topic",),
        },
        "fields": [
            {"id": "employee_name", "label": "Ihr Name", "required": True},
            {"id": "employee_address", "label": "Ihre Adresse", "required": True},
            {"id": "employer_name", "label": "Arbeitgeber", "required": True},
            {"id": "employment_period", "label": "Beschäftigungszeitraum", "required": True},
            {"id": "position", "label": "Position / Tätigkeit", "required": True},
        ],
    },
    "bussgeld-einspruch": {
        "title": "Einspruch gegen Bußgeldbescheid",
        "description": "Fristgerechter Einspruch gegen einen Bußgeldbescheid gem. § 67 OWiG.",
        "category": "Verkehrsrecht / Ordnungswidrigkeiten",
        "legal_basis": ["§ 67 OWiG"],
        "source_url": "https://www.gesetze-im-internet.de/owig_1968/__67.html",
        "field_map": {
            "applicant_name": ("last_name", "first_name"),
            "applicant_address": ("street", "postal_code", "city"),
            "authority_name": None,
            "file_number": None,
            "objection_reason": ("case_description",),
        },
        "fields": [
            {"id": "applicant_name", "label": "Ihr Name", "required": True},
            {"id": "applicant_address", "label": "Ihre Adresse", "required": True},
            {"id": "authority_name", "label": "Ausstellende Behörde", "required": True},
            {"id": "file_number", "label": "Aktenzeichen des Bescheids", "required": True},
            {
                "id": "objection_reason",
                "label": "Begründung des Einspruchs",
                "type": "textarea",
                "required": True,
                "placeholder": "z.B. Messfehler, Fahrer war eine andere Person, Verjährung...",
            },
        ],
    },
}

TOPIC_TO_FORM: dict[str, str] = {
    "miete": "mietwiderspruch",
    "mieterhöhung": "mietwiderspruch",
    "mietrecht": "mietwiderspruch",
    "kündigung": "kuendigung-widerspruch",
    "kundigung": "kuendigung-widerspruch",
    "widerspruch": "kuendigung-widerspruch",
    "datenschutz": "datenschutz-auskunft",
    "dsgvo": "datenschutz-auskunft",
    "auskunft": "datenschutz-auskunft",
    "arbeitszeugnis": "arbeitszeugnis",
    "arbeit": "arbeitszeugnis",
    "arbeitsrecht": "arbeitszeugnis",
    "bußgeld": "bussgeld-einspruch",
    "bussgeld": "bussgeld-einspruch",
    "strafe": "bussgeld-einspruch",
    "owig": "bussgeld-einspruch",
    "blitzer": "bussgeld-einspruch",
    "geblitzt": "bussgeld-einspruch",
    "stvg": "bussgeld-einspruch",
    "einspruch": "bussgeld-einspruch",
}


def _compose_value(profile: UserProfile, keys: tuple[str, ...] | None) -> str:
    if not keys:
        return ""
    parts: list[str] = []
    for key in keys:
        val = getattr(profile, key, "")
        if val:
            parts.append(str(val))
    return " ".join(parts).strip()


def build_form(form_id: str, profile: UserProfile) -> LegalForm | None:
    template = FORM_TEMPLATES.get(form_id)
    if not template:
        return None

    fields: list[FormField] = []
    for field_def in template["fields"]:
        field_id = field_def["id"]
        field_map = template.get("field_map", {})
        profile_keys = field_map.get(field_id)
        prefilled = _compose_value(profile, profile_keys) if profile_keys else ""
        prefilled_from = ", ".join(profile_keys) if profile_keys and prefilled else None

        fields.append(
            FormField(
                id=field_id,
                label=field_def["label"],
                type=field_def.get("type", "text"),
                value=prefilled,
                required=field_def.get("required", True),
                placeholder=field_def.get("placeholder", ""),
                options=field_def.get("options", []),
                prefilled_from=prefilled_from,
            )
        )

    return LegalForm(
        id=form_id,
        title=template["title"],
        description=template["description"],
        category=template["category"],
        source_url=template.get("source_url", ""),
        fields=fields,
        legal_basis=template.get("legal_basis", []),
    )


def suggest_forms_for_query(query: str, profile: UserProfile) -> list[LegalForm]:
    query_lower = query.lower()
    matched_ids: list[str] = []

    for keyword, form_id in TOPIC_TO_FORM.items():
        if keyword in query_lower and form_id not in matched_ids:
            matched_ids.append(form_id)

    if profile.legal_topic:
        for keyword, form_id in TOPIC_TO_FORM.items():
            if keyword in profile.legal_topic.lower() and form_id not in matched_ids:
                matched_ids.append(form_id)

    forms = [build_form(fid, profile) for fid in matched_ids[:2]]
    return [f for f in forms if f is not None]


def list_all_forms(profile: UserProfile) -> list[LegalForm]:
    return [build_form(fid, profile) for fid in FORM_TEMPLATES if build_form(fid, profile)]
