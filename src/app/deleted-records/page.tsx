'use client';

import React, { useState, useEffect } from 'react';
import { supabaseDatabase } from '@/lib/supabaseDatabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RotateCcw, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

interface DeletedRecord {
  id: string;
  sno: number;
  date: string;
  acc_name: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
  deleted_by: string;
  deleted_at: string;
  original_id?: string;
}

export default function DeletedRecordsPage() {
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const loadDeletedRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Loading deleted records...');
      
      const records = await supabaseDatabase.getDeletedCashBook();
      console.log('📋 Loaded deleted records:', records);
      
      setDeletedRecords(records);
    } catch (err) {
      console.error('❌ Error loading deleted records:', err);
      setError('Failed to load deleted records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedRecords();
  }, []);

  const handleRestore = async (recordId: string) => {
    try {
      setActionLoading(recordId);
      console.log('🔄 Restoring record:', recordId);
      
      const success = await supabaseDatabase.restoreCashBookEntry(recordId);
      
      if (success) {
        console.log('✅ Record restored successfully');
        // Remove the restored record from the list
        setDeletedRecords(prev => prev.filter(record => record.id !== recordId));
      } else {
        console.error('❌ Failed to restore record');
        setError('Failed to restore record. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error restoring record:', err);
      setError('Failed to restore record. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(recordId);
      console.log('🗑️ Permanently deleting record:', recordId);
      
      const success = await supabaseDatabase.permanentlyDeleteCashBookEntry(recordId);
      
      if (success) {
        console.log('✅ Record permanently deleted');
        // Remove the deleted record from the list
        setDeletedRecords(prev => prev.filter(record => record.id !== recordId));
      } else {
        console.error('❌ Failed to permanently delete record');
        setError('Failed to permanently delete record. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error permanently deleting record:', err);
      setError('Failed to permanently delete record. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🗑️ Deleted Records</h1>
            <p className="text-gray-600 mt-1">
              Manage deleted cash book entries - restore or permanently delete
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {deletedRecords.length} deleted records
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDeletedRecords}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-gray-600">Loading deleted records...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && deletedRecords.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No Deleted Records</h3>
                <p className="text-gray-600 mt-1">
                  There are no deleted records in the trash bin.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deleted Records List */}
      {!loading && deletedRecords.length > 0 && (
        <div className="space-y-4">
          {deletedRecords.map((record) => (
            <Card key={record.id} className="border-l-4 border-l-red-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive" className="text-xs">
                      DELETED
                    </Badge>
                    <CardTitle className="text-lg">
                      {record.acc_name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(record.id)}
                      disabled={actionLoading === record.id}
                      className="flex items-center gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <RotateCcw className={`h-4 w-4 ${actionLoading === record.id ? 'animate-spin' : ''}`} />
                      Restore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePermanentDelete(record.id)}
                      disabled={actionLoading === record.id}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className={`h-4 w-4 ${actionLoading === record.id ? 'animate-spin' : ''}`} />
                      Delete Forever
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500">S.No</label>
                      <p className="text-sm font-semibold">{record.sno}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Date</label>
                      <p className="text-sm">{formatDate(record.date)}</p>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Account Name</label>
                      <p className="text-sm font-medium">{record.acc_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Particulars</label>
                      <p className="text-sm">{record.particulars || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Debit</label>
                      <p className="text-sm font-semibold text-red-600">
                        {record.debit ? formatCurrency(record.debit) : '0.00'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Credit</label>
                      <p className="text-sm font-semibold text-green-600">
                        {record.credit ? formatCurrency(record.credit) : '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Deletion Info */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Balance</label>
                      <p className="text-sm font-semibold">
                        {formatCurrency(record.balance)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Deleted By</label>
                      <p className="text-sm">{record.deleted_by || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Deleted At</label>
                      <p className="text-sm">{formatDate(record.deleted_at)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer Info */}
      {!loading && deletedRecords.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">About Deleted Records</h4>
              <p className="text-sm text-blue-700 mt-1">
                • <strong>Restore:</strong> Move the record back to the main cash book
                <br />
                • <strong>Delete Forever:</strong> Permanently remove the record (cannot be undone)
                <br />
                • Deleted records are kept in the trash bin until you decide to restore or permanently delete them
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}













