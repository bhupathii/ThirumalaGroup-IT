import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { financeLedgerSettingsService, DEFAULT_LEDGER_SETTINGS } from '../../services/financeLedgerSettingsService';
import { FinanceLedgerSetting } from '../../lib/supabaseFinance';

const LEDGER_TYPES = [
  { code: 'CD', name: 'CASH DEPOSIT (CD)', desc: 'SIMPLE INTEREST, DAILY ACCRUAL. PRINCIPAL ROLLS ON RENEWAL.' },
  { code: 'HP', name: 'HIRE PURCHASE (HP)', desc: 'FLAT INTEREST EMI. FIXED TENURE, NO ROLLOVER.' },
  { code: 'STBD', name: 'SHORT TERM BALANCE DEPOSIT (STBD)', desc: 'SHORT-TERM INSTALMENT PLAN. FLAT INTEREST.' },
  { code: 'TBD', name: 'TERM BALANCE DEPOSIT (TBD)', desc: 'TERM DEPOSIT. INTEREST COMPOUNDED MONTHLY TO MATURITY.' },
  { code: 'FD', name: 'FIXED DEPOSIT (FD)', desc: 'FIXED DEPOSIT. MONTHLY COMPOUNDING.' },
  { code: 'OD', name: 'OVERDRAFT (OD)', desc: 'OVERDRAFT. SIMPLE DAILY INTEREST ON OUTSTANDING.' },
  { code: 'RD', name: 'RECURRING DEPOSIT (RD)', desc: 'RECURRING DEPOSIT. MONTHLY COMPOUNDING PER INSTALMENT.' }
];

