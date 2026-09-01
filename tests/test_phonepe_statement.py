"""Real-statement smoke test for the PhonePe PDF in the repository root."""

from pathlib import Path

from src.pdf_processing.pipeline import process_bank_statement


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = PROJECT_ROOT / "statement1.pdf"
OUTPUT_PATH = PROJECT_ROOT / "data" / "output" / "phonepe_transactions.csv"


def test_phonepe_statement_is_parsed():
    result = process_bank_statement(PDF_PATH, OUTPUT_PATH)

    assert result["success"], result["errors"]
    assert result["pdf_type"] == "TEXT_BASED"
    assert result["page_count"] == 7
    assert result["transactions_found"] > 0
    assert result["valid_transactions"] > 0
    assert OUTPUT_PATH.exists()


if __name__ == "__main__":
    print(process_bank_statement(PDF_PATH, OUTPUT_PATH))
    print(f"CSV: {OUTPUT_PATH}")
