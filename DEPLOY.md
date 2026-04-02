# Victoria Golf Ops — Cloudflare Deployment Guide

## 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

## 2. Login to Cloudflare

```bash
wrangler login
```
This opens a browser to authenticate your Cloudflare account.

## 3. Buy Your Domain

Go to https://domains.cloudflare.com and search for `victoriagolfops.com`
(or .app, .golf — whatever's available and you like).

## 4. Create the D1 Database

```bash
wrangler d1 create golf-ops-db
```

This prints a `database_id` — copy it and paste it into `wrangler.toml`:
```toml
[[d1_databases]]
database_id = "paste-your-id-here"
```

Then load the schema:
```bash
wrangler d1 execute golf-ops-db --file=db/schema.sql
```

## 5. Create the R2 Bucket

```bash
wrangler r2 bucket create golf-ops-uploads
```

## 6. Deploy

```bash
# Build the site
python3 build.py

# Deploy to Cloudflare Pages
wrangler pages deploy site --project-name=victoria-golf-ops
```

## 7. Connect Your Domain

In the Cloudflare dashboard:
1. Go to Pages → victoria-golf-ops → Custom domains
2. Add `victoriagolfops.com` (or your chosen domain)
3. DNS is auto-configured since registrar + hosting are both Cloudflare

## API Endpoints (auto-created from functions/ folder)

| Endpoint | Method | Description |
|---|---|---|
| `/api/members` | GET | List/search members |
| `/api/rounds` | GET | Rounds data (filter by year) |
| `/api/sales` | GET | Sales data (filter by year/member) |
| `/api/leaderboard` | GET | View leaderboard |
| `/api/leaderboard` | POST | Add leaderboard entry |
| `/api/upload` | GET | List uploaded files |
| `/api/upload` | POST | Upload file to R2 |

## Cost Summary

| Service | Free Tier | Your Usage |
|---|---|---|
| Pages | Unlimited bandwidth | Covered |
| D1 | 5GB, 5M reads/day | Covered |
| R2 | 10GB, 1M reads/mo | Covered for most files |
| Workers | 100K requests/day | Covered |
| Domain | ~$10/yr | Annual |
