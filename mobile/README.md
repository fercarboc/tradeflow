# TradeFlow AI - Aplicación Móvil (Expo)

Este directorio contiene el código fuente independiente de la aplicación móvil de **TradeFlow AI**, diseñada específicamente para instaladores autónomos (fontaneros, electricistas, técnicos de climatización, cerrajeros, etc.).

La app ha sido desarrollada con un diseño **mobile-first** de alta fidelidad, con botones de tacto grande (diseñados para uso cómodo en obra) y un flujo de dictado por voz interactivo simulado por IA.

---

## 🚀 Guía de Inicio Rápido

Para ejecutar este proyecto en tu entorno local, sigue estos sencillos pasos:

1. **Navega al directorio móvil**:
   ```bash
   cd mobile
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Inicia el servidor de desarrollo Expo**:
   ```bash
   npx expo start
   ```

4. **Ejecuta en tu dispositivo o emulador**:
   - Presiona `a` para abrir en un emulador o dispositivo Android conectado.
   - Presiona `i` para abrir en el simulador de iOS (macOS).
   - Escanea el código QR desde tu móvil usando la aplicación **Expo Go** (disponible gratis en App Store o Google Play Store).

---

## 📁 Estructura del Proyecto

La estructura del código sigue el estándar moderno de Expo Router y TypeScript para maximizar la mantenibilidad:

```text
/mobile
   ├── app/                      # Rutas de navegación basadas en ficheros (Expo Router)
   │     ├── _layout.tsx         # Layout raíz con el State Provider y redirecciones seguras
   │     ├── index.tsx           # Pantalla de Login (Magic Link simulado)
   │     ├── onboarding.tsx      # Configuración inicial de autónomo y especialidad técnica
   │     └── (tabs)/             # Pestañas inferiores de la aplicación
   │           ├── _layout.tsx   # Configuración de apariencia y barra de pestañas
   │           ├── dashboard.tsx # Panel de control, estadísticas de presupuestos y facturas
   │           ├── clients.tsx   # Directorio de clientes con buscador y formulario de alta
   │           └── settings.tsx  # Ajustes fiscales (IVA), tarifas y cierre de sesión
   │     ├── create-quote.tsx    # Editor de presupuestos con dictado por voz y partidas manuales
   │     └── preview-quote.tsx   # Simulador de plantilla de factura/presupuesto y envío por WhatsApp
   ├── assets/                   # Recursos gráficos (iconos, splash)
   ├── components/               # Componentes reutilizables adaptados para obra
   │     ├── Button.tsx          # Botón con targets táctiles idóneos (+52px de altura)
   │     ├── Input.tsx           # Campos de entrada con estados de foco e indicaciones claras
   │     ├── MicButton.tsx       # Botón de dictado inteligente por IA (simulado)
   │     └── Theme.ts            # Paleta cromática oficial (Navy Slate, Blue, Emerald Green v2026)
   ├── lib/
   │     └── supabase.ts         # Adaptador para cliente Supabase preparado
   ├── types/
   │     └── index.ts            # Modelos de datos compartidos en TypeScript
   ├── app.json                  # Ajustes de configuración del manifiesto de Expo
   ├── package.json              # Módulos y dependencias declaradas
   └── tsconfig.json             # Reglas del compilador de TypeScript
```

---

## 🛠️ TODOs de Integración Técnica de Producción

Hemos dejado la estructura completamente preparada para escalar el MVP al producto de producción real. Sigue estos pasos para implementar las integraciones avanzadas:

### 1. Integración con Supabase Auth & Database
- **Fichero**: `lib/supabase.ts`
- **Pasos**:
  1. Instala las dependencias: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`
  2. Crea un archivo `.env` en `/mobile` con tus variables:
     ```env
     EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
     ```
  3. Descomenta el código de inicialización de AsyncStorage y `createClient` en `lib/supabase.ts` para habilitar el login real por email / magic-link.

### 2. Dictado de Voz por IA con Whisper (OpenAI)
- **Fichero**: `components/MicButton.tsx`
- **Flujo de Integración**:
  1. Instala `expo-av` para capturar grabaciones de audio desde el micrófono del móvil: `npx expo install expo-av`
  2. Cuando el usuario mantenga pulsado el `MicButton`, graba el audio en formato `.m4a`.
  3. Envía el archivo de audio grabado a la API de Whisper de OpenAI (`https://api.openai.com/v1/audio/transcriptions`) para obtener el texto convertido en crudo.

### 3. Parseado Inteligente de Conceptos con Claude / Gemini API
- **Flujo**:
  1. Envía el texto devuelto por Whisper a un endpoint serverless intermedio (por ejemplo, `/api/parse-quote` de tu servidor Express).
  2. Usa un modelo rápido de lenguaje pasándole un System Prompt estricto que obligue a responder en un JSON con estructura estructurada:
     ```json
     {
       "items": [
         { "description": "Localización y reparación fuga cobre", "quantity": 1, "unitPrice": 85.00 },
         { "description": "Tubo cobre 18mm", "quantity": 3, "unitPrice": 12.00 }
       ]
     }
     ```
  3. Al recibir la respuesta tipo JSON, inyéctala directamente en el state `items` dentro del editor de presupuestos de la app móvil.

### 4. Generación Real de PDF Descargable e Impresiones
- **Fichero**: `app/preview-quote.tsx`
- **Herramientas aconsejadas**: Usar `expo-print` para compilar código HTML directamente en archivos PDF nativos de forma remota:
  ```bash
  npx expo install expo-print expo-sharing
  ```
- **Código de integración sugerido**:
  ```typescript
  import * as Print from 'expo-print';
  import * as Sharing from 'expo-sharing';

  const generatePDF = async () => {
    const htmlContent = `<html>...generación de la cabecera, clientes e importes...</html>`;
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri);
  };
  ```

### 5. Integración con WhatsApp Business Cloud API
- **Fichero**: `app/preview-quote.tsx`
- **Flujo**: En lugar de usar enlaces de redirección profunda `whatsapp://send` orientados a clientes particulares, integra peticiones HTTP contra la API oficial de WhatsApp en la nube (`https://graph.facebook.com/v20.0/.../messages`) para enviar la factura directamente desde el número verificado de TradeFlow en formato de plantilla aprobada de Meta.

### 6. Sistema de Conversión Facturae y Hacienda Española (TicketBAI)
- **Fichero**: `app/_layout.tsx` (Método `updateQuoteStatus`)
- **Pasos**: Al ser de uso español primordialmente, conecta la confirmación del presupuesto aceptado con un sistema de timbrado digital que firme electrónicamente la factura cumpliendo con la **Ley Crea y Crece** y la normativa de facturación TicketBAI.

---

## 🎨 Eslogan de Diseño Móvil

> **Diseño en Campo**: Una interfaz pensada para ser operada por instaladores cansados en el tajo, con botas puestas y bajo iluminación solar intensa. Menos inputs de teclado y más dictados rápidos.
