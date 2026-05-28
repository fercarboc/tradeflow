import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Vibration,
  Platform,
  Alert,
} from 'react-native';
import { Mic, Check, Square, Sparkles, AlertCircle } from 'lucide-react-native';
import { COLORS, SHADOWS } from './Theme';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface AIPartida {
  concepto: string;
  descripcion: string;
  oficio: string;
  tipo_partida: 'mano_obra' | 'material' | 'servicio';
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  requiere_revision: boolean;
}

export interface AIQuoteResult {
  resumen: {
    texto_original: string;
    tipo_presupuesto: string;
    requiere_revision_general: boolean;
    alertas: string[];
  };
  oficios_detectados: Array<{ oficio: string; tarifa_hora: { recomendado: number } }>;
  partidas: AIPartida[];
  calculos: { subtotal: number; iva: number; total: number };
}

interface MicButtonProps {
  onQuoteReady: (partidas: AIPartida[], transcript: string) => void;
  accessToken?: string;
}

export const MicButton: React.FC<MicButtonProps> = ({ onQuoteReady, accessToken }) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'done' | 'error'>('idle');
  const [dots, setDots] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Web recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  // Native recording ref (expo-av)
  const recordingRef = useRef<unknown>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'listening') {
      interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [status]);

  const token = accessToken || SUPABASE_ANON;

  // ── Enviar audio a la edge function ──────────────────────────────────────
  const sendAudioToAPI = async (audioBlob: Blob, mimeType: string) => {
    if (!SUPABASE_URL) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL no configurada en .env');
    }
    const formData = new FormData();
    const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
    formData.append('audio', audioBlob as unknown as Blob, `audio.${ext}`);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-voice-to-quote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
      throw new Error(err.error ?? `Error ${res.status}`);
    }

    return res.json() as Promise<{ transcript: string; quote: AIQuoteResult }>;
  };

  // ── Iniciar grabación ─────────────────────────────────────────────────────
  const startRecording = async () => {
    setStatus('listening');
    setErrorMsg('');
    try { Vibration.vibrate(80); } catch (_) {}

    if (Platform.OS === 'web') {
      // Web: MediaRecorder API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(250);
    } else {
      // Native: expo-av (requiere: npx expo install expo-av)
      try {
        const { Audio } = await import('expo-av');
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
      } catch (e: unknown) {
        const msg = (e as Error).message ?? '';
        if (msg.includes('Cannot find module') || msg.includes('expo-av')) {
          throw new Error('Instala expo-av: npx expo install expo-av');
        }
        throw e;
      }
    }
  };

  // ── Detener grabación y procesar ──────────────────────────────────────────
  const stopAndProcess = async () => {
    setStatus('processing');

    let audioBlob: Blob;
    let mimeType: string;

    if (Platform.OS === 'web') {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      mimeType = recorder.mimeType || 'audio/webm';
      audioBlob = await new Promise<Blob>(resolve => {
        recorder.onstop = () => resolve(new Blob(audioChunksRef.current, { type: mimeType }));
        recorder.stop();
        recorder.stream.getTracks().forEach(t => t.stop());
      });
    } else {
      const { Audio } = await import('expo-av');
      const recording = recordingRef.current as InstanceType<typeof Audio.Recording>;
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI() ?? '';
      const fileRes = await fetch(uri);
      audioBlob = await fileRes.blob();
      mimeType = 'audio/m4a';
      recordingRef.current = null;
    }

    try {
      const { transcript, quote } = await sendAudioToAPI(audioBlob, mimeType);
      setStatus('done');
      try { Vibration.vibrate([0, 80, 80, 80]); } catch (_) {}
      onQuoteReady(quote.partidas ?? [], transcript);
      setTimeout(() => setStatus('idle'), 2500);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? 'Error al procesar el audio';
      setErrorMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const handlePress = async () => {
    if (status === 'idle' || status === 'error') {
      try {
        await startRecording();
      } catch (e: unknown) {
        const msg = (e as Error).message ?? 'No se puede acceder al micrófono';
        setErrorMsg(msg);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 4000);
      }
    } else if (status === 'listening') {
      await stopAndProcess();
    }
  };

  const buttonStyle = [
    styles.button,
    status === 'listening'  && styles.listening,
    status === 'processing' && styles.processing,
    status === 'done'       && styles.done,
    status === 'error'      && styles.errorBtn,
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={status === 'processing'}
        style={buttonStyle}
        activeOpacity={0.8}
      >
        {status === 'idle'       && <Mic         color={COLORS.white} size={28} />}
        {status === 'listening'  && <Square      color={COLORS.white} size={24} />}
        {status === 'processing' && <ActivityIndicator color={COLORS.white} size="small" />}
        {status === 'done'       && <Check       color={COLORS.white} size={28} />}
        {status === 'error'      && <AlertCircle color={COLORS.white} size={24} />}
      </TouchableOpacity>

      <View style={styles.textContainer}>
        {status === 'idle' && (
          <View style={styles.row}>
            <Sparkles size={14} color={COLORS.secondary} style={{ marginRight: 4 }} />
            <Text style={styles.label}>Dictado IA — pulsa y habla</Text>
          </View>
        )}
        {status === 'listening' && (
          <Text style={[styles.label, { color: COLORS.danger, fontWeight: 'bold' }]}>
            Escuchando{dots}
          </Text>
        )}
        {status === 'processing' && (
          <Text style={[styles.label, { color: COLORS.warning, fontWeight: 'bold' }]}>
            IA detectando oficios y tarifas...
          </Text>
        )}
        {status === 'done' && (
          <Text style={[styles.label, { color: COLORS.success, fontWeight: 'bold' }]}>
            ¡Partidas añadidas!
          </Text>
        )}
        {status === 'error' && (
          <Text style={[styles.label, { color: COLORS.danger, fontWeight: 'bold' }]}>
            Error — toca para reintentar
          </Text>
        )}

        <Text style={styles.subLabel}>
          {status === 'idle'       && "Di el trabajo: 'Cambio de grifo, 2h fontanería, y pintar salón 40m²'"}
          {status === 'listening'  && "Pulsa el cuadrado para detener y procesar con IA"}
          {status === 'processing' && "Transcribiendo y detectando oficios con tarifas..."}
          {status === 'done'       && "Partidas con oficio y tarifa añadidas al presupuesto"}
          {status === 'error'      && (errorMsg || 'Verifica el micrófono y vuelve a intentarlo')}
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
  errorBtn: {
    backgroundColor: COLORS.danger,
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
