# JOAP Hardware Trading - Supplier Management System

## Overview
A web-based Supplier Management System for JOAP Hardware Trading with Accounting System. Built with React + TypeScript (Vite) frontend, Express backend, and MongoDB (Mongoose) database.

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript + Mongoose
- **Database**: MongoDB (hosted on Railway)
- **Auth**: JWT tokens stored in localStorage + httpOnly cookies
- **Routing**: wouter (frontend), Express Router (backend)
- **State Management**: @tanstack/react-query
- **Charts**: Recharts

## Credentials
- Admin: username=`admin`, password=`admin123`
- Employee: username=`employee`, password=`employee123`

## Project Structure
```
client/src/
  App.tsx              - Main app with routing, layout, logout confirmation, global search
  lib/auth.tsx         - Auth context (login/logout/token)
  lib/queryClient.ts   - API request helpers with JWT
  lib/settings-context.tsx - SettingsProvider (font, color theme, gradient)
  components/
    app-sidebar.tsx    - Navigation sidebar with gradient support
    ui/                - shadcn/ui components
  pages/
    login.tsx          - Login page
    dashboard.tsx      - Dashboard with clickable stats and charts
    inventory.tsx      - Inventory management with price adjust
    orders.tsx         - Orders with tabs
    order-detail.tsx   - Single order view
    billing.tsx        - Billing with advanced search (date/orderID/gcash/reference)
    users.tsx          - Admin user management with online status, confirmations
    accounting.tsx     - Chart of accounts & ledger
    reports.tsx        - Reports with export
    settings.tsx       - System settings (fonts, colors, gradients)
    about.tsx          - About page
    help.tsx           - Help with 20 FAQs and employee messaging
    system-logs.tsx    - Audit logs with readable format and detail dialogs
    maintenance.tsx    - Backup/export/auto-backup/restore/wipe
  components/
    gemini-chat.tsx    - Gemini AI floating chat + voice insight bubble
    dev_button.tsx     - Developer wipe button (isolated)

server/
  index.ts             - Express server entry
  db.ts                - MongoDB connection
  routes.ts            - All API routes (50+ endpoints)
  seed.ts              - Database seeding
  middleware/auth.ts   - JWT auth middleware
  trie.ts              - Trie data structure for prefix search
  hashIndex.ts         - HashMap indexes for O(1) lookups
  forecast.ts          - ARIMA-like forecasting (AR + trend + MA)
  models/              - Mongoose models (User, Item, Order, InventoryBatch, etc.)

shared/
  schema.ts            - Zod schemas & TypeScript interfaces
```

## Recent Changes (2026-02-27) - Research Paper Algorithm Integration
- **Trie-based Prefix Search**: Real-time autocomplete using in-memory Trie data structure
  - `server/trie.ts`: Trie class with insert, prefixSearch, remove, clear methods
  - Indexes items (itemName, category), customers (name), orders (trackingNumber)
  - Built on server startup from MongoDB, updated on create/update mutations
  - API: `GET /api/search/autocomplete?q=...` - returns trie prefix matches
  - Existing `GET /api/search` now cascades: hash lookup → trie prefix → MongoDB regex
  - Frontend GlobalSearch shows source badge (Trie/Hash/Database) in dropdown
- **Hash-based O(1) Lookup**: HashMap indexes for instant retrieval by ID/barcode/tracking
  - `server/hashIndex.ts`: HashIndex class with get, set, remove, has methods
  - Indexes: itemIndex (by _id), barcodeIndex, customerIndex, orderIndex, trackingIndex
  - API: `GET /api/lookup/:type/:key` - direct hash-based retrieval
  - Search endpoint checks hash index first for exact matches before trie/regex
- **FIFO Inventory Batch Processing**: Batch-level cost tracking with First-In-First-Out deduction
  - `server/models/InventoryBatch.ts`: Mongoose model (itemId, quantity, remainingQuantity, unitCost, source)
  - Initial batches created on first startup from existing item quantities
  - Restocks (inventory log type "restock") create new batches
  - Order release deducts from oldest batches first (FIFO), calculates COGS
  - COGS recorded as General Ledger entries on order release
  - Manual deductions also use FIFO
  - API: `GET /api/inventory/:id/batches` - view batch breakdown per item
