import React, { useState, useEffect, useMemo } from 'react';
import { supabaseDB, User } from '../lib/supabaseDatabase';
import { supabaseFinance, FinanceEditedLog, FinanceDeletedLog } from '../lib/supabaseFinance';
import { useTableMode } from '../contexts/TableModeContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { RefreshCw, Search, Printer, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string;
  eventType: 'EDIT' | 'DELETE';
  dateStr: string;   // YYYY-MM-DD
  timeStr: string;   // hh:mm AM/PM
  rawTimestamp: string;
  operator: string;
  module: string;
  tableName: string;
  loanNo: string;
  customer: string;
  fieldChanges: Array<{ field: string; before: string; after: string }>;
  deletedSnapshot?: Record<string, any>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IGNORED_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at',
  'fingerprint_url', 'fingerprint_template', 'fingerprint_added',
  'customer_fingerprint_template', 'customer_fingerprint_image_url',
  'customer_fingerprint_added', 'surety_fingerprint_template',
  'surety_fingerprint_image_url', 'surety_fingerprint_added',
  'photo_url', 'customer_photo_url', 'surety_photo_url',
  'fingerprint_status', 'fingerprint_id',
]);

function diffObjects(
  oldObj: Record<string, any>,
  newObj: Record<string, any>
): Array<{ field: string; before: string; after: string }> {
  const diffs: Array<{ field: string; before: string; after: string }> = [];
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  for (const k of keys) {
    if (IGNORED_KEYS.has(k)) continue;
    const before = oldObj[k] != null ? String(oldObj[k]).trim() : '';
    const after  = newObj[k] != null ? String(newObj[k]).trim() : '';
    if (before !== after) {
      diffs.push({ field: k, before: before || '—', after: after || '—' });
    }
  }
  return diffs;
}

function parseJson(v: any): Record<string, any> {
  if (!v) return {};
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return v;
}

