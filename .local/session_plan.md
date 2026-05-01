# Objective
Implement multiple enhancements to the JOAP Supplier Management System including: forgot password with Resend email, tutorial audio fixes, user profile email editing, accounting reversing entries, partial payment support, real-time dashboard updates, search UI improvements, reports module enhancements, and Help/About page refinements.

# Tasks

### T001: Fix Tutorial Audio Mapping & Add Email to User Model
- **Blocked By**: []
- **Details**:
  - Verify tutorial mp3 mappings are correct (tut2, tut6, tut9, tut13 seem already correct in code — confirm and note)
  - Add `email` field to User model in `Server-Setup-1/server/models/User.ts`
  - Add `email` to IUser interface in `Server-Setup-1/shared/schema.ts`
  - Files: `Server-Setup-1/server/models/User.ts`, `Server-Setup-1/shared/schema.ts`
  - Acceptance: User model has email field, IUser interface updated

### T002: Implement Forgot Password Backend with Resend
- **Blocked By**: [T001]
- **Details**:
  - Install and configure Resend in server routes using env var RESEND_API_KEY
  - Add POST `/api/auth/forgot-password` endpoint:
    - Accept `username` in body
    - Look up user, check role
    - If EMPLOYEE: return error "Please contact your admin"
    - If ADMIN: generate secure random reset token (crypto.randomBytes), store token + expiry (15 min) on user doc, send reset email via Resend
    - Email from: `onboarding@resend.dev`, to: user's email
  - Add POST `/api/auth/reset-password` endpoint:
    - Accept `token` and `newPassword`
    - Verify token exists and not expired
    - Hash new password with bcrypt, update user, clear token fields
    - Log action in SystemLog
  - Add GET `/api/auth/verify-reset-token` to check token validity
  - Add PATCH `/api/auth/profile/email` for authenticated users to update their email
  - Files: `Server-Setup-1/server/routes.ts`
  - Acceptance: All endpoints work correctly, Resend sends emails

### T003: Implement Forgot Password & Profile Client Pages
- **Blocked By**: [T002]
- **Details**:
  - Create `Server-Setup-1/client/src/pages/forgot-password.tsx` with form to enter username, show success/error messages
  - Create `Server-Setup-1/client/src/pages/reset-password.tsx` with form to enter new password (reads token from URL)
  - Add "Forgot Password?" link to login page
  - Add routes in App.tsx for /forgot-password and /reset-password
  - Add profile section in header or settings page for email editing with form validation
  - Files: `Server-Setup-1/client/src/pages/forgot-password.tsx`, `Server-Setup-1/client/src/pages/reset-password.tsx`, `Server-Setup-1/client/src/pages/login.tsx`, `Server-Setup-1/client/src/App.tsx`
  - Acceptance: Full forgot password flow works, email can be edited from profile

### T004: Implement Accounting Reversing Entries
- **Blocked By**: []
- **Details**:
  - Add `isReversing` and `originalEntryId` fields to GeneralLedgerEntry model if not present
  - Add POST `/api/accounting/reversals` endpoint (admin only):
    - Accept `entryId` 
    - Look up original entry
    - Create reversing entry with swapped debit/credit, set isReversing=true, link to originalEntryId
    - Log action in SystemLog
  - Update accounting summary to include reversing data
  - Update client `accounting.tsx` page to:
    - Show reversing entries with visual indicator
    - Add "Reverse" button on ledger entries with confirmation dialog
    - Update charts/summaries to reflect reversals
  - Files: `Server-Setup-1/server/models/GeneralLedgerEntry.ts`, `Server-Setup-1/server/routes.ts`, `Server-Setup-1/client/src/pages/accounting.tsx`
  - Acceptance: Admin can create reversing entries, they appear in ledger with indicators

### T005: Implement Partial Payment Support
- **Blocked By**: []
- **Details**:
  - Modify Order model to add `amountPaid` field (default 0)
  - Modify billing pay endpoint to:
    - Allow partial payments (remove the check requiring full amount)
    - Track cumulative amountPaid on Order
    - Only transition to "Pending Release" when full amount is paid
    - Keep as "Pending Payment" with updated amountPaid for partial
  - Update Order model in `Server-Setup-1/server/models/Order.ts`
  - Update billing page to show payment progress and allow additional payments
  - Update order detail page to show payment history
  - Files: `Server-Setup-1/server/models/Order.ts`, `Server-Setup-1/server/routes.ts`, `Server-Setup-1/client/src/pages/billing.tsx`, `Server-Setup-1/client/src/pages/order-detail.tsx`
  - Acceptance: Multiple payments allowed per order, status transitions correctly

### T006: Enhance Real-time Dashboard & Search UI
- **Blocked By**: []
- **Details**:
  - Add Socket.IO client subscription to dashboard page
  - Subscribe to ORDER_CREATED, ORDER_PAID, ORDER_RELEASED, INVENTORY_LOG_CREATED, LEDGER_POSTED events
  - On event receipt, invalidate relevant react-query caches to trigger refetch
  - Make sure emitEvent calls include ORDER_PAID event
  - Enhance global search UI in App.tsx to group results by entity type
  - Show section headers (Items, Orders, Customers) in search dropdown
  - Files: `Server-Setup-1/client/src/pages/dashboard.tsx`, `Server-Setup-1/client/src/App.tsx`
  - Acceptance: Dashboard updates in real-time, search results are grouped

### T007: Enhance Reports, Help, About Pages
- **Blocked By**: []
- **Details**:
  - Reports: Add PDF export using jspdf (already a dependency), ensure CSV export works
  - Reports: Make sure forecast tab works with ARIMA data and has proper charts
  - Help page: Ensure FAQs exist, feedback form stored in SystemLog, admin message handling
  - About page: Display version 1.0.0, tech stack, developer credit "JOAP HARDWARE"
  - Files: `Server-Setup-1/client/src/pages/reports.tsx`, `Server-Setup-1/client/src/pages/help.tsx`, `Server-Setup-1/client/src/pages/about.tsx`
  - Acceptance: Reports have export options, Help has FAQs/feedback, About shows correct info
