from src.pdf_processing.pdf_validator import detect_pdf_type, validate_pdf


def test_missing_pdf_is_invalid(tmp_path):
    result = validate_pdf(tmp_path / "missing.pdf")
    assert not result["valid"]
    assert detect_pdf_type(result) == "INVALID"


def test_non_pdf_is_invalid(tmp_path):
    path = tmp_path / "statement.txt"
    path.write_text("not a pdf", encoding="utf-8")
    result = validate_pdf(path)
    assert not result["valid"]
    assert not result["is_pdf"]
