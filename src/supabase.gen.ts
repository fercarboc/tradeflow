export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      acdm_progress: {
        Row: {
          completed_at: string | null
          id: number
          lesson_id: string
          user_id: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: number
          lesson_id: string
          user_id?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: number
          lesson_id?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acdm_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "acdm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      acdm_projects: {
        Row: {
          filename: string | null
          id: number
          uploaded_at: string | null
          user_id: number | null
        }
        Insert: {
          filename?: string | null
          id?: number
          uploaded_at?: string | null
          user_id?: number | null
        }
        Update: {
          filename?: string | null
          id?: number
          uploaded_at?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acdm_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "acdm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      acdm_tutor_sessions: {
        Row: {
          created_at: string | null
          id: number
          notes: string | null
          requested_date: string | null
          topic: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          notes?: string | null
          requested_date?: string | null
          topic?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          notes?: string | null
          requested_date?: string | null
          topic?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acdm_tutor_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "acdm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      acdm_users: {
        Row: {
          id: number
          name: string | null
          pin: string
          role: string | null
        }
        Insert: {
          id?: number
          name?: string | null
          pin: string
          role?: string | null
        }
        Update: {
          id?: number
          name?: string | null
          pin?: string
          role?: string | null
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          id: string
          metadata: Json | null
          target_org_id: string | null
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_org_id?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_automation_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      admin_corp_doc_entities: {
        Row: {
          doc_id: string
          entity_id: string
        }
        Insert: {
          doc_id: string
          entity_id: string
        }
        Update: {
          doc_id?: string
          entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_corp_doc_entities_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "admin_corp_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_corp_doc_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "admin_corp_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_corp_documents: {
        Row: {
          categoria: string
          created_at: string
          descripcion: string | null
          estado: string
          file_url: string | null
          id: string
          nombre: string
          tags: string[]
          updated_at: string
          version: string
        }
        Insert: {
          categoria: string
          created_at?: string
          descripcion?: string | null
          estado?: string
          file_url?: string | null
          id?: string
          nombre: string
          tags?: string[]
          updated_at?: string
          version?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descripcion?: string | null
          estado?: string
          file_url?: string | null
          id?: string
          nombre?: string
          tags?: string[]
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      admin_corp_entities: {
        Row: {
          cargo_contacto: string | null
          cif: string | null
          contacto_email: string | null
          contacto_nombre: string | null
          contacto_tel: string | null
          cp: string | null
          created_at: string
          direccion: string | null
          email_general: string | null
          encaje_tradeflow: string | null
          estado: string
          external_key: string | null
          fecha_verificacion: string | null
          fuente_principal: string | null
          fuente_secundaria: string | null
          id: string
          importe_potencial: number | null
          localidad: string | null
          nombre: string
          nombre_legal: string | null
          notas: string | null
          pais: string | null
          prioridad: string
          provincia: string | null
          proxima_accion: string | null
          proxima_accion_fecha: string | null
          telefono_general: string | null
          tipo: string
          updated_at: string
          verificacion: string
          web: string | null
        }
        Insert: {
          cargo_contacto?: string | null
          cif?: string | null
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_tel?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email_general?: string | null
          encaje_tradeflow?: string | null
          estado?: string
          external_key?: string | null
          fecha_verificacion?: string | null
          fuente_principal?: string | null
          fuente_secundaria?: string | null
          id?: string
          importe_potencial?: number | null
          localidad?: string | null
          nombre: string
          nombre_legal?: string | null
          notas?: string | null
          pais?: string | null
          prioridad?: string
          provincia?: string | null
          proxima_accion?: string | null
          proxima_accion_fecha?: string | null
          telefono_general?: string | null
          tipo: string
          updated_at?: string
          verificacion?: string
          web?: string | null
        }
        Update: {
          cargo_contacto?: string | null
          cif?: string | null
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_tel?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email_general?: string | null
          encaje_tradeflow?: string | null
          estado?: string
          external_key?: string | null
          fecha_verificacion?: string | null
          fuente_principal?: string | null
          fuente_secundaria?: string | null
          id?: string
          importe_potencial?: number | null
          localidad?: string | null
          nombre?: string
          nombre_legal?: string | null
          notas?: string | null
          pais?: string | null
          prioridad?: string
          provincia?: string | null
          proxima_accion?: string | null
          proxima_accion_fecha?: string | null
          telefono_general?: string | null
          tipo?: string
          updated_at?: string
          verificacion?: string
          web?: string | null
        }
        Relationships: []
      }
      admin_corp_interactions: {
        Row: {
          asunto: string
          created_at: string
          cuerpo: string | null
          entity_id: string
          fecha: string
          id: string
          resultado: string | null
          tipo: string
        }
        Insert: {
          asunto: string
          created_at?: string
          cuerpo?: string | null
          entity_id: string
          fecha?: string
          id?: string
          resultado?: string | null
          tipo?: string
        }
        Update: {
          asunto?: string
          created_at?: string
          cuerpo?: string | null
          entity_id?: string
          fecha?: string
          id?: string
          resultado?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_corp_interactions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "admin_corp_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_support_notes: {
        Row: {
          admin_email: string
          body: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          admin_email: string
          body: string
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          admin_email?: string
          body?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_support_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          is_active: boolean
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          activo: boolean
          asunto: string
          contenido_texto: string
          created_at: string
          id: string
          nombre: string
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          asunto: string
          contenido_texto: string
          created_at?: string
          id?: string
          nombre: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          asunto?: string
          contenido_texto?: string
          created_at?: string
          id?: string
          nombre?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      entity_email_history: {
        Row: {
          attachments: Json
          body_html: string | null
          body_text: string | null
          cc_email: string | null
          clicked: boolean
          created_at: string
          entity_id: string | null
          error_message: string | null
          id: string
          opened: boolean
          provider_message_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
          template_nombre: string | null
          to_email: string
        }
        Insert: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc_email?: string | null
          clicked?: boolean
          created_at?: string
          entity_id?: string | null
          error_message?: string | null
          id?: string
          opened?: boolean
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
          template_nombre?: string | null
          to_email: string
        }
        Update: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          cc_email?: string | null
          clicked?: boolean
          created_at?: string
          entity_id?: string | null
          error_message?: string | null
          id?: string
          opened?: boolean
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          template_nombre?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_email_history_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "admin_corp_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_email_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_actuaciones: {
        Row: {
          activo: boolean
          actuacion_id: string
          created_at: string | null
          id: string
          last_used_at: string | null
          observaciones: string
          oficio: string
          palabras_clave: string[]
          partidas_auxiliares: string[]
          partidas_obligatorias: string[]
          precio_max: number | null
          precio_min: number | null
          reglas_calculo: string
          unidad: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          activo?: boolean
          actuacion_id: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          observaciones?: string
          oficio: string
          palabras_clave?: string[]
          partidas_auxiliares?: string[]
          partidas_obligatorias?: string[]
          precio_max?: number | null
          precio_min?: number | null
          reglas_calculo?: string
          unidad?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          activo?: boolean
          actuacion_id?: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          observaciones?: string
          oficio?: string
          palabras_clave?: string[]
          partidas_auxiliares?: string[]
          partidas_obligatorias?: string[]
          precio_max?: number | null
          precio_min?: number | null
          reglas_calculo?: string
          unidad?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      trade_ai_feedback: {
        Row: {
          actuacion_ids: string[] | null
          ai_partidas: Json | null
          applied: boolean | null
          created_at: string | null
          final_partidas: Json | null
          id: string
          kb_score: number | null
          nuevas_partidas: Json | null
          org_id: string | null
          transcript: string
        }
        Insert: {
          actuacion_ids?: string[] | null
          ai_partidas?: Json | null
          applied?: boolean | null
          created_at?: string | null
          final_partidas?: Json | null
          id?: string
          kb_score?: number | null
          nuevas_partidas?: Json | null
          org_id?: string | null
          transcript: string
        }
        Update: {
          actuacion_ids?: string[] | null
          ai_partidas?: Json | null
          applied?: boolean | null
          created_at?: string | null
          final_partidas?: Json | null
          id?: string
          kb_score?: number | null
          nuevas_partidas?: Json | null
          org_id?: string | null
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_ai_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ai_usage: {
        Row: {
          created_at: string | null
          feature: string
          id: string
          metadata: Json | null
          org_id: string
        }
        Insert: {
          created_at?: string | null
          feature: string
          id?: string
          metadata?: Json | null
          org_id: string
        }
        Update: {
          created_at?: string | null
          feature?: string
          id?: string
          metadata?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ai_validation_access: {
        Row: {
          activo: boolean
          benchmark_ids: string[] | null
          created_at: string
          id: string
          org_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          benchmark_ids?: string[] | null
          created_at?: string
          id?: string
          org_id?: string | null
          role?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          benchmark_ids?: string[] | null
          created_at?: string
          id?: string
          org_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_ai_validation_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ai_versions: {
        Row: {
          benchmark_run_id: string | null
          created_at: string
          created_by: string | null
          desplegado_at: string | null
          es_baseline: boolean
          es_produccion: boolean
          es_release_candidate: boolean
          git_commit: string | null
          git_tag: string | null
          id: string
          model_id: string
          notas: string | null
          prompt_version: string | null
          rolled_back_at: string | null
          semaforo: string | null
          version_tag: string
        }
        Insert: {
          benchmark_run_id?: string | null
          created_at?: string
          created_by?: string | null
          desplegado_at?: string | null
          es_baseline?: boolean
          es_produccion?: boolean
          es_release_candidate?: boolean
          git_commit?: string | null
          git_tag?: string | null
          id?: string
          model_id?: string
          notas?: string | null
          prompt_version?: string | null
          rolled_back_at?: string | null
          semaforo?: string | null
          version_tag: string
        }
        Update: {
          benchmark_run_id?: string | null
          created_at?: string
          created_by?: string | null
          desplegado_at?: string | null
          es_baseline?: boolean
          es_produccion?: boolean
          es_release_candidate?: boolean
          git_commit?: string | null
          git_tag?: string | null
          id?: string
          model_id?: string
          notas?: string | null
          prompt_version?: string | null
          rolled_back_at?: string | null
          semaforo?: string | null
          version_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_ai_versions_benchmark_run_id_fkey"
            columns: ["benchmark_run_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmark_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_benchmark_queries: {
        Row: {
          activo: boolean
          benchmark_id: string
          created_at: string
          id: string
          metadata: Json | null
          oficio_display: string
          oficio_esperado: string | null
          posicion: number
          texto: string
        }
        Insert: {
          activo?: boolean
          benchmark_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          oficio_display: string
          oficio_esperado?: string | null
          posicion: number
          texto: string
        }
        Update: {
          activo?: boolean
          benchmark_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          oficio_display?: string
          oficio_esperado?: string | null
          posicion?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_benchmark_queries_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_benchmark_results: {
        Row: {
          categoria: string | null
          coincide_oficio: boolean | null
          created_at: string
          error_msg: string | null
          id: string
          latency_ms: number | null
          n_catalogo: number
          n_partidas: number
          n_sugeridas: number
          oficio_detectado: string | null
          oficio_esperado: string
          posicion: number
          prompt_version: string | null
          query_id: string | null
          raw_response: Json | null
          run_id: string
          stop_reason: string | null
          tokens_out: number | null
        }
        Insert: {
          categoria?: string | null
          coincide_oficio?: boolean | null
          created_at?: string
          error_msg?: string | null
          id?: string
          latency_ms?: number | null
          n_catalogo?: number
          n_partidas?: number
          n_sugeridas?: number
          oficio_detectado?: string | null
          oficio_esperado: string
          posicion: number
          prompt_version?: string | null
          query_id?: string | null
          raw_response?: Json | null
          run_id: string
          stop_reason?: string | null
          tokens_out?: number | null
        }
        Update: {
          categoria?: string | null
          coincide_oficio?: boolean | null
          created_at?: string
          error_msg?: string | null
          id?: string
          latency_ms?: number | null
          n_catalogo?: number
          n_partidas?: number
          n_sugeridas?: number
          oficio_detectado?: string | null
          oficio_esperado?: string
          posicion?: number
          prompt_version?: string | null
          query_id?: string | null
          raw_response?: Json | null
          run_id?: string
          stop_reason?: string | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_benchmark_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmark_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_benchmark_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmark_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_benchmark_runs: {
        Row: {
          benchmark_id: string
          coin_rate: number | null
          completado_at: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          estado: string
          id: string
          iniciado_at: string | null
          lat_mean_ms: number | null
          lat_p95_ms: number | null
          notas: string | null
          ok_rate: number | null
          queries_error: number
          queries_ok: number
          queries_precio_inv: number
          queries_solo_sug: number
          queries_truncado: number
          queries_vacio: number
          semaforo: string | null
          tok_max: number | null
          tok_mean: number | null
          total_queries: number
          version_tag: string
        }
        Insert: {
          benchmark_id: string
          coin_rate?: number | null
          completado_at?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          iniciado_at?: string | null
          lat_mean_ms?: number | null
          lat_p95_ms?: number | null
          notas?: string | null
          ok_rate?: number | null
          queries_error?: number
          queries_ok?: number
          queries_precio_inv?: number
          queries_solo_sug?: number
          queries_truncado?: number
          queries_vacio?: number
          semaforo?: string | null
          tok_max?: number | null
          tok_mean?: number | null
          total_queries?: number
          version_tag: string
        }
        Update: {
          benchmark_id?: string
          coin_rate?: number | null
          completado_at?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          iniciado_at?: string | null
          lat_mean_ms?: number | null
          lat_p95_ms?: number | null
          notas?: string | null
          ok_rate?: number | null
          queries_error?: number
          queries_ok?: number
          queries_precio_inv?: number
          queries_solo_sug?: number
          queries_truncado?: number
          queries_vacio?: number
          semaforo?: string | null
          tok_max?: number | null
          tok_mean?: number | null
          total_queries?: number
          version_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_benchmark_runs_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_benchmarks: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string | null
          es_baseline: boolean
          id: string
          nombre: string
          proveedor_id: string | null
          tipo: string
          total_queries: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          es_baseline?: boolean
          id?: string
          nombre: string
          proveedor_id?: string | null
          tipo?: string
          total_queries?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          es_baseline?: boolean
          id?: string
          nombre?: string
          proveedor_id?: string | null
          tipo?: string
          total_queries?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_benchmarks_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_budget_catalog_lines: {
        Row: {
          budget_id: string
          cantidad: number | null
          catalog_id: string | null
          created_at: string
          descripcion_ia: string | null
          id: string
          margen_pct: number | null
          partida_index: number | null
          precio_coste: number | null
          precio_venta: number | null
          product_id: string | null
          selected_by_user: boolean
        }
        Insert: {
          budget_id: string
          cantidad?: number | null
          catalog_id?: string | null
          created_at?: string
          descripcion_ia?: string | null
          id?: string
          margen_pct?: number | null
          partida_index?: number | null
          precio_coste?: number | null
          precio_venta?: number | null
          product_id?: string | null
          selected_by_user?: boolean
        }
        Update: {
          budget_id?: string
          cantidad?: number | null
          catalog_id?: string | null
          created_at?: string
          descripcion_ia?: string | null
          id?: string
          margen_pct?: number | null
          partida_index?: number | null
          precio_coste?: number | null
          precio_venta?: number | null
          product_id?: string | null
          selected_by_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trade_budget_catalog_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budget_catalog_lines_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_budget_catalog_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_catalog_import_chunks: {
        Row: {
          chunk_hash: string
          chunk_index: number
          filas_error: number
          filas_ok: number
          import_id: string
          processed_at: string
        }
        Insert: {
          chunk_hash: string
          chunk_index: number
          filas_error?: number
          filas_ok?: number
          import_id: string
          processed_at?: string
        }
        Update: {
          chunk_hash?: string
          chunk_index?: number
          filas_error?: number
          filas_ok?: number
          import_id?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_catalog_import_chunks_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "trade_catalog_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_catalog_import_errors: {
        Row: {
          chunk_index: number
          created_at: string
          datos_fila: Json | null
          descripcion: string | null
          fila_numero: number
          id: string
          import_id: string
          motivo: string
          supplier_ref: string | null
        }
        Insert: {
          chunk_index: number
          created_at?: string
          datos_fila?: Json | null
          descripcion?: string | null
          fila_numero: number
          id?: string
          import_id: string
          motivo: string
          supplier_ref?: string | null
        }
        Update: {
          chunk_index?: number
          created_at?: string
          datos_fila?: Json | null
          descripcion?: string | null
          fila_numero?: number
          id?: string
          import_id?: string
          motivo?: string
          supplier_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_catalog_import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "trade_catalog_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_catalog_imports: {
        Row: {
          actor_id: string
          archivo_hash: string
          chunk_size: number
          chunks_esperados: number
          chunks_recibidos: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          estado: string
          filas_duplicadas: number
          filas_error: number
          filas_ok: number
          id: string
          mapping_config: Json
          modo: string
          nombre_archivo: string
          parser_version: string
          started_at: string
          total_filas: number
          updated_at: string
        }
        Insert: {
          actor_id: string
          archivo_hash: string
          chunk_size: number
          chunks_esperados: number
          chunks_recibidos?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string
          filas_duplicadas?: number
          filas_error?: number
          filas_ok?: number
          id?: string
          mapping_config?: Json
          modo?: string
          nombre_archivo: string
          parser_version?: string
          started_at?: string
          total_filas: number
          updated_at?: string
        }
        Update: {
          actor_id?: string
          archivo_hash?: string
          chunk_size?: number
          chunks_esperados?: number
          chunks_recibidos?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string
          filas_duplicadas?: number
          filas_error?: number
          filas_ok?: number
          id?: string
          mapping_config?: Json
          modo?: string
          nombre_archivo?: string
          parser_version?: string
          started_at?: string
          total_filas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_catalog_imports_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_catalog_products: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          familia: string
          id: string
          nombre_generico: string
          oficio: string
          org_id: string | null
          subfamilia: string | null
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          familia: string
          id?: string
          nombre_generico: string
          oficio?: string
          org_id?: string | null
          subfamilia?: string | null
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          familia?: string
          id?: string
          nombre_generico?: string
          oficio?: string
          org_id?: string | null
          subfamilia?: string | null
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_catalog_products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_catalog_suggestions: {
        Row: {
          created_at: string
          descripcion: string
          estado: string
          familia: string | null
          global_catalog_id: string | null
          id: string
          notas_admin: string | null
          oficio: string | null
          org_id: string | null
          origen: string
          precio_indicado: number | null
          unidad: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado?: string
          familia?: string | null
          global_catalog_id?: string | null
          id?: string
          notas_admin?: string | null
          oficio?: string | null
          org_id?: string | null
          origen?: string
          precio_indicado?: number | null
          unidad?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado?: string
          familia?: string | null
          global_catalog_id?: string | null
          id?: string
          notas_admin?: string | null
          oficio?: string | null
          org_id?: string | null
          origen?: string
          precio_indicado?: number | null
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_catalog_suggestions_global_catalog_id_fkey"
            columns: ["global_catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_global_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_catalog_suggestions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_catalog_variants: {
        Row: {
          activo: boolean
          calidad: string
          created_at: string
          id: string
          is_preferred: boolean
          marca: string
          margen_pct: number
          medidas: string | null
          modelo: string | null
          org_id: string | null
          precio_mano_obra: number
          precio_material: number
          precio_venta: number | null
          product_id: string
          proveedor: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          calidad?: string
          created_at?: string
          id?: string
          is_preferred?: boolean
          marca: string
          margen_pct?: number
          medidas?: string | null
          modelo?: string | null
          org_id?: string | null
          precio_mano_obra?: number
          precio_material?: number
          precio_venta?: number | null
          product_id: string
          proveedor?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          calidad?: string
          created_at?: string
          id?: string
          is_preferred?: boolean
          marca?: string
          margen_pct?: number
          medidas?: string | null
          modelo?: string | null
          org_id?: string | null
          precio_mano_obra?: number
          precio_material?: number
          precio_venta?: number | null
          product_id?: string
          proveedor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_catalog_variants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_catalog_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trade_catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_client_errors: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          org_id: string | null
          page: string | null
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          org_id?: string | null
          page?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          org_id?: string | null
          page?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_client_errors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_client_locations: {
        Row: {
          activa: boolean
          ciudad: string | null
          client_id: string
          cp: string | null
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          notas: string | null
          org_id: string
          pais: string
          provincia: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          ciudad?: string | null
          client_id: string
          cp?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          notas?: string | null
          org_id: string
          pais?: string
          provincia?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          ciudad?: string | null
          client_id?: string
          cp?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          org_id?: string
          pais?: string
          provincia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_location_org_client"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "trade_client_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_clients: {
        Row: {
          apellidos: string | null
          ciudad: string | null
          cp: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nif: string | null
          nombre: string
          notas: string | null
          obras_activas: number
          org_id: string
          pais: string | null
          provincia: string | null
          telefono: string | null
          tipo_cliente: string | null
          total_facturado: number
          updated_at: string
        }
        Insert: {
          apellidos?: string | null
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre: string
          notas?: string | null
          obras_activas?: number
          org_id: string
          pais?: string | null
          provincia?: string | null
          telefono?: string | null
          tipo_cliente?: string | null
          total_facturado?: number
          updated_at?: string
        }
        Update: {
          apellidos?: string | null
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre?: string
          notas?: string | null
          obras_activas?: number
          org_id?: string
          pais?: string | null
          provincia?: string | null
          telefono?: string | null
          tipo_cliente?: string | null
          total_facturado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_compras: {
        Row: {
          catalog_supplier_id: string | null
          concepto: string
          created_at: string
          fecha: string | null
          fecha_vencimiento: string | null
          id: string
          importe: number
          iva_pct: number
          job_id: string | null
          mayorista_id: string | null
          notas: string | null
          org_id: string
          pagado: boolean
          pagado_at: string | null
          referencia_factura: string | null
          subcontrata_id: string | null
          updated_at: string
        }
        Insert: {
          catalog_supplier_id?: string | null
          concepto: string
          created_at?: string
          fecha?: string | null
          fecha_vencimiento?: string | null
          id?: string
          importe?: number
          iva_pct?: number
          job_id?: string | null
          mayorista_id?: string | null
          notas?: string | null
          org_id: string
          pagado?: boolean
          pagado_at?: string | null
          referencia_factura?: string | null
          subcontrata_id?: string | null
          updated_at?: string
        }
        Update: {
          catalog_supplier_id?: string | null
          concepto?: string
          created_at?: string
          fecha?: string | null
          fecha_vencimiento?: string | null
          id?: string
          importe?: number
          iva_pct?: number
          job_id?: string | null
          mayorista_id?: string | null
          notas?: string | null
          org_id?: string
          pagado?: boolean
          pagado_at?: string | null
          referencia_factura?: string | null
          subcontrata_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_compras_catalog_supplier_id_fkey"
            columns: ["catalog_supplier_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_compras_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_compras_mayorista_id_fkey"
            columns: ["mayorista_id"]
            isOneToOne: false
            referencedRelation: "trade_mayoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_compras_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_compras_subcontrata_id_fkey"
            columns: ["subcontrata_id"]
            isOneToOne: false
            referencedRelation: "trade_subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_contract_counters: {
        Row: {
          created_at: string
          ejercicio: number
          last_value: number
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ejercicio: number
          last_value?: number
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ejercicio?: number
          last_value?: number
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_contract_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_contracts: {
        Row: {
          client_id: string | null
          contenido_html: string | null
          created_at: string | null
          estado: string
          firmado_at: string | null
          id: string
          maintenance_contract_id: string | null
          mantenimiento_id: string | null
          oficio: string
          org_id: string
          pdf_url: string | null
          referencia: string
          updated_at: string | null
          variables: Json
        }
        Insert: {
          client_id?: string | null
          contenido_html?: string | null
          created_at?: string | null
          estado?: string
          firmado_at?: string | null
          id?: string
          maintenance_contract_id?: string | null
          mantenimiento_id?: string | null
          oficio?: string
          org_id: string
          pdf_url?: string | null
          referencia: string
          updated_at?: string | null
          variables?: Json
        }
        Update: {
          client_id?: string | null
          contenido_html?: string | null
          created_at?: string | null
          estado?: string
          firmado_at?: string | null
          id?: string
          maintenance_contract_id?: string | null
          mantenimiento_id?: string | null
          oficio?: string
          org_id?: string
          pdf_url?: string | null
          referencia?: string
          updated_at?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "trade_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_contracts_maintenance_contract_id_fkey"
            columns: ["maintenance_contract_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_contracts_mantenimiento_id_fkey"
            columns: ["mantenimiento_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_presupuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_distance_cache: {
        Row: {
          cached_at: string | null
          dest_lat: number
          dest_lng: number
          distance_km: number
          duration_min: number
          id: string
          modo: string | null
          origin_lat: number
          origin_lng: number
        }
        Insert: {
          cached_at?: string | null
          dest_lat: number
          dest_lng: number
          distance_km: number
          duration_min: number
          id?: string
          modo?: string | null
          origin_lat: number
          origin_lng: number
        }
        Update: {
          cached_at?: string | null
          dest_lat?: number
          dest_lng?: number
          distance_km?: number
          duration_min?: number
          id?: string
          modo?: string | null
          origin_lat?: number
          origin_lng?: number
        }
        Relationships: []
      }
      trade_doc_number_seq: {
        Row: {
          last_num: number
          serie: string
          year_val: number
        }
        Insert: {
          last_num?: number
          serie: string
          year_val: number
        }
        Update: {
          last_num?: number
          serie?: string
          year_val?: number
        }
        Relationships: []
      }
      trade_document_entities: {
        Row: {
          document_id: string
          entity_id: string
        }
        Insert: {
          document_id: string
          entity_id: string
        }
        Update: {
          document_id?: string
          entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_document_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trade_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_document_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "admin_corp_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_documents: {
        Row: {
          bucket: string | null
          categoria: string
          created_at: string
          descripcion: string | null
          estado: string
          file_hash: string | null
          id: string
          mime_type: string | null
          nombre: string
          origen_path: string | null
          size: number | null
          storage_path: string | null
          tags: string[]
          updated_at: string
          version: string
        }
        Insert: {
          bucket?: string | null
          categoria: string
          created_at?: string
          descripcion?: string | null
          estado?: string
          file_hash?: string | null
          id?: string
          mime_type?: string | null
          nombre: string
          origen_path?: string | null
          size?: number | null
          storage_path?: string | null
          tags?: string[]
          updated_at?: string
          version?: string
        }
        Update: {
          bucket?: string | null
          categoria?: string
          created_at?: string
          descripcion?: string | null
          estado?: string
          file_hash?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string
          origen_path?: string | null
          size?: number | null
          storage_path?: string | null
          tags?: string[]
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      trade_email_rate_limits: {
        Row: {
          count: number
          email_type: string
          id: number
          ip_hash: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          email_type: string
          id?: number
          ip_hash: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          email_type?: string
          id?: number
          ip_hash?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      trade_field_actions: {
        Row: {
          created_at: string | null
          descripcion: string
          estado: string
          id: string
          job_id: string | null
          org_id: string
          resuelto_at: string | null
          resuelto_por: string | null
          tipo: string
          updated_at: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion: string
          estado?: string
          id?: string
          job_id?: string | null
          org_id: string
          resuelto_at?: string | null
          resuelto_por?: string | null
          tipo: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string
          estado?: string
          id?: string
          job_id?: string | null
          org_id?: string
          resuelto_at?: string | null
          resuelto_por?: string | null
          tipo?: string
          updated_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_field_actions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_field_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_field_actions_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "trade_org_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_field_actions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_financial_documents: {
        Row: {
          actor_id: string | null
          ad_booking_id: string | null
          ad_campaign_id: string | null
          commercial_value: number
          concept: string
          created_at: string
          created_by: string | null
          currency: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_nif: string | null
          discount_amount: number
          doc_number: string
          doc_series: string
          document_subtype: string | null
          document_type: string
          estado: string
          id: string
          immutable_at: string | null
          invoice_pdf_url: string | null
          invoice_url: string | null
          issued_at: string | null
          master_order_id: string | null
          metadata: Json
          net_amount: number
          org_id: string | null
          paid_at: string | null
          payer_type: string
          payment_method: string | null
          payment_status: string
          period_end: string | null
          period_start: string | null
          platform_invoice_id: string | null
          promotion_amount: number
          public_token: string | null
          quantity: number
          rate_amount: number
          revenue_type: string
          sent_at: string | null
          sent_to: string | null
          settlement_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_id: string | null
          subscription_id: string | null
          subtotal: number
          supplier_order_id: string | null
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          ad_booking_id?: string | null
          ad_campaign_id?: string | null
          commercial_value?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_nif?: string | null
          discount_amount?: number
          doc_number: string
          doc_series?: string
          document_subtype?: string | null
          document_type?: string
          estado?: string
          id?: string
          immutable_at?: string | null
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          issued_at?: string | null
          master_order_id?: string | null
          metadata?: Json
          net_amount?: number
          org_id?: string | null
          paid_at?: string | null
          payer_type: string
          payment_method?: string | null
          payment_status?: string
          period_end?: string | null
          period_start?: string | null
          platform_invoice_id?: string | null
          promotion_amount?: number
          public_token?: string | null
          quantity?: number
          rate_amount?: number
          revenue_type: string
          sent_at?: string | null
          sent_to?: string | null
          settlement_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_id?: string | null
          subscription_id?: string | null
          subtotal?: number
          supplier_order_id?: string | null
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          ad_booking_id?: string | null
          ad_campaign_id?: string | null
          commercial_value?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_nif?: string | null
          discount_amount?: number
          doc_number?: string
          doc_series?: string
          document_subtype?: string | null
          document_type?: string
          estado?: string
          id?: string
          immutable_at?: string | null
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          issued_at?: string | null
          master_order_id?: string | null
          metadata?: Json
          net_amount?: number
          org_id?: string | null
          paid_at?: string | null
          payer_type?: string
          payment_method?: string | null
          payment_status?: string
          period_end?: string | null
          period_start?: string | null
          platform_invoice_id?: string | null
          promotion_amount?: number
          public_token?: string | null
          quantity?: number
          rate_amount?: number
          revenue_type?: string
          sent_at?: string | null
          sent_to?: string | null
          settlement_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_id?: string | null
          subscription_id?: string | null
          subtotal?: number
          supplier_order_id?: string | null
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_financial_documents_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_ad_booking_id_fkey"
            columns: ["ad_booking_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_ad_campaign_id_fkey"
            columns: ["ad_campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_platform_invoice_id_fkey"
            columns: ["platform_invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_platform_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "trade_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_financial_documents_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_fiscal_records: {
        Row: {
          created_at: string
          cuota_iva: number
          fecha_expedicion: string
          fecha_expedicion_vf: string
          generated_at: string
          generated_at_str: string
          hash: string
          hash_input: string
          id: string
          importe_total: number
          invoice_id: string | null
          nif_emisor: string
          numero_factura: string
          org_id: string
          payload_version: string
          previous_hash: string | null
          previous_numero: string | null
          previous_record_id: string | null
          record_type: string
          serie_factura: string | null
          timezone_used: string
          tipo_factura_vf: string
          tipo_rectificativa: string | null
        }
        Insert: {
          created_at?: string
          cuota_iva: number
          fecha_expedicion: string
          fecha_expedicion_vf: string
          generated_at: string
          generated_at_str: string
          hash: string
          hash_input: string
          id?: string
          importe_total: number
          invoice_id?: string | null
          nif_emisor: string
          numero_factura: string
          org_id: string
          payload_version?: string
          previous_hash?: string | null
          previous_numero?: string | null
          previous_record_id?: string | null
          record_type: string
          serie_factura?: string | null
          timezone_used?: string
          tipo_factura_vf: string
          tipo_rectificativa?: string | null
        }
        Update: {
          created_at?: string
          cuota_iva?: number
          fecha_expedicion?: string
          fecha_expedicion_vf?: string
          generated_at?: string
          generated_at_str?: string
          hash?: string
          hash_input?: string
          id?: string
          importe_total?: number
          invoice_id?: string | null
          nif_emisor?: string
          numero_factura?: string
          org_id?: string
          payload_version?: string
          previous_hash?: string | null
          previous_numero?: string | null
          previous_record_id?: string | null
          record_type?: string
          serie_factura?: string | null
          timezone_used?: string
          tipo_factura_vf?: string
          tipo_rectificativa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_fiscal_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_fiscal_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_fiscal_records_previous_record_id_fkey"
            columns: ["previous_record_id"]
            isOneToOne: false
            referencedRelation: "trade_fiscal_records"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_geo_cache: {
        Row: {
          address_hash: string
          cached_at: string
          candidates: Json
          normalized_text: string
          org_id: string
          provider: string
        }
        Insert: {
          address_hash: string
          cached_at?: string
          candidates: Json
          normalized_text: string
          org_id: string
          provider: string
        }
        Update: {
          address_hash?: string
          cached_at?: string
          candidates?: Json
          normalized_text?: string
          org_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_geo_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_geo_rate: {
        Row: {
          daily_global_limit: number
          global_used_date: string | null
          global_used_today: number
          is_disabled: boolean
          provider: string
          req_at: string | null
          req_count: number
        }
        Insert: {
          daily_global_limit?: number
          global_used_date?: string | null
          global_used_today?: number
          is_disabled?: boolean
          provider: string
          req_at?: string | null
          req_count?: number
        }
        Update: {
          daily_global_limit?: number
          global_used_date?: string | null
          global_used_today?: number
          is_disabled?: boolean
          provider?: string
          req_at?: string | null
          req_count?: number
        }
        Relationships: []
      }
      trade_geo_reservations: {
        Row: {
          actual: number | null
          estimated: number
          expires_at: string
          id: string
          org_id: string
          reconciled_at: string | null
          reserved_at: string
          status: string
        }
        Insert: {
          actual?: number | null
          estimated: number
          expires_at?: string
          id?: string
          org_id: string
          reconciled_at?: string | null
          reserved_at?: string
          status?: string
        }
        Update: {
          actual?: number | null
          estimated?: number
          expires_at?: string
          id?: string
          org_id?: string
          reconciled_at?: string | null
          reserved_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_geo_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_geo_usage: {
        Row: {
          daily_limit: number
          date: string
          org_id: string
          req_count: number
        }
        Insert: {
          daily_limit?: number
          date?: string
          org_id: string
          req_count?: number
        }
        Update: {
          daily_limit?: number
          date?: string
          org_id?: string
          req_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_geo_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_global_catalog: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string
          familia: string
          id: string
          marca_sugerida: string | null
          oficio: string
          precio_referencia: number
          search_vector: unknown
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion: string
          familia: string
          id?: string
          marca_sugerida?: string | null
          oficio: string
          precio_referencia?: number
          search_vector?: unknown
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string
          familia?: string
          id?: string
          marca_sugerida?: string | null
          oficio?: string
          precio_referencia?: number
          search_vector?: unknown
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_installer_needs: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          oficio: string | null
          org_id: string | null
          question: string
          reviewed: boolean | null
          tipo: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          oficio?: string | null
          org_id?: string | null
          question: string
          reviewed?: boolean | null
          tipo?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          oficio?: string | null
          org_id?: string | null
          question?: string
          reviewed?: boolean | null
          tipo?: string | null
        }
        Relationships: []
      }
      trade_invoice_counters: {
        Row: {
          created_at: string
          ejercicio: number
          last_value: number
          nif_emisor: string
          org_id: string
          serie: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ejercicio: number
          last_value?: number
          nif_emisor: string
          org_id: string
          serie: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ejercicio?: number
          last_value?: number
          nif_emisor?: string
          org_id?: string
          serie?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_invoice_lines: {
        Row: {
          cantidad: number | null
          created_at: string | null
          descripcion: string
          descuento_pct: number | null
          factura_id: string
          id: string
          orden: number | null
          precio_unitario: number
          subtotal: number
          tipo: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string | null
          descripcion: string
          descuento_pct?: number | null
          factura_id: string
          id?: string
          orden?: number | null
          precio_unitario: number
          subtotal: number
          tipo?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string | null
          descripcion?: string
          descuento_pct?: number | null
          factura_id?: string
          id?: string
          orden?: number | null
          precio_unitario?: number
          subtotal?: number
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_invoice_lines_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_invoices: {
        Row: {
          client_id: string | null
          concepto: string | null
          contract_id: string | null
          cp_cliente: string | null
          created_at: string
          created_by: string | null
          devuelta_at: string | null
          devuelta_motivo: string | null
          direccion_cliente: string | null
          es_suplementaria: boolean | null
          estado: string
          fecha: string
          fecha_emision: string | null
          fecha_vencimiento: string | null
          fiscal_record_id: string | null
          id: string
          iva_importe: number | null
          iva_pct: number
          job_id: string | null
          localidad_cliente: string | null
          mantenimiento_id: string | null
          mes_facturacion: string | null
          metodo_pago: string | null
          motivo_rectificacion: string | null
          nif_cliente: string | null
          notas_internas: string | null
          numero: string
          org_id: string
          paid_at: string | null
          pais_cliente: string | null
          provincia_cliente: string | null
          quote_id: string | null
          razon_social_cliente: string | null
          rectifica_factura_id: string | null
          serie: string | null
          subtotal: number
          tipo_factura: string | null
          tipo_factura_vf: string | null
          tipo_rectificativa: string | null
          total: number | null
          updated_at: string
          verifactu_generated_at: string | null
          verifactu_hash: string | null
          verifactu_hash_anterior: string | null
          view_token: string | null
        }
        Insert: {
          client_id?: string | null
          concepto?: string | null
          contract_id?: string | null
          cp_cliente?: string | null
          created_at?: string
          created_by?: string | null
          devuelta_at?: string | null
          devuelta_motivo?: string | null
          direccion_cliente?: string | null
          es_suplementaria?: boolean | null
          estado?: string
          fecha?: string
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          fiscal_record_id?: string | null
          id?: string
          iva_importe?: number | null
          iva_pct?: number
          job_id?: string | null
          localidad_cliente?: string | null
          mantenimiento_id?: string | null
          mes_facturacion?: string | null
          metodo_pago?: string | null
          motivo_rectificacion?: string | null
          nif_cliente?: string | null
          notas_internas?: string | null
          numero: string
          org_id: string
          paid_at?: string | null
          pais_cliente?: string | null
          provincia_cliente?: string | null
          quote_id?: string | null
          razon_social_cliente?: string | null
          rectifica_factura_id?: string | null
          serie?: string | null
          subtotal?: number
          tipo_factura?: string | null
          tipo_factura_vf?: string | null
          tipo_rectificativa?: string | null
          total?: number | null
          updated_at?: string
          verifactu_generated_at?: string | null
          verifactu_hash?: string | null
          verifactu_hash_anterior?: string | null
          view_token?: string | null
        }
        Update: {
          client_id?: string | null
          concepto?: string | null
          contract_id?: string | null
          cp_cliente?: string | null
          created_at?: string
          created_by?: string | null
          devuelta_at?: string | null
          devuelta_motivo?: string | null
          direccion_cliente?: string | null
          es_suplementaria?: boolean | null
          estado?: string
          fecha?: string
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          fiscal_record_id?: string | null
          id?: string
          iva_importe?: number | null
          iva_pct?: number
          job_id?: string | null
          localidad_cliente?: string | null
          mantenimiento_id?: string | null
          mes_facturacion?: string | null
          metodo_pago?: string | null
          motivo_rectificacion?: string | null
          nif_cliente?: string | null
          notas_internas?: string | null
          numero?: string
          org_id?: string
          paid_at?: string | null
          pais_cliente?: string | null
          provincia_cliente?: string | null
          quote_id?: string | null
          razon_social_cliente?: string | null
          rectifica_factura_id?: string | null
          serie?: string | null
          subtotal?: number
          tipo_factura?: string | null
          tipo_factura_vf?: string | null
          tipo_rectificativa?: string | null
          total?: number | null
          updated_at?: string
          verifactu_generated_at?: string | null
          verifactu_hash?: string | null
          verifactu_hash_anterior?: string | null
          view_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "trade_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_fiscal_record_id_fkey"
            columns: ["fiscal_record_id"]
            isOneToOne: false
            referencedRelation: "trade_fiscal_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_mantenimiento_id_fkey"
            columns: ["mantenimiento_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_rectifica_factura_id_fkey"
            columns: ["rectifica_factura_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_job_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          job_id: string
          org_id: string
          photo_url: string
          uploaded_by_worker_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          org_id: string
          photo_url: string
          uploaded_by_worker_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          org_id?: string
          photo_url?: string
          uploaded_by_worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_job_photos_uploaded_by_worker_id_fkey"
            columns: ["uploaded_by_worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_job_reviews: {
        Row: {
          cliente_nombre: string | null
          comentario: string | null
          created_at: string
          id: string
          job_id: string
          job_titulo: string | null
          org_id: string
          rating: number | null
          respondido_at: string | null
          token: string
        }
        Insert: {
          cliente_nombre?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          job_id: string
          job_titulo?: string | null
          org_id: string
          rating?: number | null
          respondido_at?: string | null
          token?: string
        }
        Update: {
          cliente_nombre?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          job_id?: string
          job_titulo?: string | null
          org_id?: string
          rating?: number | null
          respondido_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_job_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_job_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_job_templates: {
        Row: {
          activo: boolean | null
          code: string
          created_at: string | null
          descripcion: string | null
          detect_keywords: string[] | null
          exclude_products: string[] | null
          id: string
          include_labour: string[] | null
          include_products: string[] | null
          include_tasks: string[] | null
          nombre: string
          optional_products: string[] | null
          org_id: string | null
          requires_review: boolean | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          code: string
          created_at?: string | null
          descripcion?: string | null
          detect_keywords?: string[] | null
          exclude_products?: string[] | null
          id?: string
          include_labour?: string[] | null
          include_products?: string[] | null
          include_tasks?: string[] | null
          nombre: string
          optional_products?: string[] | null
          org_id?: string | null
          requires_review?: boolean | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          code?: string
          created_at?: string | null
          descripcion?: string | null
          detect_keywords?: string[] | null
          exclude_products?: string[] | null
          id?: string
          include_labour?: string[] | null
          include_products?: string[] | null
          include_tasks?: string[] | null
          nombre?: string
          optional_products?: string[] | null
          org_id?: string | null
          requires_review?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_job_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_job_workers: {
        Row: {
          aceptado: boolean | null
          created_at: string
          id: string
          job_id: string
          notificado: boolean
          rol: string
          worker_id: string
        }
        Insert: {
          aceptado?: boolean | null
          created_at?: string
          id?: string
          job_id: string
          notificado?: boolean
          rol?: string
          worker_id: string
        }
        Update: {
          aceptado?: boolean | null
          created_at?: string
          id?: string
          job_id?: string
          notificado?: boolean
          rol?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_job_workers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_job_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_jobs: {
        Row: {
          client_id: string | null
          completado_at: string | null
          completado_por: string | null
          cp: string | null
          created_at: string
          descripcion: string | null
          direccion: string | null
          direccion_normalizada: string | null
          duracion_estimada_min: number | null
          duracion_horas: number | null
          estado: string
          fecha_estimada_material: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          firma_cliente_url: string | null
          geo_confirmed_at: string | null
          geo_source: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          latitud: number | null
          localidad: string | null
          longitud: number | null
          material_pendiente: string | null
          notas_cierre: string | null
          notas_trabajador: string | null
          notas_trabajador_at: string | null
          notas_trabajador_leida: boolean | null
          orden_ruta: number | null
          org_id: string
          parte_token: string | null
          pause_reason: string | null
          prioridad: string
          priority_insert: boolean | null
          quote_id: string | null
          rescheduled_from: string | null
          started_at: string | null
          tipo: string | null
          titulo: string
          updated_at: string
          ventana_fin: string | null
          ventana_inicio: string | null
        }
        Insert: {
          client_id?: string | null
          completado_at?: string | null
          completado_por?: string | null
          cp?: string | null
          created_at?: string
          descripcion?: string | null
          direccion?: string | null
          direccion_normalizada?: string | null
          duracion_estimada_min?: number | null
          duracion_horas?: number | null
          estado?: string
          fecha_estimada_material?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          firma_cliente_url?: string | null
          geo_confirmed_at?: string | null
          geo_source?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          latitud?: number | null
          localidad?: string | null
          longitud?: number | null
          material_pendiente?: string | null
          notas_cierre?: string | null
          notas_trabajador?: string | null
          notas_trabajador_at?: string | null
          notas_trabajador_leida?: boolean | null
          orden_ruta?: number | null
          org_id: string
          parte_token?: string | null
          pause_reason?: string | null
          prioridad?: string
          priority_insert?: boolean | null
          quote_id?: string | null
          rescheduled_from?: string | null
          started_at?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string
          ventana_fin?: string | null
          ventana_inicio?: string | null
        }
        Update: {
          client_id?: string | null
          completado_at?: string | null
          completado_por?: string | null
          cp?: string | null
          created_at?: string
          descripcion?: string | null
          direccion?: string | null
          direccion_normalizada?: string | null
          duracion_estimada_min?: number | null
          duracion_horas?: number | null
          estado?: string
          fecha_estimada_material?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          firma_cliente_url?: string | null
          geo_confirmed_at?: string | null
          geo_source?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          latitud?: number | null
          localidad?: string | null
          longitud?: number | null
          material_pendiente?: string | null
          notas_cierre?: string | null
          notas_trabajador?: string | null
          notas_trabajador_at?: string | null
          notas_trabajador_leida?: boolean | null
          orden_ruta?: number | null
          org_id?: string
          parte_token?: string | null
          pause_reason?: string | null
          prioridad?: string
          priority_insert?: boolean | null
          quote_id?: string | null
          rescheduled_from?: string | null
          started_at?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
          ventana_fin?: string | null
          ventana_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_jobs_completado_por_fkey"
            columns: ["completado_por"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_jobs_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_contratos: {
        Row: {
          client_id: string | null
          contract_id: string | null
          created_at: string | null
          cuota_mensual: number
          descripcion_servicios: string | null
          dia_facturacion: number | null
          direccion_instalacion: string | null
          duracion_meses: number | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          frecuencia_preventivo: string | null
          id: string
          incluye_guardia: boolean | null
          incluye_preventivos: boolean | null
          iva_pct: number | null
          location_id: string | null
          materiales_incluidos: boolean | null
          metodo_pago: string | null
          nombre_cliente: string | null
          notas: string | null
          num_visitas_preventivo: number | null
          numero: string | null
          oficio: string
          org_id: string
          plantilla_id: string | null
          preaviso_cancelacion_dias: number | null
          presupuesto_id: string | null
          proxima_factura: string | null
          renovacion_automatica: boolean | null
          sector: string | null
          sla_nivel: string | null
          tiempo_respuesta_h: number | null
          tipo_facturacion: string | null
          ultima_factura: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          cuota_mensual: number
          descripcion_servicios?: string | null
          dia_facturacion?: number | null
          direccion_instalacion?: string | null
          duracion_meses?: number | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          frecuencia_preventivo?: string | null
          id?: string
          incluye_guardia?: boolean | null
          incluye_preventivos?: boolean | null
          iva_pct?: number | null
          location_id?: string | null
          materiales_incluidos?: boolean | null
          metodo_pago?: string | null
          nombre_cliente?: string | null
          notas?: string | null
          num_visitas_preventivo?: number | null
          numero?: string | null
          oficio: string
          org_id: string
          plantilla_id?: string | null
          preaviso_cancelacion_dias?: number | null
          presupuesto_id?: string | null
          proxima_factura?: string | null
          renovacion_automatica?: boolean | null
          sector?: string | null
          sla_nivel?: string | null
          tiempo_respuesta_h?: number | null
          tipo_facturacion?: string | null
          ultima_factura?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          cuota_mensual?: number
          descripcion_servicios?: string | null
          dia_facturacion?: number | null
          direccion_instalacion?: string | null
          duracion_meses?: number | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          frecuencia_preventivo?: string | null
          id?: string
          incluye_guardia?: boolean | null
          incluye_preventivos?: boolean | null
          iva_pct?: number | null
          location_id?: string | null
          materiales_incluidos?: boolean | null
          metodo_pago?: string | null
          nombre_cliente?: string | null
          notas?: string | null
          num_visitas_preventivo?: number | null
          numero?: string | null
          oficio?: string
          org_id?: string
          plantilla_id?: string | null
          preaviso_cancelacion_dias?: number | null
          presupuesto_id?: string | null
          proxima_factura?: string | null
          renovacion_automatica?: boolean | null
          sector?: string | null
          sla_nivel?: string | null
          tiempo_respuesta_h?: number | null
          tipo_facturacion?: string | null
          ultima_factura?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contrato_org_client_location"
            columns: ["org_id", "client_id", "location_id"]
            isOneToOne: false
            referencedRelation: "trade_client_locations"
            referencedColumns: ["org_id", "client_id", "id"]
          },
          {
            foreignKeyName: "trade_maintenance_contratos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_contratos_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "trade_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_contratos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_contratos_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_plantillas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_contratos_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_facturas: {
        Row: {
          client_id: string | null
          contrato_id: string
          created_at: string | null
          cuota_base: number
          estado: string
          extras: number | null
          fecha_emision: string | null
          fecha_pago: string | null
          fecha_vencimiento: string | null
          id: string
          iva_pct: number | null
          notas: string | null
          numero: string | null
          org_id: string
          periodo_fin: string
          periodo_inicio: string
          total_con_iva: number
          total_neto: number
        }
        Insert: {
          client_id?: string | null
          contrato_id: string
          created_at?: string | null
          cuota_base: number
          estado?: string
          extras?: number | null
          fecha_emision?: string | null
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          iva_pct?: number | null
          notas?: string | null
          numero?: string | null
          org_id: string
          periodo_fin: string
          periodo_inicio: string
          total_con_iva: number
          total_neto: number
        }
        Update: {
          client_id?: string | null
          contrato_id?: string
          created_at?: string | null
          cuota_base?: number
          estado?: string
          extras?: number | null
          fecha_emision?: string | null
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          iva_pct?: number | null
          notas?: string | null
          numero?: string | null
          org_id?: string
          periodo_fin?: string
          periodo_inicio?: string
          total_con_iva?: number
          total_neto?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_maintenance_facturas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_facturas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_facturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_incidencias: {
        Row: {
          client_id: string | null
          contrato_id: string | null
          created_at: string | null
          descripcion: string | null
          es_extra_contrato: boolean | null
          estado: string
          fecha_asignacion: string | null
          fecha_inicio_intervencion: string | null
          fecha_reporte: string | null
          fecha_resolucion: string | null
          id: string
          importe_extra: number | null
          notas_resolucion: string | null
          org_id: string
          prioridad: string
          sla_cumplido: boolean | null
          tecnico_email: string | null
          tecnico_user_id: string | null
          tiempo_resolucion_min: number | null
          tiempo_respuesta_min: number | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          es_extra_contrato?: boolean | null
          estado?: string
          fecha_asignacion?: string | null
          fecha_inicio_intervencion?: string | null
          fecha_reporte?: string | null
          fecha_resolucion?: string | null
          id?: string
          importe_extra?: number | null
          notas_resolucion?: string | null
          org_id: string
          prioridad?: string
          sla_cumplido?: boolean | null
          tecnico_email?: string | null
          tecnico_user_id?: string | null
          tiempo_resolucion_min?: number | null
          tiempo_respuesta_min?: number | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          es_extra_contrato?: boolean | null
          estado?: string
          fecha_asignacion?: string | null
          fecha_inicio_intervencion?: string | null
          fecha_reporte?: string | null
          fecha_resolucion?: string | null
          id?: string
          importe_extra?: number | null
          notas_resolucion?: string | null
          org_id?: string
          prioridad?: string
          sla_cumplido?: boolean | null
          tecnico_email?: string | null
          tecnico_user_id?: string | null
          tiempo_resolucion_min?: number | null
          tiempo_respuesta_min?: number | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_maintenance_incidencias_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_incidencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_incidencias_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_modelos: {
        Row: {
          activo: boolean | null
          basado_en_plantilla_id: string | null
          created_at: string | null
          datos_json: Json | null
          descripcion: string | null
          id: string
          nombre: string
          org_id: string
          veces_usado: number | null
        }
        Insert: {
          activo?: boolean | null
          basado_en_plantilla_id?: string | null
          created_at?: string | null
          datos_json?: Json | null
          descripcion?: string | null
          id?: string
          nombre: string
          org_id: string
          veces_usado?: number | null
        }
        Update: {
          activo?: boolean | null
          basado_en_plantilla_id?: string | null
          created_at?: string | null
          datos_json?: Json | null
          descripcion?: string | null
          id?: string
          nombre?: string
          org_id?: string
          veces_usado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_maintenance_modelos_basado_en_plantilla_id_fkey"
            columns: ["basado_en_plantilla_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_plantillas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_modelos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_oficios: {
        Row: {
          activo: boolean
          aliases: string[] | null
          codigo: string
          created_at: string | null
          descripcion: string | null
          grupo: string | null
          icono: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          aliases?: string[] | null
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          grupo?: string | null
          icono?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          aliases?: string[] | null
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          grupo?: string | null
          icono?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      trade_maintenance_plantillas: {
        Row: {
          activo: boolean
          clausulas_adicionales: string | null
          codigo: string
          created_at: string | null
          cuota_mensual_base: number | null
          descripcion: string | null
          frecuencia_preventivo: string | null
          id: string
          incluye_guardia: boolean
          incluye_preventivos: boolean
          materiales_incluidos: boolean
          nombre: string
          num_visitas_preventivo: number | null
          oficio_id: string
          penalizacion_sla_pct: number | null
          precio_max: number | null
          precio_min: number | null
          sector_id: string
          sla_nivel: string
          variables: string[] | null
        }
        Insert: {
          activo?: boolean
          clausulas_adicionales?: string | null
          codigo: string
          created_at?: string | null
          cuota_mensual_base?: number | null
          descripcion?: string | null
          frecuencia_preventivo?: string | null
          id?: string
          incluye_guardia?: boolean
          incluye_preventivos?: boolean
          materiales_incluidos?: boolean
          nombre: string
          num_visitas_preventivo?: number | null
          oficio_id: string
          penalizacion_sla_pct?: number | null
          precio_max?: number | null
          precio_min?: number | null
          sector_id: string
          sla_nivel: string
          variables?: string[] | null
        }
        Update: {
          activo?: boolean
          clausulas_adicionales?: string | null
          codigo?: string
          created_at?: string | null
          cuota_mensual_base?: number | null
          descripcion?: string | null
          frecuencia_preventivo?: string | null
          id?: string
          incluye_guardia?: boolean
          incluye_preventivos?: boolean
          materiales_incluidos?: boolean
          nombre?: string
          num_visitas_preventivo?: number | null
          oficio_id?: string
          penalizacion_sla_pct?: number | null
          precio_max?: number | null
          precio_min?: number | null
          sector_id?: string
          sla_nivel?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_maintenance_plantillas_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_oficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_plantillas_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_presupuestos: {
        Row: {
          client_id: string | null
          created_at: string | null
          cuota_anual: number | null
          cuota_mensual: number | null
          cuota_trimestral: number | null
          descripcion_servicios: string | null
          direccion_instalacion: string | null
          estado: string
          fecha: string | null
          fecha_aceptado: string | null
          fecha_enviado: string | null
          fecha_vencimiento: string | null
          generado_por_ia: boolean | null
          ia_json: Json | null
          ia_prompt_usado: string | null
          id: string
          incluye_guardia: boolean | null
          incluye_preventivos: boolean | null
          iva_pct: number | null
          location_id: string | null
          materiales_incluidos: boolean | null
          nombre_cliente: string | null
          notas: string | null
          num_visitas_preventivo: number | null
          numero: string | null
          oficio: string
          org_id: string
          plantilla_id: string | null
          sector: string | null
          sla_nivel: string | null
          texto_libre: string | null
          tiempo_respuesta_h: number | null
          tipo_facturacion: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          cuota_anual?: number | null
          cuota_mensual?: number | null
          cuota_trimestral?: number | null
          descripcion_servicios?: string | null
          direccion_instalacion?: string | null
          estado?: string
          fecha?: string | null
          fecha_aceptado?: string | null
          fecha_enviado?: string | null
          fecha_vencimiento?: string | null
          generado_por_ia?: boolean | null
          ia_json?: Json | null
          ia_prompt_usado?: string | null
          id?: string
          incluye_guardia?: boolean | null
          incluye_preventivos?: boolean | null
          iva_pct?: number | null
          location_id?: string | null
          materiales_incluidos?: boolean | null
          nombre_cliente?: string | null
          notas?: string | null
          num_visitas_preventivo?: number | null
          numero?: string | null
          oficio: string
          org_id: string
          plantilla_id?: string | null
          sector?: string | null
          sla_nivel?: string | null
          texto_libre?: string | null
          tiempo_respuesta_h?: number | null
          tipo_facturacion?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          cuota_anual?: number | null
          cuota_mensual?: number | null
          cuota_trimestral?: number | null
          descripcion_servicios?: string | null
          direccion_instalacion?: string | null
          estado?: string
          fecha?: string | null
          fecha_aceptado?: string | null
          fecha_enviado?: string | null
          fecha_vencimiento?: string | null
          generado_por_ia?: boolean | null
          ia_json?: Json | null
          ia_prompt_usado?: string | null
          id?: string
          incluye_guardia?: boolean | null
          incluye_preventivos?: boolean | null
          iva_pct?: number | null
          location_id?: string | null
          materiales_incluidos?: boolean | null
          nombre_cliente?: string | null
          notas?: string | null
          num_visitas_preventivo?: number | null
          numero?: string | null
          oficio?: string
          org_id?: string
          plantilla_id?: string | null
          sector?: string | null
          sla_nivel?: string | null
          texto_libre?: string | null
          tiempo_respuesta_h?: number | null
          tipo_facturacion?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_presup_org_client_location"
            columns: ["org_id", "client_id", "location_id"]
            isOneToOne: false
            referencedRelation: "trade_client_locations"
            referencedColumns: ["org_id", "client_id", "id"]
          },
          {
            foreignKeyName: "trade_maintenance_presupuestos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_presupuestos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_maintenance_presupuestos_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "trade_maintenance_plantillas"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_maintenance_recargos: {
        Row: {
          activo: boolean
          codigo: string
          descripcion: string | null
          id: string
          nombre: string
          porcentaje: number
          tipo: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          descripcion?: string | null
          id?: string
          nombre: string
          porcentaje: number
          tipo: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          porcentaje?: number
          tipo?: string
        }
        Relationships: []
      }
      trade_maintenance_sectores: {
        Row: {
          activo: boolean
          codigo: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      trade_maintenance_sla: {
        Row: {
          activo: boolean
          color: string | null
          descripcion: string | null
          id: string
          nivel: string
          nombre: string
          tiempo_resolucion_min: number
          tiempo_respuesta_min: number
        }
        Insert: {
          activo?: boolean
          color?: string | null
          descripcion?: string | null
          id?: string
          nivel: string
          nombre: string
          tiempo_resolucion_min: number
          tiempo_respuesta_min: number
        }
        Update: {
          activo?: boolean
          color?: string | null
          descripcion?: string | null
          id?: string
          nivel?: string
          nombre?: string
          tiempo_resolucion_min?: number
          tiempo_respuesta_min?: number
        }
        Relationships: []
      }
      trade_marketplace_actor_members: {
        Row: {
          accepted_at: string | null
          activo: boolean
          actor_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          last_accessed_at: string | null
          notas: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          activo?: boolean
          actor_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          last_accessed_at?: string | null
          notas?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          activo?: boolean
          actor_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          last_accessed_at?: string | null
          notas?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_actor_members_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_actor_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_actor_org_condition_prices: {
        Row: {
          activa: boolean
          condition_id: string
          created_at: string
          id: string
          offering_id: string
          precio_neto: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          activa?: boolean
          condition_id: string
          created_at?: string
          id?: string
          offering_id: string
          precio_neto: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          activa?: boolean
          condition_id?: string
          created_at?: string
          id?: string
          offering_id?: string
          precio_neto?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_actor_org_condition_prices_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actor_org_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_actor_org_condition_prices_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_actor_org_conditions: {
        Row: {
          activa: boolean
          actor_id: string
          condiciones_pago: string | null
          created_at: string
          customer_number: string | null
          descuento_pct: number | null
          id: string
          notas_internas: string | null
          org_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          activa?: boolean
          actor_id: string
          condiciones_pago?: string | null
          created_at?: string
          customer_number?: string | null
          descuento_pct?: number | null
          id?: string
          notas_internas?: string | null
          org_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          activa?: boolean
          actor_id?: string
          condiciones_pago?: string | null
          created_at?: string
          customer_number?: string | null
          descuento_pct?: number | null
          id?: string
          notas_internas?: string | null
          org_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_actor_org_conditions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_actor_org_conditions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_actor_types: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          icono: string | null
          id: string
          label: string
          posicion: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id: string
          label: string
          posicion?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          icono?: string | null
          id?: string
          label?: string
          posicion?: number
        }
        Relationships: []
      }
      trade_marketplace_actors: {
        Row: {
          actor_type: string
          brand_id: string | null
          country: string
          created_at: string
          email_contacto: string | null
          estado: string
          id: string
          legal_name: string | null
          logo_url: string | null
          metadata: Json
          nombre: string
          settings: Json
          slug: string
          supplier_catalog_id: string | null
          tax_id: string | null
          telefono: string | null
          updated_at: string
          verificado: boolean
          verificado_at: string | null
          verificado_by: string | null
          website: string | null
        }
        Insert: {
          actor_type: string
          brand_id?: string | null
          country?: string
          created_at?: string
          email_contacto?: string | null
          estado?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          metadata?: Json
          nombre: string
          settings?: Json
          slug: string
          supplier_catalog_id?: string | null
          tax_id?: string | null
          telefono?: string | null
          updated_at?: string
          verificado?: boolean
          verificado_at?: string | null
          verificado_by?: string | null
          website?: string | null
        }
        Update: {
          actor_type?: string
          brand_id?: string | null
          country?: string
          created_at?: string
          email_contacto?: string | null
          estado?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          metadata?: Json
          nombre?: string
          settings?: Json
          slug?: string
          supplier_catalog_id?: string | null
          tax_id?: string | null
          telefono?: string | null
          updated_at?: string
          verificado?: boolean
          verificado_at?: string | null
          verificado_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_actors_actor_type_fkey"
            columns: ["actor_type"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actor_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_actors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_actors_supplier_catalog_id_fkey"
            columns: ["supplier_catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_ad_bookings: {
        Row: {
          actor_id: string
          aprobado_at: string | null
          aprobado_por: string | null
          booking_commercial_value: number | null
          commercial_terms_snapshot: Json | null
          created_at: string
          estado: string
          estimated_days_snapshot: number | null
          estimated_total_snapshot: number | null
          fin: string
          id: string
          inicio: string
          mensaje: string | null
          notas: string | null
          origen: string
          pricing_mode: string | null
          rate_amount_snapshot: number | null
          rate_currency_snapshot: string | null
          rate_unit_snapshot: string | null
          slot_id: string
          target_id: string | null
          target_ids: string[] | null
          target_label: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          aprobado_at?: string | null
          aprobado_por?: string | null
          booking_commercial_value?: number | null
          commercial_terms_snapshot?: Json | null
          created_at?: string
          estado?: string
          estimated_days_snapshot?: number | null
          estimated_total_snapshot?: number | null
          fin: string
          id?: string
          inicio: string
          mensaje?: string | null
          notas?: string | null
          origen?: string
          pricing_mode?: string | null
          rate_amount_snapshot?: number | null
          rate_currency_snapshot?: string | null
          rate_unit_snapshot?: string | null
          slot_id: string
          target_id?: string | null
          target_ids?: string[] | null
          target_label?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          aprobado_at?: string | null
          aprobado_por?: string | null
          booking_commercial_value?: number | null
          commercial_terms_snapshot?: Json | null
          created_at?: string
          estado?: string
          estimated_days_snapshot?: number | null
          estimated_total_snapshot?: number | null
          fin?: string
          id?: string
          inicio?: string
          mensaje?: string | null
          notas?: string | null
          origen?: string
          pricing_mode?: string | null
          rate_amount_snapshot?: number | null
          rate_currency_snapshot?: string | null
          rate_unit_snapshot?: string | null
          slot_id?: string
          target_id?: string | null
          target_ids?: string[] | null
          target_label?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_ad_bookings_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_ad_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_ad_campaigns: {
        Row: {
          accent: string | null
          activa: boolean
          actor_id: string | null
          advertiser_name: string
          aprobada_at: string | null
          aprobada_por: string | null
          bg: string | null
          booking_id: string | null
          campaign_source: string
          created_at: string
          cta_label: string
          destination_type: string
          destination_value: string | null
          end_at: string | null
          estado: string
          eyebrow: string | null
          id: string
          image_url: string | null
          metadata: Json
          mobile_image_url: string | null
          nombre: string
          oficio: string | null
          priority: number
          rechazo_motivo: string | null
          slot_id: string
          start_at: string | null
          subtitle: string | null
          target_id: string | null
          target_ids: string[] | null
          target_label: string | null
          target_type: string | null
          text_color: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string | null
          activa?: boolean
          actor_id?: string | null
          advertiser_name: string
          aprobada_at?: string | null
          aprobada_por?: string | null
          bg?: string | null
          booking_id?: string | null
          campaign_source?: string
          created_at?: string
          cta_label: string
          destination_type: string
          destination_value?: string | null
          end_at?: string | null
          estado?: string
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          mobile_image_url?: string | null
          nombre: string
          oficio?: string | null
          priority?: number
          rechazo_motivo?: string | null
          slot_id: string
          start_at?: string | null
          subtitle?: string | null
          target_id?: string | null
          target_ids?: string[] | null
          target_label?: string | null
          target_type?: string | null
          text_color?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string | null
          activa?: boolean
          actor_id?: string | null
          advertiser_name?: string
          aprobada_at?: string | null
          aprobada_por?: string | null
          bg?: string | null
          booking_id?: string | null
          campaign_source?: string
          created_at?: string
          cta_label?: string
          destination_type?: string
          destination_value?: string | null
          end_at?: string | null
          estado?: string
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          mobile_image_url?: string | null
          nombre?: string
          oficio?: string | null
          priority?: number
          rechazo_motivo?: string | null
          slot_id?: string
          start_at?: string | null
          subtitle?: string | null
          target_id?: string | null
          target_ids?: string[] | null
          target_label?: string | null
          target_type?: string | null
          text_color?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_campaign_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_ad_campaigns_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_ad_campaigns_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_ad_creatives: {
        Row: {
          activa: boolean
          alt_text: string | null
          aprobada_at: string | null
          aprobada_por: string | null
          body_text: string | null
          campaign_id: string
          created_at: string
          creative_mode: string
          cta_text: string | null
          discount_label: string | null
          estado: string
          generada_ia: boolean
          headline: string | null
          ia_model: string | null
          ia_prompt_ref: string | null
          id: string
          image_url: string | null
          mobile_image_url: string | null
          old_price_display: number | null
          overlay_strength: number
          price_display: number | null
          published_at: string | null
          published_by: string | null
          rechazo_motivo: string | null
          submitted_at: string | null
          text_position: string
          theme_preset: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          alt_text?: string | null
          aprobada_at?: string | null
          aprobada_por?: string | null
          body_text?: string | null
          campaign_id: string
          created_at?: string
          creative_mode?: string
          cta_text?: string | null
          discount_label?: string | null
          estado?: string
          generada_ia?: boolean
          headline?: string | null
          ia_model?: string | null
          ia_prompt_ref?: string | null
          id?: string
          image_url?: string | null
          mobile_image_url?: string | null
          old_price_display?: number | null
          overlay_strength?: number
          price_display?: number | null
          published_at?: string | null
          published_by?: string | null
          rechazo_motivo?: string | null
          submitted_at?: string | null
          text_position?: string
          theme_preset?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          alt_text?: string | null
          aprobada_at?: string | null
          aprobada_por?: string | null
          body_text?: string | null
          campaign_id?: string
          created_at?: string
          creative_mode?: string
          cta_text?: string | null
          discount_label?: string | null
          estado?: string
          generada_ia?: boolean
          headline?: string | null
          ia_model?: string | null
          ia_prompt_ref?: string | null
          id?: string
          image_url?: string | null
          mobile_image_url?: string | null
          old_price_display?: number | null
          overlay_strength?: number
          price_display?: number | null
          published_at?: string | null
          published_by?: string | null
          rechazo_motivo?: string | null
          submitted_at?: string | null
          text_position?: string
          theme_preset?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_ad_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_ad_slots: {
        Row: {
          activo: boolean
          alto_min_px: number | null
          ancho_px: number | null
          aspect_ratio: string | null
          comercializable: boolean
          created_at: string
          descripcion: string | null
          dispositivo: string
          fallback_campaign_id: string | null
          formato: string
          id: string
          max_duration_days: number | null
          metadata: Json
          min_duration_days: number | null
          nombre: string
          pagina: string
          posicion: number
          rate_amount: number | null
          rate_currency: string
          rate_unit: string | null
        }
        Insert: {
          activo?: boolean
          alto_min_px?: number | null
          ancho_px?: number | null
          aspect_ratio?: string | null
          comercializable?: boolean
          created_at?: string
          descripcion?: string | null
          dispositivo: string
          fallback_campaign_id?: string | null
          formato: string
          id: string
          max_duration_days?: number | null
          metadata?: Json
          min_duration_days?: number | null
          nombre: string
          pagina: string
          posicion?: number
          rate_amount?: number | null
          rate_currency?: string
          rate_unit?: string | null
        }
        Update: {
          activo?: boolean
          alto_min_px?: number | null
          ancho_px?: number | null
          aspect_ratio?: string | null
          comercializable?: boolean
          created_at?: string
          descripcion?: string | null
          dispositivo?: string
          fallback_campaign_id?: string | null
          formato?: string
          id?: string
          max_duration_days?: number | null
          metadata?: Json
          min_duration_days?: number | null
          nombre?: string
          pagina?: string
          posicion?: number
          rate_amount?: number | null
          rate_currency?: string
          rate_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_ad_slots_fallback_campaign_id_fkey"
            columns: ["fallback_campaign_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_balances: {
        Row: {
          available_amount: number
          created_at: string
          currency: string
          historical_settled_amount: number
          id: string
          last_ledger_entry_id: string | null
          last_recalculated_at: string | null
          negative_amount: number
          negative_since: string | null
          pending_amount: number
          projection_strategy: string
          provider_actor_id: string
          recovery_in_progress: boolean
          reserved_amount: number
          total_economic_balance: number | null
          updated_at: string
        }
        Insert: {
          available_amount?: number
          created_at?: string
          currency?: string
          historical_settled_amount?: number
          id?: string
          last_ledger_entry_id?: string | null
          last_recalculated_at?: string | null
          negative_amount?: number
          negative_since?: string | null
          pending_amount?: number
          projection_strategy?: string
          provider_actor_id: string
          recovery_in_progress?: boolean
          reserved_amount?: number
          total_economic_balance?: number | null
          updated_at?: string
        }
        Update: {
          available_amount?: number
          created_at?: string
          currency?: string
          historical_settled_amount?: number
          id?: string
          last_ledger_entry_id?: string | null
          last_recalculated_at?: string | null
          negative_amount?: number
          negative_since?: string | null
          pending_amount?: number
          projection_strategy?: string
          provider_actor_id?: string
          recovery_in_progress?: boolean
          reserved_amount?: number
          total_economic_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_balance_actor"
            columns: ["provider_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_balance_last_entry"
            columns: ["last_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_brands: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          logo_url: string | null
          nombre: string
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre: string
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre?: string
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      trade_marketplace_cart_items: {
        Row: {
          activo: boolean
          cantidad: number
          cart_id: string
          created_at: string
          descripcion_compra: string | null
          descripcion_original: string
          ia_añadido: boolean
          ia_sugerencia: string | null
          ia_tipo: string | null
          id: string
          precio_unitario_final: number | null
          provider_alternatives: Json
          selected_actor_id: string | null
          selected_offering_id: string | null
          source_item_id: string | null
          source_item_type: string | null
          total_linea: number | null
          unidad: string
          universal_product_id: string | null
          up_match_confidence: number | null
          up_match_method: string | null
        }
        Insert: {
          activo?: boolean
          cantidad: number
          cart_id: string
          created_at?: string
          descripcion_compra?: string | null
          descripcion_original: string
          ia_añadido?: boolean
          ia_sugerencia?: string | null
          ia_tipo?: string | null
          id?: string
          precio_unitario_final?: number | null
          provider_alternatives?: Json
          selected_actor_id?: string | null
          selected_offering_id?: string | null
          source_item_id?: string | null
          source_item_type?: string | null
          total_linea?: number | null
          unidad?: string
          universal_product_id?: string | null
          up_match_confidence?: number | null
          up_match_method?: string | null
        }
        Update: {
          activo?: boolean
          cantidad?: number
          cart_id?: string
          created_at?: string
          descripcion_compra?: string | null
          descripcion_original?: string
          ia_añadido?: boolean
          ia_sugerencia?: string | null
          ia_tipo?: string | null
          id?: string
          precio_unitario_final?: number | null
          provider_alternatives?: Json
          selected_actor_id?: string | null
          selected_offering_id?: string | null
          source_item_id?: string | null
          source_item_type?: string | null
          total_linea?: number | null
          unidad?: string
          universal_product_id?: string | null
          up_match_confidence?: number | null
          up_match_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_cart_items_selected_actor_id_fkey"
            columns: ["selected_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_cart_items_selected_offering_id_fkey"
            columns: ["selected_offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_cart_items_universal_product_id_fkey"
            columns: ["universal_product_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_carts: {
        Row: {
          created_at: string
          estado: string
          id: string
          notas: string | null
          ordered_at: string | null
          org_id: string
          source_id: string | null
          source_ref: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          notas?: string | null
          ordered_at?: string | null
          org_id: string
          source_id?: string | null
          source_ref?: string | null
          source_type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          notas?: string | null
          ordered_at?: string | null
          org_id?: string
          source_id?: string | null
          source_ref?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_carts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_categories: {
        Row: {
          activa: boolean
          created_at: string
          icono: string | null
          id: string
          nombre: string
          oficio: string | null
          parent_id: string | null
          posicion: number
          slug: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          icono?: string | null
          id?: string
          nombre: string
          oficio?: string | null
          parent_id?: string | null
          posicion?: number
          slug: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          icono?: string | null
          id?: string
          nombre?: string
          oficio?: string | null
          parent_id?: string | null
          posicion?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_commission_policies: {
        Row: {
          applies_to_shipping: boolean
          commission_base: string
          commission_enabled: boolean
          commission_rate: number
          commission_tax_rate: number
          commission_type: string
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          nombre: string
          notas: string | null
          provider_actor_id: string | null
          simulation_only: boolean
          updated_at: string
        }
        Insert: {
          applies_to_shipping?: boolean
          commission_base?: string
          commission_enabled?: boolean
          commission_rate?: number
          commission_tax_rate?: number
          commission_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          nombre: string
          notas?: string | null
          provider_actor_id?: string | null
          simulation_only?: boolean
          updated_at?: string
        }
        Update: {
          applies_to_shipping?: boolean
          commission_base?: string
          commission_enabled?: boolean
          commission_rate?: number
          commission_tax_rate?: number
          commission_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          nombre?: string
          notas?: string | null
          provider_actor_id?: string | null
          simulation_only?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_commission_policies_provider_actor_id_fkey"
            columns: ["provider_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_consumable_rules: {
        Row: {
          activa: boolean
          consumible_desc: string
          created_at: string
          familia_trigger: string
          id: string
          keyword_trigger: string | null
          ratio_cantidad: number
          unidad: string
        }
        Insert: {
          activa?: boolean
          consumible_desc: string
          created_at?: string
          familia_trigger: string
          id?: string
          keyword_trigger?: string | null
          ratio_cantidad?: number
          unidad?: string
        }
        Update: {
          activa?: boolean
          consumible_desc?: string
          created_at?: string
          familia_trigger?: string
          id?: string
          keyword_trigger?: string | null
          ratio_cantidad?: number
          unidad?: string
        }
        Relationships: []
      }
      trade_marketplace_dispute_evidence: {
        Row: {
          created_at: string
          description: string | null
          dispute_id: string
          document_reference: string | null
          evidence_type: string
          id: string
          storage_path: string | null
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          dispute_id: string
          document_reference?: string | null
          evidence_type: string
          id?: string
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          dispute_id?: string
          document_reference?: string | null
          evidence_type?: string
          id?: string
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_disputes: {
        Row: {
          amount: number
          buyer_actor_id: string | null
          chargeback_amount: number | null
          chargeback_fee_amount: number
          chargeback_posted: boolean
          chargeback_reversed: boolean
          closed_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          dispute_number: string
          evidence_due_at: string | null
          external_dispute_id: string | null
          external_payment_id: string | null
          external_provider: string
          id: string
          idempotency_key: string | null
          master_order_id: string
          metadata: Json | null
          opened_at: string
          outcome: string | null
          provider_actor_id: string
          reason: string | null
          reason_code: string | null
          resolved_at: string | null
          responsibility: string
          simulation_only: boolean
          source_event_id: string | null
          status: string
          submitted_at: string | null
          supplier_order_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_actor_id?: string | null
          chargeback_amount?: number | null
          chargeback_fee_amount?: number
          chargeback_posted?: boolean
          chargeback_reversed?: boolean
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_number: string
          evidence_due_at?: string | null
          external_dispute_id?: string | null
          external_payment_id?: string | null
          external_provider?: string
          id?: string
          idempotency_key?: string | null
          master_order_id: string
          metadata?: Json | null
          opened_at?: string
          outcome?: string | null
          provider_actor_id: string
          reason?: string | null
          reason_code?: string | null
          resolved_at?: string | null
          responsibility?: string
          simulation_only?: boolean
          source_event_id?: string | null
          status?: string
          submitted_at?: string | null
          supplier_order_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_actor_id?: string | null
          chargeback_amount?: number | null
          chargeback_fee_amount?: number
          chargeback_posted?: boolean
          chargeback_reversed?: boolean
          closed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_number?: string
          evidence_due_at?: string | null
          external_dispute_id?: string | null
          external_payment_id?: string | null
          external_provider?: string
          id?: string
          idempotency_key?: string | null
          master_order_id?: string
          metadata?: Json | null
          opened_at?: string
          outcome?: string | null
          provider_actor_id?: string
          reason?: string | null
          reason_code?: string | null
          resolved_at?: string | null
          responsibility?: string
          simulation_only?: boolean
          source_event_id?: string | null
          status?: string
          submitted_at?: string | null
          supplier_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_disputes_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_disputes_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_financial_config: {
        Row: {
          category: string
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          config_key: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trade_marketplace_guest_antifraud_signals: {
        Row: {
          checkout_key: string
          created_at: string
          expires_at: string
          id: string
          signal_hash: string
          signal_type: string
        }
        Insert: {
          checkout_key: string
          created_at?: string
          expires_at?: string
          id?: string
          signal_hash: string
          signal_type: string
        }
        Update: {
          checkout_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          signal_hash?: string
          signal_type?: string
        }
        Relationships: []
      }
      trade_marketplace_guest_customers: {
        Row: {
          claimed_at: string | null
          claimed_by_org_id: string | null
          created_at: string
          email: string
          empresa: string | null
          id: string
          linked_at: string | null
          linked_org_id: string | null
          nif: string | null
          nombre: string | null
          telefono: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_org_id?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          id?: string
          linked_at?: string | null
          linked_org_id?: string | null
          nif?: string | null
          nombre?: string | null
          telefono?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by_org_id?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          id?: string
          linked_at?: string | null
          linked_org_id?: string | null
          nif?: string | null
          nombre?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_guest_customers_claimed_by_org_id_fkey"
            columns: ["claimed_by_org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_guest_customers_linked_org_id_fkey"
            columns: ["linked_org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_guest_sessions: {
        Row: {
          checkout_key: string
          created_at: string
          expires_at: string
          guest_id: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          scope: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          checkout_key: string
          created_at?: string
          expires_at?: string
          guest_id: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          scope?: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          checkout_key?: string
          created_at?: string
          expires_at?: string
          guest_id?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_guest_sessions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_guest_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_invitations: {
        Row: {
          actor_id: string
          created_at: string
          email: string
          estado: string
          expires_at: string
          id: string
          invited_by: string | null
          role_id: string
          token_hash: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          email: string
          estado?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id: string
          token_hash: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          email?: string
          estado?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_invitations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_ledger_entries: {
        Row: {
          actor_id: string | null
          amount: number
          compensates_entry_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          description: string | null
          dispute_id: string | null
          entry_type: string
          external_id: string | null
          external_provider: string
          external_type: string | null
          id: string
          master_order_id: string | null
          occurred_at: string
          refund_id: string | null
          settlement_id: string | null
          source_event_id: string | null
          status: string
          supplier_order_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount: number
          compensates_entry_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dispute_id?: string | null
          entry_type: string
          external_id?: string | null
          external_provider?: string
          external_type?: string | null
          id?: string
          master_order_id?: string | null
          occurred_at?: string
          refund_id?: string | null
          settlement_id?: string | null
          source_event_id?: string | null
          status?: string
          supplier_order_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount?: number
          compensates_entry_id?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dispute_id?: string | null
          entry_type?: string
          external_id?: string | null
          external_provider?: string
          external_type?: string | null
          id?: string
          master_order_id?: string | null
          occurred_at?: string
          refund_id?: string | null
          settlement_id?: string | null
          source_event_id?: string | null
          status?: string
          supplier_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_ledger_entries_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_ledger_entries_compensates_entry_id_fkey"
            columns: ["compensates_entry_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_ledger_entries_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_ledger_entries_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_location_inventory: {
        Row: {
          id: string
          location_id: string
          offering_id: string
          plazo_local_dias: number | null
          reservado: number
          source: string | null
          stock_cantidad: number | null
          stock_status: Database["public"]["Enums"]["stock_local_status"]
          synthetic: boolean
          synthetic_dataset: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          location_id: string
          offering_id: string
          plazo_local_dias?: number | null
          reservado?: number
          source?: string | null
          stock_cantidad?: number | null
          stock_status?: Database["public"]["Enums"]["stock_local_status"]
          synthetic?: boolean
          synthetic_dataset?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          location_id?: string
          offering_id?: string
          plazo_local_dias?: number | null
          reservado?: number
          source?: string | null
          stock_cantidad?: number | null
          stock_status?: Database["public"]["Enums"]["stock_local_status"]
          synthetic?: boolean
          synthetic_dataset?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_location_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_location_inventory_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_master_orders: {
        Row: {
          buyer_snapshot: Json
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          checkout_gross_total: number
          checkout_key: string
          confirmed_at: string | null
          created_at: string
          currency: string
          delivery_address_snapshot: Json | null
          external_payment_intent_id: string | null
          external_provider: string
          fulfilled_at: string | null
          gmv_goods_gross: number | null
          gmv_goods_net: number | null
          gmv_shipping_net: number | null
          goods_gross_total: number
          goods_net_total: number
          goods_tax_total: number
          guest_customer_id: string | null
          id: string
          numero: string
          order_status: string
          org_id: string | null
          paid_at: string | null
          payment_status: string
          psp_fee_estimated: number | null
          refund_aggregate_status: string
          refund_gross_total: number
          shipping_gross_total: number
          shipping_net_total: number
          shipping_tax_total: number
          updated_at: string
        }
        Insert: {
          buyer_snapshot?: Json
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          checkout_gross_total?: number
          checkout_key: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          delivery_address_snapshot?: Json | null
          external_payment_intent_id?: string | null
          external_provider?: string
          fulfilled_at?: string | null
          gmv_goods_gross?: number | null
          gmv_goods_net?: number | null
          gmv_shipping_net?: number | null
          goods_gross_total?: number
          goods_net_total?: number
          goods_tax_total?: number
          guest_customer_id?: string | null
          id?: string
          numero: string
          order_status?: string
          org_id?: string | null
          paid_at?: string | null
          payment_status?: string
          psp_fee_estimated?: number | null
          refund_aggregate_status?: string
          refund_gross_total?: number
          shipping_gross_total?: number
          shipping_net_total?: number
          shipping_tax_total?: number
          updated_at?: string
        }
        Update: {
          buyer_snapshot?: Json
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          checkout_gross_total?: number
          checkout_key?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          delivery_address_snapshot?: Json | null
          external_payment_intent_id?: string | null
          external_provider?: string
          fulfilled_at?: string | null
          gmv_goods_gross?: number | null
          gmv_goods_net?: number | null
          gmv_shipping_net?: number | null
          goods_gross_total?: number
          goods_net_total?: number
          goods_tax_total?: number
          guest_customer_id?: string | null
          id?: string
          numero?: string
          order_status?: string
          org_id?: string | null
          paid_at?: string | null
          payment_status?: string
          psp_fee_estimated?: number | null
          refund_aggregate_status?: string
          refund_gross_total?: number
          shipping_gross_total?: number
          shipping_net_total?: number
          shipping_tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_master_orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_master_orders_guest_customer_id_fkey"
            columns: ["guest_customer_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_guest_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_master_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_member_permission_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          granted: boolean
          id: string
          member_id: string
          permission: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          granted: boolean
          id?: string
          member_id: string
          permission: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          member_id?: string
          permission?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_member_permission_overrides_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actor_members"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_notifications: {
        Row: {
          actor_id: string
          created_at: string
          cuerpo: string | null
          id: string
          leida: boolean
          leida_at: string | null
          ref_id: string | null
          ref_tipo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          cuerpo?: string | null
          id?: string
          leida?: boolean
          leida_at?: string | null
          ref_id?: string | null
          ref_tipo?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          cuerpo?: string | null
          id?: string
          leida?: boolean
          leida_at?: string | null
          ref_id?: string | null
          ref_tipo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_offering_promos: {
        Row: {
          activa: boolean
          audience: string
          created_at: string
          descuento_pct: number | null
          etiqueta: string | null
          id: string
          offering_id: string
          precio_promo_neto: number
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          activa?: boolean
          audience?: string
          created_at?: string
          descuento_pct?: number | null
          etiqueta?: string | null
          id?: string
          offering_id: string
          precio_promo_neto: number
          updated_at?: string
          valid_from: string
          valid_until: string
        }
        Update: {
          activa?: boolean
          audience?: string
          created_at?: string
          descuento_pct?: number | null
          etiqueta?: string | null
          id?: string
          offering_id?: string
          precio_promo_neto?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_offering_promos_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_order_counters: {
        Row: {
          actor_id: string
          last_seq: number
        }
        Insert: {
          actor_id: string
          last_seq?: number
        }
        Update: {
          actor_id?: string
          last_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_order_counters_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_order_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          from_estado: string | null
          id: string
          notas: string | null
          order_id: string
          payload: Json
          tipo: string
          to_estado: string | null
        }
        Insert: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          from_estado?: string | null
          id?: string
          notas?: string | null
          order_id: string
          payload?: Json
          tipo: string
          to_estado?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          from_estado?: string | null
          id?: string
          notas?: string | null
          order_id?: string
          payload?: Json
          tipo?: string
          to_estado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_order_items: {
        Row: {
          cantidad: number
          commissionable_unit_price_net_snapshot: number | null
          created_at: string
          currency: string | null
          descripcion: string
          descuento_importe_snapshot: number | null
          descuento_tipo_snapshot: string | null
          id: string
          item_gross_snapshot: number | null
          item_net_snapshot: number | null
          item_tax_snapshot: number | null
          offering_id: string | null
          order_id: string
          precio_total: number | null
          precio_unitario: number
          precio_unitario_lista_snapshot: number | null
          precio_unitario_neto_snapshot: number | null
          referencia: string | null
          tax_rate_snapshot: number | null
          unidad: string
          universal_product_id: string | null
        }
        Insert: {
          cantidad: number
          commissionable_unit_price_net_snapshot?: number | null
          created_at?: string
          currency?: string | null
          descripcion: string
          descuento_importe_snapshot?: number | null
          descuento_tipo_snapshot?: string | null
          id?: string
          item_gross_snapshot?: number | null
          item_net_snapshot?: number | null
          item_tax_snapshot?: number | null
          offering_id?: string | null
          order_id: string
          precio_total?: number | null
          precio_unitario: number
          precio_unitario_lista_snapshot?: number | null
          precio_unitario_neto_snapshot?: number | null
          referencia?: string | null
          tax_rate_snapshot?: number | null
          unidad?: string
          universal_product_id?: string | null
        }
        Update: {
          cantidad?: number
          commissionable_unit_price_net_snapshot?: number | null
          created_at?: string
          currency?: string | null
          descripcion?: string
          descuento_importe_snapshot?: number | null
          descuento_tipo_snapshot?: string | null
          id?: string
          item_gross_snapshot?: number | null
          item_net_snapshot?: number | null
          item_tax_snapshot?: number | null
          offering_id?: string | null
          order_id?: string
          precio_total?: number | null
          precio_unitario?: number
          precio_unitario_lista_snapshot?: number | null
          precio_unitario_neto_snapshot?: number | null
          referencia?: string | null
          tax_rate_snapshot?: number | null
          unidad?: string
          universal_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_order_items_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_order_items_universal_product_id_fkey"
            columns: ["universal_product_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_orders: {
        Row: {
          actor_id: string
          buyer_snapshot: Json | null
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          cart_id_v2: string | null
          checkout_key: string | null
          commission_base_snapshot: string | null
          commission_gross_snapshot: number | null
          commission_net_snapshot: number | null
          commission_policy_id_snapshot: string | null
          commission_rate_snapshot: number | null
          commission_tax_snapshot: number | null
          commission_type_snapshot: string | null
          commissionable_base_net_snapshot: number | null
          commissionable_shipping_snapshot: boolean | null
          completed_at: string | null
          confirmed_at: string | null
          coste_envio: number
          created_at: string
          currency: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_method: string | null
          delivery_notas: string | null
          direccion_entrega: Json | null
          estado: string
          external_payment_id: string | null
          external_provider: string | null
          external_transfer_id: string | null
          financial_snapshot_at: string | null
          goods_gross_snapshot: number | null
          goods_net_snapshot: number | null
          goods_tax_snapshot: number | null
          guest_customer_id: string | null
          guest_email: string | null
          id: string
          job_id: string | null
          master_order_id: string | null
          notas: string | null
          notas_proveedor: string | null
          numero: string
          org_id: string | null
          origen: string
          payment_method: string | null
          payment_status: string | null
          pickup_location_id: string | null
          pickup_location_snapshot: Json | null
          pickup_point_id: string | null
          precio_tipo: string | null
          preparing_at: string | null
          provider_payable_snapshot: number | null
          quote_id: string | null
          refund_status: string
          refunded_amount: number | null
          return_amount: number | null
          shipped_at: string | null
          shipping_gross_snapshot: number | null
          shipping_net_snapshot: number | null
          shipping_tax_snapshot: number | null
          sim_commission_gross: number | null
          sim_commission_net: number | null
          sim_commission_rate: number | null
          sim_commission_tax: number | null
          subtotal: number
          tax_rate_snapshot: number | null
          total: number
          total_refunded_amount: number
          tracking_ref: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          buyer_snapshot?: Json | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          cart_id_v2?: string | null
          checkout_key?: string | null
          commission_base_snapshot?: string | null
          commission_gross_snapshot?: number | null
          commission_net_snapshot?: number | null
          commission_policy_id_snapshot?: string | null
          commission_rate_snapshot?: number | null
          commission_tax_snapshot?: number | null
          commission_type_snapshot?: string | null
          commissionable_base_net_snapshot?: number | null
          commissionable_shipping_snapshot?: boolean | null
          completed_at?: string | null
          confirmed_at?: string | null
          coste_envio?: number
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_method?: string | null
          delivery_notas?: string | null
          direccion_entrega?: Json | null
          estado?: string
          external_payment_id?: string | null
          external_provider?: string | null
          external_transfer_id?: string | null
          financial_snapshot_at?: string | null
          goods_gross_snapshot?: number | null
          goods_net_snapshot?: number | null
          goods_tax_snapshot?: number | null
          guest_customer_id?: string | null
          guest_email?: string | null
          id?: string
          job_id?: string | null
          master_order_id?: string | null
          notas?: string | null
          notas_proveedor?: string | null
          numero: string
          org_id?: string | null
          origen?: string
          payment_method?: string | null
          payment_status?: string | null
          pickup_location_id?: string | null
          pickup_location_snapshot?: Json | null
          pickup_point_id?: string | null
          precio_tipo?: string | null
          preparing_at?: string | null
          provider_payable_snapshot?: number | null
          quote_id?: string | null
          refund_status?: string
          refunded_amount?: number | null
          return_amount?: number | null
          shipped_at?: string | null
          shipping_gross_snapshot?: number | null
          shipping_net_snapshot?: number | null
          shipping_tax_snapshot?: number | null
          sim_commission_gross?: number | null
          sim_commission_net?: number | null
          sim_commission_rate?: number | null
          sim_commission_tax?: number | null
          subtotal?: number
          tax_rate_snapshot?: number | null
          total?: number
          total_refunded_amount?: number
          tracking_ref?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          buyer_snapshot?: Json | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          cart_id_v2?: string | null
          checkout_key?: string | null
          commission_base_snapshot?: string | null
          commission_gross_snapshot?: number | null
          commission_net_snapshot?: number | null
          commission_policy_id_snapshot?: string | null
          commission_rate_snapshot?: number | null
          commission_tax_snapshot?: number | null
          commission_type_snapshot?: string | null
          commissionable_base_net_snapshot?: number | null
          commissionable_shipping_snapshot?: boolean | null
          completed_at?: string | null
          confirmed_at?: string | null
          coste_envio?: number
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_method?: string | null
          delivery_notas?: string | null
          direccion_entrega?: Json | null
          estado?: string
          external_payment_id?: string | null
          external_provider?: string | null
          external_transfer_id?: string | null
          financial_snapshot_at?: string | null
          goods_gross_snapshot?: number | null
          goods_net_snapshot?: number | null
          goods_tax_snapshot?: number | null
          guest_customer_id?: string | null
          guest_email?: string | null
          id?: string
          job_id?: string | null
          master_order_id?: string | null
          notas?: string | null
          notas_proveedor?: string | null
          numero?: string
          org_id?: string | null
          origen?: string
          payment_method?: string | null
          payment_status?: string | null
          pickup_location_id?: string | null
          pickup_location_snapshot?: Json | null
          pickup_point_id?: string | null
          precio_tipo?: string | null
          preparing_at?: string | null
          provider_payable_snapshot?: number | null
          quote_id?: string | null
          refund_status?: string
          refunded_amount?: number | null
          return_amount?: number | null
          shipped_at?: string | null
          shipping_gross_snapshot?: number | null
          shipping_net_snapshot?: number | null
          shipping_tax_snapshot?: number | null
          sim_commission_gross?: number | null
          sim_commission_net?: number | null
          sim_commission_rate?: number | null
          sim_commission_tax?: number | null
          subtotal?: number
          tax_rate_snapshot?: number | null
          total?: number
          total_refunded_amount?: number
          tracking_ref?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_orders_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_cart_id_v2_fkey"
            columns: ["cart_id_v2"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_commission_policy_id_snapshot_fkey"
            columns: ["commission_policy_id_snapshot"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_commission_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_guest_customer_id_fkey"
            columns: ["guest_customer_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_guest_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_outbox: {
        Row: {
          actor_id: string | null
          created_at: string
          error: string | null
          event_type: string
          id: string
          org_id: string | null
          payload: Json
          processed_at: string | null
          retry_count: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          org_id?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          org_id?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_outbox_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_promotions: {
        Row: {
          activa: boolean
          actor_id: string
          comunidad_autonoma: string | null
          config: Json
          created_at: string | null
          cta_label: string | null
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          location_id: string | null
          mostrar_chip_comparador: boolean
          mostrar_en_home: boolean
          mostrar_en_perfil: boolean
          scope: Database["public"]["Enums"]["promo_scope"]
          synthetic: boolean
          synthetic_dataset: string | null
          tipo: Database["public"]["Enums"]["promo_tipo"]
          titulo: string
          updated_at: string | null
        }
        Insert: {
          activa?: boolean
          actor_id: string
          comunidad_autonoma?: string | null
          config?: Json
          created_at?: string | null
          cta_label?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          location_id?: string | null
          mostrar_chip_comparador?: boolean
          mostrar_en_home?: boolean
          mostrar_en_perfil?: boolean
          scope?: Database["public"]["Enums"]["promo_scope"]
          synthetic?: boolean
          synthetic_dataset?: string | null
          tipo: Database["public"]["Enums"]["promo_tipo"]
          titulo: string
          updated_at?: string | null
        }
        Update: {
          activa?: boolean
          actor_id?: string
          comunidad_autonoma?: string | null
          config?: Json
          created_at?: string | null
          cta_label?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          location_id?: string | null
          mostrar_chip_comparador?: boolean
          mostrar_en_home?: boolean
          mostrar_en_perfil?: boolean
          scope?: Database["public"]["Enums"]["promo_scope"]
          synthetic?: boolean
          synthetic_dataset?: string | null
          tipo?: Database["public"]["Enums"]["promo_tipo"]
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_promotions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_promotions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_provider_doc_refs: {
        Row: {
          actor_id: string
          buyer_org_id: string | null
          created_at: string
          doc_amount: number | null
          doc_currency: string
          doc_date_provider: string
          doc_number_provider: string
          doc_type: string
          id: string
          notes: string | null
          registered_at: string
          registered_by: string | null
          supplier_order_id: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          buyer_org_id?: string | null
          created_at?: string
          doc_amount?: number | null
          doc_currency?: string
          doc_date_provider: string
          doc_number_provider: string
          doc_type?: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
          supplier_order_id: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          buyer_org_id?: string | null
          created_at?: string
          doc_amount?: number | null
          doc_currency?: string
          doc_date_provider?: string
          doc_number_provider?: string
          doc_type?: string
          id?: string
          notes?: string | null
          registered_at?: string
          registered_by?: string | null
          supplier_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_provider_doc_refs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_provider_doc_refs_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_provider_doc_refs_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_recoveries: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          deficit_amount: number
          id: string
          idempotency_key: string | null
          initiated_at: string
          metadata: Json | null
          negative_origin_entry_id: string | null
          negative_since: string | null
          notes: string | null
          provider_actor_id: string
          recovered_amount: number
          recovery_number: string
          recovery_type: string
          simulation_only: boolean
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          deficit_amount: number
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          negative_origin_entry_id?: string | null
          negative_since?: string | null
          notes?: string | null
          provider_actor_id: string
          recovered_amount?: number
          recovery_number: string
          recovery_type: string
          simulation_only?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          deficit_amount?: number
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          negative_origin_entry_id?: string | null
          negative_since?: string | null
          notes?: string | null
          provider_actor_id?: string
          recovered_amount?: number
          recovery_number?: string
          recovery_type?: string
          simulation_only?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_recoveries_negative_origin_entry_id_fkey"
            columns: ["negative_origin_entry_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_recoveries_provider_actor_id_fkey"
            columns: ["provider_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_refund_items: {
        Row: {
          created_at: string
          gross_refund: number
          id: string
          is_shipping: boolean
          net_refund: number
          order_item_id: string | null
          quantity_original: number | null
          quantity_refunded: number | null
          reason: string | null
          refund_id: string
          tax_rate_snapshot: number | null
          tax_refund: number
          unit_price_gross_snapshot: number | null
          unit_price_net_snapshot: number | null
        }
        Insert: {
          created_at?: string
          gross_refund?: number
          id?: string
          is_shipping?: boolean
          net_refund?: number
          order_item_id?: string | null
          quantity_original?: number | null
          quantity_refunded?: number | null
          reason?: string | null
          refund_id: string
          tax_rate_snapshot?: number | null
          tax_refund?: number
          unit_price_gross_snapshot?: number | null
          unit_price_net_snapshot?: number | null
        }
        Update: {
          created_at?: string
          gross_refund?: number
          id?: string
          is_shipping?: boolean
          net_refund?: number
          order_item_id?: string | null
          quantity_original?: number | null
          quantity_refunded?: number | null
          reason?: string | null
          refund_id?: string
          tax_rate_snapshot?: number | null
          tax_refund?: number
          unit_price_gross_snapshot?: number | null
          unit_price_net_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ri_order_item"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ri_refund"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_refunds: {
        Row: {
          approved_at: string | null
          buyer_actor_id: string | null
          cancelled_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          external_id: string | null
          external_provider: string
          id: string
          idempotency_key: string | null
          items_gross_amount: number
          items_net_amount: number
          items_tax_amount: number
          master_order_id: string
          metadata: Json | null
          processed_at: string | null
          provider_actor_id: string
          reason: string | null
          refund_number: string
          refund_type: string
          requested_at: string
          shipping_gross_amount: number
          shipping_net_amount: number
          shipping_tax_amount: number
          simulation_only: boolean
          status: string
          supplier_order_id: string
          total_refund_amount: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          buyer_actor_id?: string | null
          cancelled_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          external_provider?: string
          id?: string
          idempotency_key?: string | null
          items_gross_amount?: number
          items_net_amount?: number
          items_tax_amount?: number
          master_order_id: string
          metadata?: Json | null
          processed_at?: string | null
          provider_actor_id: string
          reason?: string | null
          refund_number: string
          refund_type: string
          requested_at?: string
          shipping_gross_amount?: number
          shipping_net_amount?: number
          shipping_tax_amount?: number
          simulation_only?: boolean
          status?: string
          supplier_order_id: string
          total_refund_amount?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          buyer_actor_id?: string | null
          cancelled_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          external_provider?: string
          id?: string
          idempotency_key?: string | null
          items_gross_amount?: number
          items_net_amount?: number
          items_tax_amount?: number
          master_order_id?: string
          metadata?: Json | null
          processed_at?: string | null
          provider_actor_id?: string
          reason?: string | null
          refund_number?: string
          refund_type?: string
          requested_at?: string
          shipping_gross_amount?: number
          shipping_net_amount?: number
          shipping_tax_amount?: number
          simulation_only?: boolean
          status?: string
          supplier_order_id?: string
          total_refund_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_refund_master"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_refund_provider"
            columns: ["provider_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_refund_supplier"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_reserves: {
        Row: {
          cancelled_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          dispute_id: string | null
          expired_at: string | null
          expires_at: string | null
          id: string
          idempotency_key: string | null
          master_order_id: string | null
          metadata: Json | null
          notes: string | null
          provider_actor_id: string
          reason: string
          reason_code: string | null
          release_at: string | null
          release_conditions: string[] | null
          released_amount: number
          released_at: string | null
          remaining_amount: number
          requested_amount: number
          reserve_number: string
          reserve_type: string
          reserved_amount: number
          simulation_only: boolean
          source_bucket: string
          source_event_id: string | null
          starts_at: string
          status: string
          supplier_order_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_id?: string | null
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          master_order_id?: string | null
          metadata?: Json | null
          notes?: string | null
          provider_actor_id: string
          reason: string
          reason_code?: string | null
          release_at?: string | null
          release_conditions?: string[] | null
          released_amount?: number
          released_at?: string | null
          remaining_amount?: number
          requested_amount: number
          reserve_number: string
          reserve_type: string
          reserved_amount?: number
          simulation_only?: boolean
          source_bucket?: string
          source_event_id?: string | null
          starts_at?: string
          status?: string
          supplier_order_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_id?: string | null
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          master_order_id?: string | null
          metadata?: Json | null
          notes?: string | null
          provider_actor_id?: string
          reason?: string
          reason_code?: string | null
          release_at?: string | null
          release_conditions?: string[] | null
          released_amount?: number
          released_at?: string | null
          remaining_amount?: number
          requested_amount?: number
          reserve_number?: string
          reserve_type?: string
          reserved_amount?: number
          simulation_only?: boolean
          source_bucket?: string
          source_event_id?: string | null
          starts_at?: string
          status?: string
          supplier_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_reserves_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_reserves_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_reserves_provider_actor_id_fkey"
            columns: ["provider_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_reserves_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_roles: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          descripcion: string | null
          id: string
          is_system: boolean
          nombre: string
          permissions: Json
          priority: number
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          descripcion?: string | null
          id?: string
          is_system?: boolean
          nombre: string
          permissions?: Json
          priority?: number
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          is_system?: boolean
          nombre?: string
          permissions?: Json
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_roles_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_roles_actor_type_fkey"
            columns: ["actor_type"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actor_types"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_settlement_lines: {
        Row: {
          created_at: string
          currency: string
          entry_type: string
          gross_amount: number
          id: string
          included_amount: number
          ledger_entry_id: string
          line_status: string
          master_order_id: string | null
          metadata: Json | null
          settlement_id: string
          supplier_order_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          entry_type: string
          gross_amount: number
          id?: string
          included_amount: number
          ledger_entry_id: string
          line_status?: string
          master_order_id?: string | null
          metadata?: Json | null
          settlement_id: string
          supplier_order_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          entry_type?: string
          gross_amount?: number
          id?: string
          included_amount?: number
          ledger_entry_id?: string
          line_status?: string
          master_order_id?: string | null
          metadata?: Json | null
          settlement_id?: string
          supplier_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_settlement_lines_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: true
            referencedRelation: "trade_marketplace_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_settlement_lines_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_master_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_settlement_lines_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_settlement_lines_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_settlements: {
        Row: {
          adjustment_amount: number
          approved_at: string | null
          approved_by: string | null
          available_amount_at_calc: number
          calculated_at: string | null
          cancelled_at: string | null
          chargeback_amount: number
          chargeback_reversal_amount: number
          closed_at: string | null
          commission_amount: number
          commission_tax_amount: number
          correlation_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          external_id: string | null
          external_provider: string
          gross_activity: number
          id: string
          idempotency_key: string | null
          max_payable: number
          metadata: Json | null
          negative_amount_at_calc: number
          net_activity: number
          notes: string | null
          opening_available: number
          opening_historical_settled: number
          opening_negative: number
          opening_pending: number
          opening_reserved: number
          payable_at: string | null
          period_end: string
          period_start: string
          provider_actor_id: string
          recovery_amount: number
          refund_amount: number
          reserve_amount: number
          reserve_release_amount: number
          reserved_amount_at_calc: number
          sales_amount: number
          settlement_amount: number
          settlement_ledger_entry_id: string | null
          settlement_number: string
          shipping_amount: number
          simulated_paid_at: string | null
          simulation_only: boolean
          status: string
          updated_at: string
        }
        Insert: {
          adjustment_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          available_amount_at_calc?: number
          calculated_at?: string | null
          cancelled_at?: string | null
          chargeback_amount?: number
          chargeback_reversal_amount?: number
          closed_at?: string | null
          commission_amount?: number
          commission_tax_amount?: number
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          external_provider?: string
          gross_activity?: number
          id?: string
          idempotency_key?: string | null
          max_payable?: number
          metadata?: Json | null
          negative_amount_at_calc?: number
          net_activity?: number
          notes?: string | null
          opening_available?: number
          opening_historical_settled?: number
          opening_negative?: number
          opening_pending?: number
          opening_reserved?: number
          payable_at?: string | null
          period_end: string
          period_start: string
          provider_actor_id: string
          recovery_amount?: number
          refund_amount?: number
          reserve_amount?: number
          reserve_release_amount?: number
          reserved_amount_at_calc?: number
          sales_amount?: number
          settlement_amount?: number
          settlement_ledger_entry_id?: string | null
          settlement_number: string
          shipping_amount?: number
          simulated_paid_at?: string | null
          simulation_only?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          adjustment_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          available_amount_at_calc?: number
          calculated_at?: string | null
          cancelled_at?: string | null
          chargeback_amount?: number
          chargeback_reversal_amount?: number
          closed_at?: string | null
          commission_amount?: number
          commission_tax_amount?: number
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_id?: string | null
          external_provider?: string
          gross_activity?: number
          id?: string
          idempotency_key?: string | null
          max_payable?: number
          metadata?: Json | null
          negative_amount_at_calc?: number
          net_activity?: number
          notes?: string | null
          opening_available?: number
          opening_historical_settled?: number
          opening_negative?: number
          opening_pending?: number
          opening_reserved?: number
          payable_at?: string | null
          period_end?: string
          period_start?: string
          provider_actor_id?: string
          recovery_amount?: number
          refund_amount?: number
          reserve_amount?: number
          reserve_release_amount?: number
          reserved_amount_at_calc?: number
          sales_amount?: number
          settlement_amount?: number
          settlement_ledger_entry_id?: string | null
          settlement_number?: string
          shipping_amount?: number
          simulated_paid_at?: string | null
          simulation_only?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_settlements_provider_actor_id_fkey"
            columns: ["provider_actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_settlements_settlement_ledger_entry_id_fkey"
            columns: ["settlement_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_stock_reservations: {
        Row: {
          cantidad: number
          created_at: string
          estado: string
          id: string
          liberado_at: string | null
          offering_id: string
          order_id: string
          order_item_id: string | null
          reservado_at: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          estado?: string
          id?: string
          liberado_at?: string | null
          offering_id: string
          order_id: string
          order_item_id?: string | null
          reservado_at?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          estado?: string
          id?: string
          liberado_at?: string | null
          offering_id?: string
          order_id?: string
          order_item_id?: string | null
          reservado_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_stock_reservations_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_stock_reservations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_supplier_config: {
        Row: {
          actor_id: string
          coste_portes: number | null
          coste_urgencia: number | null
          created_at: string
          horario_entrega: Json | null
          horario_recogida: Json | null
          id: string
          mensaje_instaladores: string | null
          payment_methods_allowed: string[]
          pedido_minimo: number | null
          permite_coordinar_entrega: boolean
          permite_entrega: boolean
          permite_recogida: boolean
          permite_urgencias: boolean
          plazo_confirmacion_h: number
          plazo_entrega_dias: number
          plazo_preparacion_dias: number
          portes_gratis_desde: number | null
          radio_entrega_km: number | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          coste_portes?: number | null
          coste_urgencia?: number | null
          created_at?: string
          horario_entrega?: Json | null
          horario_recogida?: Json | null
          id?: string
          mensaje_instaladores?: string | null
          payment_methods_allowed?: string[]
          pedido_minimo?: number | null
          permite_coordinar_entrega?: boolean
          permite_entrega?: boolean
          permite_recogida?: boolean
          permite_urgencias?: boolean
          plazo_confirmacion_h?: number
          plazo_entrega_dias?: number
          plazo_preparacion_dias?: number
          portes_gratis_desde?: number | null
          radio_entrega_km?: number | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          coste_portes?: number | null
          coste_urgencia?: number | null
          created_at?: string
          horario_entrega?: Json | null
          horario_recogida?: Json | null
          id?: string
          mensaje_instaladores?: string | null
          payment_methods_allowed?: string[]
          pedido_minimo?: number | null
          permite_coordinar_entrega?: boolean
          permite_entrega?: boolean
          permite_recogida?: boolean
          permite_urgencias?: boolean
          plazo_confirmacion_h?: number
          plazo_entrega_dias?: number
          plazo_preparacion_dias?: number
          portes_gratis_desde?: number | null
          radio_entrega_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_supplier_config_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_supplier_locations: {
        Row: {
          activa: boolean
          actor_id: string
          codigo_interno: string | null
          codigo_postal: string | null
          comunidad_autonoma: string | null
          created_at: string | null
          direccion_linea1: string | null
          email: string | null
          horario: Json | null
          id: string
          latitud: number | null
          localidad: string
          longitud: number | null
          metadata: Json
          nombre: string
          orden: number
          pais: string
          permite_entrega_local: boolean
          permite_recogida: boolean
          provincia: string
          radio_servicio_km: number | null
          synthetic: boolean
          synthetic_dataset: string | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["location_tipo"]
          updated_at: string | null
        }
        Insert: {
          activa?: boolean
          actor_id: string
          codigo_interno?: string | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          created_at?: string | null
          direccion_linea1?: string | null
          email?: string | null
          horario?: Json | null
          id?: string
          latitud?: number | null
          localidad: string
          longitud?: number | null
          metadata?: Json
          nombre: string
          orden?: number
          pais?: string
          permite_entrega_local?: boolean
          permite_recogida?: boolean
          provincia: string
          radio_servicio_km?: number | null
          synthetic?: boolean
          synthetic_dataset?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["location_tipo"]
          updated_at?: string | null
        }
        Update: {
          activa?: boolean
          actor_id?: string
          codigo_interno?: string | null
          codigo_postal?: string | null
          comunidad_autonoma?: string | null
          created_at?: string | null
          direccion_linea1?: string | null
          email?: string | null
          horario?: Json | null
          id?: string
          latitud?: number | null
          localidad?: string
          longitud?: number | null
          metadata?: Json
          nombre?: string
          orden?: number
          pais?: string
          permite_entrega_local?: boolean
          permite_recogida?: boolean
          provincia?: string
          radio_servicio_km?: number | null
          synthetic?: boolean
          synthetic_dataset?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["location_tipo"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_supplier_locations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_supplier_offerings: {
        Row: {
          activa: boolean
          created_at: string
          currency: string
          descripcion_comercial: string
          id: string
          image_url: string | null
          match_confidence: number | null
          match_method: string | null
          match_state: string
          matched_at: string | null
          matched_by: string | null
          metadata: Json
          plazo_entrega_dias: number
          precio_coste: number | null
          precio_profesional_neto: number | null
          precio_profesional_updated_at: string | null
          precio_publico_neto: number | null
          precio_publico_updated_at: string | null
          precio_venta: number | null
          stock_cantidad: number | null
          stock_disponible: boolean
          supplier_catalog_id: string
          supplier_product_id: string | null
          supplier_ref: string | null
          tax_rate: number
          unidad: string
          universal_product_id: string | null
          updated_at: string
          variant_id: string | null
          venta_profesional_habilitada: boolean
          venta_publica_habilitada: boolean
        }
        Insert: {
          activa?: boolean
          created_at?: string
          currency?: string
          descripcion_comercial: string
          id?: string
          image_url?: string | null
          match_confidence?: number | null
          match_method?: string | null
          match_state?: string
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          plazo_entrega_dias?: number
          precio_coste?: number | null
          precio_profesional_neto?: number | null
          precio_profesional_updated_at?: string | null
          precio_publico_neto?: number | null
          precio_publico_updated_at?: string | null
          precio_venta?: number | null
          stock_cantidad?: number | null
          stock_disponible?: boolean
          supplier_catalog_id: string
          supplier_product_id?: string | null
          supplier_ref?: string | null
          tax_rate?: number
          unidad?: string
          universal_product_id?: string | null
          updated_at?: string
          variant_id?: string | null
          venta_profesional_habilitada?: boolean
          venta_publica_habilitada?: boolean
        }
        Update: {
          activa?: boolean
          created_at?: string
          currency?: string
          descripcion_comercial?: string
          id?: string
          image_url?: string | null
          match_confidence?: number | null
          match_method?: string | null
          match_state?: string
          matched_at?: string | null
          matched_by?: string | null
          metadata?: Json
          plazo_entrega_dias?: number
          precio_coste?: number | null
          precio_profesional_neto?: number | null
          precio_profesional_updated_at?: string | null
          precio_publico_neto?: number | null
          precio_publico_updated_at?: string | null
          precio_venta?: number | null
          stock_cantidad?: number | null
          stock_disponible?: boolean
          supplier_catalog_id?: string
          supplier_product_id?: string | null
          supplier_ref?: string | null
          tax_rate?: number
          unidad?: string
          universal_product_id?: string | null
          updated_at?: string
          variant_id?: string | null
          venta_profesional_habilitada?: boolean
          venta_publica_habilitada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_supplier_offerings_supplier_catalog_id_fkey"
            columns: ["supplier_catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_supplier_offerings_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_supplier_offerings_universal_product_id_fkey"
            columns: ["universal_product_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_supplier_offerings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_supplier_pickup_points: {
        Row: {
          activo: boolean
          actor_id: string
          created_at: string
          deprecated_at: string | null
          direccion: Json
          id: string
          nombre: string
          orden: number
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actor_id: string
          created_at?: string
          deprecated_at?: string | null
          direccion?: Json
          id?: string
          nombre: string
          orden?: number
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actor_id?: string
          created_at?: string
          deprecated_at?: string | null
          direccion?: Json
          id?: string
          nombre?: string
          orden?: number
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_supplier_pickup_points_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_universal_product_variants: {
        Row: {
          activa: boolean
          atributos: Json
          created_at: string
          ean: string | null
          global_catalog_id: string | null
          gtin: string | null
          id: string
          manufacturer_ref: string | null
          nombre: string
          universal_product_id: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          atributos?: Json
          created_at?: string
          ean?: string | null
          global_catalog_id?: string | null
          gtin?: string | null
          id?: string
          manufacturer_ref?: string | null
          nombre: string
          universal_product_id: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          atributos?: Json
          created_at?: string
          ean?: string | null
          global_catalog_id?: string | null
          gtin?: string | null
          id?: string
          manufacturer_ref?: string | null
          nombre?: string
          universal_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_universal_product_v_universal_product_id_fkey"
            columns: ["universal_product_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_universal_product_vari_global_catalog_id_fkey"
            columns: ["global_catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_global_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_marketplace_universal_products: {
        Row: {
          category_id: string | null
          created_at: string
          descripcion: string | null
          ean: string | null
          es_generico: boolean
          especificaciones: Json
          familia: string
          global_catalog_id: string | null
          gtin: string | null
          id: string
          image_url: string | null
          manufacturer_id: string | null
          manufacturer_ref: string | null
          marca: string | null
          merged_into_id: string | null
          modelo: string | null
          mpn: string | null
          nombre_canonico: string
          normalization_version: number
          oficio: string
          origen: string
          search_aliases: string[] | null
          search_vector: unknown
          subfamilia: string | null
          unidad: string
          updated_at: string
          validation_state: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          descripcion?: string | null
          ean?: string | null
          es_generico?: boolean
          especificaciones?: Json
          familia: string
          global_catalog_id?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          manufacturer_id?: string | null
          manufacturer_ref?: string | null
          marca?: string | null
          merged_into_id?: string | null
          modelo?: string | null
          mpn?: string | null
          nombre_canonico: string
          normalization_version?: number
          oficio: string
          origen?: string
          search_aliases?: string[] | null
          search_vector?: unknown
          subfamilia?: string | null
          unidad?: string
          updated_at?: string
          validation_state?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          descripcion?: string | null
          ean?: string | null
          es_generico?: boolean
          especificaciones?: Json
          familia?: string
          global_catalog_id?: string | null
          gtin?: string | null
          id?: string
          image_url?: string | null
          manufacturer_id?: string | null
          manufacturer_ref?: string | null
          marca?: string | null
          merged_into_id?: string | null
          modelo?: string | null
          mpn?: string | null
          nombre_canonico?: string
          normalization_version?: number
          oficio?: string
          origen?: string
          search_aliases?: string[] | null
          search_vector?: unknown
          subfamilia?: string | null
          unidad?: string
          updated_at?: string
          validation_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_universal_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_universal_products_global_catalog_id_fkey"
            columns: ["global_catalog_id"]
            isOneToOne: true
            referencedRelation: "trade_global_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_universal_products_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_universal_products_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_products"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_mayoristas: {
        Row: {
          activo: boolean
          ciudad: string | null
          cp: string | null
          created_at: string
          direccion_fiscal: string | null
          email: string | null
          id: string
          nif: string | null
          nombre: string
          notas: string | null
          org_id: string
          persona_contacto: string | null
          provincia: string | null
          razon_social: string | null
          telefono: string | null
          web: string | null
        }
        Insert: {
          activo?: boolean
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion_fiscal?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre: string
          notas?: string | null
          org_id: string
          persona_contacto?: string | null
          provincia?: string | null
          razon_social?: string | null
          telefono?: string | null
          web?: string | null
        }
        Update: {
          activo?: boolean
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion_fiscal?: string | null
          email?: string | null
          id?: string
          nif?: string | null
          nombre?: string
          notas?: string | null
          org_id?: string
          persona_contacto?: string | null
          provincia?: string | null
          razon_social?: string | null
          telefono?: string | null
          web?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_mayoristas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_norm_chunks: {
        Row: {
          activo: boolean
          article_id: string | null
          article_title: string | null
          category: string
          chunk_id: string
          chunk_index: number
          chunk_text: string
          comunidad_autonoma: string | null
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          keywords: string[] | null
          naturaleza: string
          oficio: string | null
          page_range: string | null
          section: string | null
          section_title: string | null
          token_count: number | null
        }
        Insert: {
          activo?: boolean
          article_id?: string | null
          article_title?: string | null
          category: string
          chunk_id: string
          chunk_index: number
          chunk_text: string
          comunidad_autonoma?: string | null
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          keywords?: string[] | null
          naturaleza?: string
          oficio?: string | null
          page_range?: string | null
          section?: string | null
          section_title?: string | null
          token_count?: number | null
        }
        Update: {
          activo?: boolean
          article_id?: string | null
          article_title?: string | null
          category?: string
          chunk_id?: string
          chunk_index?: number
          chunk_text?: string
          comunidad_autonoma?: string | null
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          keywords?: string[] | null
          naturaleza?: string
          oficio?: string | null
          page_range?: string | null
          section?: string | null
          section_title?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_norm_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trade_norm_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_norm_conflicts: {
        Row: {
          chunk_id_a: string
          chunk_id_b: string
          created_at: string
          descripcion: string
          detectado_por: string
          id: string
          resolucion: string | null
        }
        Insert: {
          chunk_id_a: string
          chunk_id_b: string
          created_at?: string
          descripcion: string
          detectado_por?: string
          id?: string
          resolucion?: string | null
        }
        Update: {
          chunk_id_a?: string
          chunk_id_b?: string
          created_at?: string
          descripcion?: string
          detectado_por?: string
          id?: string
          resolucion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_norm_conflicts_chunk_id_a_fkey"
            columns: ["chunk_id_a"]
            isOneToOne: false
            referencedRelation: "trade_norm_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_norm_conflicts_chunk_id_b_fkey"
            columns: ["chunk_id_b"]
            isOneToOne: false
            referencedRelation: "trade_norm_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_norm_documents: {
        Row: {
          ambito_territorial: string
          boe_ref: string | null
          category: string
          chunk_count: number
          created_at: string
          fecha_derogacion: string | null
          fecha_publicacion: string | null
          id: string
          last_verified_at: string | null
          numero_consulta: string | null
          oficio_tags: string[] | null
          organismo_emisor: string
          plan_required: string
          source_url: string | null
          status: string
          subcategoria: string | null
          subtitle: string | null
          territorio: string | null
          tipo_documento: string
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          version: string | null
        }
        Insert: {
          ambito_territorial?: string
          boe_ref?: string | null
          category: string
          chunk_count?: number
          created_at?: string
          fecha_derogacion?: string | null
          fecha_publicacion?: string | null
          id?: string
          last_verified_at?: string | null
          numero_consulta?: string | null
          oficio_tags?: string[] | null
          organismo_emisor?: string
          plan_required?: string
          source_url?: string | null
          status?: string
          subcategoria?: string | null
          subtitle?: string | null
          territorio?: string | null
          tipo_documento?: string
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: string | null
        }
        Update: {
          ambito_territorial?: string
          boe_ref?: string | null
          category?: string
          chunk_count?: number
          created_at?: string
          fecha_derogacion?: string | null
          fecha_publicacion?: string | null
          id?: string
          last_verified_at?: string | null
          numero_consulta?: string | null
          oficio_tags?: string[] | null
          organismo_emisor?: string
          plan_required?: string
          source_url?: string | null
          status?: string
          subcategoria?: string | null
          subtitle?: string | null
          territorio?: string | null
          tipo_documento?: string
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          version?: string | null
        }
        Relationships: []
      }
      trade_offering_events: {
        Row: {
          actor_id: string
          created_at: string
          datos_antes: Json | null
          datos_despues: Json | null
          id: string
          offering_id: string
          tipo: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          datos_antes?: Json | null
          datos_despues?: Json | null
          id?: string
          offering_id: string
          tipo: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          datos_antes?: Json | null
          datos_despues?: Json | null
          id?: string
          offering_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_offering_events_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_supplier_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_org_members: {
        Row: {
          activo: boolean | null
          created_at: string | null
          email: string | null
          id: string
          invited_at: string | null
          org_id: string
          rol: string
          user_id: string
          worker_profile_id: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          org_id: string
          rol?: string
          user_id: string
          worker_profile_id?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          org_id?: string
          rol?: string
          user_id?: string
          worker_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_org_members_worker_profile_id_fkey"
            columns: ["worker_profile_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_org_permissions: {
        Row: {
          granted: boolean | null
          id: string
          member_id: string
          permiso: string
        }
        Insert: {
          granted?: boolean | null
          id?: string
          member_id: string
          permiso: string
        }
        Update: {
          granted?: boolean | null
          id?: string
          member_id?: string
          permiso?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_org_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trade_org_members"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_org_suppliers: {
        Row: {
          catalog_id: string
          display_name: string | null
          enabled: boolean
          id: string
          margen_override: number | null
          org_id: string
          preferido_categorias: string[] | null
          prioridad: number
          tienda_contacto: string | null
          tienda_direccion: string | null
          tienda_nombre: string | null
          tienda_telefono: string | null
          tienda_web: string | null
        }
        Insert: {
          catalog_id: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          margen_override?: number | null
          org_id: string
          preferido_categorias?: string[] | null
          prioridad?: number
          tienda_contacto?: string | null
          tienda_direccion?: string | null
          tienda_nombre?: string | null
          tienda_telefono?: string | null
          tienda_web?: string | null
        }
        Update: {
          catalog_id?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          margen_override?: number | null
          org_id?: string
          preferido_categorias?: string[] | null
          prioridad?: number
          tienda_contacto?: string | null
          tienda_direccion?: string | null
          tienda_nombre?: string | null
          tienda_telefono?: string | null
          tienda_web?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_org_suppliers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_org_suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_org_templates: {
        Row: {
          contenido: string
          id: string
          nombre: string
          org_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          contenido?: string
          id?: string
          nombre?: string
          org_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          contenido?: string
          id?: string
          nombre?: string
          org_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_org_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_org_verifactu_config: {
        Row: {
          activated_at: string | null
          collaboration_agreement_date: string | null
          collaboration_agreement_signed: boolean
          created_at: string
          deactivated_at: string | null
          id: string
          notes: string | null
          org_id: string
          updated_at: string
          verifactu_mode: string
        }
        Insert: {
          activated_at?: string | null
          collaboration_agreement_date?: string | null
          collaboration_agreement_signed?: boolean
          created_at?: string
          deactivated_at?: string | null
          id?: string
          notes?: string | null
          org_id: string
          updated_at?: string
          verifactu_mode?: string
        }
        Update: {
          activated_at?: string | null
          collaboration_agreement_date?: string | null
          collaboration_agreement_signed?: boolean
          created_at?: string
          deactivated_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
          verifactu_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_org_verifactu_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_organizations: {
        Row: {
          banco: string | null
          base_latitud: number | null
          base_longitud: number | null
          churn_risk: boolean
          ciudad: string | null
          cp: string | null
          created_at: string
          direccion: string | null
          email: string | null
          force_password_change: boolean
          founding_installer: boolean
          founding_installer_number: number | null
          geo_confirmed_at: string | null
          geo_source: string | null
          iban: string | null
          id: string
          internal_notes: string | null
          is_onboarded: boolean
          iva_default: number
          lead_id: string | null
          localidad: string | null
          logo_url: string | null
          nif: string | null
          nombre: string
          oficio: string
          owner_id: string
          pais: string | null
          phase: string | null
          pilot: boolean
          plan: string
          provincia: string | null
          referral_code: string | null
          referred_by_code: string | null
          tags: string[]
          telefono: string | null
          telefono_fijo: string | null
          telefono_movil: string | null
          timezone: string
          titular_cuenta: string | null
          transport_enabled: boolean
          transport_license: string | null
          transport_modalidad: string | null
          transport_rates: Json | null
          transport_service_types: string[] | null
          updated_at: string
          vip: boolean
        }
        Insert: {
          banco?: string | null
          base_latitud?: number | null
          base_longitud?: number | null
          churn_risk?: boolean
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          force_password_change?: boolean
          founding_installer?: boolean
          founding_installer_number?: number | null
          geo_confirmed_at?: string | null
          geo_source?: string | null
          iban?: string | null
          id?: string
          internal_notes?: string | null
          is_onboarded?: boolean
          iva_default?: number
          lead_id?: string | null
          localidad?: string | null
          logo_url?: string | null
          nif?: string | null
          nombre: string
          oficio?: string
          owner_id: string
          pais?: string | null
          phase?: string | null
          pilot?: boolean
          plan?: string
          provincia?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          tags?: string[]
          telefono?: string | null
          telefono_fijo?: string | null
          telefono_movil?: string | null
          timezone?: string
          titular_cuenta?: string | null
          transport_enabled?: boolean
          transport_license?: string | null
          transport_modalidad?: string | null
          transport_rates?: Json | null
          transport_service_types?: string[] | null
          updated_at?: string
          vip?: boolean
        }
        Update: {
          banco?: string | null
          base_latitud?: number | null
          base_longitud?: number | null
          churn_risk?: boolean
          ciudad?: string | null
          cp?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          force_password_change?: boolean
          founding_installer?: boolean
          founding_installer_number?: number | null
          geo_confirmed_at?: string | null
          geo_source?: string | null
          iban?: string | null
          id?: string
          internal_notes?: string | null
          is_onboarded?: boolean
          iva_default?: number
          lead_id?: string | null
          localidad?: string | null
          logo_url?: string | null
          nif?: string | null
          nombre?: string
          oficio?: string
          owner_id?: string
          pais?: string | null
          phase?: string | null
          pilot?: boolean
          plan?: string
          provincia?: string | null
          referral_code?: string | null
          referred_by_code?: string | null
          tags?: string[]
          telefono?: string | null
          telefono_fijo?: string | null
          telefono_movil?: string | null
          timezone?: string
          titular_cuenta?: string | null
          transport_enabled?: boolean
          transport_license?: string | null
          transport_modalidad?: string | null
          transport_rates?: Json | null
          transport_service_types?: string[] | null
          updated_at?: string
          vip?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trade_organizations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "trade_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_partidas_aprendidas: {
        Row: {
          created_at: string
          descripcion: string
          id: string
          oficio: string | null
          org_id: string
          origen: string
          precio_promedio: number | null
          precio_unitario: number
          tipo: string
          updated_at: string
          veces_usado: number
        }
        Insert: {
          created_at?: string
          descripcion: string
          id?: string
          oficio?: string | null
          org_id: string
          origen?: string
          precio_promedio?: number | null
          precio_unitario: number
          tipo: string
          updated_at?: string
          veces_usado?: number
        }
        Update: {
          created_at?: string
          descripcion?: string
          id?: string
          oficio?: string | null
          org_id?: string
          origen?: string
          precio_promedio?: number | null
          precio_unitario?: number
          tipo?: string
          updated_at?: string
          veces_usado?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_partidas_aprendidas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_photo_scans: {
        Row: {
          created_at: string
          detections: Json | null
          id: string
          modelo_ia: string | null
          org_id: string
          processed_at: string | null
          quote_id: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          detections?: Json | null
          id?: string
          modelo_ia?: string | null
          org_id: string
          processed_at?: string | null
          quote_id?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          detections?: Json | null
          id?: string
          modelo_ia?: string | null
          org_id?: string
          processed_at?: string | null
          quote_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_photo_scans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_photo_scans_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_platform_invoices: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_pdf_url: string | null
          invoice_url: string | null
          notes: string | null
          org_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          plan: string | null
          status: string
          stripe_invoice_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          notes?: string | null
          org_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          plan?: string | null
          status?: string
          stripe_invoice_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          plan?: string | null
          status?: string
          stripe_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_platform_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          org_id: string
          subscription: Json
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          org_id: string
          subscription: Json
          worker_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          org_id?: string
          subscription?: Json
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_push_subscriptions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_quote_items: {
        Row: {
          cantidad: number
          catalog_product_id: string | null
          catalog_variant_id: string | null
          confidence_score: number | null
          created_at: string
          descripcion: string
          editable: boolean
          familia: string | null
          global_catalog_id: string | null
          id: string
          marca: string | null
          material_order_placed: boolean | null
          medidas: string | null
          modelo: string | null
          posicion: number
          precio_mano_obra: number | null
          precio_material: number | null
          precio_unitario: number
          quote_id: string
          requiere_revision: boolean
          requires_review: boolean | null
          source_type: string | null
          supplier_key: string | null
          supplier_name: string | null
          supplier_ref: string | null
          tipo: string
          total: number | null
          unidad: string | null
          universal_product_id: string | null
          universal_variant_id: string | null
        }
        Insert: {
          cantidad?: number
          catalog_product_id?: string | null
          catalog_variant_id?: string | null
          confidence_score?: number | null
          created_at?: string
          descripcion: string
          editable?: boolean
          familia?: string | null
          global_catalog_id?: string | null
          id?: string
          marca?: string | null
          material_order_placed?: boolean | null
          medidas?: string | null
          modelo?: string | null
          posicion?: number
          precio_mano_obra?: number | null
          precio_material?: number | null
          precio_unitario?: number
          quote_id: string
          requiere_revision?: boolean
          requires_review?: boolean | null
          source_type?: string | null
          supplier_key?: string | null
          supplier_name?: string | null
          supplier_ref?: string | null
          tipo?: string
          total?: number | null
          unidad?: string | null
          universal_product_id?: string | null
          universal_variant_id?: string | null
        }
        Update: {
          cantidad?: number
          catalog_product_id?: string | null
          catalog_variant_id?: string | null
          confidence_score?: number | null
          created_at?: string
          descripcion?: string
          editable?: boolean
          familia?: string | null
          global_catalog_id?: string | null
          id?: string
          marca?: string | null
          material_order_placed?: boolean | null
          medidas?: string | null
          modelo?: string | null
          posicion?: number
          precio_mano_obra?: number | null
          precio_material?: number | null
          precio_unitario?: number
          quote_id?: string
          requiere_revision?: boolean
          requires_review?: boolean | null
          source_type?: string | null
          supplier_key?: string | null
          supplier_name?: string | null
          supplier_ref?: string | null
          tipo?: string
          total?: number | null
          unidad?: string | null
          universal_product_id?: string | null
          universal_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_quote_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "trade_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_items_catalog_variant_id_fkey"
            columns: ["catalog_variant_id"]
            isOneToOne: false
            referencedRelation: "trade_catalog_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_items_global_catalog_id_fkey"
            columns: ["global_catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_global_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_items_universal_product_id_fkey"
            columns: ["universal_product_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_items_universal_variant_id_fkey"
            columns: ["universal_variant_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_universal_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_quote_photos: {
        Row: {
          area_label: string | null
          caption: string | null
          created_at: string
          created_by: string
          display_order: number
          id: string
          include_in_document: boolean
          org_id: string
          quote_id: string
          storage_path: string
        }
        Insert: {
          area_label?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          include_in_document?: boolean
          org_id: string
          quote_id: string
          storage_path: string
        }
        Update: {
          area_label?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          include_in_document?: boolean
          org_id?: string
          quote_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_quote_photos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_photos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_quote_tokens: {
        Row: {
          accepted_at: string | null
          client_name: string | null
          created_at: string
          id: string
          org_id: string
          quote_data: Json
          quote_numero: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          org_id: string
          quote_data: Json
          quote_numero: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          org_id?: string
          quote_data?: Json
          quote_numero?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_quote_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_quotes: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          estado: string
          fecha: string
          id: string
          iva_pct: number
          kb_actuaciones: string[] | null
          metadata: Json | null
          numero: string
          org_id: string
          total_con_iva: number | null
          total_neto: number
          updated_at: string
          voice_note_url: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: string
          fecha?: string
          id?: string
          iva_pct?: number
          kb_actuaciones?: string[] | null
          metadata?: Json | null
          numero: string
          org_id: string
          total_con_iva?: number | null
          total_neto?: number
          updated_at?: string
          voice_note_url?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          estado?: string
          fecha?: string
          id?: string
          iva_pct?: number
          kb_actuaciones?: string[] | null
          metadata?: Json | null
          numero?: string
          org_id?: string
          total_con_iva?: number | null
          total_neto?: number
          updated_at?: string
          voice_note_url?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_rag_logs: {
        Row: {
          answer_text: string | null
          chunks_retrieved: string[] | null
          confidence: string | null
          created_at: string
          id: string
          latency_ms: number | null
          model_used: string | null
          org_id: string | null
          query_text: string
          sources_json: Json | null
          tokens_input: number | null
          tokens_output: number | null
          user_feedback: string | null
          user_id: string | null
          user_rating: number | null
        }
        Insert: {
          answer_text?: string | null
          chunks_retrieved?: string[] | null
          confidence?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          org_id?: string | null
          query_text: string
          sources_json?: Json | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_feedback?: string | null
          user_id?: string | null
          user_rating?: number | null
        }
        Update: {
          answer_text?: string | null
          chunks_retrieved?: string[] | null
          confidence?: string | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          org_id?: string | null
          query_text?: string
          sources_json?: Json | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_feedback?: string | null
          user_id?: string | null
          user_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_rag_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_rag_rate_limits: {
        Row: {
          date: string
          id: string
          org_id: string
          query_count: number
          updated_at: string
        }
        Insert: {
          date?: string
          id?: string
          org_id: string
          query_count?: number
          updated_at?: string
        }
        Update: {
          date?: string
          id?: string
          org_id?: string
          query_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_rag_rate_limits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code: string
          referred_org_id: string
          referrer_org_id: string
          reward_applied_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code: string
          referred_org_id: string
          referrer_org_id: string
          reward_applied_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code?: string
          referred_org_id?: string
          referrer_org_id?: string
          reward_applied_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_referrals_referred_org_id_fkey"
            columns: ["referred_org_id"]
            isOneToOne: true
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_referrals_referrer_org_id_fkey"
            columns: ["referrer_org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_route_cache: {
        Row: {
          cached_at: string
          distance_m: number | null
          duration_s: number | null
          geometry: Json | null
          pending_at: string | null
          provider: string | null
          waypoint_hash: string
        }
        Insert: {
          cached_at?: string
          distance_m?: number | null
          duration_s?: number | null
          geometry?: Json | null
          pending_at?: string | null
          provider?: string | null
          waypoint_hash: string
        }
        Update: {
          cached_at?: string
          distance_m?: number | null
          duration_s?: number | null
          geometry?: Json | null
          pending_at?: string | null
          provider?: string | null
          waypoint_hash?: string
        }
        Relationships: []
      }
      trade_route_stops: {
        Row: {
          created_at: string | null
          distancia_siguiente_km: number | null
          estado: string | null
          hora_llegada_estimada: string | null
          hora_llegada_real: string | null
          hora_salida_estimada: string | null
          hora_salida_real: string | null
          id: string
          job_id: string
          orden: number
          route_id: string
          tiempo_viaje_siguiente_min: number | null
        }
        Insert: {
          created_at?: string | null
          distancia_siguiente_km?: number | null
          estado?: string | null
          hora_llegada_estimada?: string | null
          hora_llegada_real?: string | null
          hora_salida_estimada?: string | null
          hora_salida_real?: string | null
          id?: string
          job_id: string
          orden?: number
          route_id: string
          tiempo_viaje_siguiente_min?: number | null
        }
        Update: {
          created_at?: string | null
          distancia_siguiente_km?: number | null
          estado?: string | null
          hora_llegada_estimada?: string | null
          hora_llegada_real?: string | null
          hora_salida_estimada?: string | null
          hora_salida_real?: string | null
          id?: string
          job_id?: string
          orden?: number
          route_id?: string
          tiempo_viaje_siguiente_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_route_stops_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "trade_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_routes: {
        Row: {
          created_at: string | null
          created_by: string | null
          distancia_total_km: number | null
          duracion_total_min: number | null
          estado: string | null
          fecha: string
          hora_fin_estimada: string | null
          hora_inicio_estimada: string | null
          id: string
          notas: string | null
          optimization_score: number | null
          org_id: string
          punto_inicio_lat: number | null
          punto_inicio_lng: number | null
          updated_at: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          distancia_total_km?: number | null
          duracion_total_min?: number | null
          estado?: string | null
          fecha: string
          hora_fin_estimada?: string | null
          hora_inicio_estimada?: string | null
          id?: string
          notas?: string | null
          optimization_score?: number | null
          org_id: string
          punto_inicio_lat?: number | null
          punto_inicio_lng?: number | null
          updated_at?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          distancia_total_km?: number | null
          duracion_total_min?: number | null
          estado?: string | null
          fecha?: string
          hora_fin_estimada?: string | null
          hora_inicio_estimada?: string | null
          id?: string
          notas?: string | null
          optimization_score?: number | null
          org_id?: string
          punto_inicio_lat?: number | null
          punto_inicio_lng?: number | null
          updated_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_routes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_routes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_run_logs: {
        Row: {
          created_at: string
          id: string
          mensaje: string
          metadata: Json | null
          nivel: string
          query_id: string | null
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensaje: string
          metadata?: Json | null
          nivel?: string
          query_id?: string | null
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mensaje?: string
          metadata?: Json | null
          nivel?: string
          query_id?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_run_logs_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmark_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_run_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "trade_benchmark_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_stripe_prices: {
        Row: {
          active: boolean
          billing_cycle: string
          created_at: string
          id: string
          plan: string
          stripe_price_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_cycle: string
          created_at?: string
          id?: string
          plan: string
          stripe_price_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          id?: string
          plan?: string
          stripe_price_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_subcontractors: {
        Row: {
          activo: boolean
          cobertura: string | null
          created_at: string
          direccion_fiscal: string | null
          direccion_trabajo: string | null
          email: string | null
          especialidad: string | null
          estado_proveedor: string | null
          horarios: string | null
          id: string
          nif: string | null
          nombre: string
          notas: string | null
          org_id: string
          persona_contacto: string | null
          telefono: string | null
          valoracion: number | null
        }
        Insert: {
          activo?: boolean
          cobertura?: string | null
          created_at?: string
          direccion_fiscal?: string | null
          direccion_trabajo?: string | null
          email?: string | null
          especialidad?: string | null
          estado_proveedor?: string | null
          horarios?: string | null
          id?: string
          nif?: string | null
          nombre: string
          notas?: string | null
          org_id: string
          persona_contacto?: string | null
          telefono?: string | null
          valoracion?: number | null
        }
        Update: {
          activo?: boolean
          cobertura?: string | null
          created_at?: string
          direccion_fiscal?: string | null
          direccion_trabajo?: string | null
          email?: string | null
          especialidad?: string | null
          estado_proveedor?: string | null
          horarios?: string | null
          id?: string
          nif?: string | null
          nombre?: string
          notas?: string | null
          org_id?: string
          persona_contacto?: string | null
          telefono?: string | null
          valoracion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_subcontractors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_subcontrata_notas: {
        Row: {
          created_at: string
          id: string
          org_id: string
          subcontrata_id: string
          texto: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          subcontrata_id: string
          texto: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          subcontrata_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_subcontrata_notas_subcontrata_id_fkey"
            columns: ["subcontrata_id"]
            isOneToOne: false
            referencedRelation: "trade_subcontratas"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_subcontratas: {
        Row: {
          contract_id: string | null
          coste: number
          created_at: string
          descripcion: string
          estado: string
          fecha_factura_recibida: string | null
          fecha_fin_prevista: string | null
          fecha_inicio: string | null
          id: string
          importe_factura_recibida: number | null
          job_id: string | null
          numero: string | null
          org_id: string
          pagado: boolean
          pagado_at: string | null
          precio_cliente: number
          quote_id: string | null
          referencia_factura_subcontrata: string | null
          subcontractor_id: string
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          coste?: number
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_factura_recibida?: string | null
          fecha_fin_prevista?: string | null
          fecha_inicio?: string | null
          id?: string
          importe_factura_recibida?: number | null
          job_id?: string | null
          numero?: string | null
          org_id: string
          pagado?: boolean
          pagado_at?: string | null
          precio_cliente?: number
          quote_id?: string | null
          referencia_factura_subcontrata?: string | null
          subcontractor_id: string
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          coste?: number
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_factura_recibida?: string | null
          fecha_fin_prevista?: string | null
          fecha_inicio?: string | null
          id?: string
          importe_factura_recibida?: number | null
          job_id?: string | null
          numero?: string | null
          org_id?: string
          pagado?: boolean
          pagado_at?: string | null
          precio_cliente?: number
          quote_id?: string | null
          referencia_factura_subcontrata?: string | null
          subcontractor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_subcontratas_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "trade_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_subcontratas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_subcontratas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_subcontratas_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_subcontratas_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "trade_subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          plan: string
          scheduled_at: string | null
          scheduled_plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string
          trial_start: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          plan?: string
          scheduled_at?: string | null
          scheduled_plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          plan?: string
          scheduled_at?: string | null
          scheduled_plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_api_credentials: {
        Row: {
          activa: boolean
          actor_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          grace_until: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_ip: string | null
          last_used_at: string | null
          last_user_agent: string | null
          nombre: string
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
        }
        Insert: {
          activa?: boolean
          actor_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          grace_until?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_ip?: string | null
          last_used_at?: string | null
          last_user_agent?: string | null
          nombre: string
          revoked_at?: string | null
          revoked_by?: string | null
          scopes: string[]
        }
        Update: {
          activa?: boolean
          actor_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          grace_until?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_ip?: string | null
          last_used_at?: string | null
          last_user_agent?: string | null
          nombre?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_api_credentials_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_api_idempotency: {
        Row: {
          actor_id: string
          created_at: string
          endpoint: string
          expires_at: string
          idempotency_key: string
          request_hash: string
          response_body: Json
          response_status: number
        }
        Insert: {
          actor_id: string
          created_at?: string
          endpoint: string
          expires_at?: string
          idempotency_key: string
          request_hash: string
          response_body: Json
          response_status: number
        }
        Update: {
          actor_id?: string
          created_at?: string
          endpoint?: string
          expires_at?: string
          idempotency_key?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_api_idempotency_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_api_rate_limits: {
        Row: {
          actor_id: string
          endpoint: string
          request_count: number
          window_start: string
        }
        Insert: {
          actor_id: string
          endpoint: string
          request_count?: number
          window_start: string
        }
        Update: {
          actor_id?: string
          endpoint?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_api_rate_limits_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_api_sync_log: {
        Row: {
          actor_id: string
          credential_id: string
          endpoint: string
          error_detail: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          ip: string | null
          rows_inserted: number | null
          rows_received: number | null
          rows_rejected: number | null
          rows_updated: number | null
          source_system: string | null
          started_at: string
          status: string
          user_agent: string | null
        }
        Insert: {
          actor_id: string
          credential_id: string
          endpoint: string
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          rows_inserted?: number | null
          rows_received?: number | null
          rows_rejected?: number | null
          rows_updated?: number | null
          source_system?: string | null
          started_at?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string
          credential_id?: string
          endpoint?: string
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          rows_inserted?: number | null
          rows_received?: number | null
          rows_rejected?: number | null
          rows_updated?: number | null
          source_system?: string | null
          started_at?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_api_sync_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_supplier_api_sync_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_api_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_catalogs: {
        Row: {
          acuerdo_estado: string | null
          address: string | null
          admin_notes: string | null
          categoria: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          is_active: boolean
          is_custom: boolean
          logo_url: string | null
          margen_pct_default: number
          org_id: string | null
          phone: string | null
          prioridad: number
          supplier_key: string
          supplier_name: string
          tax_id: string | null
          website: string | null
        }
        Insert: {
          acuerdo_estado?: string | null
          address?: string | null
          admin_notes?: string | null
          categoria?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_custom?: boolean
          logo_url?: string | null
          margen_pct_default?: number
          org_id?: string | null
          phone?: string | null
          prioridad?: number
          supplier_key: string
          supplier_name: string
          tax_id?: string | null
          website?: string | null
        }
        Update: {
          acuerdo_estado?: string | null
          address?: string | null
          admin_notes?: string | null
          categoria?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_custom?: boolean
          logo_url?: string | null
          margen_pct_default?: number
          org_id?: string | null
          phone?: string | null
          prioridad?: number
          supplier_key?: string
          supplier_name?: string
          tax_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_catalogs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_choices: {
        Row: {
          catalog_id: string
          created_at: string | null
          familia: string | null
          id: string
          org_id: string
        }
        Insert: {
          catalog_id: string
          created_at?: string | null
          familia?: string | null
          id?: string
          org_id: string
        }
        Update: {
          catalog_id?: string
          created_at?: string | null
          familia?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_choices_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_order_lines: {
        Row: {
          cantidad: number
          created_at: string | null
          descripcion: string
          id: string
          order_id: string
          precio_unitario: number | null
          referencia: string | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number
          created_at?: string | null
          descripcion: string
          id?: string
          order_id: string
          precio_unitario?: number | null
          referencia?: string | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          descripcion?: string
          id?: string
          order_id?: string
          precio_unitario?: number | null
          referencia?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_orders: {
        Row: {
          catalog_id: string
          created_at: string | null
          estado: string
          id: string
          job_id: string | null
          notas: string | null
          org_id: string
          quote_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          catalog_id: string
          created_at?: string | null
          estado?: string
          id?: string
          job_id?: string | null
          notas?: string | null
          org_id: string
          quote_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          catalog_id?: string
          created_at?: string | null
          estado?: string
          id?: string
          job_id?: string | null
          notas?: string | null
          org_id?: string
          quote_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_orders_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_supplier_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trade_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_supplier_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_supplier_products: {
        Row: {
          activo: boolean
          catalog_id: string
          descripcion: string
          familia: string | null
          id: string
          marca: string | null
          precio_coste: number
          ref_proveedor: string | null
          search_vector: unknown
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          catalog_id: string
          descripcion: string
          familia?: string | null
          id?: string
          marca?: string | null
          precio_coste?: number
          ref_proveedor?: string | null
          search_vector?: unknown
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          catalog_id?: string
          descripcion?: string
          familia?: string | null
          id?: string
          marca?: string | null
          precio_coste?: number
          ref_proveedor?: string | null
          search_vector?: unknown
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_supplier_products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_supplier_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_tarifas: {
        Row: {
          activo: boolean
          codigo: string | null
          created_at: string
          descripcion: string
          familia: string
          global_catalog_id: string | null
          id: string
          org_id: string
          posicion: number
          precio_base: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo?: string | null
          created_at?: string
          descripcion: string
          familia?: string
          global_catalog_id?: string | null
          id?: string
          org_id: string
          posicion?: number
          precio_base?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string | null
          created_at?: string
          descripcion?: string
          familia?: string
          global_catalog_id?: string | null
          id?: string
          org_id?: string
          posicion?: number
          precio_base?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_tarifas_global_catalog_id_fkey"
            columns: ["global_catalog_id"]
            isOneToOne: false
            referencedRelation: "trade_global_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_tarifas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_transport_occurrence_links: {
        Row: {
          created_at: string
          fecha: string
          id: string
          org_id: string
          schedule_id: string
          sentido: string
          service_id: string
        }
        Insert: {
          created_at?: string
          fecha: string
          id?: string
          org_id: string
          schedule_id: string
          sentido: string
          service_id: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          org_id?: string
          schedule_id?: string
          sentido?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_transport_occurrence_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "trade_transport_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttol_schedule_org_fk"
            columns: ["org_id", "schedule_id"]
            isOneToOne: false
            referencedRelation: "trade_transport_schedules"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_transport_quotes: {
        Row: {
          client_id: string | null
          coste_estimado: number | null
          created_at: string
          estado: string
          fecha_expiracion: string | null
          fecha_fin_servicio: string | null
          fecha_servicio: string | null
          id: string
          itinerario: Json
          margen_pct: number | null
          notas: string | null
          notas_internas: string | null
          num_viajeros: number | null
          numero_presupuesto: string
          org_id: string
          precio_final: number | null
          precio_sugerido: number | null
          servicio_id: string | null
          tipo_servicio: string
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          coste_estimado?: number | null
          created_at?: string
          estado?: string
          fecha_expiracion?: string | null
          fecha_fin_servicio?: string | null
          fecha_servicio?: string | null
          id?: string
          itinerario?: Json
          margen_pct?: number | null
          notas?: string | null
          notas_internas?: string | null
          num_viajeros?: number | null
          numero_presupuesto: string
          org_id: string
          precio_final?: number | null
          precio_sugerido?: number | null
          servicio_id?: string | null
          tipo_servicio: string
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          coste_estimado?: number | null
          created_at?: string
          estado?: string
          fecha_expiracion?: string | null
          fecha_fin_servicio?: string | null
          fecha_servicio?: string | null
          id?: string
          itinerario?: Json
          margen_pct?: number | null
          notas?: string | null
          notas_internas?: string | null
          num_viajeros?: number | null
          numero_presupuesto?: string
          org_id?: string
          precio_final?: number | null
          precio_sugerido?: number | null
          servicio_id?: string | null
          tipo_servicio?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_transport_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_transport_quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_transport_quotes_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: true
            referencedRelation: "trade_transport_services"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_transport_schedule_exceptions: {
        Row: {
          created_at: string
          fecha: string
          id: string
          motivo: string | null
          org_id: string
          overrides: Json
          schedule_id: string
          sentido: string
          tipo: string
        }
        Insert: {
          created_at?: string
          fecha: string
          id?: string
          motivo?: string | null
          org_id: string
          overrides?: Json
          schedule_id: string
          sentido?: string
          tipo: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          motivo?: string | null
          org_id?: string
          overrides?: Json
          schedule_id?: string
          sentido?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ttse_schedule_org_fk"
            columns: ["org_id", "schedule_id"]
            isOneToOne: false
            referencedRelation: "trade_transport_schedules"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_transport_schedules: {
        Row: {
          client_id: string | null
          conductor_id: string | null
          created_at: string
          destino_ida: Json
          dias_semana: number[]
          estado: string
          hora_llegada_ida: string | null
          hora_llegada_vuelta: string | null
          hora_salida_ida: string
          hora_salida_vuelta: string | null
          id: string
          nombre: string
          num_viajeros: number | null
          observaciones: string | null
          org_id: string
          origen_ida: Json
          paradas_ida: Json
          paradas_vuelta: Json
          periodo_fin: string | null
          periodo_inicio: string
          precio_referencia: number | null
          timezone: string
          tipo_servicio: string
          updated_at: string
          vehicle_id: string | null
          vuelta_habilitada: boolean
        }
        Insert: {
          client_id?: string | null
          conductor_id?: string | null
          created_at?: string
          destino_ida?: Json
          dias_semana: number[]
          estado?: string
          hora_llegada_ida?: string | null
          hora_llegada_vuelta?: string | null
          hora_salida_ida: string
          hora_salida_vuelta?: string | null
          id?: string
          nombre: string
          num_viajeros?: number | null
          observaciones?: string | null
          org_id: string
          origen_ida?: Json
          paradas_ida?: Json
          paradas_vuelta?: Json
          periodo_fin?: string | null
          periodo_inicio: string
          precio_referencia?: number | null
          timezone?: string
          tipo_servicio?: string
          updated_at?: string
          vehicle_id?: string | null
          vuelta_habilitada?: boolean
        }
        Update: {
          client_id?: string | null
          conductor_id?: string | null
          created_at?: string
          destino_ida?: Json
          dias_semana?: number[]
          estado?: string
          hora_llegada_ida?: string | null
          hora_llegada_vuelta?: string | null
          hora_salida_ida?: string
          hora_salida_vuelta?: string | null
          id?: string
          nombre?: string
          num_viajeros?: number | null
          observaciones?: string | null
          org_id?: string
          origen_ida?: Json
          paradas_ida?: Json
          paradas_vuelta?: Json
          periodo_fin?: string | null
          periodo_inicio?: string
          precio_referencia?: number | null
          timezone?: string
          tipo_servicio?: string
          updated_at?: string
          vehicle_id?: string | null
          vuelta_habilitada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trade_transport_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttsch_client_org_fk"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "ttsch_conductor_org_fk"
            columns: ["org_id", "conductor_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "ttsch_vehicle_org_fk"
            columns: ["org_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_transport_services: {
        Row: {
          cerrado_at: string | null
          cerrado_por: string | null
          client_id: string | null
          conductor_id: string | null
          contacto_principal: Json | null
          created_at: string
          destino: string | null
          destino_detalle: Json | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          hora_inicio_real: string | null
          hora_real_llegada: string | null
          hora_real_salida: string | null
          id: string
          incidencias: string | null
          iniciado_por: string | null
          instrucciones_conductor: string | null
          intake_data: Json | null
          iva_pct: number | null
          km_reales: number | null
          num_viajeros: number | null
          obs_inicio: string | null
          observaciones: string | null
          observaciones_cierre: string | null
          odometro_final: number | null
          odometro_inicio: number | null
          odometro_recorridos: number | null
          org_id: string
          origen: string | null
          origen_detalle: Json | null
          paradas: Json
          precio_acordado: number | null
          quote_id: string | null
          schedule_fecha: string | null
          schedule_id: string | null
          schedule_sentido: string | null
          tipo_servicio: string
          titulo: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          client_id?: string | null
          conductor_id?: string | null
          contacto_principal?: Json | null
          created_at?: string
          destino?: string | null
          destino_detalle?: Json | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio: string
          hora_inicio_real?: string | null
          hora_real_llegada?: string | null
          hora_real_salida?: string | null
          id?: string
          incidencias?: string | null
          iniciado_por?: string | null
          instrucciones_conductor?: string | null
          intake_data?: Json | null
          iva_pct?: number | null
          km_reales?: number | null
          num_viajeros?: number | null
          obs_inicio?: string | null
          observaciones?: string | null
          observaciones_cierre?: string | null
          odometro_final?: number | null
          odometro_inicio?: number | null
          odometro_recorridos?: number | null
          org_id: string
          origen?: string | null
          origen_detalle?: Json | null
          paradas?: Json
          precio_acordado?: number | null
          quote_id?: string | null
          schedule_fecha?: string | null
          schedule_id?: string | null
          schedule_sentido?: string | null
          tipo_servicio?: string
          titulo: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          client_id?: string | null
          conductor_id?: string | null
          contacto_principal?: Json | null
          created_at?: string
          destino?: string | null
          destino_detalle?: Json | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          hora_inicio_real?: string | null
          hora_real_llegada?: string | null
          hora_real_salida?: string | null
          id?: string
          incidencias?: string | null
          iniciado_por?: string | null
          instrucciones_conductor?: string | null
          intake_data?: Json | null
          iva_pct?: number | null
          km_reales?: number | null
          num_viajeros?: number | null
          obs_inicio?: string | null
          observaciones?: string | null
          observaciones_cierre?: string | null
          odometro_final?: number | null
          odometro_inicio?: number | null
          odometro_recorridos?: number | null
          org_id?: string
          origen?: string | null
          origen_detalle?: Json | null
          paradas?: Json
          precio_acordado?: number | null
          quote_id?: string | null
          schedule_fecha?: string | null
          schedule_id?: string | null
          schedule_sentido?: string | null
          tipo_servicio?: string
          titulo?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_transport_services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_transport_services_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "trade_transport_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tts_client_org_fk"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "trade_clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tts_conductor_org_fk"
            columns: ["org_id", "conductor_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tts_quote_org_fk"
            columns: ["org_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "tts_vehicle_org_fk"
            columns: ["org_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_transport_stop_favorites: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          location: Json
          nombre: string
          org_id: string
          tipo_lugar: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          location?: Json
          nombre: string
          org_id: string
          tipo_lugar?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          location?: Json
          nombre?: string
          org_id?: string
          tipo_lugar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_transport_stop_favorites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_transport_trips: {
        Row: {
          cerrado_at: string | null
          cerrado_por: string | null
          cliente_nombre: string | null
          conductor_id: string | null
          created_at: string
          destino: string
          destino_detalle: Json | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          hora_real_llegada: string | null
          hora_real_salida: string | null
          id: string
          incidencias: string | null
          km_fin: number | null
          km_inicio: number | null
          km_realizados: number | null
          num_bultos: number | null
          observaciones: string | null
          observaciones_cierre: string | null
          odometro_final: number | null
          odometro_inicio: number | null
          org_id: string
          origen: string
          origen_detalle: Json | null
          peso_kg: number | null
          precio_acordado: number | null
          referencia: string | null
          tipo_carga: Database["public"]["Enums"]["tipo_carga_mercancias"]
          titulo: string
          updated_at: string
          vehicle_id: string | null
          volumen_m3: number | null
        }
        Insert: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          cliente_nombre?: string | null
          conductor_id?: string | null
          created_at?: string
          destino: string
          destino_detalle?: Json | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio: string
          hora_real_llegada?: string | null
          hora_real_salida?: string | null
          id?: string
          incidencias?: string | null
          km_fin?: number | null
          km_inicio?: number | null
          km_realizados?: number | null
          num_bultos?: number | null
          observaciones?: string | null
          observaciones_cierre?: string | null
          odometro_final?: number | null
          odometro_inicio?: number | null
          org_id: string
          origen: string
          origen_detalle?: Json | null
          peso_kg?: number | null
          precio_acordado?: number | null
          referencia?: string | null
          tipo_carga?: Database["public"]["Enums"]["tipo_carga_mercancias"]
          titulo: string
          updated_at?: string
          vehicle_id?: string | null
          volumen_m3?: number | null
        }
        Update: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          cliente_nombre?: string | null
          conductor_id?: string | null
          created_at?: string
          destino?: string
          destino_detalle?: Json | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          hora_real_llegada?: string | null
          hora_real_salida?: string | null
          id?: string
          incidencias?: string | null
          km_fin?: number | null
          km_inicio?: number | null
          km_realizados?: number | null
          num_bultos?: number | null
          observaciones?: string | null
          observaciones_cierre?: string | null
          odometro_final?: number | null
          odometro_inicio?: number | null
          org_id?: string
          origen?: string
          origen_detalle?: Json | null
          peso_kg?: number | null
          precio_acordado?: number | null
          referencia?: string | null
          tipo_carga?: Database["public"]["Enums"]["tipo_carga_mercancias"]
          titulo?: string
          updated_at?: string
          vehicle_id?: string | null
          volumen_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_transport_trips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttt_conductor_org_fk"
            columns: ["org_id", "conductor_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "ttt_vehicle_org_fk"
            columns: ["org_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_vehicle_docs: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          fecha_doc: string | null
          fecha_vencimiento: string | null
          id: string
          org_id: string
          storage_path: string | null
          tipo: string
          titulo: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_doc?: string | null
          fecha_vencimiento?: string | null
          id?: string
          org_id: string
          storage_path?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_doc?: string | null
          fecha_vencimiento?: string | null
          id?: string
          org_id?: string
          storage_path?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tvd_vehicle_fk"
            columns: ["org_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_vehicle_km_readings: {
        Row: {
          corrige_id: string | null
          created_at: string
          created_by: string | null
          fuente: string
          id: string
          km: number
          leido_en: string
          notas: string | null
          org_id: string
          servicio_id: string | null
          tipo: string
          vehicle_id: string
        }
        Insert: {
          corrige_id?: string | null
          created_at?: string
          created_by?: string | null
          fuente?: string
          id?: string
          km: number
          leido_en?: string
          notas?: string | null
          org_id: string
          servicio_id?: string | null
          tipo: string
          vehicle_id: string
        }
        Update: {
          corrige_id?: string | null
          created_at?: string
          created_by?: string | null
          fuente?: string
          id?: string
          km?: number
          leido_en?: string
          notas?: string | null
          org_id?: string
          servicio_id?: string | null
          tipo?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_vehicle_km_readings_corrige_id_fkey"
            columns: ["corrige_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicle_km_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vkr_service_org_fk"
            columns: ["org_id", "servicio_id"]
            isOneToOne: false
            referencedRelation: "trade_transport_services"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "vkr_vehicle_org_fk"
            columns: ["org_id", "vehicle_id"]
            isOneToOne: false
            referencedRelation: "trade_vehicles"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      trade_vehicles: {
        Row: {
          activo: boolean
          anno: number | null
          capacidad_carga_kg: number | null
          capacidad_viajeros: number | null
          color: string | null
          created_at: string
          estado: string
          id: string
          image_path: string | null
          itv_fecha_ultima: string | null
          itv_fecha_vencimiento: string | null
          km_actual: number | null
          km_actualizado_at: string | null
          marca: string | null
          matricula: string
          modalidad: string
          modelo_vehiculo: string | null
          nombre: string
          notas: string | null
          org_id: string
          seguro_compania: string | null
          seguro_referencia: string | null
          seguro_vencimiento: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          anno?: number | null
          capacidad_carga_kg?: number | null
          capacidad_viajeros?: number | null
          color?: string | null
          created_at?: string
          estado?: string
          id?: string
          image_path?: string | null
          itv_fecha_ultima?: string | null
          itv_fecha_vencimiento?: string | null
          km_actual?: number | null
          km_actualizado_at?: string | null
          marca?: string | null
          matricula: string
          modalidad?: string
          modelo_vehiculo?: string | null
          nombre: string
          notas?: string | null
          org_id: string
          seguro_compania?: string | null
          seguro_referencia?: string | null
          seguro_vencimiento?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          anno?: number | null
          capacidad_carga_kg?: number | null
          capacidad_viajeros?: number | null
          color?: string | null
          created_at?: string
          estado?: string
          id?: string
          image_path?: string | null
          itv_fecha_ultima?: string | null
          itv_fecha_vencimiento?: string | null
          km_actual?: number | null
          km_actualizado_at?: string | null
          marca?: string | null
          matricula?: string
          modalidad?: string
          modelo_vehiculo?: string | null
          nombre?: string
          notas?: string | null
          org_id?: string
          seguro_compania?: string | null
          seguro_referencia?: string | null
          seguro_vencimiento?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_verifactu_outbox: {
        Row: {
          accepted_at: string | null
          aeat_csv: string | null
          aeat_response_raw: Json | null
          attempt_count: number
          created_at: string
          fiscal_record_id: string
          id: string
          last_attempted_at: string | null
          last_error: string | null
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          aeat_csv?: string | null
          aeat_response_raw?: Json | null
          attempt_count?: number
          created_at?: string
          fiscal_record_id: string
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          aeat_csv?: string | null
          aeat_response_raw?: Json | null
          attempt_count?: number
          created_at?: string
          fiscal_record_id?: string
          id?: string
          last_attempted_at?: string | null
          last_error?: string | null
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_verifactu_outbox_fiscal_record_id_fkey"
            columns: ["fiscal_record_id"]
            isOneToOne: true
            referencedRelation: "trade_fiscal_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_verifactu_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_verifactu_system_config: {
        Row: {
          certificate_status: string
          collaboration_agreement_status: string
          enabled: boolean
          environment: string
          id: number
          installation_number: string | null
          multiple_ot_indicator: string | null
          notes: string | null
          producer_nif: string | null
          producer_nombre_razon: string
          retry_backoff_seconds: number
          retry_max_attempts: number
          sistema_id: string
          sistema_nombre: string
          sistema_version: string
          soap_endpoint: string
          transmission_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          certificate_status?: string
          collaboration_agreement_status?: string
          enabled?: boolean
          environment?: string
          id?: number
          installation_number?: string | null
          multiple_ot_indicator?: string | null
          notes?: string | null
          producer_nif?: string | null
          producer_nombre_razon?: string
          retry_backoff_seconds?: number
          retry_max_attempts?: number
          sistema_id?: string
          sistema_nombre?: string
          sistema_version?: string
          soap_endpoint?: string
          transmission_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          certificate_status?: string
          collaboration_agreement_status?: string
          enabled?: boolean
          environment?: string
          id?: number
          installation_number?: string | null
          multiple_ot_indicator?: string | null
          notes?: string | null
          producer_nif?: string | null
          producer_nombre_razon?: string
          retry_backoff_seconds?: number
          retry_max_attempts?: number
          sistema_id?: string
          sistema_nombre?: string
          sistema_version?: string
          soap_endpoint?: string
          transmission_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trade_voice_recordings: {
        Row: {
          created_at: string
          duration_secs: number | null
          id: string
          modelo_ia: string | null
          org_id: string
          partidas_json: Json | null
          processed_at: string | null
          quote_id: string | null
          storage_path: string
          transcript: string | null
        }
        Insert: {
          created_at?: string
          duration_secs?: number | null
          id?: string
          modelo_ia?: string | null
          org_id: string
          partidas_json?: Json | null
          processed_at?: string | null
          quote_id?: string | null
          storage_path: string
          transcript?: string | null
        }
        Update: {
          created_at?: string
          duration_secs?: number | null
          id?: string
          modelo_ia?: string | null
          org_id?: string
          partidas_json?: Json | null
          processed_at?: string | null
          quote_id?: string | null
          storage_path?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_voice_recordings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_voice_recordings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_waitlist: {
        Row: {
          advertising_discount_percent: number | null
          advertising_interest: boolean | null
          campaign_type: string | null
          catalog_size: string | null
          ciudad: string | null
          company_name: string | null
          company_type: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          desired_ad_space: string | null
          desired_period: string | null
          email: string
          estado: string
          estimated_budget: string | null
          founding_provider: boolean | null
          founding_provider_interest: boolean | null
          fuente: string
          geographic_coverage: string | null
          id: string
          interests: string[] | null
          lead_type: string | null
          next_followup_at: string | null
          nombre: string
          notas: string | null
          oficio: string | null
          presupuestos_al_mes: string | null
          prioridad: string
          product_category: string | null
          provider_interest: boolean | null
          provider_org_id: string | null
          province: string | null
          telefono: string | null
          website: string | null
        }
        Insert: {
          advertising_discount_percent?: number | null
          advertising_interest?: boolean | null
          campaign_type?: string | null
          catalog_size?: string | null
          ciudad?: string | null
          company_name?: string | null
          company_type?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          desired_ad_space?: string | null
          desired_period?: string | null
          email: string
          estado?: string
          estimated_budget?: string | null
          founding_provider?: boolean | null
          founding_provider_interest?: boolean | null
          fuente?: string
          geographic_coverage?: string | null
          id?: string
          interests?: string[] | null
          lead_type?: string | null
          next_followup_at?: string | null
          nombre: string
          notas?: string | null
          oficio?: string | null
          presupuestos_al_mes?: string | null
          prioridad?: string
          product_category?: string | null
          provider_interest?: boolean | null
          provider_org_id?: string | null
          province?: string | null
          telefono?: string | null
          website?: string | null
        }
        Update: {
          advertising_discount_percent?: number | null
          advertising_interest?: boolean | null
          campaign_type?: string | null
          catalog_size?: string | null
          ciudad?: string | null
          company_name?: string | null
          company_type?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          desired_ad_space?: string | null
          desired_period?: string | null
          email?: string
          estado?: string
          estimated_budget?: string | null
          founding_provider?: boolean | null
          founding_provider_interest?: boolean | null
          fuente?: string
          geographic_coverage?: string | null
          id?: string
          interests?: string[] | null
          lead_type?: string | null
          next_followup_at?: string | null
          nombre?: string
          notas?: string | null
          oficio?: string | null
          presupuestos_al_mes?: string | null
          prioridad?: string
          product_category?: string | null
          provider_interest?: boolean | null
          provider_org_id?: string | null
          province?: string | null
          telefono?: string | null
          website?: string | null
        }
        Relationships: []
      }
      trade_worker_exceptions: {
        Row: {
          created_at: string | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo: string | null
          org_id: string
          tipo: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo?: string | null
          org_id: string
          tipo?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo?: string | null
          org_id?: string
          tipo?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_worker_exceptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_worker_exceptions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_worker_schedules: {
        Row: {
          activo: boolean | null
          descanso_fin: string | null
          descanso_inicio: string | null
          dia_semana: number
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          org_id: string
          worker_id: string
        }
        Insert: {
          activo?: boolean | null
          descanso_fin?: string | null
          descanso_inicio?: string | null
          dia_semana: number
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          org_id: string
          worker_id: string
        }
        Update: {
          activo?: boolean | null
          descanso_fin?: string | null
          descanso_inicio?: string | null
          dia_semana?: number
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          org_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_worker_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_worker_schedules_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "trade_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_workers: {
        Row: {
          activo: boolean
          avatar_url: string | null
          buffer_desplazamiento_min: number | null
          cap_caducidad: string | null
          categorias_permiso: string[] | null
          created_at: string
          email: string | null
          es_conductor: boolean
          especialidades: string[] | null
          estado_actual: string | null
          fecha_incorporacion: string | null
          home_lat: number | null
          home_lng: number | null
          horario_fin: string | null
          horario_inicio: string | null
          id: string
          identificador_interno: string | null
          max_trabajos_dia: number | null
          nombre: string
          notas: string | null
          observaciones_profesionales: string | null
          org_id: string
          permiso_caducidad: string | null
          rol: string
          telefono: string | null
          tiene_vehiculo: boolean | null
          updated_at: string
          zona_operacion: string[] | null
        }
        Insert: {
          activo?: boolean
          avatar_url?: string | null
          buffer_desplazamiento_min?: number | null
          cap_caducidad?: string | null
          categorias_permiso?: string[] | null
          created_at?: string
          email?: string | null
          es_conductor?: boolean
          especialidades?: string[] | null
          estado_actual?: string | null
          fecha_incorporacion?: string | null
          home_lat?: number | null
          home_lng?: number | null
          horario_fin?: string | null
          horario_inicio?: string | null
          id?: string
          identificador_interno?: string | null
          max_trabajos_dia?: number | null
          nombre: string
          notas?: string | null
          observaciones_profesionales?: string | null
          org_id: string
          permiso_caducidad?: string | null
          rol?: string
          telefono?: string | null
          tiene_vehiculo?: boolean | null
          updated_at?: string
          zona_operacion?: string[] | null
        }
        Update: {
          activo?: boolean
          avatar_url?: string | null
          buffer_desplazamiento_min?: number | null
          cap_caducidad?: string | null
          categorias_permiso?: string[] | null
          created_at?: string
          email?: string | null
          es_conductor?: boolean
          especialidades?: string[] | null
          estado_actual?: string | null
          fecha_incorporacion?: string | null
          home_lat?: number | null
          home_lng?: number | null
          horario_fin?: string | null
          horario_inicio?: string | null
          id?: string
          identificador_interno?: string | null
          max_trabajos_dia?: number | null
          nombre?: string
          notas?: string | null
          observaciones_profesionales?: string | null
          org_id?: string
          permiso_caducidad?: string | null
          rol?: string
          telefono?: string | null
          tiene_vehiculo?: boolean | null
          updated_at?: string
          zona_operacion?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_workers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "trade_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          name: string | null
          permissions: string[] | null
          pin: string | null
          role: string | null
        }
        Insert: {
          id: string
          name?: string | null
          permissions?: string[] | null
          pin?: string | null
          role?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          permissions?: string[] | null
          pin?: string | null
          role?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_marketplace_invitations_safe: {
        Row: {
          actor_id: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          role_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          role_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_marketplace_invitations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_marketplace_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "trade_marketplace_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _actor_id_for_offering: {
        Args: { p_offering_id: string }
        Returns: string
      }
      _classify_dst_time: {
        Args: { p_local: string; p_tz: string }
        Returns: Json
      }
      _is_actor_member: { Args: { p_actor_id: string }; Returns: boolean }
      _marketplace_is_active: { Args: never; Returns: boolean }
      _marketplace_org_catalog_ids: {
        Args: { p_org_id: string }
        Returns: string[]
      }
      _marketplace_preview_allowed: { Args: never; Returns: boolean }
      _mkt_actor_ids_for_user: { Args: { p_type?: string }; Returns: string[] }
      _mkt_calc_chargeback_exposure: {
        Args: { p_exclude_dispute_id?: string; p_supplier_order_id: string }
        Returns: number
      }
      _mkt_calc_item_refund_amounts: {
        Args: { p_items: Json; p_supplier_order_id: string }
        Returns: Json
      }
      _mkt_caller_role_priority: {
        Args: { p_actor_id: string }
        Returns: number
      }
      _mkt_creative_is_own_draft: {
        Args: { p_actor_id: string; p_creative_id: string }
        Returns: boolean
      }
      _mkt_fin_calculate_settlement_lines: {
        Args: {
          p_actor_id: string
          p_currency: string
          p_period_end: string
          p_period_start: string
          p_settlement_id: string
        }
        Returns: Json
      }
      _mkt_has_permission: {
        Args: { p_actor_id: string; p_permission: string }
        Returns: boolean
      }
      _mkt_is_platform_admin: { Args: never; Returns: boolean }
      _mkt_resolve_provider_alternatives: {
        Args: { p_cantidad: number; p_org_id: string; p_up_id: string }
        Returns: Json
      }
      _mkt_supplier_member_check: {
        Args: { p_actor_id: string }
        Returns: boolean
      }
      _mkt_unblock_job_if_complete: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      _mkt_update_master_refund_status: {
        Args: { p_master_order_id: string }
        Returns: undefined
      }
      _mkt_update_so_refund_status: {
        Args: { p_supplier_order_id: string }
        Returns: undefined
      }
      _mkt_validate_dispute_transition: {
        Args: { p_current: string; p_new: string }
        Returns: boolean
      }
      _safe_datos_fila: { Args: { p_item: Json }; Returns: Json }
      _user_admin_org_ids: { Args: never; Returns: string[] }
      _user_org_ids: { Args: never; Returns: string[] }
      accept_marketplace_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      accept_quote_public: { Args: { p_token: string }; Returns: Json }
      add_cart_item: {
        Args: {
          p_cantidad?: number
          p_cart_id: string
          p_descripcion: string
          p_ia_añadido?: boolean
          p_ia_sugerencia?: string
          p_ia_tipo?: string
          p_unidad?: string
        }
        Returns: string
      }
      add_free_cart_items: {
        Args: { p_cart_id: string; p_items: Json }
        Returns: undefined
      }
      admin_add_usage_alert_note: {
        Args: {
          p_id: string
          p_ip?: string
          p_note: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      admin_approve_ad_creative: {
        Args: { p_creative_id: string }
        Returns: Json
      }
      admin_audit_export_download_stats: {
        Args: { p_export_id: string }
        Returns: {
          download_count: number
          last_downloaded_at: string
          last_downloaded_by_email: string
        }[]
      }
      admin_check_slot_availability: {
        Args: {
          p_exclude_booking_id?: string
          p_fin: string
          p_inicio: string
          p_slot_id: string
        }
        Returns: boolean
      }
      admin_convert_request_to_booking: {
        Args: { p_fin?: string; p_inicio?: string; p_request_id: string }
        Returns: Json
      }
      admin_create_ad_booking: {
        Args: {
          p_actor_id: string
          p_estado?: string
          p_fin: string
          p_inicio: string
          p_notas?: string
          p_slot_id: string
        }
        Returns: string
      }
      admin_create_ad_financial_document: {
        Args: {
          p_booking_id: string
          p_discount_rate?: number
          p_pricing_mode?: string
        }
        Returns: string
      }
      admin_get_activity_summary: {
        Args: never
        Returns: {
          clients_count: number
          last_quote_at: string
          org_id: string
          quotes_count: number
        }[]
      }
      admin_get_ad_bookings: {
        Args: never
        Returns: {
          actor_id: string
          aprobado_at: string
          aprobado_por: string
          commercial_terms_snapshot: Json
          created_at: string
          estado: string
          estimated_days_snapshot: number
          estimated_total_snapshot: number
          fin: string
          id: string
          inicio: string
          mensaje: string
          notas: string
          origen: string
          rate_amount_snapshot: number
          rate_currency_snapshot: string
          rate_unit_snapshot: string
          slot_id: string
          target_id: string
          target_label: string
          target_type: string
          updated_at: string
        }[]
      }
      admin_get_ad_campaigns: {
        Args: never
        Returns: {
          accent: string
          activa: boolean
          actor_id: string
          advertiser_name: string
          aprobada_at: string
          aprobada_por: string
          bg: string
          booking_id: string
          campaign_source: string
          created_at: string
          cta_label: string
          destination_type: string
          destination_value: string
          end_at: string
          estado: string
          eyebrow: string
          id: string
          image_url: string
          metadata: Json
          mobile_image_url: string
          nombre: string
          oficio: string
          priority: number
          rechazo_motivo: string
          slot_id: string
          start_at: string
          subtitle: string
          text_color: string
          title: string
          updated_at: string
        }[]
      }
      admin_get_ad_creatives: {
        Args: never
        Returns: {
          activa: boolean
          alt_text: string
          aprobada_at: string
          aprobada_por: string
          body_text: string
          campaign_id: string
          created_at: string
          creative_mode: string
          cta_text: string
          discount_label: string
          estado: string
          generada_ia: boolean
          headline: string
          id: string
          image_url: string
          mobile_image_url: string
          old_price_display: number
          overlay_strength: number
          price_display: number
          published_at: string
          published_by: string
          rechazo_motivo: string
          submitted_at: string
          text_position: string
          theme_preset: string
          updated_at: string
        }[]
      }
      admin_get_ads_dashboard: { Args: never; Returns: Json }
      admin_get_financial_documents: {
        Args: {
          p_actor_id?: string
          p_billing_cycle?: string
          p_date_from?: string
          p_date_to?: string
          p_estado?: string
          p_payer_type?: string
          p_payment_status?: string
          p_plan?: string
          p_revenue_type?: string
          p_search?: string
          p_slot_id?: string
        }
        Returns: {
          actor_id: string
          actor_nombre: string
          actor_tax_id: string
          actor_telefono: string
          commercial_value: number
          concept: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_nif: string
          discount_amount: number
          doc_number: string
          doc_series: string
          document_type: string
          estado: string
          id: string
          invoice_pdf_url: string
          invoice_url: string
          issued_at: string
          metadata: Json
          net_amount: number
          org_id: string
          org_nombre: string
          paid_at: string
          payer_type: string
          payment_method: string
          payment_status: string
          period_end: string
          period_start: string
          promotion_amount: number
          public_token: string
          rate_amount: number
          revenue_type: string
          sent_at: string
          sent_to: string
          slot_nombre: string
          stripe_invoice_id: string
          tax_amount: number
          tax_rate: number
          total_amount: number
        }[]
      }
      admin_get_financial_summary: { Args: never; Returns: Json }
      admin_get_platform_invoices: {
        Args: never
        Returns: {
          amount_cents: number
          created_at: string
          id: string
          invoice_pdf_url: string | null
          invoice_url: string | null
          notes: string | null
          org_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          plan: string | null
          status: string
          stripe_invoice_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "trade_platform_invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_trade_users: {
        Args: never
        Returns: {
          auth_email: string
          email_confirmed: boolean
          last_sign_in: string
          org_id: string
          owner_id: string
          user_created_at: string
        }[]
      }
      admin_get_verifactu_system_config: { Args: never; Returns: Json }
      admin_get_waitlist_leads: {
        Args: never
        Returns: {
          advertising_discount_percent: number | null
          advertising_interest: boolean | null
          campaign_type: string | null
          catalog_size: string | null
          ciudad: string | null
          company_name: string | null
          company_type: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          desired_ad_space: string | null
          desired_period: string | null
          email: string
          estado: string
          estimated_budget: string | null
          founding_provider: boolean | null
          founding_provider_interest: boolean | null
          fuente: string
          geographic_coverage: string | null
          id: string
          interests: string[] | null
          lead_type: string | null
          next_followup_at: string | null
          nombre: string
          notas: string | null
          oficio: string | null
          presupuestos_al_mes: string | null
          prioridad: string
          product_category: string | null
          provider_interest: boolean | null
          provider_org_id: string | null
          province: string | null
          telefono: string | null
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "trade_waitlist"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_audit_export_downloads: {
        Args: { p_export_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          downloaded_at: string
          downloaded_by_email: string
          downloaded_by_user_id: string
          id: string
          ip: string
          user_agent: string
        }[]
      }
      admin_list_audit_exports: {
        Args: {
          p_customer?: string
          p_format?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_to?: string
        }
        Returns: {
          created_at: string
          delivered_to_name: string
          delivered_to_org: string
          delivered_to_reason: string
          delivered_to_reference: string
          file_bytes: number
          file_sha256: string
          filter_customer: string
          filter_from: string
          filter_source: string
          filter_to: string
          filter_type: string
          format: string
          generated_by_email: string
          generated_by_user_id: string
          id: string
          row_count: number
          storage_bucket: string
          storage_path: string
        }[]
      }
      admin_list_audit_types: {
        Args: { p_source?: string }
        Returns: {
          type: string
        }[]
      }
      admin_list_usage_alert_actions: {
        Args: { p_alert_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          action_type: string
          actor_email: string
          created_at: string
          from_status: string
          id: string
          ip: string
          note: string
          to_status: string
          user_agent: string
        }[]
      }
      admin_list_usage_alerts: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          alert_type: string
          customer_email: string
          customer_id: string
          customer_name: string
          detected_at: string
          id: string
          reason: string
          severity: string
          status: string
        }[]
      }
      admin_mark_financial_doc_sent: {
        Args: { p_doc_id: string; p_sent_to: string }
        Returns: undefined
      }
      admin_publish_ad_creative: {
        Args: { p_creative_id: string }
        Returns: Json
      }
      admin_reject_ad_creative: {
        Args: { p_creative_id: string; p_motivo: string }
        Returns: Json
      }
      admin_reopen_usage_alert:
        | { Args: { p_id: string; p_note?: string }; Returns: undefined }
        | {
            Args: {
              p_id: string
              p_ip?: string
              p_note?: string
              p_user_agent?: string
            }
            Returns: undefined
          }
      admin_resolve_usage_alert: {
        Args: {
          p_id: string
          p_ip?: string
          p_note?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      admin_set_subscription_active: {
        Args: { p_active: boolean; p_org_id: string }
        Returns: undefined
      }
      admin_update_ad_booking:
        | {
            Args: {
              p_actor_id?: string
              p_booking_id: string
              p_estado?: string
              p_fin?: string
              p_inicio?: string
              p_notas?: string
              p_slot_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_actor_id: string
              p_estado: string
              p_fin: string
              p_id: string
              p_inicio: string
              p_notas?: string
              p_slot_id: string
            }
            Returns: Json
          }
      admin_update_ad_request_status: {
        Args: { p_admin_notes?: string; p_request_id: string; p_status: string }
        Returns: Json
      }
      admin_whoami: {
        Args: never
        Returns: {
          email: string
          is_admin: boolean
          user_id: string
        }[]
      }
      analyze_cart_with_ai: {
        Args: { p_cart_id: string }
        Returns: {
          accion: string
          descripcion: string
          item_id: string
          payload: Json
          tipo: string
          titulo: string
        }[]
      }
      api_sync_catalog_offerings: {
        Args: {
          p_actor_id: string
          p_items: Json
          p_source_system?: string
          p_sync_log_id?: string
        }
        Returns: Json
      }
      api_sync_prices: {
        Args: { p_actor_id: string; p_items: Json }
        Returns: Json
      }
      api_sync_stock: {
        Args: { p_actor_id: string; p_items: Json }
        Returns: Json
      }
      apply_referral_code: { Args: { p_code: string }; Returns: Json }
      apply_scheduled_plan_if_due: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      approve_transport_quote: { Args: { p_quote_id: string }; Returns: string }
      auto_select_providers: {
        Args: { p_cart_id: string; p_strategy?: string }
        Returns: number
      }
      auto_update_churn_risk: { Args: never; Returns: undefined }
      bulk_confirm_supplier_orders: {
        Args: { p_actor_id: string; p_order_ids: string[] }
        Returns: number
      }
      bulk_ship_supplier_orders: {
        Args: { p_actor_id: string; p_order_ids: string[]; p_tracking?: string }
        Returns: number
      }
      bulk_update_offerings: {
        Args: {
          p_activa?: boolean
          p_actor_id: string
          p_ids: string[]
          p_stock_disponible?: boolean
        }
        Returns: Json
      }
      cancel_catalog_import: {
        Args: { p_actor_id: string; p_import_id: string }
        Returns: undefined
      }
      cancel_marketplace_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      cancel_supplier_order: {
        Args: { p_actor_id: string; p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      change_job_address_clear_geo: {
        Args: {
          p_job_id: string
          p_new_cp: string
          p_new_direccion: string
          p_new_localidad: string
          p_old_cp: string
          p_old_direccion: string
          p_old_localidad: string
        }
        Returns: Json
      }
      check_and_increment_email_rate: {
        Args: { p_ip_hash: string; p_max: number; p_type: string }
        Returns: boolean
      }
      check_and_increment_rate_limit: {
        Args: { p_actor_id: string; p_endpoint: string; p_limit: number }
        Returns: Json
      }
      check_email_for_registration: { Args: { p_email: string }; Returns: Json }
      checkout_cart: { Args: { p_cart_id: string }; Returns: string[] }
      checkout_cart_v2: {
        Args: {
          p_buyer_snapshot?: Json
          p_cart_id: string
          p_checkout_key?: string
          p_delivery_data?: Json
        }
        Returns: string[]
      }
      claim_transport_notification: {
        Args: { p_org_id: string }
        Returns: string
      }
      cleanup_api_expired_records: { Args: never; Returns: undefined }
      cleanup_email_rate_limits: { Args: never; Returns: undefined }
      complete_transport_service:
        | {
            Args: {
              p_hora_real_llegada?: string
              p_hora_real_salida?: string
              p_incidencias?: string
              p_km_reales?: number
              p_observaciones_cierre?: string
              p_org_id: string
              p_service_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_force_odometro?: boolean
              p_hora_real_llegada?: string
              p_hora_real_salida?: string
              p_incidencias?: string
              p_km_reales?: number
              p_observaciones_cierre?: string
              p_odometro_final?: number
              p_org_id: string
              p_service_id: string
            }
            Returns: Json
          }
      complete_transport_trip: {
        Args: { p_org_id: string; p_parte?: Json; p_trip_id: string }
        Returns: Json
      }
      confirm_supplier_order: {
        Args: { p_notas?: string; p_order_id: string; p_source?: string }
        Returns: undefined
      }
      confirm_transport_service: {
        Args: { p_org_id: string; p_service_id: string }
        Returns: Json
      }
      confirm_transport_trip: {
        Args: { p_org_id: string; p_trip_id: string }
        Returns: Json
      }
      correct_vehicle_km_reading: {
        Args: {
          p_corrige_id: string
          p_km_correcto: number
          p_leido_en?: string
          p_notas?: string
          p_org_id: string
          p_vehicle_id: string
        }
        Returns: Json
      }
      create_api_credential: {
        Args: {
          p_actor_id: string
          p_expires_at: string
          p_nombre: string
          p_scopes: string[]
        }
        Returns: Json
      }
      create_cart_from_field_action: {
        Args: { p_action_id: string }
        Returns: string
      }
      create_cart_from_job: { Args: { p_job_id: string }; Returns: string }
      create_cart_from_maintenance_incident: {
        Args: { p_incident_id: string }
        Returns: string
      }
      create_cart_from_quote: { Args: { p_quote_id: string }; Returns: string }
      create_catalog_import: {
        Args: {
          p_actor_id: string
          p_archivo_hash: string
          p_chunk_size: number
          p_chunks_esperados: number
          p_mapping_config?: Json
          p_nombre_archivo: string
          p_parser_version?: string
          p_total_filas: number
        }
        Returns: string
      }
      create_free_cart: { Args: { p_org_id: string }; Returns: string }
      create_marketplace_actor: {
        Args: {
          p_catalog_id?: string
          p_country?: string
          p_legal_name?: string
          p_nombre: string
          p_tax_id?: string
        }
        Returns: string
      }
      create_marketplace_invitation: {
        Args: { p_actor_id: string; p_email: string; p_role_id: string }
        Returns: string
      }
      create_transport_service_from_quote: {
        Args: { p_org_id: string; p_quote_id: string }
        Returns: Json
      }
      cron_invoice_overdue_check: { Args: never; Returns: undefined }
      deactivate_team_member: {
        Args: { p_actor_id: string; p_member_id: string }
        Returns: undefined
      }
      debug_audit_exports_count_system: {
        Args: never
        Returns: {
          n: number
        }[]
      }
      deliver_marketplace_order: {
        Args: { p_notas?: string; p_order_id: string }
        Returns: undefined
      }
      ensure_campaign_for_booking: {
        Args: { p_booking_id: string }
        Returns: string
      }
      fail_catalog_import: {
        Args: { p_actor_id: string; p_import_id: string; p_motivo?: string }
        Returns: undefined
      }
      finalize_catalog_import: {
        Args: { p_actor_id: string; p_import_id: string }
        Returns: undefined
      }
      fn_crear_factura_rectificativa: {
        Args: {
          p_motivo: string
          p_org_id: string
          p_original_invoice_id: string
          p_tipo_factura_vf: string
        }
        Returns: Json
      }
      fn_emitir_factura: {
        Args: { p_invoice_id: string; p_org_id: string }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      geo_reconcile: {
        Args: {
          p_actual: number
          p_org_id: string
          p_reservation_id: string
          p_waypoint_hash?: string
        }
        Returns: undefined
      }
      geo_reserve: {
        Args: {
          p_estimated: number
          p_org_id: string
          p_waypoint_hash?: string
        }
        Returns: Json
      }
      get_active_campaigns: {
        Args: { p_slot_ids: string[] }
        Returns: {
          accent: string
          advertiser_name: string
          bg: string
          campaign_id: string
          campaign_source: string
          cta_label: string
          destination_type: string
          destination_value: string
          eyebrow: string
          image_url: string
          mobile_image_url: string
          priority: number
          resolution_level: number
          slot_id: string
          subtitle: string
          text_color: string
          title: string
        }[]
      }
      get_ad_targeting_options: {
        Args: { p_actor_id: string; p_target_type: string }
        Returns: {
          extra: string
          id: string
          label: string
        }[]
      }
      get_api_catalog_products: {
        Args: {
          p_activa?: boolean
          p_actor_id: string
          p_match_state?: string
          p_page?: number
          p_per_page?: number
        }
        Returns: Json
      }
      get_api_credentials: { Args: { p_actor_id: string }; Returns: Json }
      get_cart_detail: { Args: { p_cart_id: string }; Returns: Json }
      get_cart_order_status: {
        Args: { p_cart_id: string }
        Returns: {
          actor_nombre: string
          actor_verificado: boolean
          completed_at: string
          confirmed_at: string
          created_at: string
          estado: string
          items_count: number
          order_id: string
          shipped_at: string
          total: number
        }[]
      }
      get_cart_provider_summary: {
        Args: { p_cart_id: string }
        Returns: {
          actor_id: string
          actor_nombre: string
          actor_verificado: boolean
          delivery_days: number
          items_count: number
          portes: number
          subtotal: number
          total_estimado: number
        }[]
      }
      get_catalog_quality_stats: { Args: { p_actor_id: string }; Returns: Json }
      get_financial_document_public: {
        Args: { p_token: string }
        Returns: {
          actor_nombre: string
          actor_tax_id: string
          actor_telefono: string
          commercial_value: number
          concept: string
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_nif: string
          discount_amount: number
          doc_number: string
          doc_series: string
          document_type: string
          estado: string
          id: string
          metadata: Json
          net_amount: number
          paid_at: string
          payment_status: string
          period_end: string
          period_start: string
          promotion_amount: number
          rate_amount: number
          revenue_type: string
          slot_nombre: string
          total_amount: number
        }[]
      }
      get_idempotency_record: {
        Args: { p_actor_id: string; p_endpoint: string; p_key: string }
        Returns: Json
      }
      get_job_review_info: {
        Args: { p_token: string }
        Returns: {
          cliente_nombre: string
          job_titulo: string
          org_logo_url: string
          org_nombre: string
          respondido: boolean
        }[]
      }
      get_local_stock: {
        Args: { p_location_id: string; p_offering_id: string }
        Returns: {
          disponible_hoy: boolean
          stock_cantidad: number
          stock_source: string
          stock_status: Database["public"]["Enums"]["stock_local_status"]
        }[]
      }
      get_locations_for_actor: {
        Args: {
          p_actor_id: string
          p_obra_lat?: number
          p_obra_lon?: number
          p_permite_recogida?: boolean
        }
        Returns: {
          codigo_postal: string
          comunidad_autonoma: string
          direccion_linea1: string
          distancia_km: number
          horario: Json
          id: string
          latitud: number
          localidad: string
          longitud: number
          nombre: string
          permite_entrega_local: boolean
          permite_recogida: boolean
          provincia: string
          radio_servicio_km: number
          telefono: string
          tipo: Database["public"]["Enums"]["location_tipo"]
        }[]
      }
      get_marketplace_catalog_paged: {
        Args: {
          p_familia?: string
          p_limit?: number
          p_offset?: number
          p_oficio?: string
          p_only_stock?: boolean
          p_query?: string
          p_sort_by?: string
        }
        Returns: {
          actor_ids: string[]
          actor_nombres: string[]
          best_actor_id: string
          best_actor_nombre: string
          best_offering_id: string
          best_plazo: number
          best_precio: number
          best_stock: boolean
          best_supplier_ref: string
          best_unidad: string
          descripcion: string
          familia: string
          image_url: string
          nombre_canonico: string
          offering_count: number
          oficio: string
          plazo_min: number
          precio_max: number
          precio_min: number
          stock_ok: boolean
          subfamilia: string
          total_count: number
          unidad: string
          up_id: string
        }[]
      }
      get_my_marketplace_memberships: {
        Args: never
        Returns: {
          accepted_at: string
          activo: boolean
          actor_estado: string
          actor_id: string
          actor_logo_url: string
          actor_nombre: string
          actor_slug: string
          actor_type: string
          actor_verificado: boolean
          member_id: string
          permissions: Json
          role_id: string
          role_nombre: string
          role_priority: number
        }[]
      }
      get_offering_events: {
        Args: { p_actor_id: string; p_limit?: number; p_offering_id: string }
        Returns: Json[]
      }
      get_offering_match_candidates: {
        Args: { p_limit?: number; p_offering_id: string; p_query?: string }
        Returns: {
          ean: string
          explicacion: string
          familia: string
          id: string
          marca: string
          match_descripcion: boolean
          match_ean: boolean
          match_familia: boolean
          match_marca: boolean
          match_mpn: boolean
          modelo: string
          mpn: string
          nombre_canonico: string
          ofertas_count: number
          oficio: string
          score: number
        }[]
      }
      get_offerings_for_up: {
        Args: { p_up_id: string }
        Returns: {
          actor_id: string
          actor_nombre: string
          actor_verificado: boolean
          descripcion: string
          image_url: string
          offering_id: string
          plazo_dias: number
          precio_coste: number
          stock_cantidad: number
          stock_disponible: boolean
          supplier_ref: string
          unidad: string
        }[]
      }
      get_order_events: {
        Args: { p_order_id: string }
        Returns: {
          actor_type: string
          created_at: string
          from_estado: string
          id: string
          notas: string
          payload: Json
          tipo: string
          to_estado: string
        }[]
      }
      get_order_full_detail: { Args: { p_order_id: string }; Returns: Json }
      get_orders_by_ids: {
        Args: { p_order_ids: string[] }
        Returns: {
          actor_nombre: string
          actor_verificado: boolean
          completed_at: string
          confirmed_at: string
          created_at: string
          delivery_address: Json
          delivery_method: string
          estado: string
          items_count: number
          numero: string
          order_id: string
          payment_method: string
          pickup_point_id: string
          shipped_at: string
          total: number
        }[]
      }
      get_org_active_orders: {
        Args: { p_limit?: number; p_offset?: number; p_org_id: string }
        Returns: {
          actor_id: string
          actor_nombre: string
          actor_verificado: boolean
          cancelled_at: string
          cliente_nombre: string
          confirmed_at: string
          created_at: string
          delivered_at: string
          estado: string
          id: string
          items_count: number
          notas_proveedor: string
          numero: string
          obra_nombre: string
          preparing_at: string
          shipped_at: string
          source_ref: string
          total: number
          total_count: number
          tracking_ref: string
          tracking_url: string
        }[]
      }
      get_org_order_history: {
        Args: { p_limit?: number; p_offset?: number; p_org_id: string }
        Returns: {
          actor_nombre: string
          cliente_nombre: string
          completed_at: string
          created_at: string
          estado: string
          id: string
          items_count: number
          numero: string
          obra_nombre: string
          source_ref: string
          total: number
          total_count: number
        }[]
      }
      get_parte_info: {
        Args: { p_token: string }
        Returns: {
          cliente_nombre: string
          firma_url: string
          fotos: Json
          job_fecha: string
          job_hora_fin: string
          job_notas: string
          job_titulo: string
          org_logo_url: string
          org_nombre: string
        }[]
      }
      get_supplier_action_center: {
        Args: { p_actor_id: string }
        Returns: {
          count_items: number
          cta_label: string
          cta_target: string
          descripcion: string
          severidad: string
          tipo: string
          titulo: string
        }[]
      }
      get_supplier_activity_feed: {
        Args: { p_actor_id: string; p_limit?: number }
        Returns: {
          count_items: number
          created_at: string
          descripcion: string
          event_source: string
          id: string
          ref_id: string
          tipo: string
          titulo: string
        }[]
      }
      get_supplier_ai_insights: {
        Args: { p_actor_id: string }
        Returns: {
          accion: string
          descripcion: string
          insight_type: string
          titulo: string
          unidad: string
          valor: number
        }[]
      }
      get_supplier_api_sync_log: {
        Args: { p_actor_id: string; p_limit?: number }
        Returns: Json
      }
      get_supplier_audit_log: {
        Args: { p_actor_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_supplier_checkout_config: {
        Args: { p_actor_ids: string[] }
        Returns: {
          actor_id: string
          actor_nombre: string
          actor_verificado: boolean
          coste_portes: number
          mensaje_instaladores: string
          payment_methods_allowed: string[]
          permite_coordinar: boolean
          permite_entrega: boolean
          permite_recogida: boolean
          pickup_points: Json
          plazo_confirmacion_h: number
          plazo_entrega_dias: number
          portes_gratis_desde: number
          supplier_locations: Json
        }[]
      }
      get_supplier_dashboard_stats: {
        Args: { p_actor_id: string }
        Returns: Json
      }
      get_supplier_health_score: {
        Args: { p_actor_id: string }
        Returns: {
          avg_confirm_h: number
          cobertura_pct: number
          cobertura_pts: number
          completado_pts: number
          completion_rate: number
          respuesta_pts: number
          score: number
          stock_pct: number
          stock_pts: number
        }[]
      }
      get_supplier_ia_stats: { Args: { p_actor_id: string }; Returns: Json }
      get_supplier_invitations: { Args: { p_actor_id: string }; Returns: Json }
      get_supplier_location_stats: {
        Args: { p_actor_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          avg_confirm_h: number
          clientes_distintos: number
          location_id: string
          location_localidad: string
          location_nombre: string
          location_tipo: string
          num_pedidos: number
          pedidos_cancelados: number
          pedidos_completados: number
          pedidos_entrega: number
          pedidos_pendientes: number
          pedidos_recogida: number
          porcentaje_entrega: number
          porcentaje_recogida: number
          ticket_medio: number
          top_producto_nombre: string
          top_producto_unidades: number
          top_universal_product_id: string
          ventas_completadas: number
          volumen_pedidos: number
        }[]
      }
      get_supplier_notifications: {
        Args: { p_actor_id: string; p_limit?: number; p_unread_only?: boolean }
        Returns: {
          created_at: string
          cuerpo: string
          id: string
          leida: boolean
          leida_at: string
          ref_id: string
          ref_tipo: string
          tipo: string
          titulo: string
        }[]
      }
      get_supplier_offerings_paged: {
        Args: {
          p_activa?: boolean
          p_actor_id: string
          p_limit?: number
          p_match_state?: string
          p_offset?: number
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_stock?: boolean
        }
        Returns: Json[]
      }
      get_supplier_order_alerts: { Args: { p_actor_id: string }; Returns: Json }
      get_supplier_order_detail: {
        Args: { p_actor_id: string; p_order_id: string }
        Returns: Json
      }
      get_supplier_orders_unified: {
        Args: {
          p_actor_id: string
          p_estado?: string
          p_limit?: number
          p_location_id?: string
          p_offset?: number
        }
        Returns: {
          completed_at: string
          confirmed_at: string
          created_at: string
          delivery_method: string
          estado: string
          id: string
          items_count: number
          notas: string
          numero: string
          org_id: string
          org_nombre: string
          original_estado: string
          pickup_location_id: string
          shipped_at: string
          source: string
          tienda_nombre: string
          total: number
          total_count: number
        }[]
      }
      get_supplier_reporting_catalog: {
        Args: { p_actor_id: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      get_supplier_reporting_kpis: {
        Args: { p_actor_id: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      get_supplier_reporting_operational: {
        Args: { p_actor_id: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      get_supplier_reporting_sales: {
        Args: { p_actor_id: string; p_date_from: string; p_date_to: string }
        Returns: Json
      }
      get_supplier_roles: { Args: { p_actor_id: string }; Returns: Json }
      get_supplier_team: {
        Args: {
          p_activo?: boolean
          p_actor_id: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: Json
      }
      get_transport_schedule_projection: {
        Args: {
          p_desde: string
          p_hasta: string
          p_org_id: string
          p_schedule_id: string
        }
        Returns: Database["public"]["CompositeTypes"]["transport_projection_row"][]
        SetofOptions: {
          from: "*"
          to: "transport_projection_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_trials_expiring_soon: {
        Args: { days_ahead?: number }
        Returns: {
          days_left: number
          org_id: string
          org_nombre: string
          owner_email: string
        }[]
      }
      global_risk_snapshot_public: {
        Args: never
        Returns: {
          c1: number
          c2: number
          c3: number
          c4: number
          c5: number
          pct_alto: number
          pct_bajo: number
          pct_medio: number
          pct1: number
          pct2: number
          pct3: number
          pct4: number
          pct5: number
          total: number
        }[]
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      hybrid_search_norm_chunks: {
        Args: {
          category_filter?: string[]
          match_count?: number
          oficio_filter?: string
          query_embedding: string
          query_text: string
        }
        Returns: {
          article_id: string
          article_title: string
          category: string
          chunk_id: string
          chunk_text: string
          document_id: string
          hybrid_score: number
          id: string
          oficio: string
          section: string
          section_title: string
        }[]
      }
      import_from_global_catalog: {
        Args: { p_familias?: string[]; p_oficios?: string[]; p_org_id: string }
        Returns: number
      }
      increment_actuacion_usage: {
        Args: { p_actuacion_ids: string[] }
        Returns: undefined
      }
      increment_rag_rate_limit: {
        Args: { p_date: string; p_org_id: string }
        Returns: undefined
      }
      insert_actuacion_learned: {
        Args: {
          p_actuacion_id: string
          p_keywords: string[]
          p_oficio: string
          p_partidas: string[]
          p_transcript: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      list_org_carts: {
        Args: {
          p_estado?: string
          p_limit?: number
          p_offset?: number
          p_org_id: string
        }
        Returns: {
          created_at: string
          estado: string
          id: string
          items_count: number
          ordered_at: string
          source_ref: string
          source_type: string
          total: number
        }[]
      }
      log_api_sync_end: {
        Args: {
          p_error_detail?: string
          p_rows_inserted?: number
          p_rows_rejected?: number
          p_rows_updated?: number
          p_status: string
          p_sync_id: string
        }
        Returns: undefined
      }
      log_api_sync_start: {
        Args: {
          p_actor_id: string
          p_credential_id: string
          p_endpoint: string
          p_idempotency_key?: string
          p_ip?: string
          p_rows_received?: number
          p_source_system?: string
          p_user_agent?: string
        }
        Returns: string
      }
      mark_notifications_read: {
        Args: { p_actor_id: string; p_notification_ids: string[] }
        Returns: undefined
      }
      mark_supplier_order_incident: {
        Args: { p_actor_id: string; p_description: string; p_order_id: string }
        Returns: undefined
      }
      mark_transport_notification: {
        Args: { p_org_id: string; p_status: string }
        Returns: undefined
      }
      match_offering_to_up: {
        Args: { p_method?: string; p_offering_id: string; p_up_id: string }
        Returns: undefined
      }
      materialize_transport_occurrence: {
        Args: {
          p_fecha: string
          p_org_id: string
          p_schedule_id: string
          p_sentido: string
          p_utc_offset_minutes?: number
        }
        Returns: Json
      }
      migrate_supplier_products_to_offerings: { Args: never; Returns: number }
      mkt_fin_add_dispute_evidence: {
        Args: {
          p_description?: string
          p_dispute_id: string
          p_document_reference?: string
          p_evidence_type: string
          p_storage_path?: string
        }
        Returns: Json
      }
      mkt_fin_admin_balances_overview: { Args: never; Returns: Json }
      mkt_fin_admin_disputes_overview: { Args: never; Returns: Json }
      mkt_fin_admin_negative_overview: { Args: never; Returns: Json }
      mkt_fin_admin_overview: { Args: never; Returns: Json }
      mkt_fin_admin_refunds_overview: { Args: never; Returns: Json }
      mkt_fin_admin_reserves_overview: { Args: never; Returns: Json }
      mkt_fin_approve_simulation_settlement: {
        Args: { p_notes?: string; p_settlement_id: string }
        Returns: Json
      }
      mkt_fin_audit: {
        Args: {
          p_actor_id?: string
          p_after?: Json
          p_before?: Json
          p_correlation_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_metadata?: Json
          p_reason?: string
        }
        Returns: undefined
      }
      mkt_fin_calculate_commission: {
        Args: {
          p_actor_id?: string
          p_goods_net: number
          p_simulation_mode?: boolean
        }
        Returns: Json
      }
      mkt_fin_cancel_draft_settlement: {
        Args: { p_reason?: string; p_settlement_id: string }
        Returns: Json
      }
      mkt_fin_cancel_recovery: {
        Args: {
          p_correlation_id?: string
          p_reason?: string
          p_recovery_id: string
        }
        Returns: Json
      }
      mkt_fin_cancel_simulation_reserve: {
        Args: {
          p_correlation_id?: string
          p_reason?: string
          p_reserve_id: string
        }
        Returns: Json
      }
      mkt_fin_check_gmv_revenue_separation: {
        Args: { p_master_order_id?: string }
        Returns: Json
      }
      mkt_fin_config_bool: {
        Args: { p_default?: boolean; p_key: string }
        Returns: boolean
      }
      mkt_fin_create_dispute: {
        Args: {
          p_amount: number
          p_correlation_id?: string
          p_evidence_due_at?: string
          p_external_dispute_id?: string
          p_external_payment_id?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_reason?: string
          p_reason_code?: string
          p_responsibility?: string
          p_source_event_id?: string
          p_supplier_order_id: string
        }
        Returns: Json
      }
      mkt_fin_create_master_order: {
        Args: {
          p_buyer_snapshot?: Json
          p_cart_id?: string
          p_checkout_key: string
          p_currency?: string
          p_delivery_address?: Json
          p_goods_gross_total?: number
          p_goods_net_total?: number
          p_goods_tax_total?: number
          p_guest_customer_id?: string
          p_org_id?: string
          p_shipping_gross_total?: number
          p_shipping_net_total?: number
          p_shipping_tax_total?: number
        }
        Returns: {
          buyer_snapshot: Json
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          checkout_gross_total: number
          checkout_key: string
          confirmed_at: string | null
          created_at: string
          currency: string
          delivery_address_snapshot: Json | null
          external_payment_intent_id: string | null
          external_provider: string
          fulfilled_at: string | null
          gmv_goods_gross: number | null
          gmv_goods_net: number | null
          gmv_shipping_net: number | null
          goods_gross_total: number
          goods_net_total: number
          goods_tax_total: number
          guest_customer_id: string | null
          id: string
          numero: string
          order_status: string
          org_id: string | null
          paid_at: string | null
          payment_status: string
          psp_fee_estimated: number | null
          refund_aggregate_status: string
          refund_gross_total: number
          shipping_gross_total: number
          shipping_net_total: number
          shipping_tax_total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trade_marketplace_master_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mkt_fin_create_recovery: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_correlation_id?: string
          p_currency?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_notes?: string
          p_recovery_type?: string
        }
        Returns: Json
      }
      mkt_fin_create_refund: {
        Args: {
          p_correlation_id?: string
          p_idempotency_key?: string
          p_items?: Json
          p_partial_amount_gross?: number
          p_reason?: string
          p_refund_type: string
          p_shipping_refund_gross?: number
          p_supplier_order_id: string
        }
        Returns: Json
      }
      mkt_fin_create_simulation_reserve: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_correlation_id?: string
          p_currency?: string
          p_dispute_id?: string
          p_expires_at?: string
          p_idempotency_key?: string
          p_master_order_id?: string
          p_metadata?: Json
          p_notes?: string
          p_reason?: string
          p_reason_code?: string
          p_release_at?: string
          p_release_conditions?: string[]
          p_reserve_type?: string
          p_source_bucket?: string
          p_source_event_id?: string
          p_supplier_order_id?: string
        }
        Returns: Json
      }
      mkt_fin_create_simulation_settlement: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_auto_calculate?: boolean
          p_correlation_id?: string
          p_currency?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_notes?: string
          p_period_end?: string
          p_period_start?: string
        }
        Returns: Json
      }
      mkt_fin_generate_purchase_summary: {
        Args: { p_master_order_id: string }
        Returns: string
      }
      mkt_fin_generate_settlement_statement: {
        Args: { p_settlement_id: string }
        Returns: string
      }
      mkt_fin_generate_supplier_statement: {
        Args: { p_supplier_order_id: string }
        Returns: string
      }
      mkt_fin_get_active_commission_policy: {
        Args: { p_actor_id?: string }
        Returns: {
          applies_to_shipping: boolean
          commission_base: string
          commission_enabled: boolean
          commission_rate: number
          commission_tax_rate: number
          commission_type: string
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          nombre: string
          notas: string | null
          provider_actor_id: string | null
          simulation_only: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trade_marketplace_commission_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mkt_fin_get_admin_settlements_overview: { Args: never; Returns: Json }
      mkt_fin_get_buyer_documents: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_search?: string
        }
        Returns: Json
      }
      mkt_fin_get_config: { Args: { p_key: string }; Returns: Json }
      mkt_fin_get_dispute: { Args: { p_dispute_id: string }; Returns: Json }
      mkt_fin_get_dispute_exposure: {
        Args: { p_supplier_order_id: string }
        Returns: Json
      }
      mkt_fin_get_document_detail: {
        Args: { p_document_id: string }
        Returns: Json
      }
      mkt_fin_get_master_order: {
        Args: { p_checkout_key?: string; p_master_order_id?: string }
        Returns: Json
      }
      mkt_fin_get_negative_balance_breakdown: {
        Args: { p_actor_id: string; p_currency?: string }
        Returns: Json
      }
      mkt_fin_get_provider_balance: {
        Args: { p_actor_id: string; p_currency?: string }
        Returns: Json
      }
      mkt_fin_get_provider_documents: {
        Args: { p_actor_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      mkt_fin_get_provider_financial_summary: {
        Args: { p_actor_id: string }
        Returns: Json
      }
      mkt_fin_get_purchase_summary_data: {
        Args: { p_checkout_key?: string; p_order_id?: string }
        Returns: Json
      }
      mkt_fin_get_refund: { Args: { p_refund_id: string }; Returns: Json }
      mkt_fin_get_refundable_summary: {
        Args: { p_supplier_order_id: string }
        Returns: Json
      }
      mkt_fin_get_reserve: { Args: { p_reserve_id: string }; Returns: Json }
      mkt_fin_get_reserve_aging_summary: {
        Args: { p_actor_id: string; p_currency?: string }
        Returns: Json
      }
      mkt_fin_get_settlement: {
        Args: { p_settlement_id: string }
        Returns: Json
      }
      mkt_fin_get_settlement_statement_data: {
        Args: { p_settlement_id: string }
        Returns: Json
      }
      mkt_fin_ledger_append: {
        Args: {
          p_actor_id?: string
          p_amount: number
          p_compensates_id?: string
          p_correlation_id?: string
          p_currency?: string
          p_description?: string
          p_entry_type: string
          p_external_id?: string
          p_external_provider?: string
          p_external_type?: string
          p_master_order_id?: string
          p_occurred_at?: string
          p_source_event_id?: string
          p_status?: string
          p_supplier_order_id?: string
        }
        Returns: {
          actor_id: string | null
          amount: number
          compensates_entry_id: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          description: string | null
          dispute_id: string | null
          entry_type: string
          external_id: string | null
          external_provider: string
          external_type: string | null
          id: string
          master_order_id: string | null
          occurred_at: string
          refund_id: string | null
          settlement_id: string | null
          source_event_id: string | null
          status: string
          supplier_order_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trade_marketplace_ledger_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mkt_fin_ledger_balance: {
        Args: { p_actor_id?: string; p_master_order_id?: string }
        Returns: Json
      }
      mkt_fin_list_admin_recoveries: {
        Args: {
          p_currency?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: Json
      }
      mkt_fin_list_admin_reserves: {
        Args: {
          p_currency?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: Json
      }
      mkt_fin_list_admin_settlements: {
        Args: {
          p_actor_id?: string
          p_currency?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: Json
      }
      mkt_fin_list_buyer_doc_refs: {
        Args: {
          p_doc_type?: string
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_search?: string
        }
        Returns: Json
      }
      mkt_fin_list_provider_doc_refs: {
        Args: { p_actor_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      mkt_fin_list_provider_recoveries: {
        Args: { p_actor_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      mkt_fin_list_provider_reserves: {
        Args: { p_actor_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      mkt_fin_list_provider_settlements: {
        Args: { p_actor_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      mkt_fin_list_supplier_disputes: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_provider_actor_id: string
        }
        Returns: Json
      }
      mkt_fin_list_supplier_refunds: {
        Args: { p_supplier_order_id: string }
        Returns: Json
      }
      mkt_fin_outbox_publish: {
        Args: {
          p_actor_id?: string
          p_event_type: string
          p_org_id?: string
          p_payload: Json
        }
        Returns: undefined
      }
      mkt_fin_post_checkout_ledger: {
        Args: { p_master_order_id: string }
        Returns: Json
      }
      mkt_fin_preview_dispute_outcome: {
        Args: {
          p_chargeback_fee?: number
          p_dispute_id: string
          p_outcome: string
        }
        Returns: Json
      }
      mkt_fin_preview_recovery: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_currency?: string
          p_recovery_type?: string
        }
        Returns: Json
      }
      mkt_fin_preview_refund: {
        Args: {
          p_items?: Json
          p_partial_amount_gross?: number
          p_refund_type: string
          p_shipping_refund_gross?: number
          p_supplier_order_id: string
        }
        Returns: Json
      }
      mkt_fin_preview_reserve: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_currency?: string
          p_reserve_type?: string
          p_source_bucket?: string
        }
        Returns: Json
      }
      mkt_fin_preview_settlement: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_currency?: string
          p_period_end?: string
          p_period_start?: string
        }
        Returns: Json
      }
      mkt_fin_process_expired_simulation_reserves: {
        Args: { p_currency?: string }
        Returns: Json
      }
      mkt_fin_process_recovery: {
        Args: {
          p_amount: number
          p_correlation_id?: string
          p_recovery_id: string
          p_source_event_id?: string
        }
        Returns: Json
      }
      mkt_fin_rebuild_provider_balance: {
        Args: { p_actor_id: string; p_currency?: string }
        Returns: Json
      }
      mkt_fin_recalculate_draft_settlement: {
        Args: { p_amount?: number; p_settlement_id: string }
        Returns: Json
      }
      mkt_fin_reconcile_provider_balance: {
        Args: { p_actor_id: string; p_currency?: string }
        Returns: Json
      }
      mkt_fin_register_provider_doc_ref: {
        Args: {
          p_doc_amount?: number
          p_doc_currency?: string
          p_doc_date_provider: string
          p_doc_number_provider: string
          p_doc_type: string
          p_notes?: string
          p_supplier_order_id: string
        }
        Returns: string
      }
      mkt_fin_release_simulation_reserve: {
        Args: {
          p_amount?: number
          p_correlation_id?: string
          p_reserve_id: string
          p_source_event_id?: string
        }
        Returns: Json
      }
      mkt_fin_sim_make_available: {
        Args: {
          p_actor_id: string
          p_amount?: number
          p_correlation?: string
          p_currency?: string
        }
        Returns: Json
      }
      mkt_fin_simulate_dispute_outcome: {
        Args: {
          p_chargeback_fee?: number
          p_correlation_id?: string
          p_dispute_id: string
          p_outcome: string
          p_source_event_id?: string
        }
        Returns: Json
      }
      mkt_fin_simulate_settlement_payment: {
        Args: { p_correlation_id?: string; p_settlement_id: string }
        Returns: Json
      }
      mkt_fin_write_item_snapshot: {
        Args: {
          p_commissionable_unit_price?: number
          p_descuento_importe?: number
          p_descuento_tipo?: string
          p_item_id: string
          p_precio_lista_net: number
          p_precio_neto: number
          p_tax_rate?: number
        }
        Returns: {
          cantidad: number
          commissionable_unit_price_net_snapshot: number | null
          created_at: string
          currency: string | null
          descripcion: string
          descuento_importe_snapshot: number | null
          descuento_tipo_snapshot: string | null
          id: string
          item_gross_snapshot: number | null
          item_net_snapshot: number | null
          item_tax_snapshot: number | null
          offering_id: string | null
          order_id: string
          precio_total: number | null
          precio_unitario: number
          precio_unitario_lista_snapshot: number | null
          precio_unitario_neto_snapshot: number | null
          referencia: string | null
          tax_rate_snapshot: number | null
          unidad: string
          universal_product_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trade_marketplace_order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mkt_fin_write_order_financial_snapshot: {
        Args: {
          p_commission_policy_id?: string
          p_goods_gross: number
          p_goods_net: number
          p_goods_tax: number
          p_master_order_id?: string
          p_order_id: string
          p_shipping_gross: number
          p_shipping_net: number
          p_shipping_tax: number
          p_tax_rate?: number
        }
        Returns: {
          actor_id: string
          buyer_snapshot: Json | null
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          cart_id_v2: string | null
          checkout_key: string | null
          commission_base_snapshot: string | null
          commission_gross_snapshot: number | null
          commission_net_snapshot: number | null
          commission_policy_id_snapshot: string | null
          commission_rate_snapshot: number | null
          commission_tax_snapshot: number | null
          commission_type_snapshot: string | null
          commissionable_base_net_snapshot: number | null
          commissionable_shipping_snapshot: boolean | null
          completed_at: string | null
          confirmed_at: string | null
          coste_envio: number
          created_at: string
          currency: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_method: string | null
          delivery_notas: string | null
          direccion_entrega: Json | null
          estado: string
          external_payment_id: string | null
          external_provider: string | null
          external_transfer_id: string | null
          financial_snapshot_at: string | null
          goods_gross_snapshot: number | null
          goods_net_snapshot: number | null
          goods_tax_snapshot: number | null
          guest_customer_id: string | null
          guest_email: string | null
          id: string
          job_id: string | null
          master_order_id: string | null
          notas: string | null
          notas_proveedor: string | null
          numero: string
          org_id: string | null
          origen: string
          payment_method: string | null
          payment_status: string | null
          pickup_location_id: string | null
          pickup_location_snapshot: Json | null
          pickup_point_id: string | null
          precio_tipo: string | null
          preparing_at: string | null
          provider_payable_snapshot: number | null
          quote_id: string | null
          refund_status: string
          refunded_amount: number | null
          return_amount: number | null
          shipped_at: string | null
          shipping_gross_snapshot: number | null
          shipping_net_snapshot: number | null
          shipping_tax_snapshot: number | null
          sim_commission_gross: number | null
          sim_commission_net: number | null
          sim_commission_rate: number | null
          sim_commission_tax: number | null
          subtotal: number
          tax_rate_snapshot: number | null
          total: number
          total_refunded_amount: number
          tracking_ref: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trade_marketplace_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_financial_doc_number: { Args: { p_serie: string }; Returns: string }
      next_maintenance_contract_number: {
        Args: { p_org_id: string }
        Returns: string
      }
      prepare_marketplace_order: {
        Args: { p_notas?: string; p_order_id: string }
        Returns: undefined
      }
      preview_marketplace_invitation: {
        Args: { p_token: string }
        Returns: Json
      }
      reactivate_team_member: {
        Args: { p_actor_id: string; p_member_id: string }
        Returns: undefined
      }
      recompute_run_stats: { Args: { p_run_id: string }; Returns: undefined }
      record_offering_event: {
        Args: {
          p_actor_id: string
          p_datos_antes?: Json
          p_datos_despues?: Json
          p_offering_id: string
          p_tipo: string
        }
        Returns: undefined
      }
      record_supplier_choice: {
        Args: { p_catalog_id: string; p_familia: string; p_org_id: string }
        Returns: undefined
      }
      request_ad_slot: {
        Args: {
          p_actor_id: string
          p_fin: string
          p_inicio: string
          p_mensaje?: string
          p_slot_id: string
        }
        Returns: Json
      }
      request_ad_slot_v2:
        | {
            Args: {
              p_actor_id: string
              p_fin: string
              p_inicio: string
              p_mensaje?: string
              p_slot_id: string
              p_target_id?: string
              p_target_type?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_actor_id: string
              p_fin: string
              p_inicio: string
              p_mensaje?: string
              p_slot_id: string
              p_target_id?: string
              p_target_ids?: string[]
              p_target_type?: string
            }
            Returns: Json
          }
      resend_supplier_invitation: {
        Args: { p_actor_id: string; p_invitation_id: string }
        Returns: string
      }
      resolve_api_credential: {
        Args: { p_ip?: string; p_key_hash: string; p_ua?: string }
        Returns: Json
      }
      resolve_effective_offering_price:
        | {
            Args: {
              p_at?: string
              p_buyer_mode: string
              p_offering_id: string
              p_org_id?: string
              p_quantity?: number
            }
            Returns: {
              condition_id: string
              condition_price_id: string
              currency: string
              precio_con_iva: number
              precio_neto: number
              precio_tipo: string
              promotion_id: string
              regla_aplicada: string
              resolution_version: number
              tax_rate: number
              valid_until: string
            }[]
          }
        | {
            Args: {
              p_cantidad?: number
              p_comunidad_auto?: string
              p_location_id?: string
              p_offering_id: string
              p_org_id?: string
            }
            Returns: {
              gross_amount: number
              location_id: string
              net_amount: number
              price_source: string
              promotion_id: string
              resolution_version: string
              tax_rate: number
              valid_until: string
            }[]
          }
      revoke_api_credential: {
        Args: { p_actor_id: string; p_credential_id: string }
        Returns: undefined
      }
      revoke_supplier_invitation: {
        Args: { p_actor_id: string; p_invitation_id: string }
        Returns: undefined
      }
      rotate_api_credential: {
        Args: { p_actor_id: string; p_credential_id: string }
        Returns: Json
      }
      search_actuaciones_scored: {
        Args: { p_limit?: number; p_transcript: string }
        Returns: {
          actuacion_id: string
          observaciones: string
          oficio: string
          partidas_auxiliares: string[]
          partidas_obligatorias: string[]
          precio_max: number
          precio_min: number
          reglas_calculo: string
          score: number
          unidad: string
        }[]
      }
      search_marketplace_offerings: {
        Args: {
          p_category_id?: string
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_query: string
        }
        Returns: {
          ean: string
          es_generico: boolean
          familia: string
          image_url: string
          marca: string
          mejor_offering_id: string
          mejor_precio_coste: number
          mejor_supplier_key: string
          mejor_supplier_name: string
          modelo: string
          nombre_canonico: string
          ofertas_count: number
          oficio: string
          score: number
          unidad: string
          universal_product_id: string
        }[]
      }
      search_supplier_products: {
        Args: {
          limit_per_catalog?: number
          material_text: string
          p_org_id?: string
        }
        Returns: {
          catalog_id: string
          catalog_key: string
          descripcion: string
          es_preferido: boolean
          familia: string
          marca: string
          margen_pct: number
          motivo: string
          precio_coste: number
          precio_venta: number
          product_id: string
          ref_proveedor: string
          score: number
          supplier_name: string
          unidad: string
        }[]
      }
      seed_org_catalog: { Args: { new_org_id: string }; Returns: undefined }
      seed_universal_products_from_global_catalog: {
        Args: never
        Returns: number
      }
      select_offering_for_cart_item: {
        Args: { p_item_id: string; p_offering_id: string }
        Returns: undefined
      }
      set_idempotency_record: {
        Args: {
          p_actor_id: string
          p_endpoint: string
          p_key: string
          p_request_hash: string
          p_response_body: Json
          p_response_status: number
        }
        Returns: undefined
      }
      ship_supplier_order: {
        Args: {
          p_notas?: string
          p_order_id: string
          p_source?: string
          p_tracking?: string
          p_tracking_url?: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_transport_service: {
        Args: {
          p_hora_inicio_real?: string
          p_obs_inicio?: string
          p_odometro_inicio?: number
          p_org_id: string
          p_service_id: string
        }
        Returns: Json
      }
      submit_ad_creative_for_review: {
        Args: { p_creative_id: string }
        Returns: undefined
      }
      submit_job_review: {
        Args: { p_comentario?: string; p_rating: number; p_token: string }
        Returns: undefined
      }
      sync_platform_invoice_to_financial_manual: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      transfer_marketplace_ownership: {
        Args: { p_actor_id: string; p_new_owner_user_id: string }
        Returns: undefined
      }
      unmatch_offering: { Args: { p_offering_id: string }; Returns: undefined }
      update_actuacion_learned:
        | {
            Args: {
              p_actuacion_id: string
              p_new_keywords: string[]
              p_new_partidas: string[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_actuacion_id: string
              p_new_keywords: string[]
              p_new_partidas: string[]
              p_oficio: string
              p_score: number
              p_transcript: string
            }
            Returns: Json
          }
      update_cart_item: {
        Args: {
          p_activo?: boolean
          p_cantidad?: number
          p_descripcion?: string
          p_item_id: string
          p_unidad?: string
        }
        Returns: undefined
      }
      update_offering_image: {
        Args: { p_actor_id: string; p_image_url: string; p_offering_id: string }
        Returns: undefined
      }
      update_supplier_offering: {
        Args: {
          p_activa?: boolean
          p_actor_id?: string
          p_descripcion_comercial?: string
          p_offering_id: string
          p_plazo_entrega_dias?: number
          p_precio_coste?: number
          p_precio_venta?: number
          p_stock_cantidad?: number
          p_stock_disponible?: boolean
          p_unidad?: string
        }
        Returns: undefined
      }
      update_team_member_role: {
        Args: { p_actor_id: string; p_member_id: string; p_role_id: string }
        Returns: undefined
      }
      update_transport_location: {
        Args: {
          p_field: string
          p_geo_source: string
          p_lat: number
          p_lng: number
          p_service_id: string
        }
        Returns: undefined
      }
      update_transport_stop_location: {
        Args: {
          p_geo_source: string
          p_lat: number
          p_lng: number
          p_service_id: string
          p_stop_index: number
        }
        Returns: undefined
      }
      update_transport_trip_location: {
        Args: {
          p_address_text?: string
          p_field: string
          p_geo_source: string
          p_lat: number
          p_lng: number
          p_trip_id: string
        }
        Returns: undefined
      }
      upsert_catalog_offerings_chunk: {
        Args: {
          p_actor_id: string
          p_archivo_hash: string
          p_chunk_hash: string
          p_chunk_index: number
          p_import_id: string
          p_items: Json
        }
        Returns: Json
      }
      upsert_partida_aprendida: {
        Args: {
          p_descripcion: string
          p_oficio?: string
          p_org_id: string
          p_precio_unitario: number
          p_tipo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      location_tipo: "tienda" | "almacen" | "delegacion" | "punto_recogida"
      promo_scope: "national" | "regional" | "local"
      promo_tipo:
        | "descuento_porcentaje"
        | "pack_ahorro"
        | "envio_gratis"
        | "recogida_gratis"
        | "local_discount"
        | "clearance"
        | "discontinued"
        | "local_campaign"
        | "excess_stock"
        | "novedad"
        | "destacado_home"
        | "destacado_perfil"
      stock_local_status:
        | "disponible"
        | "disponible_hoy"
        | "bajo_pedido"
        | "sin_stock"
        | "discontinuado"
      tipo_carga_mercancias:
        | "paletizado"
        | "carga_general"
        | "frigorifica"
        | "peligrosas"
        | "especial"
        | "otro"
    }
    CompositeTypes: {
      transport_projection_row: {
        fecha: string | null
        sentido: string | null
        status: string | null
        service_id: string | null
        exception_tipo: string | null
        exception_motivo: string | null
        hora_salida: string | null
        hora_llegada: string | null
        conductor_id: string | null
        vehicle_id: string | null
        origen: Json | null
        destino: Json | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      location_tipo: ["tienda", "almacen", "delegacion", "punto_recogida"],
      promo_scope: ["national", "regional", "local"],
      promo_tipo: [
        "descuento_porcentaje",
        "pack_ahorro",
        "envio_gratis",
        "recogida_gratis",
        "local_discount",
        "clearance",
        "discontinued",
        "local_campaign",
        "excess_stock",
        "novedad",
        "destacado_home",
        "destacado_perfil",
      ],
      stock_local_status: [
        "disponible",
        "disponible_hoy",
        "bajo_pedido",
        "sin_stock",
        "discontinuado",
      ],
      tipo_carga_mercancias: [
        "paletizado",
        "carga_general",
        "frigorifica",
        "peligrosas",
        "especial",
        "otro",
      ],
    },
  },
} as const
