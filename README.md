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

- Inventory table with search, category/status filters, and sorting.
- Add/Edit/Delete item form.
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

Edit the `starterItems` array in `src/db.js`, then delete `data/bar_inventory.sqlite` and restart the app.

## Project structure

```text
.
├── data/
│   └── bar_inventory.sqlite (created at runtime)
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── routes/
│   │   └── items.js
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
