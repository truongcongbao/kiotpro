import { Product, Category, Customer, Supplier, Invoice, Staff, ShopSetting, InventoryAudit, PurchaseOrder, CashbookEntry, Project, SystemAuditLog } from "../types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Đồ uống & Nước giải khát", description: "Bia, nước ngọt, nước tinh khiết, sữa hộp" },
  { id: "cat-2", name: "Thực phẩm đóng gói & Bánh kẹo", description: "Mì gói, snack, bánh quy, kẹo sô-cô-la" },
  { id: "cat-3", name: "Gia vị & Nông sản khô", description: "Dầu ăn, nước mắm, gạo thơm, bột ngọt, hạt nêm" },
  { id: "cat-4", name: "Hóa mỹ phẩm & Chăm sóc cá nhân", description: "Sữa tắm, nước giặt, dầu gội, kem đánh răng" }
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    code: "NUOC0001",
    name: "Nước ngọt Pepsi Lon 320ml",
    barcode: "8934588012112",
    category: "Đồ uống & Nước giải khát",
    costPrice: 7500,
    sellingPrice: 10000,
    stock: 450,
    minStock: 48,
    unit: "Lon",
    imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2027-06-15",
    conversionRate: 1
  },
  {
    id: "prod-1-case",
    code: "NUOC0002",
    name: "Bia Heineken Lon 330ml",
    barcode: "8934822001121",
    category: "Đồ uống & Nước giải khát",
    costPrice: 16500,
    sellingPrice: 20000,
    stock: 240,
    minStock: 24,
    unit: "Lon",
    imageUrl: "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2026-12-25"
  },
  {
    id: "prod-2",
    code: "THUC0001",
    name: "Mì ăn liền Hảo Hảo Tôm Chua Cay 75g",
    barcode: "8934563138162",
    category: "Thực phẩm đóng gói & Bánh kẹo",
    costPrice: 3500,
    sellingPrice: 4500,
    stock: 1200,
    minStock: 100,
    unit: "Gói",
    imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2026-11-30"
  },
  {
    id: "prod-3",
    code: "GIAV0001",
    name: "Dầu ăn Simply Đậu Nành Chai 1L",
    barcode: "8936011381254",
    category: "Gia vị & Nông sản khô",
    costPrice: 43000,
    sellingPrice: 55000,
    stock: 120,
    minStock: 20,
    unit: "Chai",
    imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2027-03-10"
  },
  {
    id: "prod-4",
    code: "GIAV0002",
    name: "Gạo Thơm Sóc Trăng ST25 Túi 5kg",
    barcode: "8938500245012",
    category: "Gia vị & Nông sản khô",
    costPrice: 155000,
    sellingPrice: 190000,
    stock: 85,
    minStock: 10,
    unit: "Túi",
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2027-02-15"
  },
  {
    id: "prod-5",
    code: "HOAM0001",
    name: "Nước giặt OMO Matic Cửa Trên Túi 2.0kg",
    barcode: "8934841212351",
    category: "Hóa mỹ phẩm & Chăm sóc cá nhân",
    costPrice: 125000,
    sellingPrice: 158000,
    stock: 95,
    minStock: 15,
    unit: "Túi",
    imageUrl: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2028-05-18"
  },
  {
    id: "prod-6",
    code: "NUOC0003",
    name: "Sữa tươi tiệt trùng TH True Milk Ít Đường 180ml",
    barcode: "8936039141121",
    category: "Đồ uống & Nước giải khát",
    costPrice: 6800,
    sellingPrice: 8500,
    stock: 600,
    minStock: 48,
    unit: "Hộp",
    imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=400&q=80",
    expiryDate: "2026-10-15"
  }
];

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    name: "Nguyễn Hoàng Yến",
    phone: "0905123456",
    email: "hoangyen.nguyen@gmail.com",
    address: "Khu dân cư Đại Quang, Dĩ An",
    totalSpent: 4500000,
    points: 450,
    tier: "Silver",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    debt: 350000 // Khách nợ mua lẻ hàng tháng
  },
  {
    id: "cust-2",
    name: "Lê Thị Mai Anh",
    phone: "0934888999",
    email: "maianh.le@yahoo.com",
    address: "72 Lý Thường Kiệt, Dĩ An",
    totalSpent: 1250000,
    points: 125,
    tier: "Bronze",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "cust-3",
    name: "Trần Minh Quân",
    phone: "0912333444",
    email: "quan.tm@outlook.com",
    address: "Trung tâm Hành chính Dĩ An",
    totalSpent: 15400000,
    points: 1540,
    tier: "Gold",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    debt: 0
  },
  {
    id: "cust-4",
    name: "Khách vãng lai",
    phone: "0999999999",
    totalSpent: 0,
    points: 0,
    tier: "Standard"
  }
];

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Tổng Kho Bia Nước Ngọt Miền Nam",
    phone: "02838444555",
    email: "giao-nhan@kho-nuocngot.vn",
    address: "Phường Linh Trung, Thủ Đức, TP. HCM",
    companyName: "Công ty TNHH Thương mại Dịch vụ Đồ uống Miền Nam",
    debt: 12000000 // Tiền nhập hàng chưa thanh toán hết
  },
  {
    id: "sup-2",
    name: "Nhà phân phối Hàng tiêu dùng Kinh Đô & Acecook",
    phone: "0903112233",
    email: "phanphoi.kinhdo.acecook@gmail.com",
    address: "KCN Sóng Thần 1, Dĩ An",
    companyName: "Công ty Cổ phần Thương mại Phân phối Quốc tế Hoàng Hà",
    debt: 5000000
  }
];

