from src.pdf_processing.pipeline import process_bank_statement

result = process_bank_statement("statement1.pdf", "data/output/output1.csv")
assert result["success"], result["errors"]
assert result["pdf_type"] == "TEXT_BASED"
assert result["page_count"] == 7
assert result["transactions_found"] > 0
assert result["valid_transactions"] > 0
