import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TouchableOpacity,
  Alert
} from 'react-native';
import { Briefcase, MapPin, Phone, Building, User, Check } from 'lucide-react-native';
import { useAppContext } from './_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../components/Theme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

const TRADES = [
  'Fontanería',
  'Electricidad',
  'Climatización',
  'Cerrajería',
  'Reformas Generales',
  'Pintura'
];

export default function OnboardingScreen() {
  const [businessName, setBusinessName] = useState('');
  const [selectedTrade, setSelectedTrade] = useState(TRADES[0]);
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState(''); // Optional NIF
  const [loading, setLoading] = useState(false);

  const { saveOnboarding } = useAppContext();

  const handleComplete = () => {
    if (!businessName.trim()) {
      Alert.alert('Falta información', 'Por favor, introduce el nombre de tu negocio o actividad.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Falta información', 'Indica tu ciudad o área de trabajo principal.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Falta información', 'Indica tu número de teléfono móvil para pruebas de dictado.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      saveOnboarding(
        businessName,
        selectedTrade,
        city,
        phone,
        taxId || undefined
      );
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Text style={TYPOGRAPHY.h1}>Configura tu Perfil</Text>
            <Text style={[TYPOGRAPHY.subtitle, { marginTop: 6, fontSize: 13 }]}>
              Completa los datos de tu actividad para personalizar las cabeceras de tus presupuestos en PDF.
            </Text>
          </View>

          {/* Logo Upload Placeholder */}
          <View style={styles.logoUploadContainer}>
            <View style={styles.logoCircle}>
              <Building size={32} color={COLORS.textSecondary} />
            </View>
            <TouchableOpacity style={styles.uploadLink} activeOpacity={0.7}>
              <Text style={styles.uploadLinkText}>Subir Logo del Negocio (Placeholder)</Text>
              <Text style={styles.uploadLinkSub}>Formatos PNG o JPG recomendados</Text>
            </TouchableOpacity>
          </View>

          {/* Fields Box */}
          <View style={[styles.card, SHADOWS.sm]}>
            <Input
              label="Nombre Comercial o Autónomo *"
              placeholder="Ej. Fontanería Martínez Sevilla"
              value={businessName}
              onChangeText={setBusinessName}
              icon={<Building size={16} />}
            />

            <Input
              label="Ciudad / Provincia Principal *"
              placeholder="Ej. Sevilla"
              value={city}
              onChangeText={setCity}
              icon={<MapPin size={16} />}
            />

            <Input
              label="Móvil (WhatsApp activo por IA) *"
              placeholder="Ej. +34 600 000 000"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              icon={<Phone size={16} />}
            />

            <Input
              label="NIF / CIF (Opcional para tus facturas)"
              placeholder="Ej. 12345678Z"
              autoCapitalize="characters"
              value={taxId}
              onChangeText={setTaxId}
            />

            {/* Trade Picker */}
            <Text style={[COMMON_STYLES.label, { marginBottom: 10 }]}>Oficio Principal *</Text>
            <View style={styles.tradesGrid}>
              {TRADES.map((trade) => {
                const isSelected = selectedTrade === trade;
                return (
                  <TouchableOpacity
                    key={trade}
                    onPress={() => setSelectedTrade(trade)}
                    style={[
                      styles.tradeBadge,
                      isSelected ? styles.tradeBadgeSelected : null
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.tradeText,
                      isSelected ? styles.tradeTextSelected : null
                    ]}>
                      {trade}
                    </Text>
                    {isSelected && <Check size={12} color={COLORS.white} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Button
            title="Activar Cuenta e Ir al Cuadro de Mando"
            onPress={handleComplete}
            loading={loading}
            style={{ marginBottom: 20 }}
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
    marginTop: 10,
  },
  logoUploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
    ...SHADOWS.xs,
  },
  logoCircle: {
    height: 56,
    width: 56,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uploadLink: {
    marginLeft: 16,
    flex: 1,
  },
  uploadLinkText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  uploadLinkSub: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 24,
  },
  tradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tradeBadgeSelected: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  tradeText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  tradeTextSelected: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