function toTimeParts(iso: string): { dateStr: string; timeStr: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { dateStr: '', timeStr: '' };
  return {
    dateStr: format(d, 'yyyy-MM-dd'),
    timeStr: format(d, 'hh:mm a'),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const EditedRecords: React.FC = () => {
  const { mode: tableMode } = useTableMode();

  const [loading, setLoading]       = useState(false);
  const [rows, setRows]             = useState<AuditRow[]>([]);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  // Applied filter state
  const [search, setSearch]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [tableF, setTableF]     = useState('');
  const [opF, setOpF]           = useState('');
  const [actionF, setActionF]   = useState('');

  // Temp (pre-Apply) state
  const [tSearch, setTSearch]     = useState('');
  const [tFrom, setTFrom]         = useState('');
  const [tTo, setTTo]             = useState('');
  const [tTable, setTTable]       = useState('');
  const [tOp, setTOp]             = useState('');
  const [tAction, setTAction]     = useState('');

  useEffect(() => { load(); }, [tableMode]);

  // ── Data Loading ─────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const [cbEdits, userList, finEdits, finDels] = await Promise.all([
        supabaseDB.getEditAuditLog().catch(() => []),
        supabaseDB.getUsers().catch(() => []),
        supabaseFinance.getEditedLogs().catch(() => []),
        supabaseFinance.getDeletedLogs().catch(() => []),
      ]);

      // Build user map
      const userMap: Record<string, string> = {};
      (userList as User[]).forEach(u => {
        if (u.id)       userMap[u.id]       = u.username;
        if (u.username) userMap[u.username] = u.username;
      });

      const out: AuditRow[] = [];

      // ── 1. Cash Book Edits (from edit_cash_book) ─────────────────────────
      for (const item of (cbEdits as any[])) {
        if (!item) continue;

        const oldObj = parseJson(item.old_values);
        const newObj = parseJson(item.new_values);

        // Strict: skip if action is CREATE or old_values empty
        if (item.action === 'CREATE') continue;
        if (Object.keys(oldObj).length === 0) continue;

        const isDelete = item.action === 'DELETE' || (!item.new_values && item.old_values);
        const ts = item.edited_at || new Date().toISOString();
        const { dateStr, timeStr } = toTimeParts(ts);

        out.push({
          id: `cb_${item.id}`,
          eventType: isDelete ? 'DELETE' : 'EDIT',
          dateStr,
          timeStr,
          rawTimestamp: ts,
          operator: userMap[item.edited_by] || item.edited_by || 'SYSTEM',
          module: 'Cash Book',
          tableName: 'cash_book',
          loanNo: oldObj.acc_name || newObj.acc_name || oldObj.sub_acc_name || '—',
          customer: oldObj.particulars || newObj.particulars || oldObj.acc_name || '—',
          fieldChanges: isDelete ? [] : diffObjects(oldObj, newObj),
          deletedSnapshot: isDelete ? oldObj : undefined,
        });
      }

      // ── 2. Finance Edits ─────────────────────────────────────────────────
      for (const log of (finEdits as FinanceEditedLog[])) {
        if (!log) continue;
        const oldObj = log.old_values || {};
        const newObj = log.new_values || {};

        // Strict: skip anything that looks like a create event
        if (Object.keys(oldObj).length === 0) continue;
        if ((newObj as any).source === 'RECORD CREATED') continue;

        const ts = log.edited_at || new Date().toISOString();
        const { dateStr, timeStr } = toTimeParts(ts);

        out.push({
          id: `fin_edit_${log.id}`,
          eventType: 'EDIT',
          dateStr,
          timeStr,
          rawTimestamp: ts,
          operator: userMap[log.edited_by] || log.edited_by || 'SYSTEM',
          module: 'Finance',
          tableName: log.table_name || 'finance_loans',
          loanNo: oldObj.loan_no || newObj.loan_no || oldObj.loan_id || newObj.loan_id || '—',
          customer: oldObj.customer_name || newObj.customer_name || oldObj.customer || '—',
          fieldChanges: diffObjects(oldObj, newObj),
        });
      }

      // ── 3. Finance Deletes ───────────────────────────────────────────────
      for (const log of (finDels as FinanceDeletedLog[])) {
        if (!log) continue;
        const oldObj = log.old_values || {};
        const ts = log.deleted_at || new Date().toISOString();
        const { dateStr, timeStr } = toTimeParts(ts);

        out.push({
          id: `fin_del_${log.id}`,
          eventType: 'DELETE',
          dateStr,
          timeStr,
          rawTimestamp: ts,
          operator: userMap[log.deleted_by] || log.deleted_by || 'SYSTEM',
          module: 'Finance',
          tableName: log.table_name || 'finance_loans',
          loanNo: oldObj.loan_no || oldObj.loan_id || '—',
          customer: oldObj.customer_name || oldObj.customer || '—',
          fieldChanges: [],
          deletedSnapshot: oldObj,
        });
      }

      out.sort((a, b) => new Date(b.rawTimestamp).getTime() - new Date(a.rawTimestamp).getTime());
      setRows(out);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────────

  const apply = () => {
    setSearch(tSearch); setFromDate(tFrom); setToDate(tTo);
    setTableF(tTable); setOpF(tOp); setActionF(tAction);
  };

  const reset = () => {
    setTSearch(''); setSearch('');
    setTFrom('');   setFromDate('');
    setTTo('');     setToDate('');
    setTTable('');  setTableF('');
    setTOp('');     setOpF('');
    setTAction(''); setActionF('');
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      if (fromDate  && r.dateStr < fromDate)  return false;
      if (toDate    && r.dateStr > toDate)    return false;
      if (tableF    && r.tableName !== tableF) return false;
      if (opF       && r.operator.toLowerCase() !== opF.toLowerCase()) return false;
      if (actionF   && r.eventType !== actionF) return false;
      if (q) {
        const hit =
          r.loanNo.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q) ||
          r.operator.toLowerCase().includes(q) ||
          r.tableName.toLowerCase().includes(q) ||
          r.fieldChanges.some(f =>
            f.field.toLowerCase().includes(q) ||
            f.before.toLowerCase().includes(q) ||
            f.after.toLowerCase().includes(q)
          ) ||
          (r.deletedSnapshot && Object.entries(r.deletedSnapshot).some(
            ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
          ));
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, search, fromDate, toDate, tableF, opF, actionF]);

  // ── Derived counts ───────────────────────────────────────────────────────

  const editCount   = rows.filter(r => r.eventType === 'EDIT').length;
  const deleteCount = rows.filter(r => r.eventType === 'DELETE').length;

  const uniqueTables  = Array.from(new Set(rows.map(r => r.tableName))).sort();
  const uniqueOps     = Array.from(new Set(rows.map(r => r.operator))).sort();

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Excel export ─────────────────────────────────────────────────────────

  const exportExcel = () => {
    const headers = ['Date','Time','Operator','Module','Table','Loan','Customer','Action','Changes'];
    const csvRows = [
      headers.join(','),
      ...filtered.map(r => [
        r.dateStr, r.timeStr, r.operator, r.module, r.tableName,
        r.loanNo, `"${r.customer}"`,
        r.eventType,
        r.eventType === 'EDIT' ? `${r.fieldChanges.length} Fields Changed` : 'DELETED'
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `audit_log_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between no-print pb-2 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-extrabold text-gray-900 uppercase tracking-widest">
            AUDIT LOGS
          </h1>
          <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
            Edited: {editCount}
          </span>
          <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            Deleted: {deleteCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ═══ FILTER BAR — ONE ROW ════════════════════════════════════════════ */}
      <div className="no-print flex items-end gap-2 flex-wrap">

        {/* Search */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={tSearch}
              onChange={e => setTSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && apply()}
              placeholder="Loan, customer, field..."
              className="pl-7 pr-2 py-1.5 border border-gray-300 rounded text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</label>
          <input
            type="date" value={tFrom} onChange={e => setTFrom(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">To</label>
          <input
            type="date" value={tTo} onChange={e => setTTo(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>

        {/* Table */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Table</label>
          <select
            value={tTable} onChange={e => setTTable(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 min-w-[110px]"
          >
            <option value="">All Tables</option>
            {uniqueTables.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Operator */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Operator</label>
          <select
            value={tOp} onChange={e => setTOp(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 min-w-[110px]"
          >
            <option value="">All Operators</option>
            {uniqueOps.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Action Type */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Action Type</label>
          <select
            value={tAction} onChange={e => setTAction(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          >
            <option value="">All</option>
            <option value="EDIT">Edited</option>
            <option value="DELETE">Deleted</option>
          </select>
        </div>

        {/* Apply */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] invisible">x</label>
          <button
            onClick={apply}
            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Reset */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] invisible">x</label>
          <button
            onClick={reset}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Result count */}
        <div className="flex flex-col gap-0.5 ml-auto">
          <label className="text-[10px] invisible">x</label>
          <span className="text-xs text-gray-500 py-1.5">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ═══ TABLE ═══════════════════════════════════════════════════════════ */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[90px]">Date</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[72px]">Time</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[90px]">Operator</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[100px]">Module</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[80px]">Loan</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[140px]">Customer</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[72px] text-center">Action</th>
                <th className="px-3 py-2.5 border-r border-gray-200 w-[110px] text-center">Changes</th>
                <th className="px-3 py-2.5">Preview</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-blue-400" />
                    Loading audit trail…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filtered.map(row => {
                  const isExpanded = expanded.has(row.id);
                  const isDelete   = row.eventType === 'DELETE';

                  return (
                    <React.Fragment key={row.id}>
                      {/* ── MAIN ROW ─────────────────────────────────────── */}
                      <tr
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'
                        }`}
                        onClick={() => toggle(row.id)}
                      >
                        {/* Date */}
                        <td className="px-3 py-2 font-medium text-gray-800 border-r border-gray-100 whitespace-nowrap">
                          {row.dateStr}
                        </td>

                        {/* Time */}
                        <td className="px-3 py-2 text-gray-500 border-r border-gray-100 whitespace-nowrap">
                          {row.timeStr}
                        </td>

                        {/* Operator */}
                        <td className="px-3 py-2 font-semibold text-gray-800 border-r border-gray-100 whitespace-nowrap">
                          {row.operator}
                        </td>

                        {/* Module (table name) */}
                        <td className="px-3 py-2 border-r border-gray-100">
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                            {row.tableName}
                          </span>
                        </td>

                        {/* Loan */}
                        <td className="px-3 py-2 font-medium text-gray-800 border-r border-gray-100 whitespace-nowrap">
                          {row.loanNo}
                        </td>

                        {/* Customer */}
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-100 max-w-[140px] truncate">
                          {row.customer}
                        </td>

                        {/* Action badge */}
                        <td className="px-3 py-2 border-r border-gray-100 text-center">
                          {isDelete ? (
                            <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Deleted
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Edited
                            </span>
                          )}
                        </td>

                        {/* Changes */}
                        <td className="px-3 py-2 border-r border-gray-100 text-center text-gray-600 font-medium whitespace-nowrap">
                          {isDelete
                            ? <span className="text-red-500 font-semibold">DELETED</span>
                            : row.fieldChanges.length === 0
                              ? <span className="text-gray-400 italic">No diff</span>
                              : `${row.fieldChanges.length} Field${row.fieldChanges.length !== 1 ? 's' : ''} Changed`
                          }
                        </td>

                        {/* Preview — inline diff, first 3 changes */}
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-1">
                            <span className="text-gray-400 mt-0.5 flex-shrink-0">
                              {isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                            {!isExpanded && (
                              <div className="flex flex-col gap-0.5 min-w-0">
                                {isDelete ? (
                                  <span className="text-red-400 italic text-[11px]">Entire record removed</span>
                                ) : (
                                  <>
                                    {row.fieldChanges.slice(0, 3).map((f, i) => (
                                      <div key={i} className="flex items-center gap-1 truncate max-w-[260px]">
                                        <span className="font-semibold text-gray-500 flex-shrink-0">{f.field}:</span>
                                        <span className="text-red-500 line-through truncate">{f.before}</span>
                                        <span className="text-gray-400 flex-shrink-0">→</span>
                                        <span className="text-green-600 font-semibold truncate">{f.after}</span>
                                      </div>
                                    ))}
                                    {row.fieldChanges.length > 3 && (
                                      <span className="text-blue-500 text-[11px] font-medium">
                                        +{row.fieldChanges.length - 3} More
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── EXPANDED ROW ─────────────────────────────────── */}
                      {isExpanded && (
                        <tr className="bg-gray-50/80">
                          <td colSpan={9} className="px-4 py-3">
                            {isDelete ? (
                              // Deleted snapshot
                              <div className="bg-white border border-red-200 rounded-lg p-3">
                                <div className="text-[11px] font-bold uppercase text-red-700 mb-2 pb-1.5 border-b border-red-100 tracking-wider">
                                  Deleted Snapshot
                                </div>
                                {row.deletedSnapshot && Object.keys(row.deletedSnapshot).length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2">
                                    {Object.entries(row.deletedSnapshot).map(([k, v]) => {
                                      if (IGNORED_KEYS.has(k)) return null;
                                      return (
                                        <div key={k} className="flex flex-col gap-0.5">
                                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{k}</span>
                                          <span className="text-[11px] text-gray-800 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded truncate" title={String(v)}>
                                            {v != null && v !== '' ? String(v) : '—'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">No snapshot data available.</span>
                                )}
                              </div>
                            ) : (
                              // Edit diff table
                              <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <div className="text-[11px] font-bold uppercase text-gray-600 mb-2 pb-1.5 border-b border-gray-100 tracking-wider">
                                  Field Changes — {row.fieldChanges.length} field{row.fieldChanges.length !== 1 ? 's' : ''}
                                </div>
                                {row.fieldChanges.length > 0 ? (
                                  <table className="w-full border-collapse text-[11px]">
                                    <thead>
                                      <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                                        <th className="py-1 px-2 border border-gray-200 bg-gray-50 font-bold text-left w-[25%]">Field</th>
                                        <th className="py-1 px-2 border border-gray-200 bg-red-50 text-red-700 font-bold text-left w-[37.5%]">Before</th>
                                        <th className="py-1 px-2 border border-gray-200 bg-green-50 text-green-700 font-bold text-left w-[37.5%]">After</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.fieldChanges.map((f, i) => (
                                        <tr key={i} className="hover:bg-gray-50/80">
                                          <td className="py-1.5 px-2 border border-gray-200 font-semibold text-gray-700 break-words">{f.field}</td>
                                          <td className="py-1.5 px-2 border border-gray-200 text-red-600 break-words bg-red-50/40">{f.before}</td>
                                          <td className="py-1.5 px-2 border border-gray-200 text-green-700 font-semibold break-words bg-green-50/40">{f.after}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">No field differences detected.</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ PRINT STYLES ════════════════════════════════════════════════════ */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
        }
      `}</style>
    </div>
  );
};

export default EditedRecords;
