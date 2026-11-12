-- ============================================================================
-- StockLens DBMS Rubric Queries (UE24CS351A)
-- Demonstrating Deliverables 6, 7, 8, and 9
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 1: Investor Core Relational Queries (Debaditya — PES1UG24CS140)
-- ----------------------------------------------------------------------------

-- 1. View Query & Computed Columns:
-- Current user portfolio with derived market value and unrealized profit/loss.
SELECT * FROM portfolio_view WHERE user_id = 1 ORDER BY market_value DESC;

-- 2. Multi-Table Join with Aggregates, GROUP BY, and HAVING:
-- Aggregate trade volume per stock symbol, filtering for active trading volume.
SELECT s.symbol, SUM(t.quantity) AS shares
FROM trade t JOIN stock s ON s.id = t.stock_id
GROUP BY s.symbol HAVING SUM(t.quantity) > 0 ORDER BY shares DESC;

-- 3. Nested Subquery:
-- Stocks priced higher than the arithmetic mean of all listed stock prices.
SELECT symbol, company, price 
FROM stock 
WHERE price > (SELECT AVG(price) FROM stock) 
ORDER BY price DESC;

-- 4. Safe DDL Demonstrations (CREATE, ALTER, DROP):
CREATE TEMP TABLE ddl_demo (id integer PRIMARY KEY);
ALTER TABLE ddl_demo ADD COLUMN label text;
DROP TABLE ddl_demo;


-- ----------------------------------------------------------------------------
-- Part 2: Vector Search, Price Audit & Admin Queries (Dhadhal — PES1UG24CS146)
-- ----------------------------------------------------------------------------

-- 5. Vector Cosine Similarity Search (Deliverables 4 & 9):
-- Uses pgvector's <=> cosine distance operator with HNSW index (vector_cosine_ops).
-- Computes similarity score as 1 - cosine_distance and ranks top matching analyst notes.
SELECT r.id, s.symbol, s.company, r.title, r.sentiment,
       ROUND((1 - (r.embedding <=> '[0,0,0.85,0,0,0.28,0,0,0,0,0,0,0.09,-0.07,0,-0.09,0,0,0.07,0,0.09,0,0.07,0,0,0,0,0,0.09,0,0,-0.07,0,0,0.07,0,0,0,0.07,-0.25,0,0,0.09,0,0.09,0,0.07,0,0.09,0,0,0,0.07,0,0.07,0,0,0,0,-0.09,0,-0.07,0,0]'::vector))::numeric, 4) AS similarity_score
FROM research_note r
JOIN stock s ON s.id = r.stock_id
ORDER BY r.embedding <=> '[0,0,0.85,0,0,0.28,0,0,0,0,0,0,0.09,-0.07,0,-0.09,0,0,0.07,0,0.09,0,0.07,0,0,0,0,0,0.09,0,0,-0.07,0,0,0.07,0,0,0,0.07,-0.25,0,0,0.09,0,0.09,0,0.07,0,0.09,0,0,0,0.07,0,0.07,0,0,0,0,-0.09,0,-0.07,0,0]'::vector ASC
LIMIT 5;

-- 6. Trigger-Driven Audit Trail Join & Arithmetic Projections (Deliverable 8):
-- Inspects historical quote revisions recorded automatically by trg_stock_price_change.
SELECT a.id, s.symbol, s.company, a.old_price, a.new_price,
       (a.new_price - a.old_price) AS price_diff,
       ROUND(((a.new_price - a.old_price) / a.old_price * 100)::numeric, 2) AS pct_change,
       a.changed_at
FROM stock_price_audit a
JOIN stock s ON s.id = a.stock_id
ORDER BY a.changed_at DESC;

-- 7. Correlated Subquery with EXISTS (Deliverable 7):
-- Finds stocks whose latest research sentiment is BULLISH and are currently held by active investors.
SELECT s.symbol, s.company, s.price
FROM stock s
WHERE EXISTS (
  SELECT 1 FROM research_note r
  WHERE r.stock_id = s.id AND r.sentiment = 'BULLISH'
) AND s.id IN (
  SELECT stock_id FROM holding WHERE quantity > 0
)
ORDER BY s.price DESC;

-- 8. Aggregation with GROUP BY, MIN, MAX, and COUNT (Deliverable 7):
-- Historical price volatility summary generated from the price audit table.
SELECT s.symbol,
       COUNT(a.id) AS total_revisions,
       MIN(a.old_price) AS historic_low,
       MAX(a.new_price) AS historic_high,
       s.price AS current_quote
FROM stock s
LEFT JOIN stock_price_audit a ON a.stock_id = s.id
GROUP BY s.id, s.symbol, s.price
ORDER BY total_revisions DESC, s.symbol;

-- 9. Recursive Common Table Expression (CTE) (Deliverable 7 & 8):
-- Simulates a 5-step compounding price growth trajectory for a stock.
WITH RECURSIVE price_projection AS (
  SELECT id, symbol, price AS projected_price, 0 AS step
  FROM stock
  WHERE symbol = 'ORBT'
  UNION ALL
  SELECT id, symbol, ROUND((projected_price * 1.02)::numeric, 2), step + 1
  FROM price_projection
  WHERE step < 5
)
SELECT step, symbol, projected_price FROM price_projection;

-- 10. Non-Recursive CTE with Window Function (Deliverable 8):
-- Ranks recent trades partitioned by user.
WITH user_recent_trades AS (
  SELECT t.id, t.user_id, s.symbol, t.side, t.quantity, t.price, t.executed_at,
         ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.executed_at DESC) AS trade_seq
  FROM trade t
  JOIN stock s ON s.id = t.stock_id
)
SELECT u.email, r.symbol, r.side, r.quantity, r.price, r.executed_at
FROM user_recent_trades r
JOIN app_user u ON u.id = r.user_id
WHERE r.trade_seq <= 3;

-- 11. Vector RUD Operations in SQL (Deliverable 9):
-- Create (Insert vector note):
-- INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding)
-- VALUES(1, 1, 'Cloud Expansion', 'Enterprise AI workloads expand...', 'BULLISH', '[0.1, 0.2, ...]'::vector);

-- Read (Similarity Search):
-- Handled in Query 5 above.

-- Update (Modify vector note and embedding):
-- UPDATE research_note
-- SET sentiment = 'BULLISH', updated_at = now()
-- WHERE id = 1;

-- Delete (Remove vector note):
-- DELETE FROM research_note WHERE id = 1;
