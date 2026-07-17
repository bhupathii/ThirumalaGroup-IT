import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { rawSupabase } from '../../lib/supabase';
import {
  Shield, UserPlus, Search, Save, Key, Eye, EyeOff,
  X, ChevronDown, ChevronUp, Users, Activity, FileText,
  AlertCircle, CheckCircle, XCircle, Lock, User,
  Copy, RefreshCw
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
  is_active: boolean;
  userType: string;
  userTypeId: string;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  old_values: any;
  new_values: any;
  edited_by: string;
  created_at: string;
}

// permissionMap[userId][featureKey] = ['view','edit','approve', ...]
type PermissionMap = Record<string, Record<string, string[]>>;

// ─── Permission Model ─────────────────────────────────────────────────────────

const PERMISSION_TYPES: Record<string, { key: string; label: string; color: string }[]> = {
  entries: [
    { key: 'view',   label: 'View',   color: 'blue' },
    { key: 'create', label: 'Create', color: 'emerald' },
    { key: 'edit',   label: 'Edit',   color: 'amber' },
    { key: 'delete', label: 'Delete', color: 'red' },
  ],
  ledgers: [
    { key: 'view',    label: 'View',    color: 'blue' },
    { key: 'edit',    label: 'Edit',    color: 'amber' },
    { key: 'approve', label: 'Approve', color: 'violet' },
    { key: 'print',   label: 'Print',   color: 'slate' },
  ],
  reports: [
    { key: 'view',   label: 'View',   color: 'blue' },
    { key: 'print',  label: 'Print',  color: 'slate' },
    { key: 'export', label: 'Export', color: 'emerald' },
  ],
  admin: [
    { key: 'view',   label: 'View',   color: 'blue' },
    { key: 'manage', label: 'Manage', color: 'violet' },
  ],
};

const PTYPE_COLORS: Record<string, string> = {
  blue:    'bg-blue-600',
  emerald: 'bg-emerald-600',
  amber:   'bg-amber-500',
  red:     'bg-red-600',
  violet:  'bg-violet-600',
  slate:   'bg-slate-600',
};

const PTYPE_LIGHT: Record<string, string> = {
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
};

