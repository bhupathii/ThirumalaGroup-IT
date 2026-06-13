import Dexie, { Table } from 'dexie';

export interface QueuedOperation {
  offline_uuid: string; // primary key
  mode: 'regular' | 'itr';
  book_id: string;
  book_name: string;
  user_id: string;
  created_at: string;
  synced_at?: string;
  operation_type: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  table: string; // base table name
  payload: any; // data payload
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed' | 'conflict';
  error_message?: string;
}

class OfflineQueueDatabase extends Dexie {
  queued_operations!: Table<QueuedOperation, string>;

  constructor() {
    super('OfflineQueueDatabase');
    this.version(1).stores({
      queued_operations: 'offline_uuid, mode, book_id, user_id, status, created_at, synced_at'
    });
  }
}

export const db = new OfflineQueueDatabase();
