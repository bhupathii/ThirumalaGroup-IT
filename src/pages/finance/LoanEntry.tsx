import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer } from '../../lib/supabaseFinance';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { CameraCapture } from '../../components/finance/CameraCapture';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

const LoanEntry: React.FC = () => {
  const { user } = useAuth();
  
  // Form State
  const [loanId, setLoanId] = useState('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // New Customer Fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custFatherHusbandName, setCustFatherHusbandName] = useState('');
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('L');
  
  // Loan Specific Fields
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('2'); // 2% flat per month
  const [durationMonths, setDurationMonths] = useState('3'); // 3 months default
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [remarks, setRemarks] = useState('');
  
  // Surety Fields
  const [suretyName, setSuretyName] = useState('');
  const [suretyPhone, setSuretyPhone] = useState('');
  const [suretyAadhaar, setSuretyAadhaar] = useState('');
  
  // Photo & Biometric states
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);
  const [suretyPhoto, setSuretyPhoto] = useState<string | null>(null);
  const [suretyFingerprintUrl, setSuretyFingerprintUrl] = useState<string | null>(null);
  const [suretyFingerprintTemplate, setSuretyFingerprintTemplate] = useState<string | null>(null);
  const [suretyFingerprintAdded, setSuretyFingerprintAdded] = useState(false);
  
  // List/Search state
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [activeLoans, setActiveLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic calculations
  const [calculatedDues, setCalculatedDues] = useState({
    duesCount: 0,
    dueAmount: 0,
    totalRepayment: 0,
    interestAmount: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Run due calculation whenever principal, rate, duration or type changes
    calculateDuesValue();
  }, [amount, interestRate, durationMonths, dueType]);

  useEffect(() => {
    if (customerMode === 'existing' && selectedCustomerId) {
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (selected) {
        setCustPhoto(selected.customer_photo_url || null);
        setCustFingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setCustFingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setCustFingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        setCustFatherHusbandName(selected.father_husband_name || '');
        setSuretyFingerprintUrl(selected.surety_fingerprint_image_url || null);
        setSuretyFingerprintTemplate(selected.surety_fingerprint_template || null);
        setSuretyFingerprintAdded(!!selected.surety_fingerprint_added);
      }
    } else if (customerMode === 'new') {
      setCustPhoto(null);
      setCustFingerprintUrl(null);
      setCustFingerprintTemplate(null);
      setCustFingerprintAdded(false);
      setCustFatherHusbandName('');
      setSuretyFingerprintUrl(null);
      setSuretyFingerprintTemplate(null);
      setSuretyFingerprintAdded(false);
    }
  }, [customerMode, selectedCustomerId, customers]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const custs = await supabaseFinance.getCustomers();
      setCustomers(custs);

      const loans = await supabaseFinance.getLoans();
      setActiveLoans(loans);

      // Generate sequential Loan ID: L-1000 + loans length + 1
      const count = loans.length;
      setLoanId(`L-${1001 + count}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load initial loans data');
    } finally {
      setLoading(false);
    }
  };

  const generateSequentialId = (loansList: any[], category: string) => {
    const prefix = category === 'L' ? 'L' : category;
    const matchingLoans = loansList.filter(l => l.loan_id.toUpperCase().startsWith(`${prefix}-`));
    const count = matchingLoans.length;
    setLoanId(`${prefix}-${1001 + count}`);
  };

  useEffect(() => {
    if (activeLoans.length > 0) {
      generateSequentialId(activeLoans, loanCategory);
    }
  }, [loanCategory, activeLoans]);

  const calculateDuesValue = () => {
    const P = Number(amount);
    const R = Number(interestRate);
    const D = Number(durationMonths);

    if (isNaN(P) || P <= 0 || isNaN(R) || R < 0 || isNaN(D) || D <= 0) {
      setCalculatedDues({ duesCount: 0, dueAmount: 0, totalRepayment: 0, interestAmount: 0 });
      return;
    }

    const interestAmount = P * (R / 100) * D;
    const totalRepayment = P + interestAmount;

    let duesCount = 0;
    if (dueType === 'Daily') {
      duesCount = D * 30;
    } else if (dueType === 'Weekly') {
      duesCount = Math.round(D * 4.33);
    } else {
      duesCount = D;
    }

    const dueAmount = duesCount > 0 ? (totalRepayment / duesCount) : 0;

    setCalculatedDues({
      duesCount,
      dueAmount: parseFloat(dueAmount.toFixed(2)),
      totalRepayment: parseFloat(totalRepayment.toFixed(2)),
      interestAmount: parseFloat(interestAmount.toFixed(2))
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId.trim()) {
      toast.error('Loan ID is required');
      return;
    }
    if (customerMode === 'existing' && !selectedCustomerId) {
      toast.error('Please select an existing customer');
      return;
    }
    if (customerMode === 'new' && !custName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const numAmt = Number(amount);
    const numRate = Number(interestRate);
    const numDuration = Number(durationMonths);

    if (isNaN(numAmt) || numAmt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const staffName = user?.username || 'Staff';
      
      // 1. Prepare customer payload
      const customerPayload = customerMode === 'existing' 
        ? { 
            id: selectedCustomerId,
            customer_photo_url: custPhoto,
            fingerprint_url: custFingerprintUrl,
            fingerprint_template: custFingerprintTemplate,
            fingerprint_added: custFingerprintAdded,
            customer_fingerprint_template: custFingerprintTemplate,
            customer_fingerprint_image_url: custFingerprintUrl,
            customer_fingerprint_added: custFingerprintAdded,
            surety_fingerprint_template: suretyFingerprintTemplate,
            surety_fingerprint_image_url: suretyFingerprintUrl,
            surety_fingerprint_added: suretyFingerprintAdded,
            father_husband_name: custFatherHusbandName || null
          } 
        : {
            name: custName,
            phone: custPhone || null,
            address: custAddress || null,
            aadhaar: custAadhaar || null,
            customer_photo_url: custPhoto,
            fingerprint_url: custFingerprintUrl,
            fingerprint_template: custFingerprintTemplate,
            fingerprint_added: custFingerprintAdded,
            customer_fingerprint_template: custFingerprintTemplate,
            customer_fingerprint_image_url: custFingerprintUrl,
            customer_fingerprint_added: custFingerprintAdded,
            surety_fingerprint_template: suretyFingerprintTemplate,
            surety_fingerprint_image_url: suretyFingerprintUrl,
            surety_fingerprint_added: suretyFingerprintAdded,
            father_husband_name: custFatherHusbandName || null
          };

      // 2. Prepare dues list based on dueDates
      const duesList: any[] = [];
      const start = new Date(date);
      for (let i = 1; i <= calculatedDues.duesCount; i++) {
        const dDate = new Date(start);
        if (dueType === 'Daily') {
          dDate.setDate(start.getDate() + i);
        } else if (dueType === 'Weekly') {
          dDate.setDate(start.getDate() + i * 7);
        } else {
          dDate.setMonth(start.getMonth() + i);
        }
        duesList.push({
          due_date: dDate.toISOString().split('T')[0],
          amount: calculatedDues.dueAmount
        });
      }

      // 3. Prepare photos array
      const photosArray = [];
      if (custPhoto) photosArray.push({ photo_type: 'Customer' as const, photo_url: custPhoto });
      if (suretyPhoto) photosArray.push({ photo_type: 'Surety' as const, photo_url: suretyPhoto });

      const loanPayload = {
        loan_id: loanId,
        customer_id: '', // Will be updated by creation service
        date,
        amount: numAmt,
        interest_rate: numRate,
        duration_months: numDuration,
        due_type: dueType,
        due_amount: calculatedDues.dueAmount,
        surety_name: suretyName || null,
        surety_phone: suretyPhone || null,
        surety_aadhaar: suretyAadhaar || null,
        remarks: remarks || null,
        customer_photo_url: custPhoto,
        surety_photo_url: suretyPhoto,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        surety_fingerprint_template: suretyFingerprintTemplate,
        surety_fingerprint_image_url: suretyFingerprintUrl,
        surety_fingerprint_added: suretyFingerprintAdded,
        father_husband_name: custFatherHusbandName || null,
        loan_category: loanCategory
      };

      const result = await supabaseFinance.createLoan(
        loanPayload,
        customerPayload,
        duesList,
        photosArray,
        staffName
      );

      if (result) {
        toast.success(`Loan ${loanId} created and disbursed successfully!`);
        // Reset form
        setCustName('');
        setCustPhone('');
        setCustAddress('');
        setCustAadhaar('');
        setCustFatherHusbandName('');
        setLoanCategory('L');
        setAmount('');
        setRemarks('');
        setSuretyName('');
        setSuretyPhone('');
        setSuretyAadhaar('');
        setCustPhoto(null);
        setCustFingerprintUrl(null);
        setCustFingerprintTemplate(null);
        setCustFingerprintAdded(false);
        setSuretyPhoto(null);
        setSuretyFingerprintUrl(null);
        setSuretyFingerprintTemplate(null);
        setSuretyFingerprintAdded(false);
        fetchData();
      } else {
        toast.error('Failed to disburse loan. Check if Loan ID or Aadhaar is duplicate.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please check entries.');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Loan Entry & Disbursement</h1>
          <p className="text-gray-500 text-sm mt-1">Disburse new loans, set interest rates, and generate due calendars</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Customer Details */}
          <Card title="Customer Information" subtitle="Select an existing customer or create a new profile">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`py-2 px-3 rounded-lg font-bold border transition-all text-xs ${
                    customerMode === 'new'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  Create New Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`py-2 px-3 rounded-lg font-bold border transition-all text-xs ${
                    customerMode === 'existing'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  Select Existing
                </button>
              </div>

              {customerMode === 'existing' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                      Select Customer *
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                      style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedCustomerId && (
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <Input
                        label="Father / Husband Name"
                        value={custFatherHusbandName}
                        onChange={setCustFatherHusbandName}
                        placeholder="Father's or Husband's name"
                      />
                      <CameraCapture
                        label="Update Customer Photo"
                        existingPhotoUrl={custPhoto}
                        onPhotoSaved={setCustPhoto}
                      />
                      <BiometricScanner
                        label="Update Customer Fingerprint"
                        existingTemplate={custFingerprintTemplate}
                        existingImageUrl={custFingerprintUrl}
                        onFingerprintSaved={(url, template, added) => {
                          setCustFingerprintUrl(url);
                          setCustFingerprintTemplate(template);
                          setCustFingerprintAdded(added);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Customer Full Name *"
                    value={custName}
                    onChange={setCustName}
                    placeholder="e.g. Ramesh Kumar"
                  />
                  <Input
                    label="Father / Husband Name"
                    value={custFatherHusbandName}
                    onChange={setCustFatherHusbandName}
                    placeholder="Father's or Husband's name"
                  />
                  <Input
                    label="Phone Number"
                    value={custPhone}
                    onChange={setCustPhone}
                    placeholder="10-digit number"
                  />
                  <Input
                    label="Address"
                    value={custAddress}
                    onChange={setCustAddress}
                    placeholder="Residential address"
                  />
                  <Input
                    label="Aadhaar Card Number"
                    value={custAadhaar}
                    onChange={setCustAadhaar}
                    placeholder="12-digit UID"
                  />
                  
                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    <CameraCapture
                      label="Customer Photo Capture / Upload"
                      existingPhotoUrl={custPhoto}
                      onPhotoSaved={setCustPhoto}
                    />
                    <BiometricScanner
                      label="Customer Fingerprint Capture"
                      existingTemplate={custFingerprintTemplate}
                      existingImageUrl={custFingerprintUrl}
                      onFingerprintSaved={(url, template, added) => {
                        setCustFingerprintUrl(url);
                        setCustFingerprintTemplate(template);
                        setCustFingerprintAdded(added);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Card 2: Loan Parameters */}
          <Card title="Loan Parameters" subtitle="Specify terms, rates, and duration">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                    Loan Category *
                  </label>
                  <select
                    value={loanCategory}
                    onChange={(e) => setLoanCategory(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                    style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                  >
                    <option value="L">Regular Loan (L)</option>
                    <option value="CD">Chit Fund (CD)</option>
                    <option value="STBD">Short Term Business Deposit (STBD)</option>
                    <option value="HP">Hire Purchase (HP)</option>
                    <option value="TBD">Term Business Deposit (TBD)</option>
                  </select>
                </div>
                <Input
                  label="Loan ID *"
                  value={loanId}
                  onChange={setLoanId}
                  placeholder="e.g. L-1001"
                  required
                />
              </div>

              <Input
                label="Disbursement Date"
                type="date"
                value={date}
                onChange={setDate}
                required
              />

              <Input
                label="Principal Amount (₹) *"
                type="number"
                value={amount}
                onChange={setAmount}
                placeholder="e.g. 20000"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Interest Rate (% pm)"
                  type="number"
                  value={interestRate}
                  onChange={setInterestRate}
                  placeholder="e.g. 2"
                  required
                />
                <Input
                  label="Duration (Months)"
                  type="number"
                  value={durationMonths}
                  onChange={setDurationMonths}
                  placeholder="e.g. 3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                  Due Mode *
                </label>
                <select
                  value={dueType}
                  onChange={(e) => setDueType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                  style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                >
                  <option value="Daily">Daily Instalment</option>
                  <option value="Weekly">Weekly Instalment</option>
                  <option value="Monthly">Monthly Instalment</option>
                </select>
              </div>

              <Input
                label="Remarks"
                value={remarks}
                onChange={setRemarks}
                placeholder="Additional notes"
              />
            </div>
          </Card>

          {/* Card 3: Surety & Calculations */}
          <Card title="Surety & Verification" subtitle="Provide a guarantor profile and review breakdown">
            <div className="space-y-4">
              <Input
                label="Surety Person Name"
                value={suretyName}
                onChange={setSuretyName}
                placeholder="Guarantor name"
              />
              <Input
                label="Surety Phone"
                value={suretyPhone}
                onChange={setSuretyPhone}
                placeholder="Guarantor phone"
              />
              <Input
                label="Surety Aadhaar"
                value={suretyAadhaar}
                onChange={setSuretyAadhaar}
                placeholder="Guarantor Aadhaar"
              />
              
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <CameraCapture
                  label="Surety Person Photo Capture"
                  existingPhotoUrl={suretyPhoto}
                  onPhotoSaved={setSuretyPhoto}
                />
                <BiometricScanner
                  label="Surety Fingerprint Capture"
                  existingTemplate={suretyFingerprintTemplate}
                  existingImageUrl={suretyFingerprintUrl}
                  onFingerprintSaved={(url, template, added) => {
                    setSuretyFingerprintUrl(url);
                    setSuretyFingerprintTemplate(template);
                    setSuretyFingerprintAdded(added);
                  }}
                />
              </div>

              {/* Dynamic calculations block */}
              {calculatedDues.duesCount > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200 mt-4 space-y-2">
                  <h4 className="font-extrabold text-sm text-green-900 border-b border-green-200 pb-1">Due Calculation Review</h4>
                  <div className="grid grid-cols-2 text-xs font-semibold text-gray-700 gap-y-1.5">
                    <span>Total Repayment:</span>
                    <span className="text-right text-gray-900 font-bold">₹{calculatedDues.totalRepayment.toLocaleString('en-IN')}</span>
                    
                    <span>Interest Component:</span>
                    <span className="text-right text-gray-900 font-bold">₹{calculatedDues.interestAmount.toLocaleString('en-IN')}</span>
                    
                    <span>No. of Dues ({dueType}):</span>
                    <span className="text-right text-gray-900 font-bold">{calculatedDues.duesCount}</span>
                    
                    <span className="text-sm font-extrabold text-green-800">Due Instalment:</span>
                    <span className="text-right text-sm font-black text-green-800">₹{calculatedDues.dueAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <Button type="submit" variant="success" className="w-full pt-2" icon={ArrowRight}>
                Disburse & Save Loan
              </Button>
            </div>
          </Card>
        </div>
      </form>

      {/* Active Loans Table */}
      <Card title="Active Loans Ledger" subtitle="Review active loan accounts and instalment parameters" className="shadow">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
          </div>
        ) : activeLoans.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No active loans found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Loan ID</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Disbursed Date</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Principal</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Type</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Instalment</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {activeLoans.map(loan => (
                  <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 font-mono">
                      {loan.loan_id}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{loan.customer?.name}</div>
                      {loan.customer?.phone && (
                        <div className="text-xs text-gray-500">{loan.customer.phone}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                      {new Date(loan.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                      ₹{Number(loan.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                      {loan.due_type}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-extrabold text-green-700">
                      ₹{Number(loan.due_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        loan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default LoanEntry;
