import os
import re

def process_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()

    modified = False

    # Ensure import exists
    if 'sortNumerically' not in content and ('loan_id' in content or 'cdNumber' in content) and '.map' in content:
        import_stmt = "import { sortNumerically } from '../../lib/financialCalculations';"
        if import_stmt not in content:
            # find first import
            first_import = content.find('import')
            if first_import != -1:
                content = content[:first_import] + import_stmt + '\n' + content[first_import:]
                modified = True

    # Common replacements
    patterns = [
        (r'filtered\.map\(\(loan, idx\)', r'filtered.sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).map((loan, idx)'),
        (r'nameSuggestions\.map\(loan', r'nameSuggestions.sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).map(loan'),
        (r'acSuggestions\.map\(loan', r'acSuggestions.sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).map(loan'),
        # LoanEntry
        (r'data\.map\(l => l\.loan_id\)', r'data.map(l => l.loan_id).sort((a,b) => sortNumerically(a, b))'),
        # Search.tsx
        (r'searchResults\.map\(loan', r'searchResults.sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).map(loan'),
        # DuesLedger.tsx (if any)
        (r'filteredDues\.map\(due', r'filteredDues.sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).map(due'),
        # TBDLedger
        (r'filteredLoansList\.map\(\(loan', r'filteredLoansList.sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).map((loan')
    ]
    
    for old, new in patterns:
        if re.search(old, content) and new.replace('\\', '') not in content:
            content = re.sub(old, new, content)
            modified = True

    if modified:
        # cleanup if it was replaced multiple times
        content = content.replace("sort((a,b) => sortNumerically(a.loan_id, b.loan_id)).sort((a,b) => sortNumerically(a.loan_id, b.loan_id))", "sort((a,b) => sortNumerically(a.loan_id, b.loan_id))")
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Patched {filepath}")

# Gather all tsx files in src/pages/finance
finance_dir = 'src/pages/finance'
for root, dirs, files in os.walk(finance_dir):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))

