# SaaS Starter Template

A production-ready SaaS starter template with authentication, billing, and dashboard functionality.

## Features

- **Authentication**: Built-in auth with NextAuth.js
- **Billing**: Stripe integration for subscriptions
- **Database**: PostgreSQL with Prisma ORM
- **UI Components**: Shared UI library
- **Dashboard**: Admin and user dashboards
- **API Routes**: RESTful API endpoints

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- PostgreSQL
- Stripe
- NextAuth.js