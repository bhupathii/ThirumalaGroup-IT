import re

with open('src/pages/finance/DetailedLedger.tsx', 'r') as f:
    content = f.read()

# Add useLocation
if "useLocation" not in content:
    content = content.replace("useNavigate", "useNavigate, useLocation")

# Read params in initial state
# Find where the states are defined:
# const [fromDate, setFromDate] = useState('');
# const [toDate, setToDate] = useState(() => getLocalBusinessDateISO());
# const [selectedHead, setSelectedHead] = useState<string>('ALL');

new_states = """  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialHead = searchParams.get('head') || 'ALL';
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || getLocalBusinessDateISO();

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CD' | 'CAPITAL' | 'BANK' | 'SALARY' | 'EXPENSE' | 'OTHER'>('ALL');
  const [selectedHead, setSelectedHead] = useState<string>(initialHead);"""

old_states = """  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(() => getLocalBusinessDateISO());
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CD' | 'CAPITAL' | 'BANK' | 'SALARY' | 'EXPENSE' | 'OTHER'>('ALL');
  const [selectedHead, setSelectedHead] = useState<string>('ALL');"""

content = content.replace(old_states, new_states)

# Fix initData which overrides fromDate if it is empty
old_initData = """    const initData = async () => {
      const oldest = await dailyFinancialTransactionService.getOldestTransactionDate();
      setFromDate(oldest || getLocalBusinessDateISO());
   };
    initData();"""

new_initData = """    const initData = async () => {
      if (!initialFrom) {
        const oldest = await dailyFinancialTransactionService.getOldestTransactionDate();
        setFromDate(oldest || getLocalBusinessDateISO());
      }
    };
    initData();"""

content = content.replace(old_initData, new_initData)

with open('src/pages/finance/DetailedLedger.tsx', 'w') as f:
    f.write(content)
