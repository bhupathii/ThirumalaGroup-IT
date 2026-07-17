import re

with open('src/pages/finance/TransactionApproval.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<th className="px-6 py-4 text-center tracking-wider">Actions</th>',
    '<th className="px-6 py-4 text-center tracking-wider min-w-[200px]">Actions</th>'
)

with open('src/pages/finance/TransactionApproval.tsx', 'w') as f:
    f.write(content)
