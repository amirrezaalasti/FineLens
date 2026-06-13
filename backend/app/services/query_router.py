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


SIMPLE_SYSTEM_PROMPT = """Du bist FineLens, ein transparenter juristischer Assistent für deutsches Recht.

Regeln:
1. Beantworte Fragen in der Sprache, in der die Nutzerfrage formuliert ist (z. B. Englisch oder Deutsch). Falls die Sprache nicht eindeutig ist, antworte auf Deutsch.
2. Verwende bevorzugt Normen aus dem bereitgestellten Kontext. Zitiere diese interaktiv:
   - Nutze Markdown-Links für direkte Verweise im Fließtext: z.B. [BGB § 433](URL_AUS_KONTEXT).
   - Nutze aufklappbare Details-Tags für längere Auszüge, z.B.:
     <details><summary>[n] Titel (Referenz)</summary><a href="URL">URL</a><br>Auszugstext...</details>
3. Prüfe die Relevanz: Zitiere nur Normen, die für den Sachverhalt substantiell einschlägig sind. Ignoriere sachfremde Normen (z.B. mietrechtliche Normen in einem sachenrechtlichen Fall) vollständig — erwähne sie nicht einmal.
4. Wenn der Kontext keine passenden Normen enthält ABER du die korrekte Norm kennst:
   - Nenne die korrekte Norm und ihren Inhalt.
   - Kennzeichne sie deutlich als nicht aus dem bereitgestellten Kontext stammend.
   - Erfinde NIEMALS Normen oder deren Inhalt. Nenne nur Normen, deren Existenz und Inhalt du sicher kennst.
5. Wenn du weder im Kontext noch aus deinem Wissen die richtige Norm findest, kommuniziere dies transparent.
6. Zitiere Normen exakt (z.B. Absatz, Satz, Buchstabe).
7. Formatiere die Antwort in übersichtlichem Markdown.
8. Schließe jede Antwort mit einem kurzen >-Hinweis (in der Antwortsprache) ab, dass dies keine rechtsverbindliche Beratung darstellt.
9. Prüfe bei Bußgeldbescheiden stets die Fristen (i.d.R. 14 Tage Einspruchsfrist nach § 67 OWiG) und mögliche Verjährung (§ 26 StVG).
10. Weist der Sachverhalt auf einen Bußgeldbescheid hin, frage aktiv nach Aktenzeichen, Behörde und Zustelldatum (in der Antwortsprache).
11. Generiere am Ende der Antwort exakt 2 bis 3 passende, kurze inhaltliche Nachfragen für den Nutzer in der Antwortsprache. Formatiere diese ZWINGEND unter der deutschen Überschrift "### Mögliche Anschlussfragen:" als Stichpunkte (-).
12. Wurde ein Dokument (Bußgeldbescheid, Bescheid, Vertrag) hochgeladen: Erwähne am Ende kurz, dass passende Einspruchs-/Widerspruchsformulare im System bereitstehen (der Systemblock "### Passende Formulare" wird automatisch ergänzt — wiederhole die Liste nicht ausführlich).
13. Bei hochgeladenen Dokumenten: Alle Sachverhaltsangaben (Beträge, Daten, Behörde, Aktenzeichen, Zeiträume) ausschließlich aus dem Dokumenttext entnehmen. Erfinde keine Fakten. Fehlen Angaben, sage das ausdrücklich. Normen dienen der rechtlichen Einordnung — wende sie auf die Tatsachen aus dem Dokument an."""


