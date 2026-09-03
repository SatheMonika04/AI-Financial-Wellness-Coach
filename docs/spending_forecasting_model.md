# Spending Forecasting Model

## 1. Purpose

The spending forecasting module estimates a user's spending level from transaction history. It converts transaction-level data into a daily time series, creates features from past spending and the calendar, and applies a serialized scikit-learn model.

The current inference implementation is in [spending_forecasting_pipeline.py](../src/Forecating/spending_forecasting_pipeline.py). The model-development notebooks are [Forecasting_model.ipynb](../src/Forecating/Forecasting_model.ipynb) and [Forecasting_model_clean.ipynb](../src/Forecating/Forecasting_model_clean.ipynb).

This is a regression problem: the output is a numeric spending amount, not an expense category or a probability.

## 2. End-to-end flow

```text
Transaction table
        |
        v
Parse dates and cap large amounts
        |
        v
Aggregate to daily spending
        |
        v
Fill missing calendar dates with zero
        |
        v
Create past-only lag, rolling, expanding, and calendar features
        |
        v
Drop rows with insufficient history
        |
        v
Load serialized model and predict
        |
        v
Date + predicted_spending
```

The model is intended to forecast spending based on behavior already observed. It does not use account balance, income, budget, merchant category, user profile, or future transaction information in the current inference pipeline.

## 3. Input data contract

The inference function expects a pandas DataFrame containing at least:

| Column | Type | Meaning |
| --- | --- | --- |
| `transaction_date` | date-like | Date on which the transaction occurred |
| `amount` | numeric | Transaction amount |

Dates are converted with `pd.to_datetime`. Amounts should be numeric and should represent spending in the same currency and units used during training, currently INR in the project datasets.

The transaction table may contain multiple transactions on the same date. It may also contain dates with no transactions. A date with no recorded transactions is treated as a zero-spending day after the observed date range has been established.

## 4. Preprocessing

### 4.1 Outlier capping

Before daily aggregation, each transaction amount is capped:

```python
amount_capped = min(amount, cap_value)
```

The cap reduces the influence of unusually large one-off transactions such as rent or major purchases. The same cap used at training time must be used at inference time.

`predict()` reads this value from `metadata["cap_value"]`. If metadata does not contain it, the pipeline uses the 95th percentile of the supplied transactions as a fallback. This fallback keeps the function usable with older metadata, but it is less reproducible because the preprocessing value changes with each input dataset.

### 4.2 Daily aggregation

Transactions are grouped by date and summed after capping:

```text
total_spending(date) = sum(amount_capped for transactions on date)
```

The resulting table contains `date` and `total_spending`, sorted chronologically.

### 4.3 Calendar completion

The pipeline creates every calendar date between the first and last observed transaction date. Missing dates are inserted with `total_spending = 0`.

This assumption is valid only when the input is a complete transaction history. If a missing date means that data was not collected, rather than that no transaction occurred, filling it with zero will understate spending and should be changed.

## 5. Inference features

The checked-in inference pipeline uses the following features in this exact order:

```text
lag_1, lag_7, lag_30,
rolling_mean_7, rolling_mean_30, rolling_std_7, expanding_mean,
day_of_week, day, week, month, quarter,
is_weekend, is_month_end
```

Feature order is part of the model contract. Reordering, removing, or renaming columns can produce incorrect predictions or an input-shape error.

### 5.1 Historical features

All historical features are derived from `total_spending`.

| Feature | Definition | Interpretation |
| --- | --- | --- |
| `lag_1` | Spending one day earlier | Most recent observed spending |
| `lag_7` | Spending seven days earlier | Same weekday from the previous week |
| `lag_30` | Spending thirty days earlier | Approximate monthly history |
| `rolling_mean_7` | Mean of the previous seven days | Recent spending level |
| `rolling_mean_30` | Mean of the previous thirty days | Monthly spending level |
| `rolling_std_7` | Sample standard deviation of the previous seven days | Recent spending volatility |
| `expanding_mean` | Mean of all spending before the forecast date | Long-run average spending |

The rolling features use `shift(1)` before the rolling calculation. For a date `t`, they therefore use dates before `t` and never include the value being predicted. For example:

```python
past = total_spending.shift(1)
rolling_mean_7 = past.rolling(7).mean()
```

### 5.2 Calendar features

| Feature | Definition |
| --- | --- |
| `day_of_week` | Monday = 0 through Sunday = 6 |
| `day` | Day of the month, 1 through 31 |
| `week` | ISO calendar week |
| `month` | Month number, 1 through 12 |
| `quarter` | Quarter number, 1 through 4 |
| `is_weekend` | 1 when the date is Saturday or Sunday, otherwise 0 |
| `is_month_end` | 1 when the date is the last day of its month, otherwise 0 |

