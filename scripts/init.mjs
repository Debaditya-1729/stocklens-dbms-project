import {readFile} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import {getDb} from '../lib/db.mjs';
import {generateEmbedding, toVectorLiteral} from '../lib/vector.mjs';

// Next loads .env.local; this script reads it explicitly without leaking it.
try {
  for (const line of (await readFile('.env.local', 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

if (!process.env.DEMO_INVESTOR_PASSWORD || process.env.DEMO_INVESTOR_PASSWORD.length < 10 || Buffer.byteLength(process.env.DEMO_INVESTOR_PASSWORD, 'utf8') > 72) {
  throw Error('Set DEMO_INVESTOR_PASSWORD in .env.local (10+ characters, at most 72 UTF-8 bytes)');
}
const adminPassword = process.env.DEMO_ADMIN_PASSWORD || process.env.DEMO_INVESTOR_PASSWORD;

const db = await getDb();
await db.exec(await readFile('sql/schema.sql', 'utf8'));

// Seed accounts: investor and admin
const accounts = [
  ['investor@stocklens.local', 'investor', process.env.DEMO_INVESTOR_PASSWORD],
  ['admin@stocklens.local', 'admin', adminPassword]
];
for (const [email, role, password] of accounts) {
  await db.query(
    'INSERT INTO app_user(email, role, password_hash) VALUES($1, $2, $3) ON CONFLICT(email) DO NOTHING',
    [email, role, await bcrypt.hash(password, 12)]
  );
}

// Seed fictional stocks
const stocks = [
  ['ORBT', 'Orbit Software', 'Technology', 2450],
  ['RIVR', 'Riverbank Financial', 'Banking', 860],
  ['SUNV', 'Sunvale Energy', 'Energy', 1260],
  ['MOTR', 'Meridian Motors', 'Automotive', 710],
  ['NOVA', 'Nova Healthcare', 'Healthcare', 1580],
  ['GRID', 'Gridline Power', 'Utilities', 430]
];
for (const s of stocks) {
  await db.query(
    'INSERT INTO stock(symbol, company, sector, price) VALUES($1, $2, $3, $4) ON CONFLICT(symbol) DO NOTHING',
    s
  );
}

// Seed initial market research notes with pgvector embeddings
const adminUser = (await db.query("SELECT id FROM app_user WHERE email='admin@stocklens.local'")).rows[0];
const stockRows = (await db.query('SELECT id, symbol FROM stock')).rows;
const stockMap = Object.fromEntries(stockRows.map(s => [s.symbol, s.id]));

const initialNotes = [
  {
    symbol: 'ORBT',
    title: 'Enterprise Cloud AI Platform ARR Expansion',
    sentiment: 'BULLISH',
    content: 'Orbit Software reported accelerating annualized recurring revenue across enterprise cloud computing and automated AI software workloads. Operating margins expanded by 340 basis points with robust multi-year customer commitments.'
  },
  {
    symbol: 'RIVR',
    title: 'Net Interest Margin Stability and Asset Quality Review',
    sentiment: 'BULLISH',
    content: 'Riverbank Financial maintains pristine capital adequacy ratios above regulatory requirements. Core retail deposit franchise remains sticky amid central bank monetary policy shifts, cushioning net interest spread compression.'
  },
  {
    symbol: 'SUNV',
    title: 'Solar Tariff Pressures and Cell Inventory Headwinds',
    sentiment: 'BEARISH',
    content: 'Sunvale Energy encounters near-term margin erosion following overseas photovoltaic cell tariff adjustments and domestic grid connection delays. Working capital cycle lengthened due to surplus inventory.'
  },
  {
    symbol: 'MOTR',
    title: 'Commercial Fleet EV Delivery Ramp and Battery Sourcing',
    sentiment: 'NEUTRAL',
    content: 'Meridian Motors commenced serial production of its medium-duty commercial electric vehicle platform. Raw battery pack procurement costs stabilized, but charging infrastructure lead times remain a minor bottleneck.'
  },
  {
    symbol: 'NOVA',
    title: 'Oncology Phase III Therapeutic Efficacy Milestone',
    sentiment: 'BULLISH',
    content: 'Nova Healthcare announced statistically significant progression-free survival results in its pivotal Phase III clinical trial for lead oncology therapeutic candidate. Regulatory submission timeline advanced by two quarters.'
  },
  {
    symbol: 'GRID',
    title: 'Regulated Transmission Asset Return and Capital Expenditure',
    sentiment: 'NEUTRAL',
    content: 'Gridline Power secured regulatory approval for multi-state high-voltage corridor expansion. Guaranteed return on equity provides resilient cashflow backing ongoing steady dividend distributions.'
  }
];

const existingNotes = (await db.query('SELECT COUNT(*) AS c FROM research_note')).rows[0].c;
if (Number(existingNotes) === 0 && adminUser) {
  for (const n of initialNotes) {
    const stockId = stockMap[n.symbol];
    if (!stockId) continue;
    const emb = toVectorLiteral(generateEmbedding(n.title + ' ' + n.content));
    await db.query(
      'INSERT INTO research_note(stock_id, author_id, title, content, sentiment, embedding) VALUES($1, $2, $3, $4, $5, $6::vector)',
      [stockId, adminUser.id, n.title, n.content, n.sentiment, emb]
    );
  }
}

// Seed an initial price audit entry for demonstration if table is empty
const auditCount = (await db.query('SELECT COUNT(*) AS c FROM stock_price_audit')).rows[0].c;
if (Number(auditCount) === 0 && stockMap['ORBT']) {
  await db.query(
    'INSERT INTO stock_price_audit(stock_id, old_price, new_price, changed_at) VALUES($1, 2380.00, 2450.00, now() - interval \'1 day\')',
    [stockMap['ORBT']]
  );
}

console.log('Database ready. Fictional demo stocks, admin account, price audit, and vector research notes seeded.');
await db.close();