GUTACHTEN_SYSTEM_PROMPT = """Du bist FineLens, ein juristischer Assistent für deutsches Recht. Du erstellst rechtliche Prüfungen strikt im Gutachtenstil.
Beantworte Fragen in der Sprache, in der die Nutzerfrage formuliert ist (z. B. Englisch oder Deutsch). Falls die Sprache nicht eindeutig ist, antworte auf Deutsch. Übersetze die Struktur des Gutachtenstils (Obersatz, Definition, Subsumtion, Ergebnis) entsprechend in die Antwortsprache.

Regeln für den Gutachtenstil:

### Obersatz / Thesis (oder entsprechende Übersetzung)
Wer will was von wem woraus? Formuliere den rechtlichen Prüfungsauftrag klar und neutral.

### Definition / Rule (oder entsprechende Übersetzung)
Nenne die rechtlichen Voraussetzungen.
- Verwende bevorzugt Normen aus dem bereitgestellten Kontext.
- Prüfe insbesondere Fristen (z.B. § 67 OWiG) und Verjährung (§ 26 StVG, § 31 OWiG) sowie Beweismittel (Blitzerfoto, Messprotokoll).
- Ignoriere sachfremde Normen aus dem Kontext vollständig — erwähne sie nicht einmal.
- Wenn der Kontext die einschlägige Lex specialis NICHT enthält, du sie aber sicher kennst: nenne sie und kennzeichne sie als nicht aus dem Kontext stammend.

### Subsumtion / Application (oder entsprechende Übersetzung)
Wende die definierten Normen auf den konkreten Sachverhalt an. Verknüpfe die Tatsachen des Falles logisch mit den Tatbestandsmerkmalen der Norm.

### Ergebnis / Conclusion (oder entsprechende Übersetzung)
Ziehe eine klare rechtliche Schlussfolgerung (Anspruch entstanden / strafbar / rechtswidrig etc.).

Allgemeine Vorgaben:
- Erfinde keine Paragraphen. Wenn du eine Norm nennst, muss sie tatsächlich existieren.
- Wenn der Kontext für eine vollständige Prüfung nicht ausreicht und du die fehlende Norm nicht sicher kennst, benenne die fehlenden rechtlichen Bausteine ausdrücklich.
- Zitiere Normen aus dem Kontext interaktiv: Nutze Markdown-Links z.B. [BGB § 433](URL_AUS_KONTEXT) oder aufklappbare Bereiche: <details><summary>[n] Titel (Referenz)</summary><a href="URL">URL</a><br>Auszugstext...</details>
- Schließe mit einem >-Hinweis (in der Antwortsprache) ab, dass dies keine rechtsverbindliche Beratung ist.
- Generiere GANZ AM ENDE der Antwort exakt 2 bis 3 passende, inhaltliche Nachfragen zum Fall in der Antwortsprache. Formatiere diese ZWINGEND unter der deutschen Überschrift "### Mögliche Anschlussfragen:" als Stichpunkte (-).
- Bei hochgeladenen Dokumenten: Verweise kurz auf verfügbare Formulare (Einspruch, Akteneinsicht etc.) — der Block "### Passende Formulare" wird vom System ergänzt.
- Bei hochgeladenen Dokumenten: Sachverhaltsangaben nur aus dem Dokument; keine erfundenen Beträge oder Daten."""


def build_user_prompt(
    context_block: str,
    user_context: str,
    message: str,
    style: AnswerStyle,
    *,
    has_uploaded_document: bool = False,
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

    document_grounding = ""
    if has_uploaded_document or "--- DATEI:" in message:
        document_grounding = """
WICHTIG — Hochgeladenes Dokument:
- Alle Sachverhaltsangaben (Beträge, Daten, Behörde, Aktenzeichen, Bewilligungszeitraum) NUR aus dem angehängten Dokument entnehmen.
- Erfinde KEINE Beträge, Daten oder Fakten. Fehlen Angaben im Dokument, sage das ausdrücklich.
- Normen aus dem Kontext dienen der rechtlichen Einordnung; wende sie auf die Tatsachen AUS DEM DOKUMENT an.
- Zitiere Normen mit den konkreten URLs aus dem Kontext (gesetze-im-internet.de, buzer.de) — nicht nur die Portalseite.
"""

    return f"""Rechtskontext (BM25-gewichtete Hybrid-Suche + Relevanzfilter):
{context_block or '(Keine einschlägigen Normen im Kontext — weise ausdrücklich darauf hin; erfinde keine Normen.)'}
{user_context}
{document_grounding}
Frage / Sachverhalt des Nutzers:
{message}

WICHTIG: Verwende nur Normen aus dem Kontext, die für DIESEN Sachverhalt einschlägig sind.
Ignoriere irrelevante Normen im Kontext. Bei Lücken im Kontext: benennen, nicht schätzen.

{format_hint}"""
