
# Expense Categorization — Problem Definition

## 1. Business Problem

The AI Financial Wellness Coach needs to automatically categorize
financial transactions into meaningful expense categories.

Accurate expense categorization is required for downstream features
such as spending analytics, budget recommendations, forecasting,
anomaly detection, and personalized financial coaching.

---

## 2. Machine Learning Problem

This is a supervised multi-class classification problem.

The model will learn from historical transactions where the expense
category is already known and predict the category for new,
unseen transactions.

---

## 3. ML Objective

Given transaction text, transaction amount, payment method, and
transaction type, predict the most likely expense category.

---

## 4. Input Features

The initial feature set consists of:

- transaction_text
- amount
- amount_log
- payment_method
- transaction_type

### transaction_text

Contains the transaction description or merchant information.

Example:

"UPI payment to Swiggy"

### amount

The transaction amount.

### amount_log

Log-transformed transaction amount created during feature engineering.

### payment_method

The method used for the transaction.

Examples:

- UPI
- Credit Card
- Debit Card
- Cash
- Net Banking

### transaction_type

Indicates the transaction direction/type.

Examples:

- Debit
- Credit

---

## 5. Target Variable

The target variable is:

`category`

Example categories may include:

- Food
- Shopping
- Transport
- Fuel
- Bills
- Entertainment
- Healthcare
- Travel
- Education
- Other

The exact categories will be determined from the validated dataset.

---

## 6. Problem Type

Supervised Learning

Multi-Class Classification

---

## 7. Evaluation Metrics

### Primary Metric

Macro F1-score

Macro F1 is selected because expense categories may be imbalanced
and each category should receive equal importance during evaluation.

### Secondary Metrics

- Accuracy
- Precision
- Recall
- Weighted F1-score

Additional evaluation will include:

- Confusion Matrix
- Classification Report
- Error Analysis

---

## 8. Model Development Strategy

The following models will initially be evaluated:

1. Logistic Regression
2. Multinomial Naive Bayes
3. Linear Support Vector Machine

Additional models such as XGBoost or LightGBM may be evaluated
if required.

The objective is not to select the most complex model but to
identify the model that provides the best balance between predictive
performance, generalization, interpretability, and deployment
simplicity.

---

## 9. Data Leakage Prevention

Only information available at transaction prediction time should
be used as model input.

Features derived directly or indirectly from the target variable
must not be included.

Train, validation, and test data must be separated before fitting
data-dependent preprocessing components.

---

## 10. Business Usage

The predicted category will be used by downstream components:

Transaction
    ↓
Expense Categorization
    ↓
Categorized Spending
    ↓
Analytics
    ↓
Budget Recommendation
    ↓
Forecasting
    ↓
Financial Wellness Coach
