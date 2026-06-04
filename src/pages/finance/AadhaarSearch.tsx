import React, { useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Search, User, Phone, MapPin, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

interface CustomerAadhaarDetails {
  customer: any;
  loans: any[];
}

const AadhaarSearch: React.FC = () => {
  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CustomerAadhaarDetails | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aadhaar.trim()) {
      toast.error('Please enter an Aadhaar Card Number');
      return;
    }
    const cleanUid = aadhaar.trim();

    setLoading(true);
    setSearched(true);
    try {
      // 1. Fetch customer with matching Aadhaar
      const { data: customer, error: custError } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('aadhaar', cleanUid)
        .maybeSingle();

      if (custError) throw custError;

      if (!customer) {
        setResult(null);
        toast.error('No customer found matching this Aadhaar UID');
        return;
      }

      // 2. Fetch all loans for this customer
      const { data: loans, error: loansError } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('customer_id', customer.id)
        .order('date', { ascending: false });

      if (loansError) throw loansError;

      // Fetch all dues for these loans
      const loanIds = (loans || []).map(l => l.id);
      let duesList: any[] = [];
      if (loanIds.length > 0) {
        const { data: duesData, error: duesError } = await supabase
          .from('finance_dues')
          .select('*')
          .in('loan_id', loanIds)
          .order('due_date', { ascending: true });
        if (!duesError && duesData) {
          duesList = duesData;
        }
      }

      // 3. Fetch transactions to calculate collection ratios for each loan
      const txs = await supabaseFinance.getTransactions();
      const enrichedLoans = (loans || []).map(l => {
        const principal = Number(l.amount);
        const rate = Number(l.interest_rate);
        const duration = Number(l.duration_months);
        const repayable = principal + (principal * (rate / 100) * duration);

        const lCols = txs.filter(t => t.loan_id === l.id && t.type === 'Collection');
        const collected = lCols.reduce((sum, c) => sum + Number(c.amount), 0);
        
        const payRatio = repayable > 0 ? Math.min(100, Math.round((collected / repayable) * 100)) : 0;
        const outstanding = Math.max(0, repayable - collected);
        const loanDues = duesList.filter(d => d.loan_id === l.id);

        return {
          ...l,
          totalRepayable: repayable,
          totalCollected: collected,
          outstanding,
          payRatio,
          dues: loanDues
        };
      });

      setResult({
        customer,
        loans: enrichedLoans
      });

      toast.success('Record found');
    } catch (err) {
      console.error(err);
      toast.error('Error querying Aadhaar database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="finance-h1">Aadhaar Search Engine</h1>
          <p className="finance-small-label uppercase">Look up customer risk profile and full historical loan sheets using Aadhaar UID</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card title="Query Aadhaar Record" subtitle="Lookup the credit registry database" className="max-w-md">
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            label="Aadhaar Card Number (12-Digit UID) *"
            value={aadhaar}
            onChange={setAadhaar}
            placeholder="e.g. 123456789012"
            required
          />
          <Button type="submit" variant="success" className="w-full" icon={Search} disabled={loading}>
            {loading ? 'Searching...' : 'Search Registry'}
          </Button>
        </form>
      </Card>

      {/* Results view */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : result ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer profile */}
          <Card title="Customer Registry Card" subtitle="Identity details saved in credit registry">
            <div className="space-y-4 text-gray-700 finance-input">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-gray-900 finance-card-title">{result.customer.name}</h4>
                  <p className="text-gray-400 finance-caption">Created: {new Date(result.customer.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="finance-input">{result.customer.phone || 'No phone recorded'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="finance-input">{result.customer.address || 'No address recorded'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="font-mono text-gray-900 finance-input">Aadhaar: {result.customer.aadhaar}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Customer loan list */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-gray-900 finance-brand">Historical Credit Ledgers</h3>
            {result.loans.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border rounded-lg bg-gray-50/50">
                No credit loan accounts found associated with this Aadhaar profile.
              </div>
            ) : (
              result.loans.map((loan) => (
                <Card
                  key={loan.id}
                  title={
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono text-gray-900 finance-input">{loan.loan_id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full ${ loan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                        {loan.status}
                      </span>
                    </div>
                  }
                  subtitle={`Disbursed Date: ${new Date(loan.date).toLocaleDateString('en-IN')}`}
                  className="shadow-sm hover:border-green-200 transition-all border border-gray-100"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-gray-600 mb-4 finance-caption">
                    <div>
                      <span className="block text-gray-400 finance-small-label uppercase">Principal</span>
                      <span className="text-gray-900 finance-input">₹{Number(loan.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400 finance-small-label uppercase">Total Repayable</span>
                      <span className="text-gray-900 finance-input">₹{loan.totalRepayable.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400 finance-small-label uppercase">Paid Collected</span>
                      <span className="text-green-600 finance-input">₹{loan.totalCollected.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400 finance-small-label uppercase">Remaining Bal</span>
                      <span className="text-orange-700 finance-input">₹{loan.outstanding.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Payment Ratio Progress Bar */}
                  <div>
                    <div className="flex justify-between text-gray-500 mb-1 finance-small-label">
                      <span>Collection Repayment Progress</span>
                      <span>{loan.payRatio}% Paid</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border">
                      <div
                        className="bg-green-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${loan.payRatio}%` }}
                      />
                    </div>
                  </div>

                  {/* Surety details preview */}
                  {(loan.surety_name || loan.remarks) && (
                    <div className="mt-4 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-400 finance-small-label">
                      {loan.surety_name && (
                        <p>Guarantor: <span className="text-gray-600 finance-input">{loan.surety_name}</span></p>
                      )}
                      {loan.remarks && (
                        <p>Remarks: <span className="text-gray-500 italic finance-input">"{loan.remarks}"</span></p>
                      )}
                    </div>
                  )}

                  {/* Dues Schedule */}
                  {loan.dues && loan.dues.length > 0 && (
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-gray-700 mb-2 finance-header-time">Instalment Dues Schedule</p>
                      <div className="max-h-32 overflow-y-auto border rounded divide-y">
                        {loan.dues.map((due: any) => (
                          <div key={due.id} className="flex justify-between p-2 finance-small-label">
                            <span>{new Date(due.due_date).toLocaleDateString('en-IN')}</span>
                            <span>Due: ₹{Number(due.amount).toLocaleString('en-IN')}</span>
                            <span className={`px-2 py-0.5 rounded-full ${ due.status === 'Paid' ? 'bg-green-100 text-green-800' : due.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800' } finance-input`}>{due.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      ) : searched ? (
        <div className="flex flex-col items-center justify-center border border-dashed rounded-lg py-16 bg-gray-50/20">
          <CreditCard className="w-10 h-10 text-gray-300 mb-2 stroke-1" />
          <p className="finance-small-label uppercase">Registry search was negative. Check Aadhaar spacing and digit counts.</p>
        </div>
      ) : null}
    </div>
  );
};

export default AadhaarSearch;
