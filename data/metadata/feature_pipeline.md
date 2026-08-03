# Feature Engineering Pipeline

## Purpose

This document describes the complete feature engineering workflow used to transform the validated master transaction dataset into model-ready feature datasets.

---

# Input Dataset

File:

datasets/master/master_transactions.csv

Shape:

7000 rows × 20 columns

Contains:

- Transaction details
- Merchant information
- Payment information
- Date-related features
- Location information

---

# Pipeline Overview

Validated Master Dataset
        │
        ▼
Data Validation
        │
        ▼
Feature Planning
        │
        ▼
Text Feature Engineering
        │
        ├── transaction_text
        │
        ▼
Numerical Feature Engineering
        │
        ├── amount_log
        ├── amount_bucket
        │
        ▼
Date Feature Validation
        │
        ├── day
        ├── week
        ├── month
        ├── weekend
        ├── month_end
        ├── salary_week
        └── festival_season
        │
        ▼
Categorical Feature Preparation
        │
        ├── payment_method
        └── transaction_type
        │
        ▼
Data Leakage Check
        │
        ▼
Model-Specific Feature Selection
        │
        ├── Expense Features
        ├── Forecast Features
        └── Merchant Features
        │
        ▼
Processed Feature Datasets

---

# Step 1 – Input Dataset

Source

datasets/master/master_transactions.csv

Input Columns

- transaction_id
- transaction_date
- transaction_time
- merchant
- description
- amount
- currency
- payment_method
- transaction_type
- category
- city
- state
- country
- day
- week
- month
- weekend
- month_end
- salary_week
- festival_season

---

# Step 2 – Text Feature Engineering

Input

merchant

description

Transformation

transaction_text =
merchant + " " + description

Output

transaction_text

Purpose

Create a single NLP-ready feature for expense classification.

---

# Step 3 – Numerical Feature Engineering

Input

amount

Transformations

1. Log Transformation

amount_log = log1p(amount)

Purpose

Reduce right-skewness.

Validation

Original Skewness = 8.37

Log Skewness = 0.39

---

2. Amount Bucketing

Method

pd.qcut()

Output

- Small
- Medium
- Large

Purpose

Represent transaction size categorically.

---

# Step 4 – Date Feature Validation

Validated Features

- day
- week
- month
- weekend
- month_end
- salary_week
- festival_season

Validation

Each feature was compared against transaction_date.

Result

100% validation accuracy.

---

# Step 5 – Categorical Feature Preparation

Validated Features

- payment_method
- transaction_type

Actions

- Checked unique values
- Verified spelling consistency
- Planned OneHotEncoding

Encoding

Deferred until model pipeline.

---

# Step 6 – Data Leakage Assessment

Every engineered feature was evaluated using the following rule:

A feature is considered safe if it can be computed using only information available at the transaction time.

Excluded Features

- merchant_frequency
- average_merchant_spending
- rolling_average
- future_balance
- future_category

Result

No leakage detected.

---

# Step 7 – Feature Dataset Creation

Expense Classification

Features

- transaction_text
- amount
- amount_log
- amount_bucket
- payment_method
- transaction_type

Target

- category

Output

expense_features.csv

---

Forecasting

Features

- transaction_date
- amount
- day
- week
- month
- weekend
- month_end
- salary_week
- festival_season

Output

forecasting_features.csv

---

Merchant Analytics

Features

- merchant
- amount
- category

Output

merchant_features.csv

---

# Output Files

datasets/processed/

- expense_features.csv
- forecasting_features.csv
- merchant_features.csv

---

# Feature Engineering Summary

Input Dataset

- 7000 rows
- 20 columns

Engineered Features

- transaction_text
- amount_log
- amount_bucket

Total Features After Engineering

23

Output Datasets

- Expense Classification
- Spending Forecasting
- Merchant Analytics

Pipeline Status

Completed