# FieldSync Quick Start Guide

## What You're Building

A property lifecycle management system for manufactured housing. The database supports the full vision (dealerships, all phases, multiple contractors), but you'll build the service workflow first.

```
FULL VISION (architecture supports)     YOU BUILD FIRST (MVP)
─────────────────────────────────────   ─────────────────────
✅ All installation phases              → Service phases only
✅ Multiple dealerships                 → Your dealership
✅ Dozens of contractors                → You + 1 contractor + Matt
✅ Corporate reporting                  → Manager dashboard
```

---

## Before You Start

### 1. Create a Supabase Account (Free)
1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub or email
3. Create a new project (name it "fieldsync")
4. Save your project URL and anon key (Settings → API)

### 2. Have These Ready
- Terminal open to the `fieldsync-app` folder
- Your Supabase URL and anon key
- About 2-4 hours for initial setup

---

## How to Use This Guide

1. Open Terminal in the `fieldsync-app` folder
2. Run `claude` to start Claude Code
3. Copy/paste each prompt below **one at a time**
4. Wait for Claude Code to complete before moving to the next
5. Test after each major section

---

## The Prompts

### PROMPT 1: Initialize Project

```
Read the CLAUDE.MD file to understand the FieldSync project.

Then:
1. Run npm install to get all dependencies
2. Create the basic folder structure in /src matching the CLAUDE.MD spec
3. Set up vite.config.ts with React and PWA plugins
4. Set up tailwind.config.js
5. Create tsconfig.json with strict mode
6. Create a basic index.html and src/main.tsx entry point

Don't build any components yet - just the foundation so we can run npm run dev.
```

---

### PROMPT 2: Supabase Database Setup

```
Let's set up the Supabase database.

1. Create supabase/migrations/001_initial_schema.sql using the schema from the supabase.md skill
2. Create supabase/migrations/002_rls_policies.sql for row level security
3. Show me exact steps to:
   - Go to Supabase SQL Editor
   - Run these migrations
4. Create src/lib/supabase.ts client

My Supabase credentials:
- URL: [PASTE YOUR URL HERE]
- Anon Key: [PASTE YOUR ANON KEY HERE]

Create a .env.local file with these (gitignored).
```

---

### PROMPT 3: Authentication System

```
Build the authentication system:

1. Create src/hooks/useAuth.ts that:
   - Tracks auth state with Supabase
   - Provides login, logout, signup functions
   - Returns user, loading, error states

2. Create src/stores/authStore.ts (Zustand) for:
   - Current user
   - Current user's organization
   - Current user's role/permissions

3. Create src/pages/auth/Login.tsx:
   - Email/password form
   - "Sign Up" link for new users
   - Error display
   - Mobile-friendly design

4. Create src/components/layout/ProtectedRoute.tsx:
   - Redirects to login if not authenticated
   - Shows loading while checking auth

5. Set up basic routing in App.tsx:
   - /login → Login page
   - / → Protected dashboard (blank for now)

After this I should be able to:
- See a login screen
- Create a new account
- Log in and see a blank dashboard
```

---

### PROMPT 4: Organization & User Setup

```
When a user signs up, they need an organization.

1. Create src/pages/auth/Onboarding.tsx:
   - After signup, if user has no org, show this
   - Ask: "Are you a Dealership, Service Company, or Subcontractor?"
   - Collect: Organization name, user's full name, phone
   - Create the organization and link the user

2. Update the auth flow:
   - After login, check if user has an org
   - If no org → Onboarding
   - If has org → Dashboard

3. Create a simple seed script (can be run in Supabase SQL editor) that creates:
   - An organization for Nobility service
   - A manager user (Matt)
   - A technician user (me)
   - 3 sample properties with service phases

Show me how to run the seed after I've signed up.
```

---

### PROMPT 5: Properties List (Service View)

