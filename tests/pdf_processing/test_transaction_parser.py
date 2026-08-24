from src.pdf_processing.transaction_parser import parse_transactions


def test_multiline_transaction_preserves_narration():
    pages = [{"page_number": 1, "text": "01/08/2026 UPI/DR/12345/\nSWIGGY ORDER\n450.00 24550.00", "tables": []}]
    rows = parse_transactions(pages)
    assert len(rows) == 1
    assert rows[0]["description"] == "UPI/DR/12345/ SWIGGY ORDER"
    assert rows[0]["transaction"] == "Debit"
    assert rows[0]["amount"] == "450.00"


def test_repeated_headers_are_ignored():
    pages = [{"page_number": 1, "text": "Date Narration Debit Credit Balance\n01/08/2026 Salary 50000.00 50000.00", "tables": []}]
    assert len(parse_transactions(pages)) == 1


def test_explicit_transaction_type_preserves_trailing_balance():
    pages = [{"page_number": 1, "text": "01/08/2026 Salary CREDIT 50000.00 75000.00", "tables": []}]
    rows = parse_transactions(pages)

    assert rows[0]["transaction"] == "Credit"
    assert rows[0]["amount"] == "50000.00"
