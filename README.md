# LearnApp Goals & Incentives

July/August 2026 pilot for tracking team goals and proof uploads.

**Stack:** React + Express + Railway PostgreSQL  
**Login:** Email only (must match an employee in the database)

## Deploy on Railway

1. Push this repo to GitHub
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Add **PostgreSQL** to the project
4. On the **web service** → **Variables** → add:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```
5. **Settings** → Build command: `npm run build`  
   Start command: `npm start`

## One-time database setup (Railway CLI or local with Railway URL)

Copy `DATABASE_URL` from Railway Postgres → Connect, then:

```bash
cp .env.example .env   # paste your Railway DATABASE_URL
npm install
npm run db:push        # create tables
npm run seed           # employees + cycles
npm run seed:goals -- --replace   # July goals from PDF/sheet
```

## Login

Open the app → enter your `@learnapp.com` email → Sign In. No password.

## Update July goals from spreadsheet

Place `Goals for July.xlsx` in project root (or use the copy in Downloads), then:

```bash
npm run extract:july-goals
npm run seed:goals -- --replace
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run db:push` | Sync schema to Railway Postgres |
| `npm run seed` | Upsert employees (safe, keeps proofs) |
| `npm run seed -- --fresh` | Wipe all data and re-seed employees |
| `npm run seed:goals -- --replace` | Replace July goals from `july-goals.json` |
