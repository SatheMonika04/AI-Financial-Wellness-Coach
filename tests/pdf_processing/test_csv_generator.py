import pandas as pd

from src.pdf_processing.csv_generator import save_transactions_to_csv


def test_csv_has_canonical_columns_and_utf8(tmp_path):
    frame = pd.DataFrame([{"transaction_date": pd.Timestamp("2026-08-01"), "description": "Café", "transaction": "Debit", "amount": -10.0}])
    output = save_transactions_to_csv(frame, tmp_path / "transactions.csv")
    loaded = pd.read_csv(output)
    assert list(loaded.columns) == ["transaction_date", "description", "transaction", "amount"]
    assert loaded.loc[0, "description"] == "Café"
