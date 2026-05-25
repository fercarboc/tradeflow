import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Image 
} from 'react-native';
import { Sparkles, MessageSquare, Mic, ArrowRight } from 'lucide-react-native';
import { useAppContext } from './_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../components/Theme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAppContext();

  const handleLogin = () => {
    if (!email) {
      setError('Por favor, indica tu correo electrónico');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Introduce un correo electrónico válido');
      return;
    }

    setError('');
    setLoading(true);

    // Simulate magic link delay
    setTimeout(() => {
      setLoading(false);
      login(email);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Logo & Headline */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadge}>
              <Sparkles size={24} color={COLORS.secondary} />
            </View>
            <Text style={styles.appName}>TradeFlow AI</Text>
            <Text style={styles.tagline}>La herramienta de presupuestos por voz diseñada para instaladores autónomos</Text>
          </View>

          {/* Form Container */}
          <View style={[styles.card, SHADOWS.sm]}>
            <Text style={styles.cardTitle}>Inicia sesión o regístrate</Text>
            <Text style={styles.cardSubtitle}>Te enviaremos un enlace mágico (Magic Link) para entrar instantáneamente sin contraseñas.</Text>

            <Input
              label="Correo Electrónico de Trabajo"
              placeholder="ejemplo@fontaneriamartinez.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              error={error}
            />

            <Button
              title="Recibir Enlace Mágico por Email"
              onPress={handleLogin}
              loading={loading}
              icon={<ArrowRight size={18} color={COLORS.white} />}
            />
          </View>

          {/* Value Props Grid */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>¿Por qué usar TradeFlow AI?</Text>
            
            <View style={styles.featureRow}>
              <View style={[styles.featureIconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Mic size={18} color={COLORS.secondary} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTextTitle}>Presupuestos por voz</Text>
                <Text style={styles.featureTextDesc}>Dicta tus repuestos y horas de mano de obra en el tajo desde WhatsApp sin abrir el ordenador.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIconContainer, { backgroundColor: '#ECFDF5' }]}>
                <MessageSquare size={18} color={COLORS.success} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTextTitle}>Envío inmediato por WhatsApp</Text>
                <Text style={styles.featureTextDesc}>Tus clientes reciben una propuesta limpia en PDF móvil que pueden aceptar online con un solo toque.</Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>TradeFlow AI • Lista de Espera Beta Cerrada v1.0</Text>
          </View>

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
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  logoBadge: {
    height: 56,
    width: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  appName: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 290,
    lineHeight: 19,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 20,
  },
  featuresSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIconContainer: {
    height: 36,
    width: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTextTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  featureTextDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
