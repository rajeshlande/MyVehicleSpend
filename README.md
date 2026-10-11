# My Vehicle Spend

A free, installable **Progressive Web App (PWA)** to track every rupee spent on your **car or bike** in India — fuel, insurance, PUC, RTO taxes, tolls, service, parking, challans — plus a **vehicle loan tracker** with EMI schedules and foreclosure simulation.

| Item              | Choice                                                             |
| ----------------- | ------------------------------------------------------------------ |
| Frontend          | React 18 + TypeScript + Vite                                       |
| PWA               | vite-plugin-pwa (Workbox)                                          |
| Backend           | Supabase (Postgres, Auth, Storage, Row Level Security) — free tier |
| Charts            | Recharts (MIT)                                                     |
| Hosting           | Cloudflare Pages / Netlify / Vercel free tier (or GitHub Pages)    |
| Currency / locale | INR (₹), Indian digit grouping, DD/MM/YYYY, km & litres            |

## Documentation index

Start with [`docs/README.md`](docs/README.md) — it lists all 21 documents grouped by phase:

1. **Requirements & Planning** — Charter, BRD, SRS, URS, SPMP
2. **Architecture & Design** — SDD, System Architecture, UI/UX, Database Schema
3. **Technical & Development** — API, Code Documentation Guide, Onboarding, Coding Standards
4. **Testing & QA** — Test Strategy, Test Cases, Defect Log, UAT Report
5. **Deployment & Maintenance** — Deployment Guide, Release Notes, End-User Guide, Sysadmin Guide

## Status

- Phase 0 (documentation): **complete (v1.0 drafts)**
- Phase 1 (implementation): pending — follows the documents above.

## Licence

To be decided by owner (recommended: MIT). Dependencies are open-source.
