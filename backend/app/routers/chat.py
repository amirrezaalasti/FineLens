import base64
import io
import json
import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from openai import AsyncOpenAI
from pathlib import Path
import pypdf

from app.config import settings
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
from app.models.schemas import (
    Attachment,
    ChatRequest,
    ChatResponse,
    ChatSession,
    ChatSessionSummary,
    CreateChatSessionRequest,
    DocumentAnalysis,
    ExtractedField,
)
from app.services.chat_service import generate_answer
from app.services.chat_store import (
    create_session,
    delete_session,
    get_session,
    list_sessions,
)

router = APIRouter(prefix="/chat", tags=["chat"])


SYSTEM_PROMPT = """Du bist ein präziser deutscher Rechtsdokumenten-Analysator.
Deine Aufgabe ist es, das hochgeladene Dokument (z. B. Bußgeldbescheid, Anhörungsbogen, Zeugenfragebogen, Strafbefehl, Klageschrift, BAföG-Bescheid, Rückforderungsbescheid, etc.) umfassend und detailgenau zu analysieren.
Extrahiere JEDES relevante Detail und jede Schlüsselinformation als separates Feld in der Liste `fields`. Sei so gründlich und präzise wie möglich.

Passe die Namen der extrahierten Felder flexibel an den Dokumententyp an. Nutze kurze, prägnante Feldnamen (keine langen Slashes wie "Aktenzeichen / Geschäftszeichen").

Empfohlene Felder je nach Dokumententyp:

1. Für alle Dokumente (Metadaten):
- Dokumententyp (z.B. "Bußgeldbescheid", "Anhörungsbogen", "Strafbefehl", "Rückforderungsbescheid", "BAföG-Bescheid")
- Aktenzeichen (z.B. "2026-BAF-004711", "302.3492.2")
- Behörde (z.B. "Amt für Ausbildungsförderung", "Bußgeldstelle")
- Datum (Ausstellungsdatum des Schreibens, z.B. "13.06.2026")
- Empfänger (z.B. Name des Empfängers)
- Rechtsgrundlage (z.B. "§ 20 Abs. 1 BAföG", "§ 24 StVG")

2. Spezifisch für Bußgeldbescheide / Anhörungsbögen / Strafzettel (Verkehrsrecht / Ordnungswidrigkeiten):
- Tatvorwurf (z.B. "Geschwindigkeitsüberschreitung...")
- Tatzeit (z.B. "05.06.2026, 14:32 Uhr")
- Tatort (z.B. "Hannover, Hildesheimer Straße...")
- Fahrzeug (z.B. "PKW")
- Kennzeichen (z.B. "H-XX 1234")
- Geldbuße (z.B. "70,00 EUR")
- Gebühren (z.B. "25,00 EUR")
- Auslagen (z.B. "3,50 EUR")
- Gesamtbetrag (z.B. "98,50 EUR")
- Punkte (z.B. "1 Punkt" oder "keine")
- Fahrverbot (z.B. "1 Monat" oder "keines")
- Beweismittel (z.B. "Frontfoto")
- Zeuge (z.B. "POM Müller")

3. Spezifisch für BAföG-Bescheide, Rückforderungsbescheide oder andere Rückforderungsverfahren (Verwaltungsrecht):
- Rückforderungsgrund (z.B. "Einkommensanrechnung aus Erwerbstätigkeit")
- Zeitraum (relevanter Rückforderungs- oder Bewilligungszeitraum, z.B. "Oktober 2024 bis Dezember 2024" oder "01.10.2024 bis 31.07.2025")
- Rückforderungsbetrag (oder Gesamtbetrag, z.B. "1.560,00 EUR")

4. Frist (für JEDES Dokument):
- Frist (z.B. "2 Wochen", "1 Monat")

WICHTIGE JURISTISCHE REGEL ZU FEHLENDE FRISTEN ODER RECHTSBEHELFSBELEHRUNGEN (Z. B. WIDERSPRUCHSBELEHRUNG):
Ein deutscher Bescheid (wie BAföG-Bescheid, Rückforderungsbescheid, Bußgeldbescheid, etc.) ist ein Verwaltungsakt und muss zwingend eine Rechtsbehelfsbelehrung (Widerspruchsbelehrung oder Einspruchsbelehrung) enthalten, die die Frist nennt.
- Wenn im Dokument KEINE Rechtsbehelfsbelehrung/Widerspruchsbelehrung und keine explizite Frist genannt wird, erfordert das deutsche Recht (§ 58 Abs. 2 VwGO) eine gesetzliche Frist von 1 Jahr statt der üblichen Frist von 1 Monat.
- In diesem Fall MUSST du zwingend für das Feld "Frist" als Wert Folgendes angeben:
  "1 Jahr (da Rechtsbehelfsbelehrung fehlt, § 58 Abs. 2 VwGO)"
- Wenn eine Widerspruchsfrist/Einspruchsfrist genannt wird, extrahiere sie wie üblich (z. B. "1 Monat", "2 Wochen").
- Setze für solche rechtlich hergeleiteten Werte die `box` auf null, da sie nicht direkt im Text stehen, sondern rechtlich abgeleitet sind.
- Gib NIEMALS "nicht erwähnt", "keine" oder null für das Feld "Frist" an, wenn das Dokument ein Bescheid ist und die Rechtsbehelfsbelehrung fehlt! Trage immer die gesetzliche 1-Jahres-Frist nach § 58 Abs. 2 VwGO ein.

Gib die extrahierten Informationen als valides JSON-Objekt mit folgender Struktur zurück:
{
  "fields": [
    {
      "field_name": "Name des Feldes", // Verwende kurze Namen wie "Aktenzeichen", "Behörde", "Datum", "Tatvorwurf", "Rückforderungsgrund", "Frist", etc.
      "value": "Wert des Feldes im Dokument", // Der exakte Textwert aus dem Dokument (oder der hergeleitete Frist-Wert)
      "box": [ymin, xmin, ymax, xmax], // Bounding Box Koordinaten als Integer im Bereich 0 bis 1000 (normalisiert auf die Bildhöhe/Bildbreite)
      "confidence": 0.95, // geschätztes Vertrauen zwischen 0.0 und 1.0
      "is_pii": true // true, wenn es sich um personenbezogene Daten handelt (z.B. Name des Empfängers, Anschrift/Adresse, Kennzeichen, Geburtsdatum, Telefon, E-Mail), ansonsten false
    }
  ],
  "raw_text": "Vollständige Transkription des Dokuments..."
}

WICHTIG zu den Koordinaten in `box`:
- Die Koordinaten müssen auf einer Skala von 0 bis 1000 angegeben werden (0 ist oben/links, 1000 ist unten/rechts).
- ymin: Abstand vom oberen Rand (0-1000)
- xmin: Abstand vom linken Rand (0-1000)
- ymax: Unterer Rand der Box (0-1000)
- xmax: Rechter Rand der Box (0-1000)
- Die Boxen müssen das Feld auf dem Bild genau umschließen.
- Wenn das Dokument kein Bild ist oder keine Koordinaten bestimmt werden können (z.B. bei rechtlich abgeleiteten Werten), setze `box` auf null.
"""


