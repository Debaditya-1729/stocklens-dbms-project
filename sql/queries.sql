-- Current holdings with derived market value and unrealized profit/loss.
SELECT * FROM portfolio_view WHERE user_id = 1 ORDER BY market_value DESC;
-- Trade volume by stock, using JOIN, GROUP BY, HAVING, ORDER BY and SUM.
SELECT s.symbol, SUM(t.quantity) AS shares
FROM trade t JOIN stock s ON s.id=t.stock_id
GROUP BY s.symbol HAVING SUM(t.quantity)>0 ORDER BY shares DESC;
-- Stocks priced above the current average (subquery).
SELECT symbol, price FROM stock WHERE price > (SELECT AVG(price) FROM stock) ORDER BY price DESC;
-- Safe demonstrations of ALTER and DROP on a temporary teaching table.
CREATE TEMP TABLE ddl_demo (id integer PRIMARY KEY);
ALTER TABLE ddl_demo ADD COLUMN label text;
DROP TABLE ddl_demo;
