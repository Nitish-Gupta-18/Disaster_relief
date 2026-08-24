# Disaster Relief Coordination Portal

Full-stack disaster relief project by IMPACTSTER for coordinating flood relief requests, volunteers, inventory, maps and command-center metrics.

## Stack

- **Runtime**: Bun (JavaScript runtime & package manager)
- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite via `better-sqlite3` (WAL mode)
- **Styling**: Tailwind CSS + custom light-mode CSS
- **Maps**: Leaflet via `react-leaflet`
- **Charts**: Recharts
- **Icons**: Lucide React

## Quick Start

```bash
./start.sh
```

Or manually:

```bash
bun install
bun run dev
```

The app runs on **http://localhost:3000** — both frontend and API routes served from the same port.

## API Routes

All routes are under `/api/`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET/POST` | `/api/requests` | List / Create relief requests |
| `PATCH/DELETE` | `/api/requests/[id]` | Update status / Delete request |
| `POST` | `/api/requests/[id]/assign-volunteer` | Assign volunteer to request |
| `POST` | `/api/requests/[id]/assign-resources` | Assign resources to request |
| `GET/POST` | `/api/volunteers` | List / Register volunteers |
| `PATCH/DELETE` | `/api/volunteers/[id]` | Update / Remove volunteer |
| `GET` | `/api/volunteers/nearby` | Nearby volunteers (lat, lng, radius) |
| `GET/POST` | `/api/inventory` | List / Add inventory |
| `PATCH/DELETE` | `/api/inventory/[id]` | Update / Remove inventory |
| `GET` | `/api/dashboard` | Dashboard KPIs and charts |
| `GET/POST` | `/api/dashboard/camps` | List / Create relief camps |

## Project Layout

```text
disaster-relief-portal/
├── app/
│   ├── layout.js            # Root layout with sidebar
│   ├── page.js              # Dashboard (home page)
│   ├── globals.css          # Beautiful light-mode CSS
│   ├── api/                 # Next.js API routes (all backend logic)
│   │   ├── health/
│   │   ├── requests/
│   │   ├── volunteers/
│   │   ├── inventory/
│   │   └── dashboard/
│   ├── dashboard/
│   ├── requests/
│   ├── volunteers/
│   ├── inventory/
│   ├── map/
│   ├── settings/
│   └── components/          # Shared React components
├── lib/
│   └── db.js                # SQLite initialization + seed data
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── bunfig.toml
├── jsconfig.json
├── start.sh
└── README.md
```

## Performance Optimizations

- **Bun runtime** — faster installs, faster dev server, lower memory
- **SQLite WAL mode** — concurrent reads without locking
- **Database indexes** — on status, type, urgency, availability, category, quantity
- **`optimizePackageImports`** — tree-shaking for lucide-react and recharts
- **Dynamic imports** — Leaflet maps load client-side only (no SSR overhead)
- **Response compression** — gzip via Next.js
- **Security headers** — XSS, clickjacking, MIME sniffing protection

## Production Build

```bash
bun run build
bun run start
```

The SQLite database file is created automatically at `backend/disaster_relief.sqlite`. On first run, the backend seeds realistic flood-response records:

- 8 relief requests
- 6 volunteers
- 10 inventory items
- 2 relief camps

## API Overview

- `POST /api/requests`
- `GET /api/requests?status=&type=&urgency=`
- `PATCH /api/requests/:id/status`
- `DELETE /api/requests/:id`
- `POST /api/requests/:id/assign-volunteer`
- `POST /api/requests/:id/assign-resources`
- `POST /api/volunteers`
- `GET /api/volunteers?skill=&availability=`
- `PATCH /api/volunteers/:id`
- `DELETE /api/volunteers/:id`
- `GET /api/volunteers/nearby?lat=X&lng=Y&radius=20`
- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `GET /api/dashboard`
- `GET /api/dashboard/camps`
- `POST /api/dashboard/camps`
