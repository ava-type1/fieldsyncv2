# FieldSync - Property Lifecycle Management for Manufactured Housing

## Vision

FieldSync is the operating system for manufactured home installation and service. Every home, from delivery to move-in and beyond, tracked in one place. Every contractor, every phase, every photo - accessible with a tap on the map.

**Owner:** Kameron Martin (kameronmartinllc)
**Initial Market:** Nobility Homes dealer network
**Expansion:** All manufactured housing (Clayton, Champion, Cavco, etc.)

---

## The Problem We Solve

### For Dealerships
- No visibility into installation progress
- Can't answer customer "when will my home be ready?"
- Subcontractors don't communicate with each other
- Paper trails lost in filing cabinets
- Blame game when something goes wrong

### For Subcontractors
- Scattered job info across texts, calls, paper
- Don't know what other trades have/haven't done
- Show up to sites that aren't ready
- No proof of work completed
- Chase payments with no documentation

### For Service Teams
- Inherited problems from installation
- Don't know who did what
- Can't find contact info for original contractors
- Repeat issues with no history

---

## The Solution

One map. Every home. Complete history.

```
┌─────────────────────────────────────────────────────────────────┐
│  🗺️  MAP VIEW - ABC Mobile Homes of Ocala                       │
│                                                                  │
│     [Filter: All] [Setup] [Utilities] [Service] [Complete]      │
│                                                                  │
│         🔴 = Issue    🟡 = In Progress    🟢 = Complete          │
│                                                                  │
│                    🟡                                            │
│              🟢         🔴                                       │
│                   🟢          🟡                                 │
│             🟢                      🟢                           │
│                        🟡                                        │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  TAP ANY PIN → Full property history, contacts, photos          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | React 18 + Vite | Fast builds, modern tooling |
| **Styling** | Tailwind CSS | Rapid UI development |
| **PWA** | Vite PWA Plugin | Offline capability, installable |
| **Offline Storage** | IndexedDB (Dexie.js) | Complex local data |
| **Backend** | Supabase | Auth, DB, Storage, Realtime |
| **Database** | PostgreSQL (via Supabase) | Relational, scalable |
| **File Storage** | Supabase Storage | Photos from job sites |
| **Hosting** | Vercel | Free tier, auto-deploy |
| **Maps** | Mapbox or Google Maps | Property visualization |
| **Payments** | Stripe (Phase 2) | Subscriptions |

---

## Core Data Models

### Organization (Multi-Tenant)
```typescript
interface Organization {
  id: string;
  name: string;                    // "ABC Mobile Homes of Ocala"
  type: OrganizationType;
  parentOrgId?: string;            // For corporate hierarchy
  settings: OrgSettings;
  subscription: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
}

type OrganizationType = 
  | 'dealership'          // Sells & coordinates installation
  | 'service_company'     // Post-sale service (Kameron's company)
  | 'subcontractor'       // Leveling, plumbing, electrical, etc.
  | 'manufacturer';       // Nobility, Clayton, etc. (future)

interface OrgSettings {
  timezone: string;
  defaultPhases: PhaseType[];     // Which phases this org handles
  requirePhotos: boolean;
  requireSignatures: boolean;
}

type SubscriptionTier = 'free_trial' | 'solo' | 'team' | 'dealership' | 'enterprise';
```

### User & Roles
```typescript
interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  organizationId: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
}

type UserRole = 
  | 'owner'              // Organization owner, full access
  | 'admin'              // Can manage users, settings
  | 'manager'            // Can assign work, view all
  | 'dispatcher'         // Can assign work, limited admin
  | 'technician'         // Field worker, sees assigned work
  | 'viewer';            // Read-only access

type Permission = 
  | 'properties.view'
  | 'properties.create'
  | 'properties.edit'
  | 'properties.delete'
  | 'phases.complete'
  | 'phases.assign'
  | 'users.manage'
  | 'reports.view'
  | 'settings.manage'
  | 'billing.manage';
