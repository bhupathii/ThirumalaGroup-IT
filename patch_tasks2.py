import re

with open('/Users/karthikmac/.gemini/antigravity-ide/brain/6ed5bc19-ca95-4630-8903-58c226fca182/task.md', 'r') as f:
    content = f.read()

content = content.replace("- `[ ]` 11", "- `[x]` 11").replace("- `[/]` 11", "- `[x]` 11")
content = content.replace("- `[ ]` 12", "- `[x]` 12").replace("- `[/]` 12", "- `[x]` 12")
content = content.replace("- `[ ]` 4", "- `[x]` 4").replace("- `[/]` 4", "- `[x]` 4")
content = content.replace("- `[ ]` 8", "- `[x]` 8").replace("- `[/]` 8", "- `[x]` 8")
content = content.replace("- `[ ]` 10", "- `[x]` 10").replace("- `[/]` 10", "- `[x]` 10")

with open('/Users/karthikmac/.gemini/antigravity-ide/brain/6ed5bc19-ca95-4630-8903-58c226fca182/task.md', 'w') as f:
    f.write(content)
