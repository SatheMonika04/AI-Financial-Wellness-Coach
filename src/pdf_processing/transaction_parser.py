"""Deterministic extraction of transaction candidates from PDF content."""

from __future__ import annotations

import re
from typing import Any

DATE_START = re.compile(
	r"^\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|"
	r"\d{1,2}[- ]?[A-Za-z]{3}[- ]?\d{2,4}|"
	r"[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\b",
	re.I,
)
AMOUNT = re.compile(r"(?:₹\s*)?\(?[-]?\d[\d,]*(?:\.\d{1,2})?\)?(?:\s*(?:DR|CR))?", re.I)
SCHEMA = ("transaction_date", "description", "transaction", "amount")


def _amounts(text: str) -> list[str]:
	return [match.group(0).strip() for match in AMOUNT.finditer(text) if re.search(r"\d", match.group(0))]


def _candidate_from_lines(lines: list[str]) -> dict[str, Any] | None:
	first = DATE_START.match(lines[0])
	if not first:
		return None
	body = " ".join(line.strip() for line in lines)
	remainder = body[first.end():].strip()
	type_match = re.search(r"\b(DEBIT|CREDIT)\b", remainder, re.I)
	if type_match:
		amounts = _amounts(remainder[type_match.end():])
		if amounts:
			row: dict[str, Any] = {key: None for key in SCHEMA}
			row.update(
				transaction_date=first.group(1),
				description=re.sub(r"\s+", " ", remainder[:type_match.start()]).strip(" -|"),
				transaction=type_match.group(1).title(),
				amount=amounts[0],
			)
			return row
	values = _amounts(remainder)
	description = remainder
	amount_values = values[-2:] if len(values) >= 2 else values[-1:]
	for value in amount_values:
		description = description.replace(value, " ", 1)
	description = " ".join(description.split()).strip(" -|")
	if re.search(r"\b(?:opening|closing)\s+balance\b", description, re.I):
		return None
	row: dict[str, Any] = {key: None for key in SCHEMA}
	row.update(transaction_date=first.group(1), description=description or None)
	if len(values) >= 2:
		amount = values[-2]
	elif values:
		amount = values[0]
	else:
		amount = None
	row["amount"] = amount
	if amount is not None:
		if re.search(r"(?:^|[/ ])(?:DR|DEBIT)(?:[/ ]|$)", description, re.I):
			row["transaction"] = "Debit"
		elif re.search(r"(?:^|[/ ])(?:CR|CREDIT)(?:[/ ]|$)", description, re.I):
			row["transaction"] = "Credit"
		else:
			# Do not guess a sign for unlabeled amounts: leave the type unset so
			# validate_transaction() can reject the row as invalid for review.
			row["transaction"] = None
	return row


def _parse_table(table: list[list[Any]], column_mapping: dict[str, str]) -> list[dict[str, Any]]:
	if not table:
		return []
	header = [str(value or "").strip() for value in table[0]]
	indexes = {name: header.index(source) for name, source in column_mapping.items() if source in header}
	rows = []
	for values in table[1:]:
		cells = [str(value or "").strip() for value in values]
		date_index = indexes.get("transaction_date")
		if not any(cells) or date_index is None or date_index >= len(cells) or not DATE_START.match(cells[date_index]):
			continue
		row = {key: None for key in SCHEMA}
		row["transaction_date"] = cells[date_index]
		description_index = indexes["description"]
		row["description"] = cells[description_index] if description_index < len(cells) else None
		if "transaction" in indexes:
			index = indexes["transaction"]
			row["transaction"] = cells[index] if index < len(cells) and cells[index] else None
		if "amount" in indexes:
			index = indexes["amount"]
			row["amount"] = cells[index] if index < len(cells) and cells[index] else None
		elif "debit" in indexes and indexes["debit"] < len(cells) and cells[indexes["debit"]]:
			index = indexes["debit"]
			row["transaction"], row["amount"] = "Debit", cells[index]
		elif "credit" in indexes and indexes["credit"] < len(cells) and cells[indexes["credit"]]:
			index = indexes["credit"]
			row["transaction"], row["amount"] = "Credit", cells[index]
		rows.append(row)
	return rows


def parse_transactions(pages: list[dict[str, Any]], column_mapping: dict[str, str] | None = None) -> list[dict[str, Any]]:
	"""Extract transaction candidates, including continuation lines, from pages."""
	rows: list[dict[str, Any]] = []
	pending: list[str] = []
	for page in pages:
		for table in page.get("tables", []):
			if column_mapping:
				rows.extend(_parse_table(table, column_mapping))
		for line in (page.get("text") or "").splitlines():
			if DATE_START.match(line):
				if pending:
					candidate = _candidate_from_lines(pending)
					if candidate:
						rows.append(candidate)
				pending = [line]
			elif pending and line.strip() and not re.search(r"page\s+\d+\s+(?:of|/)", line, re.I):
				pending.append(line)
	if pending:
		candidate = _candidate_from_lines(pending)
		if candidate:
			rows.append(candidate)
	return rows
