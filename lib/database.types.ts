npm warn exec The following package was not found and will be installed: supabase@2.108.0
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
      ai_studs: {
        Row: {
          id: string
          logo_url: string | null
          name: string
          search_url: string | null
          website: string | null
        }
        Insert: {
          id?: string
          logo_url?: string | null
          name: string
          search_url?: string | null
          website?: string | null
        }
        Update: {
          id?: string
          logo_url?: string | null
          name?: string
          search_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      animals: {
        Row: {
          age_class: string | null
          ai_cost: number | null
          approximate_age: string | null
          beef_production_flagged_at: string | null
          birth_type: string | null
          birth_weight_estimated: boolean | null
          birth_weight_lbs: number | null
          brand_photo: string | null
          breed: string | null
          breed_percentage: number | null
          breeds: Json | null
          calf_sex: string | null
          cause_of_death: string | null
          conception_method: string | null
          created_at: string | null
          dam_id: string | null
          disposition: string | null
          disposition_date: string | null
          disposition_notes: string | null
          dob: string | null
          dob_estimated: boolean | null
          donor_dam_id: string | null
          ear_tag_color: string | null
          ear_tag_number: string | null
          embryo_cost: number | null
          fmv_at_transfer: number | null
          id: string
          implant_fee: number | null
          manual_grazing_cost_override: number | null
          name: string | null
          notes: string | null
          origin: string | null
          owner_id: string | null
          pair_animal_id: string | null
          photos: string[] | null
          purchase_date: string | null
          purchase_price: number | null
          purchased_as_pair: boolean | null
          ranch_id: string | null
          registration_numbers: Json | null
          semen_cost: number | null
          sex: Database["public"]["Enums"]["animal_sex"] | null
          sire_id: string | null
          sire_library_id: string | null
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
          ai_cost?: number | null
          approximate_age?: string | null
          beef_production_flagged_at?: string | null
          birth_type?: string | null
          birth_weight_estimated?: boolean | null
          birth_weight_lbs?: number | null
          brand_photo?: string | null
          breed?: string | null
          breed_percentage?: number | null
          breeds?: Json | null
          calf_sex?: string | null
          cause_of_death?: string | null
          conception_method?: string | null
          created_at?: string | null
          dam_id?: string | null
          disposition?: string | null
          disposition_date?: string | null
          disposition_notes?: string | null
          dob?: string | null
          dob_estimated?: boolean | null
          donor_dam_id?: string | null
          ear_tag_color?: string | null
          ear_tag_number?: string | null
          embryo_cost?: number | null
          fmv_at_transfer?: number | null
          id?: string
          implant_fee?: number | null
          manual_grazing_cost_override?: number | null
          name?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          pair_animal_id?: string | null
          photos?: string[] | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchased_as_pair?: boolean | null
          ranch_id?: string | null
          registration_numbers?: Json | null
          semen_cost?: number | null
          sex?: Database["public"]["Enums"]["animal_sex"] | null
          sire_id?: string | null
          sire_library_id?: string | null
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
          ai_cost?: number | null
          approximate_age?: string | null
          beef_production_flagged_at?: string | null
          birth_type?: string | null
          birth_weight_estimated?: boolean | null
          birth_weight_lbs?: number | null
          brand_photo?: string | null
          breed?: string | null
          breed_percentage?: number | null
          breeds?: Json | null
          calf_sex?: string | null
          cause_of_death?: string | null
          conception_method?: string | null
          created_at?: string | null
          dam_id?: string | null
          disposition?: string | null
          disposition_date?: string | null
          disposition_notes?: string | null
          dob?: string | null
          dob_estimated?: boolean | null
          donor_dam_id?: string | null
          ear_tag_color?: string | null
          ear_tag_number?: string | null
          embryo_cost?: number | null
          fmv_at_transfer?: number | null
          id?: string
          implant_fee?: number | null
          manual_grazing_cost_override?: number | null
          name?: string | null
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          pair_animal_id?: string | null
          photos?: string[] | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchased_as_pair?: boolean | null
          ranch_id?: string | null
          registration_numbers?: Json | null
          semen_cost?: number | null
          sex?: Database["public"]["Enums"]["animal_sex"] | null
          sire_id?: string | null
          sire_library_id?: string | null
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
            foreignKeyName: "animals_pair_animal_id_fkey"
            columns: ["pair_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_sire_library_id_fkey"
            columns: ["sire_library_id"]
            isOneToOne: false
            referencedRelation: "sire_library"
            referencedColumns: ["id"]
          },
        ]
      }
      aum_records: {
        Row: {
          animal_id: string
          assignment_id: string | null
          aum_value: number | null
          created_at: string | null
          id: string
          lease_id: string
          notes: string | null
          recorded_date: string
          weight_lbs: number | null
        }
        Insert: {
          animal_id: string
          assignment_id?: string | null
          aum_value?: number | null
          created_at?: string | null
          id?: string
          lease_id: string
          notes?: string | null
          recorded_date?: string
          weight_lbs?: number | null
        }
        Update: {
          animal_id?: string
          assignment_id?: string | null
          aum_value?: number | null
          created_at?: string | null
          id?: string
          lease_id?: string
          notes?: string | null
          recorded_date?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aum_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aum_records_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "grazing_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aum_records_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      beef_inventory: {
        Row: {
          animal_id: string | null
          breed_summary: string | null
          butcher_date_id: string | null
          cost_basis: number | null
          created_at: string | null
          estimated_harvest_weight: number | null
          hanging_weight: number | null
          id: string
          price_per_lb: number | null
          processed_at: string | null
          sale_price: number | null
          status: string | null
          synced_at: string | null
          tag_number: string | null
        }
        Insert: {
          animal_id?: string | null
          breed_summary?: string | null
          butcher_date_id?: string | null
          cost_basis?: number | null
          created_at?: string | null
          estimated_harvest_weight?: number | null
          hanging_weight?: number | null
          id?: string
          price_per_lb?: number | null
          processed_at?: string | null
          sale_price?: number | null
          status?: string | null
          synced_at?: string | null
          tag_number?: string | null
        }
        Update: {
          animal_id?: string | null
          breed_summary?: string | null
          butcher_date_id?: string | null
          cost_basis?: number | null
          created_at?: string | null
          estimated_harvest_weight?: number | null
          hanging_weight?: number | null
          id?: string
          price_per_lb?: number | null
          processed_at?: string | null
          sale_price?: number | null
          status?: string | null
          synced_at?: string | null
          tag_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beef_inventory_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      calf_transfers: {
        Row: {
          animal_id: string | null
          created_at: string | null
          fmv_at_transfer: number | null
          from_owner_id: string | null
          id: string
          notes: string | null
          settlement_id: string | null
          to_owner_id: string | null
          transfer_date: string | null
          transfer_type: string | null
        }
        Insert: {
          animal_id?: string | null
          created_at?: string | null
          fmv_at_transfer?: number | null
          from_owner_id?: string | null
          id?: string
          notes?: string | null
          settlement_id?: string | null
          to_owner_id?: string | null
          transfer_date?: string | null
          transfer_type?: string | null
        }
        Update: {
          animal_id?: string | null
          created_at?: string | null
          fmv_at_transfer?: number | null
          from_owner_id?: string | null
          id?: string
          notes?: string | null
          settlement_id?: string | null
          to_owner_id?: string | null
          transfer_date?: string | null
          transfer_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calf_transfers_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calf_transfers_from_owner_id_fkey"
            columns: ["from_owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calf_transfers_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "grazing_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calf_transfers_to_owner_id_fkey"
            columns: ["to_owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
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
      expense_categories: {
        Row: {
          calculation_type: string | null
          created_at: string | null
          description: string | null
          expense_type: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          calculation_type?: string | null
          created_at?: string | null
          description?: string | null
          expense_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          calculation_type?: string | null
          created_at?: string | null
          description?: string | null
          expense_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
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
          moved_from_lease_id: string | null
          notes: string | null
          start_date: string
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          lease_id: string
          moved_from_lease_id?: string | null
          notes?: string | null
          start_date: string
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          lease_id?: string
          moved_from_lease_id?: string | null
          notes?: string | null
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
          {
            foreignKeyName: "grazing_assignments_moved_from_lease_id_fkey"
            columns: ["moved_from_lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      grazing_contracts: {
        Row: {
          billing_cycle: string | null
          calf_selection_method: string | null
          calf_share_pct: number | null
          calf_share_rounding: string | null
          calf_shortfall_carried: number | null
          calf_transfer_basis: string | null
          carry_forward_shortfall: boolean | null
          created_at: string | null
          death_loss_allowable_pct: number | null
          death_loss_split_threshold_pct: number | null
          effective_date: string | null
          expense_share_method: string | null
          expense_share_pct: number | null
          expiration_date: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          owner_id: string | null
          rate_per_head_month: number | null
          sale_fee_auction_pct: number | null
          sale_fee_private_flat: number | null
          shortfall_from_year: number | null
        }
        Insert: {
          billing_cycle?: string | null
          calf_selection_method?: string | null
          calf_share_pct?: number | null
          calf_share_rounding?: string | null
          calf_shortfall_carried?: number | null
          calf_transfer_basis?: string | null
          carry_forward_shortfall?: boolean | null
          created_at?: string | null
          death_loss_allowable_pct?: number | null
          death_loss_split_threshold_pct?: number | null
          effective_date?: string | null
          expense_share_method?: string | null
          expense_share_pct?: number | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          owner_id?: string | null
          rate_per_head_month?: number | null
          sale_fee_auction_pct?: number | null
          sale_fee_private_flat?: number | null
          shortfall_from_year?: number | null
        }
        Update: {
          billing_cycle?: string | null
          calf_selection_method?: string | null
          calf_share_pct?: number | null
          calf_share_rounding?: string | null
          calf_shortfall_carried?: number | null
          calf_transfer_basis?: string | null
          carry_forward_shortfall?: boolean | null
          created_at?: string | null
          death_loss_allowable_pct?: number | null
          death_loss_split_threshold_pct?: number | null
          effective_date?: string | null
          expense_share_method?: string | null
          expense_share_pct?: number | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          owner_id?: string | null
          rate_per_head_month?: number | null
          sale_fee_auction_pct?: number | null
          sale_fee_private_flat?: number | null
          shortfall_from_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grazing_contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      grazing_owners: {
        Row: {
          address: string | null
          billing_address: string | null
          billing_rate: number | null
          billing_type: string | null
          brand_drawing_url: string | null
          brand_photo: string | null
          brand_photo_url: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          default_breed: string | null
          default_ear_tag_color: string | null
          default_tag_prefix: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_name: string | null
          phone: string | null
          portal_token: string | null
          profile_id: string | null
          state: string | null
          stripe_customer_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: string | null
          billing_rate?: number | null
          billing_type?: string | null
          brand_drawing_url?: string | null
          brand_photo?: string | null
          brand_photo_url?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          default_breed?: string | null
          default_ear_tag_color?: string | null
          default_tag_prefix?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          portal_token?: string | null
          profile_id?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: string | null
          billing_rate?: number | null
          billing_type?: string | null
          brand_drawing_url?: string | null
          brand_photo?: string | null
          brand_photo_url?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          default_breed?: string | null
          default_ear_tag_color?: string | null
          default_tag_prefix?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          portal_token?: string | null
          profile_id?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          zip?: string | null
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
      grazing_periods: {
        Row: {
          animal_ids: string[] | null
          created_at: string | null
          end_date: string
          head_count: number
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          is_paid: boolean | null
          lease_id: string
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          animal_ids?: string[] | null
          created_at?: string | null
          end_date: string
          head_count: number
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          is_paid?: boolean | null
          lease_id: string
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          animal_ids?: string[] | null
          created_at?: string | null
          end_date?: string
          head_count?: number
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          is_paid?: boolean | null
          lease_id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grazing_periods_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grazing_periods_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      grazing_settlements: {
        Row: {
          balance_due_to_operator: number | null
          balance_due_to_owner: number | null
          calf_transfers_fmv: number | null
          calves_born: number | null
          calves_died: number | null
          calves_weaned: number | null
          contract_id: string | null
          created_at: string | null
          dead_calf_fmv_total: number | null
          death_loss_pct: number | null
          death_loss_responsibility: string | null
          expense_splits_total: number | null
          grazing_fees_total: number | null
          gross_calf_sales: number | null
          id: string
          is_settled: boolean | null
          net_calf_proceeds_to_owner: number | null
          operator_calf_share: number | null
          operator_death_loss_share: number | null
          owner_calf_share: number | null
          owner_death_loss_share: number | null
          owner_id: string | null
          pdf_url: string | null
          sale_fees_charged: number | null
          settled_date: string | null
          settlement_notes: string | null
          settlement_year: number | null
          shortfall_carried_forward: number | null
        }
        Insert: {
          balance_due_to_operator?: number | null
          balance_due_to_owner?: number | null
          calf_transfers_fmv?: number | null
          calves_born?: number | null
          calves_died?: number | null
          calves_weaned?: number | null
          contract_id?: string | null
          created_at?: string | null
          dead_calf_fmv_total?: number | null
          death_loss_pct?: number | null
          death_loss_responsibility?: string | null
          expense_splits_total?: number | null
          grazing_fees_total?: number | null
          gross_calf_sales?: number | null
          id?: string
          is_settled?: boolean | null
          net_calf_proceeds_to_owner?: number | null
          operator_calf_share?: number | null
          operator_death_loss_share?: number | null
          owner_calf_share?: number | null
          owner_death_loss_share?: number | null
          owner_id?: string | null
          pdf_url?: string | null
          sale_fees_charged?: number | null
          settled_date?: string | null
          settlement_notes?: string | null
          settlement_year?: number | null
          shortfall_carried_forward?: number | null
        }
        Update: {
          balance_due_to_operator?: number | null
          balance_due_to_owner?: number | null
          calf_transfers_fmv?: number | null
          calves_born?: number | null
          calves_died?: number | null
          calves_weaned?: number | null
          contract_id?: string | null
          created_at?: string | null
          dead_calf_fmv_total?: number | null
          death_loss_pct?: number | null
          death_loss_responsibility?: string | null
          expense_splits_total?: number | null
          grazing_fees_total?: number | null
          gross_calf_sales?: number | null
          id?: string
          is_settled?: boolean | null
          net_calf_proceeds_to_owner?: number | null
          operator_calf_share?: number | null
          operator_death_loss_share?: number | null
          owner_calf_share?: number | null
          owner_death_loss_share?: number | null
          owner_id?: string | null
          pdf_url?: string | null
          sale_fees_charged?: number | null
          settled_date?: string | null
          settlement_notes?: string | null
          settlement_year?: number | null
          shortfall_carried_forward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grazing_settlements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "grazing_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grazing_settlements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
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
      invoice_expenses: {
        Row: {
          category_id: string | null
          category_name: string
          created_at: string | null
          description: string | null
          expense_date: string | null
          id: string
          invoice_id: string
          owner_amount: number | null
          receipt_url: string | null
          split_type: string
          split_value: number
          total_amount: number
        }
        Insert: {
          category_id?: string | null
          category_name: string
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          invoice_id: string
          owner_amount?: number | null
          receipt_url?: string | null
          split_type?: string
          split_value: number
          total_amount: number
        }
        Update: {
          category_id?: string | null
          category_name?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          invoice_id?: string
          owner_amount?: number | null
          receipt_url?: string | null
          split_type?: string
          split_value?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          due_date: string | null
          email_sent_at: string | null
          expense_splits: Json | null
          id: string
          invoice_number: string | null
          invoice_quarter: number | null
          invoice_sequence: number | null
          line_items: Json | null
          notes: string | null
          owner_id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          square_payment_link: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id: string | null
          total_amount: number | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          email_sent_at?: string | null
          expense_splits?: Json | null
          id?: string
          invoice_number?: string | null
          invoice_quarter?: number | null
          invoice_sequence?: number | null
          line_items?: Json | null
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          square_payment_link?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          total_amount?: number | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
          email_sent_at?: string | null
          expense_splits?: Json | null
          id?: string
          invoice_number?: string | null
          invoice_quarter?: number | null
          invoice_sequence?: number | null
          line_items?: Json | null
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          square_payment_link?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          total_amount?: number | null
          viewed_at?: string | null
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
      lease_expenses: {
        Row: {
          animal_id: string | null
          bull_name: string | null
          category_id: string | null
          category_name: string
          created_at: string | null
          description: string | null
          expense_date: string | null
          expense_type: string | null
          id: string
          include_calves: boolean | null
          lease_id: string
          notes: string | null
          owner_id: string | null
          period_end: string | null
          period_start: string | null
          qty: number | null
          quarter: number | null
          receipt_url: string | null
          sire_library_id: string | null
          total_amount: number
          unit_cost: number | null
          year: number | null
        }
        Insert: {
          animal_id?: string | null
          bull_name?: string | null
          category_id?: string | null
          category_name: string
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          expense_type?: string | null
          id?: string
          include_calves?: boolean | null
          lease_id: string
          notes?: string | null
          owner_id?: string | null
          period_end?: string | null
          period_start?: string | null
          qty?: number | null
          quarter?: number | null
          receipt_url?: string | null
          sire_library_id?: string | null
          total_amount: number
          unit_cost?: number | null
          year?: number | null
        }
        Update: {
          animal_id?: string | null
          bull_name?: string | null
          category_id?: string | null
          category_name?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          expense_type?: string | null
          id?: string
          include_calves?: boolean | null
          lease_id?: string
          notes?: string | null
          owner_id?: string | null
          period_end?: string | null
          period_start?: string | null
          qty?: number | null
          quarter?: number | null
          receipt_url?: string | null
          sire_library_id?: string | null
          total_amount?: number
          unit_cost?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_expenses_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_expenses_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_expenses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "grazing_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_expenses_sire_library_id_fkey"
            columns: ["sire_library_id"]
            isOneToOne: false
            referencedRelation: "sire_library"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          acreage: number | null
          auto_renew: boolean | null
          county: string | null
          created_at: string | null
          documents: string[] | null
          end_date: string | null
          flat_rate: number | null
          id: string
          is_home_ranch: boolean | null
          landowner_email: string | null
          landowner_name: string | null
          landowner_phone: string | null
          landowner_portal_enabled: boolean | null
          landowner_portal_token: string | null
          legal_description: string | null
          map_coordinates: Json | null
          notes: string | null
          parcel_id: string | null
          parcel_ids: string[] | null
          payment_frequency: string | null
          photos: string[] | null
          property_name: string
          rate_per_acre: number | null
          rate_per_aum: number | null
          rate_per_head: number | null
          rate_type: string | null
          renewal_alert_days: number | null
          start_date: string | null
          state: string | null
          status: string | null
          total_aum_capacity: number | null
        }
        Insert: {
          acreage?: number | null
          auto_renew?: boolean | null
          county?: string | null
          created_at?: string | null
          documents?: string[] | null
          end_date?: string | null
          flat_rate?: number | null
          id?: string
          is_home_ranch?: boolean | null
          landowner_email?: string | null
          landowner_name?: string | null
          landowner_phone?: string | null
          landowner_portal_enabled?: boolean | null
          landowner_portal_token?: string | null
          legal_description?: string | null
          map_coordinates?: Json | null
          notes?: string | null
          parcel_id?: string | null
          parcel_ids?: string[] | null
          payment_frequency?: string | null
          photos?: string[] | null
          property_name: string
          rate_per_acre?: number | null
          rate_per_aum?: number | null
          rate_per_head?: number | null
          rate_type?: string | null
          renewal_alert_days?: number | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          total_aum_capacity?: number | null
        }
        Update: {
          acreage?: number | null
          auto_renew?: boolean | null
          county?: string | null
          created_at?: string | null
          documents?: string[] | null
          end_date?: string | null
          flat_rate?: number | null
          id?: string
          is_home_ranch?: boolean | null
          landowner_email?: string | null
          landowner_name?: string | null
          landowner_phone?: string | null
          landowner_portal_enabled?: boolean | null
          landowner_portal_token?: string | null
          legal_description?: string | null
          map_coordinates?: Json | null
          notes?: string | null
          parcel_id?: string | null
          parcel_ids?: string[] | null
          payment_frequency?: string | null
          photos?: string[] | null
          property_name?: string
          rate_per_acre?: number | null
          rate_per_aum?: number | null
          rate_per_head?: number | null
          rate_type?: string | null
          renewal_alert_days?: number | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          total_aum_capacity?: number | null
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
          default_administered_by: string | null
          default_breed: string | null
          default_ear_tag_color: string | null
          default_ear_tag_color_owner: string | null
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
          default_administered_by?: string | null
          default_breed?: string | null
          default_ear_tag_color?: string | null
          default_ear_tag_color_owner?: string | null
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
          default_administered_by?: string | null
          default_breed?: string | null
          default_ear_tag_color?: string | null
          default_ear_tag_color_owner?: string | null
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
          preg_check_method: string | null
          preg_check_result: string | null
          sire_id: string | null
          sire_library_id: string | null
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
          preg_check_method?: string | null
          preg_check_result?: string | null
          sire_id?: string | null
          sire_library_id?: string | null
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
          preg_check_method?: string | null
          preg_check_result?: string | null
          sire_id?: string | null
          sire_library_id?: string | null
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
          {
            foreignKeyName: "reproduction_events_sire_library_id_fkey"
            columns: ["sire_library_id"]
            isOneToOne: false
            referencedRelation: "sire_library"
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
      sire_import_batches: {
        Row: {
          bulls_found: number | null
          bulls_imported: number | null
          created_at: string | null
          error_text: string | null
          id: string
          imported_by: string | null
          pdf_filename: string | null
          pdf_url: string | null
          status: string | null
          stud: string
        }
        Insert: {
          bulls_found?: number | null
          bulls_imported?: number | null
          created_at?: string | null
          error_text?: string | null
          id?: string
          imported_by?: string | null
          pdf_filename?: string | null
          pdf_url?: string | null
          status?: string | null
          stud: string
        }
        Update: {
          bulls_found?: number | null
          bulls_imported?: number | null
          created_at?: string | null
          error_text?: string | null
          id?: string
          imported_by?: string | null
          pdf_filename?: string | null
          pdf_url?: string | null
          status?: string | null
          stud?: string
        }
        Relationships: [
          {
            foreignKeyName: "sire_import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sire_library: {
        Row: {
          acc_bw: number | null
          acc_ww: number | null
          acc_yw: number | null
          animal_id: string | null
          birth_year: number | null
          breed: string | null
          bull_name: string
          bull_type: string | null
          community_status: string | null
          created_at: string | null
          epd_bw: number | null
          epd_cw: number | null
          epd_dollar_b: number | null
          epd_dollar_f: number | null
          epd_dollar_g: number | null
          epd_dollar_w: number | null
          epd_fat: number | null
          epd_marbling: number | null
          epd_milk: number | null
          epd_raw_data: Json | null
          epd_rea: number | null
          epd_source: string | null
          epd_tm: number | null
          epd_updated_at: string | null
          epd_ww: number | null
          epd_yw: number | null
          id: string
          import_batch_id: string | null
          is_active: boolean | null
          lease_end: string | null
          lease_fee: number | null
          lease_from: string | null
          lease_start: string | null
          naab_code: string | null
          notes: string | null
          owner: string | null
          pct_bw: number | null
          pct_milk: number | null
          pct_ww: number | null
          pct_yw: number | null
          photo_url: string | null
          registration_number: string | null
          source: string | null
          stud: string | null
          submitted_by: string | null
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          acc_bw?: number | null
          acc_ww?: number | null
          acc_yw?: number | null
          animal_id?: string | null
          birth_year?: number | null
          breed?: string | null
          bull_name: string
          bull_type?: string | null
          community_status?: string | null
          created_at?: string | null
          epd_bw?: number | null
          epd_cw?: number | null
          epd_dollar_b?: number | null
          epd_dollar_f?: number | null
          epd_dollar_g?: number | null
          epd_dollar_w?: number | null
          epd_fat?: number | null
          epd_marbling?: number | null
          epd_milk?: number | null
          epd_raw_data?: Json | null
          epd_rea?: number | null
          epd_source?: string | null
          epd_tm?: number | null
          epd_updated_at?: string | null
          epd_ww?: number | null
          epd_yw?: number | null
          id?: string
          import_batch_id?: string | null
          is_active?: boolean | null
          lease_end?: string | null
          lease_fee?: number | null
          lease_from?: string | null
          lease_start?: string | null
          naab_code?: string | null
          notes?: string | null
          owner?: string | null
          pct_bw?: number | null
          pct_milk?: number | null
          pct_ww?: number | null
          pct_yw?: number | null
          photo_url?: string | null
          registration_number?: string | null
          source?: string | null
          stud?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          acc_bw?: number | null
          acc_ww?: number | null
          acc_yw?: number | null
          animal_id?: string | null
          birth_year?: number | null
          breed?: string | null
          bull_name?: string
          bull_type?: string | null
          community_status?: string | null
          created_at?: string | null
          epd_bw?: number | null
          epd_cw?: number | null
          epd_dollar_b?: number | null
          epd_dollar_f?: number | null
          epd_dollar_g?: number | null
          epd_dollar_w?: number | null
          epd_fat?: number | null
          epd_marbling?: number | null
          epd_milk?: number | null
          epd_raw_data?: Json | null
          epd_rea?: number | null
          epd_source?: string | null
          epd_tm?: number | null
          epd_updated_at?: string | null
          epd_ww?: number | null
          epd_yw?: number | null
          id?: string
          import_batch_id?: string | null
          is_active?: boolean | null
          lease_end?: string | null
          lease_fee?: number | null
          lease_from?: string | null
          lease_start?: string | null
          naab_code?: string | null
          notes?: string | null
          owner?: string | null
          pct_bw?: number | null
          pct_milk?: number | null
          pct_ww?: number | null
          pct_yw?: number | null
          photo_url?: string | null
          registration_number?: string | null
          source?: string | null
          stud?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sire_library_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sire_library_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "sire_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sire_library_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
