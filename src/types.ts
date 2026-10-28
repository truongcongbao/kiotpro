export interface Product {
  id: string;
  code: string; // SKU code, e.g. "SP000001"
  name: string;
  barcode?: string;
  category: string; // e.g. "Thời trang", "Công nghệ", "Gia dụng", "Ẩm thực"
  costPrice: number; // Giá vốn bình quân
  sellingPrice: number; // Giá bán
  stock: number; // Tồn kho hiện tại
  minStock: number; // Số lượng tồn kho tối thiểu (để cảnh báo hết hàng)
  unit: string; // Đơn vị tính (Cái, Bộ, Lon, Chiếc, Thùng, Gói...)
  imageUrl?: string;
  expiryDate?: string; // Hạn sử dụng (YYYY-MM-DD)
  parentUnitId?: string; // ID của sản phẩm sỉ quy đổi (e.g. ID của Thùng)
  conversionRate?: number; // Tỷ lệ quy đổi lẻ (e.g. 24 cho thùng 24 lon)
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalSpent: number; // Tổng chi tiêu
  points: number; // Điểm tích lũy
  tier: "Standard" | "Bronze" | "Silver" | "Gold" | "Diamond";
  avatar?: string;
  debt?: number; // Sổ nợ Khách hàng (Bán gối đầu)
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  companyName?: string;
  debt?: number; // Sổ nợ Nhà cung cấp (Nhập hàng trả sau)
}

export interface OrderItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number; // Giá bán lúc mua
  discount: number; // Chiết khấu theo dòng mặt hàng
  total: number; // Thành tiền sau chiết khấu
}

export interface Invoice {
  id: string;
  invoiceCode: string; // HD000001
  customerId?: string;
  customerName: string;
  items: OrderItem[];
  totalOriginal: number; // Tổng tiền hàng gốc
  discountAmount: number; // Giảm giá hóa đơn
  totalPayable: number; // Khách cần trả
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "DEBT";
  status: "COMPLETED" | "REFUNDED" | "CANCELLED";
  date: string; // ISO String or YYYY-MM-DD
  cashierName: string;
  pointsEarned: number;
  cancelReason?: string;
  cancelledBy?: string;
  cancelDate?: string;
  eInvoiceCode?: string; // Số hóa đơn điện tử cấp bởi cơ quan thuế
  eInvoiceStatus?: "NONE" | "PENDING" | "ISSUED" | "FAILED";
  eInvoiceUrl?: string; // Link tra cứu hóa đơn điện tử
  eInvoiceError?: string; // Lỗi khi phát hành
  taxRate?: number; // Tỷ lệ thuế áp dụng (e.g., 8 hoặc 0 nếu không lấy)
  taxAmount?: number; // Tiền thuế VAT thực tế của hóa đơn
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "CASHIER";
  phone: string;
  active: boolean;
  password?: string;
  permissions?: {
    cashbookAccess?: boolean;
    reportsAccess?: boolean;
    posAccess?: boolean;
    productsAccess?: boolean;
    partnersAccess?: boolean;
    settingsAccess?: boolean;
    
    // Granular sub-permissions for each tab
    posDiscount?: boolean;         // Cho phép giảm giá / sửa giá bán trực tiếp trên POS
    posCancelInvoice?: boolean;    // Cho phép hủy hóa đơn
    productCreateEdit?: boolean;   // Cho phép thêm mới / sửa sản phẩm
    productDelete?: boolean;       // Cho phép xóa sản phẩm
    inventoryAudit?: boolean;      // Cho phép kiểm kho & nhập hàng
    partnerCreateEdit?: boolean;   // Cho phép thêm mới / sửa khách hàng & NCC
    partnerDelete?: boolean;       // Cho phép xóa đối tác
    partnerDebtAdjust?: boolean;   // Cho phép điều chỉnh công nợ
    cashbookCreateEntry?: boolean; // Cho phép lập phiếu thu/chi
    cashbookDeleteEntry?: boolean; // Cho phép xóa phiếu thu/chi
    reportViewProfit?: boolean;    // Cho phép xem lợi nhuận & giá vốn
  };
}