export default function LedgerSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, FinanceLedgerSetting>>({});
  const [customized, setCustomized] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const dbSettings = await financeLedgerSettingsService.getAllLedgerSettings();
      const newSettings: Record<string, FinanceLedgerSetting> = {};
      const newCustomized: Record<string, boolean> = {};

      LEDGER_TYPES.forEach(type => {
        // If it exists in DB, it's customized. Otherwise fallback to default.
        if (dbSettings[type.code] && dbSettings[type.code].updated_at) {
          newSettings[type.code] = dbSettings[type.code];
          newCustomized[type.code] = true;
        } else {
          newSettings[type.code] = { ...DEFAULT_LEDGER_SETTINGS[type.code] };
          newCustomized[type.code] = false;
        }
      });

      setSettings(newSettings);
      setCustomized(newCustomized);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCustomize = (code: string) => {
    setCustomized(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleChange = (code: string, field: keyof FinanceLedgerSetting, value: any) => {
    setSettings(prev => ({
      ...prev,
      [code]: { ...prev[code], [field]: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    let successCount = 0;
    try {
      for (const type of LEDGER_TYPES) {
        if (customized[type.code]) {
          // Validate
          const setting = settings[type.code];
          if (setting.rate < 0 || setting.overdue < 0 || setting.days_per_year <= 0) {
            toast.error(`Invalid values for ${type.code}`);
            return;
          }
          await financeLedgerSettingsService.saveLedgerSetting(setting);
          successCount++;
        } else {
          // If not customized, delete from DB if it existed
          try {
             await financeLedgerSettingsService.deleteLedgerSetting(type.code);
          } catch(e) {
             // ignore if didn't exist
          }
        }
      }
      toast.success('Settings saved successfully');
      loadSettings();
    } catch (error: any) {
      toast.error(error.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all to default? Unsaved changes will be lost.')) {
      loadSettings();
    }
  };

  const activeCount = Object.values(customized).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#0b1329]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="finance-page-title">Ledger Settings</h1>
          <p className="finance-page-subtitle">
            Customize interest, overdue rate, and method for each ledger. Changes apply everywhere.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate(-1)} 
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button 
            onClick={handleReset}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#0b1329] hover:bg-slate-800 text-white rounded-lg font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* How This Works */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">How This Works</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Every calc across ledgers, reports, dashboard, and calculator reads these values.
            </p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-blue-200">
            {activeCount} Active
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Base Config</p>
            <p className="text-xs font-black text-slate-900 uppercase">Built-in (Fallback)</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Override</p>
            <p className="text-xs font-black text-slate-900 uppercase">Your settings below</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Persistence</p>
            <p className="text-xs font-black text-slate-900 uppercase">Supabase + Browser Cache</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50">
          <button
            onClick={() => {
              const newC = { ...customized };
              Object.keys(newC).forEach(k => newC[k] = true);
              setCustomized(newC);
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Enable All
          </button>
          <button
             onClick={() => {
              const newC = { ...customized };
              Object.keys(newC).forEach(k => newC[k] = false);
              setCustomized(newC);
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Disable All
          </button>
        </div>
      </div>

      {/* Grid of Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {LEDGER_TYPES.map(type => {
          const isCustom = customized[type.code];
          const setting = settings[type.code] || DEFAULT_LEDGER_SETTINGS[type.code];

          return (
            <div key={type.code} className={`bg-white rounded-xl border ${isCustom ? 'border-blue-300 shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all duration-200`}>
              <div className="p-4 flex justify-between items-start border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{type.name}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 max-w-[80%]">{type.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isCustom}
                      onChange={() => handleToggleCustomize(type.code)}
                      className="w-4 h-4 text-[#0b1329] rounded border-slate-300 focus:ring-[#0b1329]"
                    />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isCustom ? 'text-blue-600' : 'text-slate-500'}`}>
                      Customize
                    </span>
                  </label>
                  {!isCustom && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">Default</span>}
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Rate (% / Month) - Default {DEFAULT_LEDGER_SETTINGS[type.code].rate}</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!isCustom}
                    value={setting.rate}
                    onChange={(e) => handleChange(type.code, 'rate', Number(e.target.value))}
                    className={`w-full rounded-lg border-slate-200 text-sm font-bold p-2.5 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#0b1329] focus:ring-[#0b1329] ${isCustom ? 'bg-white' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Overdue (% / Month) - Default {DEFAULT_LEDGER_SETTINGS[type.code].overdue}</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!isCustom}
                    value={setting.overdue}
                    onChange={(e) => handleChange(type.code, 'overdue', Number(e.target.value))}
                    className={`w-full rounded-lg border-slate-200 text-sm font-bold p-2.5 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#0b1329] focus:ring-[#0b1329] ${isCustom ? 'bg-white' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Method - Default {DEFAULT_LEDGER_SETTINGS[type.code].method}</label>
                  <select
                    disabled={!isCustom}
                    value={setting.method}
                    onChange={(e) => handleChange(type.code, 'method', e.target.value)}
                    className={`w-full rounded-lg border-slate-200 text-sm font-bold p-2.5 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#0b1329] focus:ring-[#0b1329] ${isCustom ? 'bg-white' : ''}`}
                  >
                    <option value="SIMPLE_DAILY">SIMPLE_DAILY</option>
                    <option value="FLAT_EMI">FLAT_EMI</option>
                    <option value="COMPOUND_MONTHLY">COMPOUND_MONTHLY</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Days / Year - Default {DEFAULT_LEDGER_SETTINGS[type.code].days_per_year}</label>
                  <select
                    disabled={!isCustom}
                    value={setting.days_per_year}
                    onChange={(e) => handleChange(type.code, 'days_per_year', Number(e.target.value))}
                    className={`w-full rounded-lg border-slate-200 text-sm font-bold p-2.5 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#0b1329] focus:ring-[#0b1329] ${isCustom ? 'bg-white' : ''}`}
                  >
                    <option value="360">360</option>
                    <option value="365">365</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Principal Rolls On Renewal</label>
                  <select
                    disabled={!isCustom}
                    value={setting.principal_rolls_on_renewal ? 'YES' : 'NO'}
                    onChange={(e) => handleChange(type.code, 'principal_rolls_on_renewal', e.target.value === 'YES')}
                    className={`w-full rounded-lg border-slate-200 text-sm font-bold p-2.5 disabled:bg-slate-50 disabled:text-slate-500 focus:border-[#0b1329] focus:ring-[#0b1329] ${isCustom ? 'bg-white' : ''}`}
                  >
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schema Hint */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-8 shadow-inner">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Schema Hint</h3>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">If Supabase shows a warning when saving, ensure this table exists.</p>
        <pre className="bg-white border border-slate-200 rounded-lg p-4 text-[10px] font-mono text-slate-700 overflow-x-auto shadow-sm">
{`CREATE TABLE IF NOT EXISTS ledger_settings (
  code text PRIMARY KEY,
  rate numeric,
  overdue numeric,
  method text,
  days_per_year integer,
  principal_rolls_on_renewal boolean,
  updated_at timestamptz DEFAULT now()
);`}
        </pre>
      </div>

    </div>
  );
}
