import { supabase } from './supabase';

// TypeScript Interfaces for Finance Mode
export interface FinancePartner {
  id: string;
  partner_id?: number;
  name: string;
  is_md?: boolean;
  phone: string | null;
  home_phone?: string | null;
  village?: string | null;
  md_name?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceCustomer {
  id: string;
  name: string;
  phone: string | null;
  phone2?: string | null;
  partner_name?: string | null;
  address: string | null;
  aadhaar: string | null;
  created_at: string;
  updated_at: string;
  customer_photo_url?: string | null;
  fingerprint_url?: string | null;
  fingerprint_template?: string | null;
  fingerprint_added?: boolean;
  customer_fingerprint_template?: string | null;
  customer_fingerprint_image_url?: string | null;
  customer_fingerprint_added?: boolean;
  surety_fingerprint_template?: string | null;
  surety_fingerprint_image_url?: string | null;
  surety_fingerprint_added?: boolean;
  father_husband_name?: string | null;
  
  // Redesign fields
  customer_id?: number;
  father_name?: string | null;
  village?: string | null;
  mandal?: string | null;
  district?: string | null;
  aadhaar_address?: string | null;
  present_address?: string | null;
  phone_1?: string | null;
  phone_2?: string | null;
}

export interface FinanceGuarantor {
  id: string;
  guarantor_id?: number;
  name: string;
  aadhaar: string | null;
  phone: string | null;
  address: string | null;
  photo_url?: string | null;
  fingerprint_template?: string | null;
  fingerprint_image_url?: string | null;
  fingerprint_added?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceLoan {
  id: string;
  loan_id: string;
  customer_id: string;
  date: string;
  amount: number;
  interest_rate: number;
  duration_months: number;
  due_type: 'Daily' | 'Weekly' | 'Monthly';
  due_amount: number;
  surety_name: string | null;
  surety_phone: string | null;
  surety_aadhaar: string | null;
  surety_address?: string | null;
  surety_relation?: string | null;
  remarks: string | null;
  status: 'Active' | 'Closed';
  created_at: string;
  updated_at: string;
  customer_photo_url?: string | null;
  surety_photo_url?: string | null;
  fingerprint_url?: string | null;
  fingerprint_template?: string | null;
  fingerprint_added?: boolean;
  customer_fingerprint_template?: string | null;
  customer_fingerprint_image_url?: string | null;
  customer_fingerprint_added?: boolean;
  surety_fingerprint_template?: string | null;
  surety_fingerprint_image_url?: string | null;
  surety_fingerprint_added?: boolean;
  father_husband_name?: string | null;
  loan_category?: string;
  guarantor_1_id?: string | null;
  guarantor_2_id?: string | null;
}

export interface FinanceTransaction {
  id: string;
  loan_id: string;
  date: string;
  amount: number;
  type: 'Collection' | 'Disbursement' | 'Interest Charge' | 'Other';
  collected_by: string | null;
  remarks: string | null;
  payment_mode?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceCapitalEntry {
  id: string;
  date: string;
  partner_id: string;
  amount: number;
  type: 'Credit' | 'Debit';
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceDue {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: 'Pending' | 'Paid' | 'Partially Paid';
  created_at: string;
  updated_at: string;
}

export interface FinancePhoto {
  id: string;
  loan_id: string;
  photo_type: 'Customer' | 'Surety';
  photo_url: string;
  created_at: string;
}

export interface FinanceDocument {
  id: string;
  loan_id: string;
  document_type: string;
  document_url: string;
  created_at: string;
}


export interface FinanceEditedLog {
  id: string;
  table_name: string;
  record_id: string;
  old_values: any;
  new_values: any;
  edited_by: string;
  edited_at: string;
}

export interface FinanceDeletedLog {
  id: string;
  table_name: string;
  record_id: string;
  old_values: any;
  deleted_by: string;
  deleted_at: string;
}

export interface FinanceCashbookAccount {
  id: string;
  account_name: string;
  account_number: string | null;
  created_at: string;
}

export interface FinanceCashbookEntry {
  id: string;
  entry_date: string;
  account_number: string | null;
  head_of_account: string;
  particulars: string;
  credit: number;
  debit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

class SupabaseFinance {
  // --- Partners ---
  async getPartners(): Promise<FinancePartner[]> {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance partners:', error);
      return [];
    }
  }

  async createPartner(partner: Omit<FinancePartner, 'id' | 'created_at' | 'updated_at'>): Promise<FinancePartner | null> {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .insert([partner])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance partner:', error);
      return null;
    }
  }

  async updatePartner(id: string, partner: Partial<FinancePartner>, editedBy: string): Promise<FinancePartner | null> {
    try {
      // Get old values for logging
      const { data: oldData } = await supabase
        .from('finance_partners')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_partners')
        .update({ ...partner, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (oldData) {
        await this.logEdit('finance_partners', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance partner:', error);
      return null;
    }
  }

  async deletePartner(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_partners')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_partners')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_partners', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance partner:', error);
      return false;
    }
  }

  // --- Guarantors ---
  async getGuarantors(): Promise<FinanceGuarantor[]> {
    try {
      const { data, error } = await supabase
        .from('finance_guarantors')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance guarantors:', error);
      return [];
    }
  }

  async createGuarantor(guarantor: Omit<FinanceGuarantor, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceGuarantor | null> {
    try {
      const { data, error } = await supabase
        .from('finance_guarantors')
        .insert([guarantor])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance guarantor:', error);
      return null;
    }
  }

  // --- Customers ---
  async getCustomers(): Promise<FinanceCustomer[]> {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance customers:', error);
      return [];
    }
  }

  async createCustomer(customer: Omit<FinanceCustomer, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceCustomer | null> {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .insert([customer])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: string, customer: Partial<FinanceCustomer>, editedBy: string): Promise<FinanceCustomer | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_customers')
        .update({ ...customer, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Sync to finance_fingerprints
      if (customer.customer_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('customer_id', id)
          .eq('fingerprint_type', 'Customer');
        if (customer.customer_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: id,
              fingerprint_type: 'Customer',
              fingerprint_template: customer.customer_fingerprint_template,
              fingerprint_image_url: customer.customer_fingerprint_image_url
            }]);
        }
      }
      if (customer.surety_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('customer_id', id)
          .eq('fingerprint_type', 'Surety');
        if (customer.surety_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: id,
              fingerprint_type: 'Surety',
              fingerprint_template: customer.surety_fingerprint_template,
              fingerprint_image_url: customer.surety_fingerprint_image_url
            }]);
        }
      }

