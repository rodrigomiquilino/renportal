/**
 * Tipos do schema público. Cada módulo acrescenta as tabelas que introduz.
 * bigint chega como number enquanto couber em Number (o PostgREST faz o parse).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'user' | 'admin';

export type SessionStatus = 'active' | 'ended' | 'flagged';

export type PlaySession = {
  id: string;
  user_id: string;
  game_id: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  awarded_seconds: number;
  status: SessionStatus;
};

export type XpLog = {
  id: number;
  user_id: string;
  amount: number;
  source: string;
  reference_id: string | null;
  created_at: string;
};

export type Game = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  web_path: string | null;
  web_url: string | null;
  windows_url: string | null;
  mac_url: string | null;
  linux_url: string | null;
  file_size_mb: number | null;
  version: string | null;
  content_rating?: 'everyone' | 'mature';
  published: boolean;
  created_at: string;
};

export type Donation = {
  id: string;
  from_user: string;
  to_user: string;
  amount_xp: number;
  message: string | null;
  created_at: string;
};

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
};

export type Conversation = {
  id: string;
  created_at: string;
};

export type ConversationParticipant = {
  conversation_id: string;
  user_id: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type GameFeedback = {
  id: string;
  game_id: string;
  user_id: string;
  rating: number;
  rating_story: number | null;
  rating_gameplay: number | null;
  rating_art: number | null;
  rating_audio: number | null;
  rating_writing: number | null;
  comment: string | null;
  hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopItemType = 'border' | 'effect' | 'title';

export type ShopItem = {
  id: string;
  type: ShopItemType;
  name: string;
  description: string | null;
  cost_xp: number;
  asset_key: string;
  image_url: string | null;
  active: boolean;
  supporter_only?: boolean;
};

export type UserItem = {
  user_id: string;
  item_id: string;
  acquired_at: string;
};

export type ProfileVisibility = 'public' | 'members' | 'private';

export type ReportReason = 'spam' | 'harassment' | 'adult' | 'other';

export type UserBlock = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type UserReport = {
  id: string;
  reporter_id: string;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  onboarded_at: string | null;
  show_adult?: boolean;
  profile_visibility?: ProfileVisibility;
  show_activity?: boolean;
  allow_friend_requests?: boolean;
  supporter_until?: string | null;
  show_support?: boolean;
  xp: number;
  level: number;
  total_play_time_seconds: number;
  active_title: string | null;
  active_border: string | null;
  active_effect: string | null;
  role: UserRole;
  created_at: string;
};

type Table<Row extends Record<string, unknown>, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        {
          id: string;
          username: string;
          display_name?: string;
          avatar_url?: string | null;
          banner_url?: string | null;
          onboarded_at?: string | null;
          show_adult?: boolean;
          profile_visibility?: ProfileVisibility;
          show_activity?: boolean;
          allow_friend_requests?: boolean;
          xp?: number;
          level?: number;
          total_play_time_seconds?: number;
          active_title?: string | null;
          active_border?: string | null;
          active_effect?: string | null;
          role?: UserRole;
          created_at?: string;
        },
        {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          banner_url?: string | null;
          onboarded_at?: string | null;
          show_adult?: boolean;
          profile_visibility?: ProfileVisibility;
          show_activity?: boolean;
          allow_friend_requests?: boolean;
          show_support?: boolean;
          xp?: number;
          level?: number;
          total_play_time_seconds?: number;
          active_title?: string | null;
          active_border?: string | null;
          active_effect?: string | null;
          role?: UserRole;
        }
      >;
      games: Table<
        Game,
        {
          slug: string;
          title: string;
          web_path?: string | null;
          web_url?: string | null;
          description?: string | null;
          cover_url?: string | null;
          windows_url?: string | null;
          mac_url?: string | null;
          linux_url?: string | null;
          file_size_mb?: number | null;
          version?: string | null;
          content_rating?: 'everyone' | 'mature';
          published?: boolean;
          created_at?: string;
          id?: string;
        },
        {
          slug?: string;
          title?: string;
          description?: string | null;
          cover_url?: string | null;
          web_path?: string | null;
          web_url?: string | null;
          windows_url?: string | null;
          mac_url?: string | null;
          linux_url?: string | null;
          file_size_mb?: number | null;
          version?: string | null;
          content_rating?: 'everyone' | 'mature';
          published?: boolean;
        }
      >;
      play_sessions: Table<
        PlaySession,
        {
          user_id: string;
          game_id: string;
          id?: string;
          started_at?: string;
          last_heartbeat_at?: string;
          ended_at?: string | null;
          awarded_seconds?: number;
          status?: SessionStatus;
        },
        {
          last_heartbeat_at?: string;
          ended_at?: string | null;
          awarded_seconds?: number;
          status?: SessionStatus;
        }
      >;
      game_feedback: Table<
        GameFeedback,
        {
          game_id: string;
          user_id: string;
          rating: number;
          rating_story?: number | null;
          rating_gameplay?: number | null;
          rating_art?: number | null;
          rating_audio?: number | null;
          rating_writing?: number | null;
          comment?: string | null;
          hidden?: boolean;
          id?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          rating?: number;
          rating_story?: number | null;
          rating_gameplay?: number | null;
          rating_art?: number | null;
          rating_audio?: number | null;
          rating_writing?: number | null;
          comment?: string | null;
          hidden?: boolean;
          updated_at?: string;
        }
      >;
      shop_items: Table<
        ShopItem,
        {
          type: ShopItemType;
          name: string;
          cost_xp: number;
          asset_key: string;
          description?: string | null;
          image_url?: string | null;
          active?: boolean;
          supporter_only?: boolean;
          id?: string;
        },
        {
          type?: ShopItemType;
          name?: string;
          description?: string | null;
          cost_xp?: number;
          asset_key?: string;
          image_url?: string | null;
          active?: boolean;
          supporter_only?: boolean;
        }
      >;
      user_items: Table<UserItem, { user_id: string; item_id: string; acquired_at?: string }, { acquired_at?: string }>;
      donations: Table<
        Donation,
        {
          from_user: string;
          to_user: string;
          amount_xp: number;
          message?: string | null;
          id?: string;
          created_at?: string;
        },
        { message?: string | null; amount_xp?: number }
      >;
      friendships: Table<
        Friendship,
        {
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          id?: string;
          created_at?: string;
        },
        { status?: FriendshipStatus }
      >;
      conversations: Table<Conversation, { id?: string; created_at?: string }, { created_at?: string }>;
      conversation_participants: Table<
        ConversationParticipant,
        { conversation_id: string; user_id: string },
        { conversation_id?: string; user_id?: string }
      >;
      messages: Table<
        Message,
        {
          conversation_id: string;
          sender_id: string;
          content: string;
          reply_to?: string | null;
          edited_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          created_at?: string;
        },
        {
          content?: string;
          reply_to?: string | null;
          edited_at?: string | null;
          deleted_at?: string | null;
        }
      >;
      xp_log: Table<
        XpLog,
        {
          user_id: string;
          amount: number;
          source: string;
          reference_id?: string | null;
          created_at?: string;
          id?: number;
        },
        {
          amount?: number;
          source?: string;
          reference_id?: string | null;
        }
      >;
      user_blocks: Table<
        UserBlock,
        { blocker_id: string; blocked_id: string; created_at?: string },
        { created_at?: string }
      >;
      user_reports: Table<
        UserReport,
        {
          reporter_id: string;
          target_id: string;
          reason: ReportReason;
          details?: string | null;
          id?: string;
          created_at?: string;
        },
        { details?: string | null; reason?: ReportReason }
      >;
      support_goal: Table<
        { id: boolean; target_cents: number; label: string },
        { id?: boolean; target_cents: number; label: string },
        { target_cents?: number; label?: string }
      >;
      support_checkouts: Table<
        {
          id: string;
          user_id: string;
          kind: 'one_time' | 'subscription';
          amount_cents: number;
          livepix_reference: string | null;
          status: 'pending' | 'paid';
          created_at: string;
        },
        {
          user_id: string;
          kind: 'one_time' | 'subscription';
          amount_cents: number;
          livepix_reference?: string | null;
          status?: 'pending' | 'paid';
          id?: string;
          created_at?: string;
        },
        { livepix_reference?: string | null; status?: 'pending' | 'paid' }
      >;
      support_payments: Table<
        {
          id: string;
          user_id: string;
          livepix_id: string;
          livepix_reference: string | null;
          kind: 'one_time' | 'subscription';
          amount_cents: number;
          currency: string;
          proof: string | null;
          paid_at: string;
          created_at: string;
        },
        {
          user_id: string;
          livepix_id: string;
          kind: 'one_time' | 'subscription';
          amount_cents: number;
          paid_at: string;
          livepix_reference?: string | null;
          currency?: string;
          proof?: string | null;
          id?: string;
          created_at?: string;
        },
        { proof?: string | null }
      >;
      support_subscriptions: Table<
        {
          user_id: string;
          livepix_subscription_id: string | null;
          livepix_reference: string | null;
          status: 'active' | 'pending' | 'cancelled';
          renew_at: string | null;
          amount_cents: number | null;
          updated_at: string;
        },
        {
          user_id: string;
          livepix_subscription_id?: string | null;
          livepix_reference?: string | null;
          status?: 'active' | 'pending' | 'cancelled';
          renew_at?: string | null;
          amount_cents?: number | null;
          updated_at?: string;
        },
        {
          livepix_subscription_id?: string | null;
          livepix_reference?: string | null;
          status?: 'active' | 'pending' | 'cancelled';
          renew_at?: string | null;
          amount_cents?: number | null;
          updated_at?: string;
        }
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_direct_conversation: {
        Args: { p_other: string };
        Returns: string;
      };
      set_user_role: {
        Args: { p_user_id: string; p_role: string };
        Returns: null;
      };
      username_taken: {
        Args: { p_username: string; p_except?: string | null };
        Returns: boolean;
      };
      admin_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      support_month_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      support_month_wall: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
  };
};
