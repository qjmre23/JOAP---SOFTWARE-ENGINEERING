# Objective
Implement research paper algorithms into the JOAP Hardware Trading system: Trie-based prefix search, Hashing-based lookup, FIFO inventory processing, ARIMA-like forecasting, and verify bcrypt authentication. All must be real working implementations integrated end-to-end.

# Tasks

### T001: Implement Trie Data Structure for Prefix Search
- **Blocked By**: []
- **Details**:
  - Create `server/trie.ts` with a real Trie class (insert, search, prefixSearch methods)
  - On server startup, build the trie from Items (itemName, category), Customers (name), Orders (trackingNumber)
  - Rebuild/update trie when data changes (item created/updated, customer created, order created)
  - Create new endpoint `GET /api/search/autocomplete?q=...` that uses trie prefix matching
  - Update existing `GET /api/search` to use trie for initial prefix candidates, then confirm with MongoDB
  - Frontend: Update GlobalSearch in `client/src/App.tsx` to call autocomplete endpoint for suggestions
  - Files: `server/trie.ts` (new), `server/routes.ts`, `client/src/App.tsx`
  - Acceptance: Typing "ste" in search bar shows prefix-matched suggestions from trie

### T002: Implement Hashing-based Lookup for Fast ID Search
- **Blocked By**: []
- **Details**:
  - Create `server/hashIndex.ts` with a HashMap class for O(1) lookups by ID/trackingNumber
  - Build hash indexes on startup for: Items (by _id, barcode), Orders (by _id, trackingNumber), Customers (by _id)
  - Update on data changes (create/update/delete)
  - Add endpoint `GET /api/lookup/:type/:key` for direct hash-based retrieval
  - Integrate into existing search: when query matches exact ID/tracking number, use hash lookup first
  - Files: `server/hashIndex.ts` (new), `server/routes.ts`
  - Acceptance: Looking up an order by tracking number uses hash-based O(1) retrieval

### T003: Implement FIFO Inventory Processing with Batches
- **Blocked By**: []
- **Details**:
  - Create `server/models/InventoryBatch.ts` - Mongoose model with fields: itemId, quantity, remainingQuantity, unitCost, createdAt
  - When items are restocked (inventory log type "restock"), create a new InventoryBatch
  - Create initial batches from existing item quantities on first run
  - Modify order release logic in routes.ts: deduct from oldest batches first (FIFO)
  - Track COGS (Cost of Goods Sold) from FIFO batch costs
  - Update manual deduction logic to also use FIFO
  - Add `GET /api/inventory/:id/batches` endpoint to view batch breakdown
  - Files: `server/models/InventoryBatch.ts` (new), `server/routes.ts`
  - Acceptance: Releasing an order deducts from oldest inventory batches first

### T004: Implement ARIMA-like Forecasting
- **Blocked By**: []
- **Details**:
  - Create `server/forecast.ts` with ARIMA-like forecasting (AR + Moving Average + trend)
  - Analyze historical BillingPayment and Order data (last 90+ days)
  - Produce 30-day revenue and order count forecasts
  - Upgrade `GET /api/reports/forecast` to use the ARIMA-like model
  - Add `GET /api/dashboard/forecast` for dashboard forecast widget
  - Frontend: Update reports.tsx forecast tab to display forecast chart with historical + predicted data
  - Add forecast mini-widget or overlay on dashboard revenue chart
  - Files: `server/forecast.ts` (new), `server/routes.ts`, `client/src/pages/reports.tsx`, `client/src/pages/dashboard.tsx`
  - Acceptance: Forecast tab shows historical data + ARIMA-predicted future values on a chart

### T005: Verify and Document bcrypt Authentication
- **Blocked By**: []
- **Details**:
  - bcrypt is already used (verified in seed.ts and routes.ts login/create/reset)
  - Add explicit code comments documenting bcrypt usage in auth routes
  - Verify password reset also uses bcrypt
  - Files: `server/routes.ts`
  - Acceptance: All password operations use bcrypt.hash and bcrypt.compare

### T006: Frontend Integration and UI Updates
- **Blocked By**: [T001, T002, T003, T004]
- **Details**:
  - GlobalSearch: show trie-powered autocomplete dropdown with prefix suggestions
  - Inventory page: add "Batches" view showing FIFO batch breakdown per item
  - Reports forecast tab: proper ARIMA chart with historical + forecast zones
  - Dashboard: forecast indicator on revenue section
  - Files: `client/src/App.tsx`, `client/src/pages/inventory.tsx`, `client/src/pages/reports.tsx`, `client/src/pages/dashboard.tsx`
  - Acceptance: All algorithm features are visible and functional in the UI

### T007: Update Documentation
- **Blocked By**: [T001, T002, T003, T004, T005, T006]
- **Details**:
  - Update replit.md with all new features and architecture changes
  - Files: `replit.md`
  - Acceptance: Documentation reflects all algorithm implementations
