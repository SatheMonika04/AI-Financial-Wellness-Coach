from __future__ import annotations

import csv
import hashlib
import io
import logging
import re
import tempfile
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.api.auth import current_user, get_db
from src.database.financial_models import FinancialTransaction
from src.database.models import User
from src.pdf_processing.pipeline import process_bank_statement_to_dataframe

LOGGER = logging.getLogger(__name__)
router = APIRouter(tags=["financial data"])
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMPORT_ROWS = 5000
ALLOWED_CATEGORIES = {
    "Housing", "Groceries", "Transportation", "Dining", "Shopping", "Healthcare",
    "Utilities", "Entertainment", "Education", "Other", "Income",
}


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: str
    merchant: str
    description: str
    category: str
    type: Literal["income", "expense"]
    amount: float
    paymentMethod: str | None
    status: str
    source: Literal["import", "manual"]


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    pageSize: int


class ImportRow(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    date: datetime
    merchant: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: Literal["income", "expense"]
    category: str
    paymentMethod: str | None = Field(default=None, max_length=40)

    @field_validator("merchant", "description")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value

    @field_validator("category")
    @classmethod
    def supported_category(cls, value: str) -> str:
        if value not in ALLOWED_CATEGORIES:
            raise ValueError("Choose a supported transaction category")
        return value


class ImportRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(max_length=MAX_IMPORT_ROWS)


class InvalidImportRow(BaseModel):
    row: int
    errors: list[str]


class ImportResponse(BaseModel):
    totalRows: int
    validRows: int
    importedRows: int
    duplicateRowsSkipped: int
    invalidRows: int
    categorizedTransactions: int
    rowsRequiringCorrection: int
    invalidDetails: list[InvalidImportRow]
    transactions: list[TransactionResponse]


class StatementResponse(BaseModel):
    fileName: str
    fileType: Literal["csv", "pdf"]
    headers: list[str]
    rows: list[list[str]]
    suggestedMapping: dict[str, str | None]


def _to_response(row: FinancialTransaction) -> TransactionResponse:
    return TransactionResponse(
        id=str(row.id),
        date=row.transaction_date.isoformat(timespec="minutes"),
        merchant=row.merchant,
        description=row.description,
        category=row.category,
        type=row.transaction_type,  # type: ignore[arg-type]
        amount=float(row.amount),
        paymentMethod=row.payment_method,
        status=row.status,
        source=row.source,  # type: ignore[arg-type]
    )


def _fingerprint(row: ImportRow) -> str:
    canonical = "\x1f".join(
        (
            row.date.isoformat(timespec="minutes"),
            row.type,
            format(row.amount.quantize(Decimal("0.01")), "f"),
            re.sub(r"\s+", " ", row.description.casefold()).strip(),
        )
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@router.get("/api/transactions", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    category: str | None = None,
    transaction_type: Literal["income", "expense"] | None = None,
    search: str | None = Query(default=None, max_length=120),
    start_date: date | None = None,
    end_date: date | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> TransactionListResponse:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date")
    statement = select(FinancialTransaction).where(FinancialTransaction.user_id == user.id)
    if category:
        statement = statement.where(FinancialTransaction.category == category)
    if transaction_type:
        statement = statement.where(FinancialTransaction.transaction_type == transaction_type)
    if search:
        needle = f"%{search.strip()}%"
        statement = statement.where(
            FinancialTransaction.description.ilike(needle)
            | FinancialTransaction.merchant.ilike(needle)
        )
    if start_date:
        statement = statement.where(
            FinancialTransaction.transaction_date >= datetime.combine(start_date, time.min)
        )
    if end_date:
        statement = statement.where(
            FinancialTransaction.transaction_date < datetime.combine(end_date, time.max)
        )
    total = db.scalar(select(__import__("sqlalchemy").func.count()).select_from(statement.subquery())) or 0
    rows = db.scalars(
        statement.order_by(FinancialTransaction.transaction_date.desc(), FinancialTransaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return TransactionListResponse(
        items=[_to_response(row) for row in rows],
        total=total,
        page=page,
        pageSize=page_size,
    )


@router.get("/api/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> TransactionResponse:
    row = db.scalar(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.user_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _to_response(row)


@router.post("/api/transactions/import", response_model=ImportResponse)
def import_transactions(
    payload: ImportRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ImportResponse:
    invalid_details: list[InvalidImportRow] = []
    valid: list[ImportRow] = []
    for index, raw in enumerate(payload.rows, start=1):
        try:
            valid.append(ImportRow.model_validate(raw))
        except ValidationError as exc:
            invalid_details.append(
                InvalidImportRow(
                    row=index,
                    errors=[str(issue["msg"]) for issue in exc.errors(include_url=False)],
                )
            )

    if not valid:
        return ImportResponse(
            totalRows=len(payload.rows),
            validRows=0,
            importedRows=0,
            duplicateRowsSkipped=0,
            invalidRows=len(invalid_details),
            categorizedTransactions=0,
            rowsRequiringCorrection=len(invalid_details),
            invalidDetails=invalid_details,
            transactions=[],
        )

    fingerprints = {_fingerprint(row) for row in valid}
    existing = set(
        db.scalars(
            select(FinancialTransaction.fingerprint).where(
                FinancialTransaction.user_id == user.id,
                FinancialTransaction.fingerprint.in_(fingerprints),
            )
        ).all()
    )
    imported: list[FinancialTransaction] = []
    seen = set(existing)
    duplicate_count = 0
    try:
        for row in valid:
            fingerprint = _fingerprint(row)
            if fingerprint in seen:
                duplicate_count += 1
                continue
            seen.add(fingerprint)
            transaction = FinancialTransaction(
                user_id=user.id,
                transaction_date=row.date.replace(tzinfo=None),
                merchant=row.merchant,
                description=row.description,
                category=row.category,
                transaction_type=row.type,
                amount=row.amount.quantize(Decimal("0.01")),
                payment_method=row.paymentMethod,
                status="completed",
                source="import",
                fingerprint=fingerprint,
            )
            db.add(transaction)
            imported.append(transaction)
        db.commit()
        for transaction in imported:
            db.refresh(transaction)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A transaction import conflicted with another request; retry to skip duplicates",
        ) from None
    except Exception:
        db.rollback()
        raise

    categorized = sum(row.category != "Other" for row in valid if _fingerprint(row) not in existing)
    return ImportResponse(
        totalRows=len(payload.rows),
        validRows=len(valid),
        importedRows=len(imported),
        duplicateRowsSkipped=duplicate_count,
        invalidRows=len(invalid_details),
        categorizedTransactions=categorized,
        rowsRequiringCorrection=sum(row.category == "Other" for row in valid) + len(invalid_details),
        invalidDetails=invalid_details,
        transactions=[_to_response(row) for row in imported],
    )


@router.patch("/api/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    patch: dict[str, Any],
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> TransactionResponse:
    allowed = {"category", "merchant", "description", "paymentMethod", "date"}
    if not patch or set(patch) - allowed:
        raise HTTPException(status_code=422, detail="Only category, merchant, description, and date may be updated")
    row = db.scalar(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.user_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if "category" in patch:
        if patch["category"] not in ALLOWED_CATEGORIES:
            raise HTTPException(status_code=422, detail="Choose a supported transaction category")
        row.category = patch["category"]
    if "merchant" in patch:
        if not isinstance(patch["merchant"], str) or not patch["merchant"].strip():
            raise HTTPException(status_code=422, detail="Merchant must not be empty")
        row.merchant = patch["merchant"].strip()[:120]
    if "description" in patch:
        if not isinstance(patch["description"], str) or not patch["description"].strip():
            raise HTTPException(status_code=422, detail="Description must not be empty")
        row.description = patch["description"].strip()
    if "paymentMethod" in patch:
        value = patch["paymentMethod"]
        if value is not None and (not isinstance(value, str) or len(value) > 40):
            raise HTTPException(status_code=422, detail="Invalid payment method")
        row.payment_method = value
    if "date" in patch:
        try:
            row.transaction_date = datetime.fromisoformat(patch["date"]).replace(tzinfo=None)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Invalid transaction date") from None
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.delete("/api/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    row = db.scalar(
        select(FinancialTransaction).where(
            FinancialTransaction.id == transaction_id,
            FinancialTransaction.user_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(row)
    db.commit()


@router.post("/api/statements/upload", response_model=StatementResponse)
def parse_statement(
    file: UploadFile = File(...),
    _user: User = Depends(current_user),
) -> StatementResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".csv", ".pdf"}:
        raise HTTPException(status_code=415, detail="Upload a CSV or PDF statement")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Statement exceeds the 10 MB limit")
    if not content:
        raise HTTPException(status_code=422, detail="Statement file is empty")
    filename = Path(file.filename or "statement").name[:255]

    if suffix == ".csv":
        try:
            text = content.decode("utf-8-sig")
            records = list(csv.reader(io.StringIO(text, newline="")))
        except (UnicodeDecodeError, csv.Error):
            raise HTTPException(status_code=422, detail="CSV must be valid UTF-8 with well-formed rows") from None
        if not records or not any(cell.strip() for cell in records[0]):
            raise HTTPException(status_code=422, detail="CSV must include a header row")
        headers = [cell.strip() for cell in records[0]]
        rows = [[cell for cell in row] for row in records[1:] if any(cell.strip() for cell in row)]
        if any(len(row) > len(headers) for row in rows):
            raise HTTPException(status_code=422, detail="CSV contains rows with more values than its header")
        mapping = {
            "date": next((h for h in headers if re.search(r"date", h, re.I)), None),
            "description": next((h for h in headers if re.search(r"narration|description|details|merchant|particular", h, re.I)), None),
            "amount": next((h for h in headers if re.search(r"amount|value|debit|withdrawal", h, re.I)), None),
            "type": next((h for h in headers if re.search(r"dr.?cr|type|credit.?debit", h, re.I)), None),
        }
        return StatementResponse(fileName=filename, fileType="csv", headers=headers, rows=rows, suggestedMapping=mapping)

    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="File contents are not a valid PDF")
    try:
        with tempfile.TemporaryDirectory(prefix="moneymind-") as temporary_directory:
            path = Path(temporary_directory) / "statement.pdf"
            path.write_bytes(content)
            frame = process_bank_statement_to_dataframe(path)
            headers = ["transaction_date", "description", "transaction", "amount"]
            rows = [
                [
                    str(value.date()) if hasattr(value, "date") else str(value)
                    for value in values
                ]
                for values in frame[headers].itertuples(index=False, name=None)
            ]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    except Exception:
        LOGGER.exception("Statement PDF parsing failed")
        raise HTTPException(status_code=422, detail="The PDF statement could not be parsed") from None
    return StatementResponse(
        fileName=filename,
        fileType="pdf",
        headers=headers,
        rows=rows,
        suggestedMapping={
            "date": "transaction_date",
            "description": "description",
            "amount": "amount",
            "type": "transaction",
        },
    )


@router.get("/api/dashboard/summary")
def dashboard_summary(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return deterministic cash flow and category totals for this user's records."""
    from sqlalchemy import func

    rows = db.execute(
        select(
            FinancialTransaction.transaction_type,
            FinancialTransaction.category,
            func.sum(FinancialTransaction.amount),
        )
        .where(FinancialTransaction.user_id == user.id)
        .group_by(FinancialTransaction.transaction_type, FinancialTransaction.category)
    ).all()
    income = sum((amount for kind, _, amount in rows if kind == "income"), Decimal("0"))
    expenses = sum((amount for kind, _, amount in rows if kind == "expense"), Decimal("0"))
    categories = [
        {"category": category, "amount": float(amount)}
        for kind, category, amount in rows
        if kind == "expense"
    ]
    return {
        "income": float(income),
        "expenses": float(expenses),
        "netCashFlow": float(income - expenses),
        "savingsRate": float((income - expenses) / income) if income else None,
        "categoryExpenses": sorted(categories, key=lambda item: item["amount"], reverse=True),
        "transactionCount": db.scalar(
            select(func.count()).select_from(FinancialTransaction).where(FinancialTransaction.user_id == user.id)
        ) or 0,
    }
