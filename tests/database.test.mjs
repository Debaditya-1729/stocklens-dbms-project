import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { readFile } from 'node:fs/promises';
import { generateEmbedding, toVectorLiteral } from '../lib/vector.mjs';

test('paper trades enforce consistency, validation and portfolio valuation', async () => {
  const db = new PGlite({ extensions: { vector } }); await db.waitReady;
  try {
    await db.exec(await readFile('sql/schema.sql', 'utf8'));
    await db.exec("INSERT INTO app_user(email,password_hash,role,cash) VALUES('a@test.org','hash','investor',1000),('b@test.org','hash','investor',500); INSERT INTO stock(symbol,company,sector,price) VALUES('TEST','Test','Test',100)");
    await db.query("SELECT execute_paper_trade(1,1,'BUY',3)");
    assert.equal(+(await db.query('SELECT cash FROM app_user WHERE id=1')).rows[0].cash, 700);
    assert.equal((await db.query('SELECT quantity FROM holding WHERE user_id=1')).rows[0].quantity, 3);
    for (const [side,qty,message] of [['BUY',100,/Insufficient cash/],['SELL',4,/Insufficient shares/],['BUY',0,/Invalid trade/]]) {
      await assert.rejects(db.query('SELECT execute_paper_trade(1,1,$1,$2)', [side,qty]), message);
    }
    assert.equal(+(await db.query('SELECT cash FROM app_user WHERE id=1')).rows[0].cash, 700);
    assert.equal((await db.query('SELECT quantity FROM holding WHERE user_id=1')).rows[0].quantity, 3);
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM trade')).rows[0].n), 1);
    await db.query("SELECT execute_paper_trade(1,1,'SELL',2)");
    assert.equal(+(await db.query('SELECT cash FROM app_user WHERE id=1')).rows[0].cash, 900);
    assert.equal((await db.query('SELECT quantity FROM holding WHERE user_id=1')).rows[0].quantity, 1);
    assert.equal(+(await db.query('SELECT market_value FROM portfolio_view WHERE user_id=1')).rows[0].market_value, 100);
    await assert.rejects(db.query('UPDATE stock SET price=-1 WHERE id=1'));
    await assert.rejects(db.query("INSERT INTO app_user(email,password_hash,role) VALUES('a@test.org','hash','admin')"));
    await assert.rejects(db.query("INSERT INTO watchlist(user_id,stock_id) VALUES(1,999)"));
    await db.query('INSERT INTO watchlist(user_id,stock_id) VALUES(1,1)');
    await db.query('DELETE FROM watchlist WHERE user_id=1 AND stock_id=1');
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM watchlist')).rows[0].n), 0);
  } finally { await db.close(); }
});

test('price audit trigger records price changes accurately and rejects invalid updates', async () => {
  const db = new PGlite({ extensions: { vector } }); await db.waitReady;
  try {
    await db.exec(await readFile('sql/schema.sql', 'utf8'));
    await db.exec("INSERT INTO stock(symbol,company,sector,price) VALUES('ORBT','Orbit Software','Technology',2400.00)");
    
    // Update price from 2400 to 2550
    await db.query('UPDATE stock SET price=2550.00 WHERE symbol=$1', ['ORBT']);
    
    const auditRows = (await db.query('SELECT * FROM stock_price_audit WHERE stock_id=1')).rows;
    assert.equal(auditRows.length, 1);
    assert.equal(+auditRows[0].old_price, 2400.00);
    assert.equal(+auditRows[0].new_price, 2550.00);
    assert.ok(auditRows[0].changed_at);

    // Update with same price should NOT create an audit entry
    await db.query('UPDATE stock SET company=$1 WHERE symbol=$2', ['Orbit Software Inc', 'ORBT']);
    const auditRowsAfterNoPriceChange = (await db.query('SELECT * FROM stock_price_audit WHERE stock_id=1')).rows;
    assert.equal(auditRowsAfterNoPriceChange.length, 1);

    // Negative or zero price should be rejected by constraint without creating audit entry
    await assert.rejects(db.query('UPDATE stock SET price=-50 WHERE symbol=$1', ['ORBT']));
    await assert.rejects(db.query('UPDATE stock SET price=0 WHERE symbol=$1', ['ORBT']));

    // Second valid price change
    await db.query('UPDATE stock SET price=2600.00 WHERE symbol=$1', ['ORBT']);
    const secondAudit = (await db.query('SELECT * FROM stock_price_audit WHERE stock_id=1 ORDER BY changed_at DESC')).rows;
    assert.equal(secondAudit.length, 2);
    assert.equal(+secondAudit[0].old_price, 2550.00);
    assert.equal(+secondAudit[0].new_price, 2600.00);
  } finally { await db.close(); }
});

