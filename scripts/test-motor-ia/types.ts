export interface Query {
  id: number;
  oficio: string;
  texto: string;
}

export type Category =
  | 'OK_CATALOGO'
  | 'OK_MIXTO'
  | 'SOLO_SUGERIDAS'
  | 'VACIO'
  | 'TRUNCADO'
  | 'ERROR_TECNICO'
  | 'PRECIO_INVALIDO';

export interface Partida {
  descripcion?: string;
  tipo?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio_material?: number;
  origen?: 'catalogo' | 'sugerida_ia' | 'proveedor' | string;
  supplier_key?: string | null;
  catalog_variant_id?: string | null;
}

export interface QuoteResponse {
  partidas?: Partida[];
  oficios_detectados?: Array<{ oficio: string; confianza?: number }>;
  descripcion?: string;
  transcript?: string;
  error?: string;
}

/** Outer envelope returned by trade-voice-to-quote */
export interface ApiResponse {
  transcript?: string;
  quote?: QuoteResponse;
  actuacion_ids_matched?: string[];
  kb_score?: number;
  web_search_used?: boolean;
  error?: string;
  _meta?: {
    prompt_version?: string;
    stop_reason?: string;
    tokens_in?: number;
    tokens_out?: number;
  };
}

export interface ClassifyResult {
  category: Category;
  n_partidas: number;
  n_catalogo: number;
  n_sugeridas: number;
  oficio_detectado: string;
  coincide_oficio: 'SI' | 'NO';
  error_detalle?: string;
}

export interface TestResult {
  id: number;
  oficio: string;
  texto: string;
  http_status: number;
  latency_ms: number;
  raw_response: ApiResponse | null;
  classification: ClassifyResult;
  error_msg?: string;
}