```

### Property (The Core Entity)
```typescript
interface Property {
  id: string;
  
  // Location
  address: Address;
  coordinates?: { lat: number; lng: number };
  
  // Customer
  customer: Customer;
  
  // Home Details
  manufacturer: string;           // "Nobility Homes"
  model?: string;                 // "The Waverly"
  serialNumber?: string;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  
  // Timeline
  soldDate?: Date;
  deliveryDate?: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  moveInDate?: Date;
  
  // Status
  currentPhase: PhaseType;
  overallStatus: PropertyStatus;
  
  // Ownership
  dealershipId: string;           // Which dealership sold it
  createdByOrgId: string;
  
  // Metadata
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Address {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  preferredContact: 'phone' | 'text' | 'email';
  notes?: string;
}

type PropertyStatus = 
  | 'pending_delivery'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'warranty_active'
  | 'closed';
```

### Phase (Work Stages)
```typescript
interface Phase {
  id: string;
  propertyId: string;
  
  // Type & Order
  type: PhaseType;
  category: PhaseCategory;
  sortOrder: number;
  
  // Status
  status: PhaseStatus;
  
  // Assignment
  assignedOrgId?: string;         // Which company is responsible
  assignedUserId?: string;        // Specific technician
  
  // Scheduling
  scheduledDate?: Date;
  scheduledTimeWindow?: string;   // "AM", "PM", "8am-12pm"
  estimatedDuration?: number;     // minutes
  
  // Completion
  startedAt?: Date;
  completedAt?: Date;
  completedByUserId?: string;
  
  // Documentation
  photos: Photo[];
  notes?: string;
  checklistItems: ChecklistItem[];
  
  // Issues
  issues: Issue[];
  
  // Signatures
  customerSignature?: Signature;
  technicianSignature?: Signature;
  
  // Sync
  syncStatus: SyncStatus;
  lastModified: Date;
}

type PhaseCategory = 
  | 'site_prep'       // Before delivery
  | 'delivery'        // Home arrives
  | 'setup'           // Set, level, block, tie-down
  | 'utilities'       // Electric, plumbing, HVAC, gas
  | 'exterior'        // Skirting, porch, steps, gutters
  | 'interior'        // Flooring, trim, paint touch-up
  | 'inspection'      // County/city inspections
  | 'service';        // Post-sale service & warranty

type PhaseType = 
  // Site Prep
  | 'site_clearing'
  | 'pad_preparation'
  | 'utility_stub'
  
  // Delivery
  | 'home_delivery'
  
  // Setup
  | 'set_and_level'
  | 'blocking'
  | 'tie_downs'
  | 'marriage_line'      // For multi-section homes
  
  // Utilities
  | 'electrical_hookup'
  | 'plumbing_hookup'
  | 'hvac_startup'
  | 'gas_hookup'
  | 'septic_connect'
  | 'well_connect'
  
  // Exterior
  | 'skirting'
  | 'porch_steps'
  | 'gutters'
  | 'landscaping'
  | 'driveway'
  
  // Interior
  | 'flooring_completion'
  | 'trim_completion'
  | 'paint_touchup'
  | 'appliance_install'
  
  // Inspection
  | 'county_inspection'
  | 'final_inspection'
  
  // Service (Kameron's domain)
  | 'walkthrough'
  | 'punch_list'
  | 'warranty_call'
  | 'service_call';

type PhaseStatus = 
  | 'not_started'
  | 'scheduled'
  | 'in_progress'
  | 'on_hold'
  | 'blocked'           // Waiting on another phase
  | 'completed'
  | 'skipped';          // Not applicable for this property

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
}

type SyncStatus = 'synced' | 'pending' | 'uploading' | 'error';
```

### Issue Tracking
```typescript
interface Issue {
  id: string;
  propertyId: string;
  phaseId?: string;
  
  // Details
  title: string;
  description: string;
  category: IssueCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Responsibility
  reportedByUserId: string;
  reportedByOrgId: string;
  assignedToOrgId?: string;
  assignedToUserId?: string;
  
