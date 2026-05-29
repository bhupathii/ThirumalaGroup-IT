import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceEditedLog, FinanceDeletedLog } from '../../lib/supabaseFinance';
import { ShieldAlert, Trash2, Edit2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const EditedDeletedLogs: React.FC = () => {
  const [logType, setLogType] = useState<'edited' | 'deleted'>('edited');
  const [editedLogs, setEditedLogs] = useState<FinanceEditedLog[]>([]);
  const [deletedLogs, setDeletedLogs] = useState<FinanceDeletedLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const el = await supabaseFinance.getEditedLogs();
      setEditedLogs(el);

      const dl = await supabaseFinance.getDeletedLogs();
      setDeletedLogs(dl);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load logs registry');
    } finally {
      setLoading(false);
    }
  };

  const renderJsonValue = (val: any) => {
    if (!val) return '-';
    // Simplified display key values
    return (
      <pre className="text-[10px] bg-gray-50 border p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-gray-700">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Audit Logs Registry</h1>
          <p className="text-gray-500 text-sm mt-1">Review full audit histories of edited or deleted finance entries</p>
        </div>
      </div>

      {/* Log Type toggle */}
      <div className="flex gap-2 mb-2 max-w-xs">
        <button
          onClick={() => setLogType('edited')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold border transition-all text-sm flex justify-center items-center gap-2 ${
            logType === 'edited'
              ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Edit2 className="w-4 h-4" />
          Edited Logs
        </button>
        <button
          onClick={() => setLogType('deleted')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold border transition-all text-sm flex justify-center items-center gap-2 ${
            logType === 'deleted'
              ? 'bg-red-100 text-red-700 border-red-300 shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Deleted Logs
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
        </div>
      ) : logType === 'edited' ? (
        /* Edited Logs View */
        <Card title="Edited Records Logs" subtitle="Tracking updates to partner, loan and customer cards" className="shadow-md">
          {editedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No edit logs registered yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Table</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Operator</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Old Values</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">New Values</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {editedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-3 whitespace-nowrap text-gray-500 font-mono">
                        {new Date(log.edited_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-700 font-mono">
                        {log.table_name}
                      </td>
                      <td className="px-3 py-3 font-bold text-gray-900">
                        {log.edited_by}
                      </td>
                      <td className="px-3 py-3 max-w-sm">
                        {renderJsonValue(log.old_values)}
                      </td>
                      <td className="px-3 py-3 max-w-sm">
                        {renderJsonValue(log.new_values)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Deleted Logs View */
        <Card title="Deleted Records Logs" subtitle="Tracking removed entries from the finance tables" className="shadow-md">
          {deletedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No deletion logs registered yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Table</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Operator</th>
                    <th className="px-3 py-3 text-left font-bold text-gray-500 uppercase">Old Values</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {deletedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-3 whitespace-nowrap text-gray-500 font-mono">
                        {new Date(log.deleted_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-700 font-mono">
                        {log.table_name}
                      </td>
                      <td className="px-3 py-3 font-bold text-gray-900">
                        {log.deleted_by}
                      </td>
                      <td className="px-3 py-3 max-w-md">
                        {renderJsonValue(log.old_values)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default EditedDeletedLogs;
