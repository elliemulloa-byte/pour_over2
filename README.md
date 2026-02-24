# Bean Verdict

Find **specific coffee drinks** at nearby shops — search by drink or coffee shop, see ratings and reviews, and add your own.

## How to Run the Application

### Prerequisites

- **Node.js** (v18 or newer)
- **npm** (comes with Node.js)

### 1. Install dependencies

From the project root:

```bash
npm install
cd client && npm install
cd ..
```

### 2. Seed the database (first time only)

```bash
npm run seed
```

This creates local Austin-area coffee shops with sample drinks and reviews.

### 3. Set up Foursquare API (optional but recommended)

For real coffee shop search (Foursquare Places API, free tier):

1. Get an API key at [foursquare.com/developers](https://foursquare.com/developers)
2. Create a `.env` file in the project root with:

```
FOURSQUARE_API_KEY=your-key-here
```

### 4. Start the app

**Development** (hot reload):

```bash
npm run dev
```

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

**Production** (single server):

```bash
npm run build
npm start
```

Then open http://localhost:3000 (or the port in `PORT`).

### 5. Use the app

1. Open http://localhost:5173 in your browser
2. Enter a drink (e.g. latte, cold brew) and a location (city or address)
3. Click search or choose a recommended drink
4. Sign up or log in to add reviews, rate drinks, and add photos

## Features

- Search by drink or coffee shop name
- Location-based results (enter city or share location)
- Place pages with photos, ratings, hours, and reviews
- Rate specific drinks with stars, descriptors, and optional photos
- Profile with avatar (espresso bean, scroll, cup, or custom upload)

## Stack

- **Backend**: Node.js, Express, SQLite
- **Frontend**: React, Vite
- **APIs**: Foursquare Places (shops), Nominatim (geocoding)