These features allow the model to learn recurring calendar effects, such as different spending behavior on weekends or near month end.

## 6. Minimum history requirement

The 30-day lag and 30-day rolling mean require sufficient history. `predict()` removes every row with a missing feature and raises a `ValueError` when no usable row remains:

```text
Not enough history to predict. Need at least 30 days of past transaction data.
```

The first usable row is not necessarily exactly the 30th input row if the source data has date or quality problems. The practical requirement is a continuous, valid daily history containing enough observations to calculate every feature.

## 7. Training approaches in the repository

There are two notebook versions and they define different forecasting experiments. Their metrics and serialized models must not be compared as though they were the same experiment.

### 7.1 Original notebook and current inference contract

The original notebook:

1. Reads the processed transaction dataset.
2. Caps amounts at the 95th percentile.
3. Aggregates capped amounts into daily spending.
4. Builds the 14 features used by the production pipeline.
5. Creates a smoothed target named `target_smooth` using a centered 14-day rolling mean.
6. Splits data chronologically into train, validation, and test partitions.
7. Compares a previous-7-day-mean baseline with machine-learning regressors.
8. Saves the selected model as `src/models/spending_forecaster.pkl` and metadata as `src/models/model_metadata.pkl`.

The centered target is useful for estimating a smoothed spending level, but it includes values from around the forecast date, including future values relative to some feature rows. Therefore, its test score should not be interpreted as the accuracy of a strictly future-only production forecast.

The checked-in `model_comparison.csv` records the following results from this older experiment:

| Model | MAE | RMSE | MAPE (%) | R2 |
| --- | ---: | ---: | ---: | ---: |
| Baseline (naive) | 8,066.13 | 10,363.66 | 43.56 | 0.5534 |
| Linear Regression | 8,841.29 | 10,428.30 | 73.76 | 0.5478 |
| Lasso | 8,858.25 | 10,455.66 | 74.20 | 0.5455 |
| Ridge | 8,988.87 | 10,664.66 | 77.09 | 0.5271 |
| Random Forest | 12,973.62 | 16,394.74 | 138.07 | -0.1176 |
| XGBoost | 12,787.45 | 16,899.39 | 138.83 | -0.1874 |

The baseline is the previous seven-day average. In this recorded comparison it outperformed the tested ML models on MAE, RMSE, MAPE, and R2. That indicates that the recent moving average was a strong predictor for this dataset and target.

### 7.2 Clean, leakage-aware notebook

`Forecasting_model_clean.ipynb` is a stricter redesign. It changes the model-development contract in several ways:

- The outlier cap is calculated from the training period only.
- Data is split chronologically: 70% training, 15% validation, and 15% test.
- Hyperparameters are tuned only within the training period using five-fold `TimeSeriesSplit`.
- The validation period is used for model selection.
- The test period is evaluated once after selection.
- Ridge and Lasso use `StandardScaler` inside a pipeline.
- Additional features are explored, including more lags, exponential moving averages, and cyclical calendar encodings.
- The target is the average spending over the next seven days:

  ```text
  target(t) = mean(spending(t+1), ..., spending(t+7))
  ```

This future-only target has a direct business interpretation: expected average daily spending during the next seven days. However, the clean notebook's feature set and target differ from the checked-in inference pipeline. Its final model must not be deployed through `spending_forecasting_pipeline.py` until the saved model, metadata, feature list, and inference code are updated together.

## 8. Candidate models and selection

The development notebooks evaluate:

- **Baseline:** previous seven-day average.
- **Linear Regression:** unregularized linear relationship between features and target.
- **Ridge:** L2-regularized linear regression; scaling is required in the clean notebook.
- **Lasso:** L1-regularized linear regression; can shrink weak coefficients toward zero.
- **Random Forest:** ensemble of decision trees; no feature scaling is required.
- **XGBoost:** gradient-boosted decision trees; no feature scaling is required.

For the clean workflow, `RandomizedSearchCV` samples 25 hyperparameter combinations per model using five chronological splits. Model selection is based on validation R2, with a guardrail that keeps the baseline when no ML model beats it.

For an operational forecasting system, the baseline should remain part of every evaluation. A more complex model is justified only when it improves performance on a strictly future, untouched test period and provides a useful business benefit.

## 9. Evaluation metrics

Let $y_i$ be actual spending and $\hat{y}_i$ be predicted spending for $n$ observations.

### MAE

$$
MAE = \frac{1}{n}\sum_{i=1}^{n}|y_i - \hat{y}_i|
$$

Average absolute error in spending units. It is easy to explain and is less sensitive to large errors than RMSE.

### RMSE

