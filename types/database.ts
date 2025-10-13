export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      brokers: {
        Row: {
          id: string
          name: string
          server_address: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          server_address: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          server_address?: string
          created_at?: string
        }
      }
      mt5_accounts: {
        Row: {
          id: string
          user_id: string
          broker_id: string
          account_number: number
          password_encrypted: string
          is_active: boolean
          is_investor: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          broker_id: string
          account_number: number
          password_encrypted: string
          is_active?: boolean
          is_investor?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          broker_id?: string
          account_number?: number
          password_encrypted?: string
          is_active?: boolean
          is_investor?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      trading_settings: {
        Row: {
          id: string
          user_id: string
          position_sizing_type: 'lot' | 'percentage'
          position_size_value: number
          max_open_positions: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          position_sizing_type: 'lot' | 'percentage'
          position_size_value: number
          max_open_positions?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          position_sizing_type?: 'lot' | 'percentage'
          position_size_value?: number
          max_open_positions?: number
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      copy_trades: {
        Row: {
          id: string
          admin_user_id: string
          follower_user_id: string
          admin_mt5_account_id: string
          follower_mt5_account_id: string
          symbol: string
          order_type: string
          volume: number
          open_price: number
          close_price: number | null
          stop_loss: number | null
          take_profit: number | null
          admin_ticket: number
          follower_ticket: number | null
          status: 'pending' | 'opened' | 'closed' | 'failed'
          error_message: string | null
          opened_at: string | null
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id: string
          follower_user_id: string
          admin_mt5_account_id: string
          follower_mt5_account_id: string
          symbol: string
          order_type: string
          volume: number
          open_price: number
          close_price?: number | null
          stop_loss?: number | null
          take_profit?: number | null
          admin_ticket: number
          follower_ticket?: number | null
          status: 'pending' | 'opened' | 'closed' | 'failed'
          error_message?: string | null
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string
          follower_user_id?: string
          admin_mt5_account_id?: string
          follower_mt5_account_id?: string
          symbol?: string
          order_type?: string
          volume?: number
          open_price?: number
          close_price?: number | null
          stop_loss?: number | null
          take_profit?: number | null
          admin_ticket?: number
          follower_ticket?: number | null
          status?: 'pending' | 'opened' | 'closed' | 'failed'
          error_message?: string | null
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

