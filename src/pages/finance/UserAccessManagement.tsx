import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Shield, CheckSquare, Square, Save, RefreshCw, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserItem {
  id: string;
  username: string;
  userType: string;
}

const FINANCE_FEATURES_LIST = [
  { key: 'finance_dashboard', label: 'Finance Dashboard' },
  { key: 'loan_entry', label: 'Loan Entry' },
  { key: 'edit_loan_entry', label: 'Edit Loan Entry' },
  { key: 'partners', label: 'Partners Management' },
  { key: 'search', label: 'Search / Payments Center' },
  { key: 'calculator', label: 'General Calculator' },
  { key: 'capital_entry', label: 'Capital Entry' },
  { key: 'camera', label: 'Camera Attachment' },
  { key: 'daybook', label: 'Daybook Statement' },
  { key: 'general_ledger', label: 'General Ledger' },
  { key: 'cd_ledger', label: 'CD (Chit Fund) Ledger' },
  { key: 'stbd_ledger', label: 'STBD Ledger' },
  { key: 'hp_ledger', label: 'HP Ledger' },
  { key: 'tbd_ledger', label: 'TBD Ledger' },
  { key: 'dues_ledger', label: 'Dues Ledger' },
  { key: 'pl', label: 'Profit & Loss Report' },
  { key: 'final_statement', label: 'Balance Sheet' },
  { key: 'business_report', label: 'Business Report' },
  { key: 'partner_performance', label: 'Partner Performance' },
  { key: 'new_customers', label: 'New Customers Audit' },
  { key: 'phone_editor', label: 'Phone Number Editor' },
  { key: 'aadhaar_search', label: 'Aadhaar Search Engine' },
  { key: 'logs', label: 'Audit Logs Registry' }
];

const UserAccessManagement: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, string[]>>({});
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsersAndPermissions();
  }, []);

  const fetchUsersAndPermissions = async () => {
    setLoading(true);
    try {
      // 1. Fetch users from DB
      const { data: dbUsers, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          username,
          user_types(user_type)
        `);

      if (usersError) throw usersError;

      const formattedUsers: UserItem[] = (dbUsers || [])
        .map((u: any) => ({
          id: u.id,
          username: u.username,
          userType: u.user_types?.user_type || 'User'
        }))
        // Filter out Admins as they have access to everything automatically
        .filter(u => u.userType !== 'Admin');

      setUsers(formattedUsers);

      // 2. Fetch current finance permissions map
      const map = await supabaseFinance.getFinanceUsersPermissions();
      setPermissionsMap(map);

      if (formattedUsers.length > 0) {
        setSelectedUserId(formattedUsers[0].id);
        setSelectedKeys(map[formattedUsers[0].id] || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load user permissions configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedKeys(permissionsMap[userId] || []);
  };

  const handleToggleKey = (key: string) => {
    setSelectedKeys(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(FINANCE_FEATURES_LIST.map(f => f.key));
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const success = await supabaseFinance.updateFinanceUserPermissions(selectedUserId, selectedKeys);
      if (success) {
        toast.success('Operator access permissions updated successfully!');
        
        // Update local map cache
        setPermissionsMap(prev => ({
          ...prev,
          [selectedUserId]: selectedKeys
        }));
      } else {
        toast.error('Failed to update operator permissions');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Operator Access Control</h1>
          <p className="text-gray-500 text-sm mt-1">Configure feature access rights for operators in Finance Mode (Admins bypass all rules)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-dashed rounded bg-gray-50">
          <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="font-semibold text-gray-600">No operators registered</p>
          <p className="text-xs mt-1">Access control only applies to user accounts of 'Operator' type. All admins automatically retain full access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User selection panel */}
          <Card title="Operators Registry" subtitle="Select an operator to manage feature permissions">
            <div className="space-y-2">
              {users.map(u => (
                <div
                  key={u.id}
                  onClick={() => handleUserChange(u.id)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                    selectedUserId === u.id
                      ? 'bg-green-100 border-green-300 text-green-800 font-bold shadow-sm'
                      : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{u.username}</span>
                  <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded font-mono font-bold capitalize">
                    {u.userType}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Permissions checkbox lists */}
          <Card
            title="Finance Features Access Matrix"
            subtitle="Grant or restrict specific page menus"
            className="md:col-span-2 shadow border-green-100"
          >
            <div className="space-y-6">
              {/* Select shortcuts */}
              <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border text-xs">
                <span className="font-bold text-gray-500">Quick Config:</span>
                <div className="flex gap-2">
                  <button onClick={handleSelectAll} className="text-green-700 font-bold hover:underline">Select All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={handleClearAll} className="text-red-600 font-bold hover:underline">Clear All</button>
                </div>
              </div>

              {/* Grid of features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {FINANCE_FEATURES_LIST.map((feat) => {
                  const isActive = selectedKeys.includes(feat.key);
                  return (
                    <div
                      key={feat.key}
                      onClick={() => handleToggleKey(feat.key)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${
                        isActive
                          ? 'bg-green-50/50 border-green-200 text-green-800'
                          : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50/50'
                      }`}
                    >
                      {isActive ? (
                        <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 shrink-0" />
                      )}
                      <span className="text-sm font-bold">{feat.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} variant="success" icon={Save} disabled={saving}>
                  {saving ? 'Saving updates...' : 'Save Permissions'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UserAccessManagement;
