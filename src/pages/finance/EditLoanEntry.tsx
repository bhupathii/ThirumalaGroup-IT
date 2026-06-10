import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer } from '../../lib/supabaseFinance';
import { Save, X, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { CameraCapture } from '../../components/finance/CameraCapture';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

const EditLoanEntry: React.FC = () => {
  const { user } = useAuth();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [loans, setLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custAadhaar, setCustAadhaar] = useState('');
  const [custPhoto, setCustPhoto] = useState<string | null>(null);
  const [custFingerprintUrl, setCustFingerprintUrl] = useState<string | null>(null);
  const [custFingerprintTemplate, setCustFingerprintTemplate] = useState<string | null>(null);
  const [custFingerprintAdded, setCustFingerprintAdded] = useState(false);
  const [custFatherHusbandName, setCustFatherHusbandName] = useState('');
  const [loanCategory, setLoanCategory] = useState<'CD' | 'STBD' | 'HP' | 'TBD' | 'L'>('L');

  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [dueType, setDueType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [dueAmount, setDueAmount] = useState('');
  const [status, setStatus] = useState<'Active' | 'Closed' | 'NPA_CLOSED'>('Active');
  const [remarks, setRemarks] = useState('');

  const [suretyName, setSuretyName] = useState('');
  const [suretyPhone, setSuretyPhone] = useState('');
  const [suretyAadhaar, setSuretyAadhaar] = useState('');
  const [suretyAadhaarAddress, setSuretyAadhaarAddress] = useState('');
  const [suretyPresentAddress, setSuretyPresentAddress] = useState('');
  const [suretyPhoto, setSuretyPhoto] = useState<string | null>(null);
  const [suretyFingerprintUrl, setSuretyFingerprintUrl] = useState<string | null>(null);
  const [suretyFingerprintTemplate, setSuretyFingerprintTemplate] = useState<string | null>(null);
  const [suretyFingerprintAdded, setSuretyFingerprintAdded] = useState(false);
  const [suretyPermanentVillage, setSuretyPermanentVillage] = useState('');
  const [suretyPermanentMandal, setSuretyPermanentMandal] = useState('');
  const [suretyPermanentDistrict, setSuretyPermanentDistrict] = useState('');
  const [suretyCurrentVillage, setSuretyCurrentVillage] = useState('');
  const [suretyCurrentMandal, setSuretyCurrentMandal] = useState('');
  const [suretyCurrentDistrict, setSuretyCurrentDistrict] = useState('');

  useEffect(() => {
    fetchLoans();
  }, []);

  useEffect(() => {
    // Dynamic client-side filtering
    if (!searchQuery) {
      setFilteredLoans(loans);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = loans.filter(l => 
      l.loan_id.toLowerCase().includes(q) ||
      l.customer?.name.toLowerCase().includes(q) ||
      (l.customer?.phone && l.customer.phone.includes(q)) ||
      (l.customer?.aadhaar && l.customer.aadhaar.includes(q))
    );
    setFilteredLoans(filtered);
  }, [searchQuery, loans]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getLoans();
      setLoans(data);
      setFilteredLoans(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load loans directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLoan = (loan: any) => {
    setSelectedLoan(loan);
    
    // Customer
    setCustName(loan.customer?.name || '');
    setCustPhone(loan.customer?.phone || '');
    setCustAddress(loan.customer?.address || '');
    setCustAadhaar(loan.customer?.aadhaar || '');
    setCustPhoto(loan.customer?.customer_photo_url || null);
    setCustFingerprintUrl(loan.customer?.customer_fingerprint_image_url || loan.customer?.fingerprint_url || null);
    setCustFingerprintTemplate(loan.customer?.customer_fingerprint_template || loan.customer?.fingerprint_template || null);
    setCustFingerprintAdded(!!(loan.customer?.customer_fingerprint_added || loan.customer?.fingerprint_added));
    setCustFatherHusbandName(loan.customer?.father_husband_name || '');
    setLoanCategory(loan.loan_category || 'L');
 
    // Loan
    setDate(loan.date);
    setAmount(String(loan.amount));
    setInterestRate(String(loan.interest_rate));
    setDurationMonths(String(loan.duration_months));
    setDueType(loan.due_type);
    setDueAmount(String(loan.due_amount));
    setStatus(loan.status);
    setRemarks(loan.remarks || '');
 
    // Surety
    setSuretyName(loan.surety_name || '');
    setSuretyPhone(loan.surety_phone || '');
    setSuretyAadhaar(loan.surety_aadhaar || '');
    setSuretyAadhaarAddress(loan.surety_aadhaar_address || '');
    setSuretyPresentAddress(loan.surety_present_address || '');
    setSuretyPhoto(loan.surety_photo_url || null);
    setSuretyFingerprintUrl(loan.surety_fingerprint_image_url || null);
    setSuretyFingerprintTemplate(loan.surety_fingerprint_template || null);
    setSuretyFingerprintAdded(!!loan.surety_fingerprint_added);

    if (loan.guarantor_1_id) {
      supabaseFinance.getCustomerById(loan.guarantor_1_id).then((g: any) => {
        if (g) {
          setSuretyAadhaarAddress(g.aadhaar_address || g.permanent_address || loan.surety_aadhaar_address || '');
          setSuretyPresentAddress(g.present_address || g.current_address || g.address || loan.surety_present_address || '');
          setSuretyPermanentVillage(g.aadhaar_village || g.permanent_village || g.village || '');
          setSuretyPermanentMandal(g.aadhaar_mandal || g.permanent_mandal || g.mandal || '');
          setSuretyPermanentDistrict(g.aadhaar_district || g.permanent_district || g.district || '');
          setSuretyCurrentVillage(g.present_village || g.current_village || '');
          setSuretyCurrentMandal(g.present_mandal || g.current_mandal || '');
          setSuretyCurrentDistrict(g.present_district || g.current_district || '');
        }
      });
    } else {
      setSuretyPermanentVillage('');
      setSuretyPermanentMandal('');
      setSuretyPermanentDistrict('');
      setSuretyCurrentVillage('');
      setSuretyCurrentMandal('');
      setSuretyCurrentDistrict('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    try {
      const staffName = user?.username || 'Staff';

      // 1. Update customer record
      if (selectedLoan.customer?.id) {
        await supabaseFinance.updateCustomer(selectedLoan.customer.id, {
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
        }, staffName);
      }

      // Update linked guarantor if exists (best effort for guarantor_1_id)
      if (selectedLoan.guarantor_1_id) {
        await supabaseFinance.updateCustomer(selectedLoan.guarantor_1_id, {
          name: suretyName || '',
          phone: suretyPhone || null,
          phone_1: suretyPhone || null,
          aadhaar: suretyAadhaar || null,
          aadhaar_address: suretyAadhaarAddress || null,
          aadhaar_village: suretyPermanentVillage || null,
          aadhaar_mandal: suretyPermanentMandal || null,
          aadhaar_district: suretyPermanentDistrict || null,
          present_address: suretyPresentAddress || null,
          present_village: suretyCurrentVillage || null,
          present_mandal: suretyCurrentMandal || null,
          present_district: suretyCurrentDistrict || null,
          address: suretyPresentAddress || null,
          village: suretyCurrentVillage || null,
          mandal: suretyCurrentMandal || null,
          district: suretyCurrentDistrict || null
        }, staffName);
      }

      // 2. Update loan record
      const updatedLoan = await supabaseFinance.updateLoan(selectedLoan.id, {
        date,
        amount: Number(amount),
        interest_rate: Number(interestRate),
        duration_months: Number(durationMonths),
        due_type: dueType,
        due_amount: Number(dueAmount),
        status,
        remarks: remarks || null,
        surety_name: suretyName || null,
        surety_phone: suretyPhone || null,
        surety_aadhaar: suretyAadhaar || null,
        surety_aadhaar_address: suretyAadhaarAddress || null,
        surety_present_address: suretyPresentAddress || null,
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
      }, staffName);

      if (updatedLoan) {
        toast.success(`Loan details for ${selectedLoan.loan_id} updated & logged successfully!`);
        setSelectedLoan(null);
        fetchLoans();
      } else {
        toast.error('Failed to save loan updates');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please check edits.');
    }
  };

  const handleDelete = async (loanId: string) => {
    if (!window.confirm('WARNING: Deleting this loan will wipe all collection logs, dues schedules, and photos. This cannot be undone. Are you absolutely sure?')) return;
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteLoan(loanId, staffName);
      if (success) {
        toast.success('Loan completely deleted from ledger.');
        setSelectedLoan(null);
        fetchLoans();
      } else {
        toast.error('Failed to delete loan');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h1 className="finance-h1">EDIT LOAN LEDGER</h1>
          <p className="mt-1 finance-small-label uppercase">Modify active loan parameters, surety files, and record status updates</p>
        </div>
      </div>

      {selectedLoan ? (
        // Editing View Form
        <Card
          title={`Edit Loan Account: ${selectedLoan.loan_id}`}
          subtitle={`Editing profile for ${selectedLoan.customer?.name}`}
          className="border-green-200"
        >
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Box 1: Customer info */}
              <div className="space-y-3">
                <h4 className="text-gray-800 border-b pb-1 finance-section-heading">Customer Profile</h4>
                <Input label="Customer Name" value={custName} onChange={setCustName} required />
                <Input label="Father / Husband Name" value={custFatherHusbandName} onChange={setCustFatherHusbandName} />
                <Input label="Phone Number" value={custPhone} onChange={setCustPhone} />
                <Input label="Address" value={custAddress} onChange={setCustAddress} />
                <Input label="Aadhaar UID" value={custAadhaar} onChange={setCustAadhaar} />
                
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <CameraCapture
                    label="Customer Photo Capture"
                    existingPhotoUrl={custPhoto}
                    onPhotoSaved={setCustPhoto}
                  />
                  <BiometricScanner
                    label="Customer Fingerprint Capture"
                    existingImageUrl={custFingerprintUrl}
                    existingTemplate={custFingerprintTemplate}
                    onFingerprintSaved={(url, template, added) => {
                      setCustFingerprintUrl(url);
                      setCustFingerprintTemplate(template);
                      setCustFingerprintAdded(added);
                    }}
                  />
                </div>
              </div>

              {/* Box 2: Loan parameters */}
              <div className="space-y-3">
                <h4 className="text-gray-800 border-b pb-1 finance-section-heading">Loan Parameters</h4>
                <Input label="Disbursed Date" type="date" value={date} onChange={setDate} required />
                <div>
                  <label className="finance-caption uppercase" >
                    Loan Category
                  </label>
                  <select
                    value={loanCategory}
                    onChange={(e) => setLoanCategory(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-green-500 finance-header-time"
                  >
                    <option value="L">Regular Loan (L)</option>
                    <option value="CD">Chit Fund (CD)</option>
                    <option value="STBD">Short Term Business Deposit (STBD)</option>
                    <option value="HP">Hire Purchase (HP)</option>
                    <option value="TBD">Term Business Deposit (TBD)</option>
                  </select>
                </div>
                <Input label="Principal Amount (₹)" type="number" value={amount} onChange={setAmount} required />
                
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Rate (% pm)" type="number" value={interestRate} onChange={setInterestRate} required />
                  <Input label="Duration (Months)" type="number" value={durationMonths} onChange={setDurationMonths} required />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="finance-caption uppercase" >
                      Instalment Type
                    </label>
                    <select
                      value={dueType}
                      onChange={(e) => setDueType(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-green-500 finance-header-time"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <Input label="Due Amount (₹)" type="number" value={dueAmount} onChange={setDueAmount} required />
                </div>
              </div>

              {/* Box 3: Surety and Remarks */}
              <div className="space-y-3">
                <h4 className="text-gray-800 border-b pb-1 finance-section-heading">Guarantor & Account Status</h4>
                <Input label="Surety Person Name" value={suretyName} onChange={setSuretyName} />
                <Input label="Surety Phone" value={suretyPhone} onChange={setSuretyPhone} />
                <Input label="Surety Aadhaar" value={suretyAadhaar} onChange={setSuretyAadhaar} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div className="space-y-3">
                    <h5 className="text-[10px] text-gray-500 font-semibold uppercase">Permanent Address</h5>
                    <Input label="Permanent Address" value={suretyAadhaarAddress} onChange={setSuretyAadhaarAddress} />
                    <Input label="Permanent Village" value={suretyPermanentVillage} onChange={setSuretyPermanentVillage} />
                    <Input label="Permanent Mandal" value={suretyPermanentMandal} onChange={setSuretyPermanentMandal} />
                    <Input label="Permanent District" value={suretyPermanentDistrict} onChange={setSuretyPermanentDistrict} />
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-[10px] text-gray-500 font-semibold uppercase">Current Address</h5>
                    <Input label="Current Address" value={suretyPresentAddress} onChange={setSuretyPresentAddress} />
                    <Input label="Current Village" value={suretyCurrentVillage} onChange={setSuretyCurrentVillage} />
                    <Input label="Current Mandal" value={suretyCurrentMandal} onChange={setSuretyCurrentMandal} />
                    <Input label="Current District" value={suretyCurrentDistrict} onChange={setSuretyCurrentDistrict} />
                  </div>
                </div>
                
                <CameraCapture
                  label="Surety Photo Capture"
                  existingPhotoUrl={suretyPhoto}
                  onPhotoSaved={setSuretyPhoto}
                />
                <BiometricScanner
                  label="Surety Fingerprint Capture"
                  existingImageUrl={suretyFingerprintUrl}
                  existingTemplate={suretyFingerprintTemplate}
                  onFingerprintSaved={(url, template, added) => {
                    setSuretyFingerprintUrl(url);
                    setSuretyFingerprintTemplate(template);
                    setSuretyFingerprintAdded(added);
                  }}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="finance-caption uppercase" >
                      Account Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-green-500 finance-header-time"
                    >
                      <option value="Active">Active Account</option>
                      <option value="Closed">Closed Account</option>
                      <option value="NPA_CLOSED">NPA Closed Account</option>
                    </select>
                  </div>
                  <Input label="Remarks" value={remarks} onChange={setRemarks} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="submit" variant="success" icon={Save}>
                Save Changes
              </Button>
              <Button
                onClick={() => handleDelete(selectedLoan.id)}
                variant="danger"
                icon={Trash2}
              >
                Delete Loan Account
              </Button>
              <Button
                onClick={() => setSelectedLoan(null)}
                variant="secondary"
                icon={X}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        // Searching & Listing View
        <div className="space-y-4">
          <div className="max-w-md">
            <Input
              label="Quick Search Loan Records"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by ID, Name, Phone, Aadhaar..."
            />
          </div>

          <Card title="Loans Ledger Index" subtitle="Click on Edit to modify customer records, status or transaction details">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No matching loans found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="finance-small-label uppercase">Loan ID</th>
                      <th className="finance-small-label uppercase">Customer</th>
                      <th className="finance-small-label uppercase">Aadhaar</th>
                      <th className="text-right finance-small-label uppercase">Principal</th>
                      <th className="finance-small-label uppercase">Instalment</th>
                      <th className="text-center finance-small-label uppercase">Status</th>
                      <th className="text-right finance-small-label uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredLoans.map(loan => (
                      <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-gray-900 font-mono finance-input">
                          {loan.loan_id}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-gray-900 finance-input">{loan.customer?.name}</div>
                          {loan.customer?.phone && (
                            <div className="text-gray-500 finance-caption">{loan.customer.phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600 font-mono">
                          {loan.customer?.aadhaar || '-'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-gray-900 finance-input">
                          ₹{Number(loan.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                          {loan.due_type} (₹{Number(loan.due_amount).toLocaleString('en-IN')})
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${ loan.status === 'Active' ? 'bg-green-100 text-green-800' : loan.status === 'NPA_CLOSED' ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right">
                          <Button
                            onClick={() => handleSelectLoan(loan)}
                            variant="primary"
                            size="sm"
                            icon={Edit}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default EditLoanEntry;
