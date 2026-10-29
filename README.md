# In Our Cart

Live at https://inourcart.net

A shopping list anyone can start using right away. Items are kept on the device until you **save the list** with a list name and 4-digit PIN, which and lets you open it on any phone or laptop (or share it with your household). Changes sync between devices within a few seconds. Checked-off items move to **In the cart** with a live "checked off 5 min ago" timestamp.

On a phone, swipe an item right to check it off (or move it back) and left to delete it, with Undo. Common groceries get an icon automatically (🥛 milk, 🍌 bananas, 🧻 paper towels).

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Drizzle ORM and Neon Postgres. Deploys to Vercel.

## Project structure

```
.
├── drizzle/                     # Generated SQL migrations (commit these)
│   ├── 0000_init.sql
│   ├── 0001_per_passcode_lists.sql
│   ├── 0002_drop_passcode.sql
│   ├── 0003_list_name_and_pin.sql
│   └── meta/
├── src/
│   ├── app/
│   │   ├── account-actions.ts   # Save a list (name + PIN), log in, log out
│   │   ├── actions.ts           # Item Server Actions, scoped to the signed-in list
│   │   ├── api/items/route.ts   # GET endpoint polled by every open device
│   │   ├── error.tsx
│   │   ├── globals.css          # Tailwind + color tokens (light/dark)
│   │   ├── icon.svg
│   │   ├── layout.tsx
│   │   ├── manifest.ts          # "Add to Home Screen" support
│   │   ├── not-found.tsx
│   │   └── page.tsx             # Server Component: loads items, renders the list
│   ├── components/
│   │   ├── add-item-form.tsx
│   │   ├── icons.tsx
│   │   ├── item-row.tsx         # View + inline edit/delete
│   │   ├── save-dialog.tsx      # "Save my list" / "Log in"
│   │   ├── shopping-list.tsx    # Client state, optimistic updates, polling
│   │   ├── toast.tsx
│   │   └── use-now.ts           # Ticking clock for relative timestamps
│   ├── db/
│   │   ├── index.ts             # Lazy Neon + Drizzle client
│   │   └── schema.ts            # lists, items, login_attempts
│   ├── lib/
│   │   ├── item-icons.ts        # Keyword → emoji for common items
│   │   ├── auth.ts              # List names, PIN hashing, signed session tokens
│   │   ├── device-storage.ts    # localStorage for lists that aren't saved yet
│   │   ├── items.ts
│   │   ├── rate-limit.ts
│   │   ├── relative-time.ts
│   │   ├── session.ts           # Cookie helpers
│   │   ├── types.ts
│   │   └── validate.ts
├── .env.example
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Local setup

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Neon connection string (see below) |
| `AUTH_SECRET` | Random string, 32+ characters. Run `openssl rand -base64 32` |

Then create the tables and start the dev server:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Add a few items, then tap **Save my list**.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check with no output files |
| `npm run db:generate` | Create a new migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:studio` | Browse the database in Drizzle Studio |

## Creating the Neon database

1. Sign in at https://console.neon.tech and create a project (pick the region closest to your Vercel region, e.g. `us-east-1` / Washington D.C.).
2. On the project dashboard click **Connect**, choose your database, and turn on **Connection pooling**.
3. Copy the connection string (it contains `-pooler` in the host and ends in `?sslmode=require`) into `DATABASE_URL`.

Tip: Neon's branching lets you create a `dev` branch for local work and keep `main` for production. Each branch has its own connection string.

## Deploying to Vercel

1. Push this project to a GitHub repository (the generated `drizzle/` folder should be committed).
2. In Vercel, click **Add New → Project**, import the repo. The Next.js preset is detected automatically.
3. Before the first deploy, open **Environment Variables** and add `DATABASE_URL` and `AUTH_SECRET` for the **Production** environment (and Preview if you want preview deploys to work). Use a different `AUTH_SECRET` than your local one.
   - Alternative: install the **Neon** integration from the Vercel Marketplace (Storage tab), which creates the database and sets `DATABASE_URL` for you.
4. Run migrations against the production database, either:
   - **From your machine (recommended):**
     ```bash
     npm i -g vercel
     vercel link
     vercel env pull .env.production.local --environment=production
     DATABASE_URL="$(grep DATABASE_URL .env.production.local | cut -d '=' -f2- | tr -d '"')" npm run db:migrate
     ```
   - **Or automatically on every deploy:** in Project → Settings → Build and Deployment, set the Build Command to `npm run db:migrate && npm run build`. Migrations are idempotent, so this is safe, but a failed migration will fail the deploy.
5. Deploy. Visit your `*.vercel.app` URL, save a list, and add the site to your phone's home screen.

### Day-to-day operations

