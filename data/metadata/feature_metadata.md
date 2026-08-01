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