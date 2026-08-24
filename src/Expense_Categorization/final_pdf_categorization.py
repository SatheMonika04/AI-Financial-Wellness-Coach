from src.pdf_processing.pipeline import process_bank_statement_to_dataframe
from src.Expense_Categorization.expense_categorization_pipeline_v2 import categorize_dataframe
from pathlib import Path
import pandas as pd

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "expense_classifier_pipeline_v3.pkl"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_COLUMNS = ("transaction_text", "amount", "payment_method", "transaction_type")
DEFAULT_INPUT_CSV = PROJECT_ROOT / "Test Assets" / "PhonePe_Statement_Aug2025_Aug2026.csv"
DEFAULT_OUTPUT_CSV = PROJECT_ROOT / "data" / "output" / "PhonePe_Statement_Aug2025_Aug2026_categorized.csv"


def convert_csv_and_categorize(pdf_path: str | Path, output_csv_path: str | Path = DEFAULT_OUTPUT_CSV, model_path: str | Path = MODEL_PATH) -> pd.DataFrame:
    """Convert a bank statement PDF to CSV and categorize the transactions."""
    # Convert PDF to DataFrame
    transactions_df = process_bank_statement_to_dataframe(pdf_path)
    if transactions_df.empty:
        raise ValueError("No valid transactions could be extracted from the PDF.")
    
    # Categorize the DataFrame
    categorized_df = categorize_dataframe(transactions_df, model_path=model_path)
    
    # Save to CSV
    categorized_df.to_csv(output_csv_path, index=False, encoding="utf-8")
    print(f"Saved categorized transactions to {output_csv_path}")
    
    return categorized_df


convert_csv_and_categorize("D:/clg_project/AI-Financial-Wellness-Coach/Test Assets/statement 3.pdf", 
                           "D:/clg_project/AI-Financial-Wellness-Coach/data/output/transactions_categorized_3.csv") 