def _rect_to_box(page, rect) -> list[float]:
    pw = page.rect.width
    ph = page.rect.height

    top = (rect.y0 / ph) * 100.0
    left = (rect.x0 / pw) * 100.0
    width = ((rect.x1 - rect.x0) / pw) * 100.0
    height = ((rect.y1 - rect.y0) / ph) * 100.0

    # Apply minimum sizes for UI rendering
    width = max(width, 3.0)
    height = max(height, 2.0)

    # Cap boundaries between 0 and 100%
    top = max(0.0, min(100.0, top))
    left = max(0.0, min(100.0, left))
    width = max(0.0, min(100.0 - left, width))
    height = max(0.0, min(100.0 - top, height))

    return [top, left, width, height]


def find_text_coordinates(page, value: str) -> list[list[float]] | None:
    if not page or not value:
        return None
    val = value.strip()
    if not val:
        return None

    # Clean and split target value into words
    def clean_word(w: str) -> str:
        return "".join(c for c in w.lower() if c.isalnum())

    def words_match(t_word: str, p_word: str) -> bool:
        # Enforce exact match for numeric tokens or short words (length < 5)
        is_numeric = any(c.isdigit() for c in t_word) or any(c.isdigit() for c in p_word)
        allow_substring = not is_numeric and len(t_word) >= 5 and len(p_word) >= 5
        
        if allow_substring:
            return t_word == p_word or t_word in p_word or p_word in t_word
        else:
            return t_word == p_word

    target_words = [clean_word(w) for w in val.split()]
    target_words = [w for w in target_words if w]
    if not target_words:
        return None

    # Get all words from the PDF page
    # Tuple format: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
    try:
        page_words = page.get_text("words")
    except Exception:
        return None

    if not page_words:
        return None

    # Find matching sequence of words
    n_target = len(target_words)
    best_match_indices = []

    # 1. Contiguous matching
    for i in range(len(page_words) - n_target + 1):
        match = True
        for j in range(n_target):
            p_word = clean_word(page_words[i + j][4])
            t_word = target_words[j]
            if not words_match(t_word, p_word):
                match = False
                break
        if match:
            best_match_indices = list(range(i, i + n_target))
            break

    # 2. Window-based matching with small gaps (allow up to 3 skipped intermediate words, e.g. OCR/formatting linebreaks)
    if not best_match_indices and n_target > 1:
        max_window = n_target + 3
        for i in range(len(page_words) - max_window + 1):
            matches = []
            curr_target_idx = 0
            for k in range(max_window):
                if i + k >= len(page_words):
                    break
                p_word = clean_word(page_words[i + k][4])
                t_word = target_words[curr_target_idx]
                if words_match(t_word, p_word):
                    matches.append(i + k)
                    curr_target_idx += 1
                    if curr_target_idx == n_target:
                        break
            if len(matches) == n_target:
                best_match_indices = matches
                break

    # 3. Fallback: If no sequence is found, search exact match or fallback to single search
    if not best_match_indices:
        val_clean = val.rstrip(".,;: ")
        rects = page.search_for(val_clean)
        if rects:
            return [_rect_to_box(page, r) for r in rects[:1]]
        
        # Split and fallback to searching chunks
        chunks = [c.strip(".,;:()[] ") for c in val_clean.split()]
        chunks = [c for c in chunks if len(c) >= 4]
        for chunk in chunks:
            # Skip short numeric chunks in fallback to prevent matching unrelated numbers
            if any(c.isdigit() for c in chunk) and len(chunk) < 5:
                continue
            rects = page.search_for(chunk)
            if rects:
                return [_rect_to_box(page, rects[0])]
        return None

    # Group matched words by line_no
    from collections import defaultdict
    import fitz
    
    # Group by block_no and line_no to keep line segments distinct
    lines = defaultdict(list)
    for idx in best_match_indices:
        word_tuple = page_words[idx]
        block_no = word_tuple[5]
        line_no = word_tuple[6]
        lines[(block_no, line_no)].append(word_tuple)

    boxes = []
    # Sort lines by top coordinate of the first word to preserve reading order
    sorted_keys = sorted(lines.keys(), key=lambda k: lines[k][0][1])
    for key in sorted_keys:
        word_list = lines[key]
        x0 = min(w[0] for w in word_list)
        y0 = min(w[1] for w in word_list)
        x1 = max(w[2] for w in word_list)
        y1 = max(w[3] for w in word_list)
        
        rect = fitz.Rect(x0, y0, x1, y1)
        boxes.append(_rect_to_box(page, rect))

    return boxes