- **ARIMA-like Revenue Forecasting**: AR + Trend + Moving Average model
  - `server/forecast.ts`: arimaForecast function with linear regression, autoregression, moving average
  - Analyzes 90 days of BillingPayment data, produces 30-day forecast
  - API: `GET /api/reports/forecast` - returns historical + forecast data with model info
  - API: `GET /api/dashboard/forecast` - 7-day forecast summary for dashboard widget
  - Reports forecast tab: ComposedChart with blue historical area + purple dashed forecast line
  - Dashboard: 7-day forecast widget with bar chart and trend badge
  - Model metadata displayed: type, trend coefficient, MA window, AR coefficients
- **bcrypt Authentication**: Already fully implemented (verified)
  - `seed.ts`: bcrypt.hash for initial user passwords
  - `routes.ts`: bcrypt.compare for login, bcrypt.hash for create user and password reset

## Previous Changes (2026-02-23)
- **Dashboard overhaul**: Complete redesign using modern card-based template
  - 4 summary cards (Total Earnings, Total Orders, Customers, Pending Balance) with sparkline charts
  - Each card has independent period filter (Daily/Weekly/Monthly/Yearly)
  - Revenue combo chart (bar + line) showing revenue vs order value
  - Sales by Channel donut chart (Walk-in, Phone, Email, Message)
  - Top Selling Items list with qty sold
  - All data real-time from MongoDB via GET /api/dashboard/advanced?period=daily|weekly|monthly|yearly
  - Cards clickable: Earnings→Billing, Orders→Orders, Balance→Billing
  - Trend badges showing percentage change vs previous period
- **Inventory image upload system**: Items support image upload via multer
  - Admins upload directly, employees require admin approval (ImageApproval model)
  - Images stored in uploads/ directory, served via /api/uploads/:filename
  - Grid/list view toggle for inventory display
  - Image approval panel for admins with approve/reject buttons
- **Maintenance page overhaul**: Export/upload backup, auto-backup scheduler, backup history
  - Auto-backup with node-cron, configurable interval (hours/days/weeks)
  - Backup history with download, manual backup trigger
  - Upload restore with confirmation dialog and countdown
  - Developer wipe button (isolated component: dev_button.tsx) with 8-second countdown
- **Single-session enforcement**: New login force-terminates previous active sessions
  - Response includes `previousSessionTerminated` flag
  - Old sessions invalidated automatically on new login
- **Gemini AI Integration**: Full AI-powered analytics assistant
  - Floating Gemini chat button (bottom-right) opens mini chat panel
  - Text-only chat via POST /api/gemini-chat using Gemini 2.5 Flash
  - Voice insight on chart double-click via POST /api/voice-insight (text + TTS)
  - Backend gathers all system JSON (items, orders, payments, users, logs, accounts, ledger)
  - Gemini answers grounded to actual system data only
  - TTS uses Gemini 2.5 Flash Preview TTS with Leda voice (graceful text fallback)
  - Chat UI: typing animation, suggestion buttons, message history, responsive
  - Voice insight: floating bubble near click position with X to close, audio playback
  - Component: client/src/components/gemini-chat.tsx (GeminiFloatingChat + VoiceInsightBubble)
- **Activity Calendar**: Interactive heatmap calendar with date detail panel
  - Month navigation, 5-level heatmap coloring, timezone-aware date boundaries
  - Date detail panel: 6 summary stats, hourly revenue chart, channel/status breakdowns
  - APIs: GET /api/dashboard/calendar-heatmap, GET /api/dashboard/date-detail
- **Order Delivery Addresses**: Optional address fields on orders for delivery tracking
  - Fields: street, unitNumber, city, province, zipCode (all optional for walk-in support)
  - Collapsible "Delivery Address" section in order creation form with checkbox toggle
  - Address displayed on order detail page with formatted fields
  - Google Maps integration on order detail: geocodes address and shows interactive map with pin
  - API: GET /api/config/maps-key serves Google Maps key to frontend securely
- **Customer Distribution Map on Dashboard**: Interactive Philippines map showing order locations
  - Google Maps centered on Philippines (lat: 12.8797, lng: 121.7740)
  - Colored dots on cities sized by order count, hue from blue (low) to red (high)
  - Period filter (daily/weekly/monthly/yearly) via GET /api/dashboard/customer-map?period=
  - Click city dot: shows info panel with order count + revenue
  - Double-click city dot: auto-queries Gemini AI about that city's customer activity
  - City badges below map for quick navigation
  - 45+ Philippine city coordinates pre-mapped in PH_CITY_COORDS lookup table
  - Gemini text input in city panel for custom AI queries with city context
