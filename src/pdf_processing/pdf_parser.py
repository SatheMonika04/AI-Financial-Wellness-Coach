import pdfplumber


def extract_pdf_content(file_path):
    """
    Extract raw text and tables from every page of a PDF.

    Returns:
        list: Extracted content for each page.
    """

    pages_data = []

    with pdfplumber.open(file_path) as pdf:

        for page_number, page in enumerate(pdf.pages, start=1):

            # Extract raw text
            text = page.extract_text()

            # Extract tables
            tables = page.extract_tables()

            page_data = {
                "page_number": page_number,
                "text": text,
                "tables": tables
            }

            pages_data.append(page_data)

    return pages_data