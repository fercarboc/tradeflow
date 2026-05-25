import React, { createContext, useContext, useState, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { User, Organization, Client, Quote, Invoice } from '../types';

interface AppContextType {
  user: User | null;
  organization: Organization | null;
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  currentQuoteId: string | null;
  login: (email: string) => void;
  logout: () => void;
  saveOnboarding: (name: string, trade: string, city: string, phone: string, taxId?: string) => void;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client;
  addQuote: (clientId: string, items: Omit<Quote['items'][0], 'id'>[], taxRate?: number, notes?: string) => Quote;
  updateQuoteStatus: (quoteId: string, status: Quote['status']) => void;
  setCurrentQuoteId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext debe usarse dentro de un AppProvider');
  return context;
};

// Initial data for Spanish trades
const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-1',
    name: 'José Ruiz S.L.',
    contactPerson: 'José Ruiz',
    email: 'jruiz@reformasruiz.es',
    phone: '+34 612 345 678',
    address: 'Calle Alcalá 45, Grado B',
    city: 'Madrid',
    companyName: 'Reformas Ruiz y Hijos',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cli-2',
    name: 'María García Belmonte',
    contactPerson: 'María García',
    email: 'maria.garcia@gmail.com',
    phone: '+34 689 765 432',
    address: 'Avenida Diagonal 210',
    city: 'Barcelona',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cli-3',
    name: 'C.P. Calle Mayor 12',
    contactPerson: 'Marcos de Miguel (Presidente)',
    phone: '+34 654 321 098',
    address: 'Calle Mayor 12, Portal A',
    city: 'Madrid',
    companyName: 'Comunidad Propietarios Mayor 12',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const INITIAL_QUOTES: Quote[] = [
  {
    id: 'q-1',
    clientId: 'cli-1',
    clientName: 'José Ruiz S.L.',
    quoteNumber: 'PRE-2026-001',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    items: [
      { id: 'qi-1', description: 'Instalación completa de caldera de gas condensación Vaillant', quantity: 1, unitPrice: 1450.00, amount: 1450.00 },
      { id: 'qi-2', description: 'Kit de salida de humos horizontal coaxial calderas', quantity: 1, unitPrice: 120.00, amount: 120.00 },
      { id: 'qi-3', description: 'Mano de obra oficial técnico acreditado para montaje', quantity: 6, unitPrice: 40.00, amount: 240.00 }
    ],
    subtotal: 1810.00,
    taxRate: 21,
    taxAmount: 380.10,
    total: 2190.10,
    notes: 'Presupuesto condicionado a que los conductos de desagüe actuales sean compatibles.'
  },
  {
    id: 'q-2',
    clientId: 'cli-2',
    clientName: 'María García Belmonte',
    quoteNumber: 'PRE-2026-002',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'draft',
    items: [
      { id: 'qi-4', description: 'Mantenimiento preventivo anual equipos aire acondicionado split', quantity: 2, unitPrice: 75.00, amount: 150.00 },
      { id: 'qi-5', description: 'Carga parcial gas ecológico R410A de climatización', quantity: 1, unitPrice: 85.00, amount: 85.00 }
    ],
    subtotal: 235.00,
    taxRate: 21,
    taxAmount: 49.35,
    total: 284.35
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    quoteId: 'q-1',
    clientId: 'cli-1',
    clientName: 'José Ruiz S.L.',
    invoiceNumber: 'FAC-2026-001',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'unpaid',
    subtotal: 1810.00,
    taxRate: 21,
    taxAmount: 380.10,
    total: 2190.10
  }
];

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [quotes, setQuotes] = useState<Quote[]>(INITIAL_QUOTES);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);

  const router = useRouter();
  const segments = useSegments();

  // Navigation controller based on state
  useEffect(() => {
    const inAppGroup = segments[0] === '(tabs)' || segments[0] === 'create-quote' || segments[0] === 'preview-quote';
    
    if (!user) {
      // Not logged in -> redirect to login (index)
      if (inAppGroup || segments[0] === 'onboarding') {
        router.replace('/');
      }
    } else if (!user.isOnboarded) {
      // Logged in but not completed onboarding -> onboarding
      if (segments[0] !== 'onboarding') {
        router.replace('/onboarding');
      }
    } else {
      // Logged in & onboarded -> main screens
      if (segments[0] === '/' || segments[0] === 'onboarding' || !segments[0]) {
        router.replace('/(tabs)/dashboard');
      }
    }
  }, [user?.isOnboarded, !!user, segments]);

  const login = (email: string) => {
    setUser({
      id: 'usr-1',
      email: email,
      createdAt: new Date().toISOString(),
      isOnboarded: false,
    });
  };

  const logout = () => {
    setUser(null);
    setOrganization(null);
  };

  const saveOnboarding = (name: string, trade: string, city: string, phone: string, taxId?: string) => {
    const org: Organization = {
      id: 'org-1',
      name,
      trade,
      city,
      phone,
      taxId,
      defaultIva: 21
    };
    setOrganization(org);
    if (user) {
      setUser({ ...user, isOnboarded: true });
    }
  };

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setClients((prev) => [newClient, ...prev]);
    return newClient;
  };

  const addQuote = (
    clientId: string, 
    itemsData: Omit<Quote['items'][0], 'id'>[], 
    taxRate = organization?.defaultIva || 21,
    notes?: string
  ) => {
    const client = clients.find(c => c.id === clientId);
    const clientName = client ? client.name : 'Cliente desconocido';
    
    const items: Quote['items'] = itemsData.map((item, idx) => ({
      ...item,
      id: `qi-${Date.now()}-${idx}`,
      amount: item.quantity * item.unitPrice
    }));

    const subtotal = items.reduce((acc, current) => acc + current.amount, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    // Generation of code PRE-year-counter
    const year = new Date().getFullYear();
    const count = quotes.filter(q => q.createdAt.startsWith(year.toString())).length + 1;
    const quoteNumber = `PRE-${year}-${String(count).padStart(3, '0')}`;

    const newQuote: Quote = {
      id: `q-${Date.now()}`,
      clientId,
      clientName,
      quoteNumber,
      createdAt: new Date().toISOString(),
      status: 'draft',
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes
    };

    setQuotes((prev) => [newQuote, ...prev]);
    return newQuote;
  };

  const updateQuoteStatus = (quoteId: string, status: Quote['status']) => {
    setQuotes((prev) => 
      prev.map(q => q.id === quoteId ? { ...q, status } : q)
    );

    // TODO: Convertir presupuesto a factura automáticamente al marcar como 'accepted' (Flujo simulación)
    if (status === 'accepted') {
      const quote = quotes.find(q => q.id === quoteId);
      if (quote) {
        // Guard checking so we don't duplicate invoices in simulation
        const invoiceExists = invoices.some(i => i.quoteId === quoteId);
        if (!invoiceExists) {
          const year = new Date().getFullYear();
          const count = invoices.length + 1;
          const invoiceNumber = `FAC-${year}-${String(count).padStart(3, '0')}`;

          const newInvoice: Invoice = {
            id: `inv-${Date.now()}`,
            quoteId: quoteId,
            clientId: quote.clientId,
            clientName: quote.clientName,
            invoiceNumber,
            createdAt: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'unpaid',
            subtotal: quote.subtotal,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            total: quote.total
          };

          setInvoices((prev) => [newInvoice, ...prev]);
        }
      }
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      organization,
      clients,
      quotes,
      invoices,
      currentQuoteId,
      login,
      logout,
      saveOnboarding,
      addClient,
      addQuote,
      updateQuoteStatus,
      setCurrentQuoteId,
    }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppContext.Provider>
  );
}
