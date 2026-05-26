# trade-voice-to-quote

Edge Function que convierte grabación de voz en partidas de presupuesto estructuradas.

## Flujo

1. Recibe `multipart/form-data` con campo `audio` (WebM o MP4)
2. Transcribe con **OpenAI gpt-4o-mini-transcribe** (mejor para español de obra)
3. Extrae partidas estructuradas con **Claude Haiku** (superior en JSON output)
4. Devuelve `{ transcript: string, items: ParsedItem[] }`

## Deploy

```bash
supabase functions deploy trade-voice-to-quote --no-verify-jwt
```

## Secrets necesarios (Supabase Dashboard → Settings → Edge Functions)

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Respuesta

```json
{
  "transcript": "Instalar calentador 80L y cambiar llave de paso",
  "items": [
    { "descripcion": "Instalación calentador de agua", "tipo": "mano_de_obra", "cantidad": 1 },
    { "descripcion": "Calentador eléctrico 80 litros", "tipo": "material", "cantidad": 1, "unidad": "ud" },
    { "descripcion": "Llave de paso 1/2\"", "tipo": "material", "cantidad": 1, "unidad": "ud" }
  ]
}
```
