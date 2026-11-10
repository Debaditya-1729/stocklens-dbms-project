import {readFile} from 'node:fs/promises'; import bcrypt from 'bcryptjs'; import {getDb} from '../lib/db.mjs';
// Next loads .env.local; this script reads it explicitly without leaking it.
try {for(const line of (await readFile('.env.local','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m && process.env[m[1]]===undefined)process.env[m[1]]=m[2];}}catch{}
if(!process.env.DEMO_INVESTOR_PASSWORD||process.env.DEMO_INVESTOR_PASSWORD.length<10||Buffer.byteLength(process.env.DEMO_INVESTOR_PASSWORD,'utf8')>72)throw Error('Set DEMO_INVESTOR_PASSWORD in .env.local (10+ characters, at most 72 UTF-8 bytes)');
const db=await getDb(); await db.exec(await readFile('sql/schema.sql','utf8'));
for(const [email,role,password] of [['investor@stocklens.local','investor',process.env.DEMO_INVESTOR_PASSWORD]]) await db.query('INSERT INTO app_user(email,role,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING',[email,role,await bcrypt.hash(password,12)]);
const stocks=[['ORBT','Orbit Software','Technology',2450],['RIVR','Riverbank Financial','Banking',860],['SUNV','Sunvale Energy','Energy',1260],['MOTR','Meridian Motors','Automotive',710],['NOVA','Nova Healthcare','Healthcare',1580],['GRID','Gridline Power','Utilities',430]];
for(const s of stocks)await db.query('INSERT INTO stock(symbol,company,sector,price) VALUES($1,$2,$3,$4) ON CONFLICT(symbol) DO NOTHING',s);
console.log('Database ready. Fictional demo stocks seeded. Existing users are not overwritten.'); await db.close();