// Invoices distributed over the last 7 days
const generatePastDate = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

export const DEFAULT_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    invoiceCode: "HD000001",
    customerId: "cust-1",
    customerName: "Nguyễn Hoàng Yến",
    items: [
      { productId: "prod-1", productName: "Nước ngọt Pepsi Lon 320ml", productCode: "NUOC0001", quantity: 6, unitPrice: 10000, discount: 0, total: 60000 },
      { productId: "prod-2", productName: "Mì ăn liền Hảo Hảo Tôm Chua Cay 75g", productCode: "THUC0001", quantity: 30, unitPrice: 4500, discount: 0, total: 135000 }
    ],
    totalOriginal: 195000,
    discountAmount: 15000,
    totalPayable: 180000,
    paymentMethod: "CASH",
    status: "COMPLETED",
    date: `${generatePastDate(6)}T10:15:30Z`,
    cashierName: "Trương Công Bảo",
    pointsEarned: 18
  },
  {
    id: "inv-2",
    invoiceCode: "HD000002",
    customerId: "cust-2",
    customerName: "Lê Thị Mai Anh",
    items: [
      { productId: "prod-3", productName: "Dầu ăn Simply Đậu Nành Chai 1L", productCode: "GIAV0001", quantity: 2, unitPrice: 55000, discount: 5000, total: 100000 },
      { productId: "prod-4", productName: "Gạo Thơm Sóc Trăng ST25 Túi 5kg", productCode: "GIAV0002", quantity: 1, unitPrice: 190000, discount: 0, total: 190000 }
    ],
    totalOriginal: 300000,
    discountAmount: 10000,
    totalPayable: 290000,
    paymentMethod: "BANK_TRANSFER",
    status: "COMPLETED",
    date: `${generatePastDate(5)}T14:45:00Z`,
    cashierName: "Trương Công Bảo",
    pointsEarned: 29
  },
  {
    id: "inv-3",
    invoiceCode: "HD000003",
    customerId: "cust-3",
    customerName: "Trần Minh Quân",
    items: [
      { productId: "prod-5", productName: "Nước giặt OMO Matic Cửa Trên Túi 2.0kg", productCode: "HOAM0001", quantity: 2, unitPrice: 158000, discount: 8000, total: 308000 }
    ],
    totalOriginal: 316000,
    discountAmount: 16000,
    totalPayable: 300000,
    paymentMethod: "BANK_TRANSFER",
    status: "COMPLETED",
    date: `${generatePastDate(4)}T09:30:10Z`,
    cashierName: "Trương Công Bảo",
    pointsEarned: 30
  },
  {
    id: "inv-4",
    invoiceCode: "HD000004",
    customerName: "Khách vãng lai",
    items: [
      { productId: "prod-1", productName: "Nước ngọt Pepsi Lon 320ml", productCode: "NUOC0001", quantity: 12, unitPrice: 10000, discount: 0, total: 120000 },
      { productId: "prod-6", productName: "Sữa tươi tiệt trùng TH True Milk Ít Đường 180ml", productCode: "NUOC0003", quantity: 12, unitPrice: 8500, discount: 0, total: 102000 }
    ],
    totalOriginal: 222000,
    discountAmount: 12000,
    totalPayable: 210000,
    paymentMethod: "CASH",
    status: "COMPLETED",
    date: `${generatePastDate(3)}T18:22:15Z`,
    cashierName: "Trương Công Bảo",
    pointsEarned: 0
  }
];

