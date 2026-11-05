
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "analitica": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "carga_por_persona":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyecto"?: string }; Returns: {
              "capacidad": number,"horas_asignadas": number,"horas_atrasadas": number,"semana": string,"tareas_sin_estimar": number,"tareas_sin_fecha": number,"usuario_id": string
            }[]
                           },
"consumo_presupuesto":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "avance": number,"horas": number,"n": number,"porcentaje": number,"presupuestadas": number,"proyecto_id": string
            }[]
                           },
"cuellos_de_botella":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "estado": string,"mediana_horas": number,"n": number,"tareas_ahora": number,"trabadas": number
            }[]
                           },
"cumplimiento_plazos":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "a_tiempo": number,"n": number,"porcentaje": number,"tarde": number
            }[]
                           },
"horas_por_periodo":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "horas": number,"n": number,"periodo": string,"proyecto_id": string,"usuario_id": string
            }[]
                           },
"precision_estimacion":
{ Args: { "p_desde": string,"p_hasta": string,"p_por"?: string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "mediana_ratio": number,"n": number,"proyecto_id": string,"usuario_id": string
            }[]
                           },
"rendimiento":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "n": number,"semana": string,"tareas_hechas": number
            }[]
                           },
"tareas_trabadas":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "asignado_id": string,"estado": string,"horas_en_estado": number,"proyecto_id": string,"tarea_id": string,"umbral_horas": number
            }[]
                           },
"tiempo_en_estado":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "estado": string,"mediana_horas": number,"n": number,"p85_horas": number
            }[]
                           },
"tiempos_de_ciclo":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "mediana_ciclo_horas": number,"mediana_lead_horas": number,"n": number,"n_ciclo": number
            }[]
                           },
"trabajo_en_curso":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "en_curso": number,"en_revision": number,"n": number,"usuario_id": string
            }[]
                           },