async def extract_file_content(file: UploadFile) -> DocumentAnalysis:
    content_type = file.content_type or ""
    filename = file.filename or ""
    file_bytes = await file.read()

    if not file_bytes:
        return DocumentAnalysis(fields=[], raw_text="", preview_image_url=None)

    # Save original file bytes for on-demand redaction later
    if filename:
        try:
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            (UPLOAD_DIR / filename).write_bytes(file_bytes)
        except Exception as e_save:
            print(f"Warnung: Datei {filename} konnte nicht gespeichert werden: {e_save}")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    preview_image_url = None
    preview_image_urls = []
    raw_text = ""
    is_vision = False
    image_input_url = None

    doc = None
    first_page = None
    is_pdf = False

    try:
        if content_type.startswith("image/"):
            base64_image = base64.b64encode(file_bytes).decode("utf-8")
            preview_image_url = f"data:{content_type};base64,{base64_image}"
            preview_image_urls = [preview_image_url]
            image_input_url = preview_image_url
            is_vision = True

        elif content_type == "application/pdf" or filename.lower().endswith(".pdf"):
            try:
                # Load PDF using PyMuPDF (fitz)
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                is_pdf = True

                # Extract raw text from all pages
                text_pages = []
                for page in doc:
                    text_pages.append(page.get_text())
                raw_text = "\n".join(text_pages).strip()
                
                # Generate preview images for all pages
                for p_idx in range(len(doc)):
                    page = doc[p_idx]
                    pix = page.get_pixmap(dpi=150)
                    png_bytes = pix.tobytes("png")
                    base64_img = base64.b64encode(png_bytes).decode("utf-8")
                    preview_image_urls.append(f"data:image/png;base64,{base64_img}")
                
                if len(doc) > 0:
                    first_page = doc[0]
                    preview_image_url = preview_image_urls[0]
                    image_input_url = preview_image_url
                    is_vision = True
            except Exception as e:
                # Fallback to PyPDF if PyMuPDF fails
                try:
                    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                    text = ""
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    raw_text = text.strip()
                except Exception as e2:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Fehler beim Lesen der PDF-Datei: {e} | PyPDF Fallback-Fehler: {e2}",
                    )
        else:
            # Text or other files
            try:
                raw_text = file_bytes.decode("utf-8", errors="ignore").strip()
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dateiformat wird nicht unterstützt oder Text konnte nicht dekodiert werden: {e}",
                )

        # Call OpenAI to parse and structure the document
        try:
            if is_vision and image_input_url:
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Bitte transkribiere das angehängte Dokument und extrahiere alle Schlüsseldaten mit präzisen visuellen Koordinaten im Bereich 0 bis 1000 [ymin, xmin, ymax, xmax] im vorgegebenen JSON-Format.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_input_url},
                            },
                        ],
                    },
                ]
            else:
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Hier ist der Textinhalt des hochgeladenen Dokuments:\n\n{raw_text}\n\nBitte analysiere dieses Dokument und extrahiere die Schlüsseldaten im vorgegebenen JSON-Format.",
                    },
                ]

            response = await client.chat.completions.create(
                model=settings.openai_chat_model,
                messages=messages,
                response_format={"type": "json_object"},
            )

            response_content = response.choices[0].message.content or "{}"
            analysis_data = json.loads(response_content)

            extracted_fields = []
            for field in analysis_data.get("fields", []):
                box = field.get("box")
                value = field.get("value", "").strip()
                field_box = None
                field_page = 0
                
                # 1. Search text layer if PDF is available (across all pages)
                if is_pdf and doc and value:
                    for p_idx in range(len(doc)):
                        p_page = doc[p_idx]
                        p_box = find_text_coordinates(p_page, value)
                        if p_box:
                            field_box = p_box
                            field_page = p_idx
                            break
                
                # 2. Fallback to OpenAI Vision coordinates if search failed or not a PDF
                if not field_box and box and len(box) == 4:
                    try:
                        ymin, xmin, ymax, xmax = [float(v) for v in box]
                        top = ymin / 10.0
                        left = xmin / 10.0
                        width = (xmax - xmin) / 10.0
                        height = (ymax - ymin) / 10.0

                        width = max(width, 3.0)
                        height = max(height, 2.0)

                        top = max(0.0, min(100.0, top))
                        left = max(0.0, min(100.0, left))
                        width = max(0.0, min(100.0 - left, width))
                        height = max(0.0, min(100.0 - top, height))

                        field_box = [top, left, width, height]
                    except Exception as parse_err:
                        print(
                            f"Warnung: Fehler beim Konvertieren der Box {box}: {parse_err}"
                        )

                extracted_fields.append(
                    ExtractedField(
                        field_name=field.get("field_name", ""),
                        value=field.get("value", ""),
                        box=field_box,
                        confidence=field.get("confidence", 1.0),
                        is_pii=bool(field.get("is_pii", False)),
                        page=field_page
                    )
                )
                
            # Extract word bounding boxes for interactive UI selection (across all pages)
            word_boxes = []
            if doc:
                try:
                    for p_idx in range(len(doc)):
                        p_page = doc[p_idx]
                        for w in p_page.get_text("words"):
                            rect = fitz.Rect(w[0], w[1], w[2], w[3])
                            box = _rect_to_box(p_page, rect)
                            word_boxes.append({
                                "text": w[4],
                                "box": box,
                                "page": p_idx
                            })
                except Exception as e_words:
                    print(f"Warnung: Fehler beim Extrahieren der Wort-Koordinaten: {e_words}")
            elif first_page:
                try:
                    for w in first_page.get_text("words"):
                        rect = fitz.Rect(w[0], w[1], w[2], w[3])
                        box = _rect_to_box(first_page, rect)
                        word_boxes.append({
                            "text": w[4],
                            "box": box,
                            "page": 0
                        })
                except Exception as e_words:
                    print(f"Warnung: Fehler beim Extrahieren der Wort-Koordinaten: {e_words}")

            return DocumentAnalysis(
                fields=extracted_fields,
                raw_text=analysis_data.get("raw_text") or raw_text or response_content,
                preview_image_url=preview_image_url,
                preview_image_urls=preview_image_urls,
                word_boxes=word_boxes
            )

        except Exception as e:
            print(f"ERROR: Fehler bei der Dokumentenanalyse: {e}")
            import traceback
            traceback.print_exc()

            word_boxes = []
            if doc:
                try:
                    for p_idx in range(len(doc)):
                        p_page = doc[p_idx]
                        for w in p_page.get_text("words"):
                            rect = fitz.Rect(w[0], w[1], w[2], w[3])
                            box = _rect_to_box(p_page, rect)
                            word_boxes.append({
                                "text": w[4],
                                "box": box,
                                "page": p_idx
                            })
                except Exception as e_words:
                    print(f"Warnung: Fehler beim Extrahieren der Wort-Koordinaten: {e_words}")
            elif first_page:
                try:
                    for w in first_page.get_text("words"):
                        rect = fitz.Rect(w[0], w[1], w[2], w[3])
                        box = _rect_to_box(first_page, rect)
                        word_boxes.append({
                            "text": w[4],
                            "box": box,
                            "page": 0
                        })
                except Exception as e_words:
                    print(f"Warnung: Fehler beim Extrahieren der Wort-Koordinaten: {e_words}")

            return DocumentAnalysis(
                fields=[],
                raw_text=raw_text or f"[Fehler bei der Dokumentenanalyse: {e}]",
                preview_image_url=preview_image_url,
                preview_image_urls=preview_image_urls,
                word_boxes=word_boxes
            )
    finally:
        if doc:
            try:
                doc.close()
                print("Closed PDF document handle successfully.")
            except Exception as close_err:
                print(f"Warnung beim Schließen des PDF-Handles: {close_err}")


