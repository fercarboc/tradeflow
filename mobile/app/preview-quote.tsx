import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  Linking,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, CheckCircle2, Award, FileText, Phone, Building, User, MapPin } from 'lucide-react-native';
import { useAppContext } from './_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../components/Theme';
import { Button } from '../components/Button';

export default function PreviewQuoteScreen() {
  const router = useRouter();
  const { quotes, organization, clients, updateQuoteStatus, currentQuoteId } = useAppContext();

  // Find the quote to preview (fallback to last quote if no id)
  const quote = quotes.find(q => q.id === currentQuoteId) || quotes[0];

  if (!quote) {
    return (
      <SafeAreaView style={COMMON_STYLES.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={TYPOGRAPHY.body}>No se ha seleccionado ningún presupuesto activo.</Text>
          <Button title="Volver al Inicio" onPress={() => router.replace('/(tabs)/dashboard')} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  // Find recipient client details
  const client = clients.find(c => c.id === quote.clientId);

  const handleSendWhatsApp = () => {
    const formattedTotal = quote.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    const message = `Hola %2a${client?.name || 'Cliente'}%2a. Te presento el %2apresupuesto ${quote.quoteNumber}%2a de %2a${organization?.name || 'TradeFlow Instalador'}%2a por un importe total de %2a${formattedTotal}%2a (%2aIVA incl.%2a). Puedes revisarlo aquí: https://tradeflow.ai/preview/${quote.id}`;
    
    const phoneNo = client?.phone.replace(/[^0-9]/g, ''); // sanitize phone to raw digits
    const whatsappUrl = `whatsapp://send?phone=${phoneNo}&text=${message}`;

    // Test URL opening securely
    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(whatsappUrl);
        } else {
          // If WhatsApp isn't installed in simulated environment, show custom mock text
          Alert.alert(
            'Ejemplo de Envío por WhatsApp',
            `Como WhatsApp no está disponible en este simulador, aquí tienes el mensaje formateado que recibiría el cliente:\n\n"${decodeURIComponent(message)}"`,
            [{ text: 'Entendido, genial' }]
          );
        }
      })
      .catch(() => {
        Alert.alert('Error', 'No se pudo simular la apertura de WhatsApp.');
      });
  };

  const handleMarkAccepted = () => {
    updateQuoteStatus(quote.id, 'accepted');
    Alert.alert(
      'Presupuesto Aceptado',
      `¡Enhorabuena! El presupuesto ${quote.quoteNumber} ha sido aceptado por el cliente. De forma automática, TradeFlow AI ha generado la correspondiente Factura y lo ha añadido en tu módulo de Ajustes/Facturación.`,
      [{ text: 'Ir al Dashboard', onPress: () => router.replace('/(tabs)/dashboard') }]
    );
  };

  return (
    <SafeAreaView style={COMMON_STYLES.safeArea}>
      {/* Top navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)/dashboard')} 
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Vista Previa de Presupuesto</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Status Indicator Bar */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>Estado de Propuesta:</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: quote.status === 'accepted' ? '#ECFDF5' : '#EFF6FF' }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: quote.status === 'accepted' ? COLORS.success : COLORS.secondary }
            ]}>
              {quote.status === 'accepted' ? 'Aceptado por Cliente (Facturado)' : 'Pendiente de Envío'}
            </Text>
          </View>
        </View>

        {/* Commercial Invoice Template Canvas */}
        <View style={[styles.invoiceCanvas, SHADOWS.md]}>
          
          {/* Header Block */}
          <View style={styles.invoiceHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bizName}>{organization?.name || 'Mi Empresa de Instalaciones'}</Text>
              <Text style={styles.bizTrade}>{organization?.trade} Profesional</Text>
              <Text style={styles.bizPhone}>Móvil: {organization?.phone}</Text>
              {organization?.taxId ? <Text style={styles.bizTax}>NIF: {organization?.taxId}</Text> : null}
            </View>
            <View style={styles.invoiceDocDetails}>
              <Text style={styles.docType}>PRESUPUESTO</Text>
              <Text style={styles.docNo}>{quote.quoteNumber}</Text>
              <Text style={styles.docDate}>Fecha: {new Date(quote.createdAt).toLocaleDateString('es-ES')}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Recipient Block */}
          <View style={styles.recipientHeader}>
            <Text style={styles.recipientTitle}>DATOS DEL CLIENTE / RECEPTOR:</Text>
            <View style={styles.recipientBox}>
              <Text style={styles.recipientName}>{quote.clientName}</Text>
              {client?.contactPerson ? <Text style={styles.recipientSub}>Atención: {client.contactPerson}</Text> : null}
              <Text style={styles.recipientSub}>Teléfono: {client?.phone}</Text>
              {client?.email ? <Text style={styles.recipientSub}>Email: {client.email}</Text> : null}
              {client?.address ? (
                <Text style={styles.recipientSub}>Dirección: {client.address} ({client.city || ''})</Text>
              ) : null}
            </View>
          </View>

          {/* Itemized Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Descripción Partida</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'center' }]}>Ud.</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>Precio</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>Total</Text>
          </View>

          {/* Itemized Table Rows */}
          {quote.items.map((item, index) => (
            <View key={item.id || index} style={styles.tableRow}>
              <Text style={[styles.tableRowCell, { flex: 2, fontWeight: 'bold' }]}>{item.description}</Text>
              <Text style={[styles.tableRowCell, { flex: 0.5, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[styles.tableRowCell, { flex: 0.8, textAlign: 'right' }]}>
                {item.unitPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.tableRowCell, { flex: 0.8, textAlign: 'right', fontWeight: 'bold' }]}>
                {item.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </Text>
            </View>
          ))}

          {/* Financial Totals block */}
          <View style={styles.invoiceFooter}>
            <View style={styles.footerNoteContainer}>
              <Text style={styles.footerNoteTitle}>Condiciones de Servicio:</Text>
              <Text style={styles.footerNoteText}>
                {quote.notes || 'Precios vigentes durante 30 días. Forma de pago a convenir con el instalador.'}
              </Text>
            </View>

            <View style={styles.totalsTable}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalVal}>{quote.subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>IVA ({quote.taxRate}%):</Text>
                <Text style={styles.totalVal}>{quote.taxAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { fontWeight: 'bold', color: COLORS.textPrimary }]}>Total Importe:</Text>
                <Text style={[styles.totalVal, { fontWeight: 'bold', color: COLORS.secondary, fontSize: 15 }]}>
                  {quote.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </Text>
              </View>
            </View>
          </View>

        </View>

        {/* Call-to-actions Footer Panel */}
        <View style={styles.actionToolbar}>
          <Button
            title="Enviar presupuesto por WhatsApp"
            onPress={handleSendWhatsApp}
            icon={<Send size={18} color={COLORS.white} />}
            variant="primary"
            style={{ marginBottom: 12 }}
          />

          {quote.status !== 'accepted' && (
            <Button
              title="Marcar como Aceptado por Cliente"
              onPress={handleMarkAccepted}
              icon={<CheckCircle2 size={18} color={COLORS.white} />}
              variant="success"
              style={{ marginBottom: 20 }}
            />
          )}

          <TouchableOpacity 
            onPress={() => router.replace('/(tabs)/dashboard')}
            style={styles.cancelLink}
          >
            <Text style={styles.cancelLinkText}>Volver al Panel de Inicio</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topNav: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  invoiceCanvas: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 24,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bizName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  bizTrade: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bizPhone: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  bizTax: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  invoiceDocDetails: {
    alignItems: 'flex-end',
  },
  docType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.secondary,
    letterSpacing: 0.5,
  },
  docNo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  docDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  recipientHeader: {
    marginBottom: 20,
  },
  recipientTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  recipientBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  recipientName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  recipientSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowCell: {
    fontSize: 11,
    color: COLORS.textPrimary,
  },
  invoiceFooter: {
    flexDirection: 'column',
    marginTop: 20,
    gap: 16,
  },
  footerNoteContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
  },
  footerNoteTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  footerNoteText: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    lineHeight: 14,
  },
  totalsTable: {
    alignSelf: 'flex-end',
    width: '100%',
    maxWidth: 220,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  totalVal: {
    fontSize: 11.5,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  totalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  actionToolbar: {
    marginBottom: 40,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