  // Status
  status: IssueStatus;
  
  // Documentation
  photos: Photo[];
  
  // Resolution
  resolution?: string;
  resolvedAt?: Date;
  resolvedByUserId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

type IssueCategory = 
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'structural'
  | 'cosmetic'
  | 'appliance'
  | 'exterior'
  | 'safety'
  | 'other';

type IssueStatus = 
  | 'reported'
  | 'acknowledged'
  | 'in_progress'
  | 'pending_parts'
  | 'resolved'
  | 'wont_fix'
  | 'duplicate';
```

### Materials Tracking
```typescript
interface MaterialsList {
  id: string;
  propertyId: string;
  phaseId?: string;
  createdByUserId: string;
  
  items: Material[];
  
  totalEstimatedCost?: number;
  totalActualCost?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: MaterialCategory;
  
  // Costing
  estimatedUnitCost?: number;
  actualUnitCost?: number;
  
  // Purchasing
  status: 'needed' | 'ordered' | 'purchased' | 'on_site' | 'installed';
  purchasedFrom?: string;
  purchasedAt?: Date;
  receiptPhotoUrl?: string;
  
  notes?: string;
}

type MaterialCategory = 
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'lumber'
  | 'hardware'
  | 'trim'
  | 'paint'
  | 'flooring'
  | 'other';
```

### Photo Documentation
```typescript
interface Photo {
  id: string;
  propertyId: string;
  phaseId?: string;
  issueId?: string;
  
  // Storage
  localUri?: string;            // For offline
  remoteUrl?: string;           // After upload
  thumbnailUrl?: string;
  
  // Metadata
  caption?: string;
  photoType: PhotoType;
  takenAt: Date;
  takenByUserId: string;
  
  // Location (if GPS available)
  coordinates?: { lat: number; lng: number };
  
  // Sync
  syncStatus: SyncStatus;
}

type PhotoType = 
  | 'before'
  | 'during'
  | 'after'
  | 'issue'
  | 'receipt'
  | 'signature'
  | 'inspection'
  | 'general';
```

### Contractor Directory
```typescript
interface ContractorProfile {
  organizationId: string;
  
  // Services
  servicesOffered: PhaseType[];
  serviceArea: string[];          // ZIP codes or counties
  
  // Contact
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail?: string;
  
  // Business
  licenseNumber?: string;
  insuranceExpiry?: Date;
  
  // Performance (future)
  averageRating?: number;
  totalJobsCompleted?: number;
  
