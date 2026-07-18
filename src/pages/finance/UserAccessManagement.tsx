import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { rawSupabase } from '../../lib/supabase';
import {
  Shield, UserPlus, Save, Key, X,
  AlertCircle, Lock, Unlock, Copy, RefreshCw, Trash2, Printer, CheckSquare, Square,
  Search, MoreVertical, ChevronDown, ChevronRight, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import bcrypt from 'bcryptjs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRole {
  id: string;
  user_type: string;
}

interface UserItem {
  id: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: 'Active' | 'Disabled' | 'Locked' | 'Deleted' | 'Suspended';
  is_active: boolean;
  userType: string;
  userTypeId: string;
  created_at: string;
  created_by: string | null;
  employee_id: string | null;
  designation: string | null;
  branch: string | null;
  last_login: string | null;
  last_password_change: string | null;
  login_count: number;
  failed_login_attempts: number;
}

interface AuditLogEntry {
  id: string;
  changed_by: string;
  target_username: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
}

interface LoginHistoryEntry {
  id: string;
  username: string;
  login_time: string;
  logout_time: string | null;
  ip_address: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;
  session_duration: string | null;
  success: boolean;
  failure_reason: string | null;
}

interface UserActivityEntry {
  id: string;
  username: string;
  activity_type: string;
  description: string | null;
  created_at: string;
}

type PermissionMap = Record<string, string[]>;

// ─── Constants ────────────────────────────────────────────────────────────────

const PERMISSION_GROUPS = [
  {
    name: 'Dashboard',
    features: [{ key: 'dashboard', label: 'View Dashboard' }]
  },
  {
    name: 'Loans',
    features: [
      { key: 'loan_new', label: 'New Loan' },
      { key: 'loan_edit', label: 'Edit Loan' },
      { key: 'loan_delete', label: 'Delete Loan' },
      { key: 'loan_approve', label: 'Approve Loan' }
    ]
  },
  {
    name: 'Customers',
    features: [
      { key: 'customer_view', label: 'View Customers' },
      { key: 'customer_create', label: 'Create Customer' },
      { key: 'customer_edit', label: 'Edit Customer' },
      { key: 'customer_delete', label: 'Delete Customer' }
    ]
  },
  {
    name: 'Partners',
    features: [
      { key: 'partner_view', label: 'View Partners' },
      { key: 'partner_create', label: 'Create Partner' },
      { key: 'partner_edit', label: 'Edit Partner' },
      { key: 'partner_delete', label: 'Delete Partner' }
    ]
  },
  {
    name: 'Ledgers',
    features: [
      { key: 'ledger_cd', label: 'CD Ledger' },
      { key: 'ledger_hp', label: 'HP Ledger' },
      { key: 'ledger_stbd', label: 'STBD Ledger' },
      { key: 'ledger_tbd', label: 'TBD Ledger' },
      { key: 'ledger_general', label: 'General Ledger' },
      { key: 'ledger_detailed', label: 'Detailed Ledger' }
    ]
  },
  {
    name: 'Reports',
    features: [
      { key: 'report_daily', label: 'Daily Report' },
      { key: 'report_due_list', label: 'Due List' },
      { key: 'report_business_details', label: 'Business Details' },
      { key: 'report_partner_performance', label: 'Partner Performance' },
      { key: 'report_pl', label: 'P&L / Balance Sheet' },
      { key: 'report_final_statement', label: 'Final Statement' }
    ]
  },
  {
    name: 'Operations',
    features: [
      { key: 'op_payment_followup', label: 'Payment Follow-up' },
      { key: 'op_call_history', label: 'Call History' },
      { key: 'op_transaction_approval', label: 'Transaction Approval' }
    ]
  },
  {
    name: 'Administration',
    features: [
      { key: 'admin_user_management', label: 'User Management' },
      { key: 'admin_ledger_settings', label: 'Ledger Settings' },
      { key: 'admin_audit_logs', label: 'Audit Logs' }
    ]
  }
];

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  'Administrator': [],
  'Manager': [],
  'Operator': [],
  'Cashier': [],
  'Collection Agent': []
};

