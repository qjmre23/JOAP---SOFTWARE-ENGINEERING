import bcrypt from "bcryptjs";
import User from "./models/User";
import Item from "./models/Item";
import Customer from "./models/Customer";
import AccountingAccount from "./models/AccountingAccount";
import Settings from "./models/Settings";
import { log } from "./index";

export async function seedDatabase() {
  try {
    const existingAdmin = await User.findOne({ username: "admin" });
    if (existingAdmin) {
      log("Database already seeded", "seed");
      return;
    }

    log("Seeding database...", "seed");

    const adminPassword = await bcrypt.hash("admin123", 10);
    const employeePassword = await bcrypt.hash("employee123", 10);

    await User.create([
      { username: "admin", password: adminPassword, role: "ADMIN", isActive: true },
      { username: "employee", password: employeePassword, role: "EMPLOYEE", isActive: true },
    ]);

    await Customer.create([
      { name: "Juan Dela Cruz", email: "juan@email.com", phone: "09171234567", address: "123 Rizal St, Manila" },
      { name: "Maria Santos", email: "maria@email.com", phone: "09189876543", address: "456 Bonifacio Ave, Quezon City" },
      { name: "Pedro Reyes", email: "pedro@email.com", phone: "09201112233", address: "789 Mabini Rd, Makati" },
      { name: "Ana Garcia", email: "ana@email.com", phone: "09154455667", address: "321 Luna St, Pasig" },
      { name: "Roberto Lim", email: "roberto@email.com", phone: "09167788990", address: "654 Del Pilar Blvd, Taguig" },
    ]);

    await Item.create([
      { itemName: "Portland Cement", category: "Cement", supplierName: "Republic Cement", unitPrice: 280, currentQuantity: 150, reorderLevel: 30, barcode: "CEM001" },
      { itemName: "Deformed Steel Bar 10mm", category: "Steel", supplierName: "Steel Asia", unitPrice: 185, currentQuantity: 200, reorderLevel: 50, barcode: "STL001" },
      { itemName: "Hollow Blocks 4\"", category: "Masonry", supplierName: "Local Supplier", unitPrice: 12, currentQuantity: 500, reorderLevel: 100, barcode: "MSN001" },
      { itemName: "Plywood 1/4\" Marine", category: "Wood", supplierName: "Wood Industries", unitPrice: 450, currentQuantity: 45, reorderLevel: 15, barcode: "WD001" },
      { itemName: "GI Wire #16", category: "Wire", supplierName: "Steel Corp", unitPrice: 85, currentQuantity: 80, reorderLevel: 20, barcode: "WR001" },
      { itemName: "Paint Latex White 4L", category: "Paint", supplierName: "Boysen", unitPrice: 650, currentQuantity: 8, reorderLevel: 10, barcode: "PNT001" },
      { itemName: "PVC Pipe 4\" x 10ft", category: "Plumbing", supplierName: "Atlanta Industries", unitPrice: 320, currentQuantity: 35, reorderLevel: 10, barcode: "PLB001" },
      { itemName: "Roof Nail 3\"", category: "Nails", supplierName: "Metal Works", unitPrice: 120, currentQuantity: 5, reorderLevel: 15, barcode: "NL001" },
      { itemName: "Sand (per cubic meter)", category: "Aggregates", supplierName: "Quarry Supply", unitPrice: 1200, currentQuantity: 20, reorderLevel: 5, barcode: "AGG001" },
      { itemName: "Gravel (per cubic meter)", category: "Aggregates", supplierName: "Quarry Supply", unitPrice: 1400, currentQuantity: 18, reorderLevel: 5, barcode: "AGG002" },
    ]);

    await AccountingAccount.create([
      { accountCode: "1000", accountName: "Cash/GCash", accountType: "Asset", balance: 0 },
      { accountCode: "1100", accountName: "Accounts Receivable", accountType: "Asset", balance: 0 },
      { accountCode: "1200", accountName: "Inventory", accountType: "Asset", balance: 0 },
      { accountCode: "2000", accountName: "Accounts Payable", accountType: "Liability", balance: 0 },
      { accountCode: "3000", accountName: "Owner's Equity", accountType: "Equity", balance: 0 },
      { accountCode: "4000", accountName: "Sales Revenue", accountType: "Revenue", balance: 0 },
      { accountCode: "5000", accountName: "Cost of Goods Sold", accountType: "Expense", balance: 0 },
      { accountCode: "5100", accountName: "Operating Expenses", accountType: "Expense", balance: 0 },
    ]);

    await Settings.create({
      companyName: "JOAP Hardware Trading",
      theme: "light",
      reorderThreshold: 10,
      lowStockThreshold: 20,
    });

    log("Database seeded successfully!", "seed");
    log("Admin credentials: username=admin, password=admin123", "seed");
    log("Employee credentials: username=employee, password=employee123", "seed");
  } catch (err) {
    console.error("Seeding error:", err);
  }
}
