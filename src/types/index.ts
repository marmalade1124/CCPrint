// Re-export types from their original component definitions
export type { Job } from '../components/KanbanBoard';
export type { PrinterProfile } from '../components/PrinterStatus';
export type { FilamentSpool } from '../components/FilamentInventory';
export type { Customer } from '../components/CustomerManager';
export type { FailureRecord } from '../components/AnalyticsDashboard';
export type { QuotingVariables } from '../components/QuotingEngine';
export type { ParsedMetadata } from '../utils/parser';
export type { FilamentLog } from '../App';

// NEW types
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: string;
  actionType?: 'confirm' | 'navigate' | 'none';
  actionPayload?: string;
}

export interface PrintHistoryRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  client: string;
  filename: string;
  weightGrams: number;
  printTimeMinutes: number;
  price: number;
  spoolId?: string;
  spoolName?: string;
  printerSerial?: string;
  printerName?: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  plateIndex?: number;
  plateName?: string;
}
