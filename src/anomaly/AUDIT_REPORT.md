# Anomaly Detection Audit

## Existing Work

- `anomaly_working_dataset.ipynb` correctly loaded the master CSV and copied it to the anomaly raw-data location.
- `anomaly_preprocessing.ipynb` performed useful datatype and missing-value inspection, but did not enforce invalid-row handling or create a reusable transformation object.
- `anomaly_data_inspection_1.ipynb` covered dataset shape, duplicates, dates, amounts, categories, and basic EDA.
- The nested `anomaly_eda.ipynb` contained the only substantial feature engineering, Isolation Forest, threshold analysis, and final-label work.

## Findings

- The EDA notebook duplicated basic merchant/category aggregates and then later overwrote columns with a different calculation.
- Full-data `groupby(...).transform(...)` aggregates were used before the historical versions. Those values include the current row and future rows and are leakage.
- Several cells depend on execution order and notebook globals, including `test_anomaly_score`; restarting or running cells out of order causes the reported `NameError`.
- The previous threshold `0.5956` was hard-coded into final-label cells rather than frozen from a clearly isolated validation-only procedure.
- No saved model, scaler/preprocessing contract, threshold metadata, explanation rules, or fresh-process inference function existed in the inspected source.
- Synthetic anomalies were not found as a separate, reproducible training/evaluation path. The rebuilt Isolation Forest remains unsupervised and does not report accuracy.
- The earlier result was an anomaly-score demonstration, not evidence of model accuracy: no genuine anomaly labels were present.

## Corrected Design

`src/anomaly/pipeline.py` now scores each row before adding its amount to merchant/category history. Training history seeds validation, and train plus validation history seeds test. First occurrences use the train-only global amount median; zero-variance z-scores use `0.0` and ratio denominators use a small positive guard.

`src/anomaly/train_anomaly_model.py` performs a stable chronological 70/15/15 split, fits the scaler and model on train only, evaluates three reasonable Isolation Forest configurations on validation, selects a threshold from validation percentiles only, and writes all required artifacts.

## Validation Result From Rebuild

- Dataset: 7,000 rows; train 4,900; validation 1,050; test 1,050.
- Selected model: `n_estimators=300`, `max_samples=1.0`, `contamination=0.05`, `max_features=0.8`, `random_state=42`.
- Candidate threshold selection used P95, P97, P98, P99, and P99.5 validation score percentiles.
- Frozen threshold: `0.030364760099590507`, the validation P98 threshold and the candidate closest to a 2% validation rate.
- Validation: 21 anomalies, 2.00%.
- Test: 33 anomalies, 3.14%.
- No accuracy, precision, recall, or F1 is claimed because no genuine labels exist.

The test result is final evaluation only; it did not influence model or threshold selection.