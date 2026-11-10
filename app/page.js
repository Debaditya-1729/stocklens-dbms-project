'use client';
import {useEffect,useState} from 'react';
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
async function api(path,method='GET',data){
  const r=await fetch('/api/'+path,{
    method,
    headers:method==='GET'?{}:{'Content-Type':'application/json'},
    body:method==='GET'?undefined:JSON.stringify(data||{})
  });
  const v=await r.json();
  if(!r.ok)throw Error(v.error||'Request failed');
  return v;
}

export default function Home(){
  const [user,U]=useState(null),
        [stocks,S]=useState([]),
        [portfolio,P]=useState([]),
        [trades,T]=useState([]),
        [watch,W]=useState([]),
        [notes,N]=useState([]),
        [audit,A]=useState([]),
        [tab,B]=useState('overview'),
        [msg,M]=useState(''),
        [busy,Q]=useState(true),
        [authMode,AM]=useState('login'),
        [searchQ,SQ]=useState(''),
        [stockFilter,SF]=useState('all');

  async function loadResearch(qVal=searchQ, stockVal=stockFilter){
    try{
      const paramQ = encodeURIComponent(qVal.trim());
      const res = await api(`research/search?q=${paramQ}&stockId=${stockVal}`);
      N(res);
    }catch(e){
      M(e.message);
    }
  }

  async function loadAudit(){
    try{
      const res = await api('admin/audit');
      A(res);
    }catch(e){
      // Ignore if not admin
    }
  }

  async function refresh(){
    try{
      const me=await api('me');
      U(me);
      const [s,p,t,w]=await Promise.all(['stocks','portfolio','trades','watchlist'].map(x=>api(x)));
      S(s);P(p);T(t);W(w);
      await loadResearch(searchQ, stockFilter);
      if(me?.role==='admin') await loadAudit();
    }catch(e){
      if(e.message==='Please sign in')U(null);
      else M(e.message);
    }finally{
      Q(false);
    }
  }

  useEffect(()=>{refresh()},[]);

  async function action(fn,success){
    M('');
    try{
      await fn();
      if(success)M(success);
      await refresh();
    }catch(e){
      M(e.message);
    }
  }

  async function submitAuth(e){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    try{
      await api('auth/'+authMode,'POST',Object.fromEntries(f));
      if(authMode==='register'){
        AM('login');
        M('Account created. Sign in to continue.');
      }else{
        M('');
        await refresh();
      }
    }catch(e){
      M(e.message);
    }
  }

  async function handlePriceUpdate(e){
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const stockId = Number(fd.get('stockId'));
    const price = Number(fd.get('price'));
    action(
      ()=>api('admin/price','POST',{stockId,price}),
      'Quote updated. Price revision recorded in stock_price_audit by PostgreSQL trigger.'
    );
    e.currentTarget.reset();
  }

  async function handlePublishNote(e){
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      stockId: Number(fd.get('stockId')),
      title: fd.get('title'),
      sentiment: fd.get('sentiment'),
      content: fd.get('content')
    };
    action(
      ()=>api('admin/notes','POST',payload),
      'Research note published with 64-dimensional pgvector embedding.'
    );
    e.currentTarget.reset();
  }

  if(busy)return <main className="loading">Loading StockLens…</main>;

  if(!user)return (
    <main className="auth">
      <div className="auth-brand">
        <div className="brandmark">S</div>
        <span>STOCKLENS <small> / DATABASE LAB</small></span>
      </div>
      <div className="auth-grid">
        <section>
          <div className="eyebrow">A MARKET INTELLIGENCE LAB</div>
          <h1>Understand the market.<br/><em>Without the risk.</em></h1>
          <p>Explore fictional companies, build a paper portfolio, conduct pgvector semantic research, and observe atomic database transactions and audit triggers.</p>
          <div className="auth-note">SIMULATED MARKET <span>●</span> TWO-PARADIGM DATABASE LAB</div>
        </section>
        <section className="card auth-card">
          <div className="eyebrow">WELCOME TO STOCKLENS</div>
          <h2>{authMode==='login'?'Sign in':'Create account'}</h2>
          <p className="muted">A safe educational space exploring relational &amp; vector databases.</p>
          <form onSubmit={submitAuth}>
            <label>Email
              <input name="email" type="email" placeholder="you@example.com" required maxLength="254"/>
            </label>
            <label>Password
              <input name="password" type="password" placeholder="At least 10 characters" required minLength="10" maxLength="72"/>
            </label>
            <button className="primary">{authMode==='login'?'Sign in':'Create investor account'} <span>→</span></button>
          </form>
          <button className="link" onClick={()=>{AM(authMode==='login'?'register':'login');M('')}}>
            {authMode==='login'?'New here? Create an investor account':'Already registered? Sign in'}
          </button>
          {msg&&<p className="notice" role="status">{msg}</p>}
        </section>
      </div>
      <footer>Educational simulation · UE24CS351A · Debaditya Chakrabarti &amp; Dhadhal Rudra</footer>
    </main>
  );

  const total=portfolio.reduce((x,p)=>x+Number(p.market_value),0),
        gain=portfolio.reduce((x,p)=>x+Number(p.unrealized_pl),0);

  const navItems = [
    ['overview','◫','Overview'],
    ['market','▦','Market'],
    ['research','✦','Research']
  ];
  if(user.role==='admin'){
    navItems.push(['admin','⚙','Admin Portal']);
  }

  const titles = {
    overview: 'Your overview',
    market: 'Explore the market',
    research: 'Market intelligence & vector search',
    admin: 'Administrative & audit controls'
  };

  return (
    <div className="shell">
      <aside>
        <div className="side-brand">
          <div className="brandmark">S</div>
          <div>StockLens<small>MARKET LAB</small></div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(([id,icon,name])=>(
            <button key={id} className={tab===id?'active':''} onClick={()=>{B(id);M('');if(id==='admin')loadAudit();}}>
              <span>{icon}</span>{name}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-label">SIGNED IN AS</div>
          <strong>{user.email}</strong>
          <small>{user.role.toUpperCase()}</small>
          {user.role==='admin'&&<span className="admin-badge">Admin Controls Active</span>}
          <button className="link" onClick={()=>action(()=>api('auth/logout','POST'),null)}>Sign out →</button>
        </div>
      </aside>

      <div className="main">
        <header>
          <div>
            <div className="eyebrow">PAPER TRADING / {tab.toUpperCase()}</div>
            <h1>{titles[tab]}</h1>
          </div>
          <div className="badge"><i/> {user.role==='admin'?'ADMIN MODE':'SIMULATION MODE'}</div>
        </header>

        <div className="disclaimer">
          Fictional companies &amp; quotes · PostgreSQL transactions, pgvector HNSW similarity search, and price audit triggers · Educational lab
        </div>

        {msg&&<div className="notice" role="status">{msg}<button onClick={()=>M('')} aria-label="Dismiss">×</button></div>}

        {/* ================= OVERVIEW TAB ================= */}
        {tab==='overview'&&<>
          <div className="metrics">
            <div className="metric">
              <span>Total portfolio value</span>
              <strong>{money(Number(user.cash)+total)}</strong>
              <small>Cash + market value</small>
            </div>
            <div className="metric">
              <span>Available cash</span>
              <strong>{money(user.cash)}</strong>
              <small>Ready for paper trades</small>
            </div>
            <div className="metric">
              <span>Unrealized P&amp;L</span>
              <strong className={gain>=0?'up':'down'}>{gain>=0?'+':'−'}{money(Math.abs(gain))}</strong>
              <small>Based on average cost</small>
            </div>
          </div>

          <div className="grid">
            <section className="card">
              <div className="sectionhead">
                <div>
                  <div className="eyebrow">YOUR POSITIONS</div>
                  <h2>Portfolio</h2>
                </div>
                <button className="link" onClick={()=>B('market')}>Explore market →</button>
              </div>
              {portfolio.length?(
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr><th>Company</th><th>Shares</th><th>Avg. cost</th><th>Value</th><th>Unrealized P&amp;L</th></tr>
                    </thead>
                    <tbody>
                      {portfolio.map(p=>(
                        <tr key={p.stock_id}>
                          <td><b>{p.symbol}</b><small>{p.company}</small></td>
                          <td>{p.quantity}</td>
                          <td>{money(p.avg_cost)}</td>
                          <td>{money(p.market_value)}</td>
                          <td className={Number(p.unrealized_pl)>=0?'up':'down'}>{money(p.unrealized_pl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ):<div className="empty">No positions yet. Make a paper trade to start your portfolio.</div>}
            </section>

            <section className="card">
              <div className="eyebrow">KEEP AN EYE ON</div>
              <h2>Watchlist</h2>
              {watch.length?watch.map(w=>(
                <div className="listrow" key={w.id}>
                  <div><b>{w.symbol}</b><small>{w.company}</small></div>
                  <div>
                    <b>{money(w.price)}</b>
                    <button className="link" onClick={()=>action(()=>api('watchlist','DELETE',{stockId:w.id}),'Removed from watchlist.')}>Remove</button>
                  </div>
                </div>
              )):<div className="empty">Save stocks from the market to track them here.</div>}
            </section>
          </div>

          <section className="card recent">
            <div className="eyebrow">ACCOUNT ACTIVITY</div>
            <h2>Recent trades</h2>
            {trades.length?(
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Symbol</th><th>Side</th><th>Shares</th><th>Fill price</th></tr>
                  </thead>
                  <tbody>
                    {trades.map(t=>(
                      <tr key={t.id}>
                        <td>{new Date(t.executed_at).toLocaleString()}</td>
                        <td><b>{t.symbol}</b></td>
                        <td><span className={t.side==='BUY'?'up':'down'}>{t.side}</span></td>
                        <td>{t.quantity}</td>
                        <td>{money(t.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ):<div className="empty">Your completed trades will appear here.</div>}
          </section>
        </>}

        {/* ================= MARKET TAB ================= */}
        {tab==='market'&&<>
          <div className="market-layout">
            <section className="card">
              <div className="eyebrow">SIMULATED QUOTES</div>
              <h2>Market board</h2>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr><th>Company</th><th>Sector</th><th>Price</th><th></th></tr>
                  </thead>
                  <tbody>
                    {stocks.map(s=>(
                      <tr key={s.id}>
                        <td><b>{s.symbol}</b><small>{s.company}</small></td>
                        <td>{s.sector}</td>
                        <td>{money(s.price)}</td>
                        <td>
                          <button className="tiny" onClick={()=>action(()=>api('watchlist','POST',{stockId:s.id}),'Added to watchlist.')}>
                            {watch.some(w=>w.id===s.id)?'Saved':'＋ Watch'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="eyebrow">INSTANT PAPER FILL</div>
              <h2>Place a trade</h2>
              <p className="muted">Filled at the stored quote when you submit. Locks account and stock rows atomically.</p>
              <form onSubmit={e=>{
                e.preventDefault();
                const f=Object.fromEntries(new FormData(e.currentTarget));
                action(()=>api('trade','POST',f),'Trade executed.');
              }}>
                <label>Company
                  <select name="stockId" required>
                    {stocks.map(s=><option key={s.id} value={s.id}>{s.symbol} · {s.company}</option>)}
                  </select>
                </label>
                <label>Side
                  <select name="side"><option>BUY</option><option>SELL</option></select>
                </label>
                <label>Shares
                  <input name="quantity" type="number" min="1" max="100000" step="1" defaultValue="1" required/>
                </label>
                <button className="primary">Execute paper trade →</button>
              </form>
            </section>
          </div>
        </>}

        {/* ================= RESEARCH & VECTOR SEARCH TAB ================= */}
        {tab==='research'&&<>
          <section className="card">
            <div className="eyebrow">SEMANTIC VECTOR INTELLIGENCE (PGVECTOR)</div>
            <h2>Search market research notes</h2>
            <p className="muted">
              Query research notes using natural language semantic matching. Both queries and documents are mapped into a 64-dimensional normalized vector space and ranked using PostgreSQL pgvector cosine distance (<code>&lt;=&gt;</code>).
            </p>
            <form className="search" onSubmit={e=>{
              e.preventDefault();
              loadResearch(searchQ, stockFilter);
            }}>
              <input
                type="text"
                placeholder="Try: 'cloud AI enterprise growth', 'solar module tariffs', 'oncology clinical trials'…"
                value={searchQ}
                onChange={e=>SQ(e.target.value)}
              />
              <select style={{width:'auto',minWidth:'170px'}} value={stockFilter} onChange={e=>{SF(e.target.value);loadResearch(searchQ, e.target.value);}}>
                <option value="all">All companies</option>
                {stocks.map(s=><option key={s.id} value={s.id}>{s.symbol} · {s.company}</option>)}
              </select>
              <button type="submit" className="primary" style={{minWidth:'110px'}}>Search</button>
              {searchQ&&<button type="button" className="tiny" onClick={()=>{SQ('');loadResearch('', stockFilter);}}>Reset</button>}
            </form>
          </section>

          <div className="notegrid">
            {notes.map(n=>(
              <article className="card note" key={n.id}>
                <div className="note-top">
                  <div>
                    <b>{n.symbol}</b> <small>· {n.sector}</small>
                    <span className={`tag ${n.sentiment.toLowerCase()}`} style={{marginLeft:'8px'}}>{n.sentiment}</span>
                  </div>
                  {searchQ&&<span className="similarity-pill">{(Number(n.similarity)*100).toFixed(1)}% match</span>}
                </div>
                <h2>{n.title}</h2>
                <p>{n.content}</p>
                <small className="muted">Published {new Date(n.created_at).toLocaleDateString()} · pgvector HNSW indexed</small>
              </article>
            ))}
          </div>
          {!notes.length&&<div className="empty" style={{marginTop:'16px'}}>No research notes found matching your criteria.</div>}
        </>}

        {/* ================= ADMIN PORTAL TAB ================= */}
        {tab==='admin'&&user.role==='admin'&&<>
          <div className="admin-grid">
            <section className="card">
              <div className="eyebrow">MARKET CONTROL</div>
              <h2>Update stock quote</h2>
              <p className="muted">Modifies the fictional quote. PostgreSQL trigger automatically records changes into <code>stock_price_audit</code>.</p>
              <form onSubmit={handlePriceUpdate}>
                <label>Company
                  <select name="stockId" required>
                    {stocks.map(s=><option key={s.id} value={s.id}>{s.symbol} · {s.company} (Current: {money(s.price)})</option>)}
                  </select>
                </label>
                <label>New Price (₹)
                  <input name="price" type="number" step="0.01" min="1" max="1000000" placeholder="e.g. 2650.00" required/>
                </label>
                <button className="primary">Update quote &amp; trigger audit →</button>
              </form>
            </section>

            <section className="card">
              <div className="eyebrow">RESEARCH DESK</div>
              <h2>Publish research note</h2>
              <p className="muted">Publishes an analyst note and automatically computes its 64-dimensional pgvector embedding for semantic search.</p>
              <form onSubmit={handlePublishNote}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <label>Company
                    <select name="stockId" required>
                      {stocks.map(s=><option key={s.id} value={s.id}>{s.symbol} · {s.company}</option>)}
                    </select>
                  </label>
                  <label>Analyst sentiment
                    <select name="sentiment" required>
                      <option value="BULLISH">BULLISH</option>
                      <option value="BEARISH">BEARISH</option>
                      <option value="NEUTRAL">NEUTRAL</option>
                    </select>
                  </label>
                </div>
                <label>Note title
                  <input name="title" type="text" placeholder="e.g. Q3 Cloud Margin Expansion Review" minLength="3" maxLength="120" required/>
                </label>
                <label>Analysis content
                  <textarea name="content" rows="3" placeholder="Provide analyst reasoning, financial metrics, and operational commentary…" minLength="10" maxLength="5000" required></textarea>
                </label>
                <button className="primary">Publish note &amp; generate vector →</button>
              </form>
            </section>
          </div>

          <section className="card" style={{marginBottom:'20px'}}>
            <div className="eyebrow">TRIGGER-DRIVEN INTEGRITY</div>
            <h2>Stock price audit log</h2>
            <p className="muted">Every row below was written by the PostgreSQL <code>trg_stock_price_change</code> trigger when a stock price changed.</p>
            {audit.length?(
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr><th>Timestamp</th><th>Company</th><th>Old quote</th><th>New quote</th><th>Delta</th><th>% Change</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {audit.map(a=>(
                      <tr key={a.id}>
                        <td>{new Date(a.changed_at).toLocaleString()}</td>
                        <td><b>{a.symbol}</b><small>{a.company}</small></td>
                        <td>{money(a.old_price)}</td>
                        <td><b>{money(a.new_price)}</b></td>
                        <td className={Number(a.diff)>=0?'up':'down'}>{Number(a.diff)>=0?'+':'−'}{money(Math.abs(a.diff))}</td>
                        <td className={Number(a.pct_change)>=0?'up':'down'}>{Number(a.pct_change)>=0?'+':''}{a.pct_change}%</td>
                        <td><span className="badge">TRIGGER AUDITED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ):<div className="empty">No price revisions logged yet. Update a quote above to observe the trigger write an audit row.</div>}
          </section>

          <section className="card">
            <div className="eyebrow">NOTE REPOSITORY</div>
            <h2>Active research notes</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Company</th><th>Title</th><th>Sentiment</th><th>Date</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {notes.map(n=>(
                    <tr key={n.id}>
                      <td><b>{n.symbol}</b></td>
                      <td>{n.title}</td>
                      <td><span className={`tag ${n.sentiment.toLowerCase()}`}>{n.sentiment}</span></td>
                      <td>{new Date(n.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="link" onClick={()=>action(()=>api('admin/notes','DELETE',{id:n.id}),'Research note deleted.')}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>}

        <footer>
          StockLens Paper Market Intelligence Lab · UE24CS351A · Debaditya Chakrabarti (PES1UG24CS140) &amp; Dhadhal Rudra (PES1UG24CS146)
        </footer>
      </div>
    </div>
  );
}