// Initialize default permission mapping
PERMISSION_GROUPS.forEach(g => {
  g.features.forEach(f => {
    ROLE_DEFAULT_PERMISSIONS['Administrator'].push(f.key);
    ROLE_DEFAULT_PERMISSIONS['Manager'].push(f.key);
    if (!f.key.startsWith('admin_')) {
      ROLE_DEFAULT_PERMISSIONS['Operator'].push(f.key);
    }
    if (f.key.startsWith('ledger_') || f.key.startsWith('report_') || f.key === 'dashboard') {
      ROLE_DEFAULT_PERMISSIONS['Cashier'].push(f.key);
    }
    if (f.key.startsWith('op_') || f.key === 'dashboard') {
      ROLE_DEFAULT_PERMISSIONS['Collection Agent'].push(f.key);
    }
  });
});

const getStaffName = () => {
  try {
    return JSON.parse(sessionStorage.getItem('thirumala_user') || '{}').username || 'Admin';
  } catch {
    return 'Admin';
  }
};

export default function UserAccessManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permMap, setPermMap] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);

  // Selection & Tab State (LEFT Registered Users, RIGHT Selected User details)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'activity' | 'login_history' | 'audit'>('profile');

  // Accordion active group state (Permissions Tab)
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Dashboard');

  // Dropdown states
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Sidebar filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Profile fields state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    roleId: '',
    branch: '',
    employeeId: '',
    designation: '',
    status: 'Active' as UserItem['status']
  });

  // Selected permissions (right panel)
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Log data
  const [activities, setActivities] = useState<UserActivityEntry[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Create User modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cForm, setCForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    roleId: '',
    branch: '',
    employeeId: '',
    designation: '',
  });
  const [cErrors, setCErrors] = useState<Record<string, string>>({});
  const [cSaving, setCSaving] = useState(false);

  // Justification override reason modal
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [reasonAction, setReasonAction] = useState<() => Promise<void>>();

  // Load datasets
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roleRows, error: roleErr } = await rawSupabase
        .schema('public').from('user_types').select('id, user_type').order('user_type');
      if (roleErr) throw roleErr;
      setRoles(roleRows || []);

      const { data: dbUsers, error: usersErr } = await rawSupabase
        .schema('public').from('users').select('*, user_types(user_type)').order('username');
      if (usersErr) throw usersErr;

      const formatted: UserItem[] = (dbUsers || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        phone: u.phone,
        email: u.email,
        status: u.status || (u.is_active === false ? 'Disabled' : 'Active'),
        is_active: u.is_active !== false,
        userType: u.user_types?.user_type || 'Operator',
        userTypeId: u.user_type_id || '',
        created_at: u.created_at,
        created_by: u.created_by,
        employee_id: u.employee_id,
        designation: u.designation,
        branch: u.branch,
        last_login: u.last_login,
        last_password_change: u.last_password_change,
        login_count: u.login_count || 0,
        failed_login_attempts: u.failed_login_attempts || 0
      }));
      setUsers(formatted);

      const { data: permRows, error: permErr } = await rawSupabase
        .schema('public').from('user_permissions').select('*');
      if (permErr) console.warn(permErr);

      const map: PermissionMap = {};
      (permRows || []).forEach((row: any) => {
        if (!map[row.user_id]) map[row.user_id] = [];
        if (!map[row.user_id].includes(row.feature_key)) {
          map[row.user_id].push(row.feature_key);
        }
      });
      setPermMap(map);

      if (formatted.length > 0) {
        const nextId = selectedId && formatted.some(x => x.id === selectedId) ? selectedId : formatted[0].id;
        setSelectedId(nextId);
        const selUser = formatted.find(x => x.id === nextId);
        if (selUser) {
          hydrateUser(selUser, map);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load user access dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadAll();
  }, []);

  const hydrateUser = (u: UserItem, map = permMap) => {
    setProfileForm({
      fullName: u.full_name || '',
      phone: u.phone || '',
      email: u.email || '',
      roleId: u.userTypeId,
      branch: u.branch || '',
      employeeId: u.employee_id || '',
      designation: u.designation || '',
      status: u.status
    });

    const userPerms = map[u.id];
    let nextSet = new Set<string>();
    if (userPerms && userPerms.length > 0) {
      nextSet = new Set(userPerms);
    } else {
      const defaults = ROLE_DEFAULT_PERMISSIONS[u.userType] || [];
      nextSet = new Set(defaults);
    }
    setSelectedPerms(nextSet);
  };

  const selectedUser = useMemo(() => users.find(u => u.id === selectedId), [users, selectedId]);

  // Load sub-tab lists
  useEffect(() => {
    if (!selectedId || !selectedUser) return;
    const loadTab = async () => {
      setTabLoading(true);
      try {
        if (activeTab === 'activity') {
          const { data } = await rawSupabase.schema('public').from('user_activities')
            .select('*').eq('user_id', selectedId).order('created_at', { ascending: false }).limit(50);
          setActivities(data || []);
        } else if (activeTab === 'login_history') {
          const { data } = await rawSupabase.schema('public').from('login_history')
            .select('*').eq('user_id', selectedId).order('login_time', { ascending: false }).limit(50);
          setLoginHistory(data || []);
        } else if (activeTab === 'audit') {
          const { data } = await rawSupabase.schema('public').from('audit_logs')
            .select('*').eq('target_user_id', selectedId).order('created_at', { ascending: false }).limit(50);
          setAuditLogs(data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setTabLoading(false);
      }
    };
    loadTab();
  }, [activeTab, selectedId, selectedUser]);

  // Apply default permission presets
  const handleApplyPreset = (presetName: string) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[presetName] || [];
    setSelectedPerms(new Set(defaults));
    toast.success(`Applied ${presetName} permission defaults. Click 'Save' to apply changes.`);
  };

  const handleRoleChange = (roleId: string) => {
    setProfileForm(p => ({ ...p, roleId }));
    const roleName = roles.find(r => r.id === roleId)?.user_type;
    if (roleName) {
      handleApplyPreset(roleName);
    }
  };

  const logAudit = async (field: string, oldVal: string | null, newVal: string | null, reason: string) => {
    if (!selectedUser) return;
    try {
      await rawSupabase.schema('public').from('audit_logs').insert({
        changed_by: getStaffName(),
        target_user_id: selectedUser.id,
        target_username: selectedUser.username,
        field,
        old_value: oldVal,
        new_value: newVal,
        reason
      });
      await rawSupabase.schema('public').from('user_activities').insert({
        user_id: selectedUser.id,
        username: selectedUser.username,
        activity_type: 'Profile Update',
        description: `Field '${field}' modified from '${oldVal}' to '${newVal}'`
      });
    } catch (e) {
      console.error('Audit failed:', e);
    }
  };

  const requestReason = (action: () => Promise<void>) => {
    setAuditReason('');
    setReasonAction(() => action);
    setShowReasonModal(true);
  };

  const handleConfirmReason = async () => {
    if (!auditReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setShowReasonModal(false);
    if (reasonAction) {
      await reasonAction();
    }
  };

  const handleSaveProfileAndPerms = async () => {
    if (!selectedId || !selectedUser) return;
    setSaving(true);
    try {
      requestReason(async () => {
        setSaving(true);
        try {
          // 1. Save Profile Form updates
          const updates: any = {};
          const changes: Array<{ field: string; old: string | null; new: string | null }> = [];

          if (profileForm.email !== selectedUser.email) {
            updates.email = profileForm.email;
            changes.push({ field: 'email', old: selectedUser.email, new: profileForm.email });
          }
          if (profileForm.branch !== selectedUser.branch) {
            updates.branch = profileForm.branch;
            changes.push({ field: 'branch', old: selectedUser.branch, new: profileForm.branch });
          }
          if (profileForm.employeeId !== selectedUser.employee_id) {
            updates.employee_id = profileForm.employeeId;
            changes.push({ field: 'employee_id', old: selectedUser.employee_id, new: profileForm.employeeId });
          }
          if (profileForm.designation !== selectedUser.designation) {
            updates.designation = profileForm.designation;
            changes.push({ field: 'designation', old: selectedUser.designation, new: profileForm.designation });
          }
          if (profileForm.roleId !== selectedUser.userTypeId) {
            updates.user_type_id = profileForm.roleId;
            const newRoleName = roles.find(r => r.id === profileForm.roleId)?.user_type || '';
            changes.push({ field: 'role', old: selectedUser.userType, new: newRoleName });
          }
          if (profileForm.status !== selectedUser.status) {
            updates.status = profileForm.status;
            updates.is_active = profileForm.status === 'Active';
            changes.push({ field: 'status', old: selectedUser.status, new: profileForm.status });
          }

          if (Object.keys(updates).length > 0) {
            const { error: profileErr } = await rawSupabase.schema('public').from('users').update({
              ...updates,
              updated_at: new Date().toISOString()
            }).eq('id', selectedId);
            if (profileErr) throw profileErr;

            for (const c of changes) {
              await logAudit(c.field, c.old, c.new, auditReason);
            }
          }

          // 2. Save Permissions updates
          const oldPerms = permMap[selectedId] || [];
          const { error: delErr } = await rawSupabase.schema('public').from('user_permissions')
            .delete().eq('user_id', selectedId);
          if (delErr) throw delErr;

          const rows = Array.from(selectedPerms).map(fk => ({
            user_id: selectedId,
            feature_key: fk
          }));

          if (rows.length > 0) {
            const { error: insErr } = await rawSupabase.schema('public').from('user_permissions').insert(rows);
            if (insErr) throw insErr;
          }

          await logAudit(
            'permissions',
            JSON.stringify(oldPerms),
            JSON.stringify(Array.from(selectedPerms)),
            auditReason
          );

          toast.success('Configuration saved successfully');
          await loadAll();
        } catch (e: any) {
          toast.error(e.message || 'Save failed');
        } finally {
          setSaving(false);
        }
      });
    } catch (e: any) {
      toast.error(e.message || 'Save aborted');
      setSaving(false);
    }
  };

  const handleResetPassword = () => {
    const tempPass = prompt('Enter new temporary password (min 6 characters):');
    if (!tempPass) return;
    if (tempPass.length < 6) {
      toast.error('Password too short!');
      return;
    }
    requestReason(async () => {
      setSaving(true);
      try {
        const hash = await bcrypt.hash(tempPass, 10);
        const { error } = await rawSupabase.schema('public').from('users').update({
          password_hash: hash,
          temp_password: tempPass,
          password_expired: true,
          last_password_change: new Date().toISOString()
        }).eq('id', selectedId);
        if (error) throw error;

        await logAudit('password', 'HIDDEN', 'TEMPORARY_SET', auditReason);
        toast.success(`Password reset. Temp password: ${tempPass}`);
        await loadAll();
      } catch (e: any) {
        toast.error(e.message || 'Failed to reset password');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleToggleStatus = (targetStatus: UserItem['status']) => {
    requestReason(async () => {
      setSaving(true);
      try {
        const { error } = await rawSupabase.schema('public').from('users').update({
          status: targetStatus,
          is_active: targetStatus === 'Active',
          updated_at: new Date().toISOString()
        }).eq('id', selectedId);
        if (error) throw error;

        await logAudit('status', selectedUser?.status || null, targetStatus, auditReason);
        toast.success(`User status updated to ${targetStatus}`);
        await loadAll();
      } catch (e: any) {
        toast.error(e.message || 'Failed to update status');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDeleteUser = () => {
    requestReason(async () => {
      setSaving(true);
      try {
        const { error } = await rawSupabase.schema('public').from('users').update({
          status: 'Deleted',
          is_active: false,
          deleted_by: getStaffName(),
          deleted_at: new Date().toISOString(),
          deletion_reason: auditReason
        }).eq('id', selectedId);
        if (error) throw error;

        await logAudit('status', selectedUser?.status || null, 'Deleted', auditReason);
        toast.success('User soft deleted');
        await loadAll();
      } catch (e: any) {
        toast.error(e.message || 'Soft delete failed');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleRestoreUser = () => {
    requestReason(async () => {
      setSaving(true);
      try {
        const { error } = await rawSupabase.schema('public').from('users').update({
          status: 'Active',
          is_active: true,
          deleted_by: null,
          deleted_at: null,
          deletion_reason: null
        }).eq('id', selectedId);
        if (error) throw error;

        await logAudit('status', 'Deleted', 'Active', auditReason);
        toast.success('User restored');
        await loadAll();
      } catch (e: any) {
        toast.error(e.message || 'Restore failed');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleCloneUser = () => {
    if (!selectedUser) return;
    const name = prompt(`Cloned username for "${selectedUser.username}":`);
    if (!name || !name.trim()) return;

    setCForm({
      username: name.trim(),
      password: '',
      fullName: '',
      email: '',
      phone: '',
      roleId: selectedUser.userTypeId,
      branch: selectedUser.branch || '',
      employeeId: '',
      designation: selectedUser.designation || '',
    });
    setShowCreateModal(true);
  };

  const handleCopyPermissions = () => {
    const name = prompt('Copy permissions from username:');
    if (!name) return;
    const target = users.find(u => u.username.toLowerCase() === name.trim().toLowerCase());
    if (!target) {
      toast.error('User not found');
      return;
    }
    const targetPerms = permMap[target.id] || [];
    setSelectedPerms(new Set(targetPerms));
    toast.success(`Copied configuration settings. Click 'Save' to save.`);
  };

  const togglePerm = (fk: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(fk)) next.delete(fk);
      else next.add(fk);
      return next;
    });
  };

  const grantAll = () => {
    const next: string[] = [];
    PERMISSION_GROUPS.forEach(g => {
      g.features.forEach(f => {
        next.push(f.key);
      });
    });
    setSelectedPerms(new Set(next));
  };

  const removeAll = () => {
    setSelectedPerms(new Set());
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!cForm.username.trim()) errs.username = 'Required';
    else if (users.some(u => u.username.toLowerCase() === cForm.username.trim().toLowerCase())) errs.username = 'Already exists';

    if (!cForm.password.trim()) errs.password = 'Required';
    else if (cForm.password.trim().length < 6) errs.password = 'Min 6 characters';

    if (!cForm.roleId) errs.roleId = 'Required';

    setCErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCSaving(true);
    try {
      const hash = await bcrypt.hash(cForm.password.trim(), 10);
      const { data: newU, error } = await rawSupabase.schema('public').from('users').insert({
        username: cForm.username.trim(),
        password_hash: hash,
        email: cForm.email.trim() || null,
        user_type_id: cForm.roleId,
        branch: cForm.branch.trim() || null,
        designation: cForm.designation.trim() || null,
        employee_id: cForm.employeeId.trim() || null,
        created_by: getStaffName(),
        status: 'Active',
        is_active: true
      }).select().single();

      if (error) throw error;

      const roleName = roles.find(r => r.id === cForm.roleId)?.user_type || 'Operator';
      const defaults = ROLE_DEFAULT_PERMISSIONS[roleName] || [];
      const rows = defaults.map(fk => ({
        user_id: newU.id,
        feature_key: fk
      }));

      if (rows.length > 0) {
        await rawSupabase.schema('public').from('user_permissions').insert(rows);
      }

      toast.success(`User "${cForm.username}" created successfully`);
      setShowCreateModal(false);
      setCForm({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phone: '',
        roleId: '',
        branch: '',
        employeeId: '',
        designation: '',
      });
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (statusFilter !== 'ALL') {
      list = list.filter(u => u.status === statusFilter);
    }
    if (roleFilter !== 'ALL') {
      list = list.filter(u => u.userType === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      );
    }
    return list.sort((a, b) => a.username.localeCompare(b.username));
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 font-outfit select-none border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      
      {/* Top Header / Compact Action Bar */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-violet-650" />
          <h1 className="text-sm font-black text-slate-800 tracking-tight uppercase">User Access Console</h1>
        </div>

        {/* Clean, business-friendly actions list */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-755 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create User
          </button>

          <button
            onClick={handleSaveProfileAndPerms}
            disabled={saving}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={handleResetPassword}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            Reset Password
          </button>

          {/* More (...) dropdown menu */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl py-1 shadow-xl z-50 text-xs">
                <button
                  onClick={() => { setShowMoreMenu(false); grantAll(); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-violet-600" />
                  Grant All Access
                </button>
                <button
                  onClick={() => { setShowMoreMenu(false); removeAll(); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 text-violet-650" />
                  Remove All Access
                </button>
                <button
                  onClick={() => { setShowMoreMenu(false); handleCloneUser(); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5 text-violet-600" />
                  Clone User Profile
                </button>
                <button
                  onClick={() => { setShowMoreMenu(false); handleCopyPermissions(); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5 text-violet-600" />
                  Copy Permissions
                </button>
                <button
                  onClick={() => { setShowMoreMenu(false); window.print(); }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5 text-violet-600" />
                  Print Details
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                {selectedUser && selectedUser.status === 'Locked' ? (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleToggleStatus('Active'); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-amber-600 flex items-center gap-2"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Unlock Account
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleToggleStatus('Locked'); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-amber-600 flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock Account
                  </button>
                )}

                {selectedUser && selectedUser.status === 'Disabled' ? (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleToggleStatus('Active'); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-amber-600 flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Enable User
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleToggleStatus('Disabled'); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-amber-600 flex items-center gap-2"
                  >
                    <X className="w-3.5 h-3.5" />
                    Disable User
                  </button>
                )}

                {selectedUser && selectedUser.status === 'Deleted' ? (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleRestoreUser(); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-emerald-600 flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Restore User
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowMoreMenu(false); handleDeleteUser(); }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete User (Soft)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Container - 2-Panel Layout (Left Registered Users List, Right Selected User detail tabs) */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-[#F8FAFC]">
        
        {/* LEFT Registered Users Sidebar (25% Width) */}
        <div className="w-[25%] border-r border-slate-200 bg-slate-50 flex flex-col min-w-[260px] md:block hidden">
          <div className="p-3 border-b border-slate-200 space-y-2 shrink-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Quick search user..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-violet-500 focus:bg-white transition"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-650 py-1 px-1.5 rounded-lg text-[10px] focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Roles</option>
                {roles.map(r => (
                  <option key={r.id} value={r.user_type}>{r.user_type}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-655 py-1 px-1.5 rounded-lg text-[10px] focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
                <option value="Locked">Locked</option>
                <option value="Suspended">Suspended</option>
                <option value="Deleted">Deleted</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="p-4 text-center text-slate-400 text-xs">Loading registered users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">No users found.</div>
            ) : (
              filteredUsers.map(u => {
                const isSelected = u.id === selectedId;
                let statusColor = 'bg-slate-400';
                if (u.status === 'Active') {
                  statusColor = u.last_login && (Date.now() - new Date(u.last_login).getTime() < 30 * 60 * 1000)
                    ? 'bg-emerald-500' // green dot if online
                    : 'bg-red-500'; // red dot if offline
                } else if (u.status === 'Locked') {
                  statusColor = 'bg-orange-500';
                }

                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedId(u.id);
                      hydrateUser(u);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between border transition ${
                      isSelected
                        ? 'bg-violet-50/60 text-violet-850 border-violet-200 border-l-4 border-l-violet-600 font-bold'
                        : 'bg-white text-slate-600 hover:bg-slate-55 border-slate-150'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${statusColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{u.full_name || u.username}</div>
                        <div className="text-[10px] text-slate-400 truncate">@{u.username}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] bg-slate-50 border border-slate-200 text-slate-500 px-1 py-0.5 rounded font-extrabold uppercase">
                        {u.userType}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT Selected User Detail Tabs (75% Width) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedUser ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Tab navigation headers */}
              <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
                {(['profile', 'permissions', 'activity', 'login_history', 'audit'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition ${
                      activeTab === tab
                        ? 'border-b-2 border-violet-650 text-violet-750 bg-white'
                        : 'text-slate-500 hover:text-slate-705 hover:bg-slate-100/50'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Tab Display Panel */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* PROFILE TAB */}
                {activeTab === 'profile' && (
                  <div className="max-w-2xl space-y-6">
                    
                    {/* Basic Info */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-violet-650 uppercase tracking-wider">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Full Name</label>
                          <input
                            type="text"
                            value={profileForm.fullName}
                            onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Username</label>
                          <input
                            type="text"
                            disabled
                            value={selectedUser.username}
                            className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Phone Number</label>
                          <input
                            type="text"
                            value={profileForm.phone}
                            onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Email Address</label>
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-slate-300"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 my-4"></div>

                    {/* Work Info */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-violet-650 uppercase tracking-wider">Work Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Role</label>
                          <select
                            value={profileForm.roleId}
                            onChange={e => handleRoleChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                          >
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.user_type}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Branch</label>
                          <input
                            type="text"
                            value={profileForm.branch}
                            onChange={e => setProfileForm(p => ({ ...p, branch: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Employee ID</label>
                          <input
                            type="text"
                            value={profileForm.employeeId}
                            onChange={e => setProfileForm(p => ({ ...p, employeeId: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Designation</label>
                          <input
                            type="text"
                            value={profileForm.designation}
                            onChange={e => setProfileForm(p => ({ ...p, designation: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 my-4"></div>

                    {/* Account Info */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-violet-655 uppercase tracking-wider">Account Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Account Status</label>
                          <select
                            value={profileForm.status}
                            onChange={e => setProfileForm(p => ({ ...p, status: e.target.value as any }))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                          >
                            <option value="Active">Active</option>
                            <option value="Disabled">Disabled</option>
                            <option value="Locked">Locked</option>
                            <option value="Suspended">Suspended</option>
                            <option value="Deleted">Deleted</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Created On</label>
                          <input
                            type="text"
                            disabled
                            value={new Date(selectedUser.created_at).toLocaleDateString()}
                            className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Last Login Session</label>
                          <input
                            type="text"
                            disabled
                            value={selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}
                            className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-black uppercase">Last Password Changed</label>
                          <input
                            type="text"
                            disabled
                            value={selectedUser.last_password_change ? new Date(selectedUser.last_password_change).toLocaleString() : 'Never'}
                            className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-400 text-xs cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* PERMISSIONS CONFIG TAB */}
                {activeTab === 'permissions' && (
                  <div className="max-w-2xl space-y-6">
                    
                    {/* Presets Control Header */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="text-xs font-black text-slate-650 uppercase tracking-wider">Permission Presets</div>
                      <div className="flex flex-wrap gap-2">
                        {['Administrator', 'Manager', 'Cashier', 'Collection Agent', 'Operator'].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleApplyPreset(preset)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition shadow-sm"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Accordion List of Groups */}
                    <div className="space-y-2">
                      {PERMISSION_GROUPS.map(g => {
                        const isExpanded = expandedGroup === g.name;
                        return (
                          <div key={g.name} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/20">
                            <button
                              type="button"
                              onClick={() => setExpandedGroup(isExpanded ? null : g.name)}
                              className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-150 flex items-center justify-between transition text-xs font-black uppercase tracking-wider border-b border-slate-200 text-slate-705"
                            >
                              <span>{g.name}</span>
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-505" /> : <ChevronRight className="w-4 h-4 text-slate-505" />}
                            </button>

                            {isExpanded && (
                              <div className="p-4 divide-y divide-slate-200 space-y-3 bg-white">
                                {g.features.map(f => {
                                  const isChecked = selectedPerms.has(f.key);
                                  return (
                                    <div key={f.key} className="pt-2 flex items-center justify-between">
                                      <span className="text-xs text-slate-700 font-bold">{f.label}</span>
                                      <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => togglePerm(f.key)}
                                          className="w-4 h-4 accent-violet-650 rounded border-slate-300"
                                        />
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}

                {/* USER ACTIVITY TAB */}
                {activeTab === 'activity' && (
                  <div className="max-w-2xl space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-slate-55 border border-slate-200 rounded-xl text-center">
                        <div className="text-[10px] text-slate-500 font-black uppercase">Login Count</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">{selectedUser.login_count}</div>
                      </div>
                      <div className="p-3 bg-slate-55 border border-slate-200 rounded-xl text-center">
                        <div className="text-[10px] text-slate-505 font-black uppercase">Failed Attempts</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">{selectedUser.failed_login_attempts}</div>
                      </div>
                      <div className="col-span-2 p-3 bg-slate-55 border border-slate-200 rounded-xl text-center">
                        <div className="text-[10px] text-slate-505 font-black uppercase">Last Active Date</div>
                        <div className="text-xs font-bold text-slate-800 mt-1.5">{selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}</div>
                      </div>
                    </div>

                    {tabLoading ? (
                      <div className="text-center text-slate-400 py-6 text-xs">Loading activity logs...</div>
                    ) : activities.length === 0 ? (
                      <div className="text-center text-slate-500 py-6 text-xs">No activity logged yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {activities.map(a => (
                          <div key={a.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex justify-between gap-4 shadow-sm">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-800">{a.activity_type}</span>
                              <p className="text-slate-555">{a.description}</p>
                            </div>
                            <span className="text-slate-400 shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* LOGIN HISTORY TAB */}
                {activeTab === 'login_history' && (
                  <div className="max-w-2xl">
                    {tabLoading ? (
                      <div className="text-center text-slate-450 py-6 text-xs">Loading session history...</div>
                    ) : loginHistory.length === 0 ? (
                      <div className="text-center text-slate-450 py-6 text-xs">No login history recorded.</div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-505 border-b border-slate-200 uppercase tracking-wider font-black">
                              <th className="p-3">Date / Time</th>
                              <th className="p-3">IP Address</th>
                              <th className="p-3">Device / Browser</th>
                              <th className="p-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150">
                            {loginHistory.map(lh => (
                              <tr key={lh.id} className="hover:bg-slate-50/50">
                                <td className="p-3 text-slate-800 font-semibold">{new Date(lh.login_time).toLocaleString()}</td>
                                <td className="p-3 font-mono text-slate-600">{lh.ip_address || '-'}</td>
                                <td className="p-3 text-slate-500 truncate max-w-[200px]" title={lh.browser || ''}>
                                  {lh.os || 'Unknown'} / {lh.browser || 'Unknown'}
                                </td>
                                <td className="p-3 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                    lh.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100/80 text-red-700'
                                  }`}>
                                    {lh.success ? 'Success' : 'Failed'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* AUDIT HISTORY TAB */}
                {activeTab === 'audit' && (
                  <div className="max-w-xl">
                    {tabLoading ? (
                      <div className="text-center text-slate-450 py-6 text-xs">Loading audit events...</div>
                    ) : auditLogs.length === 0 ? (
                      <div className="text-center text-slate-450 py-6 text-xs">No administrative changes log.</div>
                    ) : (
                      <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                        {auditLogs.map(log => (
                          <div key={log.id} className="relative space-y-1.5">
                            <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-violet-650 border-2 border-white shadow-sm" />
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span className="font-bold text-slate-500">
                                {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                              <span>By {log.changed_by}</span>
                            </div>
                            <div className="text-xs text-slate-800">
                              Updated <span className="font-mono text-violet-750 font-bold">{log.field}</span>
                              {log.old_value && <span> from &quot;{log.old_value}&quot; to &quot;{log.new_value}&quot;</span>}
                            </div>
                            {log.reason && (
                              <p className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                Reason: {log.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Please select a user to view profile settings
            </div>
          )}
        </div>

      </div>

      {/* CREATE NEW USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="font-black text-slate-800 text-xs uppercase tracking-wider">Create New Account</span>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Username *</label>
                  <input
                    type="text"
                    required
                    value={cForm.username}
                    onChange={e => setCForm(p => ({ ...p, username: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                  {cErrors.username && <span className="text-[9px] text-red-500 block">{cErrors.username}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Password *</label>
                  <input
                    type="password"
                    required
                    value={cForm.password}
                    onChange={e => setCForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                  {cErrors.password && <span className="text-[9px] text-red-500 block">{cErrors.password}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Full Name</label>
                  <input
                    type="text"
                    value={cForm.fullName}
                    onChange={e => setCForm(p => ({ ...p, fullName: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Role *</label>
                  <select
                    value={cForm.roleId}
                    onChange={e => setCForm(p => ({ ...p, roleId: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Select Role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.user_type}</option>
                    ))}
                  </select>
                  {cErrors.roleId && <span className="text-[9px] text-red-500 block">{cErrors.roleId}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Email</label>
                  <input
                    type="email"
                    value={cForm.email}
                    onChange={e => setCForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Phone</label>
                  <input
                    type="text"
                    value={cForm.phone}
                    onChange={e => setCForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Branch</label>
                  <input
                    type="text"
                    value={cForm.branch}
                    onChange={e => setCForm(p => ({ ...p, branch: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Employee ID</label>
                  <input
                    type="text"
                    value={cForm.employeeId}
                    onChange={e => setCForm(p => ({ ...p, employeeId: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] text-slate-505 font-black uppercase">Designation</label>
                  <input
                    type="text"
                    value={cForm.designation}
                    onChange={e => setCForm(p => ({ ...p, designation: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cSaving}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-755 text-white rounded-lg text-xs font-bold transition"
                >
                  {cSaving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERRIDE JUSTIFICATION OVERLAY MODAL */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4 text-slate-850 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-600 font-black border-b border-slate-200 pb-2 text-xs uppercase tracking-wider">
              <AlertCircle className="w-5 h-5" />
              <span>Audit Override Warning</span>
            </div>
            
            <p className="text-xs text-slate-500">
              Administrative action requires a justification log entry. Specify override justification.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-black">Justification Reason *</label>
              <textarea
                rows={3}
                placeholder="Specify administrative change reason..."
                value={auditReason}
                onChange={e => setAuditReason(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowReasonModal(false)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-55 text-slate-600 rounded-lg transition"
              >
                Abort
              </button>
              <button
                onClick={handleConfirmReason}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-755 text-white rounded-lg font-black uppercase tracking-wider transition"
              >
                Confirm override
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
