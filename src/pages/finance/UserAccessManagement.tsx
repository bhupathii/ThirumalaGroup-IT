import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { CheckSquare, Square, Save, UserPlus, Key, Eye, EyeOff, Search, ChevronDown, ChevronUp, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import bcrypt from 'bcryptjs';

interface UserItem {
  id: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  userType: string;
  created_at: string;
}

interface PermissionGroup {
  name: string;
  features: { key: string; label: string }[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'Entries',
    features: [
      { key: 'loan_entry', label: 'New Loan' },
      { key: 'edit_loan_entry', label: 'Edit Loan' },
      { key: 'new_customers', label: 'New Customer / Customers' },
      { key: 'partners', label: 'New Partner / Partners' },
      { key: 'daybook', label: 'Day Book Entry' },
      { key: 'capital_entry', label: 'Capital Entry' },
      { key: 'calculator', label: 'Calculator' },
      { key: 'search', label: 'Search' }
    ]
  },
  {
    name: 'Ledgers',
    features: [
      { key: 'cd_ledger', label: 'CD Ledger' },
      { key: 'hp_ledger', label: 'HP Ledger' },
      { key: 'stbd_ledger', label: 'STBD Ledger' },
      { key: 'tbd_ledger', label: 'TBD Ledger' },
      { key: 'dues_ledger', label: 'Dues List' },
      { key: 'payment_followup', label: 'Payment Follow-up' }
    ]
  },
  {
    name: 'Reports',
    features: [
      { key: 'daily_report', label: 'Daily Report' },
      { key: 'detailed_ledger', label: 'Detailed Ledger' },
      { key: 'general_ledger', label: 'General Ledger' },
      { key: 'pl', label: 'Profit & Loss' },
      { key: 'final_statement', label: 'Final Statement' },
      { key: 'business_report', label: 'Business Details' },
      { key: 'partner_performance', label: 'Partner Performance' }
    ]
  },
  {
    name: 'Administration & Settings',
    features: [
      { key: 'logs', label: 'Edited / Deleted Logs' },
      { key: 'user_access_management', label: 'User Access Management' },
      { key: 'ledger_settings', label: 'Ledger Settings' }
    ]
  }
];

const UserAccessManagement: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, string[]>>({});
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search and Collapsed States
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Entries': true,
    'Ledgers': true,
    'Reports': true,
    'Administration & Settings': true
  });

  // Create User Form States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cFullName, setCFullName] = useState('');
  const [cUsername, setCUsername] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cRole, setCRole] = useState('Operator');
  const [cIsActive, setCIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Edit User Details States
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editUserType, setEditUserType] = useState('Operator');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsersAndPermissions();
  }, []);

  const fetchUsersAndPermissions = async () => {
    setLoading(true);
    try {
      const { data: dbUsers, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          username,
          full_name,
          phone,
          is_active,
          created_at,
          user_types(user_type)
        `);

      if (usersError) throw usersError;

      const formattedUsers: UserItem[] = (dbUsers || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name || '',
        phone: u.phone || '',
        is_active: u.is_active !== false,
        userType: u.user_types?.user_type || 'Operator',
        created_at: u.created_at
      }));

      // Filter out Super Admin if needed, but let's list all users
      setUsers(formattedUsers);

      const map = await supabaseFinance.getFinanceUsersPermissions();
      setPermissionsMap(map);

      if (formattedUsers.length > 0) {
        selectUser(formattedUsers[0].id, formattedUsers, map);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load users list');
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (userId: string, currentUsers = users, map = permissionsMap) => {
    setSelectedUserId(userId);
    setSelectedKeys(map[userId] || []);
    const user = currentUsers.find(u => u.id === userId);
    if (user) {
      setEditFullName(user.full_name || '');
      setEditPhone(user.phone || '');
      setEditIsActive(user.is_active);
      setEditUserType(user.userType);
      setNewPassword('');
    }
  };

  const handleToggleKey = (key: string) => {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectGroup = (group: PermissionGroup) => {
    const keysToAdd = group.features.map(f => f.key);
    setSelectedKeys(prev => [...new Set([...prev, ...keysToAdd])]);
  };

  const handleClearGroup = (group: PermissionGroup) => {
    const keysToRemove = group.features.map(f => f.key);
    setSelectedKeys(prev => prev.filter(k => !keysToRemove.includes(k)));
  };

  const toggleGroupExpand = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cUsername.trim() || !cPassword.trim()) {
      toast.error('Username and Password are required');
      return;
    }

    // Unique username validation
    const exists = users.some(u => u.username.toLowerCase() === cUsername.trim().toLowerCase());
    if (exists) {
      toast.error('Username already registered');
      return;
    }

    setSaving(true);
    try {
      const password_hash = await bcrypt.hash(cPassword.trim(), 10);

      // Get user type uuid
      const { data: utData, error: utError } = await supabase
        .from('user_types')
        .select('id')
        .eq('user_type', cRole)
        .single();

      if (utError || !utData) {
        throw new Error('Selected User Type / Role does not exist in DB.');
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          username: cUsername.trim(),
          password_hash,
          user_type_id: utData.id,
          email: `${cUsername.trim().toLowerCase()}@thirumalagroup.com`,
          full_name: cFullName.trim() || null,
          phone: cPhone.trim() || null,
          is_active: cIsActive
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Log User Creation
      const staffName = sessionStorage.getItem('thirumala_user') 
        ? JSON.parse(sessionStorage.getItem('thirumala_user')!).username 
        : 'Admin';

      await supabase.from('finance_edited_logs').insert([{
        table_name: 'users',
        record_id: newUser.id,
        old_values: {},
        new_values: { username: cUsername.trim(), full_name: cFullName, phone: cPhone, role: cRole, is_active: cIsActive },
        edited_by: staffName
      }]);

      toast.success(`User ${cUsername} registered successfully!`);
      setShowCreateModal(false);
      
      // Clear form
      setCFullName('');
      setCUsername('');
      setCPassword('');
      setCPhone('');
      setCRole('Operator');
      setCIsActive(true);

      await fetchUsersAndPermissions();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const currentUser = users.find(u => u.id === selectedUserId);
      if (!currentUser) return;

      const updates: any = {};
      const logChanges: any = { old: {}, new: {} };

      if (editFullName.trim() !== (currentUser.full_name || '')) {
        updates.full_name = editFullName.trim();
        logChanges.old.full_name = currentUser.full_name;
        logChanges.new.full_name = editFullName.trim();
      }

      if (editPhone.trim() !== (currentUser.phone || '')) {
        updates.phone = editPhone.trim();
        logChanges.old.phone = currentUser.phone;
        logChanges.new.phone = editPhone.trim();
      }

      if (editIsActive !== currentUser.is_active) {
        updates.is_active = editIsActive;
        logChanges.old.is_active = currentUser.is_active;
        logChanges.new.is_active = editIsActive;
      }

      if (editUserType !== currentUser.userType) {
        const { data: utData } = await supabase
          .from('user_types')
          .select('id')
          .eq('user_type', editUserType)
          .single();
        if (utData) {
          updates.user_type_id = utData.id;
          logChanges.old.role = currentUser.userType;
          logChanges.new.role = editUserType;
        }
      }

      if (newPassword.trim()) {
        updates.password_hash = await bcrypt.hash(newPassword.trim(), 10);
        logChanges.new.password_changed = true;
      }

      const staffName = sessionStorage.getItem('thirumala_user') 
        ? JSON.parse(sessionStorage.getItem('thirumala_user')!).username 
        : 'Admin';

      // 1. Update user details
      if (Object.keys(updates).length > 0) {
        const { error: userUpdateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', selectedUserId);

        if (userUpdateError) throw userUpdateError;

        // Log audit
        await supabase.from('finance_edited_logs').insert([{
          table_name: 'users',
          record_id: selectedUserId,
          old_values: logChanges.old,
          new_values: logChanges.new,
          edited_by: staffName
        }]);
      }

      // 2. Update permissions
      const oldPermissions = permissionsMap[selectedUserId] || [];
      const permissionsChanged = JSON.stringify(oldPermissions.sort()) !== JSON.stringify(selectedKeys.sort());

      if (permissionsChanged) {
        const success = await supabaseFinance.updateFinanceUserPermissions(selectedUserId, selectedKeys);
        if (!success) throw new Error('Permissions update failed');

        await supabase.from('finance_edited_logs').insert([{
          table_name: 'finance_user_permissions',
          record_id: selectedUserId,
          old_values: { permissions: oldPermissions },
          new_values: { permissions: selectedKeys },
          edited_by: staffName
        }]);
      }

      toast.success('User details and access rights updated successfully!');
      setNewPassword('');
      await fetchUsersAndPermissions();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update user parameters');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none font-outfit">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="finance-h1 flex items-center gap-2 text-slate-850">
            <Shield className="w-6 h-6 text-slate-700" />
            USER ACCESS MANAGEMENT
          </h1>
          <p className="mt-1 finance-small-label uppercase">Manage operator profile parameters, login status, and specific finance module menus</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-[#0b1329] hover:bg-slate-850 text-white rounded-lg px-4 py-2 font-bold text-xs uppercase transition-all shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Create New User
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List panel */}
          <div className="space-y-6">
            <Card title="Registered Users" subtitle="Select a profile to edit and configure features">
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                {users.map(u => (
                  <div
                    key={u.id}
                    onClick={() => selectUser(u.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      selectedUserId === u.id
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm">{u.username}</span>
                      <span className={`text-[10px] uppercase font-semibold ${selectedUserId === u.id ? 'text-slate-400' : 'text-slate-500'}`}>
                        {u.full_name || 'No Display Name'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold font-mono uppercase ${
                        u.is_active
                          ? (selectedUserId === u.id ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800')
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold font-mono uppercase ${
                        selectedUserId === u.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-750'
                      }`}>
                        {u.userType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Edit panel & Permissions matrix */}
          {selectedUserId && (
            <div className="lg:col-span-2 space-y-6">
              {/* User settings Card */}
              <Card title="Profile Configuration" subtitle="Modify user status, role, and details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="Display Name"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phone Contact</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Phone Number"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Account Role</label>
                    <select
                      value={editUserType}
                      onChange={(e) => setEditUserType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px] font-bold"
                    >
                      <option value="Operator">Operator (Features governed by matrix)</option>
                      <option value="Admin">Admin (Bypasses all matrix controls)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Login Status</label>
                    <select
                      value={editIsActive ? 'true' : 'false'}
                      onChange={(e) => setEditIsActive(e.target.value === 'true')}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px] font-bold"
                    >
                      <option value="true">Active (Allowed to use system)</option>
                      <option value="false">Inactive / Blocked (Login disabled)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      Reset Account Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password to reset (Leave blank to keep current)"
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                    />
                  </div>
                </div>
              </Card>

              {/* Permissions Matrix Card */}
              <Card
                title="Features Access Control Matrix"
                subtitle="Specify active features for the operator role"
                className="shadow border-slate-150"
              >
                <div className="space-y-6">
                  {/* Search and control Header */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search permissions..."
                        className="pl-9 pr-4 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end text-xs font-bold uppercase">
                      <button
                        onClick={() => setSelectedKeys(PERMISSION_GROUPS.flatMap(g => g.features.map(f => f.key)))}
                        className="text-slate-800 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setSelectedKeys([])}
                        className="text-red-600 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Groups checklist list */}
                  <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {PERMISSION_GROUPS.map((group) => {
                      const filteredFeatures = group.features.filter(f =>
                        f.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        f.key.toLowerCase().includes(searchTerm.toLowerCase())
                      );

                      if (filteredFeatures.length === 0) return null;

                      const isExpanded = expandedGroups[group.name];

                      return (
                        <div key={group.name} className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-sm">
                          {/* Group header */}
                          <div className="bg-slate-50/50 px-4 py-2.5 flex justify-between items-center border-b border-slate-150">
                            <button
                              type="button"
                              onClick={() => toggleGroupExpand(group.name)}
                              className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-850 hover:text-slate-950 text-left"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {group.name}
                            </button>
                            <div className="flex gap-2 text-[10px] font-extrabold uppercase">
                              <button
                                type="button"
                                onClick={() => handleSelectGroup(group)}
                                className="text-slate-700 hover:text-slate-900 hover:underline"
                              >
                                Select Group
                              </button>
                              <span className="text-slate-350">/</span>
                              <button
                                type="button"
                                onClick={() => handleClearGroup(group)}
                                className="text-red-655 hover:text-red-750 hover:underline"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          {/* Group checkboxes */}
                          {isExpanded && (
                            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                              {filteredFeatures.map(feat => {
                                const isActive = selectedKeys.includes(feat.key);
                                return (
                                  <div
                                    key={feat.key}
                                    onClick={() => handleToggleKey(feat.key)}
                                    className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all ${
                                      isActive
                                        ? 'bg-slate-50 border-slate-300 text-slate-900 shadow-sm'
                                        : 'bg-white border-slate-150 text-slate-450 hover:bg-slate-50/50'
                                    }`}
                                  >
                                    {isActive ? (
                                      <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                                    )}
                                    <span className="text-[11px] font-bold uppercase tracking-wider">{feat.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button onClick={handleUpdateUser} variant="success" icon={Save} disabled={saving} className="bg-[#0b1329] border-[#0b1329] hover:bg-slate-800 text-white rounded-lg px-5 py-2.5 font-bold uppercase text-xs">
                      {saving ? 'Saving changes...' : 'Save User Access Rules'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Create User Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white border border-slate-150 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-extrabold uppercase text-sm tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Create New Profile
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={cFullName}
                  onChange={(e) => setCFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  value={cUsername}
                  onChange={(e) => setCUsername(e.target.value)}
                  placeholder="Unique username (For login)"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={cPassword}
                    onChange={(e) => setCPassword(e.target.value)}
                    placeholder="Password hash key"
                    className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Phone Contact</label>
                <input
                  type="text"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">System Role</label>
                  <select
                    value={cRole}
                    onChange={(e) => setCRole(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px] font-bold"
                  >
                    <option value="Operator">Operator</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Initial Status</label>
                  <select
                    value={cIsActive ? 'true' : 'false'}
                    onChange={(e) => setCIsActive(e.target.value === 'true')}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none h-[38px] font-bold"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold uppercase bg-[#0b1329] text-white hover:bg-slate-800 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Registering...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccessManagement;
