import {getDb} from '../../../lib/db.mjs';
import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {NextResponse} from 'next/server';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const hash=t=>createHash('sha256').update(t).digest('hex');
const json=(x,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'no-store'}});
const err=(message,status=400)=>json({error:message},status);
const number=z.coerce.number().int().min(1).max(100000);
async function who(db,req){const token=req.cookies.get('sl_session')?.value;if(!token)return null;return (await db.query('SELECT u.id,u.email,u.role,u.cash FROM session s JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(token)])).rows[0]||null;}
function checkOrigin(req){const origin=req.headers.get('origin');return origin && origin===new URL(req.url).origin;}
async function route(req,{params}){
 const {path}=await params;const key=path.join('/'); const method=req.method; const db=await getDb();
 if(method!=='GET' && !checkOrigin(req))return err('Invalid request origin',403);
 let body={};if(method!=='GET'){try{body=await req.json();}catch{return err('Invalid JSON');}}
 const user=await who(db,req);
 if(key==='auth/register'&&method==='POST'){
  const input=z.object({email:z.string().trim().email().max(254),password:z.string().min(10).max(72)}).parse(body);if(Buffer.byteLength(input.password,'utf8')>72)return err('Password must be at most 72 UTF-8 bytes');const email=input.email.toLowerCase();
  try{await db.query('INSERT INTO app_user(email,password_hash,role) VALUES($1,$2,\'investor\')',[email,await bcrypt.hash(input.password,12)]);}catch(e){if(e.code==='23505')return err('Account already exists',409);throw e;}
  return json({ok:true},201);
 }
 if(key==='auth/login'&&method==='POST'){
  const input=z.object({email:z.string().trim().email().max(254),password:z.string().max(72)}).parse(body);
  const u=(await db.query('SELECT id,password_hash FROM app_user WHERE email=$1',[input.email.toLowerCase()])).rows[0];
  if(!u||!await bcrypt.compare(input.password,u.password_hash))return err('Invalid email or password',401);
  const token=randomBytes(32).toString('hex');await db.query("INSERT INTO session(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[hash(token),u.id]);
  const r=json({ok:true});r.cookies.set('sl_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800});return r;
 }
 if(key==='auth/logout'&&method==='POST'){const token=req.cookies.get('sl_session')?.value;if(token)await db.query('DELETE FROM session WHERE token_hash=$1',[hash(token)]);const r=json({ok:true});r.cookies.set('sl_session','',{httpOnly:true,path:'/',maxAge:0,sameSite:'lax'});return r;}
 if(!user)return err('Please sign in',401);
 if(key==='me'&&method==='GET')return json(user);
 if(key==='stocks'&&method==='GET')return json((await db.query('SELECT id,symbol,company,sector,price,updated_at FROM stock ORDER BY symbol')).rows);
 if(key==='portfolio'&&method==='GET')return json((await db.query('SELECT * FROM portfolio_view WHERE user_id=$1 ORDER BY market_value DESC',[user.id])).rows);
 if(key==='trades'&&method==='GET')return json((await db.query('SELECT t.id,s.symbol,t.side,t.quantity,t.price,t.executed_at FROM trade t JOIN stock s ON s.id=t.stock_id WHERE t.user_id=$1 ORDER BY t.executed_at DESC,t.id DESC LIMIT 50',[user.id])).rows);
 if(key==='trade'&&method==='POST'){
  const x=z.object({stockId:number,quantity:number,side:z.enum(['BUY','SELL'])}).parse(body);
  try{const result=await db.query('SELECT execute_paper_trade($1,$2,$3,$4) AS id',[user.id,x.stockId,x.side,x.quantity]);return json({ok:true,id:result.rows[0].id});}catch(e){if(/Insufficient cash|Insufficient shares|Stock not found|Invalid trade/.test(e.message))return err(e.message.split('\n')[0]);throw e;}
 }
 if(key==='watchlist'&&method==='GET')return json((await db.query('SELECT s.id,s.symbol,s.company,s.sector,s.price FROM watchlist w JOIN stock s ON s.id=w.stock_id WHERE w.user_id=$1 ORDER BY s.symbol',[user.id])).rows);
 if(key==='watchlist'&&method==='POST'){const x=z.object({stockId:number}).parse(body);const exists=await db.query('SELECT id FROM stock WHERE id=$1',[x.stockId]);if(!exists.rows.length)return err('Stock not found',404);await db.query('INSERT INTO watchlist(user_id,stock_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,x.stockId]);return json({ok:true});}
 if(key==='watchlist'&&method==='DELETE'){const x=z.object({stockId:number}).parse(body);await db.query('DELETE FROM watchlist WHERE user_id=$1 AND stock_id=$2',[user.id,x.stockId]);return json({ok:true});}
 return err('Not found',404);
}
async function handle(req,ctx){try{return await route(req,ctx);}catch(e){if(e instanceof z.ZodError)return err(e.issues[0]?.message||'Invalid input');console.error('API error:',e);return err('Request could not be completed',500);}}
export const GET=handle;export const POST=handle;export const DELETE=handle;
