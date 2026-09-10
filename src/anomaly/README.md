# Leakage-Safe Anomaly Detection

Train from the repository root:

```powershell
python -m src.anomaly.train_anomaly_model
```

The command reads `data/master/final_master_transaction.csv` and writes:

- `src/anomaly/artifacts/isolation_forest.joblib`
- `src/anomaly/artifacts/preprocessing.joblib`
- `src/anomaly/artifacts/threshold.json`
- `src/anomaly/artifacts/feature_list.json`
- `src/anomaly/artifacts/model_config.json`
- `src/anomaly/artifacts/explanation_rules.json`
- `src/anomaly/outputs/validation_results.csv`
- `src/anomaly/outputs/test_results.csv`
- `src/anomaly/outputs/anomaly_report.csv`
- `src/anomaly/outputs/model_evaluation.json`

Inference loads the frozen artifacts and does not retrain:

```python
from src.anomaly.pipeline import predict_anomalies

results = predict_anomalies(transactions)
```

The input must include `transaction_id`, `transaction_date`, `transaction_time`, `merchant`, `amount`, and `category`. The expected output includes the transaction identity fields, score, label, and explanation.

Historical merchant/category features are calculated online: a transaction is evaluated first, then its amount is appended to history. This rule is used for training, validation, test, and inference.