/**
 * Configuración de cliente para Supabase con persistencia local segura.
 * 
 * TODO: Para integrar completamente Supabase en tu app móvil Expo:
 * 1. Instala los paquetes requeridos:
 *    npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
 * 
 * 2. Define tus variables de entorno en un archivo `.env` en la raíz de /mobile:
 *    EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
 *    EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
 */

// Importaciones de referencia (descomentar al instalar dependencias reales):
// import 'react-native-url-polyfill/auto';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

class MockSupabaseClient {
  auth = {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async signInWithOtp(params: { email: string }) {
      console.log('Mock: signInWithOtp para', params.email);
      return { data: {}, error: null };
    },
    async signOut() {
      console.log('Mock: signOut llamado');
      return { error: null };
    }
  };

  from(table: string) {
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('Mock client') })
        })
      }),
      insert: async () => ({ data: null, error: new Error('Mock client') }),
      update: async () => ({ data: null, error: new Error('Mock client') })
    };
  }
}

// Inicialización del cliente. Trata los fallos de configuración de forma segura.
export const supabase = 
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? null // Aquí se crearía el cliente real usando createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { ... })
    : new MockSupabaseClient();

console.log('Supabase configurado en modo:', supabase instanceof MockSupabaseClient ? 'MOCK (sin credenciales)' : 'PRODUCCIÓN');