```
Build the main properties list for service techs:

1. Create src/hooks/useProperties.ts:
   - Fetch properties with service phases assigned to current user/org
   - Include customer info
   - Include phase status
   - Support offline (we'll add sync later)

2. Create src/components/properties/PropertyCard.tsx:
   - Customer name (large, tappable)
   - Address (with map link)
   - Phone number (tappable to call)
   - Current phase status badge
   - Scheduled date if set

3. Create src/pages/properties/PropertyList.tsx:
   - List of PropertyCards
   - Pull-to-refresh
   - Empty state if no assigned properties
   - Loading skeleton

4. Create src/components/layout/AppShell.tsx:
   - Header with "FieldSync" and sync status
   - Bottom navigation: Properties, Map, Materials, Profile

5. Wire up routing:
   - / → PropertyList (inside AppShell)

After this I should see my assigned properties listed.
```

---

### PROMPT 6: Property Detail Page

```
Build the property detail page:

1. Create src/pages/properties/PropertyDetail.tsx showing:
   
   HEADER SECTION:
   - Customer name
   - Address (tap to open in maps)
   - Phone (tap to call)
   - Text button (tap to text)
   
   TIMELINE SECTION:
   - All phases for this property
   - Each phase shows: name, status, assigned contractor, date
   - Completed phases show green checkmark
   - Current phase highlighted
   - Tap phase → expand to see details
   
   SERVICE SECTION (if service phase assigned to me):
   - "Start Walk-through" button
   - Or current phase status with progress

2. Create src/components/phases/PhaseTimeline.tsx:
   - Vertical timeline of phases
   - Visual indicators for status
   - Shows who completed each phase

3. Add route: /property/:id → PropertyDetail

After this I should tap a property card and see full details including who did previous phases.
```

---

### PROMPT 7: Walk-Through Form

```
Build the walk-through completion form (core service workflow):

1. Create src/pages/service/WalkthroughForm.tsx:
   
   SECTION: Punchout Items
   - List items from the phase checklist
   - Each item: checkbox, description, location
   - "Add Issue" button per item
   
   SECTION: Issues Found
   - List of issues with photos
   - Each issue: title, category dropdown, severity, notes
   - Photo grid (add photos to each issue)
   
   SECTION: Materials Needed
   - Auto-populated from issues
   - Manual add option
   - Quantity, unit, category for each
   
   SECTION: Notes
   - Free text for Matt
   - Estimated return time
   
   FOOTER:
   - "Save Draft" button
   - "Submit to Manager" button

2. Create src/hooks/usePhotos.ts:
   - Capture from camera
   - Store locally (IndexedDB) for offline
   - Upload to Supabase storage when online

3. Create src/components/photos/PhotoCapture.tsx:
   - Camera button
   - Shows captured photos
   - Delete option

Make sure photos work offline - store as blobs in IndexedDB.
```

---

### PROMPT 8: Materials List

```
Build the materials list feature:

1. Create src/pages/materials/MaterialsList.tsx:
   - Shows ALL materials needed across all my assigned properties
   - Grouped by property
   - Checkbox to mark as purchased
   - "Add to property" option

2. Create src/components/materials/MaterialItem.tsx:
   - Name, quantity, unit
   - Category badge
   - Purchased checkbox
   - Swipe to delete

3. Create src/hooks/useMaterials.ts:
   - Fetch materials lists for user's properties
   - Create/update/delete materials
   - Persist locally for offline

4. Add to bottom nav: Materials tab

5. Also show materials on PropertyDetail page in a collapsible section

After this I should have a shopping list view of everything I need.
```

---

### PROMPT 9: Manager Dashboard

```
Build Matt's manager view:

1. Create src/pages/manager/Dashboard.tsx:
   - Only visible if user role is 'manager' or higher
   - Shows ALL properties (not just assigned)
   - Filter tabs: All, Pending Review, In Progress, Completed
   - Each property shows assigned tech and status

2. Create src/components/manager/PropertyReviewCard.tsx:
   - Property summary
   - Tech who submitted
   - "Review" button → opens detail
   - Quick approve/reject buttons

3. Create src/pages/manager/ReviewWalkthrough.tsx:
   - Shows submitted walkthrough report
   - All photos
   - Materials list
   - Add manager notes
   - "Approve" or "Request Changes" buttons

4. Add role-based routing:
   - Managers see extra "Dashboard" tab in nav
   - Techs don't see it

After this Matt should be able to see all submitted work and approve/reject.
```

