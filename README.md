# Bar Inventory MVP (Express + SQLite + Vanilla JS)

A beginner-friendly full-stack app to track bar inventory (100–300 items) with item history.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

## Setup & Run

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## What the app includes

- Inventory table with search, category/status filters, sorting, and 5 Excel-like saved tabs (Total Stock, Liquor, Wine, Beer, Syrups+).
- Add/Edit/Delete item form (including Syrups+ category support) with a unit dropdown (Bottle, Keg, 4Pk, Can).
- Quick row actions: `+1`, `-1`, inline status update, and “Mark Low”.
- Server-side validation and friendly API errors.
- SQLite persistence and auto-create tables on first run.
- Change history events for every item change.

## API Endpoints

- `GET /api/health`
- `GET /api/items?search=&category=&status=&sort=&order=`
- `GET /api/items/:id`
- `POST /api/items`
- `PUT /api/items/:id`
- `PATCH /api/items/:id/quantity` with `{ "delta": 1 }` or `{ "quantity": 10 }`
- `PATCH /api/items/:id/status` with `{ "status": "LOW" }`
- `DELETE /api/items/:id`
- `GET /api/items/:id/events`

## Starter seed data

On first run, if the database is empty, the app seeds items like:

- House Vodka
- House Tequila
- House Rum
- House Whiskey
- London Dry Gin
- Triple Sec
- Bourbon
- Dry Vermouth

### How to change seed data

- `src/data/masterInventory.js` is the canonical source-of-truth list for bar inventory metadata.
- `src/data/seedInventory.js` derives default seeded app rows from `masterInventory` by adding starter state (`quantity: 1`, `status: 'FULL'`).
- Run `npm run reset-inventory` to delete the current SQLite file, then run `npm run dev` to recreate/reseed on startup.

### Database path for local vs cloud

- The app reads the SQLite file path from `DB_PATH`.
- If `DB_PATH` is not set, it uses `app-data/bar_inventory.sqlite` in local development.
- The DB directory is auto-created if it does not exist.

## Project structure

```text
.
├── app-data/
│   └── bar_inventory.sqlite (created at runtime unless DB_PATH is set)
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── config/
│   │   └── dbPath.js
│   ├── data/
│   │   ├── masterInventory.js
│   │   └── seedInventory.js
│   ├── routes/
│   │   └── items.js
│   ├── scripts/
│   │   └── resetInventory.js
│   ├── services/
│   │   └── itemsService.js
│   ├── utils/
│   │   ├── constants.js
│   │   └── validation.js
│   └── db.js
├── package.json
├── server.js
└── README.md
```

## High-level path to deploy on AWS later

1. Move SQLite to RDS (Postgres/MySQL) for multi-instance safety.
2. Deploy Express API to ECS/Fargate or Elastic Beanstalk.
3. Serve static frontend from S3 + CloudFront (or from Express initially).
4. Add environment variables + Secrets Manager.
5. Add authentication (Cognito or custom JWT provider).
6. Add CI/CD (GitHub Actions) and monitoring (CloudWatch).


## Views / Tabs

- **Total Stock**: all items.
- **Liquor**: spirits categories only (Vodka, Tequila, Rum, Whiskey, Gin, Liqueur).
- **Wine**: Wine-only with Wine Type filter (All/Red/White via notes match).
- **Beer**: Beer-only with Packaging filter (All/Kegs/Cans) and packaging labels in table/cards.
- **Syrups+**: Syrups+/mixers category view.

Each tab remembers its own search, status, sort, order, category, and tab-specific sub-filters.