export interface ShopSetting {
  shopName: string;
  address: string;
  phone: string;
  logoUrl: string;
  taxRate: number; // % thuế
  currency: string; // "VND"
  zaloNumber: string;
  seoTitle: string;
  seoKeywords: string;
  reportDeletePassword?: string; // Mật khẩu riêng biệt để xóa báo cáo/giao dịch
  bankName?: string; // Tên ngân hàng nhận VietQR (e.g. MBBank, Vietcombank)
  bankAccount?: string; // Số tài khoản ngân hàng
  bankOwner?: string; // Tên chủ tài khoản ngân hàng
  eInvoiceEnabled?: boolean; // Bật xuất hóa đơn điện tử tự động
  eInvoiceProvider?: "MISA" | "VIETTEL" | "VNPT" | "MOCK"; // Nhà cung cấp HĐĐT
  eInvoiceTaxCode?: string; // Mã số thuế DN
  eInvoiceApiUrl?: string; // URL API kết nối
  eInvoiceUsername?: string; // Tài khoản kết nối API
  eInvoicePassword?: string; // Mật khẩu kết nối API
  eInvoicePattern?: string; // Ký hiệu mẫu số hóa đơn (e.g., 1C22TML)
  eInvoiceSerial?: string; // Ký hiệu hóa đơn (e.g., K22TBB)
  printerPaperSize?: "K57" | "K80" | "A4" | "A5"; // Khổ giấy máy in
  printerAutoPrint?: boolean; // Tự động in hóa đơn khi thanh toán
  printerHeaderNote?: string; // Lời nhắn đầu hóa đơn
  printerFooterNote?: string; // Lời nhắn chân hóa đơn
  printerShowBarcode?: boolean; // Hiển thị mã vạch trên hóa đơn
  printerShowLogo?: boolean; // Hiển thị logo trên hóa đơn
  printerConnectionType?: "SYSTEM" | "USB" | "BLUETOOTH" | "LAN"; // Phương thức kết nối máy in
  printerIPAddress?: string; // Địa chỉ IP máy in LAN
  printerDeviceName?: string; // Tên thiết bị đã kết nối (USB/Bluetooth)
}

export interface InventoryAuditItem {
  productId: string;
  productName: string;
  productCode: string;
  systemQty: number; // Tồn kho hệ thống
  actualQty: number; // Thực tế đếm được
  discrepancy: number; // Chênh lệch (actual - system)
  notes?: string;
}

export interface InventoryAudit {
  id: string;
  auditCode: string; // KK000001
  date: string;
  auditorName: string;
  items: InventoryAuditItem[];
  status: "DRAFT" | "COMPLETED";
  notes?: string;
}

export interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  costPrice: number; // Giá nhập
  total: number;
}

export interface PurchaseOrder {
  id: string;
  orderCode: string; // PN000001 (Mã nhập)
  date: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  amountPaid: number; // Tiền đã trả
  amountOwed: number; // Tiền nợ lại (Công nợ NCC)
  status: "COMPLETED" | "DRAFT";
}

export interface CashbookEntry {
  id: string;
  entryCode: string; // SQ000001 (Mã phiếu)
  type: "INCOME" | "EXPENSE"; // Thu/Chi
  amount: number;
  category: string; // Loại thu chi (e.g., Tiền điện, xăng xe, lương, Bán hàng, Thu nợ...)
  description: string; // Lý do
  paymentMethod: "CASH" | "BANK_TRANSFER"; // Tiền mặt vs Chuyển khoản
  date: string;
  creatorName: string;
}

export interface ProjectMaterial {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  costPrice: number;
}

export interface ProjectStaff {
  staffId: string;
  staffName: string;
  role: string;
  wage: number;
}

export interface Project {
  id: string;
  name: string; // Tên công trình
  address: string; // Địa chỉ công trình
  customerName: string;
  customerId?: string;
  status: "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "PAUSED"; // Tiến độ
  startDate: string;
  endDate?: string;
  materials: ProjectMaterial[]; // Vật tư xuất kho theo công trình
  staff: ProjectStaff[]; // Thợ thi công & chi phí
  budget: number; // Tổng giá trị thi công dự kiến
  expenses: number; // Chi phí khác phát sinh
  notes?: string;
}

export interface CashShift {
  id: string;
  code: string; // CC000001
  startTime: string;
  endTime?: string;
  staffId: string;
  staffName: string;
  initialCash: number; // Tiền mặt đầu ca
  expectedCash: number; // Tiền mặt lý thuyết
  actualCash?: number; // Tiền mặt thực tế đếm được cuối ca
  expectedBank: number; // Tiền chuyển khoản lý thuyết
  actualBank?: number; // Tiền chuyển khoản thực tế cuối ca
  notes?: string;
  status: "ACTIVE" | "COMPLETED";
}

export interface SystemAuditLog {
  id: string;
  actionType: "USER_LOGIN" | "USER_LOGOUT" | "PRODUCT_PRICE_EDIT" | "CATEGORY_DELETE" | "STAFF_PERMISSION_CHANGE" | "PRODUCT_CREATE" | "PRODUCT_DELETE" | "STAFF_CREATE" | "STAFF_DELETE" | "CATEGORY_CREATE" | "INVOICE_UPDATE" | "INVOICE_CANCEL";
  actionName: string; // Tên hành động tiếng Việt để render đẹp
  description: string; // Chi tiết thay đổi (ví dụ: "Sản phẩm A thay đổi giá từ Xđ thành Yđ")
  actorName: string; // Người thực hiện
  actorRole: "OWNER" | "MANAGER" | "CASHIER"; // Vai trò của người thực hiện
  timestamp: string; // ISO String
}

export interface SubPermissionsPOS {
  enabled?: boolean;            // Bán hàng & Quầy POS
  allowDiscount?: boolean;      // Cho phép giảm giá / chiết khấu
  allowPriceEdit?: boolean;     // Cho phép sửa giá bán trực tiếp
  allowReturn?: boolean;        // Cho phép trả hàng / đổi hàng
  allowCancelInvoice?: boolean; // Cho phép hủy hóa đơn
}

