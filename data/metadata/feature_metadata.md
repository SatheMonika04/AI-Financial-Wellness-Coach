## transaction_text

### Feature Type
Text

### Source Columns
- merchant
- description

### Transformation
Concatenate merchant and description into a single text field with whitespace handling.

### Purpose
Provide a unified NLP-ready text feature for expense categorization.

### Used In
Expense Categorization Model

### Validation
- Missing values: 0
- Duplicate texts: 5791 (expected due to repeated merchants/descriptions)
- Average length: 36.54 characters
- Minimum length: 11 characters
- Maximum length: 73 characters

---

## amount_log

**Type:** Numeric

**Source:** amount

**Transformation:** Applied `np.log1p(amount)`.

**Purpose:** Reduce right skewness of transaction amounts and improve numerical stability for ML models.

**Validation:**
- Original skewness: 8.3749
- Log-transformed skewness: 0.3896

**Used In:**
- Expense Categorization
- (Potentially other ML models)

---

## amount_bucket

**Type:** Categorical

**Source:** amount

**Transformation:** Created using `pd.qcut()` with 3 quantiles.

**Labels:**
- Small
- Medium
- Large

**Purpose:** Represent transaction size as a categorical feature while maintaining balanced groups.

**Validation:**
- Small: 2333
- Medium: 2333
- Large: 2334

**Used In:**
- Expense Categorization

---

## Date Features

### day
- Source: transaction_date
- Transformation: Extracted day of month
- Used In: Forecasting

### week
- Source: transaction_date
- Transformation: ISO calendar week
- Used In: Forecasting

### month
- Source: transaction_date
- Transformation: Month number
- Used In: Forecasting

### weekend
- Source: transaction_date
- Transformation: Saturday/Sunday flag
- Used In: Forecasting

### month_end
- Source: transaction_date
- Transformation: Month-end flag
- Used In: Forecasting

### salary_week
- Source: transaction_date
- Transformation: Rule-based salary period indicator
- Used In: Forecasting

### festival_season
- Source: transaction_date
- Transformation: Rule-based festival period indicator
- Used In: Forecasting

---
# Categorical Features

## payment_method

Type: Categorical

Unique Values:
- UPI
- Auto Debit
- Debit Card
- Net Banking
- Credit Card
- NEFT
- Cash Withdrawal
- IMPS

Encoding Strategy:
OneHotEncoder (inside sklearn Pipeline)

---

## transaction_type

Type: Categorical

Unique Values:
- Debit
- Credit

Encoding Strategy:
OneHotEncoder (inside sklearn Pipeline)

---

# Model Feature Sets

## Expense Classification

Features:
- transaction_text
- amount
- amount_log
- amount_bucket
- payment_method
- transaction_type

Target:
- category

---

## Spending Forecasting

Features:
- transaction_date
- amount
- day
- week
- month
- weekend
- month_end
- salary_week
- festival_season

---

## Merchant Analytics

Features:
- merchant
- amount
- category

