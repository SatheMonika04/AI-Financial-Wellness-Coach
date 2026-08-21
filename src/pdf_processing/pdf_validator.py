import pdfplumber


MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_pdf(file_path):
    """
    Validate a bank statement PDF before processing.

    Returns:
        dict: Validation result
    """

    result = {
        "valid": False,
        "file_exists": False,
        "file_size_valid": False,
        "is_pdf": False,
        "is_encrypted": False,
        "is_readable": False,
        "has_text": False,
        "page_count": 0,
        "error": None
    }

    # --------------------------------------------------
    # 1. Check whether file exists
    # --------------------------------------------------
    import os

    if not os.path.exists(file_path):
        result["error"] = "PDF file does not exist."
        return result

    result["file_exists"] = True

    # --------------------------------------------------
    # 2. Check file extension
    # --------------------------------------------------
    if not file_path.lower().endswith(".pdf"):
        result["error"] = "File is not a PDF."
        return result

    result["is_pdf"] = True

    # --------------------------------------------------
    # 3. Check file size
    # --------------------------------------------------
    file_size = os.path.getsize(file_path)

    if file_size > MAX_FILE_SIZE:
        result["error"] = "PDF file exceeds the 10 MB limit."
        return result

    result["file_size_valid"] = True

    # --------------------------------------------------
    # 4. Try opening the PDF
    # --------------------------------------------------
    try:

        with pdfplumber.open(file_path) as pdf:

            result["page_count"] = len(pdf.pages)
            result["is_readable"] = True

            for page in pdf.pages:

                text = page.extract_text()

                if text and text.strip():
                    result["has_text"] = True
                    break

    except Exception as e:

        error_message = repr(e)

        if "PDFPasswordIncorrect" in error_message:
            result["error"] = (
                "PDF is password protected. "
                "Please upload an unlocked PDF."
            )
        else:
            result["error"] = (
                f"Unable to read PDF: {error_message}"
            )

        return result

    # --------------------------------------------------
    # 6. Final validation
    # --------------------------------------------------

    if not result["is_readable"]:
        result["error"] = "PDF cannot be read."
        return result

    if not result["has_text"]:
        result["error"] = (
            "PDF contains no extractable text. "
            "It may be a scanned PDF and require OCR."
        )
        return result

    result["valid"] = True
    return result

result = validate_pdf("D:\\clg_project\\AI-Financial-Wellness-Coach\\PhonePe_Statement_Jul2026_Aug2026.pdf")
print(result)