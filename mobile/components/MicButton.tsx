import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Vibration 
} from 'react-native';
import { Mic, Check, Square, Sparkles } from 'lucide-react-native';
import { COLORS, SHADOWS } from './Theme';

interface MicButtonProps {
  onTranscriptFound: (items: Array<{ description: string; quantity: number; unitPrice: number }>) => void;
  trade: string; // Used to customize simulated outcome
}

export const MicButton: React.FC<MicButtonProps> = ({ onTranscriptFound, trade }) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'done'>('idle');
  const [dots, setDots] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'listening') {
      interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handlePress = () => {
    if (status === 'idle') {
      // Start listening
      setStatus('listening');
      try { Vibration.vibrate(100); } catch (_) {}
      
      // Simulate listening for 3.5 seconds
      setTimeout(() => {
        setStatus('processing');
        // Simulate speech recognition & LLM processing for 2 seconds
        setTimeout(() => {
          setStatus('done');
          
          // Generate realistic items based on selected trade
          let simulatedItems: Array<{ description: string; quantity: number; unitPrice: number }> = [];
          
          if (trade === 'Fontanería') {
            simulatedItems = [
              { description: 'Mano de obra urgente: Localización y saneado de fuga', quantity: 1, unitPrice: 85 },
              { description: 'Tubo de cobre 18mm más racores soldados de unión', quantity: 3, unitPrice: 12 },
              { description: 'Llave de paso general bola 1/2 pulgada latón', quantity: 1, unitPrice: 24.50 }
            ];
          } else if (trade === 'Electricidad') {
            simulatedItems = [
              { description: 'Instalación cuadro eléctrico ICP + protección diferencial', quantity: 1, unitPrice: 175 },
              { description: 'Magnetotérmico estrecho Siemens 16A Clase AC', quantity: 2, unitPrice: 18.20 },
              { description: 'Mano de obra oficial técnico electricista autorizado', quantity: 3.5, unitPrice: 42 }
            ];
          } else if (trade === 'Climatización' || trade === 'HVAC') {
            simulatedItems = [
              { description: 'Carga completa de gas refrigerante R32 ecológico split', quantity: 1, unitPrice: 120 },
              { description: 'Soporte metálico escuadra exterior con dampers antivibración', quantity: 1, unitPrice: 35 },
              { description: 'Limpieza e higienización de filtros y conductos Clima', quantity: 1, unitPrice: 50 },
              { description: 'Mano de obra especialista frigorista', quantity: 2, unitPrice: 45 }
            ];
          } else {
            // General trade or others
            simulatedItems = [
              { description: 'Mano de obra especializada técnica', quantity: 4, unitPrice: 35 },
              { description: 'Materiales varios de reposición y acoplamiento', quantity: 1, unitPrice: 48 },
              { description: 'Desplazamiento técnico de urgencia', quantity: 1, unitPrice: 25 }
            ];
          }

          onTranscriptFound(simulatedItems);
          try { Vibration.vibrate([0, 100, 100, 100]); } catch (_) {}

          // Back to idle after showing success
          setTimeout(() => {
            setStatus('idle');
          }, 2500);

        }, 2000);
      }, 3500);
    } else if (status === 'listening') {
      // Cancel/Stop early
      setStatus('idle');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={status === 'processing' || status === 'done'}
        style={[
          styles.button,
          status === 'listening' ? styles.listening : null,
          status === 'processing' ? styles.processing : null,
          status === 'done' ? styles.done : null,
        ]}
        activeOpacity={0.8}
      >
        {status === 'idle' && <Mic color={COLORS.white} size={28} />}
        {status === 'listening' && <Square color={COLORS.white} size={24} />}
        {status === 'processing' && <ActivityIndicator color={COLORS.white} size="small" />}
        {status === 'done' && <Check color={COLORS.white} size={28} />}
      </TouchableOpacity>

      <View style={styles.textContainer}>
        {status === 'idle' && (
          <View style={styles.row}>
            <Sparkles size={14} color={COLORS.secondary} style={{ marginRight: 4 }} />
            <Text style={styles.label}>Simular dictado de voz por IA</Text>
          </View>
        )}
        {status === 'listening' && (
          <Text style={[styles.label, { color: COLORS.danger, fontWeight: 'bold' }]}>
            Escuchando tu voz{dots}
          </Text>
        )}
        {status === 'processing' && (
          <Text style={[styles.label, { color: COLORS.warning, fontWeight: 'bold' }]}>
            IA de TradeFlow estructurando datos...
          </Text>
        )}
        {status === 'done' && (
          <Text style={[styles.label, { color: COLORS.success, fontWeight: 'bold' }]}>
            ¡Líneas añadidas mágicamente!
          </Text>
        )}

        <Text style={styles.subLabel}>
          {status === 'idle' && "Pulsa y habla: 'Fuga arreglada en cocina de Carlos, cambié llave paso y 3m de tubo'"}
          {status === 'listening' && "Simulando micrófono activo. Di el trabajo hecho en voz alta..."}
          {status === 'processing' && "Interpretando mano de obra, materiales y cantidades..."}
          {status === 'done' && "Sincronizado con el presupuesto actual."}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    padding: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  button: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...SHADOWS.md,
  },
  listening: {
    backgroundColor: COLORS.danger,
    transform: [{ scale: 1.08 }],
  },
  processing: {
    backgroundColor: COLORS.warning,
  },
  done: {
    backgroundColor: COLORS.success,
  },
  textContainer: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 15,
  },
});
