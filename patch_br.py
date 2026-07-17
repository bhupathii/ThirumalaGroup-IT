import re

with open('src/pages/finance/BusinessReport.tsx', 'r') as f:
    content = f.read()

# Add sortNumerically and getLocalBusinessDateISO import
if 'sortNumerically' not in content:
    content = content.replace("import { getLocalBusinessDateISO } from '../../utils/dateUtils';", "import { getLocalBusinessDateISO } from '../../utils/dateUtils';\nimport { sortNumerically } from '../../lib/financialCalculations';\nimport { ChevronRight } from 'lucide-react';")

# I need to completely replace BusinessReport.tsx with the version that has the 10 summary items and a single unified table.
# Since the logic was completely replaced by the user, I will rewrite the logic back to the unified one but retaining any fixes.

