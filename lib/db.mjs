import pg from 'pg';
let singleton;
export async function getDb(){
 if(singleton)return singleton;
 if(process.env.DATABASE_MODE==='embedded'){
  const {PGlite}=await import('@electric-sql/pglite');
  const db=new PGlite(process.env.PGLITE_DIR||'./.pglite'); await db.waitReady;
  singleton={query:async(q,p=[])=>db.query(q,p),exec:async(q)=>db.exec(q),close:()=>db.close()};
 }else{
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
  singleton={query:(q,p=[])=>pool.query(q,p),exec:q=>pool.query(q),close:()=>pool.end()};
 }
 return singleton;
}
