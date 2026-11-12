# StockLens — Paper Market Intelligence & Trading Lab

**UE24CS351A · Section C**  
Debaditya Chakrabarti (PES1UG24CS140) · Dhadhal Rudra (PES1UG24CS146)

StockLens is an educational paper market intelligence and simulated trading laboratory built for the Database Management Systems (UE24CS351A) curriculum. It satisfies the **two-paradigm database project requirement** by integrating:
1. **Relational Database Core (PostgreSQL):** Atomic multi-row paper trading transactions, foreign key constraints, portfolio valuation view, session token security, and an automated price change audit trigger.
2. **Vector Database Intelligence (pgvector):** 64-dimensional semantic research embeddings, HNSW vector indexing (`vector_cosine_ops`), and cosine similarity ranking (`<=>`) across analyst notes and earnings commentary.

Companies, quotes and funds are fictional. No real orders or monetary transactions are executed.

---

## Architecture & Team Contributions

| Team Member | SRN | Core Focus & Contributions |
|---|---|---|
| **Debaditya Chakrabarti** | `PES1UG24CS140` | **Part 1 — Investor Core:** PostgreSQL relational schema (`app_user`, `session`, `stock`, `holding`, `trade`, `watchlist`), atomic trade function (`execute_paper_trade`), portfolio view, bcrypt password hashing, session management, and investor Next.js dashboard ([design contract](docs/INVESTOR_DESIGN.md)). |
| **Dhadhal Rudra** | `PES1UG24CS146` | **Part 2 — Market Intelligence & Admin Desk:** Vector search with pgvector (`research_note`, 64-d embedding engine, HNSW cosine ranking), quote administration, automated PostgreSQL price audit trigger and table (`trg_stock_price_change`, `stock_price_audit`), role-based access control, and research/admin UI ([architecture guide](docs/RESEARCH_ADMIN_DESIGN.md)). |

---

## Mini Project Evaluation Rubric (14 Deliverables)

A complete demonstration mapping for the 14 project evaluation deliverables is maintained in [`docs/DEMO_RUBRIC.md`](docs/DEMO_RUBRIC.md):

