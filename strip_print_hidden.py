import os
import re

def process_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()

    modified = False

    # Patterns to remove
    patterns = [
        (r'\$\{showPrintPreview \? \'print:hidden\' : \'\'\}', ''),
        (r'\$\{showPrintPreview \|\| isDrawerOpen \? \'print:hidden\' : \'\'\}', ''),
        (r'\$\{showPrintModal \? \'print:hidden\' : \'\'\}', ''),
        (r'\$\{showPrintModal \? \'print:hidden\' : \'no-print\'\}', 'no-print')
    ]
    
    for old, new in patterns:
        content, count = re.subn(old, new, content)
        if count > 0:
            modified = True

    # Also clean up trailing spaces in classNames caused by replacement
    content = content.replace("  }", " }").replace(" '}", "'}").replace(" `}", "`}")

    if modified:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Patched {filepath}")

finance_dir = 'src/pages/finance'
for root, dirs, files in os.walk(finance_dir):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))
