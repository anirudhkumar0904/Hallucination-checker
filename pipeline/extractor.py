"""
PDF Text Extractor using modern pypdf
"""
from pypdf import PdfReader

def extract_text(pdf_path: str) -> list[dict]:
    """
    Extract text page by page from a PDF file.
    Returns a list of dicts: [{"page": 1, "text": "page text..."}]
    """
    reader = PdfReader(pdf_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        cleaned = text.strip()
        if cleaned:
            pages.append({"page": i + 1, "text": cleaned})
            
    if not pages:
        raise ValueError("No extractable text found in this PDF. It might be a scanned image.")
        
    return pages
