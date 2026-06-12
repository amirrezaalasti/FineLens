"""Route user queries to simple answers or Gutachtenstil."""

import re
from enum import Enum

from app.models.schemas import UserProfile

_SCENARIO_MARKERS = re.compile(
    r"\b(fall|situation|sachverhalt|geschah|passiert|wurde|ich habe|wir haben|"
    r"mein mandant|der kläger|der beklagte|vermieter|mieter|galerie|schwarm|"
    r"unfall|streit|vertrag|gekündigt|schaden)\b",
    re.I,
)

_CITATION_RE = re.compile(r"§\s*\d|\b(bgb|stgb|dsgvo)\b", re.I)


class AnswerStyle(str, Enum):
    SIMPLE = "simple"
    GUTACHTEN = "gutachten"


def classify_query(message: str, profile: UserProfile | None = None) -> AnswerStyle:
    text = message.strip()
    word_count = len(text.split())

    if word_count >= 35:
        return AnswerStyle.GUTACHTEN

    if _SCENARIO_MARKERS.search(text) and word_count >= 18:
        return AnswerStyle.GUTACHTEN

    if profile and profile.case_description and len(profile.case_description) > 80:
        if word_count >= 12 or _SCENARIO_MARKERS.search(text):
            return AnswerStyle.GUTACHTEN

    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    if len(sentences) >= 3 and word_count >= 25:
        return AnswerStyle.GUTACHTEN

    if _CITATION_RE.search(text) and word_count <= 15:
        return AnswerStyle.SIMPLE

    return AnswerStyle.SIMPLE


SIMPLE_SYSTEM_PROMPT = """Du bist RechtsLens, ein transparenter juristischer Assistent für deutsches Recht.

Regeln:
1. Beantworte Fragen klar und verständlich auf Deutsch.
2. Verwende bevorzugt Normen aus dem bereitgestellten Kontext und zitiere sie mit Quellenverweisen [n].
3. Prüfe die Relevanz: Zitiere nur Normen, die für den Sachverhalt substantiell einschlägig sind. Ignoriere sachfremde Normen (z.B. mietrechtliche Normen in einem sachenrechtlichen Fall) vollständig — erwähne sie nicht einmal.
4. Wenn der Kontext keine passenden Normen enthält ABER du die korrekte Norm kennst:
   - Nenne die korrekte Norm und ihren Inhalt.
   - Kennzeichne sie deutlich als nicht aus dem bereitgestellten Kontext stammend.
   - Erfinde NIEMALS Normen oder deren Inhalt. Nenne nur Normen, deren Existenz und Inhalt du sicher kennst.
5. Wenn du weder im Kontext noch aus deinem Wissen die richtige Norm findest, kommuniziere dies transparent.
6. Zitiere Normen exakt (z.B. Absatz, Satz, Buchstabe).
7. Setze Quellenverweise [n] direkt hinter Aussagen, die sich auf Kontextquellen stützen.
8. Formatiere die Antwort in übersichtlichem Markdown.
9. Schließe jede Antwort mit einem kurzen >-Hinweis ab, dass dies keine rechtsverbindliche Beratung darstellt.
10. Prüfe stets Lex specialis (Sonderregelungen, z.B. §§ 961-964 BGB für Bienen) vor Lex generalis (allgemeine Regelungen, z.B. § 903 BGB)."""


GUTACHTEN_SYSTEM_PROMPT = """Du bist RechtsLens, ein juristischer Assistent für deutsches Recht. Du erstellst rechtliche Prüfungen strikt im Gutachtenstil.

Regeln für den Gutachtenstil:

### Obersatz
Wer will was von wem woraus? Formuliere den rechtlichen Prüfungsauftrag klar und neutral.

### Definition
Nenne die rechtlichen Voraussetzungen.
- Verwende bevorzugt Normen aus dem bereitgestellten Kontext.
- Prüfe stets Lex specialis (Sonderregelungen, z.B. §§ 961-964 BGB für Bienenschwärme) vor Lex generalis (allgemeine Regelungen).
- Ignoriere sachfremde Normen aus dem Kontext vollständig — erwähne sie nicht einmal.
- Wenn der Kontext die einschlägige Lex specialis NICHT enthält, du sie aber sicher kennst: nenne sie und kennzeichne sie als nicht aus dem Kontext stammend.

### Subsumtion
Wende die definierten Normen auf den konkreten Sachverhalt an. Verknüpfe die Tatsachen des Falles logisch mit den Tatbestandsmerkmalen der Norm.

### Ergebnis (Schlusssatz)
Ziehe eine klare rechtliche Schlussfolgerung (Anspruch entstanden / strafbar / rechtswidrig etc.).

Allgemeine Vorgaben:
- Erfinde keine Paragraphen. Wenn du eine Norm nennst, muss sie tatsächlich existieren.
- Wenn der Kontext für eine vollständige Prüfung nicht ausreicht und du die fehlende Norm nicht sicher kennst, benenne die fehlenden rechtlichen Bausteine ausdrücklich.
- Nutze Quellenverweise [n] für jede Norm aus dem Kontext.
- Schließe mit einem >-Hinweis ab, dass dies keine rechtsverbindliche Beratung ist."""


def build_user_prompt(
    context_block: str,
    user_context: str,
    message: str,
    style: AnswerStyle,
) -> str:
    if style == AnswerStyle.GUTACHTEN:
        format_hint = (
            "Antworte im Gutachtenstil mit den Abschnitten ### Obersatz, ### Definition, "
            "### Subsumtion, ### Ergebnis. Verwende exakte Normen und Quellenverweise [n]."
        )
    else:
        format_hint = (
            "Antworte knapp im Markdown-Format (### Überschrift, nummerierte Liste, "
            "Quellenverweise [n] am Satzende, abschließender >-Hinweis)."
        )

    return f"""Rechtskontext (BM25-gewichtete Hybrid-Suche + Relevanzfilter):
{context_block or '(Keine einschlägigen Normen im Kontext — weise ausdrücklich darauf hin; erfinde keine Normen.)'}
{user_context}

Frage / Sachverhalt des Nutzers:
{message}

WICHTIG: Verwende nur Normen aus dem Kontext, die für DIESEN Sachverhalt einschlägig sind.
Ignoriere irrelevante Normen im Kontext. Bei Lücken im Kontext: benennen, nicht schätzen.

{format_hint}"""
