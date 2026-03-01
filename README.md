# MatterFlow

Simple SaaS starter built with Next.js App Router + TypeScript, Prisma (SQLite), and NextAuth authentication.

## What is included

- Multi-tenant data model with `Firm` and `User`
- Hardcoded seed firm: `PPM LAWYERS`
- Seed data:
  - 2 clients
  - 3 matters
  - grouped checklist steps
  - 1 stale matter
  - 1 overdue matter
- Pages:
  - `/matters`
  - `/matters/[id]`
  - `/penalty-box`

## Setup

1. Install Node.js 20+ (Node 22 recommended).
2. Install dependencies:

```bash
npm install
```

3. Create env file:

```bash
cp .env.example .env
```

4. Run migration:

```bash
npm run prisma:migrate -- --name init
```

5. Run seed:

```bash
npm run prisma:seed
```

6. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Auth notes

- Default local flow uses direct email sign-in (no inbox step) via NextAuth credentials provider.
- Optional: if SMTP is configured in `.env`, EmailProvider remains available for magic links.
- The NextAuth route is available at `/api/auth/[...nextauth]`.