  // Availability
  isAcceptingWork: boolean;
}
```

---

## User Flows by Role

### Dealership Staff Flow
```
1. Customer buys home → Create Property in system
2. Schedule delivery date → System creates all default phases
3. Assign contractors to phases → Contractors get notified
4. Monitor progress on map → See real-time status updates
5. Customer calls "is my home ready?" → Instant answer
6. Issue arises → Create issue, assign responsibility
7. All phases complete → Mark ready for move-in
```

### Subcontractor Flow (Leveling, Plumbing, etc.)
```
1. Get notification of new assignment
2. View property details + what phases are complete
3. Check "is site ready for me?" (dependencies)
4. Arrive on site → Start phase
5. Complete checklist items
6. Take required photos
7. Mark phase complete
8. (Offline?) → All syncs when back online
```

### Service Tech Flow (Kameron's Current Flow)
```
1. Receive walk-through assignment
2. See property history (who did what)
3. Complete walk-through, document issues
4. Generate materials list
5. Submit to manager (Matt)
6. Return for punch list completion
7. Get customer signature
8. Job complete
```

### Manager Flow (Matt's View)
```
1. Dashboard: All active properties
2. Assign walk-throughs to techs
3. Review submitted reports
4. Approve/modify materials lists
5. Track issue resolution
6. Generate reports for dealership
```

---

## Phase Dependencies (Smart Scheduling)

The system understands what must happen before each phase:

```typescript
const phaseDependencies: Record<PhaseType, PhaseType[]> = {
  // Nothing before site prep
  'site_clearing': [],
  'pad_preparation': ['site_clearing'],
  'utility_stub': ['pad_preparation'],
  
  // Delivery needs site ready
  'home_delivery': ['pad_preparation'],
  
  // Setup sequence
  'set_and_level': ['home_delivery'],
  'blocking': ['set_and_level'],
  'tie_downs': ['blocking'],
  'marriage_line': ['set_and_level'],
  
  // Utilities need setup
  'electrical_hookup': ['set_and_level'],
  'plumbing_hookup': ['set_and_level'],
  'hvac_startup': ['electrical_hookup'],
  'gas_hookup': ['plumbing_hookup'],
  
  // Exterior after setup
  'skirting': ['blocking', 'tie_downs'],
  'porch_steps': ['set_and_level'],
  
  // Inspections
  'county_inspection': ['electrical_hookup', 'plumbing_hookup', 'tie_downs'],
  'final_inspection': ['county_inspection', 'skirting'],
  
  // Service after everything
  'walkthrough': ['final_inspection'],
  'punch_list': ['walkthrough'],
};
```

This allows the UI to show:
- ⚠️ "Blocked - waiting on Electrical Hookup"
- ✅ "Ready to start"
- 🔔 Notify contractor when dependencies complete

---

## Build Phases

### Phase 1: Service MVP (Weeks 1-2) ← START HERE
Build only what Kameron needs NOW:
- Auth (email/password)
- Properties list (assigned to service)
- Property detail (customer info, history)
- Service phases only (walkthrough, punch_list)
- Photo capture
- Materials list
- Manager dashboard (Matt)
- Offline mode
- PWA

**Database has full schema, UI is service-focused.**

### Phase 2: Dealership Pilot (Weeks 3-4)
Expand to dealership staff:
- All phase types enabled
- Contractor assignment
- Dealership dashboard
- Property creation flow
- Map view with all properties

### Phase 3: Multi-Contractor (Weeks 5-6)
- Subcontractor onboarding
- Phase dependencies enforcement
- Notifications
- Contractor directory

### Phase 4: Monetization (Month 2)
- Stripe integration
- Subscription management
- Usage limits by tier
- Trial period handling

### Phase 5: Scale (Month 3+)
- Multi-dealership support
- Corporate dashboards
- Advanced reporting
- API for integrations
- White-label option

---

## Project Structure

```
fieldsync/
├── CLAUDE.MD                 # This file
├── .claude/
│   └── skills/
│       ├── supabase.md       # Database & auth patterns
│       ├── offline-pwa.md    # PWA & sync patterns
│       ├── mobile-ui.md      # UI components
│       └── maps.md           # Map integration patterns
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/               # Button, Card, Input, etc.
│   │   ├── layout/           # AppShell, Navigation
│   │   ├── properties/       # PropertyCard, PropertyDetail
│   │   ├── phases/           # PhaseCard, PhaseChecklist
│   │   ├── photos/           # PhotoGrid, PhotoCapture
│   │   ├── materials/        # MaterialsList
│   │   ├── issues/           # IssueCard, IssueForm
│   │   └── maps/             # PropertyMap, MapMarker
│   ├── pages/
│   │   ├── auth/
│   │   │   └── Login.tsx
│   │   ├── properties/
│   │   │   ├── PropertyList.tsx
│   │   │   ├── PropertyDetail.tsx
│   │   │   └── PropertyCreate.tsx
│   │   ├── phases/
│   │   │   ├── PhaseDetail.tsx
│   │   │   └── PhaseComplete.tsx
│   │   ├── service/          # Kameron's specific flows
│   │   │   ├── WalkthroughForm.tsx
│   │   │   └── PunchListForm.tsx
│   │   ├── manager/
│   │   │   └── Dashboard.tsx
│   │   ├── dealership/       # Phase 2
│   │   │   └── Dashboard.tsx
│   │   └── settings/
│   │       └── Profile.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProperties.ts
│   │   ├── usePhases.ts
│   │   ├── usePhotos.ts
│   │   ├── useOffline.ts
│   │   └── useSync.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── db.ts             # IndexedDB setup
│   │   ├── sync.ts           # Sync engine
│   │   ├── permissions.ts    # Role-based access
│   │   └── utils.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── propertyStore.ts
│   │   └── uiStore.ts
│   └── types/
│       ├── index.ts
│       └── supabase.ts       # Generated types
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_seed_data.sql
│   └── functions/            # Edge functions (future)
├── public/
│   ├── manifest.json
│   └── icons/
└── package.json
```

---

## Database Schema (Supabase/PostgreSQL)

```sql
-- See supabase.md skill for full migration file
-- Key tables:

organizations (id, name, type, parent_org_id, settings, subscription)
users (id, email, full_name, phone, organization_id, role, permissions)
properties (id, address, customer, manufacturer, dealership_id, status)
phases (id, property_id, type, status, assigned_org_id, assigned_user_id)
photos (id, property_id, phase_id, url, photo_type)
issues (id, property_id, phase_id, title, severity, status)
materials_lists (id, property_id, phase_id, items)

-- RLS ensures:
-- - Users only see their organization's data
-- - Contractors only see assigned properties
-- - Dealerships see all their properties
-- - Cross-org visibility for assigned work
```

---

## Offline Architecture

Critical for field work in rural areas:

```
┌─────────────────────────────────────────────────────────┐
│  ONLINE                          OFFLINE                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Supabase ◄──────────────────► IndexedDB               │
│  (PostgreSQL)    Sync Engine    (Dexie.js)             │
│                                                         │
│  - Source of truth              - Local cache          │
│  - All properties               - Assigned properties  │
│  - Full history                 - Recent data          │
│  - Real-time updates            - Offline mutations    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  SYNC STRATEGY                                          │
│                                                         │
│  1. App loads → Fetch from IndexedDB (instant)         │
│  2. If online → Sync with Supabase (background)        │
│  3. User makes changes → Save to IndexedDB + Queue     │
│  4. When online → Process queue → Upload to Supabase   │
│  5. Conflict? → Server wins (with user notification)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Pricing Tiers (Reference)

| Tier | Price | Users | Properties | Features |
|------|-------|-------|------------|----------|
| **Free Trial** | $0/14 days | 2 | 10 | Full features |
| **Solo** | $29/mo | 1 | Unlimited | Single technician |
| **Team** | $99/mo | 5 | Unlimited | Manager dashboard |
| **Dealership** | $299/mo | 25 | Unlimited | All phases, multi-contractor |
| **Enterprise** | $999/mo | Unlimited | Unlimited | Multi-location, API, support |

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run Supabase locally
npx supabase start

# Push database migrations
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --local > src/types/supabase.ts

# Preview production build
npm run preview
```

---

## Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MAPBOX_TOKEN=your-mapbox-token  # or Google Maps key
```

---

## Notes for Claude Code

### Guiding Principles
1. **Property-centric** - Everything relates back to a property
2. **Offline-first** - Every feature must work without network
3. **Mobile-first** - Design for phones, scale up
4. **Role-aware** - Always check permissions
5. **Photo-heavy** - Visual documentation is the value prop

### Build Order
1. Auth + basic routing
2. Properties list + detail (service view)
3. Phase completion flow
4. Photo capture + local storage
5. Materials list
6. Manager dashboard
7. Offline sync engine
8. PWA configuration
9. Map view
10. Issue tracking

### When Building Features
- Always consider: "How does this work offline?"
- Always check: "Does this user have permission?"
- Always ask: "Which organization does this belong to?"

### Code Style
- TypeScript strict mode (no `any`)
- Functional components + hooks
- Tailwind for styling
- Zustand for global state
- Descriptive variable names
- Comments on complex logic

### When Uncertain
Ask Kameron. He lives this workflow daily and knows the edge cases.
