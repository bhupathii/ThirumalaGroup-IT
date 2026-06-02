import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { ArrowRight, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { CameraCapture } from '../../components/finance/CameraCapture';
import { BiometricScanner } from '../../components/finance/BiometricScanner';

const NewCustomer: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [fatherHusbandName, setFatherHusbandName] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fingerprintUrl, setFingerprintUrl] = useState<string | null>(null);
  const [fingerprintTemplate, setFingerprintTemplate] = useState<string | null>(null);
  const [fingerprintAdded, setFingerprintAdded] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Customer Name is required');
      return;
    }

    setSaving(true);
    try {
      const result = await supabaseFinance.createCustomer({
        name,
        phone: phone || null,
        phone2: phone2 || null,
        partner_name: null,
        address: address || null,
        aadhaar: aadhaar || null,
        customer_photo_url: photoUrl,
        fingerprint_url: fingerprintUrl,
        fingerprint_template: fingerprintTemplate,
        fingerprint_added: fingerprintAdded,
        customer_fingerprint_template: fingerprintTemplate,
        customer_fingerprint_image_url: fingerprintUrl,
        customer_fingerprint_added: fingerprintAdded,
        father_husband_name: fatherHusbandName || null,
      });

      if (result) {
        toast.success(`Customer ${name} registered successfully!`);
        navigate('/finance/customers');
      } else {
        toast.error('Failed to register customer. Check if Aadhaar is duplicate.');
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
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Register New Customer</h1>
          <p className="text-gray-500 text-sm mt-1">Create a borrower profile before disburse or ledger setup</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card title="Borrower Identity Form" subtitle="Enter demographic details & upload verifications">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Customer Full Name *"
                value={name}
                onChange={setName}
                placeholder="e.g. Ramesh Kumar"
                required
              />
              <Input
                label="Father / Husband Name"
                value={fatherHusbandName}
                onChange={setFatherHusbandName}
                placeholder="Father's or Husband's name"
              />
              <Input
                label="Primary Phone Number"
                value={phone}
                onChange={setPhone}
                placeholder="10-digit mobile number"
              />
              <Input
                label="Secondary Phone Number"
                value={phone2}
                onChange={setPhone2}
                placeholder="Alternative mobile number"
              />
              <Input
                label="Aadhaar Card UID"
                value={aadhaar}
                onChange={setAadhaar}
                placeholder="12-digit Aadhaar UID"
              />
              <div className="sm:col-span-2">
                <Input
                  label="Residential Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="Full home address details"
                />
              </div>
            </div>

            {/* Photo & Biometric attachments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              <CameraCapture
                label="Customer Photo"
                existingPhotoUrl={photoUrl}
                onPhotoSaved={setPhotoUrl}
              />
              <BiometricScanner
                label="Customer Fingerprint Capture"
                existingTemplate={fingerprintTemplate}
                existingImageUrl={fingerprintUrl}
                onFingerprintSaved={(url, template, added) => {
                  setFingerprintUrl(url);
                  setFingerprintTemplate(template);
                  setFingerprintAdded(added);
                }}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" variant="success" className="w-full sm:w-auto px-8" icon={ArrowRight} disabled={saving}>
                {saving ? 'Registering...' : 'Register Customer'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default NewCustomer;