$$
RMSE = \sqrt{\frac{1}{n}\sum_{i=1}^{n}(y_i - \hat{y}_i)^2}
$$

Penalizes large errors more strongly. It is useful when unexpectedly large forecast errors are especially costly.

### MAPE

$$
MAPE = \frac{100}{n}\sum_{i=1}^{n}\left|\frac{y_i - \hat{y}_i}{y_i}\right|
$$

Expresses error as a percentage, but it becomes unstable when actual spending is zero or very small. MAPE should therefore be interpreted cautiously for sparse spending data.

### R2

$$
R^2 = 1 - \frac{\sum_i(y_i - \hat{y}_i)^2}{\sum_i(y_i - \bar{y})^2}
$$

Measures variance explained relative to predicting the mean. A negative R2 means the model performed worse than that mean reference on the evaluated data. R2 is not an accuracy percentage.

### WAPE

The clean notebook also calculates weighted absolute percentage error:

$$
WAPE = 100 \times \frac{\sum_i|y_i - \hat{y}_i|}{\sum_i|y_i|}
$$

WAPE is often more stable than MAPE when observations have different spending scales.

## 10. Runtime API

### Load the model

```python
from src.Forecating.spending_forecasting_pipeline import load_model

model, metadata = load_model(
    "src/models/spending_forecaster.pkl",
    "src/models/model_metadata.pkl",
)
```

Both files are required:

- `spending_forecaster.pkl` contains the fitted estimator.
- `model_metadata.pkl` contains preprocessing and model information, especially `cap_value`.

### Generate all available predictions

```python
from src.Forecating.spending_forecasting_pipeline import predict

predictions = predict(model, metadata, transactions)
```

The returned DataFrame contains:

| Column | Meaning |
| --- | --- |
| `date` | Date represented by the prediction row |
| `predicted_spending` | Model output for that date |

There is one row for each date with complete feature history.

### Get the latest prediction

```python
from src.Forecating.spending_forecasting_pipeline import predict_latest

latest = predict_latest(model, metadata, transactions)
```

The returned dictionary has this shape:

```python
{
    "date": "YYYY-MM-DD",
    "predicted_spending": 12345.67,
}
```

`predict_latest()` first generates every valid prediction and then returns the final row chronologically. It does not recursively forecast multiple future days.

## 11. Running the pipeline directly

The module includes a small manual test in its `__main__` block. From the repository root, run:

```powershell
python src/Forecating/spending_forecasting_pipeline.py
```

The paths in that block are examples and may need to be changed for the active environment. Application code should import the functions rather than depend on the hard-coded paths.

## 12. Important limitations

1. **The current inference output is not a clearly defined multi-day future forecast.** It predicts for every date that can be constructed from the supplied history and returns the latest valid row. The target definition must be verified against the model metadata before presenting the value as “next 7 days” or another horizon.
2. **Training and inference must use the same feature schema.** The clean notebook explores 25 features, while the current pipeline supplies 14 features. A clean-notebook model cannot be loaded into the current pipeline without an aligned implementation.
3. **The cap fallback is data-dependent.** Missing `cap_value` metadata can make predictions vary across input batches.
4. **Missing dates are assumed to be zero-spending dates.** This can be wrong when the source statement is incomplete.
5. **No uncertainty interval is returned.** The API returns a point estimate only; it does not communicate prediction confidence or a likely range.
6. **No user-level isolation is implemented here.** If transactions for multiple users are passed together, their daily totals are mixed. Group by user and run the pipeline separately when user identifiers are present.
7. **The model is sensitive to distribution changes.** New spending habits, inflation, salary changes, recurring bills, or changes in data collection can reduce accuracy.
8. **Capped training totals are not actual accounting totals.** The forecast is based on a robustified series intended to reduce outlier influence, while reporting datasets may use uncapped amounts.

## 13. Recommended production checks

Before using a prediction in the application:

- Validate that `transaction_date` and `amount` exist and contain usable values.
- Confirm that all amounts use the training currency and sign convention.
- Confirm the input represents a complete history, or revise the missing-date logic.
- Check that the supplied model's feature list matches `FEATURES` exactly.
- Require at least 30 days of reliable history.
- Log the model version, metadata, cap value, input date range, and prediction date.
- Monitor MAE or WAPE over newly observed future data.
- Compare the model regularly with the previous-7-day-mean baseline.
- Retrain when performance degrades or the data distribution changes materially.

## 14. Recommended next alignment step

The clean notebook should become the single source of truth for the deployed contract. To make it deployable, save its selected model and metadata, then update `spending_forecasting_pipeline.py` to construct exactly the clean notebook's feature set and target interpretation. Until that alignment is completed, use the current 14-feature model only with the current 14-feature inference pipeline and describe its output conservatively as a predicted smoothed spending level.