"utilizacion":
{ Args: { "p_desde": string,"p_hasta": string,"p_proyectos"?: (string)[],"p_usuarios"?: (string)[] }; Returns: {
              "capacidad": number,"horas": number,"n": number,"porcentaje": number,"usuario_id": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "comentarios": {
                  Row: {
                    "autor_id": string,"creado_en": string,"cuerpo": string,"editado_en": string | null,"eliminado_en": string | null,"id": string,"organizacion_id": string,"tarea_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id": string,"creado_en"?: string,"cuerpo": string,"editado_en"?: string | null,"eliminado_en"?: string | null,"id"?: string,"organizacion_id": string,"tarea_id": string
                  }
                  Update: {
                    "autor_id"?: string,"creado_en"?: string,"cuerpo"?: string,"editado_en"?: string | null,"eliminado_en"?: string | null,"id"?: string,"organizacion_id"?: string,"tarea_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comentarios_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comentarios_organizacion_id_tarea_id_fkey"
      columns: ["organizacion_id","tarea_id"]
isOneToOne: false
      referencedRelation: "tareas"
      referencedColumns: ["organizacion_id","id"]
    }
                  ]
                },"invitaciones": {
                  Row: {
                    "aceptada_en": string | null,"creado_en": string,"email": string,"id": string,"invitado_por": string | null,"organizacion_id": string,"revocada_en": string | null,"rol": string,"token_hash": string,"vence_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada_en"?: string | null,"creado_en"?: string,"email": string,"id"?: string,"invitado_por"?: string | null,"organizacion_id": string,"revocada_en"?: string | null,"rol"?: string,"token_hash": string,"vence_en"?: string
                  }
                  Update: {
                    "aceptada_en"?: string | null,"creado_en"?: string,"email"?: string,"id"?: string,"invitado_por"?: string | null,"organizacion_id"?: string,"revocada_en"?: string | null,"rol"?: string,"token_hash"?: string,"vence_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitaciones_invitado_por_fkey"
      columns: ["invitado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitaciones_organizacion_id_fkey"
      columns: ["organizacion_id"]
isOneToOne: false
      referencedRelation: "organizaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"miembros": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"creado_en": string,"horas_semanales": number,"id": string,"organizacion_id": string,"rol": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"horas_semanales"?: number,"id"?: string,"organizacion_id": string,"rol"?: string,"usuario_id": string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"horas_semanales"?: number,"id"?: string,"organizacion_id"?: string,"rol"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "miembros_organizacion_id_fkey"
      columns: ["organizacion_id"]
isOneToOne: false
      referencedRelation: "organizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "miembros_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizaciones": {
                  Row: {
                    "actualizado_en": string,"color_acento": string | null,"creado_en": string,"creado_por": string | null,"id": string,"logo_url": string | null,"nombre": string,"zona_horaria": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"color_acento"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"id"?: string,"logo_url"?: string | null,"nombre": string,"zona_horaria"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"color_acento"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"id"?: string,"logo_url"?: string | null,"nombre"?: string,"zona_horaria"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfiles": {
                  Row: {
                    "actualizado_en": string,"avatar_url": string | null,"creado_en": string,"email": string | null,"id": string,"nombre_completo": string,"organizacion_activa_id": string | null,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"avatar_url"?: string | null,"creado_en"?: string,"email"?: string | null,"id": string,"nombre_completo": string,"organizacion_activa_id"?: string | null,"telefono"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"avatar_url"?: string | null,"creado_en"?: string,"email"?: string | null,"id"?: string,"nombre_completo"?: string,"organizacion_activa_id"?: string | null,"telefono"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfiles_organizacion_activa_id_fkey"
      columns: ["organizacion_activa_id"]
isOneToOne: false
      referencedRelation: "organizaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"proyecto_miembros": {
                  Row: {
                    "creado_en": string,"organizacion_id": string,"proyecto_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"organizacion_id": string,"proyecto_id": string,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"organizacion_id"?: string,"proyecto_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proyecto_miembros_organizacion_id_proyecto_id_fkey"
      columns: ["organizacion_id","proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["organizacion_id","id"]
    },{
      foreignKeyName: "proyecto_miembros_organizacion_id_usuario_id_fkey"
      columns: ["organizacion_id","usuario_id"]
isOneToOne: false
      referencedRelation: "miembros"
      referencedColumns: ["organizacion_id","usuario_id"]
    }
                  ]
                },"proyectos": {
                  Row: {
                    "actualizado_en": string,"cliente": string | null,"creado_en": string,"creado_por": string | null,"descripcion": string | null,"eliminado_en": string | null,"estado": string,"fecha_fin_objetivo": string | null,"fecha_inicio": string | null,"horas_presupuestadas": number | null,"id": string,"nombre": string,"organizacion_id": string,"responsable_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"cliente"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"eliminado_en"?: string | null,"estado"?: string,"fecha_fin_objetivo"?: string | null,"fecha_inicio"?: string | null,"horas_presupuestadas"?: number | null,"id"?: string,"nombre": string,"organizacion_id": string,"responsable_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"cliente"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"eliminado_en"?: string | null,"estado"?: string,"fecha_fin_objetivo"?: string | null,"fecha_inicio"?: string | null,"horas_presupuestadas"?: number | null,"id"?: string,"nombre"?: string,"organizacion_id"?: string,"responsable_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proyectos_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proyectos_organizacion_id_fkey"
      columns: ["organizacion_id"]
isOneToOne: false
      referencedRelation: "organizaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proyectos_organizacion_id_responsable_id_fkey"
      columns: ["organizacion_id","responsable_id"]
isOneToOne: false
      referencedRelation: "miembros"
      referencedColumns: ["organizacion_id","usuario_id"]
    }
                  ]
                },"registros_tiempo": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"fecha": string,"fin": string | null,"id": string,"inicio": string | null,"minutos": number | null,"nota": string | null,"organizacion_id": string,"origen": string,"proyecto_id": string,"tarea_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"fecha": string,"fin"?: string | null,"id"?: string,"inicio"?: string | null,"minutos"?: number | null,"nota"?: string | null,"organizacion_id": string,"origen": string,"proyecto_id": string,"tarea_id": string,"usuario_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"fecha"?: string,"fin"?: string | null,"id"?: string,"inicio"?: string | null,"minutos"?: number | null,"nota"?: string | null,"organizacion_id"?: string,"origen"?: string,"proyecto_id"?: string,"tarea_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registros_tiempo_organizacion_id_tarea_id_fkey"
      columns: ["organizacion_id","tarea_id"]
isOneToOne: false
      referencedRelation: "tareas"
      referencedColumns: ["organizacion_id","id"]
    },{
      foreignKeyName: "registros_tiempo_organizacion_id_usuario_id_fkey"
      columns: ["organizacion_id","usuario_id"]
isOneToOne: false
      referencedRelation: "miembros"
      referencedColumns: ["organizacion_id","usuario_id"]
    }
                  ]
                },"tarea_dependencias": {
                  Row: {
                    "creado_en": string,"depende_de_id": string,"desfase_dias": number,"organizacion_id": string,"tarea_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"depende_de_id": string,"desfase_dias"?: number,"organizacion_id": string,"tarea_id": string
                  }
                  Update: {
                    "creado_en"?: string,"depende_de_id"?: string,"desfase_dias"?: number,"organizacion_id"?: string,"tarea_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tarea_dependencias_organizacion_id_depende_de_id_fkey"
      columns: ["organizacion_id","depende_de_id"]
isOneToOne: false
      referencedRelation: "tareas"
      referencedColumns: ["organizacion_id","id"]
    },{
      foreignKeyName: "tarea_dependencias_organizacion_id_tarea_id_fkey"
      columns: ["organizacion_id","tarea_id"]
isOneToOne: false
      referencedRelation: "tareas"
      referencedColumns: ["organizacion_id","id"]
    }
                  ]
                },"tarea_historial_estados": {
                  Row: {
                    "cambiado_en": string,"cambiado_por": string | null,"estado_anterior": string | null,"estado_nuevo": string,"id": number,"organizacion_id": string,"proyecto_id": string,"tarea_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cambiado_en"?: string,"cambiado_por"?: string | null,"estado_anterior"?: string | null,"estado_nuevo": string,"id"?: never,"organizacion_id": string,"proyecto_id": string,"tarea_id": string
                  }
                  Update: {
                    "cambiado_en"?: string,"cambiado_por"?: string | null,"estado_anterior"?: string | null,"estado_nuevo"?: string,"id"?: never,"organizacion_id"?: string,"proyecto_id"?: string,"tarea_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tarea_historial_estados_cambiado_por_fkey"
      columns: ["cambiado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tarea_historial_estados_organizacion_id_tarea_id_fkey"
      columns: ["organizacion_id","tarea_id"]
isOneToOne: false
      referencedRelation: "tareas"
      referencedColumns: ["organizacion_id","id"]
    }
                  ]
                },"tareas": {
                  Row: {
                    "actualizado_en": string,"asignado_id": string | null,"completada_en": string | null,"creado_en": string,"creado_por": string | null,"descripcion": string | null,"eliminado_en": string | null,"estado": string,"fecha_inicio": string | null,"fecha_limite": string | null,"horas_estimadas": number | null,"id": string,"organizacion_id": string,"posicion": number,"prioridad": string,"proyecto_id": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"asignado_id"?: string | null,"completada_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"eliminado_en"?: string | null,"estado"?: string,"fecha_inicio"?: string | null,"fecha_limite"?: string | null,"horas_estimadas"?: number | null,"id"?: string,"organizacion_id": string,"posicion"?: number,"prioridad"?: string,"proyecto_id": string,"titulo": string
                  }
                  Update: {
                    "actualizado_en"?: string,"asignado_id"?: string | null,"completada_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"eliminado_en"?: string | null,"estado"?: string,"fecha_inicio"?: string | null,"fecha_limite"?: string | null,"horas_estimadas"?: number | null,"id"?: string,"organizacion_id"?: string,"posicion"?: number,"prioridad"?: string,"proyecto_id"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tareas_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_organizacion_id_asignado_id_fkey"
      columns: ["organizacion_id","asignado_id"]
isOneToOne: false
      referencedRelation: "miembros"
      referencedColumns: ["organizacion_id","usuario_id"]
    },{
      foreignKeyName: "tareas_organizacion_id_proyecto_id_fkey"
      columns: ["organizacion_id","proyecto_id"]
isOneToOne: false
      referencedRelation: "proyectos"
      referencedColumns: ["organizacion_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "aceptar_invitacion":
{ Args: { "p_token_hash": string,"p_usuario": string }; Returns: string
                           },
"conflictos_dependencias":
{ Args: { "p_proyecto"?: string }; Returns: {
              "arranca_el": string,"debe_arrancar_desde": string,"depende_de_id": string,"tarea_id": string
            }[]
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"descartar_temporizador":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"detener_temporizador":
{ Args: { "p_minutos"?: number,"p_nota"?: string }; Returns: {
              "actualizado_en": string,
"creado_en": string,
"fecha": string,
"fin": string | null,
"id": string,
"inicio": string | null,
"minutos": number | null,
"nota": string | null,
"organizacion_id": string,
"origen": string,
"proyecto_id": string,
"tarea_id": string,
"usuario_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "registros_tiempo"
        isOneToOne: true
        isSetofReturn: false
      } },
"eliminar_comentario":
{ Args: { "p_id": string }; Returns: undefined
                           },
"iniciar_temporizador":
{ Args: { "p_tarea": string }; Returns: {
              "actualizado_en": string,
"creado_en": string,
"fecha": string,
"fin": string | null,
"id": string,
"inicio": string | null,
"minutos": number | null,
"nota": string | null,
"organizacion_id": string,
"origen": string,
"proyecto_id": string,
"tarea_id": string,
"usuario_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "registros_tiempo"
        isOneToOne: true
        isSetofReturn: false
      } },
"invitacion_por_token":
{ Args: { "p_token_hash": string }; Returns: {
              "aceptada_en": string,"email": string,"id": string,"organizacion_nombre": string,"revocada_en": string,"rol": string,"usuario_existe": boolean,"vence_en": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "analitica": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
