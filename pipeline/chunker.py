"""
Text Chunker — Recursive Character / Paragraph Aware
"""

def chunk_text(pages: list[dict], chunk_size: int = 800, overlap: int = 150) -> list[dict]:
    """
    Splits page text into overlapping chunks while preserving source page numbers.
    Returns list of dicts: [{"id": 0, "page": 1, "text": "chunk text..."}]
    """
    chunks = []
    chunk_id = 0
    for page_data in pages:
        page_num = page_data["page"]
        text = page_data["text"]
        
        if len(text) <= chunk_size:
            chunks.append({"id": chunk_id, "page": page_num, "text": text})
            chunk_id += 1
            continue
            
        start = 0
        while start < len(text):
            end = start + chunk_size
            if end >= len(text):
                chunk_slice = text[start:].strip()
                step = chunk_size
            else:
                # Try to find a clean break near the end of chunk
                break_point = -1
                for sep in ['\n\n', '\n', '. ', '? ', '! ', ' ']:
                    idx = text.rfind(sep, start + int(chunk_size * 0.6), end)
                    if idx != -1:
                        break_point = idx + len(sep)
                        break
                if break_point != -1:
                    chunk_slice = text[start:break_point].strip()
                    step = break_point - overlap
                else:
                    chunk_slice = text[start:end].strip()
                    step = end - overlap
            
            if chunk_slice:
                chunks.append({"id": chunk_id, "page": page_num, "text": chunk_slice})
                chunk_id += 1
                
            if start + step >= len(text) or step <= 0:
                break
            start += step
            
    return chunks
