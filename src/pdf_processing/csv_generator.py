"""CSV generation for standardized transactions."""

from pathlib import Path

import pandas as pd

SCHEMA = ["transaction_date", "description", "transaction", "amount"]


def save_transactions_to_csv(df: pd.DataFrame, output_path: str | Path) -> Path:
    """Write the canonical transaction DataFrame as UTF-8 CSV."""
    missing = [column for column in SCHEMA if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required transaction columns: {', '.join(missing)}")
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    output = df.loc[:, SCHEMA].copy()
    output.to_csv(path, index=False, encoding="utf-8")
    return path