@router.post("/upload", response_model=Attachment)
async def upload_chat_file(file: UploadFile = File(...)) -> Attachment:
    analysis = await extract_file_content(file)
    
    # Redact initial content based on fields marked as is_pii by LLM
    redacted_content = analysis.raw_text
    if analysis.fields:
        for field in analysis.fields:
            if field.is_pii and field.value:
                redacted_content = redacted_content.replace(field.value, "█████")
                
    return Attachment(
        name=file.filename or "file",
        content=redacted_content,
        file_type=file.content_type or "application/octet-stream",
        analysis=analysis,
    )


from pydantic import BaseModel

class RedactRequest(BaseModel):
    filename: str
    redactions: list


class ApplyRedactionsResponse(BaseModel):
    redacted_text: str
    preview_image_url: str | None = None
    preview_image_urls: list[str] = []


@router.post("/apply-redactions", response_model=ApplyRedactionsResponse)
async def apply_redactions_endpoint(
    filename: str = Form(None),
    redactions_json: str = Form(...),
    file: UploadFile = File(None)
) -> ApplyRedactionsResponse:
    import fitz
    import base64
    import io
    import json

    try:
        redactions = json.loads(redactions_json)
    except Exception as e_json:
        raise HTTPException(status_code=400, detail=f"Invalid redactions JSON: {e_json}")

    file_bytes = None
    resolved_filename = filename

    if file:
        file_bytes = await file.read()
        resolved_filename = file.filename or filename or "document.pdf"
    elif filename:
        file_path = UPLOAD_DIR / filename
        if not file_path.exists():
            # Fallback to samples folder
            samples_dir = Path(__file__).resolve().parents[2] / "samples"
            fallback_path = samples_dir / filename
            if not fallback_path.exists() and ("bafoeg" in filename.lower() or "bafög" in filename.lower()):
                fallback_path = samples_dir / "BAfoeg_Rueckbescheid_Beispiel.pdf"
            if fallback_path.exists():
                file_path = fallback_path
            else:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Originaldatei '{filename}' wurde auf dem Server nicht gefunden. Bitte laden Sie das Dokument erneut hoch."
                )
        try:
            file_bytes = file_path.read_bytes()
        except Exception as e_read:
            raise HTTPException(status_code=500, detail=f"Fehler beim Lesen der Originaldatei: {e_read}")
    else:
        raise HTTPException(status_code=400, detail="Entweder Datei (file) oder Dateiname (filename) muss angegeben werden")
        
    doc = None
    try:
        is_pdf = resolved_filename.lower().endswith(".pdf")
        if is_pdf:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        else:
            # Try converting image to PDF
            ext = "png"
            if resolved_filename.lower().endswith(".jpg") or resolved_filename.lower().endswith(".jpeg"):
                ext = "jpeg"
            img_doc = fitz.open(stream=file_bytes, filetype=ext)
            pdf_bytes = img_doc.convert_to_pdf()
            doc = fitz.open("pdf", pdf_bytes)
            
        if len(doc) > 0:
            for box in redactions:
                coords_list = box if (isinstance(box, list) and len(box) > 0 and isinstance(box[0], list)) else [box]
                for coords in coords_list:
                    if len(coords) >= 4:
                        top, left, width, height = [float(v) for v in coords[:4]]
                        page_idx = int(coords[4]) if len(coords) >= 5 else 0
                        if page_idx < len(doc):
                            page = doc[page_idx]
                            pw = page.rect.width
                            ph = page.rect.height
                            
                            x0 = (left / 100.0) * pw
                            y0 = (top / 100.0) * ph
                            x1 = x0 + (width / 100.0) * pw
                            y1 = y0 + (height / 100.0) * ph
                            
                            rect = fitz.Rect(x0, y0, x1, y1)
                            
                            # Apply PDF redaction (structurally deletes text under it)
                            try:
                                page.add_redact_annot(rect, fill=(0, 0, 0))
                                page.apply_redactions()
                            except Exception as e_redact:
                                print(f"Warnung bei add_redact_annot: {e_redact}")
                            
                            # Fallback visual blackout rectangle
                            page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))
                        
        # Save redacted PDF to memory
        out_stream = io.BytesIO()
        doc.save(out_stream, garbage=4, deflate=True)
        redacted_bytes = out_stream.getvalue()
        
        # Try writing to UPLOAD_DIR (fails silently on Vercel, works locally)
        if not file:
            try:
                file_path.write_bytes(redacted_bytes)
                print(f"Successfully overwrote {resolved_filename} with redacted version on disk.")
            except Exception as e_write:
                print(f"Warnung: Redigierte Version von {resolved_filename} konnte nicht auf Disk gespeichert werden: {e_write}")
 
        # Extract text from redacted PDF
        text_pages = []
        for p in doc:
            text_pages.append(p.get_text())
        redacted_text = "\n".join(text_pages).strip()
        
        # Generate redacted preview images for all pages
        preview_image_urls = []
        for p_idx in range(len(doc)):
            pix = doc[p_idx].get_pixmap(dpi=150)
            png_bytes = pix.tobytes("png")
            base64_image = base64.b64encode(png_bytes).decode("utf-8")
            preview_image_urls.append(f"data:image/png;base64,{base64_image}")
            
        preview_image_url = preview_image_urls[0] if preview_image_urls else None
            
        return ApplyRedactionsResponse(
            redacted_text=redacted_text,
            preview_image_url=preview_image_url,
            preview_image_urls=preview_image_urls
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fehler bei der Anwendung der Schwärzungen: {e}")
    finally:
        if doc:
            try:
                doc.close()
            except Exception:
                pass


@router.post("/redact")
async def redact_pdf(
    filename: str = Form(None),
    redactions_json: str = Form(...),
    file: UploadFile = File(None)
):
    from fastapi.responses import StreamingResponse
    import fitz
    import io
    import json

    try:
        redactions = json.loads(redactions_json)
    except Exception as e_json:
        raise HTTPException(status_code=400, detail=f"Invalid redactions JSON: {e_json}")

    file_bytes = None
    resolved_filename = filename

    if file:
        file_bytes = await file.read()
        resolved_filename = file.filename or filename or "document.pdf"
    elif filename:
        file_path = UPLOAD_DIR / filename
        if not file_path.exists():
            # Fallback to samples folder
            samples_dir = Path(__file__).resolve().parents[2] / "samples"
            fallback_path = samples_dir / filename
            if not fallback_path.exists() and ("bafoeg" in filename.lower() or "bafög" in filename.lower()):
                fallback_path = samples_dir / "BAfoeg_Rueckbescheid_Beispiel.pdf"
            if fallback_path.exists():
                file_path = fallback_path
            else:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Originaldatei '{filename}' wurde auf dem Server nicht gefunden. Bitte laden Sie das Dokument erneut hoch."
                )
        try:
            file_bytes = file_path.read_bytes()
        except Exception as e_read:
            raise HTTPException(status_code=500, detail=f"Fehler beim Lesen der Originaldatei: {e_read}")
    else:
        raise HTTPException(status_code=400, detail="Entweder Datei (file) oder Dateiname (filename) muss angegeben werden")
        
    doc = None
    try:
        is_pdf = resolved_filename.lower().endswith(".pdf")
        if is_pdf:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        else:
            # Try converting image to PDF
            ext = "png"
            if resolved_filename.lower().endswith(".jpg") or resolved_filename.lower().endswith(".jpeg"):
                ext = "jpeg"
            img_doc = fitz.open(stream=file_bytes, filetype=ext)
            pdf_bytes = img_doc.convert_to_pdf()
            doc = fitz.open("pdf", pdf_bytes)
            
        if len(doc) > 0:
            for box in redactions:
                coords_list = box if (isinstance(box, list) and len(box) > 0 and isinstance(box[0], list)) else [box]
                for coords in coords_list:
                    if len(coords) >= 4:
                        top, left, width, height = [float(v) for v in coords[:4]]
                        page_idx = int(coords[4]) if len(coords) >= 5 else 0
                        if page_idx < len(doc):
                            page = doc[page_idx]
                            pw = page.rect.width
                            ph = page.rect.height
                            
                            x0 = (left / 100.0) * pw
                            y0 = (top / 100.0) * ph
                            x1 = x0 + (width / 100.0) * pw
                            y1 = y0 + (height / 100.0) * ph
                            
                            rect = fitz.Rect(x0, y0, x1, y1)
                            
                            # Apply PDF redaction (structurally deletes text)
                            try:
                                page.add_redact_annot(rect, fill=(0, 0, 0))
                                page.apply_redactions()
                            except Exception as e_redact:
                                print(f"Warnung bei add_redact_annot: {e_redact}")
                            
                            # Fallback visual blackout rectangle
                            page.draw_rect(rect, color=(0, 0, 0), fill=(0, 0, 0))
                            
        # Save redacted PDF to memory
        out_stream = io.BytesIO()
        doc.save(out_stream, garbage=4, deflate=True)
        out_stream.seek(0)
        
        base_name = resolved_filename.rsplit(".", 1)[0] if "." in resolved_filename else resolved_filename
        redacted_filename = f"geschwaerzt_{base_name}.pdf"
        
        return StreamingResponse(
            out_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={redacted_filename}"}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fehler bei der PDF-Schwärzung: {e}")
    finally:
        if doc:
            doc.close()


