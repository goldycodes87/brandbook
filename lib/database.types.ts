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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      animals: {
        Row: {
          age_class: string | null
          birth_type: string | null
          birth_weight_lbs: number | null
          brand_photo: string | null
          breed: string | null
          breed_percentage: number | null
          breeds: Json | null
          conception_method: string | null
          created_at: string | null
          dam_id: string | null
          dob: string | null
          donor_dam_id: string | null
          ear_tag_color: string | null
          ear_tag_number: string | null
          id: string
          name: string | null
          notes: string | null
          owner_id: string | null
          photos: string[] | null
          purchase_date: string | null
          purchase_price: number | null
          ranch_id: string | null
          registration_numbers: Json | null
          sex: Database["public"]["Enums"]["animal_sex"] | null
          sire_id: string | null
          status: Database["public"]["Enums"]["animal_status"] | null
          tag_number: string
          updated_at: string | null
          vendor: string | null
          vigor_score: number | null
          weaning_date: string | null
          weaning_weight_lbs: number | null
        }
        Insert: {
          age_class?: string | null
          birth_type?: string | null
          birth_weight_lbs?: number | null
          brand_photo?: string | null
          breed?: string | null
          breed_percentage?: number | null
          breeds?: Json | null
          conception_method?: string | null
          created_at?: string | null
          dam_id?: string | null
          dob?: string | null
          donor_dam_id?: string | null
          ear_tag_color?: string | null
          ear_tag_number?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          photos?: string[] | null
          purchase_date?: string | null
          purchase_price?: number | null
          ranch_id?: string | null
          registration_numbers?: Json | null
          sex?: Database["public"]["Enums"]["animal_sex"] | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["animal_status"] | null
          tag_number: string
          updated_at?: string | null
          vendor?: string | null
          vigor_score?: number | null
          weaning_date?: string | null
          weaning_weight_lbs?: number | null
        }
        Update: {
          age_class?: string | null
          birth_type?: string | null
          birth_weight_lbs?: number | null
          brand_photo?: string | null
          breed?: string | null
          breed_percentage?: number | null
          breeds?: Json | null
          conception_method?: string | null
          created_at?: string | null
          dam_id?: string | null
          dob?: string | null
          donor_dam_id?: string | null
          ear_tag_color?: string | null
          ear_tag_number?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          photos?: string[] | null
          purchase_date?: string | null
          purchase_price?: number | null
          ranch_id?: string | null
          registration_numbers?: Json | null
          sex?: Database["public"]["Enums"]["animal_sex"] | null
          sire_id?: string | null
          status?: Database["public"]["Enums"]["animal_status"] | null
          tag_number?: string
          updated_at?: string | null
          vendor?: string | null
          vigor_score?: number | null
          weaning_date?: string | null
          weaning_weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "animals_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_donor_dam_id_fkey"
            columns: ["donor_dam_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_id: string | null
          author_role: Database["public"]["Enums"]["user_role"]
          case_id: string
          created_at: string | null
          id: string
          note: string
          photo_urls: string[] | null
        }
        Insert: {
          author_id?: string | null
          author_role: Database["public"]["Enums"]["user_role"]
          case_id: string
          created_at?: string | null
          id?: string
          note: string
          photo_urls?: string[] | null
        }
        Update: {
          author_id?: string | null
          author_role?: Database["public"]["Enums"]["user_role"]
          case_id?: string
          created_at?: string | null
          id?: string
          note?: string
          photo_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vet_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          animal_id: string | null
          created_at: string | null
          field_id: string | null
          id: string
          value: string | null
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          field_id?: string | null
          id?: string
          value?: string | null
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          field_id?: string | null
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to: string
          created_at: string | null
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          options: Json | null
          sort_order: number | null
        }
        Insert: {
          applies_to?: string
          created_at?: string | null
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          options?: Json | null
          sort_order?: number | null
        }
        Update: {
          applies_to?: string
          created_at?: string | null
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          options?: Json | null
          sort_order?: number | null
        }
        Relationships: []
      }
      drug_library: {
        Row: {
          approved_at: string | null
          barcode: string | null
          brand_name: string
          community_status: string | null
          created_at: string | null
          dosage_info: string | null
          drug_class: string | null
          generic_name: string | null
          id: string
          is_active: boolean | null
          manufacturer: string | null
          ndc_code: string | null
          notes: string | null
          ranch_id: string | null
          route: string | null
          source: string | null
          species: string[] | null
          submitted_by: string | null
          use_count: number | null
          withdrawal_days_meat: number | null
          withdrawal_days_milk: number | null
        }
        Insert: {
          approved_at?: string | null
          barcode?: string | null
          brand_name: string
          community_status?: string | null
          created_at?: string | null
          dosage_info?: string | null
          drug_class?: string | null
          generic_name?: string | null
          id?: string
          is_active?: boolean | null
          manufacturer?: string | null
          ndc_code?: string | null
          notes?: string | null
          ranch_id?: string | null
          route?: string | null
          source?: string | null
          species?: string[] | null
          submitted_by?: string | null
          use_count?: number | null
          withdrawal_days_meat?: number | null
          withdrawal_days_milk?: number | null
        }
        Update: {
          approved_at?: string | null
          barcode?: string | null
          brand_name?: string
          community_status?: string | null
          created_at?: string | null
          dosage_info?: string | null
          drug_class?: string | null
          generic_name?: string | null
          id?: string
          is_active?: boolean | null
          manufacturer?: string | null
          ndc_code?: string | null
          notes?: string | null
          ranch_id?: string | null
          route?: string | null
          source?: string | null
          species?: string[] | null
          submitted_by?: string | null
          use_count?: number | null
          withdrawal_days_meat?: number | null
          withdrawal_days_milk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_library_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      embryo_inventory: {
        Row: {
          created_at: string | null
          donor_dam_id: string | null
          flush_date: string | null
          grade: number | null
          id: string
          is_frozen: boolean | null
          notes: string | null
          recipient_id: string | null
          sire_id: string | null
          transferred_at: string | null
        }
        Insert: {
          created_at?: string | null
          donor_dam_id?: string | null
          flush_date?: string | null
          grade?: number | null
          id?: string
          is_frozen?: boolean | null
          notes?: string | null
          recipient_id?: string | null
          sire_id?: string | null
          transferred_at?: string | null
        }
        Update: {
          created_at?: string | null
          donor_dam_id?: string | null
          flush_date?: string | null
          grade?: number | null
          id?: string
          is_frozen?: boolean | null
          notes?: string | null
          recipient_id?: string | null
          sire_id?: string | null
          transferred_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embryo_inventory_donor_dam_id_fkey"
            columns: ["donor_dam_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embryo_inventory_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embryo_inventory_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          amount: number | null
          category: string
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          notes: string | null
          per_head_allocation: Json | null
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          category: string
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          per_head_allocation?: Json | null
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          category?: string
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          per_head_allocation?: Json | null
          vendor?: string | null
        }
        Relationships: []
      }
      grazing_assignments: {
        Row: {
          animal_id: string
          created_at: string | null
          end_date: string | null
          id: string
          lease_id: string
          start_date: string
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          lease_id: string
          start_date: string
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          lease_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "grazing_assignments_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grazing_assignments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      grazing_owners: {
        Row: {
          billing_rate: number | null
          billing_type: string | null
          brand_photo: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          billing_rate?: number | null
          billing_type?: string | null
          brand_photo?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          billing_rate?: number | null
          billing_type?: string | null
          brand_photo?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grazing_owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_event_batches: {
        Row: {
          administered_by: string | null
          animal_count: number | null
          batch_name: string | null
          created_at: string | null
          dose_amount: number | null
          dose_unit: string | null
          drug_id: string | null
          drug_name: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          group_filter: Json | null
          group_type: string
          id: string
          notes: string | null
          withdrawal_days: number | null
        }
        Insert: {
          administered_by?: string | null
          animal_count?: number | null
          batch_name?: string | null
          created_at?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          drug_id?: string | null
          drug_name?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          group_filter?: Json | null
          group_type: string
          id?: string
          notes?: string | null
          withdrawal_days?: number | null
        }
        Update: {
          administered_by?: string | null
          animal_count?: number | null
          batch_name?: string | null
          created_at?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          drug_id?: string | null
          drug_name?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["health_event_type"]
          group_filter?: Json | null
          group_type?: string
          id?: string
          notes?: string | null
          withdrawal_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_event_batches_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_library"
            referencedColumns: ["id"]
          },
        ]
      }
      health_events: {
        Row: {
          administered_by: string | null
          animal_id: string
          bcs_score: number | null
          created_at: string | null
          dose_amount: number | null
          dose_unit: string | null
          drug_name: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          id: string
          notes: string | null
          withdrawal_clear_date: string | null
          withdrawal_days: number | null
        }
        Insert: {
          administered_by?: string | null
          animal_id: string
          bcs_score?: number | null
          created_at?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          drug_name?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          id?: string
          notes?: string | null
          withdrawal_clear_date?: string | null
          withdrawal_days?: number | null
        }
        Update: {
          administered_by?: string | null
          animal_id?: string
          bcs_score?: number | null
          created_at?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          drug_name?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["health_event_type"]
          id?: string
          notes?: string | null
          withdrawal_clear_date?: string | null
          withdrawal_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          expense_splits: Json | null
          id: string
          line_items: Json | null
          owner_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id: string | null
          total_amount: number | null
        }
        Insert: {
          created_at?: string | null
          expense_splits?: Json | null
          id?: string
          line_items?: Json | null
          owner_id: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          total_amount?: number | null
        }
        Update: {
          created_at?: string | null
          expense_splits?: Json | null
          id?: string
          line_items?: Json | null
          owner_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          acreage: number | null
          created_at: string | null
          end_date: string | null
          flat_rate: number | null
          id: string
          landowner_email: string | null
          landowner_name: string | null
          landowner_phone: string | null
          legal_description: string | null
          notes: string | null
          parcel_id: string | null
          property_name: string
          rate_per_acre: number | null
          renewal_alert_days: number | null
          start_date: string | null
        }
        Insert: {
          acreage?: number | null
          created_at?: string | null
          end_date?: string | null
          flat_rate?: number | null
          id?: string
          landowner_email?: string | null
          landowner_name?: string | null
          landowner_phone?: string | null
          legal_description?: string | null
          notes?: string | null
          parcel_id?: string | null
          property_name: string
          rate_per_acre?: number | null
          renewal_alert_days?: number | null
          start_date?: string | null
        }
        Update: {
          acreage?: number | null
          created_at?: string | null
          end_date?: string | null
          flat_rate?: number | null
          id?: string
          landowner_email?: string | null
          landowner_name?: string | null
          landowner_phone?: string | null
          legal_description?: string | null
          notes?: string | null
          parcel_id?: string | null
          property_name?: string
          rate_per_acre?: number | null
          renewal_alert_days?: number | null
          start_date?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          alert_lead_days: number | null
          calving_reminders: boolean | null
          created_at: string | null
          dashboard_stats: Json | null
          email_notifications: boolean | null
          id: string
          lease_renewal_alerts: boolean | null
          profile_id: string | null
          push_notifications: boolean | null
          weight_reminders: boolean | null
          withdrawal_alerts: boolean | null
        }
        Insert: {
          alert_lead_days?: number | null
          calving_reminders?: boolean | null
          created_at?: string | null
          dashboard_stats?: Json | null
          email_notifications?: boolean | null
          id?: string
          lease_renewal_alerts?: boolean | null
          profile_id?: string | null
          push_notifications?: boolean | null
          weight_reminders?: boolean | null
          withdrawal_alerts?: boolean | null
        }
        Update: {
          alert_lead_days?: number | null
          calving_reminders?: boolean | null
          created_at?: string | null
          dashboard_stats?: Json | null
          email_notifications?: boolean | null
          id?: string
          lease_renewal_alerts?: boolean | null
          profile_id?: string | null
          push_notifications?: boolean | null
          weight_reminders?: boolean | null
          withdrawal_alerts?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          linked_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          linked_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          linked_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          invite_accepted_at: string | null
          invite_token: string | null
          last_seen_at: string | null
          license_number: string | null
          name: string | null
          phone: string | null
          practice_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          vet_notes_count: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          invite_accepted_at?: string | null
          invite_token?: string | null
          last_seen_at?: string | null
          license_number?: string | null
          name?: string | null
          phone?: string | null
          practice_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          vet_notes_count?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_token?: string | null
          last_seen_at?: string | null
          license_number?: string | null
          name?: string | null
          phone?: string | null
          practice_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          vet_notes_count?: number | null
        }
        Relationships: []
      }
      ranch_settings: {
        Row: {
          address: string | null
          brand_photo_url: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          owner_name: string | null
          phone: string | null
          ranch_name: string | null
          state: string | null
          timezone: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          brand_photo_url?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          ranch_name?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          brand_photo_url?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          ranch_name?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      reproduction_events: {
        Row: {
          ai_technician: string | null
          animal_id: string
          breed_method: Database["public"]["Enums"]["breed_method"] | null
          calf_id: string | null
          calving_ease_score: number | null
          conception_method: string | null
          created_at: string | null
          days_bred: number | null
          donor_dam_id: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["repro_event_type"]
          expected_calving_date: string | null
          id: string
          notes: string | null
          preg_check_result: string | null
          sire_id: string | null
          sire_name_text: string | null
          weaning_date: string | null
          weaning_weight_lbs: number | null
        }
        Insert: {
          ai_technician?: string | null
          animal_id: string
          breed_method?: Database["public"]["Enums"]["breed_method"] | null
          calf_id?: string | null
          calving_ease_score?: number | null
          conception_method?: string | null
          created_at?: string | null
          days_bred?: number | null
          donor_dam_id?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["repro_event_type"]
          expected_calving_date?: string | null
          id?: string
          notes?: string | null
          preg_check_result?: string | null
          sire_id?: string | null
          sire_name_text?: string | null
          weaning_date?: string | null
          weaning_weight_lbs?: number | null
        }
        Update: {
          ai_technician?: string | null
          animal_id?: string
          breed_method?: Database["public"]["Enums"]["breed_method"] | null
          calf_id?: string | null
          calving_ease_score?: number | null
          conception_method?: string | null
          created_at?: string | null
          days_bred?: number | null
          donor_dam_id?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["repro_event_type"]
          expected_calving_date?: string | null
          id?: string
          notes?: string | null
          preg_check_result?: string | null
          sire_id?: string | null
          sire_name_text?: string | null
          weaning_date?: string | null
          weaning_weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reproduction_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reproduction_events_calf_id_fkey"
            columns: ["calf_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reproduction_events_donor_dam_id_fkey"
            columns: ["donor_dam_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reproduction_events_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          animal_id: string
          buyer: string | null
          created_at: string | null
          destination: string | null
          gross_proceeds: number | null
          id: string
          notes: string | null
          price_per_lb: number | null
          sale_date: string
          sale_weight_lbs: number | null
        }
        Insert: {
          animal_id: string
          buyer?: string | null
          created_at?: string | null
          destination?: string | null
          gross_proceeds?: number | null
          id?: string
          notes?: string | null
          price_per_lb?: number | null
          sale_date: string
          sale_weight_lbs?: number | null
        }
        Update: {
          animal_id?: string
          buyer?: string | null
          created_at?: string | null
          destination?: string | null
          gross_proceeds?: number | null
          id?: string
          notes?: string | null
          price_per_lb?: number | null
          sale_date?: string
          sale_weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      semen_inventory: {
        Row: {
          created_at: string | null
          id: string
          location: string | null
          notes: string | null
          price_per_straw: number | null
          reg_number: string | null
          sire_name: string
          source: string | null
          straw_count: number | null
          tank_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          price_per_straw?: number | null
          reg_number?: string | null
          sire_name: string
          source?: string | null
          straw_count?: number | null
          tank_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          price_per_straw?: number | null
          reg_number?: string | null
          sire_name?: string
          source?: string | null
          straw_count?: number | null
          tank_id?: string | null
        }
        Relationships: []
      }
      treatment_plans: {
        Row: {
          animal_id: string
          created_at: string | null
          created_by: string | null
          dose_amount: number | null
          dose_unit: string | null
          drug_id: string | null
          drug_name: string
          duration_days: number | null
          end_date: string | null
          follow_up_date: string | null
          frequency: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          created_by?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          drug_id?: string | null
          drug_name: string
          duration_days?: number | null
          end_date?: string | null
          follow_up_date?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          created_by?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          drug_id?: string | null
          drug_name?: string
          duration_days?: number | null
          end_date?: string | null
          follow_up_date?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_library"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_cases: {
        Row: {
          animal_id: string
          created_at: string | null
          description: string | null
          follow_up_date: string | null
          id: string
          photos: string[] | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          vet_id: string | null
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          description?: string | null
          follow_up_date?: string | null
          id?: string
          photos?: string[] | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          vet_id?: string | null
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          description?: string | null
          follow_up_date?: string | null
          id?: string
          photos?: string[] | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_cases_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_cases_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invite_token: string | null
          invited_by: string | null
          name: string | null
          practice_name: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_token?: string | null
          invited_by?: string | null
          name?: string | null
          practice_name?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_token?: string | null
          invited_by?: string | null
          name?: string | null
          practice_name?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_messages: {
        Row: {
          animal_id: string | null
          created_at: string | null
          id: string
          message: string
          photo_urls: string[] | null
          read_at: string | null
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          photo_urls?: string[] | null
          read_at?: string | null
          sender_id?: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          photo_urls?: string[] | null
          read_at?: string | null
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "vet_messages_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weights: {
        Row: {
          animal_id: string
          id: string
          notes: string | null
          source: string | null
          weighed_at: string | null
          weight_lbs: number
        }
        Insert: {
          animal_id: string
          id?: string
          notes?: string | null
          source?: string | null
          weighed_at?: string | null
          weight_lbs: number
        }
        Update: {
          animal_id?: string
          id?: string
          notes?: string | null
          source?: string | null
          weighed_at?: string | null
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "weights_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      animal_sex: "bull" | "cow" | "steer" | "heifer" | "calf"
      animal_status: "active" | "sold" | "deceased" | "transferred"
      breed_method: "natural" | "ai"
      health_event_type:
        | "treatment"
        | "vaccine"
        | "vet_visit"
        | "illness"
        | "bcs_log"
      invoice_status: "draft" | "sent" | "paid"
      repro_event_type:
        | "bred"
        | "preg_check"
        | "calved"
        | "weaned"
        | "flushed"
        | "embryo_transfer"
      user_role: "operator" | "grazing_owner" | "landowner" | "vet"
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
      animal_sex: ["bull", "cow", "steer", "heifer", "calf"],
      animal_status: ["active", "sold", "deceased", "transferred"],
      breed_method: ["natural", "ai"],
      health_event_type: [
        "treatment",
        "vaccine",
        "vet_visit",
        "illness",
        "bcs_log",
      ],
      invoice_status: ["draft", "sent", "paid"],
      repro_event_type: [
        "bred",
        "preg_check",
        "calved",
        "weaned",
        "flushed",
        "embryo_transfer",
      ],
      user_role: ["operator", "grazing_owner", "landowner", "vet"],
    },
  },
} as const
