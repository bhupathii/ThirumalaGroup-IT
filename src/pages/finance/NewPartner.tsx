import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const NewPartner: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Partner Name is required');
      return;
    }

    setSaving(true);
    try {
      const result = await supabaseFinance.createPartner({
        name,
        phone: phone || null,
      });

      if (result) {
        toast.success(`Partner ${name} registered successfully!`);
        navigate('/finance/partners');
      } else {
        toast.error('Failed to create partner');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Add New Partner</h1>
          <p className="text-gray-500 text-sm mt-1">Register a new financing partner for capital sharing and dividends</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card title="Partner Investment Form" subtitle="Enter partner profile information">
          <div className="space-y-4">
            <Input
              label="Partner Full Name *"
              value={name}
              onChange={setName}
              placeholder="e.g. Anand Sharma"
              required
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={setPhone}
              placeholder="10-digit mobile number"
            />
            <div className="pt-4 flex justify-end">
              <Button type="submit" variant="success" className="w-full" icon={ArrowRight} disabled={saving}>
                {saving ? 'Creating...' : 'Register Partner'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default NewPartner;