- **Interactive Tutorial System**: Guided walkthrough with local MP3 narration and alive cursor
  - Component: client/src/components/tutorial.tsx
  - 17-step ADMIN flow and 12-step EMPLOYEE flow covering all system features
  - Local MP3 audio files (tut1.mp3–tut17.mp3) served via /api/tutorial-audio/:filename
  - Spotlight overlay with rounded-rect cutout and pulsing border ring
  - Animated cursor pointer (desktop only) always synced with spotlight via `syncToEl()`
  - Choreography actions: move, click, doubleClick, clickFirst, type, pressEnter, hover, highlight, scroll, navigate, focusDialog
  - `safeClick()` helper: uses `.click()` for HTML elements, `dispatchEvent(MouseEvent)` for SVG elements
  - `clickFirst` action: finds first matching element with retry, used for search results and map markers
  - Navigate action: highlights sidebar nav link → click animation → navigates to page
  - focusDialog action: after clicking buttons that open dialogs, shifts spotlight to the dialog
  - Single persistent Audio element with step ID guards prevents audio bleeding between steps
  - `showHighlight()` accepts guardId parameter to prevent stale spotlight updates on rapid skip
  - Audio cleanup: removeAttribute("src") + load() fully resets audio element between steps
  - TUT14 Settings: random theme preview during step, reverts on exit via CSS variable manipulation
  - Settings capture/restore uses proper Authorization Bearer token headers
  - "Next" button appears after narration finishes (no auto-advance)
  - Tutorial prompt dialog after every login (unless "Don't show again" checked)
  - Skip, mute, and close controls; per-user localStorage preference
  - Retry logic (up to 8 attempts) for finding target elements after page navigation
- **Full Mobile Responsiveness**: All pages and components responsive
  - Search bar visible on all screen sizes (w-[120px] sm:w-[200px] lg:w-[300px])
  - All page containers: p-3 sm:p-6, space-y-4 sm:space-y-6
  - All page titles: text-xl sm:text-2xl
  - Tutorial panel: responsive padding, text sizes, compact buttons on mobile
  - Gemini chat: responsive button (w-12 sm:w-14) and panel positioning
- Fixed Orders: customerName is free-text input (not dropdown), customerId optional in Mongoose model
- Fixed dark/light mode toggle in SettingsProvider

## Previous Changes (2026-02-21)
- Fixed Users page: correct API routes (/api/admin/users/*), online status dots, 3s confirmation dialogs, last admin protection, password display after creation/reset
- Fixed Inventory page: removed barcode field, added price adjustment (PATCH /api/items/:id), deduction validation, FormLabel context error fixed
- Fixed Orders: customerName schema now uses .default("") to prevent validation failures
- Billing page: advanced search with tabs (Date, Order ID, GCash #, Reference #), autocomplete, click-to-view detail dialogs
- System Logs: readable format (natural language descriptions), clickable detail dialogs, search with auto-predict
- Settings: font selection (10 Google Fonts), color theme (10 options), gradient sidebar background (11 options)
- Help page: expanded to 20 FAQs, employee-to-admin messaging system
- App layout: logout confirmation dialog, functional global search with dropdown results
- New backend routes: PATCH /api/items/:id, GET/POST /api/messages, PATCH /api/messages/:id/read

## Key Design Decisions
- **Append-only**: Inventory logs, order status history, and ledger entries cannot be edited/deleted
- **Direct Save**: All actions persist immediately to MongoDB
- **Role-based access**: ADMIN has full access; EMPLOYEE can manage inventory, orders, billing
- **JWT Auth**: Tokens stored in localStorage and sent via Authorization header
- **Online status**: Green dot if lastLogin within 5 minutes, gray otherwise
- **Confirmation dialogs**: 3-second countdown timer on destructive actions (deactivate, role change)
- **Settings context**: SettingsProvider applies font, color, gradient globally via CSS variables

## API Response Format
All API endpoints return: `{ success: boolean, data: ..., error?: string }`

## Environment Variables
- `MONGODB_URI` - MongoDB connection string
- `SESSION_SECRET` - JWT signing secret
- `GEMINI_API_KEY` - Google Gemini API key for AI chat and voice insight
- `GOOGLE_API_KEY` - Google Maps API key for address maps and customer distribution
