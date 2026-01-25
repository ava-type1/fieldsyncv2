# FieldSync

**Field Service Management for Manufactured Housing**

Track walkthroughs, manage phases, capture signatures — even with no cell service.

![FieldSync](https://via.placeholder.com/800x400?text=FieldSync+Hero)

## Features

- 📱 **Offline-First** — Works with zero signal, syncs when back online
- 📸 **Photo Documentation** — GPS-tagged photos with timestamps
- ✍️ **Digital Signatures** — Customer and technician sign-off
- 📋 **Phase Tracking** — Visual timeline of all work stages
- 🏠 **Customer Portal** — Shareable status page for homeowners
- 💰 **QuickBooks Sync** — Create invoices from time entries
- ⏱️ **Time & Mileage** — Track hours and travel for billing
- 📄 **PDF Reports** — Professional documentation for proof of work
- 💬 **SMS Notifications** — "On my way" and completion alerts

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Offline:** Dexie (IndexedDB) + Service Worker
- **Integrations:** Twilio (SMS), Stripe (Payments), QuickBooks (Invoicing)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- (Optional) Twilio, Stripe, QuickBooks accounts for integrations

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/fieldsync.git
cd fieldsync

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```env
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# QuickBooks (Optional)
VITE_QUICKBOOKS_CLIENT_ID=your-client-id
VITE_QUICKBOOKS_REDIRECT_URI=http://localhost:5173/settings/quickbooks

# Stripe (Optional - set in Supabase Edge Function secrets)
# STRIPE_SECRET_KEY=sk_live_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx

# Twilio (Optional - set in Supabase Edge Function secrets)
# TWILIO_ACCOUNT_SID=ACxxx
# TWILIO_AUTH_TOKEN=xxx
# TWILIO_PHONE_NUMBER=+1234567890
```

### Database Setup

```bash
# Push migrations to Supabase
npx supabase db push

# Or run migrations manually in Supabase dashboard
```

## Project Structure

```
src/
├── components/
│   ├── invoices/      # Invoice creation modal
│   ├── issues/        # Issue reporting
│   ├── layout/        # App shell, nav, headers
│   ├── notifications/ # SMS notification settings
│   ├── phases/        # Phase timeline
│   ├── photos/        # Photo capture & grid
│   ├── pwa/           # Install & update prompts
│   ├── reports/       # PDF generation
│   ├── signatures/    # Signature capture
│   ├── time/          # Time tracker
│   └── ui/            # Reusable UI components
├── hooks/
│   ├── useAuth.ts
│   ├── useMaterials.ts
│   ├── useNotifications.ts
│   ├── useOffline.ts
│   ├── usePhotos.ts
│   ├── useProperties.ts
│   ├── useSignature.ts
│   ├── useSync.ts
│   └── useTimeTracking.ts
├── lib/
│   ├── db.ts          # IndexedDB schema
│   ├── notifications.ts
│   ├── quickbooks.ts
│   ├── reportGenerator.ts
│   ├── stripe.ts
│   ├── supabase.ts
│   ├── sync.ts        # Offline sync engine
│   └── utils.ts
├── pages/
│   ├── auth/          # Login, Signup, Onboarding
│   ├── landing/       # Marketing page
│   ├── manager/       # Dashboard, reviews
│   ├── map/           # Map view
│   ├── materials/     # Materials tracking
│   ├── portal/        # Customer portal (public)
│   ├── properties/    # Property list & detail
│   ├── service/       # Walkthrough form
│   └── settings/      # User, org, billing settings
├── stores/
│   └── authStore.ts   # Zustand auth state
├── styles/
│   └── globals.css
├── types/
│   └── index.ts       # TypeScript interfaces
└── App.tsx            # Routes
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## Pricing Tiers

| Plan | Price | Users | Features |
|------|-------|-------|----------|
| Solo | $29/mo | 1 | All features |
| Team | $79/mo | 5 | All features + priority support |
| Dealership | $199/mo | Unlimited | All features + API access |
| Enterprise | Custom | Unlimited | Dedicated support + SLA |

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built for contractors who work where cell towers don't reach. 🏠📱