export interface SubPermissionsProducts {
  enabled?: boolean;            // Hàng hóa, Bảng giá & Kho
  allowCreateEdit?: boolean;    // Cho phép thêm, sửa, xóa mặt hàng
  allowViewCostPrice?: boolean; // Cho phép xem giá vốn sản phẩm
  allowStockAudit?: boolean;    // Cho phép kiểm kho & cân bằng tồn
  allowPurchaseOrder?: boolean; // Cho phép nhập hàng từ NCC
}

export interface SubPermissionsPartners {
  enabled?: boolean;            // Khách hàng & Nhà cung cấp
  allowCreateEdit?: boolean;    // Cho phép thêm, sửa đối tác
  allowViewDebt?: boolean;      // Cho phép xem công nợ đối tác
  allowDebtPayment?: boolean;   // Cho phép lập phiếu thanh toán nợ
}

export interface SubPermissionsCashbook {
  enabled?: boolean;            // Sổ quỹ & Thu chi
  allowCreateReceipt?: boolean; // Cho phép lập phiếu thu / chi
  allowViewBalance?: boolean;   // Cho phép xem tổng số dư quỹ
}

export interface SubPermissionsReports {
  enabled?: boolean;            // Báo cáo & Tổng quan
  allowViewRevenue?: boolean;   // Cho phép xem báo cáo doanh thu
  allowViewProfit?: boolean;    // Cho phép xem báo cáo lợi nhuận / giá vốn
}

export interface SubPermissionsEInvoice {
  enabled?: boolean;            // Kết nối Hóa đơn điện tử
  allowExport?: boolean;        // Cho phép xuất HĐĐT tự động
}

export interface SubPermissionsAIAssistant {
  enabled?: boolean;            // Trợ lý Trí tuệ Nhân tạo AI
  allowChat?: boolean;          // Cho phép Chatbot AI tư vấn
}

export interface StoreFeatureFlags {
  pos?: boolean | SubPermissionsPOS;
  products?: boolean | SubPermissionsProducts;
  partners?: boolean | SubPermissionsPartners;
  cashbook?: boolean | SubPermissionsCashbook;
  reports?: boolean | SubPermissionsReports;
  einvoice?: boolean | SubPermissionsEInvoice;
  aiAssistant?: boolean | SubPermissionsAIAssistant;
}

export function isModuleEnabled(moduleFlag: any): boolean {
  if (moduleFlag === undefined || moduleFlag === null) return true;
  if (typeof moduleFlag === "boolean") return moduleFlag;
  if (typeof moduleFlag === "object" && moduleFlag.enabled !== undefined) {
    return Boolean(moduleFlag.enabled);
  }
  return true;
}

export function isSubFeatureAllowed(moduleFlag: any, subKey: string): boolean {
  if (!isModuleEnabled(moduleFlag)) return false;
  if (typeof moduleFlag === "boolean") return moduleFlag;
  if (typeof moduleFlag === "object") {
    if (moduleFlag[subKey] !== undefined) {
      return Boolean(moduleFlag[subKey]);
    }
  }
  return true;
}

export interface TrialRegistration {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  password?: string; // Mật khẩu đăng nhập
  address: string;
  notes: string;
  createdAt: string;
  expireDate: string;
  status: "TRIAL_ACTIVE" | "EXPIRED" | "CONVERTED";
  phoneRegion?: string; // Optional metadata for normalized region
  allowedModules?: StoreFeatureFlags; // Phân quyền tính năng cấp Cửa hàng (Chủ phần mềm cấp)
}

export interface CountryCodeConfig {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  lengths: number[];
  placeholder: string;
  regexDesc: string;
}

export const COUNTRY_CODES: CountryCodeConfig[] = [
  { code: "VN", name: "Việt Nam", dialCode: "+84", flag: "🇻🇳", lengths: [10], placeholder: "0901234567", regexDesc: "bắt đầu bằng số 0 và có đúng 10 chữ số" },
  { code: "US", name: "Mỹ / Canada", dialCode: "+1", flag: "🇺🇸", lengths: [10], placeholder: "2025550199", regexDesc: "có đúng 10 chữ số" },
  { code: "JP", name: "Nhật Bản", dialCode: "+81", flag: "🇯🇵", lengths: [10, 11], placeholder: "09012345678", regexDesc: "có từ 10 đến 11 chữ số" },
  { code: "KR", name: "Hàn Quốc", dialCode: "+82", flag: "🇰🇷", lengths: [10, 11], placeholder: "01012345678", regexDesc: "có từ 10 đến 11 chữ số" },
  { code: "AU", name: "Úc", dialCode: "+61", flag: "🇦🇺", lengths: [9, 10], placeholder: "0412345678", regexDesc: "có từ 9 đến 10 chữ số" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬", lengths: [8], placeholder: "81234567", regexDesc: "có đúng 8 chữ số" },
  { code: "TW", name: "Đài Loan", dialCode: "+886", flag: "🇹🇼", lengths: [9], placeholder: "912345678", regexDesc: "có đúng 9 chữ số" },
];



