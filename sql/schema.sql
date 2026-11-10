CREATE TABLE IF NOT EXISTS app_user (
 id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE CHECK (email=lower(email) AND length(email) BETWEEN 3 AND 254),
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('investor','admin')),
 cash NUMERIC(18,2) NOT NULL DEFAULT 100000.00 CHECK(cash>=0), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS session (
 token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS stock (
 id BIGSERIAL PRIMARY KEY, symbol VARCHAR(12) NOT NULL UNIQUE CHECK(symbol ~ '^[A-Z0-9]{1,12}$'),
 company TEXT NOT NULL, sector TEXT NOT NULL, price NUMERIC(18,2) NOT NULL CHECK(price>0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS holding (
 user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE, stock_id BIGINT NOT NULL REFERENCES stock(id),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0), avg_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(avg_cost>=0),
 PRIMARY KEY(user_id,stock_id));
CREATE TABLE IF NOT EXISTS trade (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES app_user(id), stock_id BIGINT NOT NULL REFERENCES stock(id),
 side TEXT NOT NULL CHECK(side IN ('BUY','SELL')), quantity INTEGER NOT NULL CHECK(quantity>0),
 price NUMERIC(18,2) NOT NULL CHECK(price>0), executed_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS watchlist (
 user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE, stock_id BIGINT NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,stock_id));
CREATE INDEX IF NOT EXISTS idx_trade_user_time ON trade(user_id,executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_expiry ON session(expires_at);
CREATE OR REPLACE VIEW portfolio_view AS
 SELECT h.user_id, s.id AS stock_id,s.symbol,s.company,s.sector,h.quantity,h.avg_cost,s.price,
 (h.quantity*s.price)::numeric(18,2) AS market_value,
 (h.quantity*(s.price-h.avg_cost))::numeric(18,2) AS unrealized_pl
 FROM holding h JOIN stock s ON s.id=h.stock_id WHERE h.quantity>0;
-- The caller executes this as one atomic SQL statement. Lock order is user then stock then holding.
CREATE OR REPLACE FUNCTION execute_paper_trade(p_user BIGINT,p_stock BIGINT,p_side TEXT,p_qty INTEGER)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE u app_user%ROWTYPE; s stock%ROWTYPE; h holding%ROWTYPE; t BIGINT; cost NUMERIC(18,2);
BEGIN
 IF p_side IS NULL OR p_side NOT IN ('BUY','SELL') OR p_qty IS NULL OR p_qty<1 OR p_qty>100000 THEN RAISE EXCEPTION 'Invalid trade'; END IF;
 SELECT * INTO u FROM app_user WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 SELECT * INTO s FROM stock WHERE id=p_stock FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stock not found'; END IF;
 INSERT INTO holding(user_id,stock_id) VALUES(p_user,p_stock) ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM holding WHERE user_id=p_user AND stock_id=p_stock FOR UPDATE;
 cost := s.price*p_qty;
 IF p_side='BUY' THEN
  IF u.cash<cost THEN RAISE EXCEPTION 'Insufficient cash'; END IF;
  UPDATE app_user SET cash=cash-cost WHERE id=p_user;
  UPDATE holding SET avg_cost=((h.quantity*h.avg_cost)+cost)/(h.quantity+p_qty),quantity=h.quantity+p_qty WHERE user_id=p_user AND stock_id=p_stock;
 ELSE
  IF h.quantity<p_qty THEN RAISE EXCEPTION 'Insufficient shares'; END IF;
  UPDATE app_user SET cash=cash+cost WHERE id=p_user;
  UPDATE holding SET quantity=h.quantity-p_qty, avg_cost=CASE WHEN h.quantity=p_qty THEN 0 ELSE h.avg_cost END WHERE user_id=p_user AND stock_id=p_stock;
 END IF;
 INSERT INTO trade(user_id,stock_id,side,quantity,price) VALUES(p_user,p_stock,p_side,p_qty,s.price) RETURNING id INTO t;
 RETURN t;
END $$;
