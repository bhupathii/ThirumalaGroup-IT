import re

with open('src/pages/finance/LoanEntry.tsx', 'r') as f:
    content = f.read()

# Add mandatoryFields state
state_code = """  const [isPhotoScannerOpen, setIsPhotoScannerOpen] = useState(false);
  
  const [mandatoryFields, setMandatoryFields] = useState<any>({
    borrowerAadhaar: true,
    borrowerPhone: true,
    g1Aadhaar: true,
    g1Phone: true,
    g2Aadhaar: false,
    g2Phone: false
  });

  useEffect(() => {
    supabaseFinance.getFinanceSettings('loan_entry_mandatory_fields').then(res => {
      if (res) setMandatoryFields(res);
    });
  }, []);"""

content = content.replace("  const [isPhotoScannerOpen, setIsPhotoScannerOpen] = useState(false);", state_code)


# Update fields validation array
old_fields = """    const fields: ValidationField[] = [
      { name: 'date', label: 'Date', value: date, required: true, ref: dateRef },
      { name: 'loanId', label: 'Loan Number', value: loanId, required: true, ref: loanIdRef },
      { name: 'custName', label: 'Customer Name', value: custName, required: true, ref: custNameRef },
      { name: 'custPhone', label: 'Customer Phone', value: custPhone, required: true, ref: custPhoneRef },
      { name: 'custAadhaar', label: 'Customer Aadhaar UID', value: custAadhaar, required: true },
      { name: 'g1Name', label: 'Guarantor 1 Name', value: g1Name, required: true },
      { name: 'g1Aadhaar', label: 'Guarantor 1 Aadhaar', value: g1Aadhaar, required: true },
      { name: 'g1Phone', label: 'Guarantor 1 Phone', value: g1Phone, required: true },
      { name: 'amount', label: 'Loan Amount', value: amount, required: true, ref: amountRef },
      { name: 'interestRate', label: 'Rate of Interest', value: interestRate, required: true, ref: interestRateRef },
      { name: 'durationMonths', label: 'Period', value: durationMonths, required: true, ref: durationMonthsRef },
      { name: 'particulars', label: 'Particulars', value: particulars, required: true, ref: particularsRef },
    ];

    if (g2Name?.trim() || g2Aadhaar?.trim() || g2Phone?.trim()) {
      if (!g2Name?.trim()) fields.push({ name: 'g2Name', label: 'Guarantor 2 Name', value: g2Name, required: true });
      if (!g2Aadhaar?.trim()) fields.push({ name: 'g2Aadhaar', label: 'Guarantor 2 Aadhaar', value: g2Aadhaar, required: true });
      if (!g2Phone?.trim()) fields.push({ name: 'g2Phone', label: 'Guarantor 2 Phone', value: g2Phone, required: true });
    }"""

new_fields = """    const fields: ValidationField[] = [
      { name: 'date', label: 'Date', value: date, required: true, ref: dateRef },
      { name: 'loanId', label: 'Loan Number', value: loanId, required: true, ref: loanIdRef },
      { name: 'custName', label: 'Customer Name', value: custName, required: true, ref: custNameRef },
      { name: 'custPhone', label: 'Customer Phone', value: custPhone, required: mandatoryFields.borrowerPhone, ref: custPhoneRef },
      { name: 'custAadhaar', label: 'Customer Aadhaar UID', value: custAadhaar, required: mandatoryFields.borrowerAadhaar },
      { name: 'g1Name', label: 'Guarantor 1 Name', value: g1Name, required: true },
      { name: 'g1Aadhaar', label: 'Guarantor 1 Aadhaar', value: g1Aadhaar, required: mandatoryFields.g1Aadhaar },
      { name: 'g1Phone', label: 'Guarantor 1 Phone', value: g1Phone, required: mandatoryFields.g1Phone },
      { name: 'amount', label: 'Loan Amount', value: amount, required: true, ref: amountRef },
      { name: 'interestRate', label: 'Rate of Interest', value: interestRate, required: true, ref: interestRateRef },
      { name: 'durationMonths', label: 'Period', value: durationMonths, required: true, ref: durationMonthsRef },
      { name: 'particulars', label: 'Particulars', value: particulars, required: true, ref: particularsRef },
    ];

    if (g2Name?.trim() || g2Aadhaar?.trim() || g2Phone?.trim()) {
      if (!g2Name?.trim()) fields.push({ name: 'g2Name', label: 'Guarantor 2 Name', value: g2Name, required: true });
      if (mandatoryFields.g2Aadhaar && !g2Aadhaar?.trim()) fields.push({ name: 'g2Aadhaar', label: 'Guarantor 2 Aadhaar', value: g2Aadhaar, required: true });
      if (mandatoryFields.g2Phone && !g2Phone?.trim()) fields.push({ name: 'g2Phone', label: 'Guarantor 2 Phone', value: g2Phone, required: true });
    }"""

content = content.replace(old_fields, new_fields)

# Let's also update the "required" asterisks in the UI.
old_borrower_phone = '<label className="block text-xs font-bold text-slate-700 uppercase">Phone *</label>'
new_borrower_phone = '<label className="block text-xs font-bold text-slate-700 uppercase">Phone {mandatoryFields.borrowerPhone ? "*" : ""}</label>'
content = content.replace(old_borrower_phone, new_borrower_phone)

old_borrower_aadhaar = '<label className="block text-xs font-bold text-slate-700 uppercase">Aadhaar UID *</label>'
new_borrower_aadhaar = '<label className="block text-xs font-bold text-slate-700 uppercase">Aadhaar UID {mandatoryFields.borrowerAadhaar ? "*" : ""}</label>'
content = content.replace(old_borrower_aadhaar, new_borrower_aadhaar)

old_g1_phone = '<label className="block text-xs font-bold text-slate-700 uppercase">Guarantor 1 Phone *</label>'
new_g1_phone = '<label className="block text-xs font-bold text-slate-700 uppercase">Guarantor 1 Phone {mandatoryFields.g1Phone ? "*" : ""}</label>'
content = content.replace(old_g1_phone, new_g1_phone)

old_g1_aadhaar = '<label className="block text-xs font-bold text-slate-700 uppercase">Guarantor 1 Aadhaar *</label>'
new_g1_aadhaar = '<label className="block text-xs font-bold text-slate-700 uppercase">Guarantor 1 Aadhaar {mandatoryFields.g1Aadhaar ? "*" : ""}</label>'
content = content.replace(old_g1_aadhaar, new_g1_aadhaar)


with open('src/pages/finance/LoanEntry.tsx', 'w') as f:
    f.write(content)
