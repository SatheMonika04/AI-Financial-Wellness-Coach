import warnings
warnings.filterwarnings("ignore")
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, accuracy_score

RANDOM_STATE = 42
df = pd.read_csv("D:/clg_project/AI-Financial-Wellness-Coach/data/master/transaction_classification_augmented_v4.csv")
X = df[["transaction_text", "amount", "amount_log", "payment_method", "transaction_type"]]
y = df["category"]

X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=RANDOM_STATE, stratify=y)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=RANDOM_STATE, stratify=y_temp)

categorical_features = ["payment_method", "transaction_type"]
numeric_features = ["amount", "amount_log"]

tfidf_word = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=2, max_df=0.95, sublinear_tf=True)
# char_wb n-grams catch sub-words inside merged/misspelled merchant names,
# e.g. "traders" inside "paradisetraders", "ice"/"cream" inside "icecream".
tfidf_char = TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=(3, 5), min_df=3, max_df=0.95, sublinear_tf=True)
encoder = OneHotEncoder(handle_unknown="ignore")
scaler = StandardScaler(with_mean=False)

preprocessor = ColumnTransformer(transformers=[
    ("text_word", tfidf_word, "transaction_text"),
    ("text_char", tfidf_char, "transaction_text"),
    ("categorical", encoder, categorical_features),
    ("numeric", scaler, numeric_features),
])

X_train_t = preprocessor.fit_transform(X_train)
X_val_t = preprocessor.transform(X_val)
X_test_t = preprocessor.transform(X_test)

svm_balanced = LinearSVC(C=1.0, class_weight="balanced", random_state=RANDOM_STATE)
calibrated = CalibratedClassifierCV(svm_balanced, method="sigmoid", cv=3)
calibrated.fit(X_train_t, y_train)

pred_val = calibrated.predict(X_val_t)
print("=== Validation ===")
print("Accuracy:", accuracy_score(y_val, pred_val))
print("Macro F1:", f1_score(y_val, pred_val, average="macro"))

pred_test = calibrated.predict(X_test_t)
print("=== Test ===")
print("Accuracy:", accuracy_score(y_test, pred_test))
print("Macro F1:", f1_score(y_test, pred_test, average="macro"))

final_pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", calibrated)])
joblib.dump(final_pipeline, "D:/clg_project/AI-Financial-Wellness-Coach/src/models/expense_classifier_pipeline_v6.pkl")
print("Saved expense_classifier_pipeline_v6.pkl")