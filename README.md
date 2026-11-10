# StockLens — investor core

**UE24CS351A · Section C**  
Debaditya Chakrabarti (PES1UG24CS140) · Dhadhal Rudra (PES1UG24CS146)

This repository currently contains the investor-side **paper trading simulation**. Companies, prices and cash are fictional. No real orders or payments are sent. Each investor starts with ₹100,000 in virtual cash. Research/vector search and administrative functions are deliberately not yet implemented; they are planned separately in Dhadhal's issue. Until that work is integrated, this partial project does not satisfy the full two-paradigm project requirement.

## Features in this part

- Investor registration and sign-in; passwords stored as bcrypt hashes and sessions as SHA-256 token hashes.
- Market quotes, paper buy/sell orders, transaction history, portfolio and watchlist.
- Atomic PostgreSQL function: locks account and stock rows, rejects insufficient funds or shares, and updates cash, holdings and trade history together.
- Primary/foreign keys, uniqueness and check constraints, a portfolio view and indexes. Client and server validation, parameterized queries and server-side ownership checks.
- Schema, example queries and tests in `sql/` and `tests/`; integration contract in `docs/INVESTOR_DESIGN.md`.

## Setup (Windows PowerShell)

Requires Node.js 20.9+ (Node 22 recommended), Docker Desktop with Docker Engine running, and internet access for the first install. Open a terminal in the folder containing `package.json`.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Open `.env.local` in VS Code. Replace `change_this_password` with the **same** URL-safe password in both `DATABASE_URL` and `POSTGRES_PASSWORD`; choose a separate investor password of at least 10 characters and at most 72 UTF-8 bytes. These are local development secrets: do not commit `.env` or `.env.local`. Then:

```powershell
Copy-Item .env.local .env
docker compose up -d --wait
npm run db:init
npm run dev
```

Open http://localhost:3000. Sign in as `investor@stocklens.local` using the investor password you chose, or register an investor account. Initialisation adds missing seed data; it does not reset existing passwords or trades. Stop the web server with Ctrl+C; stop the database using `docker compose down`. **Do not use `docker compose down -v` unless you intend to delete the database volume.**

The PostgreSQL Docker image includes pgvector for future integration, but this investor part does not use vector storage yet. If port 5432 is occupied, change the host port in `compose.yaml` and the port in `DATABASE_URL` together. If you have an older StockLens database, use a separate volume or database to avoid mixing schemas and data.

## Alternative embedded demo

Copy `.env.example` to `.env.local`, choose `DEMO_INVESTOR_PASSWORD`, and uncomment `DATABASE_MODE=embedded` and `PGLITE_DIR=./.pglite`. Run `npm ci`, `npm run db:init`, then `npm run dev`. Stop the app before running initialization again: only one process can access the embedded directory at once. Docker/PostgreSQL is recommended for assessment.

## Test and demonstration

- `npm test`: isolated PostgreSQL-compatible PGlite database tests; they don't affect your database.
- `npm run build`: Next.js production build.
- Sign in, buy a stock, check cash and holdings on Overview, add/remove a watchlist item, then try to sell more shares than owned. Verify that the failed trade changes nothing.
- Review `sql/schema.sql` for the atomic function, constraints and view, and `sql/queries.sql` for example joins, aggregates, subquery and DDL.

## Security and limitations

This is a local educational prototype, not a real trading platform. It does not provide exchange matching, live prices, deposits, withdrawals or financial advice. Production use would require HTTPS, rate limiting, least-privilege database accounts, further security testing, monitoring and regulatory review. Never publish `.env`, `.env.local`, session tokens or actual passwords. Both team members should make genuine commits for their own work and confirm the project title is unique within the section.
