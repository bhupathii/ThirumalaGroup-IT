import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceLoan, FinanceCustomer } from '../../lib/supabaseFinance';
import { ArrowRight, ShieldAlert, User, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { CameraCapture } from '../../components/finance/CameraCapture';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

const NewGuarantor: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<(FinanceLoan & { customer: FinanceCustomer })[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [suretyName, setSuretyName] = useState('');
  const [suretyPhone, setSuretyPhone] = useState('');
  const [suretyAadhaar, setSuretyAadhaar] = useState('');
  const [suretyPhoto, setSuretyPhoto] = useState<string | null>(null);
  const [suretyFingerprintUrl, setSuretyFingerprintUrl] = useState<string | null>(null);
  const [suretyFingerprintTemplate, setSuretyFingerprintTemplate] = useState<string | null>(null);
  const [suretyFingerprintAdded, setSuretyFingerprintAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getLoans();
      // filter active loans or all loans
      setLoans(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load active loans directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLoanId) {
      const selected = loans.find(l => l.id === selectedLoanId);
      if (selected) {
        setSuretyName(selected.surety_name || '');
        setSuretyPhone(selected.surety_phone || '');
        setSuretyAadhaar(selected.surety_aadhaar || '');
        setSuretyPhoto(selected.surety_photo_url || null);
        setSuretyFingerprintUrl(selected.surety_fingerprint_image_url || null);
        setSuretyFingerprintTemplate(selected.surety_fingerprint_template || null);
        setSuretyFingerprintAdded(!!selected.surety_fingerprint_added);
      }
    }
  }, [selectedLoanId, loans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId) {
      toast.error('Please select a loan account first');
      return;
    }
    if (!suretyName.trim()) {
      toast.error('Guarantor Name is required');
      return;
    }

    setSaving(true);
    try {
      const staffName = user?.username || 'Staff';
      const result = await supabaseFinance.updateLoan(
        selectedLoanId,
        {
          surety_name: suretyName || null,
          surety_phone: suretyPhone || null,
          surety_aadhaar: suretyAadhaar || null,
          surety_photo_url: suretyPhoto,
          surety_fingerprint_image_url: suretyFingerprintUrl,
          surety_fingerprint_template: suretyFingerprintTemplate,
          surety_fingerprint_added: suretyFingerprintAdded,
        },
        staffName
      );

      if (result) {
        toast.success('Guarantor added/updated successfully!');
        navigate('/finance');
      } else {
        toast.error('Failed to link guarantor details to the loan account.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Add / Update Guarantor</h1>
          <p className="text-gray-500 text-sm mt-1">Assign surety profiles and biometric signatures to loan accounts</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card title="Guarantor Card Assignment" subtitle="Choose loan account & input surety contact details">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1" style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}>
                  Select Loan Account *
                </label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                  style={{ fontFamily: 'Times New Roman', fontSize: '14px' }}
                  required
                >
                  <option value="">-- Choose Loan Account --</option>
                  {loans.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.loan_id} - {l.customer?.name} ({l.due_type} Mode)
                    </option>
                  ))}
                </select>
              </div>

              {selectedLoanId && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Guarantor Full Name *"
                      value={suretyName}
                      onChange={setSuretyName}
                      placeholder="e.g. Anand Kumar"
                      required
                    />
                    <Input
                      label="Guarantor Phone"
                      value={suretyPhone}
                      onChange={setSuretyPhone}
                      placeholder="10-digit phone number"
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Guarantor Aadhaar Card UID"
                        value={suretyAadhaar}
                        onChange={setSuretyAadhaar}
                        placeholder="12-digit Aadhaar UID"
                      />
                    </div>
                  </div>

                  {/* Photo & Biometric attachments */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-150">
                    <CameraCapture
                      label="Guarantor Photo Capture"
                      existingPhotoUrl={suretyPhoto}
                      onPhotoSaved={setSuretyPhoto}
                    />
                    <BiometricScanner
                      label="Guarantor Fingerprint Scanner"
                      existingTemplate={suretyFingerprintTemplate}
                      existingImageUrl={suretyFingerprintUrl}
                      onFingerprintSaved={(url, template, added) => {
                        setSuretyFingerprintUrl(url);
                        setSuretyFingerprintTemplate(template);
                        setSuretyFingerprintAdded(added);
                      }}
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" variant="success" className="w-full sm:w-auto px-8" icon={ArrowRight} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Guarantor Details'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </form>
    </div>
  );
};

export default NewGuarantor;
