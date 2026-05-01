# JOAP Hardware Trading - Supplier Management System

## Overview
Full-stack supplier management system for JOAP Hardware Trading. Built with React/TypeScript frontend and Node.js/Express backend with MongoDB.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui, served via Vite
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Real-time**: Socket.IO for live dashboard updates
- **Auth**: JWT-based authentication with admin/employee roles
- **Email**: Resend API for password reset emails

## Project Structure
```
Server-Setup-1/
├── client/src/
│   ├── pages/           # Page components (dashboard, inventory, orders, billing, etc.)
│   ├── components/      # Shared UI components (sidebar, tutorial, gemini-chat)
│   ├── hooks/           # Custom hooks (use-toast, use-mobile)
│   └── lib/             # Utilities (auth, queryClient, settings-context)
├── server/
│   ├── index.ts         # Express server entry point
│   ├── routes.ts        # All API routes
│   ├── models/          # Mongoose models (User, Order, Item, Customer, etc.)
│   ├── db.ts            # MongoDB connection
│   ├── seed.ts          # Database seeding
│   ├── vite.ts          # Vite dev server setup
│   └── static.ts        # Static file serving (production)
├── shared/
│   └── schema.ts        # Shared TypeScript interfaces
└── vite.config.ts       # Vite configuration
```

## Key Features
- **Inventory Management**: Items CRUD with categories, pricing, stock tracking
- **Order Management**: Create orders, track status (Created → Payment → Release → Complete)
- **Billing**: Payment processing with partial payment support (amountPaid tracking)
- **Accounting**: General ledger with reversing entries support
- **Customer Management**: Customer profiles with addresses
- **Reports**: Sales and inventory reports with PDF/CSV export
- **Dashboard**: Real-time updates via Socket.IO, charts, calendar heatmap, forecast
- **User Management**: Admin/Employee roles, user activation/deactivation
- **Password Reset**: Forgot password via Resend email (Admin only; Employees contact admin)
- **Profile**: Email editing from header profile dialog
- **Tutorial System**: Audio tutorials for admin and employee roles
- **Help/About**: FAQ section, feedback form, version/credits info
- **Search**: Global search with grouped results by entity type

## Environment Variables
- `MONGODB_URI` - MongoDB connection string
- `SESSION_SECRET` - JWT session secret
- `RESEND_API_KEY` - Resend email API key
- `GOOGLE_API_KEY` - Google Maps API key
- `GEMINI_API_KEY` - Google Gemini AI API key

## Default Credentials
- Admin: username=admin, password=admin123
- Employee: username=employee, password=employee123

## Running
- Workflow: `cd Server-Setup-1 && npm run dev`
- Port: 5000
