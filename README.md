# Pour Over

Find **specific coffee drinks** at nearby shops — reviewed by drink only, not by “vibe” or venue.

- **Search by drink**: e.g. cappuccino, pour over, flat white, peppermint mocha.
- **Results**: That drink at nearby coffee shops, ranked by relevance (rating, review count, distance if location is on).
- **Mobile-first**: Optimized for smartphones.

## Setup

```bash
npm install
cd client && npm install && cd ..
npm run seed
```

## Run

**Development** (API on 3001, frontend dev server on 5173 with hot reload):

```bash
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001  

**Production** (single server serves API + built frontend):

```bash
npm run build
PORT=3000 npm start
```

Then open http://localhost:3000 (or the port you set).

## Stack

- **Backend**: Node, Express, SQLite (better-sqlite3). Tables: `shops`, `drinks`, `drink_reviews`.
- **Frontend**: React, Vite. Search input, suggestions, results list, optional geolocation for “nearby”.

## Data

Seed creates Austin-area shops with a variety of drinks and fake reviews. Add real data by inserting into `shops`, `drinks`, and `drink_reviews` (or extend the API to accept submissions).