export const DEFAULT_STAFF: Staff[] = [
  { id: "staff-1", name: "Trương Công Bảo", email: "congbaotruong8@gmail.com", role: "OWNER", phone: "0901234567", active: true },
  { id: "staff-2", name: "Nguyễn Văn Nam", email: "namnv@kiotx.vn", role: "CASHIER", phone: "0911222333", active: true },
  { id: "staff-3", name: "Lê Quốc Bảo", email: "quocbao@kiotx.vn", role: "MANAGER", phone: "0977888999", active: true }
];

export const DEFAULT_SETTINGS: ShopSetting = {
  shopName: "Cửa hàng Tiện lợi KiotX",
  address: "Phường Đại Quang, TP. Dĩ An",
  phone: "090.888.9999",
  logoUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=150&q=80",
  taxRate: 8, // 8% VAT
  currency: "VND",
  zaloNumber: "0908889999",
  seoTitle: "Cửa hàng Tiện lợi KiotX | Bách hóa bỉm sữa đồ gia dụng",
  seoKeywords: "bach hoa tien loi, cua hang tien loi, tạp hóa tiện lợi, kiotx",
  reportDeletePassword: "admin123",
  bankName: "MB",
  bankAccount: "7919399999",
  bankOwner: "TRUONG CONG BAO",
  eInvoiceEnabled: false,
  eInvoiceProvider: "MOCK",
  eInvoiceTaxCode: "3701548239",
  eInvoiceApiUrl: "https://api.meinvoice.vn/v1/integration",
  eInvoiceUsername: "kiotx.corp",
  eInvoicePassword: "••••••••••••",
  eInvoicePattern: "1C26TML",
  eInvoiceSerial: "C26KTX",
  printerPaperSize: "K80",
  printerAutoPrint: false,
  printerHeaderNote: "Trân trọng cảm ơn quý khách!",
  printerFooterNote: "Cảm ơn quý khách & Hẹn gặp lại!",
  printerShowBarcode: true,
  printerShowLogo: true,
  printerConnectionType: "SYSTEM",
  printerIPAddress: "192.168.1.100",
  printerDeviceName: "Xprinter XP-420B"
};

export const DEFAULT_AUDITS: InventoryAudit[] = [
  {
    id: "audit-1",
    auditCode: "KK20260001",
    date: `${generatePastDate(15)}T17:00:00Z`,
    auditorName: "Lê Quốc Bảo",
    items: [
      { productId: "prod-1", productName: "Nước ngọt Pepsi Lon 320ml", productCode: "NUOC0001", systemQty: 450, actualQty: 450, discrepancy: 0, notes: "Khớp số liệu" },
      { productId: "prod-2", productName: "Mì ăn liền Hảo Hảo Tôm Chua Cay 75g", productCode: "THUC0001", systemQty: 1205, actualQty: 1200, discrepancy: -5, notes: "Hỏng bao bì rách vỏ" }
    ],
    status: "COMPLETED",
    notes: "Kiểm kê định kỳ quầy bánh kẹo & nước giải khát tháng 6"
  }
];