---

### PROMPT 10: Offline Mode & PWA

```
Make the app work offline:

1. Update vite.config.ts PWA settings per the offline-pwa.md skill

2. Create src/lib/db.ts using Dexie:
   - Tables: properties, phases, photos, materials, syncQueue
   - Mirror the Supabase schema

3. Create src/lib/sync.ts:
   - Queue mutations when offline
   - Process queue when online
   - Handle conflicts (server wins)

4. Create src/hooks/useOffline.ts:
   - Track online/offline status
   - Provide sync status

5. Create src/components/ui/SyncStatus.tsx:
   - Shows in header
   - "Synced" / "Offline" / "Syncing (3)"

6. Update useProperties, usePhotos, useMaterials to:
   - Read from IndexedDB first (instant)
   - Sync with Supabase in background
   - Queue changes when offline

7. Test offline mode:
   - Instructions for testing in Chrome DevTools

After this I should be able to use the app with no internet and have it sync later.
```

---

### PROMPT 11: Map View

```
Add the map view showing all properties:

1. Create src/pages/map/MapView.tsx:
   - Full-screen map (Mapbox or Google Maps)
   - Pin for each property
   - Pin color based on status
   - Tap pin → popup with property summary
   - Tap popup → go to PropertyDetail

2. Create src/components/maps/PropertyMarker.tsx:
   - Color coded by status
   - Shows customer name on hover/tap

3. Create src/hooks/useMapbox.ts (or useGoogleMaps):
   - Initialize map
   - Add/update markers
   - Handle clicks

4. Add environment variable for map API key

5. Add to bottom nav: Map tab

Note: If I don't have a map API key yet, create a placeholder that shows a list view with addresses as a fallback.
```

---

### PROMPT 12: Final Polish

```
Polish the app for production:

1. Add loading states everywhere (skeletons, not spinners)

2. Add error boundaries and error states

3. Add empty states with helpful messages

4. Add pull-to-refresh on all list views

5. Test and fix:
   - Keyboard handling on mobile
   - Safe area padding (notch, bottom bar)
   - Touch targets at least 44x44px

6. Create public/manifest.json with proper icons

7. Add app icons (placeholder is fine, I'll replace later)

8. Update index.html meta tags for PWA

9. Build for production: npm run build

10. Show me how to deploy to Vercel

After this I should have a production-ready PWA I can install on my phone.
```

---

## Testing Your App

### On Your Computer
```bash
npm run dev
# Open http://localhost:5173
```

### On Your Phone (same network)
```bash
npm run dev -- --host
# Open http://[YOUR-IP]:5173 on phone
```

### Test Offline Mode
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Select "Offline" from dropdown
4. Use the app - should still work
5. Go back "Online" - should sync

### Install as PWA
On iPhone:
1. Open in Safari
2. Tap Share button
3. "Add to Home Screen"

On Android:
1. Open in Chrome
2. Tap menu (three dots)
3. "Install app" or "Add to Home Screen"

---

## Common Issues

### "Can't connect to Supabase"
- Check your .env.local has correct URL and key
- Make sure you ran the migrations
- Check Supabase dashboard for errors

### "Photos not uploading"
- Check storage bucket exists and is public
- Check RLS policies allow insert
- Look at browser console for errors

### "Offline mode not working"
- Make sure service worker is registered
- Check Application tab in DevTools
- Try hard refresh (Ctrl+Shift+R)

### "Build fails"
- Run `npm run type-check` to see TypeScript errors
- Check for missing imports
- Make sure all dependencies are installed

---

## Next Steps After MVP

Once this is working for you and Matt:

1. **Week 3-4:** Expand to dealership view (all phases)
2. **Week 5-6:** Onboard other contractors
3. **Month 2:** Add Stripe payments
4. **Month 3+:** Multi-dealership, reporting, scale

You've got the foundation. Now build! 🚀
