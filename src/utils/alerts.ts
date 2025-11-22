import { format, differenceInDays, addDays } from 'date-fns';

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  category: 'document' | 'payment' | 'system' | 'approval' | 'data';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  expiresAt?: Date;
  isRead: boolean;
  isDismissed: boolean;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: Alert['category'];
  conditions: AlertCondition[];
  actions: AlertAction[];
  isActive: boolean;
  priority: Alert['priority'];
}

export interface AlertCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'contains'
    | 'not_contains'
    | 'expires_in_days';
  value: any;
}

export interface AlertAction {
  type: 'create_alert' | 'send_email' | 'send_notification' | 'update_status';
  parameters: Record<string, any>;
}

class AlertManager {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];

  constructor() {
    this.loadAlerts();
    this.initializeDefaultRules();
  }

  private loadAlerts() {
    const savedAlerts = localStorage.getItem('thirumala_alerts');
    if (savedAlerts) {
      this.alerts = JSON.parse(savedAlerts).map((alert: any) => ({
        ...alert,
        createdAt: new Date(alert.createdAt),
        expiresAt: alert.expiresAt ? new Date(alert.expiresAt) : undefined,
      }));
    }
  }

  private saveAlerts() {
    localStorage.setItem('thirumala_alerts', JSON.stringify(this.alerts));
  }

  private initializeDefaultRules() {
    this.rules = [
      // Vehicle document expiry alerts
      {
        id: 'vehicle_tax_expiry',
        name: 'Vehicle Tax Expiry',
        description: 'Alert when vehicle tax is expiring soon',
        category: 'document',
        priority: 'high',
        isActive: true,
        conditions: [
          { field: 'tax_exp_date', operator: 'expires_in_days', value: 30 },
        ],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Vehicle Tax Expiring',
              message: 'Vehicle tax for {v_no} expires in {days} days',
            },
          },
        ],
      },
      {
        id: 'vehicle_insurance_expiry',
        name: 'Vehicle Insurance Expiry',
        description: 'Alert when vehicle insurance is expiring soon',
        category: 'document',
        priority: 'high',
        isActive: true,
        conditions: [
          {
            field: 'insurance_exp_date',
            operator: 'expires_in_days',
            value: 30,
          },
        ],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Vehicle Insurance Expiring',
              message: 'Vehicle insurance for {v_no} expires in {days} days',
            },
          },
        ],
      },
      {
        id: 'vehicle_fitness_expiry',
        name: 'Vehicle Fitness Expiry',
        description: 'Alert when vehicle fitness certificate is expiring soon',
        category: 'document',
        priority: 'medium',
        isActive: true,
        conditions: [
          { field: 'fitness_exp_date', operator: 'expires_in_days', value: 30 },
        ],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Vehicle Fitness Expiring',
              message: 'Vehicle fitness for {v_no} expires in {days} days',
            },
          },
        ],
      },
      // Driver license expiry alerts
      {
        id: 'driver_license_expiry',
        name: 'Driver License Expiry',
        description: 'Alert when driver license is expiring soon',
        category: 'document',
        priority: 'high',
        isActive: true,
        conditions: [
          { field: 'exp_date', operator: 'expires_in_days', value: 30 },
        ],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Driver License Expiring',
              message:
                'Driver license for {driver_name} expires in {days} days',
            },
          },
        ],
      },
      // Bank guarantee expiry alerts
      {
        id: 'bg_expiry',
        name: 'Bank Guarantee Expiry',
        description: 'Alert when bank guarantee is expiring soon',
        category: 'document',
        priority: 'high',
        isActive: true,
        conditions: [
          { field: 'exp_date', operator: 'expires_in_days', value: 60 },
        ],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Bank Guarantee Expiring',
              message: 'Bank guarantee {bg_no} expires in {days} days',
            },
          },
        ],
      },
      // Pending approval alerts
      {
        id: 'pending_approvals',
        name: 'Pending Approvals',
        description: 'Alert when there are pending approvals',
        category: 'approval',
        priority: 'medium',
        isActive: true,
        conditions: [{ field: 'approved', operator: 'equals', value: false }],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Pending Approvals',
              message: 'There are {count} entries pending approval',
            },
          },
        ],
      },
      // Data backup alerts
      {
        id: 'data_backup_reminder',
        name: 'Data Backup Reminder',
        description: 'Weekly reminder to backup data',
        category: 'system',
        priority: 'low',
        isActive: true,
        conditions: [
          { field: 'last_backup', operator: 'greater_than', value: 7 },
        ],
        actions: [
          {
            type: 'create_alert',
            parameters: {
              title: 'Data Backup Reminder',
              message: 'Consider backing up your data',
            },
          },
        ],
      },
    ];
  }

  // Create a new alert
  createAlert(
    alert: Omit<Alert, 'id' | 'createdAt' | 'isRead' | 'isDismissed'>
  ): Alert {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      isRead: false,
      isDismissed: false,
    };

    this.alerts.push(newAlert);
    this.saveAlerts();
    return newAlert;
  }

  // Get all alerts
  getAlerts(filters?: {
    type?: Alert['type'];
    category?: Alert['category'];
    priority?: Alert['priority'];
    isRead?: boolean;
    isDismissed?: boolean;
  }): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (filters) {
      if (filters.type) {
        filteredAlerts = filteredAlerts.filter(
          alert => alert.type === filters.type
        );
      }
      if (filters.category) {
        filteredAlerts = filteredAlerts.filter(
          alert => alert.category === filters.category
        );
      }
      if (filters.priority) {
        filteredAlerts = filteredAlerts.filter(
          alert => alert.priority === filters.priority
        );
      }
      if (filters.isRead !== undefined) {
        filteredAlerts = filteredAlerts.filter(
          alert => alert.isRead === filters.isRead
        );
      }
      if (filters.isDismissed !== undefined) {
        filteredAlerts = filteredAlerts.filter(
          alert => alert.isDismissed === filters.isDismissed
        );
      }
    }

    // Remove expired alerts
    filteredAlerts = filteredAlerts.filter(
      alert => !alert.expiresAt || alert.expiresAt > new Date()
    );

    return filteredAlerts.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // Get unread alerts count
  getUnreadCount(): number {
    return this.alerts.filter(alert => !alert.isRead && !alert.isDismissed)
      .length;
  }

  // Mark alert as read
  markAsRead(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.isRead = true;
      this.saveAlerts();
    }
  }

  // Mark alert as dismissed
  dismissAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.isDismissed = true;
      this.saveAlerts();
    }
  }

  // Delete alert
  deleteAlert(alertId: string): void {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.saveAlerts();
  }

  // Clear all alerts
  clearAllAlerts(): void {
    this.alerts = [];
    this.saveAlerts();
  }

  // Check for document expiry alerts
  checkDocumentExpiry(data: any[], documentType: string): Alert[] {
    const alerts: Alert[] = [];
    const today = new Date();

    data.forEach(item => {
      const expiryFields = this.getExpiryFields(documentType);

      expiryFields.forEach(field => {
        if (item[field]) {
          const expiryDate = new Date(item[field]);
          const daysUntilExpiry = differenceInDays(expiryDate, today);

          if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
            const alert = this.createAlert({
              type: daysUntilExpiry <= 7 ? 'error' : 'warning',
              title: `${this.getDocumentTypeName(documentType)} Expiring`,
              message: this.formatExpiryMessage(
                documentType,
                item,
                field,
                daysUntilExpiry
              ),
              category: 'document',
              priority:
                daysUntilExpiry <= 7
                  ? 'critical'
                  : daysUntilExpiry <= 15
                    ? 'high'
                    : 'medium',
              actionUrl: `/vehicles`,
              actionText: 'View Details',
              metadata: {
                documentType,
                itemId: item.id,
                expiryField: field,
                daysUntilExpiry,
              },
            });
            alerts.push(alert);
          }
        }
      });
    });

    return alerts;
  }

  // Check for pending approvals
  checkPendingApprovals(entries: any[]): Alert[] {
    const pendingCount = entries.filter(entry => !entry.approved).length;

    if (pendingCount > 0) {
      const alert = this.createAlert({
        type: 'warning',
        title: 'Pending Approvals',
        message: `There are ${pendingCount} entries pending approval`,
        category: 'approval',
        priority: pendingCount > 10 ? 'high' : 'medium',
        actionUrl: '/approve-records',
        actionText: 'Review Approvals',
        metadata: {
          pendingCount,
          lastChecked: new Date(),
        },
      });
      return [alert];
    }

    return [];
  }

  // Check for data anomalies
  checkDataAnomalies(entries: any[]): Alert[] {
    const alerts: Alert[] = [];

    // Check for entries with very high amounts
    const highAmountEntries = entries.filter(
      entry => entry.credit > 1000000 || entry.debit > 1000000
    );

    if (highAmountEntries.length > 0) {
      const alert = this.createAlert({
        type: 'warning',
        title: 'High Amount Entries Detected',
        message: `${highAmountEntries.length} entries with amounts over 10,00,000 found`,
        category: 'data',
        priority: 'medium',
        actionUrl: '/edit-entry',
        actionText: 'Review Entries',
        metadata: {
          highAmountCount: highAmountEntries.length,
          entries: highAmountEntries.map(e => ({
            id: e.id,
            amount: e.credit || e.debit,
          })),
        },
      });
      alerts.push(alert);
    }

    // Check for entries without particulars
    const emptyParticulars = entries.filter(
      entry => !entry.particulars || entry.particulars.trim().length < 3
    );

    if (emptyParticulars.length > 0) {
      const alert = this.createAlert({
        type: 'info',
        title: 'Entries with Incomplete Particulars',
        message: `${emptyParticulars.length} entries have incomplete or missing particulars`,
        category: 'data',
        priority: 'low',
        actionUrl: '/edit-entry',
        actionText: 'Review Entries',
        metadata: {
          incompleteCount: emptyParticulars.length,
        },
      });
      alerts.push(alert);
    }

    return alerts;
  }

  // Get expiry fields for different document types
  private getExpiryFields(documentType: string): string[] {
    switch (documentType) {
      case 'vehicle':
        return [
          'tax_exp_date',
          'insurance_exp_date',
          'fitness_exp_date',
          'permit_exp_date',
        ];
      case 'driver':
        return ['exp_date'];
      case 'bankguarantee':
        return ['exp_date'];
      default:
        return [];
    }
  }

  // Get document type name
  private getDocumentTypeName(documentType: string): string {
    switch (documentType) {
      case 'vehicle':
        return 'Vehicle Document';
      case 'driver':
        return 'Driver License';
      case 'bankguarantee':
        return 'Bank Guarantee';
      default:
        return 'Document';
    }
  }

  // Format expiry message
  private formatExpiryMessage(
    documentType: string,
    item: any,
    field: string,
    days: number
  ): string {
    const fieldName = field
      .replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    switch (documentType) {
      case 'vehicle':
        return `Vehicle ${item.v_no} ${fieldName} expires in ${days} days`;
      case 'driver':
        return `Driver ${item.driver_name} license expires in ${days} days`;
      case 'bankguarantee':
        return `Bank Guarantee ${item.bg_no} expires in ${days} days`;
      default:
        return `${fieldName} expires in ${days} days`;
    }
  }

  // Run all alert checks
  async runAlertChecks(data: {
    vehicles?: any[];
    drivers?: any[];
    bankGuarantees?: any[];
    entries?: any[];
  }): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    // Check document expiry
    if (data.vehicles) {
      newAlerts.push(...this.checkDocumentExpiry(data.vehicles, 'vehicle'));
    }
    if (data.drivers) {
      newAlerts.push(...this.checkDocumentExpiry(data.drivers, 'driver'));
    }
    if (data.bankGuarantees) {
      newAlerts.push(
        ...this.checkDocumentExpiry(data.bankGuarantees, 'bankguarantee')
      );
    }

    // Check pending approvals
    if (data.entries) {
      newAlerts.push(...this.checkPendingApprovals(data.entries));
      newAlerts.push(...this.checkDataAnomalies(data.entries));
    }

    return newAlerts;
  }
}

// Export singleton instance
export const alertManager = new AlertManager();

// Export utility functions
export const createDocumentExpiryAlert = (
  documentType: string,
  item: any,
  field: string,
  daysUntilExpiry: number
): Alert => {
  return alertManager.createAlert({
    type: daysUntilExpiry <= 7 ? 'error' : 'warning',
    title: `${documentType} Expiring`,
    message: `${documentType} expires in ${daysUntilExpiry} days`,
    category: 'document',
    priority: daysUntilExpiry <= 7 ? 'critical' : 'medium',
    metadata: { documentType, itemId: item.id, daysUntilExpiry },
  });
};

export const createSystemAlert = (
  title: string,
  message: string,
  priority: Alert['priority'] = 'medium'
): Alert => {
  return alertManager.createAlert({
    type: 'info',
    title,
    message,
    category: 'system',
    priority,
  });
};
