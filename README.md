# JOAP Hardware Trading - Supplier Management System

A comprehensive, AI-powered management system designed specifically for JOAP Hardware Trading. This platform streamlines inventory tracking, order processing, financial accounting, and business analytics with a focus on ease of use and intelligent insights.

## 🚀 Features

### 📊 Real-time Dashboard
*   **Performance Metrics**: Track total earnings, order volume, and customer growth with real-time trend indicators.
*   **Revenue Analytics**: Interactive charts showing revenue and order trends over daily, weekly, monthly, and yearly periods.
*   **Activity Calendar**: A heatmap visualization of system activity (orders and payments) to identify peak business days.
*   **AI Forecast**: 7-day revenue forecasting powered by Gemini AI.

### 📦 Inventory Management
*   **Stock Tracking**: Real-time monitoring of stock levels with automatic "Low Stock" and "Critical" alerts.
*   **Reorder Optimization**: Set custom reorder levels for every item to ensure you never run out of stock.
*   **Barcode Support**: Search and identify items instantly using barcode integration.
*   **Image Approvals**: Employees can upload product images which admins review before they go live.

### 🛒 Order & Sales Processing
*   **Multi-Channel Sales**: Record orders from walk-ins, phone, email, or messaging platforms.
*   **Status Workflow**: Track orders from "Pending Payment" through "Paid", "Released", and "Completed".
*   **Billing Integration**: Log GCash payments with reference number tracking and payment history.
*   **Secure Release**: Managed item release process to ensure inventory accuracy.

### 📑 Accounting & Finance
*   **General Ledger**: Automatic entry creation for all sales and payments.
*   **Chart of Accounts**: Comprehensive tracking of Assets, Liabilities, Equity, Revenue, and Expenses.
*   **Financial Reports**: Generate detailed sales and inventory reports for any date range.
*   **Export Support**: Export data and reports for external use.

### 🤖 Gemini AI Integration
*   **AI Assistant**: A floating chat assistant that answers questions about your business data using the latest Gemini Flash models.
*   **Voice Insights**: Double-click any chart or data point to receive a spoken AI analysis of that specific metric.
*   **Context-Aware**: The AI understands your current inventory levels, order status, and financial health to provide accurate advice.

### 🛠️ Administration & Security
*   **Role-Based Access**: Separate interfaces and permissions for Admins and Employees.
*   **System Logs**: Detailed audit trail of every action taken within the system.
*   **Maintenance Tools**: Built-in backup and restore functionality to keep your data safe.
*   **Customization**: System-wide theme, font, and aesthetic customization.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI, Lucide Icons.
*   **Backend**: Node.js, Express, MongoDB (Mongoose).
*   **Real-time**: Socket.IO for live dashboard and notification updates.
*   **AI**: Google Gemini API (Flash 3.1 Lite / Flash 3 / Flash 2.5).
*   **Email**: Nodemailer with Gmail SMTP integration.
*   **State Management**: TanStack Query (React Query) for efficient data fetching.

## 📋 Getting Started

### Prerequisites
*   Node.js (v20 or higher)
*   MongoDB Atlas account or local MongoDB instance

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/qjmre23/JOAP---SOFTWARE-ENGINEERING.git
    cd JOAP-1
    ```

2.  Install dependencies for the root and the server:
    ```bash
    npm install
    cd Server-Setup-1
    npm install
    ```

3.  Configure Environment Variables:
    Create/update the environment configuration with the following keys:
    *   `MONGODB_URI`: Your MongoDB connection string.
    *   `GEMINI_API_KEY`: Your Google Gemini AI API key.
    *   `GMAIL_USER`: Your Gmail address.
    *   `GMAIL_PASS`: Your Gmail App Password.

4.  Run the application:
    ```bash
    # From the root directory
    npm run dev
    ```

The application will be available at `http://localhost:5000`.

## 🔐 Default Credentials

*   **Admin**: `admin` / `admin123`
*   **Employee**: `employee` / `employee123`

## 📁 Project Structure

*   `/client`: React frontend source code and components.
*   `/server`: Express backend, MongoDB models, and API routes.
*   `/shared`: Shared TypeScript interfaces and Zod schemas.
*   `/attached_assets`: Project documentation and reference materials.
*   `/tutorial_mp3`: Narration files for the interactive system tutorial.

---
© 2024 JOAP Hardware Trading. Built with modern full-stack technologies.
