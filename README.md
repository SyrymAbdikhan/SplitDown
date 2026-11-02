# SplitDown

Log shared expenses in a group, hit **Split the bill**, and get the fewest payments that settle everyone up.

Next.js 16 · Supabase (Postgres, Auth, Realtime) · Tailwind 4 · Docker

## How it works

- **Groups** have one owner, optional admins, and members. Admins invite people by `@handle` (they accept from their dashboard) or by an invite link (instant join, optional expiry).
- **Expenses** have a title, amount, category, payer (defaults to you), time (defaults to now) and participants (everyone by default). The split is equal; leftover cents go one each to the first participants, so shares always add up exactly.
- Members edit or delete their own expenses. Admins can edit or delete any open expense.
- **Split the bill** (any member) closes the current period. It works out each person's net (paid minus share), then repeatedly has the biggest debtor pay the biggest creditor, which gives at most `n − 1` payments. The expenses are locked forever and new ones start a fresh period. Each payment can be marked paid by the payer, the receiver or an admin.
- A member can leave or be removed only when none of their expenses are still open.
- **Guests** are people without an account, typed into a single expense. They get their own share and show up in payments.
- Every change is written to the activity log, and the group page subscribes to it for live updates.
- **Deleting an account** (Settings) removes the login, email, name and photo. Shared history stays as "Deleted user" so other people's balances still add up.

All rules live in Postgres ([`supabase/migrations/`](supabase/migrations/)). Tables are read-only through row-level security, and every write goes through a `security definer` function that checks permissions. The browser talks to Supabase directly, with no API layer to keep in sync.

## Setup

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run each file in `supabase/migrations/` in order. Or use the CLI: `supabase link` then `supabase db push`.
3. Go to **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (your production URL later)
   - Redirect URLs: `http://localhost:3000/auth/callback` (plus the production one)
4. Go to **Authentication → Sign In / Providers**. The app signs in with Google and GitHub only:
   - **Google**: create an OAuth client in Google Cloud Console (Web application) with redirect URI `https://<project>.supabase.co/auth/v1/callback`, then paste the client ID and secret. Publish the consent screen before launch, or only listed test users can sign in.
   - **GitHub**: GitHub → Settings → Developer settings → OAuth Apps, using the same callback URL.
   - **Email**: turn it off. Supabase's built-in mailer only reaches your own team, so email sign-in needs a custom SMTP provider first.

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

## Backups

The free Supabase plan pauses inactive projects after a week and has limited backups. To keep your own copy, add `SUPABASE_DB_URL` to `.env` (Supabase → **Connect** → Session pooler connection string, with your database password), then:

```bash
./supabase/backup.sh
```

This saves the app data, accounts and file metadata to `backups/<date>.sql.gz` (git-ignored). Uploaded photos themselves stay in Supabase Storage.

## Later

- **Email sign-in**: set up custom SMTP in Supabase, then add an email field to `src/app/login/login-form.tsx` using `signInWithOtp({ email })` and `verifyOtp`.
- **Phone sign-in**: enable the Phone provider in Supabase with a Twilio (or similar) key, and add a phone field the same way with `signInWithOtp({ phone })`.
- **Apple sign-in**: needs an Apple Developer account. It's the same `signInWithOAuth` call as Google.
- **Unequal splits**: `save_expense` already stores a per-person `share_cents`, so only the share calculation and the form need to change.
