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