# SplitDown

Log shared expenses in a group, hit **Split the bill**, and get the fewest payments that settle everyone up.

Next.js 16 · Supabase (Postgres, Auth, Realtime) · Tailwind 4 · Docker

## How it works

- **Groups** have one owner, optional admins, and members. Admins invite people by `@handle` (they accept from their dashboard) or by an invite link (instant join, optional expiry).
- **Expenses** have a title, amount, category, payer (defaults to you), time (defaults to now) and participants (everyone by default). The split is equal; leftover cents go one each to the first participants, so shares always add up exactly.
- Members edit or delete their own expenses. Admins can edit or delete any open expense.
- **Split the bill** (any member) closes the current period. It works out each person's net (paid minus share), then repeatedly has the biggest debtor pay the biggest creditor, which gives at most `n − 1` payments. The expenses are locked forever and new ones start a fresh period. Each payment can be marked paid by the payer, the receiver or an admin.
- A member can leave or be removed only when none of their expenses are still open.
- Every change is written to the activity log, and the group page subscribes to it for live updates.

All rules live in Postgres ([`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)). Tables are read-only through row-level security, and every write goes through a `security definer` function that checks permissions. The browser talks to Supabase directly, with no API layer to keep in sync.

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run each file in `supabase/migrations/` in order. Or use the CLI: `supabase link` then `supabase db push`.
3. Go to **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (your production URL later)
   - Redirect URLs: `http://localhost:3000/auth/callback` (plus the production one)
4. Go to **Authentication → Sign In / Providers**:
   - **Email**: enabled by default.
   - **Google**: create an OAuth client in Google Cloud Console (Web application) with redirect URI `https://<project>.supabase.co/auth/v1/callback`, then paste the client ID and secret.
   - **GitHub**: GitHub → Settings → Developer settings → OAuth Apps, using the same callback URL.
5. Optional, to also get a 6-digit code in sign-in emails: go to **Authentication → Emails → Magic Link** and add `{{ .Token }}` to the template. Users can then type the code or click the link.

### 2. Environment

```bash
cp .env.example .env
```

Fill in the project URL and publishable key from **Project Settings → API**.

### 3. Run

With Docker:

```bash
docker compose up --build
```

Without Docker (Node 20.9+):

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Tests

The database logic (money splitting, permissions, locking) runs against a throwaway Postgres in Docker:

```bash
./supabase/test.sh
```

## Later

- **Phone sign-in**: enable the Phone provider in Supabase with a Twilio (or similar) key, and add a phone field to `src/app/login/login-form.tsx` using `signInWithOtp({ phone })`.
- **Apple sign-in**: needs an Apple Developer account. It's the same `signInWithOAuth` call as Google.
- **Unequal splits**: `save_expense` already stores a per-person `share_cents`, so only the share calculation and the form need to change.