export const DEFAULT_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po-1",
    orderCode: "PN000001",
    date: `${generatePastDate(5)}T08:30:00Z`,
    supplierId: "sup-1",
    supplierName: "Tổng Kho Bia Nước Ngọt Miền Nam",
    items: [
      { productId: "prod-1", productName: "Nước ngọt Pepsi Lon 320ml", productCode: "NUOC0001", quantity: 300, costPrice: 7500, total: 2250000 }
    ],
    totalAmount: 2250000,
    amountPaid: 2000000,
    amountOwed: 250000,
    status: "COMPLETED"
  },
  {
    id: "po-2",
    orderCode: "PN000002",
    date: `${generatePastDate(2)}T09:15:00Z`,
    supplierId: "sup-2",
    supplierName: "Nhà phân phối Hàng tiêu dùng Kinh Đô & Acecook",
    items: [
      { productId: "prod-2", productName: "Mì ăn liền Hảo Hảo Tôm Chua Cay 75g", productCode: "THUC0001", quantity: 600, costPrice: 3500, total: 2100000 }
    ],
    totalAmount: 2100000,
    amountPaid: 2100000,
    amountOwed: 0,
    status: "COMPLETED"
  }
];

export const DEFAULT_CASHBOOK: CashbookEntry[] = [
  {
    id: "cb-1",
    entryCode: "SQ000001",
    type: "EXPENSE",
    amount: 1200000,
    category: "Chi phí vận hành",
    description: "Thanh toán tiền điện cửa hàng tháng 6",
    paymentMethod: "BANK_TRANSFER",
    date: `${generatePastDate(3)}T10:00:00Z`,
    creatorName: "Lê Quốc Bảo"
  },
  {
    id: "cb-2",
    entryCode: "SQ000002",
    type: "EXPENSE",
    amount: 150000,
    category: "Chi phí vận hành",
    description: "Mua túi bóng đựng hàng và chổi lau nhà",
    paymentMethod: "CASH",
    date: `${generatePastDate(2)}T14:30:00Z`,
    creatorName: "Nguyễn Văn Nam"
  },
  {
    id: "cb-3",
    entryCode: "SQ000003",
    type: "INCOME",
    amount: 350000,
    category: "Thu nợ khách hàng",
    description: "Khách Nguyễn Hoàng Yến thanh toán nợ mua lẻ",
    paymentMethod: "CASH",
    date: `${generatePastDate(1)}T16:00:00Z`,
    creatorName: "Trương Công Bảo"
  }
];

export const DEFAULT_PROJECTS: Project[] = [];

export const DEFAULT_SYSTEM_LOGS: SystemAuditLog[] = [
  {
    id: "log-1",
    actionType: "STAFF_PERMISSION_CHANGE",
    actionName: "Thay đổi phân quyền nhân viên",
    description: "Cập nhật quyền truy cập Sổ quỹ cho nhân viên Nguyễn Văn Nam (CASHIER) từ Từ chối sang Cho phép.",
    actorName: "Trương Công Bảo",
    actorRole: "OWNER",
    timestamp: `${generatePastDate(1)}T10:15:00Z`
  },
  {
    id: "log-2",
    actionType: "PRODUCT_PRICE_EDIT",
    actionName: "Chỉnh sửa giá sản phẩm",
    description: "Thay đổi giá bán sản phẩm NUOC0001 (Nước ngọt Pepsi Lon 320ml) từ 9,500đ thành 10,000đ.",
    actorName: "Lê Quốc Bảo",
    actorRole: "MANAGER",
    timestamp: `${generatePastDate(2)}T15:40:00Z`
  },
  {
    id: "log-3",
    actionType: "CATEGORY_DELETE",
    actionName: "Xóa danh mục",
    description: "Xóa danh mục 'Gia dụng thông minh' (Mã: cat-5) khỏi hệ thống.",
    actorName: "Trương Công Bảo",
    actorRole: "OWNER",
    timestamp: `${generatePastDate(3)}T09:20:00Z`
  },
  {
    id: "log-4",
    actionType: "PRODUCT_CREATE",
    actionName: "Thêm sản phẩm mới",
    description: "Thêm sản phẩm thành công: Bia Heineken Lon 330ml (Mã: NUOC0002) với giá bán 20,000đ.",
    actorName: "Lê Quốc Bảo",
    actorRole: "MANAGER",
    timestamp: `${generatePastDate(4)}T11:05:00Z`
  }
];
