# StockLens system verification & test report

**UE24CS351A · Section C**  
Debaditya Chakrabarti (PES1UG24CS140) · Dhadhal Rudra (PES1UG24CS146)

---

## 1. Automated database integration tests (`npm test`)

The test suite runs against an isolated PostgreSQL-compatible engine with the official pgvector extension loaded. All four test suites pass completely:

1. **`paper trades enforce consistency, validation and portfolio valuation`**
   - Verified atomic execution of `execute_paper_trade` for BUY and SELL operations.
   - Verified that insufficient virtual cash raises exception and leaves user balance and holdings unchanged.
   - Verified that selling more shares than held raises exception and leaves holdings unchanged.
   - Verified that invalid order quantities (0 or negative) are rejected.
   - Verified portfolio view calculation of total market value and unrealized profit/loss.
   - Verified database constraints: negative stock prices and duplicate user emails are rejected.
   - Verified watchlist foreign keys, inserts, and cascade deletions.

2. **`price audit trigger records price changes accurately and rejects invalid updates`**
   - Verified that updating `stock.price` fires the `trg_stock_price_change` trigger.
   - Verified that `stock_price_audit` accurately records `old_price`, `new_price`, and timestamp.
   - Verified that updating non-price columns (e.g. company name) does not insert redundant audit entries.
   - Verified that updating a stock price to negative or zero is rejected by check constraint, leaving both stock and audit tables unpolluted.
   - Verified sequential audit trail across multiple price revisions.

3. **`research notes and pgvector similarity search rank relevant market research`**
   - Verified insertion of research notes with 64-dimensional pgvector embeddings.
   - Verified HNSW cosine distance operator (`<=>`) correctly ranks semantically relevant research notes with high similarity score (> 0.70) while unrelated notes score low (< 0.35).
   - Verified stock ID filtering in similarity search queries.
   - Verified length check constraints on note title (3–120 chars) and content (10–5000 chars), as well as sentiment enumeration (`BULLISH`, `BEARISH`, `NEUTRAL`).
   - Verified cascade deletion of research notes when a parent stock is deleted.

4. **`role integrity ensures distinct investor and admin capabilities`**
   - Verified role constraint allows only `'investor'` and `'admin'`.
   - Verified role isolation in database state and session retrieval.

---

## 2. Production build verification (`npm run build`)

- Successfully compiled Next.js 15 app router application with zero type or lint errors.
- Verified dynamic server routes (`/api/[...path]`) and client UI hydration.
- Bundle sizes verified: first load JS ~108 kB.

---

## 3. End-to-end user journey verification

- **Investor journey:**
  - Registered test investor account.
  - Executed paper BUY order on `ORBT` (Orbit Software); verified cash decremented and holdings updated in Portfolio.
  - Added and removed stocks from Watchlist.
  - Verified that Admin Portal is completely inaccessible to investor accounts.
- **Admin journey:**
  - Signed in as `admin@stocklens.local`.
  - Admin Portal rendered with "Update stock quote", "Publish research note", "Stock price audit log", and "Active research notes".
  - Updated stock quote for `ORBT`; observed immediate audit entry created by PostgreSQL trigger.
  - Published research note with sentiment; observed automatic 64-dimensional vector embedding generation and storage.
- **pgvector semantic search journey:**
  - Searched for `"enterprise cloud AI revenue"`: `ORBT` note ranked first with high similarity match percentage.
  - Searched for `"clean solar power grid tariffs"`: `SUNV` note ranked first with high similarity match percentage.
  - Filtered by company dropdown; confirmed filtered vector search query execution.
