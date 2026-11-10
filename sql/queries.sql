-- ============================================================================
-- Part 1: Investor queries (Debaditya)
-- ============================================================================

-- 1. Current holdings with derived market value and unrealized profit/loss.
SELECT * FROM portfolio_view WHERE user_id = 1 ORDER BY market_value DESC;

-- 2. Trade volume by stock, using JOIN, GROUP BY, HAVING, ORDER BY and SUM.
SELECT s.symbol, SUM(t.quantity) AS shares
FROM trade t JOIN stock s ON s.id=t.stock_id
GROUP BY s.symbol HAVING SUM(t.quantity)>0 ORDER BY shares DESC;

-- 3. Stocks priced above the current average (subquery).
SELECT symbol, price FROM stock WHERE price > (SELECT AVG(price) FROM stock) ORDER BY price DESC;

-- 4. Safe demonstrations of ALTER and DROP on a temporary teaching table.
CREATE TEMP TABLE ddl_demo (id integer PRIMARY KEY);
ALTER TABLE ddl_demo ADD COLUMN label text;
DROP TABLE ddl_demo;


-- ============================================================================
-- Part 2: Vector search, price audit & admin queries (Dhadhal)
-- ============================================================================

-- 5. pgvector Cosine Similarity Search on Research Notes:
-- Uses the <=> cosine distance operator and HNSW vector index.
-- Calculates cosine similarity as (1 - cosine_distance) and ranks most relevant notes first.
SELECT r.id, s.symbol, s.company, r.title, r.sentiment,
       ROUND((1 - (r.embedding <=> '[0,0,0.85,0,0,0.28,0,0,0,0,0,0,0.09,-0.07,0,-0.09,0,0,0.07,0,0.09,0,0.07,0,0,0,0,0,0.09,0,0,-0.07,0,0,0.07,0,0,0,0.07,-0.25,0,0,0.09,0,0.09,0,0.07,0,0.09,0,0,0,0.07,0,0.07,0,0,0,0,-0.09,0,-0.07,0,0]'::vector))::numeric, 4) AS similarity_score
FROM research_note r
JOIN stock s ON s.id = r.stock_id
ORDER BY r.embedding <=> '[0,0,0.85,0,0,0.28,0,0,0,0,0,0,0.09,-0.07,0,-0.09,0,0,0.07,0,0.09,0,0.07,0,0,0,0,0,0.09,0,0,-0.07,0,0,0.07,0,0,0,0.07,-0.25,0,0,0.09,0,0.09,0,0.07,0,0.09,0,0,0,0.07,0,0.07,0,0,0,0,-0.09,0,-0.07,0,0]'::vector ASC
LIMIT 5;

-- 6. Price change audit trail with price delta and percentage jump:
-- Joins stock_price_audit with stock to inspect revisions triggered by admin price updates.
SELECT a.id, s.symbol, s.company, a.old_price, a.new_price,
       (a.new_price - a.old_price) AS price_diff,
       ROUND(((a.new_price - a.old_price) / a.old_price * 100)::numeric, 2) AS pct_change,
       a.changed_at
FROM stock_price_audit a
JOIN stock s ON s.id = a.stock_id
ORDER BY a.changed_at DESC;

-- 7. Correlated subquery: stocks whose latest research sentiment is BULLISH
-- and currently held by at least one active investor.
SELECT s.symbol, s.company, s.price
FROM stock s
WHERE EXISTS (
  SELECT 1 FROM research_note r
  WHERE r.stock_id = s.id AND r.sentiment = 'BULLISH'
) AND s.id IN (
  SELECT stock_id FROM holding WHERE quantity > 0
)
ORDER BY s.price DESC;

-- 8. Aggregation with GROUP BY, MIN, MAX and COUNT: price volatility summary from audit history.
SELECT s.symbol,
       COUNT(a.id) AS total_revisions,
       MIN(a.old_price) AS historic_low,
       MAX(a.new_price) AS historic_high,
       s.price AS current_quote
FROM stock s
LEFT JOIN stock_price_audit a ON a.stock_id = s.id
GROUP BY s.id, s.symbol, s.price
ORDER BY total_revisions DESC, s.symbol;
