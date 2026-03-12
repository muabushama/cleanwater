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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      candle_changes: {
        Row: {
          candle1: boolean
          candle2: boolean
          candle3: boolean
          candle4: boolean
          candle5: boolean
          candle6: boolean
          candle7: boolean
          change_date: string
          collected: number
          cost: number
          created_at: string
          customer_id: string
          device_id: string
          id: string
          notes: string | null
          remaining: number
          status: string
          tds_reading: string | null
          technician: string | null
        }
        Insert: {
          candle1?: boolean
          candle2?: boolean
          candle3?: boolean
          candle4?: boolean
          candle5?: boolean
          candle6?: boolean
          candle7?: boolean
          change_date?: string
          collected?: number
          cost?: number
          created_at?: string
          customer_id: string
          device_id: string
          id?: string
          notes?: string | null
          remaining?: number
          status?: string
          tds_reading?: string | null
          technician?: string | null
        }
        Update: {
          candle1?: boolean
          candle2?: boolean
          candle3?: boolean
          candle4?: boolean
          candle5?: boolean
          candle6?: boolean
          candle7?: boolean
          change_date?: string
          collected?: number
          cost?: number
          created_at?: string
          customer_id?: string
          device_id?: string
          id?: string
          notes?: string | null
          remaining?: number
          status?: string
          tds_reading?: string | null
          technician?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candle_changes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candle_changes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "customer_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_devices: {
        Row: {
          ad_source: string | null
          branch: string
          candles: Json
          contract_type: string
          created_at: string
          created_by: string | null
          customer_code: string | null
          customer_id: string
          device_type: string
          first_installment_date: string | null
          id: string
          install_date: string | null
          installment_amount: number
          installments_count: number
          notes: string | null
          product_name: string
          selling_price: number
          serial_number: string | null
          total_price: number
          warranty_months: number
          warranty_status: string
        }
        Insert: {
          ad_source?: string | null
          branch?: string
          candles?: Json
          contract_type?: string
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_id: string
          device_type?: string
          first_installment_date?: string | null
          id?: string
          install_date?: string | null
          installment_amount?: number
          installments_count?: number
          notes?: string | null
          product_name?: string
          selling_price?: number
          serial_number?: string | null
          total_price?: number
          warranty_months?: number
          warranty_status?: string
        }
        Update: {
          ad_source?: string | null
          branch?: string
          candles?: Json
          contract_type?: string
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_id?: string
          device_type?: string
          first_installment_date?: string | null
          id?: string
          install_date?: string | null
          installment_amount?: number
          installments_count?: number
          notes?: string | null
          product_name?: string
          selling_price?: number
          serial_number?: string | null
          total_price?: number
          warranty_months?: number
          warranty_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          branch: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          phone1: string
          phone2: string | null
          region: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string
          branch?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          phone1?: string
          phone2?: string | null
          region?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string
          branch?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone1?: string
          phone2?: string | null
          region?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          collection_date: string | null
          created_at: string
          customer_id: string
          device_id: string
          id: string
          installment_date: string
          status: string
        }
        Insert: {
          amount?: number
          collection_date?: string | null
          created_at?: string
          customer_id: string
          device_id: string
          id?: string
          installment_date: string
          status?: string
        }
        Update: {
          amount?: number
          collection_date?: string | null
          created_at?: string
          customer_id?: string
          device_id?: string
          id?: string
          installment_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "customer_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          branch: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          date: string
          id: string
          invoice_number: string
          paid: number
          product_name: string
          remaining: number
          rep_name: string | null
          status: string
          type: string
        }
        Insert: {
          amount?: number
          branch?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          date?: string
          id?: string
          invoice_number: string
          paid?: number
          product_name?: string
          remaining?: number
          rep_name?: string | null
          status?: string
          type?: string
        }
        Update: {
          amount?: number
          branch?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          date?: string
          id?: string
          invoice_number?: string
          paid?: number
          product_name?: string
          remaining?: number
          rep_name?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          branch: string
          cost: number
          created_at: string
          created_by: string | null
          customer_name: string
          id: string
          next_date: string
          notes: string | null
          phone: string | null
          product_name: string
          status: string
          technician: string | null
          type: string
        }
        Insert: {
          branch?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          customer_name: string
          id?: string
          next_date: string
          notes?: string | null
          phone?: string | null
          product_name?: string
          status?: string
          technician?: string | null
          type?: string
        }
        Update: {
          branch?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string
          id?: string
          next_date?: string
          notes?: string | null
          phone?: string | null
          product_name?: string
          status?: string
          technician?: string | null
          type?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          classification: string
          cost: number
          created_at: string
          discount: number
          id: string
          image: string | null
          min_stock: number
          name: string
          price: number
          price1: number
          price2: number
          price3: number
          stock: number
          warranty: number
        }
        Insert: {
          category?: string
          classification?: string
          cost?: number
          created_at?: string
          discount?: number
          id?: string
          image?: string | null
          min_stock?: number
          name: string
          price?: number
          price1?: number
          price2?: number
          price3?: number
          stock?: number
          warranty?: number
        }
        Update: {
          category?: string
          classification?: string
          cost?: number
          created_at?: string
          discount?: number
          id?: string
          image?: string | null
          min_stock?: number
          name?: string
          price?: number
          price1?: number
          price2?: number
          price3?: number
          stock?: number
          warranty?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      rep_locations: {
        Row: {
          accuracy: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          address: string
          assigned_rep: string | null
          branch: string
          created_at: string
          created_by: string | null
          customer_code: string | null
          customer_id_num: number | null
          customer_name: string
          delivery_status: string
          id: string
          install_date: string | null
          items: Json
          location_url: string | null
          notes: string | null
          order_code: string
          phone: string
          previous_visits: Json
          price1: number
          price2: number
          price3: number
          product_name: string
          region: string | null
          status: string
          technician: string | null
          total: number
          transport_cost: number
          visit_date: string
          visit_time: string | null
          warranty_status: string | null
          warranty_until: string | null
        }
        Insert: {
          address?: string
          assigned_rep?: string | null
          branch?: string
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_id_num?: number | null
          customer_name: string
          delivery_status?: string
          id?: string
          install_date?: string | null
          items?: Json
          location_url?: string | null
          notes?: string | null
          order_code: string
          phone?: string
          previous_visits?: Json
          price1?: number
          price2?: number
          price3?: number
          product_name?: string
          region?: string | null
          status?: string
          technician?: string | null
          total?: number
          transport_cost?: number
          visit_date?: string
          visit_time?: string | null
          warranty_status?: string | null
          warranty_until?: string | null
        }
        Update: {
          address?: string
          assigned_rep?: string | null
          branch?: string
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_id_num?: number | null
          customer_name?: string
          delivery_status?: string
          id?: string
          install_date?: string | null
          items?: Json
          location_url?: string | null
          notes?: string | null
          order_code?: string
          phone?: string
          previous_visits?: Json
          price1?: number
          price2?: number
          price3?: number
          product_name?: string
          region?: string | null
          status?: string
          technician?: string | null
          total?: number
          transport_cost?: number
          visit_date?: string
          visit_time?: string | null
          warranty_status?: string | null
          warranty_until?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sales_rep"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "sales_rep"],
    },
  },
} as const
