import pandas as pd
import pytest

from src.pdf_processing.transaction_cleaner import clean_amount, clean_date, clean_transaction, transactions_to_dataframe


def test_clean_date_and_amount():
    assert clean_date("01-Aug-2026") == pd.Timestamp("2026-08-01")
    assert clean_amount("₹ 1,200.00") == 1200.0
    assert clean_amount("(450)") == -450.0


def test_invalid_amount_is_reported():
    with pytest.raises(ValueError):
        clean_amount("abc")


def test_dataframe_schema_and_types():
    frame, invalid = transactions_to_dataframe([{"transaction_date": "01/08/2026", "description": "UPI", "transaction": "Debit", "amount": "450"}])
    assert not invalid
    assert list(frame.columns) == ["transaction_date", "description", "transaction", "amount"]
    assert pd.api.types.is_numeric_dtype(frame["amount"])
    assert frame.loc[0, "amount"] == -450.0


def test_missing_balances_use_credit_and_debit_running_total():
    frame, invalid = transactions_to_dataframe([
        {"transaction_date": "01/08/2026", "description": "Salary", "transaction": "Credit", "amount": "500"},
        {"transaction_date": "02/08/2026", "description": "UPI", "transaction": "Debit", "amount": "125"},
    ])

    assert not invalid
    assert frame["amount"].tolist() == [500.0, -125.0]
