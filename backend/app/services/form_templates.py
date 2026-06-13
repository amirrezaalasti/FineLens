import re

from app.models.schemas import Attachment, FormField, LegalForm, UserProfile
from app.services.form_templates_i18n import CATEGORY_LOCALES, FORM_LOCALES

SUPPORTED_FORM_LANGUAGES = frozenset({"de", "en"})

FORM_TEMPLATES: dict[str, dict] = {
    "mietwiderspruch": {
        "title": "Widerspruch gegen Mieterhöhung",
        "description": "Formular zur Geltendmachung eines Widerspruchs gegen eine Mieterhöhung nach § 558 BGB.",
        "category": "Mietrecht",
        "legal_basis": ["§ 558 BGB", "§ 558a BGB"],
        "source_url": "https://www.gesetze-im-internet.de/bgb/__558.html",
        "body_template": """\
{{landlord_name}}
[Straße, PLZ Ort des Vermieters]

{{tenant_city}}, den {{letter_date}}

Widerspruch gegen Mieterhöhung

Sehr geehrte Damen und Herren,

hiermit widerspreche ich Ihrer Mieterhöhungsforderung für die Wohnung
{{rental_address}} (bisherige Kaltmiete: {{current_rent}} €, gefordert: {{proposed_rent}} €)
fristgerecht gemäß § 558 Abs. 4 BGB.

Begründung:
{{objection_reason}}

Mit freundlichen Grüßen

{{tenant_name}}
{{tenant_street}}
{{tenant_city}}
{{tenant_email}}
""",
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
            "letter_date": None,
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
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "kuendigung-widerspruch": {
        "title": "Widerspruch gegen Kündigung",
        "description": "Schreiben zum Widerspruch gegen eine außerordentliche oder ordentliche Kündigung.",
        "category": "Mietrecht",
        "legal_basis": ["§ 574 BGB", "§ 543 BGB"],
        "source_url": "https://www.gesetze-im-internet.de/bgb/__574.html",
        "body_template": """\
{{landlord_name}}
[Straße, PLZ Ort des Vermieters]

{{tenant_city}}, den {{letter_date}}

Widerspruch gegen die Kündigung

Sehr geehrte Damen und Herren,

gegen die mir am {{termination_date}} zugegangene Kündigung meines Mietverhältnisses
über die Wohnung {{tenant_address}} widerspreche ich hiermit fristgerecht.

Begründung:
{{widerspruch_reason}}

Mit freundlichen Grüßen

{{tenant_name}}
{{tenant_address}}
""",
        "field_map": {
            "tenant_name": ("last_name", "first_name"),
            "tenant_address": ("street", "postal_code", "city"),
            "landlord_name": None,
            "termination_date": None,
            "widerspruch_reason": ("case_description",),
            "letter_date": None,
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
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "datenschutz-auskunft": {
        "title": "Auskunftsanfrage nach Art. 15 DSGVO",
        "description": "Anfrage auf Auskunft über gespeicherte personenbezogene Daten.",
        "category": "Datenschutz",
        "legal_basis": ["Art. 15 DSGVO", "Art. 12 DSGVO"],
        "source_url": "https://www.gesetze-im-internet.de/dsgvo/__15.html",
        "body_template": """\
{{company_name}}
[Datenschutz / Kundenservice]
[Straße, PLZ Ort]

{{requester_city}}, den {{letter_date}}

Auskunftsanfrage gemäß Art. 15 DSGVO

Sehr geehrte Damen und Herren,

ich bitte Sie, mir gemäß Art. 15 DSGVO Auskunft über die von mir bei Ihnen
gespeicherten personenbezogenen Daten zu erteilen, insbesondere zu folgenden Kategorien:

{{data_categories}}

Bitte teilen Sie mir mit, zu welchen Zwecken die Daten verarbeitet werden und
ob eine automatisierte Entscheidungsfindung stattfindet.

Mit freundlichen Grüßen

{{requester_name}}
{{requester_address}}
{{requester_email}}
""",
        "field_map": {
            "requester_name": ("last_name", "first_name"),
            "requester_email": ("email",),
            "requester_address": ("street", "postal_code", "city"),
            "requester_city": ("postal_code", "city"),
            "company_name": None,
            "data_categories": ("legal_topic",),
            "letter_date": None,
        },
        "fields": [
            {"id": "requester_name", "label": "Ihr vollständiger Name", "required": True},
            {"id": "requester_email", "label": "E-Mail-Adresse", "type": "email", "required": True},
            {"id": "requester_address", "label": "Ihre Adresse", "required": True},
            {"id": "requester_city", "label": "PLZ und Ort", "required": True},
            {"id": "company_name", "label": "Unternehmen (Datenverantwortlicher)", "required": True},
            {
                "id": "data_categories",
                "label": "Welche Daten möchten Sie einsehen?",
                "type": "textarea",
                "placeholder": "z.B. Kontodaten, Kommunikationsverlauf, Profildaten",
            },
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "arbeitszeugnis": {
        "title": "Anforderung eines qualifizierten Arbeitszeugnisses",
        "description": "Antrag auf Ausstellung eines qualifizierten Arbeitszeugnisses nach § 630 BGB.",
        "category": "Arbeitsrecht",
        "legal_basis": ["§ 630 BGB"],
        "source_url": "https://www.gesetze-im-internet.de/bgb/__630.html",
        "body_template": """\
{{employer_name}}
[Personalabteilung]
[Straße, PLZ Ort]

{{employee_city}}, den {{letter_date}}

Antrag auf qualifiziertes Arbeitszeugnis

Sehr geehrte Damen und Herren,

ich bitte Sie, mir ein qualifiziertes Arbeitszeugnis gemäß § 630 BGB auszustellen.

Beschäftigungszeitraum: {{employment_period}}
Position / Tätigkeit: {{position}}

Mit freundlichen Grüßen

{{employee_name}}
{{employee_address}}
""",
        "field_map": {
            "employee_name": ("last_name", "first_name"),
            "employee_address": ("street", "postal_code", "city"),
            "employee_city": ("postal_code", "city"),
            "employer_name": None,
            "employment_period": None,
            "position": ("legal_topic",),
            "letter_date": None,
        },
        "fields": [
            {"id": "employee_name", "label": "Ihr Name", "required": True},
            {"id": "employee_address", "label": "Ihre Adresse", "required": True},
            {"id": "employee_city", "label": "PLZ und Ort", "required": True},
            {"id": "employer_name", "label": "Arbeitgeber", "required": True},
            {"id": "employment_period", "label": "Beschäftigungszeitraum", "required": True},
            {"id": "position", "label": "Position / Tätigkeit", "required": True},
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "bussgeld-einspruch": {
        "title": "Einspruch gegen Bußgeldbescheid",
        "description": "Fristgerechter Einspruch gegen einen Bußgeldbescheid gem. § 67 OWiG (2 Wochen ab Zustellung).",
        "category": "Verkehrsrecht / Ordnungswidrigkeiten",
        "legal_basis": ["§ 67 OWiG"],
        "source_url": "https://www.gesetze-im-internet.de/owig_1968/__67.html",
        "body_template": """\
{{authority_name}}
[Straße, PLZ Ort der Behörde]

Aktenzeichen: {{file_number}}

{{applicant_city}}, den {{letter_date}}

Einspruch gegen den Bußgeldbescheid

Sehr geehrte Damen und Herren,

gegen den mir am {{notice_date}} zugestellten Bußgeldbescheid
(Aktenzeichen: {{file_number}}) lege ich hiermit fristgerecht Einspruch
gemäß § 67 Abs. 1 OWiG ein.

Begründung:
{{objection_reason}}

Bitte bestätigen Sie den Eingang dieses Einspruchs und teilen Sie mir mit,
wie das weitere Verfahren verläuft.

Mit freundlichen Grüßen

{{applicant_name}}
{{applicant_address}}
""",
        "field_map": {
            "applicant_name": ("last_name", "first_name"),
            "applicant_address": ("street", "postal_code", "city"),
            "applicant_city": ("postal_code", "city"),
            "authority_name": None,
            "file_number": None,
            "notice_date": None,
            "objection_reason": ("case_description",),
            "letter_date": None,
        },
        "fields": [
            {"id": "applicant_name", "label": "Ihr Name", "required": True},
            {"id": "applicant_address", "label": "Ihre Adresse", "required": True},
            {"id": "applicant_city", "label": "PLZ und Ort", "required": True},
            {"id": "authority_name", "label": "Ausstellende Behörde", "required": True},
            {"id": "file_number", "label": "Aktenzeichen des Bescheids", "required": True},
            {"id": "notice_date", "label": "Zustelldatum des Bescheids", "type": "date", "required": True},
            {
                "id": "objection_reason",
                "label": "Begründung des Einspruchs",
                "type": "textarea",
                "required": True,
                "placeholder": "z.B. Messfehler, Fahrer war eine andere Person, Verjährung...",
            },
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "bussgeld-akteneinsicht": {
        "title": "Antrag auf Akteneinsicht (Bußgeldverfahren)",
        "description": "Akteneinsicht vor Einspruch — Messprotokoll, Blitzerfoto und Anhörung prüfen.",
        "category": "Verkehrsrecht / Ordnungswidrigkeiten",
        "legal_basis": ["§ 49 OWiG", "§ 147 StPO"],
        "source_url": "https://www.gesetze-im-internet.de/owig_1968/__49.html",
        "body_template": """\
{{authority_name}}
[Straße, PLZ Ort der Behörde]

Aktenzeichen: {{file_number}}

{{applicant_city}}, den {{letter_date}}

Antrag auf Akteneinsicht

Sehr geehrte Damen und Herren,

in der Angelegenheit mit dem Aktenzeichen {{file_number}} beantrage ich
Akteneinsicht, um den Bußgeldbescheid vom {{notice_date}} prüfen zu können.

Insbesondere bitte ich um Einsicht in:
{{records_requested}}

Bitte teilen Sie mir mit, wann und wo die Akteneinsicht möglich ist oder
übersenden Sie mir Kopien der genannten Unterlagen.

Mit freundlichen Grüßen

{{applicant_name}}
{{applicant_address}}
""",
        "field_map": {
            "applicant_name": ("last_name", "first_name"),
            "applicant_address": ("street", "postal_code", "city"),
            "applicant_city": ("postal_code", "city"),
            "authority_name": None,
            "file_number": None,
            "notice_date": None,
            "records_requested": None,
            "letter_date": None,
        },
        "fields": [
            {"id": "applicant_name", "label": "Ihr Name", "required": True},
            {"id": "applicant_address", "label": "Ihre Adresse", "required": True},
            {"id": "applicant_city", "label": "PLZ und Ort", "required": True},
            {"id": "authority_name", "label": "Ausstellende Behörde", "required": True},
            {"id": "file_number", "label": "Aktenzeichen", "required": True},
            {"id": "notice_date", "label": "Datum des Bußgeldbescheids", "type": "date", "required": True},
            {
                "id": "records_requested",
                "label": "Gewünschte Aktenbestandteile",
                "type": "textarea",
                "required": True,
                "placeholder": "z.B. Messprotokoll, Blitzerfoto, Anhörungsbogen, Bußgeldkatalog-Einstufung",
                "value": "Messprotokoll, Lichtbildnachweise, Anhörungsbogen und Bußgeldbescheid",
            },
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "bussgeld-fahrer-benennen": {
        "title": "Mitteilung des Fahrzeugführers",
        "description": "Fahrer benennen, wenn Sie als Halter/in nicht selbst gefahren sind (§ 31a StVG).",
        "category": "Verkehrsrecht / Ordnungswidrigkeiten",
        "legal_basis": ["§ 31a StVG"],
        "source_url": "https://www.gesetze-im-internet.de/stvg/__31a.html",
        "body_template": """\
{{authority_name}}
[Straße, PLZ Ort der Behörde]

Aktenzeichen: {{file_number}}

{{holder_city}}, den {{letter_date}}

Mitteilung über den Fahrzeugführer gemäß § 31a StVG

Sehr geehrte Damen und Herren,

bezugnehmend auf Ihr Schreiben vom {{inquiry_date}} (Aktenzeichen: {{file_number}})
teile ich mit, dass zum Tatzeitpunkt {{offense_datetime}} das Fahrzeug
{{vehicle_plate}} von folgender Person geführt wurde:

Name: {{driver_name}}
Anschrift: {{driver_address}}
Geburtsdatum: {{driver_birthdate}}

{{additional_note}}

Mit freundlichen Grüßen

{{holder_name}}
{{holder_address}}
""",
        "field_map": {
            "holder_name": ("last_name", "first_name"),
            "holder_address": ("street", "postal_code", "city"),
            "holder_city": ("postal_code", "city"),
            "authority_name": None,
            "file_number": None,
            "inquiry_date": None,
            "offense_datetime": None,
            "vehicle_plate": None,
            "driver_name": None,
            "driver_address": None,
            "driver_birthdate": None,
            "additional_note": None,
            "letter_date": None,
        },
        "fields": [
            {"id": "holder_name", "label": "Name des Fahrzeughalters", "required": True},
            {"id": "holder_address", "label": "Adresse des Halters", "required": True},
            {"id": "holder_city", "label": "PLZ und Ort", "required": True},
            {"id": "authority_name", "label": "Anfragende Behörde", "required": True},
            {"id": "file_number", "label": "Aktenzeichen", "required": True},
            {"id": "inquiry_date", "label": "Datum der Halterabfrage", "type": "date", "required": True},
            {"id": "offense_datetime", "label": "Tatzeitpunkt", "required": True},
            {"id": "vehicle_plate", "label": "Kennzeichen", "required": True},
            {"id": "driver_name", "label": "Name des Fahrers", "required": True},
            {"id": "driver_address", "label": "Adresse des Fahrers", "required": True},
            {"id": "driver_birthdate", "label": "Geburtsdatum des Fahrers", "type": "date", "required": True},
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
    "bafoeg-widerspruch": {
        "title": "Widerspruch gegen BAföG-Rückbescheid",
        "description": "Formular zur Geltendmachung eines Widerspruchs gegen einen BAföG-Rückforderungsbescheid (z.B. vom Bundesverwaltungsamt).",
        "category": "Verwaltungsrecht / BAföG",
        "legal_basis": ["§ 20 BAföG", "§ 45 SGB X", "§ 50 SGB X"],
        "source_url": "https://www.gesetze-im-internet.de/baf_g/__20.html",
        "body_template": """\
{{authority_name}}
[Straße, PLZ Ort der Behörde]

Aktenzeichen / Förderungsnummer: {{file_number}}

{{applicant_city}}, den {{letter_date}}

Widerspruch gegen den Rückforderungsbescheid vom {{notice_date}}

Sehr geehrte Damen und Herren,

hiermit lege ich gegen den o.g. Bescheid, mir zugegangen am {{received_date}}, fristgerecht Widerspruch ein.

Begründung:
{{objection_reason}}

Bitte bestätigen Sie mir den Eingang dieses Widerspruchs schriftlich.

Mit freundlichen Grüßen

{{applicant_name}}
{{applicant_address}}
""",
        "field_map": {
            "applicant_name": ("last_name", "first_name"),
            "applicant_address": ("street", "postal_code", "city"),
            "applicant_city": ("postal_code", "city"),
            "authority_name": None,
            "file_number": None,
            "notice_date": None,
            "received_date": None,
            "objection_reason": ("case_description",),
            "letter_date": None,
        },
        "fields": [
            {"id": "applicant_name", "label": "Ihr Name", "required": True},
            {"id": "applicant_address", "label": "Ihre Adresse", "required": True},
            {"id": "applicant_city", "label": "PLZ und Ort", "required": True},
            {"id": "authority_name", "label": "Ausstellende Behörde (z.B. BVA)", "required": True},
            {"id": "file_number", "label": "Aktenzeichen / Förderungsnummer", "required": True},
            {"id": "notice_date", "label": "Datum des Bescheids", "type": "date", "required": True},
            {"id": "received_date", "label": "Zustelldatum", "type": "date", "required": True},
            {
                "id": "objection_reason",
                "label": "Begründung des Widerspruchs",
                "type": "textarea",
                "required": True,
                "placeholder": "z.B. Die geforderte Summe ist falsch berechnet, Vertrauensschutz nach § 45 SGB X greift...",
            },
            {"id": "letter_date", "label": "Datum des Schreibens", "type": "date", "required": True},
        ],
    },
}

TOPIC_TO_FORM: dict[str, str] = {
    "miete": "mietwiderspruch",
    "mieterhöhung": "mietwiderspruch",
    "mietrecht": "mietwiderspruch",
    "kündigung": "kuendigung-widerspruch",
    "kundigung": "kuendigung-widerspruch",
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
    "geschwindigkeit": "bussgeld-einspruch",
    "verkehr": "bussgeld-einspruch",
    "ordnungswidrigkeit": "bussgeld-einspruch",
    "akteneinsicht": "bussgeld-akteneinsicht",
    "fahrer": "bussgeld-fahrer-benennen",
    "halter": "bussgeld-fahrer-benennen",
    "bafög": "bafoeg-widerspruch",
    "bafoeg": "bafoeg-widerspruch",
    "ausbildungsförderung": "bafoeg-widerspruch",
    "rückbescheid": "bafoeg-widerspruch",
    "bva": "bafoeg-widerspruch",
}

# Document scenarios: when markers match, suggest these forms in order (max 3).
# Order matters: specific document types before broad keyword patterns (e.g. DSGVO).
DOCUMENT_SCENARIO_FORMS: list[tuple[re.Pattern[str], list[str]]] = [
    (
        re.compile(
            r"(bußgeld|bussgeld|bußgeldbescheid|bussgeldbescheid|geldbuße|geldbusse|"
            r"ordnungswidrigkeit|geschwindigkeit|geschwindigkeitsüberschreitung|"
            r"speeding|blitzer|geblitzt|strafzettel|stvg|owig|owi|"
            r"verkehrsverstoß|verkehrsverstoss|fine|ticket|anhörung|anhoerung)",
            re.I,
        ),
        ["bussgeld-einspruch", "bussgeld-akteneinsicht", "bussgeld-fahrer-benennen"],
    ),
    (
        re.compile(
            r"\b(bafög|bafoeg|baföeg|rückbescheid|rueckbescheid|"
            r"ausbildungsförderung|ausbildungsfoerderung|"
            r"darlehenskasse|bva|bundesverwaltungsamt)\b",
            re.I,
        ),
        ["bafoeg-widerspruch"],
    ),
    (
        re.compile(r"\b(mieterhöhung|mieterhoehung|mietzinserhöhung)\b", re.I),
        ["mietwiderspruch"],
    ),
    (
        re.compile(r"\b(kündigung|kundigung|mietkündigung)\b", re.I),
        ["kuendigung-widerspruch"],
    ),
    (
        re.compile(r"\b(dsgvo|datenschutz|personenbezogen)\b", re.I),
        ["datenschutz-auskunft"],
    ),
    (
        re.compile(r"\b(arbeitszeugnis|arbeitgeberzeugnis)\b", re.I),
        ["arbeitszeugnis"],
    ),
]

_GENERIC_DOCUMENT_RE = re.compile(
    r"\b(erkläre?|explain|analysiere|analyze|document|dokument|bescheid|"
    r"was bedeutet|what does|zusammenfass)\b",
    re.I,
)


def _compose_value(profile: UserProfile, keys: tuple[str, ...] | None) -> str:
    if not keys:
        return ""
    parts: list[str] = []
    for key in keys:
        val = getattr(profile, key, "")
        if val:
            parts.append(str(val))
    return " ".join(parts).strip()


def _keyword_in_blob(keyword: str, blob: str) -> bool:
    return bool(re.search(rf"\b{re.escape(keyword)}\b", blob, re.I))


def _build_context_blob(
    message: str,
    attachments: list[Attachment] | None,
    history: list | None = None,
) -> str:
    parts = [message]
    for att in attachments or []:
        parts.append(att.name)
        parts.append(att.content[:6000] if att.content else "")
    for msg in history or []:
        msg_attachments = getattr(msg, "attachments", None) or (
            msg.get("attachments") if isinstance(msg, dict) else None
        )
        for att in msg_attachments or []:
            name = getattr(att, "name", None) or (att.get("name") if isinstance(att, dict) else "")
            content = getattr(att, "content", None) or (
                att.get("content") if isinstance(att, dict) else ""
            )
            parts.append(name or "")
            parts.append((content or "")[:6000])
    return "\n".join(parts).lower()


def render_form_body(form: LegalForm, field_values: dict[str, str] | None = None) -> str:
    """Fill body_template placeholders with field values."""
    if not form.body_template:
        return ""

    values = field_values or {f.id: f.value for f in form.fields}
    body = form.body_template
    for field in form.fields:
        placeholder = "{{" + field.id + "}}"
        value = values.get(field.id, field.value) or f"[{field.label}]"
        body = body.replace(placeholder, value)
    return body.strip()


def _normalize_language(language: str | None, profile: UserProfile | None = None) -> str:
    if language in SUPPORTED_FORM_LANGUAGES:
        return language
    pref = getattr(profile, "preferred_language", None) if profile else None
    if pref in SUPPORTED_FORM_LANGUAGES:
        return pref
    return "de"


def _localized_template(form_id: str, language: str) -> dict | None:
    base = FORM_TEMPLATES.get(form_id)
    if not base:
        return None

    if language == "de":
        return base

    locale_data = FORM_LOCALES.get(language, {}).get(form_id)
    if not locale_data:
        return base

    merged = dict(base)
    for key in ("title", "description", "category", "body_template"):
        if key in locale_data:
            merged[key] = locale_data[key]

    field_overrides = locale_data.get("fields", {})
    if field_overrides:
        merged_fields = []
        for field_def in base["fields"]:
            override = field_overrides.get(field_def["id"], {})
            merged_fields.append({**field_def, **override})
        merged["fields"] = merged_fields

    return merged


def build_form(
    form_id: str,
    profile: UserProfile,
    language: str = "de",
) -> LegalForm | None:
    lang = _normalize_language(language, profile)
    template = _localized_template(form_id, lang)
    if not template:
        return None

    fields: list[FormField] = []
    for field_def in template["fields"]:
        field_id = field_def["id"]
        field_map = template.get("field_map", {})
        profile_keys = field_map.get(field_id)
        prefilled = field_def.get("value") or (
            _compose_value(profile, profile_keys) if profile_keys else ""
        )
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

    category = template["category"]
    if lang != "de":
        category = CATEGORY_LOCALES.get(lang, {}).get(category, category)

    return LegalForm(
        id=form_id,
        title=template["title"],
        description=template["description"],
        category=category,
        source_url=template.get("source_url", ""),
        fields=fields,
        legal_basis=template.get("legal_basis", []),
        body_template=template.get("body_template", ""),
    )


def _append_unique(matched_ids: list[str], form_id: str, limit: int) -> None:
    if len(matched_ids) >= limit:
        return
    if form_id not in matched_ids and form_id in FORM_TEMPLATES:
        matched_ids.append(form_id)


def suggest_forms_for_context(
    message: str,
    profile: UserProfile,
    attachments: list[Attachment] | None = None,
    max_forms: int = 3,
    language: str = "de",
    history: list | None = None,
) -> list[LegalForm]:
    """Suggest forms from message, attachments, and profile — prioritizes document scenarios."""
    all_attachments = list(attachments or [])
    for msg in history or []:
        msg_attachments = getattr(msg, "attachments", None) or (
            msg.get("attachments") if isinstance(msg, dict) else None
        )
        all_attachments.extend(msg_attachments or [])

    blob = _build_context_blob(message, all_attachments)
    matched_ids: list[str] = []
    has_attachment = bool(all_attachments)

    # 1) Document scenario match (highest priority when a file is attached)
    if has_attachment:
        for pattern, form_ids in DOCUMENT_SCENARIO_FORMS:
            if pattern.search(blob):
                for form_id in form_ids:
                    _append_unique(matched_ids, form_id, max_forms)
                lang = _normalize_language(language, profile)
                forms = [build_form(fid, profile, lang) for fid in matched_ids[:max_forms]]
                return [f for f in forms if f is not None]

        # Generic "explain this document" + scenario keywords in filename/content
        if _GENERIC_DOCUMENT_RE.search(message):
            for pattern, form_ids in DOCUMENT_SCENARIO_FORMS:
                if pattern.search(blob):
                    for form_id in form_ids:
                        _append_unique(matched_ids, form_id, max_forms)
                    break

    if matched_ids:
        lang = _normalize_language(language, profile)
        forms = [build_form(fid, profile, lang) for fid in matched_ids[:max_forms]]
        return [f for f in forms if f is not None]

    # 2) Keyword match in full context (word boundaries to avoid false positives)
    for keyword, form_id in TOPIC_TO_FORM.items():
        if _keyword_in_blob(keyword, blob):
            _append_unique(matched_ids, form_id, max_forms)

    # 3) Profile topic
    if profile.legal_topic:
        topic_lower = profile.legal_topic.lower()
        for keyword, form_id in TOPIC_TO_FORM.items():
            if _keyword_in_blob(keyword, topic_lower):
                _append_unique(matched_ids, form_id, max_forms)

    # 4) When any attachment is present but nothing matched, default to objection template
    # if the user asks about a document at all
    if has_attachment and not matched_ids and _GENERIC_DOCUMENT_RE.search(message):
        _append_unique(matched_ids, "bussgeld-einspruch", max_forms)

    lang = _normalize_language(language, profile)
    forms = [build_form(fid, profile, lang) for fid in matched_ids[:max_forms]]
    return [f for f in forms if f is not None]


def suggest_forms_for_query(
    query: str,
    profile: UserProfile,
    language: str = "de",
) -> list[LegalForm]:
    """Backward-compatible wrapper."""
    return suggest_forms_for_context(
        query, profile, attachments=None, max_forms=2, language=language
    )


def list_all_forms(profile: UserProfile, language: str = "de") -> list[LegalForm]:
    lang = _normalize_language(language, profile)
    return [f for fid in FORM_TEMPLATES if (f := build_form(fid, profile, lang))]


def format_forms_section(forms: list[LegalForm], language: str = "de") -> str:
    """Markdown block appended after document analysis in chat."""
    if not forms:
        return ""

    if language == "en":
        lines = [
            "### Suggested templates",
            "",
            "The following ready-to-use letter templates are available under **Forms** "
            "(prefilled from your profile):",
        ]
        for form in forms:
            basis = ", ".join(form.legal_basis)
            lines.append(f"- **{form.title}** — {form.description}" + (f" ({basis})" if basis else ""))
        if any(f.id.startswith("bussgeld") for f in forms):
            lines.append("")
            lines.append(
                "> **Deadline:** Objection to a fine notice must usually be filed within "
                "2 weeks of service (§ 67 OWiG)."
            )
        return "\n".join(lines)

    lines = [
        "### Passende Formulare",
        "",
        "Für Ihren Fall stehen folgende vorformulierte Schreiben bereit "
        "(Tab **Formulare**, vorausgefüllt aus Ihrem Profil):",
    ]
    for form in forms:
        basis = ", ".join(form.legal_basis)
        lines.append(f"- **{form.title}** — {form.description}" + (f" ({basis})" if basis else ""))
    if any(f.id.startswith("bussgeld") for f in forms):
        lines.append("")
        lines.append(
            "> **Frist beachten:** Einspruch gegen einen Bußgeldbescheid i.d.R. innerhalb von "
            "**2 Wochen** ab Zustellung (§ 67 OWiG)."
        )
    return "\n".join(lines)
