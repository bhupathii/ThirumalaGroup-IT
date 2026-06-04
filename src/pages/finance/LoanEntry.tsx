import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../../components/UI/Input';
import { supabaseFinance, FinanceLoan, FinanceCustomer, FinancePartner, FinanceGuarantor } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, 
  User, 
  Calculator, 
  Printer, 
  X, 
  Upload, 
  Trash2, 
  Navigation,
  Check,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { BiometricScanner } from '../../components/finance/BiometricScanner';
import FinancePrintPreview from '../../components/Finance/FinancePrintPreview';

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
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Form State - Basics
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('CD');
  const [loanId, setLoanId] = useState('');

  // Form State - Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custFatherName, setCustFatherName] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPhone2, setCustPhone2] = useState('');
  const [custVillage, setCustVillage] = useState('');
  const [custMandal, setCustMandal] = useState('');
  const [custDistrict, setCustDistrict] = useState('');
  const [custAadhaarAddress, setCustAadhaarAddress] = useState('');
  const [custPresentAddress, setCustPresentAddress] = useState('');
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);

  // Form State - Guarantor 1
  const [g1SelectedId, setG1SelectedId] = useState('');
  const [g1Name, setG1Name] = useState('');
  const [g1Phone, setG1Phone] = useState('');
  const [g1Aadhaar, setG1Aadhaar] = useState('');
  const [g1Address, setG1Address] = useState('');
  const [g1Photo, setG1Photo] = useState<string | null>(null);
  const [g1FingerprintUrl, setG1FingerprintUrl] = useState<string | null>(null);
  const [g1FingerprintTemplate, setG1FingerprintTemplate] = useState<string | null>(null);
  const [g1FingerprintAdded, setG1FingerprintAdded] = useState(false);
  const [g1Search, setG1Search] = useState('');
  const [g1DropdownOpen, setG1DropdownOpen] = useState(false);

  // Form State - Guarantor 2
  const [g2SelectedId, setG2SelectedId] = useState('');
  const [g2Name, setG2Name] = useState('');
  const [g2Phone, setG2Phone] = useState('');
  const [g2Aadhaar, setG2Aadhaar] = useState('');
  const [g2Address, setG2Address] = useState('');
  const [g2Photo, setG2Photo] = useState<string | null>(null);
  const [g2FingerprintUrl, setG2FingerprintUrl] = useState<string | null>(null);
  const [g2FingerprintTemplate, setG2FingerprintTemplate] = useState<string | null>(null);
  const [g2FingerprintAdded, setG2FingerprintAdded] = useState(false);
  const [g2Search, setG2Search] = useState('');
  const [g2DropdownOpen, setG2DropdownOpen] = useState(false);

  // Reference Data lists
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [guarantors, setGuarantors] = useState<FinanceGuarantor[]>([]);
  const [partners, setPartners] = useState<FinancePartner[]>([]);
  const [activeLoans, setActiveLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);

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

  // Refs for closing dropdowns
  const dropdownRef = useRef<HTMLDivElement>(null);
  const g1DropdownRef = useRef<HTMLDivElement>(null);
  const g2DropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustDropdownOpen(false);
      }
      if (g1DropdownRef.current && !g1DropdownRef.current.contains(e.target as Node)) {
        setG1DropdownOpen(false);
      }
      if (g2DropdownRef.current && !g2DropdownRef.current.contains(e.target as Node)) {
        setG2DropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredCustomersForSelect = useMemo(() => {
    if (!custSearch) return customers.slice(0, 10);
    const q = custSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.customer_id && String(c.customer_id).includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.phone_1 && c.phone_1.includes(q)) ||
      (c.aadhaar && c.aadhaar.includes(q))
    );
  }, [custSearch, customers]);

  const filteredGuarantorsForSelectG1 = useMemo(() => {
    if (!g1Search) return guarantors.slice(0, 10);
    const q = g1Search.toLowerCase();
    return guarantors.filter(g => 
      g.name.toLowerCase().includes(q) ||
      (g.guarantor_id && String(g.guarantor_id).includes(q)) ||
      (g.phone && g.phone.includes(q)) ||
      (g.aadhaar && g.aadhaar.includes(q))
    );
  }, [g1Search, guarantors]);

  const filteredGuarantorsForSelectG2 = useMemo(() => {
    if (!g2Search) return guarantors.slice(0, 10);
    const q = g2Search.toLowerCase();
    return guarantors.filter(g => 
      g.name.toLowerCase().includes(q) ||
      (g.guarantor_id && String(g.guarantor_id).includes(q)) ||
      (g.phone && g.phone.includes(q)) ||
      (g.aadhaar && g.aadhaar.includes(q))
    );
  }, [g2Search, guarantors]);

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

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setLoading(true);
    try {
      const custs = await supabaseFinance.getCustomers();
      setCustomers(custs);

      const guars = await supabaseFinance.getGuarantors();
      setGuarantors(guars);

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

  // Generate Auto sequential Loan ID
  const generateSequentialId = (loansList: any[], category: string) => {
    const prefix = category === 'L' ? 'L' : category;
    const matchingLoans = loansList.filter(l => {
      const lid = (l.loan_id || '').toUpperCase();
      return lid.startsWith(prefix);
    });
    
    let maxNum = 0;
    matchingLoans.forEach(l => {
      const lid = (l.loan_id || '').toUpperCase();
      const suffix = lid.slice(prefix.length);
      const num = parseInt(suffix, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const paddedCount = String(nextNum).padStart(3, '0');
    setLoanId(`${prefix}${paddedCount}`);
  };

  useEffect(() => {
    if (activeLoans.length > 0 || !loading) {
      generateSequentialId(activeLoans, loanCategory);
    }
  }, [loanCategory, activeLoans, loading]);

  // Autofill customer data
  useEffect(() => {
    if (selectedCustomerId) {
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (selected) {
        setCustName(selected.name);
        setCustFatherName(selected.father_name || selected.father_husband_name || '');
        setCustPhone(selected.phone_1 || selected.phone || '');
        setCustPhone2(selected.phone_2 || selected.phone2 || '');
        setCustAadhaar(selected.aadhaar || '');
        setCustPhoto(selected.customer_photo_url || null);
        setCustFingerprintUrl(selected.customer_fingerprint_image_url || selected.fingerprint_url || null);
        setCustFingerprintTemplate(selected.customer_fingerprint_template || selected.fingerprint_template || null);
        setCustFingerprintAdded(!!(selected.customer_fingerprint_added || selected.fingerprint_added));
        
        // Redesign fields
        setCustVillage(selected.village || '');
        setCustMandal(selected.mandal || '');
        setCustDistrict(selected.district || '');
        setCustAadhaarAddress(selected.aadhaar_address || '');
        setCustPresentAddress(selected.present_address || selected.address || '');
        
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
  }, [selectedCustomerId, customers, partners]);

  // Autofill guarantor 1 data
  useEffect(() => {
    if (g1SelectedId) {
      const selected = guarantors.find(g => g.id === g1SelectedId);
      if (selected) {
        setG1Name(selected.name);
        setG1Phone(selected.phone || '');
        setG1Aadhaar(selected.aadhaar || '');
        setG1Address(selected.address || '');
        setG1Photo(selected.photo_url || null);
        setG1FingerprintUrl(selected.fingerprint_image_url || null);
        setG1FingerprintTemplate(selected.fingerprint_template || null);
        setG1FingerprintAdded(!!selected.fingerprint_added);
      }
    }
  }, [g1SelectedId, guarantors]);

  // Autofill guarantor 2 data
  useEffect(() => {
    if (g2SelectedId) {
      const selected = guarantors.find(g => g.id === g2SelectedId);
      if (selected) {
        setG2Name(selected.name);
        setG2Phone(selected.phone || '');
        setG2Aadhaar(selected.aadhaar || '');
        setG2Address(selected.address || '');
        setG2Photo(selected.photo_url || null);
        setG2FingerprintUrl(selected.fingerprint_image_url || null);
        setG2FingerprintTemplate(selected.fingerprint_template || null);
        setG2FingerprintAdded(!!selected.fingerprint_added);
      }
    }
  }, [g2SelectedId, guarantors]);

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

  // Live Calculations
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
    
    setDate(new Date().toISOString().split('T')[0]);
    setLoanCategory('CD');
    setSelectedCustomerId('');
    setCustName('');
    setCustFatherName('');
    setCustPhone('');
    setCustPhone2('');
    setCustAadhaar('');
    setCustPhoto(null);
    setCustFingerprintUrl(null);
    setCustFingerprintTemplate(null);
    setCustFingerprintAdded(false);
    setCustVillage('');
    setCustMandal('');
    setCustDistrict('');
    setCustAadhaarAddress('');
    setCustPresentAddress('');
    setCustSearch('');
    setCustDropdownOpen(false);

    setG1SelectedId('');
    setG1Name('');
    setG1Phone('');
    setG1Aadhaar('');
    setG1Address('');
    setG1Photo(null);
    setG1FingerprintUrl(null);
    setG1FingerprintTemplate(null);
    setG1FingerprintAdded(false);
    setG1Search('');
    setG1DropdownOpen(false);

    setG2SelectedId('');
    setG2Name('');
    setG2Phone('');
    setG2Aadhaar('');
    setG2Address('');
    setG2Photo(null);
    setG2FingerprintUrl(null);
    setG2FingerprintTemplate(null);
    setG2FingerprintAdded(false);
    setG2Search('');
    setG2DropdownOpen(false);

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
    if (!custName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms (Amount, Rate, Duration)');
      return;
    }

    // Validate customer Aadhaar format and duplicate if creating inline
    if (!selectedCustomerId) {
      const cleanAadhaar = custAadhaar.trim();
      if (cleanAadhaar) {
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          toast.error('Aadhaar must be exactly 12 digits.');
          return;
        }

        // Query database directly to check for duplicate Aadhaar
        try {
          const { data: existingCustomers, error: checkError } = await supabase
            .from('finance_customers')
            .select('name, customer_id')
            .eq('aadhaar', cleanAadhaar)
            .limit(1);

          if (checkError) {
            console.error('Error checking duplicate Aadhaar:', checkError);
          } else if (existingCustomers && existingCustomers.length > 0) {
            const dup = existingCustomers[0];
            toast.error(`Customer with this Aadhaar already exists (Name: ${dup.name}, ID: ${dup.customer_id || 'N/A'}).`);
            return;
          }
        } catch (err) {
          console.error('Exception checking duplicate Aadhaar:', err);
        }
      }
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';

      // 1. Resolve Customer ID
      let resolvedCustomerId = selectedCustomerId;
      if (!resolvedCustomerId) {
        // Check if customer already exists by Aadhaar, Phone, or exact Name + Father match
        const match = customers.find(c => 
          (c.aadhaar && custAadhaar && c.aadhaar === custAadhaar) ||
          (c.phone_1 && custPhone && c.phone_1 === custPhone) ||
          (c.phone && custPhone && c.phone === custPhone) ||
          (c.name.toLowerCase() === custName.toLowerCase().trim() && 
           (c.father_name || c.father_husband_name || '').toLowerCase() === custFatherName.toLowerCase().trim())
        );

        if (match) {
          resolvedCustomerId = match.id;
        } else {
          // Create new customer
          const newCust = await supabaseFinance.createCustomer({
            name: custName.trim(),
            phone: custPhone || null,
            phone2: custPhone2 || null,
            address: custPresentAddress || null,
            aadhaar: custAadhaar || null,
            customer_photo_url: custPhoto,
            father_husband_name: custFatherName || null,
            father_name: custFatherName || null,
            village: custVillage || null,
            mandal: custMandal || null,
            district: custDistrict || null,
            aadhaar_address: custAadhaarAddress || null,
            present_address: custPresentAddress || null,
            phone_1: custPhone || null,
            phone_2: custPhone2 || null,
            fingerprint_url: custFingerprintUrl || null,
            fingerprint_template: custFingerprintTemplate || null,
            fingerprint_added: custFingerprintAdded
          });
          if (newCust) {
            resolvedCustomerId = newCust.id;
          } else {
            toast.error('Failed to create new customer record.');
            setSaving(false);
            return;
          }
        }
      }

      // 2. Resolve Guarantor 1 ID
      let resolvedG1Id = g1SelectedId;
      if (!resolvedG1Id && g1Name.trim()) {
        const matchG1 = guarantors.find(g => 
          (g.aadhaar && g1Aadhaar && g.aadhaar === g1Aadhaar) ||
          (g.phone && g1Phone && g.phone === g1Phone) ||
          g.name.toLowerCase() === g1Name.toLowerCase().trim()
        );

        if (matchG1) {
          resolvedG1Id = matchG1.id;
        } else {
          const newGuar = await supabaseFinance.createGuarantor({
            name: g1Name.trim(),
            aadhaar: g1Aadhaar || null,
            phone: g1Phone || null,
            address: g1Address || null,
            photo_url: g1Photo,
            fingerprint_template: g1FingerprintTemplate || null,
            fingerprint_image_url: g1FingerprintUrl || null,
            fingerprint_added: g1FingerprintAdded
          });
          if (newGuar) {
            resolvedG1Id = newGuar.id;
          } else {
            toast.error('Failed to create Guarantor 1 record.');
            setSaving(false);
            return;
          }
        }
      }

      // 3. Resolve Guarantor 2 ID
      let resolvedG2Id = g2SelectedId;
      if (!resolvedG2Id && g2Name.trim()) {
        const matchG2 = guarantors.find(g => 
          (g.aadhaar && g2Aadhaar && g.aadhaar === g2Aadhaar) ||
          (g.phone && g2Phone && g.phone === g2Phone) ||
          g.name.toLowerCase() === g2Name.toLowerCase().trim()
        );

        if (matchG2) {
          resolvedG2Id = matchG2.id;
        } else {
          const newGuar = await supabaseFinance.createGuarantor({
            name: g2Name.trim(),
            aadhaar: g2Aadhaar || null,
            phone: g2Phone || null,
            address: g2Address || null,
            photo_url: g2Photo,
            fingerprint_template: g2FingerprintTemplate || null,
            fingerprint_image_url: g2FingerprintUrl || null,
            fingerprint_added: g2FingerprintAdded
          });
          if (newGuar) {
            resolvedG2Id = newGuar.id;
          } else {
            toast.error('Failed to create Guarantor 2 record.');
            setSaving(false);
            return;
          }
        }
      }

      // 4. Create dues schedule
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

      // Combined Guarantors Surety details for backward compat
      const combinedSuretyName = [g1Name, g2Name].filter(Boolean).join(' / ') || null;
      const combinedSuretyPhone = [g1Phone, g2Phone].filter(Boolean).join(' / ') || null;
      const combinedSuretyAadhaar = [g1Aadhaar, g2Aadhaar].filter(Boolean).join(' / ') || null;

      const finalRemarks = [
         remarks,
        `Collateral: ${locAddress || 'N/A'}, GPS: ${locLatitude && locLongitude ? `${locLatitude},${locLongitude}` : 'N/A'}`,
        `Extra: ${extraDetails || 'N/A'}`
      ].filter(Boolean).join(' | ');

      const customerPayload = {
        id: resolvedCustomerId,
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

      const loanPayload = {
        loan_id: loanId,
        customer_id: resolvedCustomerId,
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
        surety_photo_url: g1Photo || g2Photo || null,
        fingerprint_url: custFingerprintUrl,
        fingerprint_template: custFingerprintTemplate,
        fingerprint_added: custFingerprintAdded,
        customer_fingerprint_template: custFingerprintTemplate,
        customer_fingerprint_image_url: custFingerprintUrl,
        customer_fingerprint_added: custFingerprintAdded,
        surety_fingerprint_template: g1FingerprintTemplate || g2FingerprintTemplate || null,
        surety_fingerprint_image_url: g1FingerprintUrl || g2FingerprintUrl || null,
        surety_fingerprint_added: g1FingerprintAdded || g2FingerprintAdded || false,
        father_husband_name: custFatherName || null,
        loan_category: loanCategory,
        guarantor_1_id: resolvedG1Id || null,
        guarantor_2_id: resolvedG2Id || null
      };

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
        // Save submitted checklist document links
        const linkedDocs = documents.filter(doc => doc.checked && doc.fileUrl);
        for (const doc of linkedDocs) {
          await supabaseFinance.addDocument({
            loan_id: savedLoan.id,
            document_type: `${doc.label} (${doc.refNo || 'No Ref'})`,
            document_url: doc.fileUrl || ''
          });
        }

        // Save collateral info in logs
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
          particulars,
          extraDetails,
          document_charges: liveCalculations.docFees
        };

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
        toast.error('Disbursal failed. Duplicate Loan Number.');
      }
    } catch (err: any) {
      console.error('Save loan error details:', err);
      const errorMsg = err.message || '';
      if (err.code === '42703' || errorMsg.includes('column') || errorMsg.includes('schema cache')) {
        toast.error('Customer table setup is incomplete. Please run migration.');
      } else if (err.code === '23505' || errorMsg.includes('duplicate') || errorMsg.includes('unique constraint')) {
        if (errorMsg.toLowerCase().includes('loan_id') || errorMsg.toLowerCase().includes('loans')) {
          toast.error('Disbursal failed. Duplicate Loan Number.');
        } else if (errorMsg.toLowerCase().includes('aadhaar')) {
          toast.error('Customer with this Aadhaar already exists.');
        } else {
          toast.error(`Duplicate entry error: ${errorMsg}`);
        }
      } else {
        toast.error(`Disbursal failed: ${errorMsg || 'Check database connection or RLS rules.'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPreview = () => {
    if (!liveCalculations) {
      toast.error('Please enter valid loan terms to preview statement');
      return;
    }
    setShowPrintPreview(true);
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
                  CD, HP, STBD, TBD
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
                CUSTOMER DETAILS
              </h3>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('');
                    setCustName('');
                    setCustFatherName('');
                    setCustPhone('');
                    setCustPhone2('');
                    setCustAadhaar('');
                    setCustPhoto(null);
                    setCustFingerprintUrl(null);
                    setCustFingerprintTemplate(null);
                    setCustFingerprintAdded(false);
                    setCustVillage('');
                    setCustMandal('');
                    setCustDistrict('');
                    setCustAadhaarAddress('');
                    setCustPresentAddress('');
                  }}
                  className="text-[10px] font-black text-red-650 hover:underline uppercase tracking-wider"
                >
                  CLEAR SELECTION
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Search input for existing customer */}
              <div ref={dropdownRef} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 print:hidden">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  SELECT EXISTING CUSTOMER (OR TYPE DETAILS DIRECTLY BELOW)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={custSearch}
                    onChange={(e) => {
                      setCustSearch(e.target.value);
                      setCustDropdownOpen(true);
                    }}
                    onFocus={() => setCustDropdownOpen(true)}
                    placeholder="Search by customer name, ID, phone, or Aadhaar..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                  
                  {custDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomersForSelect.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">
                          No matching customers found
                        </div>
                      ) : (
                        filteredCustomersForSelect.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setCustDropdownOpen(false);
                              setCustSearch('');
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{c.name}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                ID: #{c.customer_id || 'N/A'} | Aadhaar: {c.aadhaar || 'N/A'}
                              </div>
                            </div>
                            {(c.phone_1 || c.phone) ? (
                              <div className="text-[10px] text-slate-500 font-bold font-mono">
                                {c.phone_1 || c.phone}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Inputs Panel */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center overflow-hidden shrink-0 relative">
                    {custPhoto ? (
                      <div className="w-full h-full relative">
                        <img src={custPhoto} alt="Customer" className="w-full h-full object-cover" />
                        {!selectedCustomerId && (
                          <button
                            type="button"
                            onClick={() => setCustPhoto(null)}
                            className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-sm"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 p-2 text-center text-[9px] font-bold text-slate-400">
                        <User className="w-5 h-5 text-slate-300 stroke-1" />
                        <span>NO PHOTO</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="bg-[#0b1329] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {selectedCustomerId ? `ID: #${customers.find(c => c.id === selectedCustomerId)?.customer_id || 'N/A'}` : 'NEW ENTRY'}
                    </span>
                    {!selectedCustomerId && (
                      <div className="flex items-center gap-1.5 pt-1.5">
                        <label className="text-[9px] font-black bg-white text-slate-700 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer shadow-sm uppercase tracking-wide">
                          UPLOAD PHOTO
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setCustPhoto(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Customer Name *" 
                    value={custName} 
                    onChange={setCustName} 
                    placeholder="Full Name" 
                    readOnly={!!selectedCustomerId} 
                    required 
                  />
                  <Input 
                    label="Father Name" 
                    value={custFatherName} 
                    onChange={setCustFatherName} 
                    placeholder="Father Name" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Aadhaar UID" 
                    value={custAadhaar} 
                    onChange={setCustAadhaar} 
                    placeholder="12-digit Aadhaar UID" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Phone 1" 
                    value={custPhone} 
                    onChange={setCustPhone} 
                    placeholder="Primary contact" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Phone 2" 
                    value={custPhone2} 
                    onChange={setCustPhone2} 
                    placeholder="Secondary contact" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Village" 
                    value={custVillage} 
                    onChange={setCustVillage} 
                    placeholder="Village" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="Mandal" 
                    value={custMandal} 
                    onChange={setCustMandal} 
                    placeholder="Mandal" 
                    readOnly={!!selectedCustomerId} 
                  />
                  <Input 
                    label="District" 
                    value={custDistrict} 
                    onChange={setCustDistrict} 
                    placeholder="District" 
                    readOnly={!!selectedCustomerId} 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Aadhaar Address
                    </label>
                    <textarea
                      value={custAadhaarAddress}
                      onChange={(e) => setCustAadhaarAddress(e.target.value)}
                      placeholder="Address printed on Aadhaar"
                      rows={2}
                      disabled={!!selectedCustomerId}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 disabled:bg-slate-50 focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Present Address
                    </label>
                    <textarea
                      value={custPresentAddress}
                      onChange={(e) => setCustPresentAddress(e.target.value)}
                      placeholder="Current residential address"
                      rows={2}
                      disabled={!!selectedCustomerId}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 disabled:bg-slate-50 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Biometrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-slate-150">
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
                {g1SelectedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setG1SelectedId('');
                      setG1Name('');
                      setG1Phone('');
                      setG1Aadhaar('');
                      setG1Address('');
                      setG1Photo(null);
                    }}
                    className="text-[9px] font-black text-red-650 hover:underline uppercase tracking-wider"
                  >
                    CLEAR SELECTION
                  </button>
                )}
              </div>

              {/* Search select existing guarantor 1 */}
              <div ref={g1DropdownRef} className="relative print:hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={g1Search}
                  onChange={(e) => {
                    setG1Search(e.target.value);
                    setG1DropdownOpen(true);
                  }}
                  onFocus={() => setG1DropdownOpen(true)}
                  placeholder="Select or Search Existing Guarantor 1..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
                
                {g1DropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredGuarantorsForSelectG1.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">
                        No matching guarantors
                      </div>
                    ) : (
                      filteredGuarantorsForSelectG1.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            setG1SelectedId(g.id);
                            setG1DropdownOpen(false);
                            setG1Search('');
                          }}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">{g.name}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              ID: #{g.guarantor_id || 'N/A'} | Aadhaar: {g.aadhaar || 'N/A'}
                            </div>
                          </div>
                          {g.phone && (
                            <div className="text-[9px] text-slate-500 font-bold font-mono">
                              {g.phone}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor 1 details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Name" value={g1Name} onChange={setG1Name} placeholder="Full Name" readOnly={!!g1SelectedId} />
                <Input label="Aadhaar" value={g1Aadhaar} onChange={setG1Aadhaar} placeholder="Aadhaar UID" readOnly={!!g1SelectedId} />
                <Input label="Phone" value={g1Phone} onChange={setG1Phone} placeholder="Phone No" readOnly={!!g1SelectedId} />
                <Input label="Address" value={g1Address} onChange={setG1Address} placeholder="Address details" readOnly={!!g1SelectedId} />
                <div className="sm:col-span-2">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Guarantor 1 Photo</span>
                  {g1Photo ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-100 rounded border overflow-hidden">
                        <img src={g1Photo} alt="Guarantor 1" className="w-full h-full object-cover" />
                      </div>
                      {!g1SelectedId && (
                        <button
                          type="button"
                          onClick={() => setG1Photo(null)}
                          className="text-[9px] font-black text-red-600 hover:underline uppercase"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>
                  ) : (
                    !g1SelectedId && (
                      <label className="inline-flex px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer transition-colors">
                        ATTACH PHOTO
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setG1Photo(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )
                  )}
                </div>
                
                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <BiometricScanner
                    label="Guarantor 1 Fingerprint Capture"
                    existingTemplate={g1FingerprintTemplate}
                    existingImageUrl={g1FingerprintUrl}
                    onFingerprintSaved={(url, template, added) => {
                      setG1FingerprintUrl(url);
                      setG1FingerprintTemplate(template);
                      setG1FingerprintAdded(added);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Guarantor 2 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  GUARANTOR 2
                </h4>
                {g2SelectedId && (
                  <button
                    type="button"
                    onClick={() => {
                      setG2SelectedId('');
                      setG2Name('');
                      setG2Phone('');
                      setG2Aadhaar('');
                      setG2Address('');
                      setG2Photo(null);
                    }}
                    className="text-[9px] font-black text-red-650 hover:underline uppercase tracking-wider"
                  >
                    CLEAR SELECTION
                  </button>
                )}
              </div>

              {/* Search select existing guarantor 2 */}
              <div ref={g2DropdownRef} className="relative print:hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={g2Search}
                  onChange={(e) => {
                    setG2Search(e.target.value);
                    setG2DropdownOpen(true);
                  }}
                  onFocus={() => setG2DropdownOpen(true)}
                  placeholder="Select or Search Existing Guarantor 2..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
                
                {g2DropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredGuarantorsForSelectG2.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">
                        No matching guarantors
                      </div>
                    ) : (
                      filteredGuarantorsForSelectG2.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            setG2SelectedId(g.id);
                            setG2DropdownOpen(false);
                            setG2Search('');
                          }}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">{g.name}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              ID: #{g.guarantor_id || 'N/A'} | Aadhaar: {g.aadhaar || 'N/A'}
                            </div>
                          </div>
                          {g.phone && (
                            <div className="text-[9px] text-slate-500 font-bold font-mono">
                              {g.phone}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor 2 details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Input label="Name" value={g2Name} onChange={setG2Name} placeholder="Full Name" readOnly={!!g2SelectedId} />
                <Input label="Aadhaar" value={g2Aadhaar} onChange={setG2Aadhaar} placeholder="Aadhaar UID" readOnly={!!g2SelectedId} />
                <Input label="Phone" value={g2Phone} onChange={setG2Phone} placeholder="Phone No" readOnly={!!g2SelectedId} />
                <Input label="Address" value={g2Address} onChange={setG2Address} placeholder="Address details" readOnly={!!g2SelectedId} />
                <div className="sm:col-span-2">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Guarantor 2 Photo</span>
                  {g2Photo ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-100 rounded border overflow-hidden">
                        <img src={g2Photo} alt="Guarantor 2" className="w-full h-full object-cover" />
                      </div>
                      {!g2SelectedId && (
                        <button
                          type="button"
                          onClick={() => setG2Photo(null)}
                          className="text-[9px] font-black text-red-600 hover:underline uppercase"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>
                  ) : (
                    !g2SelectedId && (
                      <label className="inline-flex px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer transition-colors">
                        ATTACH PHOTO
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setG2Photo(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )
                  )}
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                  <BiometricScanner
                    label="Guarantor 2 Fingerprint Capture"
                    existingTemplate={g2FingerprintTemplate}
                    existingImageUrl={g2FingerprintUrl}
                    onFingerprintSaved={(url, template, added) => {
                      setG2FingerprintUrl(url);
                      setG2FingerprintTemplate(template);
                      setG2FingerprintAdded(added);
                    }}
                  />
                </div>
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
                  placeholder="e.g. Gold weight or pledge card particulars"
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
                          placeholder="REF NO..."
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
                <Input label="LANDMARK" value={locLandmark} onChange={setLocLandmark} placeholder="e.g. Near Ramalayam temple" />
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
                  placeholder="REASON FOR BORROWING, REPAYMENT ARRANGEMENT..."
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
                  placeholder="SPECIAL CONDITIONS, ETC."
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

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="Loan Entry - Preview"
      >
        <div className="space-y-6">
          {/* Top Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">THIRUMALA GROUP - LOAN ENTRY</h1>
            <p className="text-sm font-bold text-slate-500 mt-1">Date: {date} | Loan Type: {loanCategory}</p>
          </div>
          
          {/* Customer Info */}
          <div>
            <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="font-bold text-gray-500 text-xs">NAME:</span> {custName}</div>
               <div><span className="font-bold text-gray-500 text-xs">F/W/H:</span> {custFatherName}</div>
               <div><span className="font-bold text-gray-500 text-xs">PHONE:</span> {custPhone}</div>
               <div><span className="font-bold text-gray-500 text-xs">AADHAAR:</span> {custAadhaar}</div>
               <div className="col-span-2"><span className="font-bold text-gray-500 text-xs">ADDRESS:</span> {custPresentAddress}</div>
            </div>
          </div>

          {/* Guarantors */}
          <div>
            <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase">Guarantor Details</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="font-bold text-gray-500 text-xs">G1 NAME:</span> {g1Name}</div>
               <div><span className="font-bold text-gray-500 text-xs">G1 PHONE:</span> {g1Phone}</div>
               {g2Name && <div><span className="font-bold text-gray-500 text-xs">G2 NAME:</span> {g2Name}</div>}
               {g2Phone && <div><span className="font-bold text-gray-500 text-xs">G2 PHONE:</span> {g2Phone}</div>}
            </div>
          </div>

          {/* Loan Terms */}
          <div>
            <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase">Loan Terms</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="font-bold text-gray-500 text-xs">PRINCIPAL:</span> ₹{Number(amount).toLocaleString('en-IN')}</div>
               <div><span className="font-bold text-gray-500 text-xs">INTEREST RATE:</span> {interestRate}% / MONTH</div>
               <div><span className="font-bold text-gray-500 text-xs">DURATION:</span> {durationMonths} MONTHS</div>
               <div><span className="font-bold text-gray-500 text-xs">DUE TYPE:</span> {dueType}</div>
               <div><span className="font-bold text-gray-500 text-xs">DOC CHARGES:</span> ₹{Number(docCharges).toLocaleString('en-IN')}</div>
               <div className="col-span-2"><span className="font-bold text-gray-500 text-xs">PARTICULARS:</span> {particulars}</div>
            </div>
          </div>

          {/* Live Calculation */}
          {liveCalculations && (
          <div>
            <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase">Calculations</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 p-2">
               <div><span className="font-bold text-gray-500 text-xs">NET DISBURSED:</span> ₹{liveCalculations.netDisbursed.toLocaleString('en-IN')}</div>
               <div><span className="font-bold text-gray-500 text-xs">TOTAL REPAYMENT:</span> ₹{liveCalculations.totalRepayment.toLocaleString('en-IN')}</div>
               <div><span className="font-bold text-gray-500 text-xs">INSTALMENT COUNT:</span> {liveCalculations.duesCount}</div>
               <div><span className="font-bold text-gray-500 text-xs">INSTALMENT AMOUNT:</span> ₹{liveCalculations.dueAmount.toLocaleString('en-IN')}</div>
            </div>
          </div>
          )}
          
          {/* Signatures */}
          <div className="pt-24 grid grid-cols-2 gap-10 text-center text-sm font-bold text-slate-500">
            <div>
              <div className="border-t border-slate-300 pt-2 w-48 mx-auto">Customer Signature</div>
            </div>
            <div>
              <div className="border-t border-slate-300 pt-2 w-48 mx-auto">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </FinancePrintPreview>

    </div>
  );
};

export default LoanEntry;