      if (oldData) {
        await this.logEdit('finance_customers', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance customer:', error);
      return null;
    }
  }

  async deleteCustomer(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_customers')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_customers', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance customer:', error);
      return false;
    }
  }

  // --- Loans ---
  async getLoans(): Promise<(FinanceLoan & { customer: FinanceCustomer })[]> {
    try {
      const { data, error } = await supabase
        .from('finance_loans')
        .select('*, customer:finance_customers(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance loans:', error);
      return [];
    }
  }

  async getLoanById(id: string): Promise<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: FinancePhoto[]; dues: FinanceDue[]; documents: FinanceDocument[] }) | null> {
    try {
      const { data: loan, error: loanError } = await supabase
        .from('finance_loans')
        .select('*, customer:finance_customers(*)')
        .eq('id', id)
        .single();
      if (loanError) throw loanError;
      if (!loan) return null;

      const { data: transactions } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('loan_id', id)
        .order('date', { ascending: true });

      const { data: photos } = await supabase
        .from('finance_photos')
        .select('*')
        .eq('loan_id', id);

      const { data: dues } = await supabase
        .from('finance_dues')
        .select('*')
        .eq('loan_id', id)
        .order('due_date', { ascending: true });

      let documents: FinanceDocument[] = [];
      try {
        const { data: docs, error: docsError } = await supabase
          .from('finance_documents')
          .select('*')
          .eq('loan_id', id)
          .order('created_at', { ascending: false });
        if (!docsError && docs) {
          documents = docs;
        }
      } catch (docErr) {
        console.warn('Could not fetch finance_documents (table might not exist yet):', docErr);
      }

      return {
        ...loan,
        transactions: transactions || [],
        photos: photos || [],
        dues: dues || [],
        documents
      };
    } catch (error) {
      console.error('Error fetching loan by id:', error);
      return null;
    }
  }

  async createLoan(
    loanData: Omit<FinanceLoan, 'id' | 'created_at' | 'updated_at' | 'status'>,
    customerData: { 
      id?: string; 
      name?: string; 
      phone?: string | null; 
      address?: string | null; 
      aadhaar?: string | null;
      customer_photo_url?: string | null;
      fingerprint_url?: string | null;
      fingerprint_template?: string | null;
      fingerprint_added?: boolean;
      customer_fingerprint_template?: string | null;
      customer_fingerprint_image_url?: string | null;
      customer_fingerprint_added?: boolean;
      surety_fingerprint_template?: string | null;
      surety_fingerprint_image_url?: string | null;
      surety_fingerprint_added?: boolean;
      father_husband_name?: string | null;
    },
    duesData: Omit<FinanceDue, 'id' | 'loan_id' | 'paid_amount' | 'status' | 'created_at' | 'updated_at'>[],
    photosData: { photo_type: 'Customer' | 'Surety'; photo_url: string }[],
    staffName: string
  ): Promise<FinanceLoan | null> {
    try {
      let customerId = customerData.id;

      // Create customer if they don't exist
      if (!customerId) {
        const { data: customer, error: customerError } = await supabase
          .from('finance_customers')
          .insert([{
            name: customerData.name || '',
            phone: customerData.phone || '',
            address: customerData.address || '',
            aadhaar: customerData.aadhaar || null,
            customer_photo_url: customerData.customer_photo_url || null,
            fingerprint_url: customerData.fingerprint_url || null,
            fingerprint_template: customerData.fingerprint_template || null,
            fingerprint_added: customerData.fingerprint_added || false,
            customer_fingerprint_template: customerData.customer_fingerprint_template || null,
            customer_fingerprint_image_url: customerData.customer_fingerprint_image_url || null,
            customer_fingerprint_added: customerData.customer_fingerprint_added || false,
            surety_fingerprint_template: customerData.surety_fingerprint_template || null,
            surety_fingerprint_image_url: customerData.surety_fingerprint_image_url || null,
            surety_fingerprint_added: customerData.surety_fingerprint_added || false,
            father_husband_name: customerData.father_husband_name || null
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = customer.id;
      } else {
        // If existing customer, update customer's photo/fingerprint if provided
        if (
          customerData.customer_photo_url || 
          customerData.fingerprint_url || 
          customerData.customer_fingerprint_template || 
          customerData.surety_fingerprint_template ||
          customerData.father_husband_name
        ) {
          const updatePayload: Partial<FinanceCustomer> = {};
          if (customerData.customer_photo_url) updatePayload.customer_photo_url = customerData.customer_photo_url;
          if (customerData.father_husband_name) updatePayload.father_husband_name = customerData.father_husband_name;
          if (customerData.fingerprint_url) {
            updatePayload.fingerprint_url = customerData.fingerprint_url;
            updatePayload.fingerprint_template = customerData.fingerprint_template;
            updatePayload.fingerprint_added = customerData.fingerprint_added;
          }
          if (customerData.customer_fingerprint_template) {
            updatePayload.customer_fingerprint_template = customerData.customer_fingerprint_template;
            updatePayload.customer_fingerprint_image_url = customerData.customer_fingerprint_image_url;
            updatePayload.customer_fingerprint_added = customerData.customer_fingerprint_added;
          }
          if (customerData.surety_fingerprint_template) {
            updatePayload.surety_fingerprint_template = customerData.surety_fingerprint_template;
            updatePayload.surety_fingerprint_image_url = customerData.surety_fingerprint_image_url;
            updatePayload.surety_fingerprint_added = customerData.surety_fingerprint_added;
          }
          await this.updateCustomer(customerId, updatePayload, staffName);
        }
      }

      // Create loan record
      const { data: loan, error: loanError } = await supabase
        .from('finance_loans')
        .insert([{
          ...loanData,
          customer_id: customerId,
          status: 'Active',
          customer_photo_url: loanData.customer_photo_url || customerData.customer_photo_url || null,
          surety_photo_url: loanData.surety_photo_url || null,
          fingerprint_url: loanData.fingerprint_url || customerData.fingerprint_url || null,
          fingerprint_template: loanData.fingerprint_template || customerData.fingerprint_template || null,
          fingerprint_added: loanData.fingerprint_added || customerData.fingerprint_added || false,
          customer_fingerprint_template: loanData.customer_fingerprint_template || customerData.customer_fingerprint_template || null,
          customer_fingerprint_image_url: loanData.customer_fingerprint_image_url || customerData.customer_fingerprint_image_url || null,
          customer_fingerprint_added: loanData.customer_fingerprint_added || customerData.customer_fingerprint_added || false,
          surety_fingerprint_template: loanData.surety_fingerprint_template || customerData.surety_fingerprint_template || null,
          surety_fingerprint_image_url: loanData.surety_fingerprint_image_url || customerData.surety_fingerprint_image_url || null,
          surety_fingerprint_added: loanData.surety_fingerprint_added || customerData.surety_fingerprint_added || false,
          father_husband_name: loanData.father_husband_name || customerData.father_husband_name || null,
          loan_category: loanData.loan_category || 'Regular'
        }])
        .select()
        .single();

      if (loanError) throw loanError;

      // Create disbursement transaction
      const { error: txError } = await supabase
        .from('finance_transactions')
        .insert([{
          loan_id: loan.id,
          date: loan.date,
          amount: loan.amount,
          type: 'Disbursement',
          collected_by: staffName,
          remarks: 'Loan disbursed'
        }]);

      if (txError) throw txError;

      // Create dues schedule
      if (duesData && duesData.length > 0) {
        const formattedDues = duesData.map(due => ({
          loan_id: loan.id,
          due_date: due.due_date,
          amount: due.amount,
          paid_amount: 0,
          status: 'Pending'
        }));

        const { error: duesError } = await supabase
          .from('finance_dues')
          .insert(formattedDues);

        if (duesError) throw duesError;
      }

      // Save photos
      if (photosData && photosData.length > 0) {
        const formattedPhotos = photosData.map(photo => ({
          loan_id: loan.id,
          photo_type: photo.photo_type,
          photo_url: photo.photo_url
        }));

        const { error: photosError } = await supabase
          .from('finance_photos')
          .insert(formattedPhotos);

        if (photosError) throw photosError;
      }

      // Save fingerprints to finance_fingerprints table
      if (loanData.customer_fingerprint_template || customerData.customer_fingerprint_template) {
        await supabase
          .from('finance_fingerprints')
          .insert([{
            customer_id: customerId,
            loan_id: loan.id,
            fingerprint_type: 'Customer',
            fingerprint_template: loanData.customer_fingerprint_template || customerData.customer_fingerprint_template,
            fingerprint_image_url: loanData.customer_fingerprint_image_url || customerData.customer_fingerprint_image_url
          }]);
      }
      if (loanData.surety_fingerprint_template || customerData.surety_fingerprint_template) {
        await supabase
          .from('finance_fingerprints')
          .insert([{
            customer_id: customerId,
            loan_id: loan.id,
            fingerprint_type: 'Surety',
            fingerprint_template: loanData.surety_fingerprint_template || customerData.surety_fingerprint_template,
            fingerprint_image_url: loanData.surety_fingerprint_image_url || customerData.surety_fingerprint_image_url
          }]);
      }

      return loan;
    } catch (error) {
      console.error('Error creating finance loan:', error);
      return null;
    }
  }

  async updateLoan(id: string, loan: Partial<FinanceLoan>, editedBy: string): Promise<FinanceLoan | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_loans')
        .update({ ...loan, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Sync to finance_fingerprints
      if (loan.customer_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('loan_id', id)
          .eq('fingerprint_type', 'Customer');
        if (loan.customer_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: oldData?.customer_id,
              loan_id: id,
              fingerprint_type: 'Customer',
              fingerprint_template: loan.customer_fingerprint_template,
              fingerprint_image_url: loan.customer_fingerprint_image_url
            }]);
        }
      }
      if (loan.surety_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('loan_id', id)
          .eq('fingerprint_type', 'Surety');
        if (loan.surety_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: oldData?.customer_id,
              loan_id: id,
              fingerprint_type: 'Surety',
              fingerprint_template: loan.surety_fingerprint_template,
              fingerprint_image_url: loan.surety_fingerprint_image_url
            }]);
        }
      }

      if (oldData) {
        await this.logEdit('finance_loans', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance loan:', error);
      return null;
    }
  }

  async deleteLoan(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_loans')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_loans', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance loan:', error);
      return false;
    }
  }

  // --- Transactions (Collections & Disbursements) ---
  async getTransactions(filters?: { startDate?: string; endDate?: string }): Promise<(FinanceTransaction & { loan: FinanceLoan & { customer: FinanceCustomer } })[]> {
    try {
      let query = supabase
        .from('finance_transactions')
        .select('*, loan:finance_loans(*, customer:finance_customers(*))')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance transactions:', error);
      return [];
    }
  }

  async createTransaction(transaction: Omit<FinanceTransaction, 'id' | 'created_at' | 'updated_at'>, _editedBy: string): Promise<FinanceTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('finance_transactions')
        .insert([transaction])
        .select()
        .single();
      if (error) throw error;

      // Recalculate dues paid amounts for this loan to keep payment schedule correctly allocated
      if (transaction.type === 'Collection') {
        await this.recalculateDuesForLoan(transaction.loan_id);
      }

      return data;
    } catch (error) {
      console.error('Error creating finance transaction:', error);
      return null;
    }
  }

  async deleteTransaction(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (!oldData) return false;

      const { error } = await supabase
        .from('finance_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await this.logDelete('finance_transactions', id, oldData, deletedBy);

      // Recalculate dues allocation if deleting a collection
      if (oldData.type === 'Collection') {
        await this.recalculateDuesForLoan(oldData.loan_id);
      }

      return true;
    } catch (error) {
      console.error('Error deleting finance transaction:', error);
      return false;
    }
  }

  // Helper method: Reset and recalculate dues payments sequentially for a loan
  async recalculateDuesForLoan(loanId: string): Promise<void> {
    try {
      // 1. Get all Collections transactions for the loan
      const { data: collections, error: collectionsError } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('loan_id', loanId)
        .eq('type', 'Collection')
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });

      if (collectionsError) throw collectionsError;

      // Sum of all collections
      let totalCollected = (collections || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

      // 2. Get all dues for this loan
      const { data: dues, error: duesError } = await supabase
        .from('finance_dues')
        .select('*')
        .eq('loan_id', loanId)
        .order('due_date', { ascending: true });

      if (duesError) throw duesError;
      if (!dues || dues.length === 0) return;

      // 3. Sequentially allocate the totalCollected amount
      const updatedDues = dues.map(due => {
        const dueAmount = Number(due.amount);
        let paidAmount = 0;
        let status: 'Pending' | 'Paid' | 'Partially Paid' = 'Pending';

        if (totalCollected >= dueAmount) {
          paidAmount = dueAmount;
          status = 'Paid';
          totalCollected -= dueAmount;
        } else if (totalCollected > 0) {
          paidAmount = totalCollected;
          status = 'Partially Paid';
          totalCollected = 0;
        }

        return {
          id: due.id,
          paid_amount: paidAmount,
          status: status,
          updated_at: new Date().toISOString()
        };
      });

      // 4. Update each due record in Supabase
      // Note: We perform individual updates or bulk if supported, individual is simple and safe for typical loan dues counts (e.g. 50-100)
      for (const due of updatedDues) {
        await supabase
          .from('finance_dues')
          .update({
            paid_amount: due.paid_amount,
            status: due.status,
            updated_at: due.updated_at
          })
          .eq('id', due.id);
      }

      console.log(`✅ Recalculated dues for loan ${loanId}. Remaining collections: ${totalCollected}`);
    } catch (error) {
      console.error('Error recalculating dues for loan:', error);
    }
  }

  // --- Capital Entries ---
  async getCapitalEntries(): Promise<(FinanceCapitalEntry & { partner: FinancePartner })[]> {
    try {
      const { data, error } = await supabase
        .from('finance_capital_entries')
        .select('*, partner:finance_partners(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance capital entries:', error);
      return [];
    }
  }

  async createCapitalEntry(entry: Omit<FinanceCapitalEntry, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceCapitalEntry | null> {
    try {
      const { data, error } = await supabase
        .from('finance_capital_entries')
        .insert([entry])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance capital entry:', error);
      return null;
    }
  }

  async deleteCapitalEntry(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_capital_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_capital_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_capital_entries', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance capital entry:', error);
      return false;
    }
  }

  // --- Photos ---
  async addPhoto(photo: Omit<FinancePhoto, 'id' | 'created_at'>): Promise<FinancePhoto | null> {
    try {
      const { data, error } = await supabase
        .from('finance_photos')
        .insert([photo])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding photo:', error);
      return null;
    }
  }

  // --- Documents ---
  async getDocuments(loanId: string): Promise<FinanceDocument[]> {
    try {
      const { data, error } = await supabase
        .from('finance_documents')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance documents:', error);
      return [];
    }
  }

  async addDocument(doc: Omit<FinanceDocument, 'id' | 'created_at'>): Promise<FinanceDocument | null> {
    try {
      const { data, error } = await supabase
        .from('finance_documents')
        .insert([doc])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding finance document:', error);
      return null;
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('finance_documents')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting finance document:', error);
      return false;
    }
  }

  // --- Audit Logs ---
  async logEdit(tableName: string, recordId: string, oldValues: any, newValues: any, editedBy: string): Promise<void> {
    try {
      await supabase
        .from('finance_edited_logs')
        .insert([{
          table_name: tableName,
          record_id: recordId,
          old_values: oldValues,
          new_values: newValues,
          edited_by: editedBy
        }]);
    } catch (error) {
      console.error('Error writing edit log:', error);
    }
  }

  async logDelete(tableName: string, recordId: string, oldValues: any, deletedBy: string): Promise<void> {
    try {
      await supabase
        .from('finance_deleted_logs')
        .insert([{
          table_name: tableName,
          record_id: recordId,
          old_values: oldValues,
          deleted_by: deletedBy
        }]);
    } catch (error) {
      console.error('Error writing delete log:', error);
    }
  }

  async getEditedLogs(): Promise<FinanceEditedLog[]> {
    try {
      const { data, error } = await supabase
        .from('finance_edited_logs')
        .select('*')
        .order('edited_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching edited logs:', error);
      return [];
    }
  }

  async getDeletedLogs(): Promise<FinanceDeletedLog[]> {
    try {
      const { data, error } = await supabase
        .from('finance_deleted_logs')
        .select('*')
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deleted logs:', error);
      return [];
    }
  }

  // --- User Access & Permissions Management ---
  async getFinanceUsersPermissions(): Promise<Record<string, string[]>> {
    try {
      const { data, error } = await supabase
        .from('finance_user_permissions')
        .select('user_id, feature_key');
      if (error) throw error;

      const map: Record<string, string[]> = {};
      (data || []).forEach(row => {
        if (!map[row.user_id]) {
          map[row.user_id] = [];
        }
        if (row.feature_key) {
          map[row.user_id].push(row.feature_key);
        }
      });
      return map;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return {};
    }
  }

  async updateFinanceUserPermissions(userId: string, featureKeys: string[]): Promise<boolean> {
    try {
      // 1. Delete all existing finance permissions for this user
      const { error: deleteError } = await supabase
        .from('finance_user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 2. Insert new permissions if there are any
      if (featureKeys.length > 0) {
        const rows = featureKeys.map(key => ({
          user_id: userId,
          feature_key: key
        }));

        const { error: insertError } = await supabase
          .from('finance_user_permissions')
          .insert(rows);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error updating finance user permissions:', error);
      return false;
    }
  }

  async restoreDeletedRecord(logId: string, tableName: string, oldValues: any, _staffName: string): Promise<boolean> {
    try {
      const { error: insertError } = await supabase
        .from(tableName)
        .insert([oldValues]);
      if (insertError) throw insertError;

      const { error: logDeleteError } = await supabase
        .from('finance_deleted_logs')
        .delete()
        .eq('id', logId);
      if (logDeleteError) throw logDeleteError;

      return true;
    } catch (error) {
      console.error('Error restoring deleted record:', error);
      return false;
    }
  }

  // --- Cashbook Accounts ---
  async getCashbookAccounts(): Promise<FinanceCashbookAccount[]> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_accounts')
        .select('*')
        .order('account_name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cashbook accounts:', error);
      return [];
    }
  }

  async createCashbookAccount(account: Omit<FinanceCashbookAccount, 'id' | 'created_at'>): Promise<FinanceCashbookAccount | null> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_accounts')
        .insert([account])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating cashbook account:', error);
      return null;
    }
  }

  // --- Cashbook Entries ---
  async getCashbookEntries(): Promise<FinanceCashbookEntry[]> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cashbook entries:', error);
      return [];
    }
  }

  async createCashbookEntry(entry: Omit<FinanceCashbookEntry, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceCashbookEntry | null> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_entries')
        .insert([entry])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating cashbook entry:', error);
      return null;
    }
  }

  async updateCashbookEntry(id: string, entry: Partial<FinanceCashbookEntry>, editedBy: string): Promise<FinanceCashbookEntry | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_cashbook_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_cashbook_entries')
        .update({ ...entry, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (oldData) {
        await this.logEdit('finance_cashbook_entries', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating cashbook entry:', error);
      return null;
    }
  }

  async deleteCashbookEntry(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_cashbook_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_cashbook_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_cashbook_entries', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting cashbook entry:', error);
      return false;
    }
  }

  async deleteAllCashbookEntries(deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_cashbook_entries')
        .select('*');

      const { error } = await supabase
        .from('finance_cashbook_entries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;

      if (oldData && oldData.length > 0) {
        for (const row of oldData) {
          await this.logDelete('finance_cashbook_entries', row.id, row, deletedBy);
        }
      }
      return true;
    } catch (error) {
      console.error('Error deleting all cashbook entries:', error);
      return false;
    }
  }
}

export const supabaseFinance = new SupabaseFinance();
