import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceCustomer } from '../../lib/supabaseFinance';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const OldDataEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
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
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('CD');
  
  // Loan Specific Fields
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('2');
  const [durationMonths, setDurationMonths] = useState('3');
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [remarks, setRemarks] = useState('');
  
  // Surety Fields
  const [suretyName, setSuretyName] = useState('');
  const [suretyPhone, setSuretyPhone] = useState('');
  const [suretyAadhaar, setSuretyAadhaar] = useState('');
  
  // Photo & Biometric constants (historic entries don't support live capture)
  const custPhoto = null;
  const custFingerprintUrl = null;
  const custFingerprintTemplate = null;
  const custFingerprintAdded = false;
  const suretyPhoto = null;
  const suretyFingerprintUrl = null;
  const suretyFingerprintTemplate = null;
  const suretyFingerprintAdded = false;
  
  // List/Search state
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [saving, setSaving] = useState(false);

  // Dynamic calculations
  const [calculatedDues, setCalculatedDues] = useState({
    duesCount: 0,
    dueAmount: 0,
    totalRepayment: 0,
    interestAmount: 0
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    calculateDuesValue();
  }, [amount, interestRate, durationMonths, dueType]);

  const fetchCustomers = async () => {
    try {
      const custs = await supabaseFinance.getCustomers();
      setCustomers(custs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customers list');
    }
  };

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
    if (!date) {
      toast.error('Disbursement date is required');
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

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';
      
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

      const photosArray = [];
      if (custPhoto) photosArray.push({ photo_type: 'Customer' as const, photo_url: custPhoto });
      if (suretyPhoto) photosArray.push({ photo_type: 'Surety' as const, photo_url: suretyPhoto });

      const loanPayload = {
        loan_id: loanId,
        customer_id: '',
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
        toast.success(`Historic loan ${loanId} saved successfully!`);
        navigate('/finance');
      } else {
        toast.error('Failed to create historic loan entry. Check for duplicate IDs.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error occurred while saving old loan data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Old Data Entry (Historical)</h1>
          <p className="text-gray-500 text-sm mt-1">Directly record historic/migrated loans with customizable disbursement dates</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Customer details */}
          <Card title="Borrower details" subtitle="Choose existing or define historical contact details">
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
                  Create Profile
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
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                      Select Customer *
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                      style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                    >
                      <option value="">-- Select Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input label="Customer Full Name *" value={custName} onChange={setCustName} required />
                  <Input label="Father/Husband Name" value={custFatherHusbandName} onChange={setCustFatherHusbandName} />
                  <Input label="Phone Number" value={custPhone} onChange={setCustPhone} />
                  <Input label="Address" value={custAddress} onChange={setCustAddress} />
                  <Input label="Aadhaar Card UID" value={custAadhaar} onChange={setCustAadhaar} />
                </div>
              )}
            </div>
          </Card>

          {/* Loan details */}
          <Card title="Disbursal parameters" subtitle="Define the custom disbursement date and terms">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                    Category *
                  </label>
                  <select
                    value={loanCategory}
                    onChange={(e) => setLoanCategory(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none"
                    style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                  >
                    <option value="CD">Chit Fund (CD)</option>
                    <option value="STBD">STBD</option>
                    <option value="HP">Hire Purchase (HP)</option>
                    <option value="TBD">TBD</option>
                    <option value="L">Regular (L)</option>
                  </select>
                </div>
                <Input label="Loan ID *" value={loanId} onChange={setLoanId} placeholder="e.g. CD-1020" required />
              </div>

              <Input
                label="Historical Disbursal Date *"
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
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input label="Interest Rate (% pm)" type="number" value={interestRate} onChange={setInterestRate} required />
                <Input label="Duration (Months)" type="number" value={durationMonths} onChange={setDurationMonths} required />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                  Due Mode *
                </label>
                <select
                  value={dueType}
                  onChange={(e) => setDueType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-2 font-bold focus:outline-none"
                  style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>

              <Input label="Remarks / Audit notes" value={remarks} onChange={setRemarks} />
            </div>
          </Card>

          {/* Surety Details & Save */}
          <Card title="Guarantor Card & Preview" subtitle="Review payments and link surety">
            <div className="space-y-4">
              <Input label="Surety Person Name" value={suretyName} onChange={setSuretyName} />
              <Input label="Surety Phone" value={suretyPhone} onChange={setSuretyPhone} />
              <Input label="Surety Aadhaar No" value={suretyAadhaar} onChange={setSuretyAadhaar} />

              {calculatedDues.duesCount > 0 && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-xs font-semibold text-gray-700 space-y-1.5">
                  <h4 className="font-extrabold text-sm text-green-900 border-b border-green-200 pb-1 mb-1">Dues Breakdown</h4>
                  <div className="flex justify-between">
                    <span>Total Repayable:</span>
                    <span className="text-gray-900 font-bold">₹{calculatedDues.totalRepayment.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Instalment Amount:</span>
                    <span className="text-green-800 font-black">₹{calculatedDues.dueAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Dues Count:</span>
                    <span className="text-gray-900 font-bold">{calculatedDues.duesCount} Dues</span>
                  </div>
                </div>
              )}

              <Button type="submit" variant="success" className="w-full pt-2.5" icon={ArrowRight} disabled={saving}>
                {saving ? 'Saving...' : 'Register Historic Loan'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
};

export default OldDataEntry;
