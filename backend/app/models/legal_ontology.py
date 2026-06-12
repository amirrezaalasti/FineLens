"""Custom Graphiti ontology for German legal corpora."""

from pydantic import BaseModel, Field

LEGAL_EXTRACTION_INSTRUCTIONS = """
Du extrahierst aus deutschen Rechtstexten (Open Legal Data, Gesetze im Internet, buzer.de).

Regeln:
1. Jede Gesetzesnorm als LegalNorm mit exakter Zitierung (z.B. „§ 179 Abs. 3 S. 2 BGB").
2. Tatbestandsmerkmale als eigene Entitäten (z.B. „herrenlos", „Abhandenkommen", „gutgläubig").
3. Rechtsfolgen als eigene Entitäten (z.B. „Schadensersatz", „Herausgabeanspruch").
4. Spezifische Rechtsobjekte als LegalSubject (z.B. „Biene", „Schwarm", „Mietsache", „Fundstück", „Bienenstock").
   WICHTIG: Extrahiere JEDES spezifische Objekt/Tier/Sache das im Normtext vorkommt als LegalSubject.
   Beispiele: Biene, Schwarm, Bienenstock, Grundstück, Mietsache, Fundstück, Schiff, Fahrzeug.
5. Verknüpfe LegalNorm --REQUIRES--> Tatbestandsmerkmal wenn die Norm das Merkmal voraussetzt.
6. Verknüpfe LegalNorm --IMPLIES--> Rechtsfolge wenn die Norm diese Folge anordnet.
7. Verknüpfe LegalNorm --REFERENCES--> LegalNorm bei Verweisungsstil (z.B. „entsprechend § 818").
8. Verknüpfe LegalNorm --APPLIES_TO--> LegalSubject wenn die Norm sich auf dieses Objekt bezieht
   (z.B. § 961 BGB --APPLIES_TO--> Biene, § 961 BGB --APPLIES_TO--> Schwarm).
9. Keine generischen PERSON/ORGANIZATION-Entitäten — nur juristische Begriffe.
"""


class LegalNorm(BaseModel):
    """Statutory provision, e.g. § 961 BGB."""

    citation: str = Field(description="Full citation, e.g. § 179 Abs. 3 S. 2 BGB")
    law_code: str = Field(description="Statute code, e.g. BGB, StGB, DSGVO")
    paragraph: str = Field(description="Paragraph number, e.g. 961 or 179")
    absatz: str | None = Field(default=None, description="Absatz number if present")
    satz: str | None = Field(default=None, description="Satz number if present")
    title: str | None = Field(default=None, description="Short title of the norm")


class Tatbestandsmerkmal(BaseModel):
    """Requirement element of a legal norm (Tatbestandsmerkmal)."""

    term: str = Field(description="German legal term, e.g. herrenlos, Abhandenkommen")
    definition: str | None = Field(default=None, description="Brief definition from the text")


class Rechtsfolge(BaseModel):
    """Legal consequence (Rechtsfolge)."""

    consequence: str = Field(description="e.g. Schadensersatz, Herausgabeanspruch, Kündigung")
    norm_reference: str | None = Field(
        default=None, description="Source norm if stated, e.g. § 818 BGB"
    )


class LegalSubject(BaseModel):
    """Specific real-world subject governed by a norm (e.g., Biene, Mietsache, Fundstück)."""

    term: str = Field(description="German noun, e.g. Biene, Schwarm, Fundstück, Mietsache")
    category: str | None = Field(
        default=None, description="Category: Tier, Sache, Person, Recht, Objekt"
    )


class RequiresRelation(BaseModel):
    """LegalNorm REQUIRES Tatbestandsmerkmal."""

    description: str = Field(
        description="Why this requirement applies, e.g. Voraussetzung für Anspruch"
    )


class ImpliesRelation(BaseModel):
    """LegalNorm IMPLIES Rechtsfolge."""

    description: str = Field(description="How the consequence follows from the norm")


class ReferencesRelation(BaseModel):
    """Cross-reference between norms (Verweisungsstil)."""

    reference_type: str = Field(
        default="Verweisung",
        description="e.g. Verweisung, entsprechende Anwendung, Sonderregelung",
    )


class AppliesToRelation(BaseModel):
    """LegalNorm APPLIES_TO LegalSubject — norm governs this specific subject."""

    description: str = Field(
        description="How the norm relates to this subject, e.g. regelt Eigentum an Bienenschwärmen"
    )


LEGAL_ENTITY_TYPES: dict[str, type[BaseModel]] = {
    "LegalNorm": LegalNorm,
    "Tatbestandsmerkmal": Tatbestandsmerkmal,
    "Rechtsfolge": Rechtsfolge,
    "LegalSubject": LegalSubject,
}

LEGAL_EDGE_TYPES: dict[str, type[BaseModel]] = {
    "REQUIRES": RequiresRelation,
    "IMPLIES": ImpliesRelation,
    "REFERENCES": ReferencesRelation,
    "APPLIES_TO": AppliesToRelation,
}

LEGAL_EDGE_TYPE_MAP: dict[tuple[str, str], list[str]] = {
    ("LegalNorm", "Tatbestandsmerkmal"): ["REQUIRES"],
    ("LegalNorm", "Rechtsfolge"): ["IMPLIES"],
    ("LegalNorm", "LegalNorm"): ["REFERENCES"],
    ("LegalNorm", "LegalSubject"): ["APPLIES_TO"],
    ("Tatbestandsmerkmal", "Rechtsfolge"): ["IMPLIES"],
    ("LegalSubject", "LegalNorm"): ["APPLIES_TO"],
    ("Entity", "Entity"): ["REFERENCES", "REQUIRES", "IMPLIES", "APPLIES_TO"],
}

LEGAL_EXCLUDED_ENTITY_TYPES: list[str] = []
