with open('src/pages/finance/DetailedLedger.tsx', 'r') as f:
    content = f.read()

content = content.replace("const navigate = useNavigate, useLocation();", "const navigate = useNavigate();")
content = content.replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate, useLocation } from 'react-router-dom';")
content = content.replace("import { useNavigate, useLocation, useLocation } from 'react-router-dom';", "import { useNavigate, useLocation } from 'react-router-dom';")
content = content.replace("import { useNavigate, useLocation }", "import { useNavigate, useLocation }")

with open('src/pages/finance/DetailedLedger.tsx', 'w') as f:
    f.write(content)
