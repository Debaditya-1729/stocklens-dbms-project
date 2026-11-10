import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

test('paper trades enforce consistency, validation and portfolio valuation', async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec(await readFile('sql/schema.sql', 'utf8'));
    await db.exec("INSERT INTO app_user(email,password_hash,role,cash) VALUES('a@test.org','hash','investor',1000),('b@test.org','hash','investor',500); INSERT INTO stock(symbol,company,sector,price) VALUES('TEST','Test','Test',100)");
    await db.query("SELECT execute_paper_trade(1,1,'BUY',3)");
    assert.equal(+(await db.query('SELECT cash FROM app_user WHERE id=1')).rows[0].cash,700);
    assert.equal((await db.query('SELECT quantity FROM holding WHERE user_id=1')).rows[0].quantity,3);
    for (const [side,qty,message] of [['BUY',100,/Insufficient cash/],['SELL',4,/Insufficient shares/],['BUY',0,/Invalid trade/]]) {
      await assert.rejects(db.query('SELECT execute_paper_trade(1,1,$1,$2)',[side,qty]),message);
    }
    assert.equal(+(await db.query('SELECT cash FROM app_user WHERE id=1')).rows[0].cash,700);
    assert.equal((await db.query('SELECT quantity FROM holding WHERE user_id=1')).rows[0].quantity,3);
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM trade')).rows[0].n),1);
    await db.query("SELECT execute_paper_trade(1,1,'SELL',2)");
    assert.equal(+(await db.query('SELECT cash FROM app_user WHERE id=1')).rows[0].cash,900);
    assert.equal((await db.query('SELECT quantity FROM holding WHERE user_id=1')).rows[0].quantity,1);
    assert.equal(+(await db.query('SELECT market_value FROM portfolio_view WHERE user_id=1')).rows[0].market_value,100);
    await assert.rejects(db.query('UPDATE stock SET price=-1 WHERE id=1'));
    await assert.rejects(db.query("INSERT INTO app_user(email,password_hash,role) VALUES('a@test.org','hash','admin')"));
    await assert.rejects(db.query("INSERT INTO watchlist(user_id,stock_id) VALUES(1,999)"));
    await db.query('INSERT INTO watchlist(user_id,stock_id) VALUES(1,1)');
    await db.query('DELETE FROM watchlist WHERE user_id=1 AND stock_id=1');
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM watchlist')).rows[0].n),0);
  } finally { await db.close(); }
});
