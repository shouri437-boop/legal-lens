#!/usr/bin/env python3
"""Create a sample PDF for testing redaction functionality."""

import fitz  # PyMuPDF


def create_sample_pdf(output_path: str = "sample.pdf"):
    """Create a sample PDF with test content for redaction.

    Args:
        output_path: Path where the PDF will be saved
    """
    # Create a new PDF
    doc = fitz.open()

    # Page 1: Personal Information
    page1 = doc.new_page()
    text1 = """
    CONFIDENTIAL DOCUMENT
    
    Employee Information:
    Name: John Smith
    Phone: (555) 123-4567
    Email: john.smith@example.com
    SSN: 123-45-6789
    
    Emergency Contact:
    Name: Jane Smith
    Phone: (555) 987-6543
    
    Address: 123 Main Street, Anytown, CA 90210
    """
    page1.insert_text((50, 50), text1, fontsize=12)

    # Page 2: Financial Information
    page2 = doc.new_page()
    text2 = """
    FINANCIAL SUMMARY
    
    Account Holder: Robert Johnson
    Account Number: 9876543210
    Credit Card: 4532-1234-5678-9010
    
    Transaction History:
    - Payment to Alice Williams: $1,500.00
    - Payment from David Brown: $2,300.00
    
    Bank Contact: (555) 246-8135
    """
    page2.insert_text((50, 50), text2, fontsize=12)

    # Page 3: Legal Document
    page3 = doc.new_page()
    text3 = """
    LEGAL AGREEMENT
    
    This agreement is between:
    Party A: Michael Davis (SSN: 987-65-4321)
    Party B: Sarah Wilson (SSN: 456-78-9012)
    
    Witness: Thomas Anderson
    Date: January 15, 2024
    
    Contact Information:
    Attorney: Jennifer Martinez
    Phone: (555) 369-2580
    Email: j.martinez@lawfirm.com
    """
    page3.insert_text((50, 50), text3, fontsize=12)

    # Save the PDF
    doc.save(output_path)
    doc.close()

    print(f"✓ Sample PDF created: {output_path}")
    print("\nTest redaction prompts:")
    print('  1. "Redact all personal names"')
    print('  2. "Redact all phone numbers and email addresses"')
    print('  3. "Redact SSN and credit card numbers"')
    print('  4. "Redact all PII (personally identifiable information)"')


if __name__ == "__main__":
    create_sample_pdf()
