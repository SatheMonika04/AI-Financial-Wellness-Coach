import pandas as pd

from src.Expense_Categorization.expense_categorization_pipeline import _prepare_features


def test_prepare_features_accepts_parser_schema():
    features = _prepare_features(pd.DataFrame({
        "transaction_date": ["2026-08-01"],
        "description": ["UPI grocery payment"],
        "transaction": ["Debit"],
        "amount": [-125.0],
    }))

    assert features.loc[0, "transaction_text"] == "UPI grocery payment"
    assert features.loc[0, "amount"] == 125.0
    assert features.loc[0, "transaction_type"] == "Debit"
    assert features.loc[0, "payment_method"] == "Upi"


def test_prepare_features_accepts_separate_debit_credit_columns():
    features = _prepare_features(pd.DataFrame({
        "Date": ["2026-08-01", "2026-08-02"],
        "Transaction Details": ["Salary credit", "Rent payment"],
        "Debit": [None, "12500"],
        "Credit": ["50000", None],
    }))

    assert features["amount"].tolist() == [50000.0, 12500.0]
    assert features["transaction_type"].tolist() == ["Credit", "Debit"]