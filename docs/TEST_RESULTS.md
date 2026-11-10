# Investor core — verification

Results for this isolated version, using Node.js and an embedded PostgreSQL-compatible PGlite database:

- `npm test`: passed the database integration test covering buy, sell, insufficient cash, insufficient shares, invalid quantity, unchanged state after rejected trades, portfolio value, stock price check, unique email and watchlist foreign key/add/remove.
- `npm run build`: passed the Next.js production build.
- Local browser check: sign-in, buy two shares, portfolio cash update, rejected oversell without extra trade history, add/remove watchlist, registration and a second account with no access to the first account's portfolio, trades or watchlist passed. The mobile market screen was rendered and inspected.

These checks used an isolated temporary database, not a real market. Docker PostgreSQL was not re-tested for this investor-only split. Concurrency stress tests, external deployment and Dhadhal's future functionality are not covered by these results.
