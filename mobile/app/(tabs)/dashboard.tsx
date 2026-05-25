import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Send, Clock, CheckCircle2, AlertCircle, FileSpreadsheet, Plus } from 'lucide-react-native';
import { useAppContext } from '../_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../../components/Theme';
import { Button } from '../../components/Button';

export default function DashboardScreen() {
  const router = useRouter();
  const { organization, quotes, invoices, clients, setCurrentQuoteId } = useAppContext();

  // Financial calculations
  const totalQuotesSent = quotes
    .filter(q => q.status === 'sent' || q.status === 'accepted')
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalInvoicesPending = invoices
    .filter(i => i.status === 'unpaid')
    .reduce((acc, curr) => acc + curr.total, 0);

  const handleEditOrCreateQuote = (id?: string) => {
    if (id) {
      setCurrentQuoteId(id);
      router.push('/preview-quote');
    } else {
      setCurrentQuoteId(null);
      router.push('/create-quote');
    }
  };

  return (
    <SafeAreaView style={COMMON_STYLES.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Welcome Block */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>¡Hola, {organization?.name || 'Profesional'}!</Text>
          <Text style={styles.tradeSub}>{organization?.trade} • {organization?.city}</Text>
        </View>

        {/* Action button */}
        <View style={styles.mainActionBox}>
          <Button
            title="Nuevo Presupuesto por Voz"
            onPress={() => handleEditOrCreateQuote()}
            icon={<Plus size={18} color={COLORS.white} />}
            variant="primary"
          />
        </View>

        {/* Bento Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Box 1: Quotes */}
          <View style={[styles.statItem, SHADOWS.xs]}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Send size={18} color={COLORS.secondary} />
            </View>
            <Text style={styles.statLabel}>Propuestas Enviadas</Text>
            <Text style={styles.statValue}>
              {totalQuotesSent.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </Text>
            <Text style={styles.statSubtitle}>
              {quotes.filter(q => q.status === 'sent' || q.status === 'accepted').length} presupuestos activos
            </Text>
          </View>

          {/* Box 2: Invoices */}
          <View style={[styles.statItem, SHADOWS.xs]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Clock size={18} color={COLORS.warning} />
            </View>
            <Text style={styles.statLabel}>Facturas Pendientes</Text>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>
              {totalInvoicesPending.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </Text>
            <Text style={styles.statSubtitle}>
              {invoices.filter(i => i.status === 'unpaid').length} cobros pendientes
            </Text>
          </View>
        </View>

        {/* Recent Quotes Feed */}
        <View style={styles.sectionContainer}>
          <View style={COMMON_STYLES.rowBetween}>
            <Text style={styles.sectionTitle}>Presupuestos Recientes</Text>
            <TouchableOpacity onPress={() => handleEditOrCreateQuote()}>
              <Text style={styles.viewAllText}>Crear</Text>
            </TouchableOpacity>
          </View>

          {quotes.length === 0 ? (
            <View style={styles.emptyBox}>
              <FileSpreadsheet size={36} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No has creado presupuestos todavía.</Text>
            </View>
          ) : (
            quotes.map((quote) => {
              const statusColors = {
                draft: { bg: '#E2E8F0', text: COLORS.textSecondary, label: 'Borrador' },
                sent: { bg: '#EFF6FF', text: COLORS.secondary, label: 'Enviado' },
                accepted: { bg: '#ECFDF5', text: COLORS.success, label: 'Aceptado' },
                declined: { bg: '#FEF2F2', text: COLORS.danger, label: 'Rechazado' }
              }[quote.status];

              return (
                <TouchableOpacity
                  key={quote.id}
                  style={[COMMON_STYLES.card, styles.interactiveQuoteCard]}
                  onPress={() => handleEditOrCreateQuote(quote.id)}
                  activeOpacity={0.7}
                >
                  <View style={COMMON_STYLES.rowBetween}>
                    <View>
                      <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
                      <Text style={styles.clientName}>{quote.clientName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.quoteAmount}>
                        {quote.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                        <Text style={[styles.statusText, { color: statusColors.text }]}>
                          {statusColors.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.quoteDate}>
                    Creado el {new Date(quote.createdAt).toLocaleDateString('es-ES')}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Recent Invoices Feed */}
        <View style={[styles.sectionContainer, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Últimas Facturas / Cobros</Text>

          {invoices.length === 0 ? (
            <View style={styles.emptyBox}>
              <CheckCircle2 size={36} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No hay facturas vigentes.</Text>
            </View>
          ) : (
            invoices.map((invoice) => {
              const isPaid = invoice.status === 'paid';
              return (
                <View key={invoice.id} style={COMMON_STYLES.card}>
                  <View style={COMMON_STYLES.rowBetween}>
                    <View>
                      <Text style={styles.quoteNumber}>{invoice.invoiceNumber}</Text>
                      <Text style={styles.clientName}>{invoice.clientName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.quoteAmount, isPaid ? { color: COLORS.success } : null]}>
                        {invoice.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </Text>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: isPaid ? '#ECFDF5' : '#FEF3C7' }
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          { color: isPaid ? COLORS.success : COLORS.warning }
                        ]}>
                          {isPaid ? 'Pagado' : 'Pendiente cobro'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.quoteDate}>
                    Vence el {new Date(invoice.dueDate).toLocaleDateString('es-ES')}
                  </Text>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeContainer: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  tradeSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mainActionBox: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  iconCircle: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  interactiveQuoteCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  quoteNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  clientName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  quoteAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  quoteDate: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
