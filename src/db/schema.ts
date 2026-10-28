import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, doublePrecision, jsonb, primaryKey } from 'drizzle-orm/pg-core';

// Define 'users' table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define 'posts' table (for editing/posting info articles)
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  category: text('category').default('Tin tức').notNull(), // 'Tin tức', 'Mẹo thi công', 'Vật liệu', 'Dự án'
  authorId: integer('author_id')
    .references(() => users.id)
    .notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define relationships for 'users'
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

// Define relationships for 'posts'
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// --- KIOTX BUSINESS AND MULTI-TENANT SAAS DATABASE SCHEMA ---

// 1. Trials table
export const trials = pgTable('trials', {
  id: text('id').primaryKey().notNull(),
  shopName: text('shop_name').notNull(),
  ownerName: text('owner_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  password: text('password'),
  address: text('address').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  expireDate: text('expire_date').notNull(),
  status: text('status').default('TRIAL_ACTIVE').notNull(),
  allowedModules: jsonb('allowed_modules'),
});

// 2. Products table
export const products = pgTable('products', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  barcode: text('barcode'),
  category: text('category').notNull(),
  costPrice: doublePrecision('cost_price').notNull(),
  sellingPrice: doublePrecision('selling_price').notNull(),
  stock: doublePrecision('stock').notNull(),
  minStock: doublePrecision('min_stock').notNull(),
  unit: text('unit').notNull(),
  imageUrl: text('image_url'),
  expiryDate: text('expiry_date'),
  parentUnitId: text('parent_unit_id'),
  conversionRate: doublePrecision('conversion_rate'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 3. Categories table
export const categories = pgTable('categories', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 4. Customers table
export const customers = pgTable('customers', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  totalSpent: doublePrecision('total_spent').notNull(),
  points: doublePrecision('points').notNull(),
  tier: text('tier').notNull(),
  avatar: text('avatar'),
  debt: doublePrecision('debt'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 5. Suppliers table
export const suppliers = pgTable('suppliers', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  companyName: text('company_name'),
  debt: doublePrecision('debt'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 6. Invoices table
export const invoices = pgTable('invoices', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  invoiceCode: text('invoice_code').notNull(),
  customerId: text('customer_id'),
  customerName: text('customer_name').notNull(),
  items: jsonb('items').notNull(), // OrderItem[]
  totalOriginal: doublePrecision('total_original').notNull(),
  discountAmount: doublePrecision('discount_amount').notNull(),
  totalPayable: doublePrecision('total_payable').notNull(),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').notNull(),
  date: text('date').notNull(),
  cashierName: text('cashier_name').notNull(),
  pointsEarned: doublePrecision('points_earned').notNull(),
  cancelReason: text('cancel_reason'),
  cancelledBy: text('cancelled_by'),
  cancelDate: text('cancel_date'),
  eInvoiceCode: text('e_invoice_code'),
  eInvoiceStatus: text('e_invoice_status'),
  eInvoiceUrl: text('e_invoice_url'),
  eInvoiceError: text('e_invoice_error'),
  taxRate: doublePrecision('tax_rate'),
  taxAmount: doublePrecision('tax_amount'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 7. Staff table
export const staffTable = pgTable('staff', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  phone: text('phone').notNull(),
  active: boolean('active').notNull(),
  password: text('password'),
  permissions: jsonb('permissions'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 8. Settings table
export const settingsTable = pgTable('settings', {
  trialId: text('trial_id').primaryKey().notNull(),
  shopName: text('shop_name').notNull(),
  address: text('address'),
  phone: text('phone'),
  logoUrl: text('logo_url'),
  taxRate: doublePrecision('tax_rate'),
  currency: text('currency'),
  zaloNumber: text('zalo_number'),
  seoTitle: text('seo_title'),
  seoKeywords: text('seo_keywords'),
  reportDeletePassword: text('report_delete_password'),
  bankName: text('bank_name'),
  bankAccount: text('bank_account'),
  bankOwner: text('bank_owner'),
  eInvoiceEnabled: boolean('e_invoice_enabled'),
  eInvoiceProvider: text('e_invoice_provider'),
  eInvoiceTaxCode: text('e_invoice_tax_code'),
  eInvoiceApiUrl: text('e_invoice_api_url'),
  eInvoiceUsername: text('e_invoice_username'),
  eInvoicePassword: text('e_invoice_password'),
  eInvoicePattern: text('e_invoice_pattern'),
  eInvoiceSerial: text('e_invoice_serial'),
});

// 9. Audits table
export const auditsTable = pgTable('audits', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  auditCode: text('audit_code').notNull(),
  date: text('date').notNull(),
  auditorName: text('auditor_name').notNull(),
  items: jsonb('items').notNull(), // InventoryAuditItem[]
  status: text('status').notNull(),
  notes: text('notes'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 10. Purchase Orders table
export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  orderCode: text('order_code').notNull(),
  date: text('date').notNull(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  items: jsonb('items').notNull(), // PurchaseOrderItem[]
  totalAmount: doublePrecision('total_amount').notNull(),
  amountPaid: doublePrecision('amount_paid').notNull(),
  amountOwed: doublePrecision('amount_owed').notNull(),
  status: text('status').notNull(),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 11. Cashbook table
export const cashbookTable = pgTable('cashbook', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  entryCode: text('entry_code').notNull(),
  type: text('type').notNull(),
  amount: doublePrecision('amount').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  paymentMethod: text('payment_method').notNull(),
  date: text('date').notNull(),
  creatorName: text('creator_name').notNull(),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 12. Projects table
export const projectsTable = pgTable('projects', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  customerName: text('customer_name').notNull(),
  customerId: text('customer_id'),
  status: text('status').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  materials: jsonb('materials').notNull(), // ProjectMaterial[]
  staff: jsonb('staff').notNull(), // ProjectStaff[]
  budget: doublePrecision('budget').notNull(),
  expenses: doublePrecision('expenses').notNull(),
  notes: text('notes'),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 13. Cash shifts table
export const cashShiftsTable = pgTable('cash_shifts', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  code: text('code').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  staffId: text('staff_id').notNull(),
  staffName: text('staff_name').notNull(),
  initialCash: doublePrecision('initial_cash').notNull(),
  expectedCash: doublePrecision('expected_cash').notNull(),
  actualCash: doublePrecision('actual_cash'),
  expectedBank: doublePrecision('expected_bank').notNull(),
  actualBank: doublePrecision('actual_bank'),
  notes: text('notes'),
  status: text('status').notNull(),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

// 14. System Logs table
export const systemLogsTable = pgTable('system_logs', {
  id: text('id').notNull(),
  trialId: text('trial_id').notNull(),
  actionType: text('action_type').notNull(),
  actionName: text('action_name').notNull(),
  description: text('description').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  timestamp: text('timestamp').notNull(),
}, (table) => [
  primaryKey({ columns: [table.id, table.trialId] })
]);

