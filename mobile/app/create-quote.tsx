import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, Trash2, Milestone, ArrowRight, User } from 'lucide-react-native';
import { useAppContext } from './_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../components/Theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { MicButton } from '../components/MicButton';

interface SimpleItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function CreateQuoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { clients, organization, addQuote, setCurrentQuoteId } = useAppContext();

  // Selected client
  const [clientId, setClientId] = useState('');
  
  // Custom manual item form state
  const [manualDesc, setManualDesc] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualPrice, setManualPrice] = useState('');

  // Items in active quote
  const [items, setItems] = useState<SimpleItem[]>([]);
  const [notes, setNotes] = useState('');

  // Handle client preselector if routed with parameters
  useEffect(() => {
    if (params.selectedClientId && typeof params.selectedClientId === 'string') {
      setClientId(params.selectedClientId);
    } else if (clients.length > 0) {
      setClientId(clients[0].id); // Default to first client
    }
  }, [params.selectedClientId, clients]);

  // Append manual item
  const handleAddManualItem = () => {
    if (!manualDesc.trim()) {
      Alert.alert('Escribe una descripción', 'La descripción del suministro o tarea es requerida.');
      return;
    }
    const qtyNum = parseFloat(manualQty) || 1;
    const priceNum = parseFloat(manualPrice) || 0;

    if (priceNum <= 0) {
      Alert.alert('Precio inválido', 'Por favor, introduce un precio válido mayor a 0€.');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        description: manualDesc.trim(),
        quantity: qtyNum,
        unitPrice: priceNum
      }
    ]);

    // Clear item inputs
    setManualDesc('');
    setManualQty('1');
    setManualPrice('');
    try { Alert.alert('Línea añadida', 'Se ha guardado tu línea de coste.'); } catch (_) {}
  };

  // Append items found from MicButton transcription simulation
  const handleMicTranscriptFound = (parsedItems: SimpleItem[]) => {
    setItems((prev) => [...prev, ...parsedItems]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculate totals
  const subtotal = items.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
  const taxRate = organization?.defaultIva || 21;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  // Process and save
  const handleCreatePreview = () => {
    if (!clientId) {
      Alert.alert('Selecciona un cliente', 'Debes asignar un cliente para expedir el presupuesto.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Presupuesto vacío', 'Añade al menos una partida de material o mano de obra dictada o manual.');
      return;
    }

    // Save using context provider
    const newQuote = addQuote(
      clientId,
      items,
      taxRate,
      notes.trim() || undefined
    );

    // Set active quote inside state context and redirect to preview!
    setCurrentQuoteId(newQuote.id);
    router.replace('/preview-quote');
  };

  return (
    <SafeAreaView style={COMMON_STYLES.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Navigation Toolbar */}
        <View style={styles.topNav}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Crear Presupuesto</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Client Pre-selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Asignar Cliente del Presupuesto</Text>
            <View style={COMMON_STYLES.card}>
              <Text style={COMMON_STYLES.label}>Cliente Destinatario *</Text>
              <View style={styles.selectWrapper}>
                <User size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  {clients.length === 0 ? (
                    <Text style={styles.selectPlaceholder}>No hay clientes. Créalos primero en la pestaña Clientes</Text>
                  ) : (
                    <View style={styles.clientsSelectContainer}>
                      {clients.map((c) => {
                        const isSelected = clientId === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => setClientId(c.id)}
                            style={[
                              styles.clientSelectBadge,
                              isSelected ? styles.clientSelectBadgeSelected : null
                            ]}
                          >
                            <Text style={[
                              styles.clientSelectBadgeText,
                              isSelected ? styles.clientSelectBadgeTextSelected : null
                            ]}>
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* AI VOICE ROW */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Dictado Rápido con IA (Recomendado)</Text>
            <MicButton 
              onTranscriptFound={handleMicTranscriptFound}
              trade={organization?.trade || 'Fontanería'}
            />
          </View>

          {/* Lines Preview Feed */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Líneas Actuales del Presupuesto ({items.length})</Text>
            {items.length === 0 ? (
              <View style={styles.emptyLines}>
                <Text style={styles.emptyLinesText}>Aún no hay partidas. Dicta por voz arriba o añádelas manualmente abajo.</Text>
              </View>
            ) : (
              <View style={styles.linesList}>
                {items.map((item, index) => (
                  <View key={index} style={styles.lineItem}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.lineDesc}>{item.description}</Text>
                      <Text style={styles.lineQtyPrice}>
                        {item.quantity} ud x {item.unitPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                      <Text style={styles.lineAmount}>
                        {(item.quantity * item.unitPrice).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => handleRemoveItem(index)}
                        style={styles.deleteLineBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={14} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Subtotal preview block */}
                <View style={styles.totalsSummary}>
                  <View style={COMMON_STYLES.rowBetween}>
                    <Text style={styles.totalSummaryLabel}>Subtotal:</Text>
                    <Text style={styles.totalSummaryValue}>
                      {subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </Text>
                  </View>
                  <View style={[COMMON_STYLES.rowBetween, { marginTop: 4 }]}>
                    <Text style={styles.totalSummaryLabel}>IVA ({taxRate}%):</Text>
                    <Text style={styles.totalSummaryValue}>
                      {taxAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </Text>
                  </View>
                  <View style={styles.totalHr} />
                  <View style={COMMON_STYLES.rowBetween}>
                    <Text style={[styles.totalSummaryLabel, { fontWeight: 'bold', color: COLORS.textPrimary }]}>Total Presupuesto:</Text>
                    <Text style={[styles.totalSummaryValue, { fontWeight: 'bold', color: COLORS.secondary, fontSize: 16 }]}>
                      {total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Add Manual Item Block */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Añadir Partida Manualmente</Text>
            <View style={COMMON_STYLES.card}>
              <Input
                label="Concepto / Suministro *"
                placeholder="Ej. Suministro y montaje grifería lavabo mod. Roca"
                value={manualDesc}
                onChangeText={setManualDesc}
              />
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Cantidad"
                    placeholder="1"
                    keyboardType="numeric"
                    value={manualQty}
                    onChangeText={setManualQty}
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Input
                    label="Precio Unid. (€) *"
                    placeholder="45.00"
                    keyboardType="numeric"
                    value={manualPrice}
                    onChangeText={setManualPrice}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.addManualBtn} 
                onPress={handleAddManualItem}
                activeOpacity={0.8}
              >
                <Plus size={16} color={COLORS.secondary} />
                <Text style={styles.addManualBtnText}>Añadir Partida Manual</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes Block */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Notas o Cláusulas del Presupuesto (Opcional)</Text>
            <View style={COMMON_STYLES.card}>
              <TextInput
                placeholder="Ej. Plazo estimado para realizar la obra: 2 días. Pago a la aceptación."
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                style={styles.textarea}
              />
            </View>
          </View>

          {/* Main Action Button */}
          <View style={{ marginTop: 12, marginBottom: 40 }}>
            <Button
              title="Generar y Ver Vista Previa"
              onPress={handleCreatePreview}
              icon={<ArrowRight size={18} color={COLORS.white} />}
              variant="success"
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  selectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectPlaceholder: {
    fontSize: 12,
    color: COLORS.danger,
  },
  clientsSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  clientSelectBadge: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clientSelectBadgeSelected: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  clientSelectBadgeText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  clientSelectBadgeTextSelected: {
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
  emptyLines: {
    padding: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyLinesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  linesList: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    ...SHADOWS.xs,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lineDesc: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  lineQtyPrice: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lineAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  deleteLineBtn: {
    marginTop: 6,
    padding: 2,
  },
  totalsSummary: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 12,
  },
  totalSummaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  totalSummaryValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.textPrimary,
  },
  totalHr: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  addManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 6,
  },
  addManualBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  textarea: {
    minHeight: 68,
    borderRadius: 6,
    backgroundColor: COLORS.card,
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
    padding: 12,
  },
});
