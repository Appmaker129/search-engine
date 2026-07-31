# Minimal Search Engine Webapp

This repository contains a minimal search-engine prototype you can run locally.

Features
- Node + Express backend
- SQLite (FTS5) for full-text indexing and search (via better-sqlite3)
- Simple REST API to index documents and run queries
- Tiny client UI (vanilla JavaScript) served from /client

Quickstart (local)
1. Clone the repo and install dependencies

   git clone https://github.com/Appmaker129/search-engine.git
   cd search-engine/server
   npm install

2. Seed sample documents (optional)

   npm run seed

3. Start the server

   npm start

4. Open http://localhost:3000 in your browser and try queries like "SQLite" or "Node"

Notes & next steps
- This is intended as a prototype. For production you should:
  - Move to a scalable search engine (Elasticsearch, MeiliSearch, Typesense) if you expect large datasets
  - Add authentication and rate-limiting for the indexing API
  - Add pagination, sorting, and more advanced ranking
  - Use transactions/bulk indexing for large imports

License
- MIT
