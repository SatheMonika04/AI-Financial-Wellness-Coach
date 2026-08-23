from unittest.mock import MagicMock, patch

from src.pdf_processing.pdf_parser import extract_pdf_content


def test_extracts_text_and_tables_per_page():
    page = MagicMock()
    page.extract_text.return_value = "Date Narration Debit Balance"
    page.extract_tables.return_value = [["Date", "Narration"]]
    pdf = MagicMock()
    pdf.pages = [page]
    pdfplumber_open = patch("src.pdf_processing.pdf_parser.pdfplumber.open")
    with pdfplumber_open as mocked_open:
        mocked_open.return_value.__enter__.return_value = pdf
        content = extract_pdf_content("statement.pdf")
    assert content == [{"page_number": 1, "text": "Date Narration Debit Balance", "tables": [["Date", "Narration"]]}]
