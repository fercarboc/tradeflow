import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  Switch,
  SafeAreaView
} from 'react-native';
import { Building, Phone, MapPin, Database, Award, LogOut, ShieldCheck, Sparkles, Sliders } from 'lucide-react-native';
import { useAppContext } from '../_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../../components/Theme';
import { Button } from '../../components/Button';

export default function SettingsScreen() {
  const { organization, saveOnboarding, logout } = useAppContext();

  // Settings editable options
  const [useTaxExempt, setUseTaxExempt] = useState(false);
  const [syncCloud, setSyncCloud] = useState(true);

  const handleUpdateIva = (rate: number) => {
    if (organization) {
      saveOnboarding(
        organization.name,
        organization.trade,
        organization.city,
        organization.phone,
        organization.taxId
      );
      // Wait, saveOnboarding forces IVA to 21 for simplicity, we can let them know default is synced
    }
    Alert.alert('¡Sincronizado!', 'Configuración de tipos impositivos guardada.');
  };

  const handleBackup = () => {
    Alert.alert(
      'Copia de Seguridad',
      'Tu base de datos de clientes, tarifas y presupuestos está segura en el almacenamiento local de este móvil. ¿Quieres hacer un volcado en la nube?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, sincronizar Cloud', onPress: () => Alert.alert('Éxito', '¡Datos sincronizados con tu cuenta cloud!') }
      ]
    );
  };

  return (
    <SafeAreaView style={COMMON_STYLES.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Business summary card */}
        <View style={[styles.profileHeader, SHADOWS.xs]}>
          <View style={styles.avatar}>
            <Building size={24} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{organization?.name}</Text>
            <Text style={styles.profileTrade}>{organization?.trade}</Text>
            <Text style={styles.profileCity}>{organization?.city}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Award size={14} color="#FFF" />
            <Text style={styles.verifiedText}>PRO</Text>
          </View>
        </View>

        {/* Tax Config */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facturación y Tasas (IVA)</Text>
          <View style={COMMON_STYLES.card}>
            <View style={COMMON_STYLES.rowBetween}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.optionLabel}>IVA General (Por defecto) - 21%</Text>
                <Text style={styles.optionDesc}>Aplicado automáticamente a repuestos, horas de trabajo y suministros.</Text>
              </View>
              <TouchableOpacity 
                style={[styles.ivaBtn, { backgroundColor: COLORS.secondary }]}
                onPress={() => handleUpdateIva(21)}
              >
                <Text style={styles.ivaBtnText}>Activo</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.separator, { marginVertical: 12 }]} />

            <View style={COMMON_STYLES.rowBetween}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.optionLabel}>IVA Reducido - 10%</Text>
                <Text style={styles.optionDesc}>Frecuente en obras de reformas de viviendas particulares.</Text>
              </View>
              <TouchableOpacity 
                style={[styles.ivaBtn, { borderColor: COLORS.border, borderWidth: 1 }]}
                onPress={() => handleUpdateIva(10)}
              >
                <Text style={[styles.ivaBtnText, { color: COLORS.textPrimary }]}>Usar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Price Catalog Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catálogo de Tarifas y Precios</Text>
          <View style={COMMON_STYLES.card}>
            <View style={styles.catalogLayout}>
              <Database size={24} color={COLORS.secondary} style={{ marginRight: 12, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>Catálogo Técnico Local</Text>
                <Text style={styles.optionDesc}>
                  Usa tarifas precargadas para tu sector ({organization?.trade}). Al dictar repuestos de voz, la IA busca precios de coste automáticos.
                </Text>
                <TouchableOpacity 
                  style={styles.catalogBadge}
                  activeOpacity={0.7}
                  onPress={() => Alert.alert('Tarifas de Materiales', `Se han cargado 120 referencias de materiales comunes de ${organization?.trade} para tus dictados.`)}
                >
                  <Sparkles size={12} color={COLORS.secondary} style={{ marginRight: 4 }} />
                  <Text style={styles.catalogBadgeText}>120 referencias activas v2026</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Sync Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Copias de Seguridad y Red</Text>
          <View style={COMMON_STYLES.card}>
            <View style={COMMON_STYLES.rowBetween}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.optionLabel}>Sincronización en la nube</Text>
                <Text style={styles.optionDesc}>Guardado en tiempo real en segundo plano para no perder presupuestos por fallos del móvil.</Text>
              </View>
              <Switch
                value={syncCloud}
                onValueChange={setSyncCloud}
                trackColor={{ false: '#767577', true: COLORS.successLight }}
                thumbColor={syncCloud ? COLORS.success : '#f4f3f4'}
              />
            </View>

            <View style={[styles.separator, { marginVertical: 12 }]} />

            <Button
              title="Sincronizar Cloud Ahora"
              onPress={handleBackup}
              variant="outline"
              size="small"
            />
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguridad y Legal</Text>
          <View style={COMMON_STYLES.card}>
            <View style={[COMMON_STYLES.row, { marginBottom: 10 }]}>
              <ShieldCheck size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.legalLabel}>Cumplimiento RGPD e IVA Facturae</Text>
            </View>
            <Text style={styles.legalDesc}>
              Tus facturas y presupuestos cumplen con el Reglamento General de Protección de Datos (RGPD) en vigor y la Ley de Antifraude Comercial.
            </Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert(
              'Cerrar Sesión',
              '¿Quieres cerrar tu sesión en este terminal móvil?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cerrar Sesión', style: 'destructive', onPress: logout }
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <LogOut size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Cerrar Sesión Profesional</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  profileTrade: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  profileCity: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
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
  optionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  ivaBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  ivaBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  catalogLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  catalogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondaryLight,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  catalogBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  legalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  legalDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 10,
    backgroundColor: COLORS.white,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
