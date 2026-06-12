import base64
import io
import json
import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException, UploadFile, File
from openai import AsyncOpenAI
import pypdf

from app.config import settings
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
from app.services.chat_store import create_session, delete_session, get_session, list_sessions

router = APIRouter(prefix="/chat", tags=["chat"])


SYSTEM_PROMPT = """Du bist ein präziser deutscher Rechtsdokumenten-Analysator.
Deine Aufgabe ist es, das hochgeladene Dokument (z. B. Bußgeldbescheid, Anhörungsbogen, Zeugenfragebogen, Strafbefehl, Klageschrift, etc.) umfassend und detailgenau zu analysieren.
Extrahiere JEDES relevante Detail und jede Schlüsselinformation als separates Feld in der Liste `fields`. Sei so gründlich und präzise wie möglich.

Bitte suche gezielt nach folgenden Feldern und extrahiere sie, sofern sie im Dokument vorhanden sind:
- Dokumententyp (z.B. "Bußgeldbescheid", "Anhörungsbogen", "Zeugenfragebogen", "Strafbefehl")
- Aktenzeichen / Geschäftszeichen (z.B. "302.3492.2", "12 OWi 234/26")
- Behörde / Absender (z.B. "Polizeipräsidium Berlin", "Zentrale Bußgeldstelle", "Landkreis Hannover")
- Datum des Schreibens / Ausstellungsdatum (z.B. "12.06.2026")
- Empfänger / Betroffene(r) (z.B. Name des Empfängers oder "Sehr geehrte(r) Verkehrsteilnehmer(in)")
- Tatvorwurf / Verstoß (z.B. "Geschwindigkeitsüberschreitung um 18 km/h innerhalb geschlossener Ortschaften")
- Tatzeit (Datum und Uhrzeit der Tat, z.B. "05.06.2026, 14:32 Uhr")
- Tatort (z.B. "Hannover, Hildesheimer Straße, Höhe № 100, Rtg. Zentrum")
- Fahrzeug (z.B. "PKW", "LKW")
- Kennzeichen / Nummernschild (z.B. "H-XX 1234")
- Zulässige Geschwindigkeit (z.B. "50 km/h")
- Festgestellte Geschwindigkeit (z.B. "68 km/h")
- Geschwindigkeitsüberschreitung (z.B. "18 km/h")
- Toleranzabzug (z.B. "3 km/h")
- Beweismittel (z.B. "Verkehrsüberwachungsanlage (Frontfoto), Zeuge")
- Zeuge / Messbeamter (z.B. "POM Müller")
- Geldbuße / Bußgeld (z.B. "80,00 EUR" oder "festgesetzt")
- Gebühren (z.B. "25,00 EUR")
- Auslagen (z.B. "3,50 EUR")
- Gesamtbetrag (z.B. "108,50 EUR")
- Punkte in Flensburg (z.B. "1 Punkt" oder "keine")
- Fahrverbot (z.B. "1 Monat" oder "keines")
- Frist / Einspruchsfrist (z.B. "2 Wochen")
- Rechtsgrundlage / Paragraphen (z.B. "§ 24 StVG, § 107 OWiG")

Wenn das Dokument weitere spezifische Rechtswerte oder Metadaten enthält, füge sie ebenfalls als separate Felder hinzu. Extrahiere so viele Felder wie möglich, um dem Benutzer eine lückenlose Analyse zu bieten!

Gib die extrahierten Informationen als valides JSON-Objekt mit folgender Struktur zurück:
{
  "fields": [
    {
      "field_name": "Name des Feldes", // z.B. "Tatort", "Beweismittel", "Aktenzeichen"
      "value": "Wert des Feldes im Dokument", // Der exakte Textwert aus dem Dokument
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
- Wenn das Dokument kein Bild ist oder keine Koordinaten bestimmt werden können, setze `box` auf null.
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


def find_text_coordinates(page, value: str) -> list[float] | None:
    if not page or not value:
        return None
    val = value.strip()
    if not val:
        return None
        
    val_clean = val.rstrip(".,;: ")
    if not val_clean:
        return None
        
    # 1. Search for the cleaned exact value
    rects = page.search_for(val_clean)
    if rects:
        return _rect_to_box(page, rects[0])
        
    # 2. Split by spaces/newlines and search for the first chunk of length >= 4
    # E.g. date, record number, fine amount
    chunks = [c.strip(".,;:()[] ") for c in val_clean.split()]
    chunks = [c for c in chunks if len(c) >= 4]
    for chunk in chunks:
        rects = page.search_for(chunk)
        if rects:
            return _rect_to_box(page, rects[0])
            
    return None


async def extract_file_content(file: UploadFile) -> DocumentAnalysis:
    content_type = file.content_type or ""
    filename = file.filename or ""
    file_bytes = await file.read()

    if not file_bytes:
        return DocumentAnalysis(fields=[], raw_text="", preview_image_url=None)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    preview_image_url = None
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
                
                # Generate preview image of first page if document is not empty
                if len(doc) > 0:
                    first_page = doc[0]
                    pix = first_page.get_pixmap(dpi=150)
                    png_bytes = pix.tobytes("png")
                    base64_image = base64.b64encode(png_bytes).decode("utf-8")
                    preview_image_url = f"data:image/png;base64,{base64_image}"
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
                        detail=f"Fehler beim Lesen der PDF-Datei: {e} | PyPDF Fallback-Fehler: {e2}"
                    )
        else:
            # Text or other files
            try:
                raw_text = file_bytes.decode("utf-8", errors="ignore").strip()
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dateiformat wird nicht unterstützt oder Text konnte nicht dekodiert werden: {e}"
                )

        # Call OpenAI to parse and structure the document
        try:
            if is_vision and image_input_url:
                messages = [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Bitte transkribiere das angehängte Dokument und extrahiere alle Schlüsseldaten mit präzisen visuellen Koordinaten im Bereich 0 bis 1000 [ymin, xmin, ymax, xmax] im vorgegebenen JSON-Format."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_input_url
                                }
                            }
                        ]
                    }
                ]
            else:
                messages = [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT
                    },
                    {
                        "role": "user",
                        "content": f"Hier ist der Textinhalt des hochgeladenen Dokuments:\n\n{raw_text}\n\nBitte analysiere dieses Dokument und extrahiere die Schlüsseldaten im vorgegebenen JSON-Format."
                    }
                ]

            response = await client.chat.completions.create(
                model="gpt-5.5",
                messages=messages,
                response_format={"type": "json_object"}
            )
            
            response_content = response.choices[0].message.content or "{}"
            analysis_data = json.loads(response_content)
            
            extracted_fields = []
            for field in analysis_data.get("fields", []):
                box = field.get("box")
                value = field.get("value", "").strip()
                field_box = None
                
                # 1. Search text layer if PDF first page is available
                if is_pdf and first_page and value:
                    field_box = find_text_coordinates(first_page, value)
                
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
                        print(f"Warnung: Fehler beim Konvertieren der Box {box}: {parse_err}")
                
                extracted_fields.append(
                    ExtractedField(
                        field_name=field.get("field_name", ""),
                        value=field.get("value", ""),
                        box=field_box,
                        confidence=field.get("confidence", 1.0),
                        is_pii=bool(field.get("is_pii", False))
                    )
                )
                
            return DocumentAnalysis(
                fields=extracted_fields,
                raw_text=analysis_data.get("raw_text") or raw_text or response_content,
                preview_image_url=preview_image_url
            )

        except Exception as e:
            # Robust fallback in case OpenAI call or JSON parsing fails
            print(f"ERROR: Fehler bei der Dokumentenanalyse: {e}")
            import traceback
            traceback.print_exc()
            return DocumentAnalysis(
                fields=[],
                raw_text=raw_text or f"[Fehler bei der Dokumentenanalyse: {e}]",
                preview_image_url=preview_image_url
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
    return Attachment(
        name=file.filename or "file",
        content=analysis.raw_text,
        file_type=file.content_type or "application/octet-stream",
        analysis=analysis
    )


@router.get("/sessions", response_model=list[ChatSessionSummary])
async def get_chat_sessions(user_id: str = "default") -> list[ChatSessionSummary]:
    return list_sessions(user_id)


@router.post("/sessions", response_model=ChatSession)
async def create_chat_session(request: CreateChatSessionRequest) -> ChatSession:
    return create_session(request.user_id)


@router.get("/sessions/{session_id}", response_model=ChatSession)
async def get_chat_session(session_id: str, user_id: str = "default") -> ChatSession:
    session = get_session(session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    return session


@router.delete("/sessions/{session_id}")
async def remove_chat_session(session_id: str, user_id: str = "default") -> dict:
    session = get_session(session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chat nicht gefunden")
    delete_session(session_id)
    return {"deleted": True}


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if not request.message.strip() and not request.attachments:
        raise HTTPException(status_code=400, detail="Nachricht oder Anhang darf nicht leer sein")
    try:
        return await generate_answer(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Antwort konnte nicht generiert werden: {e}") from e
