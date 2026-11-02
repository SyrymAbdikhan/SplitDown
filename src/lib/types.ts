export type Role = "owner" | "admin" | "member";

/** handle is null for guests (people without an account, added to a single expense). */
export type Profile = { id: string; handle: string | null; display_name: string; avatar_url: string | null };

export type Group = { id: string; name: string; emoji: string; currency: string; created_by: string };

export type Member = { user_id: string; role: Role; joined_at: string };

export type Expense = {
  id: string;
  title: string;
  amount_cents: number;
  category: string;
  paid_by: string;
  created_by: string;
  spent_at: string;
  settlement_id: string | null;
  expense_participants: { user_id: string; share_cents: number }[];
};

export type Transfer = {
  id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  paid_at: string | null;
};

export type Settlement = {
  id: string;
  created_by: string;
  created_at: string;
  total_cents: number;
  expense_count: number;
  settlement_transfers: Transfer[];
};

export type Activity = {
  id: number;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  food: { label: "Food & drink", emoji: "🍔" },
  groceries: { label: "Groceries", emoji: "🛒" },
  transport: { label: "Transport", emoji: "🚕" },
  housing: { label: "Housing", emoji: "🏠" },
  utilities: { label: "Utilities", emoji: "💡" },
  entertainment: { label: "Entertainment", emoji: "🎬" },
  travel: { label: "Travel", emoji: "✈️" },
  shopping: { label: "Shopping", emoji: "🛍️" },
  health: { label: "Health", emoji: "💊" },
  other: { label: "Other", emoji: "📦" },
};