- **Sign out every device on every list:** rotate `AUTH_SECRET` and redeploy. Names and PINs keep working; people just log in again.
- **Someone forgot their PIN:** there's no reset flow. Delete and recreate the list, or set a new PIN by updating `pin_salt`/`pin_hash` (see `hashPin` in `src/lib/auth.ts`).
- **Delete a list:** delete its row from the `lists` table (e.g. in `npm run db:studio`). Its items are deleted with it.
- **Schema changes:** edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`, then migrate production as in step 4.

## How it works

- **Device-only lists.** Until a list is saved, items are stored in the browser's localStorage. Nothing reaches the server until the person saves the list.
- **Saving a list.** The person picks a list name (unique, case-insensitive) and a 4-digit PIN (a random one is suggested). The server creates the list, moves the device's items into it, and signs the device in. The PIN is stored as a salted SHA-256 hash.
- **Logging in.** List name + PIN. Capitals and extra spaces in the name don't matter. Any items already on the device are added to that list.
- **Why a 4-digit PIN is safe here.** The name picks the list, so the PIN only has to protect one list. After 5 wrong PINs the list locks for 15 minutes, so trying all 10,000 PINs would take weeks. Each network is also capped at 20 wrong attempts per 15 minutes across all lists, and every miss is delayed ~1 s. New lists are limited to 10 per hour per network.
- **Sessions.** A signed, httpOnly cookie holds the list id for 90 days. Every Server Action and the sync endpoint read the list id from that cookie and only touch that list's items.
- **Optimistic updates.** On a saved list, every change appears instantly. The client generates the item's UUID so new rows never need re-keying. If the server rejects a change, that one item rolls back and a toast explains what happened. Rapid repeated taps on the same item resolve to the last one.
- **Sync.** On a saved list, each open tab polls `GET /api/items` every 5 seconds while visible, and immediately on focus or reconnect. Polling stops when the tab is hidden. A poll result is thrown away if any local change was in flight while it was fetching, which prevents "flicker back" of an item you just checked. Results are compared before re-rendering, so unchanged data causes no repaint. The edit form keeps its own draft, so incoming updates never overwrite what you're typing.
- **Check-off moment.** Checking an item fills the circle, draws a strikethrough, folds the row away, then highlights it briefly in its new section (about half a second total). Android phones get a short vibration; iPhones don't support web vibration. All motion is skipped when the device has Reduce Motion turned on.
- **Swipes.** Rows track your finger horizontally and leave vertical scrolling to the browser. Past about a third of the row's width, letting go checks the item off (swipe right) or deletes it with a 6-second Undo (swipe left). The edit panel's Delete button still asks first.
- **Icons.** `src/lib/item-icons.ts` matches item names against a keyword list (plurals and accents are handled, and longer phrases like "peanut butter" win over "butter"). Add your own keywords there.
- **Fonts.** Headings and item names use Bricolage Grotesque, bundled from npm (`@fontsource-variable/bricolage-grotesque`) so there's no request to Google Fonts. Body text uses Geist.
- **Timestamps.** Relative times are recomputed every 15 seconds on the client; hover or long-press shows the exact time.

## Tradeoffs

- **Polling instead of WebSockets.** Simple, works on Vercel's free tier with no extra service, and 5 seconds is plenty for a shopping list. The cost is a small request every 5 seconds per open, visible tab. For true real-time, swap polling for a hosted pub/sub (Pusher, Ably, or Supabase Realtime) and keep everything else.
- **Last write wins.** If two people edit the same item at the same moment, the later save wins. Fine for a household; a multi-tenant app would want version checks.
- **Lockouts can be triggered by others.** Someone who knows your list name could enter wrong PINs to lock it for 15 minutes. Devices already logged in keep working; only new logins wait.
- **List names are public-ish.** Trying to create a list reveals whether a name is taken, and login errors say whether a name exists. That's friendlier, and the PIN lockout is what protects the list.
- **A PIN hash isn't much protection on its own.** With only 10,000 PINs, anyone holding a copy of the database could work them all out offline. The real protection is the lockout, and a database leak would expose the items anyway.
- **No PIN recovery.** There's no email on file. If you want resets later, add an optional email and send a reset link.
- **Device-only lists are per browser.** Clearing site data or switching browsers before saving loses those items.
- **IP-based rate limiting.** Devices sharing a network (your home Wi-Fi) share the same counters, so a lockout affects everyone on that network for 15 minutes.
- **Completed items are kept forever** until unchecked or deleted. The list query returns every row; with years of history you'd want to auto-clear old completed items or paginate.
- **No ESLint config.** Next.js 16 removed `next lint`. `npm run typecheck` (strict TypeScript) is included; add ESLint separately if you want it.
