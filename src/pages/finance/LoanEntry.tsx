import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinancePartner } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  Phone, 
  MapPin, 
  Plus, 
  BookOpen, 
  Calculator, 
  Printer, 
  X, 
  Upload, 
  Trash2, 
  Navigation,
  Check,
  Search,
  Camera,
  Fingerprint
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { CameraCapture } from '../../components/finance/CameraCapture';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

interface DocumentItem {
  key: string;
  label: string;
  category: 'Financial' | 'Original' | 'Registration';
  checked: boolean;
  refNo: string;
  fileUrl: string | null;
  uploading: boolean;
}

const LoanEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Loading/Saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State - Basics
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('CD');
  const [loanId, setLoanId] = useState('');

  // Form State - Customer
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custFatherName, setCustFatherName] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPan, setCustPan] = useState(''); // Saved to remarks or combined
  const [custAddress, setCustAddress] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPhone2, setCustPhone2] = useState('');
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);

  // Form State - Guarantors (Up to two)
  const [g1Mode, setG1Mode] = useState<'new' | 'existing'>('new');
  const [g1SelectedId, setG1SelectedId] = useState('');
  const [g1Name, setG1Name] = useState('');
  const [g1Phone, setG1Phone] = useState('');
  const [g1Aadhaar, setG1Aadhaar] = useState('');

  const [g2Mode, setG2Mode] = useState<'new' | 'existing'>('new');
  const [g2SelectedId, setG2SelectedId] = useState('');
  const [g2Name, setG2Name] = useState('');
  const [g2Phone, setG2Phone] = useState('');
  const [g2Aadhaar, setG2Aadhaar] = useState('');

  // Form State - Loan Terms
  const [amount, setAmount] = useState('');
  const [docCharges, setDocCharges] = useState('');
  const [interestRate, setInterestRate] = useState('2'); // 2% default
  const [durationMonths, setDurationMonths] = useState('3'); // 3 months default
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [particulars, setParticulars] = useState('');

  // Form State - Partner
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');

  // Form State - Documents Checklist
  const [documents, setDocuments] = useState<DocumentItem[]>([
    { key: 'bank_statements', label: 'BANK STATEMENTS', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'income_proof', label: 'INCOME PROOF / ITR', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'passbook_copy', label: 'PASSBOOK COPY', category: 'Financial', checked: false, refNo: '', fileUrl: null, uploading: false },
    
    { key: 'land_title_deed', label: 'LAND TITLE DEED', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'property_tax', label: 'PROPERTY TAX REC', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'vehicle_asset_paper', label: 'VEHICLE / ASSET PAP', category: 'Original', checked: false, refNo: '', fileUrl: null, uploading: false },
    
    { key: 'joint_registration', label: 'JOINT REGISTRATION', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'agreement_bond', label: 'AGREEMENT / BOND', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
    { key: 'pledge_paper', label: 'PLEDGE PAPER', category: 'Registration', checked: false, refNo: '', fileUrl: null, uploading: false },
  ]);

  // Form State - Collateral Location
  const [locAddress, setLocAddress] = useState('');
  const [locVillage, setLocVillage] = useState('');
  const [locMandal, setLocMandal] = useState('');
  const [locDistrict, setLocDistrict] = useState('');
  const [locState, setLocState] = useState('');
  const [locPincode, setLocPincode] = useState('');
  const [locLandmark, setLocLandmark] = useState('');
  const [locLatitude, setLocLatitude] = useState('');
  const [locLongitude, setLocLongitude] = useState('');
  const [locMapsLink, setLocMapsLink] = useState('');

  // Form State - Remarks & Extra
  const [remarks, setRemarks] = useState('');
  const [extraDetails, setExtraDetails] = useState('');

  // Reference Data lists
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [activeLoans, setActiveLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const custs = await supabaseFinance.getCustomers();
      setCustomers(custs);

      const prts = await supabaseFinance.getPartners();
      setPartners(prts);

      const loans = await supabaseFinance.getLoans();
      setActiveLoans(loans);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load credit reference registry');
    } finally {
      setLoading(false);
    }
  };

  // Generate Auto sequential Loan ID: e.g. CD001, HP001 based on selected ledger type
  const generateSequentialId = (loansList: any[], category: string) => {
    const prefix = category === 'L' ? 'L' : category;
    const matchingLoans = loansList.filter(l => l.loan_id.toUpperCase().startsWith(prefix));
    const count = matchingLoans.length;
    const paddedCount = String(count + 1).padStart(3, '0');
    setLoanId(`${prefix}${paddedCount}`);
  };

  useEffect(() => {
    if (activeLoans.length > 0 || !loading) {
      generateSequentialId(activeLoans, loanCategory);
    }
  }, [loanCategory, activeLoans, loading]);

  // Autofill customer data
  useEffect(() => {
    if (customerMode === 'existing' && selectedCustomerId) {
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (selected) {
        setCustName(selected.name);
        setCustFatherName(selected.father_husband_name || '');
        setCustPhone(selected.phone || '');
        setCustPhone2(selected.phone2 || '');
        setCustAddress(selected.address || '');
        setCustAadhaar(selected.aadhaar || '');
        setCustPhoto(selected.customer_photo_url || null);
        setCustFingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setCustFingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setCustFingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        
        if (selected.partner_name) {
          const matchPartner = partners.find(p => p.name === selected.partner_name);
          if (matchPartner) {
            setSelectedPartnerId(matchPartner.id);
            setPartnerName(matchPartner.name);
          } else {
            setPartnerName(selected.partner_name);
          }
        }
      }
    }
  }, [customerMode, selectedCustomerId, customers]);

  // Autofill guarantor 1 data
  useEffect(() => {
    if (g1Mode === 'existing' && g1SelectedId) {
      const selected = customers.find(c => c.id === g1SelectedId);
      if (selected) {
        setG1Name(selected.name);
        setG1Phone(selected.phone || '');
        setG1Aadhaar(selected.aadhaar || '');
      }
    }
  }, [g1Mode, g1SelectedId, customers]);

  // Autofill guarantor 2 data
  useEffect(() => {
    if (g2Mode === 'existing' && g2SelectedId) {
      const selected = customers.find(c => c.id === g2SelectedId);
      if (selected) {
        setG2Name(selected.name);
        setG2Phone(selected.phone || '');
        setG2Aadhaar(selected.aadhaar || '');
      }
    }
  }, [g2Mode, g2SelectedId, customers]);

  // Autofill partner name
  useEffect(() => {
    if (selectedPartnerId) {
      const selected = partners.find(p => p.id === selectedPartnerId);
      if (selected) {
        setPartnerName(selected.name);
      }
    } else {
      setPartnerName('');
    }
  }, [selectedPartnerId, partners]);

  // Handle Location Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    const loadingToast = toast.loading('Retrieving GPS satellite coordinates...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss(loadingToast);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocLatitude(String(lat));
        setLocLongitude(String(lng));
        setLocMapsLink(`https://www.google.com/maps/place/${lat},${lng}`);
        toast.success('Collateral GPS localized successfully!');
      },
      (error) => {
        toast.dismiss(loadingToast);
        console.error(error);
        toast.error('Failed to resolve coordinates: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Upload checklist document to storage
  const handleChecklistUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set uploading state in checklist array
    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: true } : doc));
    
    try {
      const fileObj = new File([file], `doc-${loanId}-${key}-${Date.now()}-${file.name}`, { type: file.type });
      
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .upload(`documents/${fileObj.name}`, fileObj);

      if (error) throw error;

      const publicUrl = supabase.storage
        .from('finance-photos')
        .getPublicUrl(data.path).data.publicUrl;

      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, checked: true, fileUrl: publicUrl, uploading: false } : doc));
      toast.success('Document uploaded and attached successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Document upload failed');
      setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, uploading: false } : doc));
    }
  };

  const removeChecklistUpload = (key: string) => {
    setDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, fileUrl: null } : doc));
    toast.success('Attachment detached');
  };

  // Dynamic calculations (Live Calculations)
  const liveCalculations = useMemo(() => {
    const P = Number(amount);
    const R = Number(interestRate);
    const D = Number(durationMonths);
    const docFees = Number(docCharges) || 0;

    if (isNaN(P) || P <= 0 || isNaN(R) || R < 0 || isNaN(D) || D <= 0) {
      return null;
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
    const netDisbursed = P - docFees;

    return {
      principal: P,
      interestAmount: parseFloat(interestAmount.toFixed(2)),
      totalRepayment: parseFloat(totalRepayment.toFixed(2)),
      duesCount,
      dueAmount: parseFloat(dueAmount.toFixed(2)),
      docFees,
      netDisbursed: parseFloat(netDisbursed.toFixed(2))
    };
  }, [amount, interestRate, durationMonths, dueType, docCharges]);

  // Form Reset / Clear
  const handleClearForm = () => {
    if (!window.confirm('Are you sure you want to clear the form? All details will be reset.')) return;
    
    // Reset basic state
    setDate(new Date().toISOString().split('T')[0]);
    setLoanCategory('CD');
    setCustName('');
    setCustFatherName('');
    setCustPhone('');
    setCustPhone2('');
    setCustAddress('');
    setCustAadhaar('');
    setCustPan('');
    setCustPhoto(null);
    setCustFingerprintUrl(null);
    setCustFingerprintTemplate(null);
    setCustFingerprintAdded(false);

    setG1Name('');
    setG1Phone('');
    setG1Aadhaar('');
    setG2Name('');
    setG2Phone('');
    setG2Aadhaar('');

    setAmount('');
    setDocCharges('');
    setInterestRate('2');
    setDurationMonths('3');
    setDueType('Daily');
    setParticulars('');

    setSelectedPartnerId('');
    setPartnerName('');

    setLocAddress('');
    setLocVillage('');
    setLocMandal('');
    setLocDistrict('');
    setLocState('');
    setLocPincode('');
    setLocLandmark('');
    setLocLatitude('');
    setLocLongitude('');
    setLocMapsLink('');

    setRemarks('');
    setExtraDetails('');

    setDocuments(prev => prev.map(doc => ({ ...doc, checked: false, refNo: '', fileUrl: null })));
    toast.success('Form cleared successfully');
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId.trim()) {
      toast.error('Loan Number is required');
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
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms (Amount, Rate, Duration)');
      return;
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';

      // 1. Customer payload
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
            father_husband_name: custFatherName || null,
            partner_name: partnerName || null
          }
        : {
            name: custName,
            phone: custPhone || null,
            phone2: custPhone2 || null,
            address: custAddress || null,
            aadhaar: custAadhaar || null,
            customer_photo_url: custPhoto,
            fingerprint_url: custFingerprintUrl,
            fingerprint_template: custFingerprintTemplate,
            fingerprint_added: custFingerprintAdded,
            customer_fingerprint_template: custFingerprintTemplate,
            customer_fingerprint_image_url: custFingerprintUrl,
            customer_fingerprint_added: custFingerprintAdded,
            father_husband_name: custFatherName || null,
            partner_name: partnerName || null
          };

      // 2. Dues list
      const duesList: any[] = [];
      const start = new Date(date);
      for (let i = 1; i <= liveCalculations.duesCount; i++) {
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
          amount: liveCalculations.dueAmount
        });
      }

      // 3. Surety combined guarantor details
      const combinedSuretyName = [g1Name, g2Name].filter(Boolean).join(' / ') || null;
      const combinedSuretyPhone = [g1Phone, g2Phone].filter(Boolean).join(' / ') || null;
      const combinedSuretyAadhaar = [g1Aadhaar, g2Aadhaar].filter(Boolean).join(' / ') || null;

      // 4. Combined Collateral & Extra features to save into Remarks
      const collateralJSON = {
        collateral_address: locAddress,
        village: locVillage,
        mandal: locMandal,
        district: locDistrict,
        state: locState,
        pincode: locPincode,
        landmark: locLandmark,
        gps_latitude: locLatitude,
        gps_longitude: locLongitude,
        google_maps_link: locMapsLink,
        pan_card: custPan,
        particulars,
        extraDetails,
        document_charges: liveCalculations.docFees
      };

      const finalRemarks = [
        remarks,
        `Collateral: ${locAddress || 'N/A'}, GPS: ${locLatitude && locLongitude ? `${locLatitude},${locLongitude}` : 'N/A'}`,
        `Extra: ${extraDetails || 'N/A'}`
      ].filter(Boolean).join(' | ');

      const loanPayload = {
        loan_id: loanId,
        customer_id: '', // Updated during create loan logic
        date,
        amount: liveCalculations.principal,
        interest_rate: Number(interestRate),
        duration_months: Number(durationMonths),
        due_type: dueType,
        due_amount: liveCalculations.dueAmount,
        surety_name: combinedSuretyName,
        surety_phone: combinedSuretyPhone,
        surety_aadhaar: combinedSuretyAadhaar,
        remarks: finalRemarks,
        customer_photo_url: custPhoto,
        surety_photo_url: null,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        father_husband_name: custFatherName || null,
        loan_category: loanCategory
      };

      // 5. Submit to database
      const photosArray: any[] = [];
      if (custPhoto) photosArray.push({ photo_type: 'Customer', photo_url: custPhoto });

      const savedLoan = await supabaseFinance.createLoan(
        loanPayload,
        customerPayload,
        duesList,
        photosArray,
        staffName
      );

      if (savedLoan) {
        // Update surety location fields dynamically if columns exist (using safe JSON logging inside remarks)
        try {
          await supabaseFinance.updateLoan(savedLoan.id, {
            surety_address: locAddress || null,
            surety_relation: `Guarantor 1: ${g1Name || 'N/A'}, Guarantor 2: ${g2Name || 'N/A'}`
          }, staffName);
        } catch (err) {
          console.warn('Failed to insert additional collateral address fields directly', err);
        }

        // 6. Save submitted checklist document links
        const linkedDocs = documents.filter(doc => doc.checked && doc.fileUrl);
        for (const doc of linkedDocs) {
          await supabaseFinance.addDocument({
            loan_id: savedLoan.id,
            document_type: `${doc.label} (${doc.refNo || 'No Ref'})`,
            document_url: doc.fileUrl || ''
          });
        }

        // 7. Save custom collateral metadata inside custom logs if needed
        try {
          await supabase.from('finance_edited_logs').insert([{
            table_name: 'finance_loans_collateral',
            record_id: savedLoan.id,
            old_values: {},
            new_values: collateralJSON,
            edited_by: staffName
          }]);
        } catch (err) {
          console.warn('Could not record collateral JSON metadata', err);
        }

        toast.success(`Loan Account ${loanId} created and disbursed successfully!`);
        navigate('/finance');
      } else {
        toast.error('Disbursal failed. Duplicate Loan Number or Aadhaar index.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong during disbursal processing');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPreview = () => {
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms to preview statement');
      return;
    }
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none print:p-0 print:bg-white">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">NEW LOAN ENTRY</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
            CAPTURE & DISBURSE GENERAL — LEDGER — DUES CALCULATIONS PREVIEW & FILE
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <Link
            to="/finance/old-data-entry"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            OLD DATA ENTRY
          </Link>
          <Link
            to="/finance/calculator"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Calculator className="w-3.5 h-3.5" />
            CALCULATOR
          </Link>
          <button
            onClick={handlePrintPreview}
            disabled={!liveCalculations}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            PREVIEW & PRINT
          </button>
          <button
            onClick={handleClearForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
            CLEAR
          </button>
          <button
            onClick={handleSaveLoan}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'SAVING...' : 'SAVE LOAN'}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form entries */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: BASICS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              BASICS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  DATE *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  LEDGER TYPE *
                </label>
                <select
                  value={loanCategory}
                  onChange={(e) => setLoanCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  required
                >
                  <option value="CD">CHIT FUND (CD)</option>
                  <option value="STBD">STBD LEDGER</option>
                  <option value="HP">HP LEDGER</option>
                  <option value="TBD">TBD LEDGER</option>
                  <option value="L">REGULAR LOAN (L)</option>
                </select>
                <span className="text-[9px] text-slate-400 font-bold mt-1.5 block uppercase tracking-wide">
                  TEMPLATES FOR CD, HP, STBD, TBD
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  LOAN NUMBER
                </label>
                <input
                  type="text"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  placeholder="e.g. CD001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none font-mono"
                  required
                />
                <span className="text-[9px] text-slate-400 font-bold mt-1.5 block uppercase tracking-wide">
                  AUTO-GENERATED
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: CUSTOMER */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                CUSTOMER
              </h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-all ${
                    customerMode === 'new'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  NEW PROFILE
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-all ${
                    customerMode === 'existing'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  SELECT EXISTING
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {customerMode === 'existing' && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    SELECT CUSTOMER TO AUTO-FILL
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="">-- SELECT TO AUTO-FILL --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="CUSTOMER NAME *"
                  value={custName}
                  onChange={setCustName}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  readOnly={customerMode === 'existing'}
                />
                <Input
                  label="FATHER'S NAME"
                  value={custFatherName}
                  onChange={setCustFatherName}
                  placeholder="Father or Husband name"
                  readOnly={customerMode === 'existing'}
                />
                <Input
                  label="AADHAAR"
                  value={custAadhaar}
                  onChange={setCustAadhaar}
                  placeholder="12-digit Aadhaar UID"
                  readOnly={customerMode === 'existing'}
                />
                <Input
                  label="PAN"
                  value={custPan}
                  onChange={setCustPan}
                  placeholder="10-digit PAN Card"
                />
                <div className="sm:col-span-2">
                  <Input
                    label="ADDRESS *"
                    value={custAddress}
                    onChange={setCustAddress}
                    placeholder="Residential address details"
                    required
                    readOnly={customerMode === 'existing'}
                  />
                </div>
                <Input
                  label="PHONE 1"
                  value={custPhone}
                  onChange={setCustPhone}
                  placeholder="Primary mobile number"
                  readOnly={customerMode === 'existing'}
                />
                <Input
                  label="PHONE 2"
                  value={custPhone2}
                  onChange={setCustPhone2}
                  placeholder="Secondary mobile number"
                  readOnly={customerMode === 'existing'}
                />
              </div>

              {/* Photo & Biometric */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <CameraCapture
                  label="Customer Photo Capture"
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
          </div>

          {/* Card 3: GUARANTORS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              GUARANTORS
            </h3>
            
            {/* Guarantor 1 */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  GUARANTOR 1
                </h4>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setG1Mode('new'); setG1SelectedId(''); setG1Name(''); setG1Phone(''); setG1Aadhaar(''); }}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-all ${
                      g1Mode === 'new' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    NEW
                  </button>
                  <button
                    type="button"
                    onClick={() => setG1Mode('existing')}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-all ${
                      g1Mode === 'existing' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    EXISTING
                  </button>
                </div>
              </div>

              {g1Mode === 'existing' && (
                <div className="bg-slate-50 p-2.5 rounded border">
                  <select
                    value={g1SelectedId}
                    onChange={(e) => setG1SelectedId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- SELECT TO AUTO-FILL --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="NAME" value={g1Name} onChange={setG1Name} placeholder="Full Name" readOnly={g1Mode === 'existing'} />
                <Input label="AADHAAR" value={g1Aadhaar} onChange={setG1Aadhaar} placeholder="Aadhaar UID" readOnly={g1Mode === 'existing'} />
                <Input label="PHONE" value={g1Phone} onChange={setG1Phone} placeholder="Phone No" readOnly={g1Mode === 'existing'} />
              </div>
            </div>

            {/* Guarantor 2 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  GUARANTOR 2
                </h4>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setG2Mode('new'); setG2SelectedId(''); setG2Name(''); setG2Phone(''); setG2Aadhaar(''); }}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-all ${
                      g2Mode === 'new' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    NEW
                  </button>
                  <button
                    type="button"
                    onClick={() => setG2Mode('existing')}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-all ${
                      g2Mode === 'existing' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    EXISTING
                  </button>
                </div>
              </div>

              {g2Mode === 'existing' && (
                <div className="bg-slate-50 p-2.5 rounded border">
                  <select
                    value={g2SelectedId}
                    onChange={(e) => setG2SelectedId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- SELECT TO AUTO-FILL --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="NAME" value={g2Name} onChange={setG2Name} placeholder="Full Name" readOnly={g2Mode === 'existing'} />
                <Input label="AADHAAR" value={g2Aadhaar} onChange={setG2Aadhaar} placeholder="Aadhaar UID" readOnly={g2Mode === 'existing'} />
                <Input label="PHONE" value={g2Phone} onChange={setG2Phone} placeholder="Phone No" readOnly={g2Mode === 'existing'} />
              </div>
            </div>
          </div>

          {/* Card 4: LOAN TERMS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              LOAN TERMS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="PRINCIPAL / SETTLEMENT *"
                type="number"
                value={amount}
                onChange={setAmount}
                placeholder="e.g. 50000"
                required
              />
              <Input
                label="DOCUMENT CHARGES (₹)"
                type="number"
                value={docCharges}
                onChange={setDocCharges}
                placeholder="e.g. 1000"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="RATE OF INTEREST (%) MONTH"
                  type="number"
                  value={interestRate}
                  onChange={setInterestRate}
                  placeholder="e.g. 2"
                  required
                />
                <Input
                  label="DURATION (MONTHS) *"
                  type="number"
                  value={durationMonths}
                  onChange={setDurationMonths}
                  placeholder="e.g. 3"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  DUE TYPE *
                </label>
                <select
                  value={dueType}
                  onChange={(e) => setDueType(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  required
                >
                  <option value="Daily">Daily Instalments</option>
                  <option value="Weekly">Weekly Instalments</option>
                  <option value="Monthly">Monthly Instalments</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="PARTICULARS"
                  value={particulars}
                  onChange={setParticulars}
                  placeholder="e.g. Pledge receipt particulars or gold details"
                />
              </div>
            </div>
          </div>

          {/* Card 5: PARTNER */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              PARTNER
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  SELECT PARTNER
                </label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="">-- SELECT PARTNER --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="PARTNER NAME (READONLY)"
                value={partnerName}
                readOnly
                placeholder="Partner Name"
              />
            </div>
          </div>

          {/* Card 6: DOCUMENTS SUBMITTED */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                DOCUMENTS SUBMITTED
              </h3>
              <span className="text-[9px] font-black text-blue-650 bg-blue-50 border border-blue-150 px-2 py-0.5 rounded uppercase tracking-wider">
                FILES + CHECKS
              </span>
            </div>

            {/* Checklist Category Groups */}
            {(['Financial', 'Original', 'Registration'] as const).map((cat, catIdx) => (
              <div key={catIdx} className="space-y-2 pt-2 first:pt-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {catIdx + 1}. {cat.toUpperCase()} DOCUMENTS
                </h4>
                
                <div className="space-y-2">
                  {documents.filter(doc => doc.category === cat).map((doc) => (
                    <div key={doc.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 border border-slate-100 rounded-lg text-xs bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={doc.checked}
                          onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, checked: e.target.checked } : d))}
                          className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                        />
                        <span className="font-bold text-slate-800 tracking-wide select-none">
                          {doc.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1 sm:justify-end">
                        <input
                          type="text"
                          value={doc.refNo}
                          onChange={(e) => setDocuments(prev => prev.map(d => d.key === doc.key ? { ...d, refNo: e.target.value } : d))}
                          placeholder="REF NO, AUTHORITY, REMARKS..."
                          className="bg-white border border-slate-200 rounded p-1 text-[11px] font-bold text-slate-700 w-full sm:w-48 focus:outline-none"
                        />
                        
                        {doc.fileUrl ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 text-[9px] font-bold bg-green-550 text-white rounded hover:bg-green-600 transition-colors shadow-sm"
                            >
                              VIEW
                            </a>
                            <button
                              type="button"
                              onClick={() => removeChecklistUpload(doc.key)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="px-2.5 py-1 text-[9px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer rounded shrink-0 transition-colors select-none shadow-sm flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {doc.uploading ? 'UPLOADING...' : 'ADD'}
                            <input
                              type="file"
                              onChange={(e) => handleChecklistUpload(doc.key, e)}
                              disabled={doc.uploading}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Card 7: ASSET / COLLATERAL LOCATION */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                ASSET / COLLATERAL LOCATION
              </h3>
              <button
                type="button"
                onClick={handleDetectGPS}
                className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 rounded transition-colors shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5 text-slate-600 animate-pulse" />
                DETECT GPS
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="ADDRESS"
                value={locAddress}
                onChange={setLocAddress}
                placeholder="DOOR NO, STREET, VILLAGE / TOWN"
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="VILLAGE/TOWN" value={locVillage} onChange={setLocVillage} placeholder="Village/Town" />
                <Input label="MANDAL" value={locMandal} onChange={setLocMandal} placeholder="Mandal" />
                <Input label="DISTRICT" value={locDistrict} onChange={setLocDistrict} placeholder="District" />
                <Input label="STATE" value={locState} onChange={setLocState} placeholder="State" />
                <Input label="PINCODE" value={locPincode} onChange={setLocPincode} placeholder="Pincode" />
                <Input label="LANDMARK" value={locLandmark} onChange={setLocLandmark} placeholder="e.g. Next to Ramalayam Temple" />
                <Input label="LATITUDE" value={locLatitude} onChange={setLocLatitude} placeholder="GPS Latitude" readOnly />
                <Input label="LONGITUDE" value={locLongitude} onChange={setLocLongitude} placeholder="GPS Longitude" readOnly />
              </div>

              <Input
                label="GOOGLE MAPS GPS LINK"
                value={locMapsLink}
                onChange={setLocMapsLink}
                placeholder="PASTE THE GOOGLE MAPS LINK"
              />
            </div>
          </div>

          {/* Card 8: DESCRIPTION & EXTRA FEATURES */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              DESCRIPTION & EXTRA FEATURES
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  REMARKS
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="REASON FOR BORROWING, REPAYMENT ARRANGEMENT, DISCUSSIONS WITH CUSTOMER..."
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  EXTRA DETAILS
                </label>
                <textarea
                  value={extraDetails}
                  onChange={(e) => setExtraDetails(e.target.value)}
                  placeholder="STEPS OF ANY PARTIAL DISBURSAL PLANNED, SPECIAL CONDITIONS, ETC."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Calculation and Recent Loans */}
        <div className="space-y-6">
          
          {/* Card 9: LIVE CALCULATION */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4 h-fit sticky top-20">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                LIVE CALCULATION
              </h3>
              <span className="text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded uppercase tracking-wider">
                {dueType}
              </span>
            </div>

            {!liveCalculations ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider leading-relaxed">
                FILL IN THE LOAN AMOUNT TO SEE THE CALCULATION PREVIEW.
              </div>
            ) : (
              <div className="space-y-4 text-xs font-medium text-slate-700">
                <div className="grid grid-cols-2 gap-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Principal:</span>
                  <span className="text-right text-slate-900 font-bold">₹{liveCalculations.principal.toLocaleString('en-IN')}</span>

                  <span className="text-[10px] font-bold text-slate-400 uppercase">Doc Fees:</span>
                  <span className="text-right text-slate-900 font-bold">₹{liveCalculations.docFees.toLocaleString('en-IN')}</span>

                  <span className="text-[10px] font-bold text-slate-400 uppercase">Net Disbursed:</span>
                  <span className="text-right text-slate-900 font-black text-blue-650">₹{liveCalculations.netDisbursed.toLocaleString('en-IN')}</span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 border-t pt-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Interest Component:</span>
                  <span className="text-right text-slate-900 font-bold">₹{liveCalculations.interestAmount.toLocaleString('en-IN')}</span>

                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Repayment:</span>
                  <span className="text-right text-slate-900 font-bold">₹{liveCalculations.totalRepayment.toLocaleString('en-IN')}</span>

                  <span className="text-[10px] font-bold text-slate-400 uppercase">Instalment Count:</span>
                  <span className="text-right text-slate-900 font-bold">{liveCalculations.duesCount} {dueType} Dues</span>

                  <span className="text-sm font-black text-slate-800 uppercase mt-1 border-t pt-1.5">Instalment:</span>
                  <span className="text-right text-sm font-black text-green-700 mt-1 border-t pt-1.5">₹{liveCalculations.dueAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 10: RECENT LOANS */}
          <div className="bg-white border border-slate-150 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase border-b border-slate-100 pb-2">
              RECENT LOANS
            </h3>
            
            {activeLoans.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                NO LOANS YET
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {activeLoans.slice(0, 5).map(loan => (
                  <div key={loan.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-all flex justify-between items-center bg-slate-50/20">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{loan.customer?.name}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{loan.due_type} Mode</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-700">{loan.loan_id}</div>
                      <div className="text-xs font-black text-slate-900 mt-0.5">₹{Number(loan.amount).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default LoanEntry;