| # | Rubric Deliverable | Repository Evidence / Demonstration Location |
|---|---|---|
| **1** | **ER Diagram** | [`docs/DEMO_RUBRIC.md`](docs/DEMO_RUBRIC.md#1-er-diagram), [`docs/RESEARCH_ADMIN_DESIGN.md`](docs/RESEARCH_ADMIN_DESIGN.md#3-complete-system-er-diagram) |
| **2** | **Relational Schema (Keys & Constraints)** | [`docs/DEMO_RUBRIC.md`](docs/DEMO_RUBRIC.md#2-relational-schema-with-keys-relationships-and-constraints), [`sql/schema.sql`](sql/schema.sql) |
| **3** | **SQL Implementation (DDL with Constraints)** | [`sql/schema.sql`](sql/schema.sql) (Primary/Foreign keys, CHECK, UNIQUE, NOT NULL, DEFAULT, CASCADE) |
| **4** | **NoSQL / Vector Database Creation** | [`sql/schema.sql`](sql/schema.sql#L1-L47) (`CREATE EXTENSION vector`, `research_note`, HNSW index) |
| **5** | **Technology Justification** | [`docs/DEMO_RUBRIC.md`](docs/DEMO_RUBRIC.md#5-technology-justification) (PostgreSQL ACID vs standalone vector DBs, Next.js) |
| **6** | **DML Operations (INSERT, SELECT, UPDATE, DELETE)** | [`app/api/[...path]/route.js`](app/api/[...path]/route.js), [`sql/queries.sql`](sql/queries.sql) |
| **7** | **Nested, Correlated, Recursive & Join SQL Queries** | [`sql/queries.sql`](sql/queries.sql) (Multi-table JOIN, Subquery, Correlated `EXISTS`, Recursive CTE) |
| **8** | **Advanced SQL (Procedures/Functions, Triggers, CTEs)** | `execute_paper_trade` (PL/pgSQL), `trg_stock_price_change` (Trigger), `portfolio_view`, CTEs |
| **9** | **Vector Features & RUD Operations** | [`lib/vector.mjs`](lib/vector.mjs), [`sql/queries.sql`](sql/queries.sql#L26-L34) (Create, Read/Search, Update, Delete) |
| **10** | **Next.js Interface** | [`app/page.js`](app/page.js) (Investor Dashboard, Market Board, Research Desk, Admin Portal) |
| **11** | **Backend/API & Database Integration** | [`app/api/[...path]/route.js`](app/api/[...path]/route.js) (REST route handlers, parameterization, Zod validation) |
| **12** | **Authentication & RBAC (Minimum 2 Roles)** | `app_user.role` (`investor`, `admin`), bcrypt, SHA-256 session tokens, server-side route guards |
| **13** | **Documentation & Git / GitHub** | Clean history, PR [#3](https://github.com/Debaditya-1729/stocklens-dbms-project/pull/3) merged, Issues [#1](https://github.com/Debaditya-1729/stocklens-dbms-project/issues/1) & [#2](https://github.com/Debaditya-1729/stocklens-dbms-project/issues/2) closed, verified contributors |
| **14** | **Originality, Individual Contribution & Viva** | Distinct contribution split, educational domain originality, [viva guide](docs/DEMO_RUBRIC.md#14-originality-individual-contribution-and-viva-guide) |

---

## Key Features

### 1. Relational Trading & Portfolio Core (Part 1)
- **Atomic paper execution:** `execute_paper_trade` acquires row locks on account, stock, and holding; computes weighted average cost; deducts virtual funds; updates holdings; and inserts trade records inside a single atomic SQL transaction.
- **Fail-safe consistency:** Over-selling shares or exceeding virtual cash raises a PostgreSQL exception, completely rolling back balance, holding, and trade tables.
- **Portfolio view:** `portfolio_view` computes real-time derived market valuation and unrealized profit/loss based on current stock prices.

### 2. Vector Semantic Intelligence & Audit Engine (Part 2)
- **pgvector semantic search:** Research notes and search queries are mapped into a 64-dimensional normalized vector space with financial domain projections and feature hashing, ranked using pgvector's native cosine distance operator (`<=>`).
- **HNSW vector index:** Indexed using `hnsw (embedding vector_cosine_ops)` for sub-millisecond approximate nearest neighbor retrieval.
- **Automated price audit trigger:** The PostgreSQL `trg_stock_price_change` trigger automatically captures every quote update made by an administrator, logging old price, new price, and timestamp into `stock_price_audit`.
- **Role-based administration:** Server-side RBAC protects quote updates and analyst note publishing, ensuring investor sessions cannot execute administrative operations.

---

## Setup & Running Locally (Windows PowerShell)

Requires **Node.js 20.9+** (Node 22+ recommended), **Docker Desktop** (with Linux containers running), and internet access for initial dependency installation.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Open `.env.local` in your editor. Set your desired database password in `DATABASE_URL` and `POSTGRES_PASSWORD`, and choose passwords for `DEMO_INVESTOR_PASSWORD` and `DEMO_ADMIN_PASSWORD` (minimum 10 characters).

Then start the database and seed the system:

```powershell
Copy-Item .env.local .env
docker compose up -d --wait
npm run db:init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo accounts
- **Investor account:** `investor@stocklens.local` (password: `DEMO_INVESTOR_PASSWORD`)
- **Admin account:** `admin@stocklens.local` (password: `DEMO_ADMIN_PASSWORD` or `DEMO_INVESTOR_PASSWORD`)

To stop the services:
- Web server: `Ctrl+C`
- Database: `docker compose down` (do **not** use `-v` unless you wish to purge the database volume).

---

## Alternative Embedded Demo (No Docker Required)

If Docker is unavailable, StockLens runs entirely via an embedded PostgreSQL-compatible engine (PGlite with vector extension):
1. Copy `.env.example` to `.env.local`.
2. Set `DEMO_INVESTOR_PASSWORD=your_password_10_chars`.
3. Uncomment `DATABASE_MODE=embedded` and `PGLITE_DIR=./.pglite`.
4. Run:
   ```powershell
   npm ci
   npm run db:init
   npm run dev
   ```

---

## Testing & Verification

Run the full automated test suite covering both relational transactions and vector similarity search:

```powershell
npm test
```

Verify the production build:

```powershell
npm run build
```

---

## Project Documentation

- **Mini Project Demo Deliverables & Viva Guide:** [`docs/DEMO_RUBRIC.md`](docs/DEMO_RUBRIC.md)
- **Investor Core Design & Schema:** [`docs/INVESTOR_DESIGN.md`](docs/INVESTOR_DESIGN.md)
- **Market Intelligence, Vector Search & Admin Design:** [`docs/RESEARCH_ADMIN_DESIGN.md`](docs/RESEARCH_ADMIN_DESIGN.md)
- **Verification & Test Report:** [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md)
- **SQL DDL & Triggers:** [`sql/schema.sql`](sql/schema.sql)
- **SQL Demonstration Queries:** [`sql/queries.sql`](sql/queries.sql)

---

## Security & Limitations

This educational prototype simulates market dynamics and database concepts. It does not provide real market connectivity, deposit/withdrawal rails, financial execution, or investment advice. In production, applications require HTTPS, TLS encryption, strict rate limiting, database connection pooling, and continuous security audits. Never commit `.env` or plain-text credentials to version control.