test('research notes and pgvector similarity search rank relevant market research', async () => {
  const db = new PGlite({ extensions: { vector } }); await db.waitReady;
  try {
    await db.exec(await readFile('sql/schema.sql', 'utf8'));
    await db.exec("INSERT INTO app_user(email,password_hash,role) VALUES('admin@stocklens.local','hash','admin')");
    await db.exec("INSERT INTO stock(symbol,company,sector,price) VALUES('ORBT','Orbit Software','Technology',2450),('SUNV','Sunvale Energy','Energy',1260)");

    const text1 = 'Orbit Software announces massive cloud AI platform revenue surge and enterprise contracts';
    const text2 = 'Sunvale Energy expands solar renewable clean power grid installations across Gujarat';

    const emb1 = toVectorLiteral(generateEmbedding(text1));
    const emb2 = toVectorLiteral(generateEmbedding(text2));

    await db.query(
      "INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding) VALUES(1, 1, 'Orbit Cloud AI Surge', $1, 'BULLISH', $2::vector)",
      [text1, emb1]
    );
    await db.query(
      "INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding) VALUES(2, 1, 'Sunvale Solar Grid Expansion', $1, 'BULLISH', $2::vector)",
      [text2, emb2]
    );

    // Semantic query targeting Orbit's software & AI business
    const queryText = 'cloud AI enterprise software revenue';
    const queryEmb = toVectorLiteral(generateEmbedding(queryText));

    const searchRes = await db.query(
      `SELECT r.id, s.symbol, r.title, (1 - (r.embedding <=> $1::vector)) AS similarity
       FROM research_note r
       JOIN stock s ON s.id = r.stock_id
       ORDER BY r.embedding <=> $1::vector ASC`,
      [queryEmb]
    );

    assert.equal(searchRes.rows.length, 2);
    // Orbit should be ranked first with high similarity
    assert.equal(searchRes.rows[0].symbol, 'ORBT');
    assert.ok(+searchRes.rows[0].similarity > 0.70, `Expected similarity > 0.70, got ${searchRes.rows[0].similarity}`);
    // Sunvale should be ranked second with low similarity
    assert.equal(searchRes.rows[1].symbol, 'SUNV');
    assert.ok(+searchRes.rows[1].similarity < 0.35, `Expected similarity < 0.35, got ${searchRes.rows[1].similarity}`);

    // Test constraints on research_note
    await assert.rejects(
      db.query("INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding) VALUES(1, 1, 'Hi', 'Too short title', 'BULLISH', $1::vector)", [emb1]),
      /CHECK/i
    );
    await assert.rejects(
      db.query("INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding) VALUES(1, 1, 'Valid Title Here', 'short', 'BULLISH', $1::vector)", [emb1]),
      /CHECK/i
    );
    await assert.rejects(
      db.query("INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding) VALUES(1, 1, 'Valid Title Here', 'Valid long content for research note.', 'UNKNOWN_SENTIMENT', $1::vector)", [emb1]),
      /CHECK/i
    );

    // Test cascade delete
    await db.query('DELETE FROM stock WHERE id=1');
    const notesLeft = (await db.query('SELECT COUNT(*) AS c FROM research_note WHERE stock_id=1')).rows[0].c;
    assert.equal(Number(notesLeft), 0);
  } finally { await db.close(); }
});

test('role integrity ensures distinct investor and admin capabilities', async () => {
  const db = new PGlite({ extensions: { vector } }); await db.waitReady;
  try {
    await db.exec(await readFile('sql/schema.sql', 'utf8'));
    await db.exec("INSERT INTO app_user(email,password_hash,role) VALUES('investor@test.org','hash','investor'),('admin@test.org','hash','admin')");
    // Invalid role rejected by CHECK constraint
    await assert.rejects(db.query("INSERT INTO app_user(email,password_hash,role) VALUES('bad@test.org','hash','superadmin')"));
    const inv = (await db.query("SELECT role FROM app_user WHERE email='investor@test.org'")).rows[0];
    const adm = (await db.query("SELECT role FROM app_user WHERE email='admin@test.org'")).rows[0];
    assert.equal(inv.role, 'investor');
    assert.equal(adm.role, 'admin');
  } finally { await db.close(); }
});
