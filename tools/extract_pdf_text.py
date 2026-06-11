from pathlib import Path

from pypdf import PdfReader


PDF_PATH = Path("/Users/fahimakhatun/Downloads/madina-arabic-book-1-english-key.pdf")
OUTPUT_PATH = Path("data/pdf-extracted.txt")


reader = PdfReader(PDF_PATH)
pages = []
for index, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ""
    pages.append(f"\n--- PAGE {index} ---\n{text}")

OUTPUT_PATH.write_text("".join(pages), encoding="utf-8")
print(f"written {len(reader.pages)} pages to {OUTPUT_PATH}")