const PERMISSION_GROUPS: {
  name: string;
  icon: string;
  typeGroup: keyof typeof PERMISSION_TYPES;
  features: { key: string; label: string }[];
}[] = [
  {
    name: 'Entries & Operations',
    icon: '📝',
    typeGroup: 'entries',
    features: [
      { key: 'loan_entry', label: 'Loan Entry (New / Edit)' },
      { key: 'new_customers', label: 'Customers Management' },
      { key: 'partners', label: 'Partners Management' },
      { key: 'daybook', label: 'Day Book Ledger' },
      { key: 'capital_entry', label: 'Capital Ledger' },
      { key: 'calculator', label: 'Finance Calculator' },
      { key: 'search', label: 'Global Account Search' },
    ]
  },
  {
    name: 'Ledgers',
    icon: '📒',
    typeGroup: 'ledgers',
    features: [
      { key: 'cd_ledger', label: 'CD Ledger' },
      { key: 'hp_ledger', label: 'HP Ledger' },
      { key: 'stbd_ledger', label: 'STBD Ledger' },
      { key: 'tbd_ledger', label: 'TBD Ledger' },
      { key: 'dues_ledger', label: 'Dues List' },
      { key: 'payment_followup', label: 'Payment Follow-up' },
      { key: 'call_history', label: 'Call History' },
    ]
  },
  {
    name: 'Reports',
    icon: '📊',
    typeGroup: 'reports',
    features: [
      { key: 'daily_report', label: 'Daily Report' },
      { key: 'detailed_ledger', label: 'Detailed Ledger' },
      { key: 'general_ledger', label: 'General Ledger' },
      { key: 'pl', label: 'P&L / Balance Sheet' },
      { key: 'final_statement', label: 'Final Statement' },
      { key: 'business_report', label: 'Business Details' },
      { key: 'partner_performance', label: 'Partner Performance' },
    ]
  },
  {
    name: 'Administration',
    icon: '⚙️',
    typeGroup: 'admin',
    features: [
      { key: 'logs', label: 'Edited & Deleted Logs' },
      { key: 'transaction_approval', label: 'Transaction Approval' },
      { key: 'user_access_management', label: 'User Access Management' },
      { key: 'ledger_settings', label: 'Ledger Settings' },
      { key: 'aadhaar_search', label: 'Aadhaar Search' },
      { key: 'phone_editor', label: 'Phone Editor' },
    ]
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStaffName = () => {
  try { return JSON.parse(sessionStorage.getItem('thirumala_user') || '{}').username || 'Admin'; }
  catch { return 'Admin'; }
};

const getInitials = (name: string | null, username: string) => {
  const n = (name || username).trim();
  const parts = n.split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = ['bg-violet-600','bg-blue-600','bg-emerald-600','bg-orange-600','bg-rose-600','bg-cyan-600','bg-amber-600','bg-indigo-600'];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
    {active ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
    {active ? 'Active' : 'Disabled'}
  </span>
);

// Count total permissions a user has
const countPerms = (userPerms: Record<string, string[]>) =>
  Object.values(userPerms).reduce((s, arr) => s + arr.length, 0);

// ─── Main Component ───────────────────────────────────────────────────────────

const UserAccessManagement: React.FC = () => {
  // Data
  const [users, setUsers]               = useState<UserItem[]>([]);
  const [roles, setRoles]               = useState<UserRole[]>([]);
  const [permMap, setPermMap]           = useState<PermissionMap>({});
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);

  // Selection
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<'profile'|'permissions'|'activity'|'audit'>('profile');

  // Filters
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL'|'active'|'disabled'>('active');
  const [sortBy, setSortBy]             = useState<'az'|'za'|'newest'|'oldest'>('az');
  const searchTimeout                   = useRef<ReturnType<typeof setTimeout>>();

  // Profile edit
  const [editActive, setEditActive]     = useState(true);
  const [editRoleId, setEditRoleId]     = useState('');
  const [newPwd, setNewPwd]             = useState('');
  const [showPwd, setShowPwd]           = useState(false);
  const [saving, setSaving]             = useState(false);

  // Permissions panel state: selectedPerms[featureKey] = Set of permission_types
  const [selectedPerms, setSelectedPerms] = useState<Record<string, Set<string>>>({});
  const [permSearch, setPermSearch]       = useState('');
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({
    'Entries & Operations': true, 'Ledgers': true, 'Reports': true, 'Administration': false
  });

  // Activity / Audit
  const [activityStats, setActivityStats] = useState<Record<string, number> | null>(null);
  const [auditLogs, setAuditLogs]         = useState<AuditLogEntry[]>([]);
  const [tabLoading, setTabLoading]       = useState(false);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [cUser, setCUser]   = useState('');
  const [cPwd, setCPwd]     = useState('');
  const [cRole, setCRole]   = useState('');
  const [cOn, setCOn]       = useState(true);
  const [cShowPwd, setCShowPwd] = useState(false);
  const [cSaving, setCsaving]   = useState(false);
  const [cErr, setCErr]         = useState<Record<string,string>>({});

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Roles
      const { data: roleRows, error: roleErr } = await rawSupabase
        .schema('public').from('user_types').select('id, user_type').order('user_type');
      if (roleErr) throw new Error(`Roles: ${roleErr.message}`);
      const loadedRoles = (roleRows || []) as UserRole[];
      setRoles(loadedRoles);
      if (loadedRoles.length && !cRole) setCRole(loadedRoles[0].id);

      // Users
      const { data: dbUsers, error: usersErr } = await rawSupabase
        .schema('public')
        .from('users')
        .select('id, username, is_active, created_at, user_type_id, user_types(user_type)')
        .order('username');
      if (usersErr) throw new Error(`Users: ${usersErr.message}`);

      const formatted: UserItem[] = (dbUsers || []).map((u: any) => ({
        id: u.id, username: u.username, full_name: null,
        phone: null, email: null,
        is_active: u.is_active !== false,
        userType: u.user_types?.user_type || 'Operator',
        userTypeId: u.user_type_id || '',
        created_at: u.created_at,
      }));
      setUsers(formatted);

      // Permissions — query public.user_permissions directly
      const { data: permRows, error: permErr } = await rawSupabase
        .schema('public')
        .from('user_permissions')
        .select('user_id, feature_key, permission_type');

      if (permErr) {
        console.warn('[UAM] Permissions load warning (non-fatal):', permErr.message);
      }

      // Build map: permMap[userId][featureKey] = string[]
      const map: PermissionMap = {};
      (permRows || []).forEach((row: any) => {
        if (!map[row.user_id]) map[row.user_id] = {};
        if (!map[row.user_id][row.feature_key]) map[row.user_id][row.feature_key] = [];
        const pt = row.permission_type || 'view';
        if (!map[row.user_id][row.feature_key].includes(pt)) {
          map[row.user_id][row.feature_key].push(pt);
        }
      });
      setPermMap(map);

      // Auto-select first active user
      const first = formatted.find(u => u.is_active) || formatted[0];
      if (first) hydrateUser(first, map, loadedRoles);

    } catch (err: any) {
      console.error('[UAM] Load error:', err);
      setLoadError(err.message || 'Failed to load');
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const hydrateUser = (u: UserItem, map = permMap, loadedRoles = roles) => {
    setSelectedId(u.id);
    setEditActive(u.is_active);
    setEditRoleId(loadedRoles.find(r => r.id === u.userTypeId)?.id || loadedRoles[0]?.id || '');
    setNewPwd('');
    // Convert permMap to selectedPerms Sets
    const userPerms = map[u.id] || {};
    const sets: Record<string, Set<string>> = {};
    for (const [fk, types] of Object.entries(userPerms)) {
      sets[fk] = new Set(types);
    }
    setSelectedPerms(sets);
    setActiveTab('profile');
  };

  // ── Lazy tab loads ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    if (activeTab === 'activity') loadActivity(selectedId);
    if (activeTab === 'audit') loadAudit(selectedId);
  }, [activeTab, selectedId]);

  const loadActivity = async (uid: string) => {
    setTabLoading(true);
    try {
      const u = users.find(x => x.id === uid);
      const { data } = await rawSupabase.schema('finance').from('edited_logs')
        .select('table_name').eq('edited_by', u?.username || '');
      const rows = data || [];
      setActivityStats({
        'Loans Created':    rows.filter(r => r.table_name === 'loans').length,
        'Payments Entered': rows.filter(r => r.table_name === 'cd_ledger_entries' || r.table_name === 'loan_transactions').length,
        'Edits Made':       rows.length,
        'Reports Accessed': rows.filter(r => r.table_name === 'print_log').length,
      });
    } catch { setActivityStats({}); }
    setTabLoading(false);
  };

  const loadAudit = async (uid: string) => {
    setTabLoading(true);
    try {
      const { data } = await rawSupabase.schema('finance').from('edited_logs')
        .select('id, table_name, record_id, old_values, new_values, edited_by, created_at')
        .eq('record_id', uid).in('table_name', ['users','user_permissions'])
        .order('created_at', { ascending: false }).limit(50);
      setAuditLogs(data || []);
    } catch { setAuditLogs([]); }
    setTabLoading(false);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (statusFilter === 'active') list = list.filter(u => u.is_active);
    if (statusFilter === 'disabled') list = list.filter(u => !u.is_active);
    if (roleFilter !== 'ALL') list = list.filter(u => u.userType === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'az') return a.username.localeCompare(b.username);
      if (sortBy === 'za') return b.username.localeCompare(a.username);
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return list;
  }, [users, search, roleFilter, statusFilter, sortBy]);

  const selectedUser = users.find(u => u.id === selectedId);

  // ── Audit helper ──────────────────────────────────────────────────────────

  const writeLog = async (recordId: string, table: string, oldV: any, newV: any) => {
    try {
      await rawSupabase.schema('finance').from('edited_logs').insert([{
        table_name: table, record_id: recordId, old_values: oldV, new_values: newV, edited_by: getStaffName()
      }]);
    } catch (e) { console.warn('[UAM] audit write failed:', e); }
  };

  // ── Save profile ──────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!selectedId || !selectedUser) return;
    setSaving(true);
    try {
      const updates: any = {};
      const oldV: any = {};
      const newV: any = {};
      if (editActive !== selectedUser.is_active) {
        updates.is_active = editActive; oldV.is_active = selectedUser.is_active; newV.is_active = editActive;
      }
      if (editRoleId && editRoleId !== selectedUser.userTypeId) {
        updates.user_type_id = editRoleId;
        oldV.role = selectedUser.userType;
        newV.role = roles.find(r => r.id === editRoleId)?.user_type;
      }
      if (newPwd.trim()) {
        if (newPwd.trim().length < 6) { toast.error('Password must be at least 6 characters'); return; }
        updates.password_hash = await bcrypt.hash(newPwd.trim(), 10);
        newV.password_changed = true;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await rawSupabase.schema('public').from('users')
          .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', selectedId);
        if (error) throw new Error(error.message);
        await writeLog(selectedId, 'users', oldV, newV);
      }
      toast.success('Profile saved');
      setNewPwd('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  // ── Toggle disable ────────────────────────────────────────────────────────

  const handleToggleStatus = async () => {
    if (!selectedId || !selectedUser) return;
    const next = !selectedUser.is_active;
    setSaving(true);
    try {
      const { error } = await rawSupabase.schema('public').from('users')
        .update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', selectedId);
      if (error) throw new Error(error.message);
      await writeLog(selectedId, 'users', { is_active: selectedUser.is_active }, { is_active: next });
      toast.success(next ? 'User activated' : 'User disabled');
      setEditActive(next);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally { setSaving(false); }
  };

  // ── Save permissions ──────────────────────────────────────────────────────

  const handleSavePermissions = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const oldPerms = permMap[selectedId] || {};

      // Delete all existing
      const { error: delErr } = await rawSupabase.schema('public').from('user_permissions')
        .delete().eq('user_id', selectedId);
      if (delErr) throw new Error(delErr.message);

      // Build insert rows from selectedPerms
      const rows: any[] = [];
      for (const [featureKey, typeSet] of Object.entries(selectedPerms)) {
        for (const pt of typeSet) {
          rows.push({ user_id: selectedId, feature_key: featureKey, permission_type: pt });
        }
      }

      if (rows.length > 0) {
        const { error: insErr } = await rawSupabase.schema('public').from('user_permissions').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      // Rebuild new map entry
      const newEntry: Record<string, string[]> = {};
      for (const [fk, typeSet] of Object.entries(selectedPerms)) {
        if (typeSet.size > 0) newEntry[fk] = Array.from(typeSet);
      }

      await writeLog(selectedId, 'user_permissions',
        { permissions: Object.entries(oldPerms).map(([k,v]) => `${k}:${v.join(',')}`) },
        { permissions: Object.entries(newEntry).map(([k,v]) => `${k}:${v.join(',')}`) }
      );

      setPermMap(prev => ({ ...prev, [selectedId]: newEntry }));
      toast.success(`Permissions saved (${rows.length} entries)`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permissions');
    } finally { setSaving(false); }
  };

  // ── Permission helpers ────────────────────────────────────────────────────

  const togglePerm = (featureKey: string, pt: string) => {
    setSelectedPerms(prev => {
      const next = { ...prev };
      if (!next[featureKey]) next[featureKey] = new Set();
      else next[featureKey] = new Set(next[featureKey]);
      if (next[featureKey].has(pt)) next[featureKey].delete(pt);
      else next[featureKey].add(pt);
      return next;
    });
  };

  const grantAll = () => {
    const next: Record<string, Set<string>> = {};
    PERMISSION_GROUPS.forEach(g => {
      const types = PERMISSION_TYPES[g.typeGroup].map(t => t.key);
      g.features.forEach(f => { next[f.key] = new Set(types); });
    });
    setSelectedPerms(next);
  };

  const viewOnly = () => {
    const next: Record<string, Set<string>> = {};
    PERMISSION_GROUPS.forEach(g => {
      g.features.forEach(f => { next[f.key] = new Set(['view']); });
    });
    setSelectedPerms(next);
  };

  const clearAll = () => setSelectedPerms({});

  const copyFromUser = () => {
    const name = prompt('Enter username to copy permissions from:');
    if (!name) return;
    const target = users.find(u => u.username.toLowerCase() === name.toLowerCase() && u.id !== selectedId);
    if (!target) { toast.error('User not found'); return; }
    const sourcePerms = permMap[target.id] || {};
    const next: Record<string, Set<string>> = {};
    Object.entries(sourcePerms).forEach(([fk, types]) => { next[fk] = new Set(types); });
    setSelectedPerms(next);
    const total = Object.values(next).reduce((s, set) => s + set.size, 0);
    toast.success(`Copied ${total} permissions from ${target.username}`);
  };

  const totalSelectedPerms = Object.values(selectedPerms).reduce((s, set) => s + set.size, 0);

  // ── Create user ───────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!cUser.trim()) errs.username = 'Required';
    else if (users.some(u => u.username.toLowerCase() === cUser.trim().toLowerCase())) errs.username = 'Already exists';
    if (!cPwd.trim()) errs.password = 'Required';
    else if (cPwd.trim().length < 6) errs.password = 'Min 6 characters';
    if (!cRole) errs.role = 'Required';
    setCErr(errs);
    if (Object.keys(errs).length) return;

    setCsaving(true);
    try {
      const hash = await bcrypt.hash(cPwd.trim(), 10);
      const { data: newU, error: createErr } = await rawSupabase.schema('public').from('users')
        .insert([{
          username: cUser.trim(), password_hash: hash, user_type_id: cRole,
          is_active: cOn
        }]).select().single();
      if (createErr) throw new Error(createErr.message);
      await writeLog(newU.id, 'users', {}, { username: cUser.trim(), role_id: cRole, is_active: cOn });
      toast.success(`User "${cUser}" created`);
      setShowModal(false);
      setCUser(''); setCPwd('');
      setCRole(roles[0]?.id || ''); setCOn(true); setCErr({});
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create');
    } finally { setCsaving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-50 font-outfit select-none">

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-wider">User Access Management</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Profiles · Roles · Module Permissions
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Create User
        </button>
      </div>

      {/* Error */}
      {loadError && !loading && (
        <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Failed to load</p>
            <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
            <button onClick={loadAll} className="mt-2 text-xs font-bold text-red-700 underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading users...</p>
          </div>
        </div>
      )}

      {/* Main Panel */}
      {!loading && !loadError && (
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: User List ── */}
          <div className="w-72 shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="p-3 space-y-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  onChange={e => { clearTimeout(searchTimeout.current); const v = e.target.value; searchTimeout.current = setTimeout(() => setSearch(v), 250); }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
              <div className="flex gap-2">
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none uppercase">
                  <option value="ALL">All Roles</option>
                  {roles.map(r => <option key={r.id} value={r.user_type}>{r.user_type}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                  className="flex-1 px-2 py-1.5 text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none uppercase">
                  <option value="ALL">All</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{filteredUsers.length} users</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                  className="text-[9px] font-bold bg-transparent border-none focus:outline-none text-slate-500 uppercase cursor-pointer">
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {/* User cards */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 custom-scrollbar">
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">No users found</p>
                </div>
              )}
              {filteredUsers.map(u => {
                const sel = u.id === selectedId;
                const uPerms = permMap[u.id] || {};
                const total = countPerms(uPerms);
                return (
                  <div key={u.id} onClick={() => hydrateUser(u)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all ${sel ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-150 hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 ${sel ? 'bg-white/20' : avatarColor(u.id)}`}>
                        {getInitials(u.full_name, u.username)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-bold truncate ${sel ? 'text-white' : 'text-slate-900'}`}>
                          {u.full_name || u.username}
                        </p>
                        <p className={`text-[10px] font-mono ${sel ? 'text-slate-400' : 'text-slate-500'}`}>@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <StatusBadge active={u.is_active} />
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${sel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {u.userType}
                      </span>
                      {total > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${sel ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                          {total} perms
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Details ── */}
          {selectedUser ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* User banner */}
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm ${avatarColor(selectedUser.id)}`}>
                    {getInitials(selectedUser.full_name, selectedUser.username)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900">{selectedUser.full_name || selectedUser.username}</span>
                      <StatusBadge active={selectedUser.is_active} />
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 text-slate-600">{selectedUser.userType}</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">@{selectedUser.username}</p>
                  </div>
                </div>
                <button
                  onClick={handleToggleStatus}
                  disabled={saving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors border ${
                    selectedUser.is_active
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                  }`}
                >
                  {selectedUser.is_active ? <><Lock className="w-3 h-3" />Disable</> : <><CheckCircle className="w-3 h-3" />Activate</>}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 bg-white shrink-0 px-6 overflow-x-auto">
                {[
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'permissions', label: 'Permissions', icon: Shield },
                  { id: 'activity', label: 'Activity', icon: Activity },
                  { id: 'audit', label: 'Audit Log', icon: FileText },
                ].map(tab => {
                  const Ic = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
                      }`}>
                      <Ic className="w-3.5 h-3.5" /> {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                {/* ─── Profile ─── */}
                {activeTab === 'profile' && (
                  <div className="max-w-2xl space-y-5">


                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Account Settings</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Role</label>
                          <select value={editRoleId} onChange={e => setEditRoleId(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 h-9 font-bold">
                            {roles.map(r => <option key={r.id} value={r.id}>{r.user_type}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Status</label>
                          <select value={editActive ? 'true' : 'false'} onChange={e => setEditActive(e.target.value === 'true')}
                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 h-9 font-bold">
                            <option value="true">Active</option>
                            <option value="false">Disabled</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                            <Key className="w-3 h-3" /> Reset Password
                          </label>
                          <div className="relative">
                            <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                              className="w-full px-3 py-2 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                              placeholder="Leave blank to keep current password" />
                            <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-3 top-2.5 text-slate-400">
                              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Created On</p>
                          <p className="font-bold text-slate-800">{new Date(selectedUser.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">User ID</p>
                          <p className="font-mono text-slate-400 text-[9px] break-all">{selectedUser.id}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button onClick={handleSaveProfile} disabled={saving}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase disabled:opacity-50 transition-colors">
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Permissions ─── */}
                {activeTab === 'permissions' && (
                  <div className="max-w-4xl space-y-4">
                    {/* Toolbar */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center justify-between">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" placeholder="Search modules..." value={permSearch} onChange={e => setPermSearch(e.target.value)}
                          className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none w-48" />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase">
                        <button onClick={grantAll} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors">Grant All</button>
                        <button onClick={viewOnly} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg transition-colors">View Only</button>
                        <button onClick={clearAll} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors">Clear All</button>
                        <button onClick={copyFromUser} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copy From
                        </button>
                        <span className="text-slate-400 font-mono">{totalSelectedPerms} perms</span>
                      </div>
                    </div>

                    {/* Permission Groups */}
                    {PERMISSION_GROUPS.map(group => {
                      const types = PERMISSION_TYPES[group.typeGroup];
                      const filtered = group.features.filter(f =>
                        !permSearch || f.label.toLowerCase().includes(permSearch.toLowerCase())
                      );
                      if (filtered.length === 0) return null;
                      const isOpen = expanded[group.name] !== false;
                      return (
                        <div key={group.name} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          {/* Group header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <button onClick={() => setExpanded(p => ({ ...p, [group.name]: !isOpen }))}
                              className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-800">
                              <span>{group.icon}</span> {group.name}
                              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            {/* Type legend */}
                            <div className="flex items-center gap-1.5">
                              {types.map(t => (
                                <span key={t.key} className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${PTYPE_LIGHT[t.color]}`}>
                                  {t.label}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Grid */}
                          {isOpen && (
                            <div className="p-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr>
                                    <th className="text-left text-[9px] font-extrabold uppercase text-slate-400 pb-2 w-1/3">Module</th>
                                    {types.map(t => (
                                      <th key={t.key} className="text-center text-[9px] font-extrabold uppercase pb-2 w-16">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] border ${PTYPE_LIGHT[t.color]}`}>{t.label}</span>
                                      </th>
                                    ))}
                                    <th className="text-right text-[9px] font-extrabold uppercase text-slate-400 pb-2">All</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {filtered.map(feat => {
                                    const featureSet = selectedPerms[feat.key] || new Set<string>();
                                    const allOn = types.every(t => featureSet.has(t.key));
                                    return (
                                      <tr key={feat.key} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2 font-bold text-slate-700 text-[11px]">{feat.label}</td>
                                        {types.map(t => {
                                          const on = featureSet.has(t.key);
                                          return (
                                            <td key={t.key} className="text-center py-2">
                                              <button onClick={() => togglePerm(feat.key, t.key)}
                                                className={`w-6 h-6 rounded border-2 mx-auto flex items-center justify-center transition-all ${
                                                  on ? `${PTYPE_COLORS[t.color]} border-transparent` : 'bg-white border-slate-200 hover:border-slate-400'
                                                }`}>
                                                {on && <span className="text-white text-[10px] font-black">✓</span>}
                                              </button>
                                            </td>
                                          );
                                        })}
                                        <td className="text-right py-2">
                                          <button onClick={() => {
                                            if (allOn) {
                                              setSelectedPerms(p => ({ ...p, [feat.key]: new Set() }));
                                            } else {
                                              setSelectedPerms(p => ({ ...p, [feat.key]: new Set(types.map(t => t.key)) }));
                                            }
                                          }}
                                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border transition-colors ${
                                              allOn ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                            }`}>
                                            {allOn ? 'All ✓' : 'All'}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex justify-end pt-2">
                      <button onClick={handleSavePermissions} disabled={saving}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase disabled:opacity-50 transition-colors">
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Saving...' : `Save Permissions (${totalSelectedPerms})`}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Activity ─── */}
                {activeTab === 'activity' && (
                  <div className="max-w-xl">
                    {tabLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                      </div>
                    ) : activityStats && Object.keys(activityStats).length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(activityStats).map(([label, value]) => {
                          const icons: Record<string, string> = { 'Loans Created': '📋', 'Payments Entered': '💳', 'Edits Made': '✏️', 'Reports Accessed': '🖨️' };
                          return (
                            <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5">
                              <div className="text-2xl mb-2">{icons[label] || '📌'}</div>
                              <p className="text-3xl font-black text-slate-900">{value}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{label}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">No activity data available</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Audit Log ─── */}
                {activeTab === 'audit' && (
                  <div className="max-w-3xl">
                    {tabLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="text-center py-16">
                        <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">No audit logs found</p>
                        <p className="text-xs text-slate-300 mt-1">Profile and permission changes appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {auditLogs.map(log => (
                          <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-extrabold uppercase">{log.table_name}</span>
                                <span className="text-[10px] font-bold text-slate-500">by <span className="text-slate-700">{log.edited_by}</span></span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(log.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {log.new_values && Object.keys(log.new_values).length > 0 && (
                              <div className="bg-slate-50 rounded-lg p-2.5 font-mono text-[10px] space-y-0.5">
                                {Object.entries(log.new_values).map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <span className="text-slate-400 font-bold min-w-[80px]">{k}:</span>
                                    <span className="text-slate-700 truncate">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
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
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">Select a user from the list</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create User Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold uppercase text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Create New User
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Username *</label>
                <input type="text" value={cUser} onChange={e => setCUser(e.target.value)}
                  className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-lg focus:outline-none h-9 ${cErr.username ? 'border-red-400' : 'border-slate-200'}`}
                  placeholder="Unique login username" />
                {cErr.username && <p className="text-[10px] text-red-600 mt-0.5 font-bold">{cErr.username}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Password *</label>
                <div className="relative">
                  <input type={cShowPwd ? 'text' : 'password'} value={cPwd} onChange={e => setCPwd(e.target.value)}
                    className={`w-full px-3 py-2 pr-10 text-sm bg-slate-50 border rounded-lg focus:outline-none h-9 ${cErr.password ? 'border-red-400' : 'border-slate-200'}`}
                    placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setCShowPwd(p => !p)} className="absolute right-3 top-2.5 text-slate-400">
                    {cShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {cErr.password && <p className="text-[10px] text-red-600 mt-0.5 font-bold">{cErr.password}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Role *</label>
                  <select value={cRole} onChange={e => setCRole(e.target.value)}
                    className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-none h-9 font-bold ${cErr.role ? 'border-red-400' : 'border-slate-200'}`}>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.user_type}</option>)}
                  </select>
                  {cErr.role && <p className="text-[10px] text-red-600 mt-0.5 font-bold">{cErr.role}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Status</label>
                  <select value={cOn ? 'true' : 'false'} onChange={e => setCOn(e.target.value === 'true')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none h-9 font-bold">
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={cSaving}
                  className="px-5 py-2 text-xs font-bold uppercase bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                  {cSaving
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
                    : <><UserPlus className="w-3.5 h-3.5" />Create User</>
                  }
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
