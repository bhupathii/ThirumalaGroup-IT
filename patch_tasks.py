import re

with open('/Users/karthikmac/.gemini/antigravity-ide/brain/6ed5bc19-ca95-4630-8903-58c226fca182/task.md', 'r') as f:
    content = f.read()

content = content.replace("- `[ ]` 9", "- `[x]` 9").replace("- `[/]` 9", "- `[x]` 9")

with open('/Users/karthikmac/.gemini/antigravity-ide/brain/6ed5bc19-ca95-4630-8903-58c226fca182/task.md', 'w') as f:
    f.write(content)
