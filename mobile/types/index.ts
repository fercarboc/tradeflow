export interface User {
  id: string;
  email: string;
  createdAt: string;
  lastSignIn?: string;
  isOnboarded: boolean;
}

export interface Organization {
  id: string;
  name: string;
  trade: string; // Oficio (Fontanería, Electricidad, HVAC, etc.)
  city: string;
  phone: string;
  logoUrl?: string;
  taxId?: string; // NIF/CIF
  defaultIva: number; // e.g. 21 or 10
}

export interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  companyName?: string;
  createdAt: string;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined';

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Quote {
  id: string;
  clientId: string;
  clientName: string;
  quoteNumber: string; // e.g. PRE-2026-001
  createdAt: string;
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  taxRate: number; // e.g. 21
  taxAmount: number;
  total: number;
  voiceNoteUrl?: string;
  notes?: string;
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  quoteId?: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string; // e.g. FAC-2026-001
  createdAt: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}