@router.get("/sessions", response_model=list[ChatSessionSummary])
async def get_chat_sessions(user_id: str = "default") -> list[ChatSessionSummary]:
    return await list_sessions(user_id)


@router.post("/sessions", response_model=ChatSession)
async def create_chat_session(request: CreateChatSessionRequest) -> ChatSession:
    return await create_session(request.user_id)


@router.get("/sessions/{session_id}", response_model=ChatSession)
async def get_chat_session(session_id: str, user_id: str = "default") -> ChatSession:
    session = await get_session(session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    return session


@router.post("/demo/bafog/seed", response_model=ChatSession)
async def seed_bafog_demo(
    session_id: str,
    user_id: str = "default",
    language: str = "de",
) -> ChatSession:
    from app.services.demo_sample import seed_bafog_demo_session

    try:
        session = await seed_bafog_demo_session(session_id, user_id, language)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Demo konnte nicht geladen werden: {e}"
        ) from e
    if not session:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    return session


@router.post("/demo/bafog/refresh", response_model=ChatSession)
async def refresh_bafog_demo(user_id: str = "default", language: str = "de") -> ChatSession:
    from app.services.demo_sample import refresh_bafog_demo_session

    try:
        return await refresh_bafog_demo_session(user_id, language)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Beispiel konnte nicht aktualisiert werden: {e}"
        ) from e


@router.delete("/sessions/{session_id}")
async def remove_chat_session(session_id: str, user_id: str = "default") -> dict:
    session = await get_session(session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    await delete_session(session_id)
    return {"deleted": True}


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.message.strip() and not request.attachments:
        raise HTTPException(
            status_code=400, detail="Nachricht oder Anhang darf nicht leer sein"
        )
    try:
        return await generate_answer(request)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Antwort konnte nicht generiert werden: {e}"
        ) from e
