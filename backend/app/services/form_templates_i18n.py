"""English locale overrides for legal form templates (field ids unchanged)."""

FORM_LOCALES: dict[str, dict[str, dict]] = {
    "en": {
        "mietwiderspruch": {
            "title": "Objection to rent increase",
            "description": "Letter to object to a rent increase under § 558 BGB.",
            "category": "Tenancy law",
            "body_template": """\
{{landlord_name}}
[Landlord street, postal code and city]

{{tenant_city}}, {{letter_date}}

Objection to rent increase

Dear Sir or Madam,

I hereby object within the statutory period pursuant to § 558 para. 4 BGB to your
rent increase demand for the apartment at
{{rental_address}} (current base rent: €{{current_rent}}, requested: €{{proposed_rent}}).

Reasons:
{{objection_reason}}

Yours sincerely,

{{tenant_name}}
{{tenant_street}}
{{tenant_city}}
{{tenant_email}}
""",
            "fields": {
                "tenant_name": {"label": "Tenant name"},
                "tenant_street": {"label": "Street and house number"},
                "tenant_city": {"label": "Postal code and city"},
                "tenant_email": {"label": "Email"},
                "landlord_name": {"label": "Landlord name"},
                "rental_address": {"label": "Rental apartment address"},
                "current_rent": {"label": "Current base rent (€)"},
                "proposed_rent": {"label": "Requested new rent (€)"},
                "objection_reason": {
                    "label": "Reason for objection",
                    "placeholder": "e.g. The increase exceeds the local comparative rent...",
                },
                "letter_date": {"label": "Date of letter"},
            },
        },
        "kuendigung-widerspruch": {
            "title": "Objection to termination notice",
            "description": "Letter to object to an ordinary or extraordinary termination of tenancy.",
            "category": "Tenancy law",
            "body_template": """\
{{landlord_name}}
[Landlord street, postal code and city]

{{tenant_city}}, {{letter_date}}

Objection to termination notice

Dear Sir or Madam,

I hereby object within the statutory period to the termination of my tenancy
for the apartment at {{tenant_address}}, which I received on {{termination_date}}.

Reasons:
{{widerspruch_reason}}

Yours sincerely,

{{tenant_name}}
{{tenant_address}}
""",
            "fields": {
                "tenant_name": {"label": "Name"},
                "tenant_address": {"label": "Your address"},
                "landlord_name": {"label": "Landlord"},
                "termination_date": {"label": "Date of termination notice"},
                "widerspruch_reason": {
                    "label": "Reason (e.g. hardship under § 574 BGB)",
                },
                "letter_date": {"label": "Date of letter"},
            },
        },
        "datenschutz-auskunft": {
            "title": "Data access request under Art. 15 GDPR",
            "description": "Request access to stored personal data.",
            "category": "Data protection",
            "body_template": """\
{{company_name}}
[Data protection / customer service]
[Street, postal code and city]

{{requester_city}}, {{letter_date}}

Data access request pursuant to Art. 15 GDPR

Dear Sir or Madam,

I request that you provide me with information pursuant to Art. 15 GDPR about the
personal data you hold about me, in particular regarding the following categories:

{{data_categories}}

Please also inform me of the purposes of processing and whether automated
decision-making takes place.

Yours sincerely,

{{requester_name}}
{{requester_address}}
{{requester_email}}
""",
            "fields": {
                "requester_name": {"label": "Your full name"},
                "requester_email": {"label": "Email address"},
                "requester_address": {"label": "Your address"},
                "requester_city": {"label": "Postal code and city"},
                "company_name": {"label": "Company (data controller)"},
                "data_categories": {
                    "label": "Which data would you like to access?",
                    "placeholder": "e.g. account data, communication history, profile data",
                },
                "letter_date": {"label": "Date of letter"},
            },
        },
        "arbeitszeugnis": {
            "title": "Request for a qualified work reference",
            "description": "Request issuance of a qualified work reference under § 630 BGB.",
            "category": "Employment law",
            "body_template": """\
{{employer_name}}
[HR department]
[Street, postal code and city]

{{employee_city}}, {{letter_date}}

Request for qualified work reference

Dear Sir or Madam,

I request that you issue me a qualified work reference pursuant to § 630 BGB.

Period of employment: {{employment_period}}
Position / role: {{position}}

Yours sincerely,

{{employee_name}}
{{employee_address}}
""",
            "fields": {
                "employee_name": {"label": "Your name"},
                "employee_address": {"label": "Your address"},
                "employee_city": {"label": "Postal code and city"},
                "employer_name": {"label": "Employer"},
                "employment_period": {"label": "Period of employment"},
                "position": {"label": "Position / role"},
                "letter_date": {"label": "Date of letter"},
            },
        },
        "bussgeld-einspruch": {
            "title": "Objection to fine notice",
            "description": "Timely objection to a fine notice under § 67 OWiG (2 weeks from service).",
            "category": "Traffic / regulatory offences",
            "body_template": """\
{{authority_name}}
[Authority street, postal code and city]

File reference: {{file_number}}

{{applicant_city}}, {{letter_date}}

Objection to fine notice

Dear Sir or Madam,

I hereby lodge a timely objection pursuant to § 67 para. 1 OWiG against the fine notice
(file reference: {{file_number}}) served on me on {{notice_date}}.

Reasons:
{{objection_reason}}

Please confirm receipt of this objection and inform me of the next steps in the proceedings.

Yours sincerely,

{{applicant_name}}
{{applicant_address}}
""",
            "fields": {
                "applicant_name": {"label": "Your name"},
                "applicant_address": {"label": "Your address"},
                "applicant_city": {"label": "Postal code and city"},
                "authority_name": {"label": "Issuing authority"},
                "file_number": {"label": "File reference of the notice"},
                "notice_date": {"label": "Date the notice was served"},
                "objection_reason": {
                    "label": "Reason for objection",
                    "placeholder": "e.g. measurement error, different driver, limitation period...",
                },
                "letter_date": {"label": "Date of letter"},
            },
        },
        "bussgeld-akteneinsicht": {
            "title": "Request for file inspection (fine proceedings)",
            "description": "Inspect the file before objecting — measurement log, photo, and hearing record.",
            "category": "Traffic / regulatory offences",
            "body_template": """\
{{authority_name}}
[Authority street, postal code and city]

File reference: {{file_number}}

{{applicant_city}}, {{letter_date}}

Request for file inspection

Dear Sir or Madam,

in the matter with file reference {{file_number}}, I request file inspection
in order to review the fine notice dated {{notice_date}}.

In particular, I request access to:
{{records_requested}}

Please inform me when and where file inspection is possible or send me copies
of the documents listed above.

Yours sincerely,

{{applicant_name}}
{{applicant_address}}
""",
            "fields": {
                "applicant_name": {"label": "Your name"},
                "applicant_address": {"label": "Your address"},
                "applicant_city": {"label": "Postal code and city"},
                "authority_name": {"label": "Issuing authority"},
                "file_number": {"label": "File reference"},
                "notice_date": {"label": "Date of fine notice"},
                "records_requested": {
                    "label": "Requested file contents",
                    "placeholder": "e.g. measurement log, speed camera photo, hearing form, fine category",
                    "value": "Measurement log, photographic evidence, hearing form, and fine notice",
                },
                "letter_date": {"label": "Date of letter"},
            },
        },
        "bussgeld-fahrer-benennen": {
            "title": "Notification of driver",
            "description": "Name the driver if you as the registered keeper did not drive (§ 31a StVG).",
            "category": "Traffic / regulatory offences",
            "body_template": """\
{{authority_name}}
[Authority street, postal code and city]

File reference: {{file_number}}

{{holder_city}}, {{letter_date}}

Notification of driver pursuant to § 31a StVG

Dear Sir or Madam,

with reference to your letter dated {{inquiry_date}} (file reference: {{file_number}}),
I hereby notify you that at the time of the offence {{offense_datetime}} the vehicle
{{vehicle_plate}} was driven by the following person:

Name: {{driver_name}}
Address: {{driver_address}}
Date of birth: {{driver_birthdate}}

{{additional_note}}

Yours sincerely,

{{holder_name}}
{{holder_address}}
""",
            "fields": {
                "holder_name": {"label": "Registered keeper name"},
                "holder_address": {"label": "Keeper address"},
                "holder_city": {"label": "Postal code and city"},
                "authority_name": {"label": "Requesting authority"},
                "file_number": {"label": "File reference"},
                "inquiry_date": {"label": "Date of keeper inquiry"},
                "offense_datetime": {"label": "Time of offence"},
                "vehicle_plate": {"label": "License plate"},
                "driver_name": {"label": "Driver name"},
                "driver_address": {"label": "Driver address"},
                "driver_birthdate": {"label": "Driver date of birth"},
                "additional_note": {"label": "Additional information (optional)"},
                "letter_date": {"label": "Date of letter"},
            },
        },
    },
}

CATEGORY_LOCALES: dict[str, dict[str, str]] = {
    "en": {
        "Mietrecht": "Tenancy law",
        "Datenschutz": "Data protection",
        "Arbeitsrecht": "Employment law",
        "Verkehrsrecht / Ordnungswidrigkeiten": "Traffic / regulatory offences",
    },
}
