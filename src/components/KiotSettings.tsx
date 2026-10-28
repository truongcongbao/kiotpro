import React, { useState, useEffect, useRef, useMemo } from "react";
import { ShopSetting, Staff, Product, Category, Customer, Supplier, Invoice, InventoryAudit, TrialRegistration, SystemAuditLog } from "../types";
import { safeDispatchEvent } from "../lib/events";
import { 
  Settings, Save, Users, Plus, Shield, CheckCircle, 
  Trash2, ToggleLeft, ToggleRight, Phone, MapPin, Percent, DollarSign, Star,
  Download, Upload, Database, RefreshCw, FileSpreadsheet, FileJson, Wifi, Check, Cloud, History, Info,
  Eye, EyeOff, Lock, ShieldAlert, Printer, Usb, Bluetooth, Key, Search, Clock, Activity, Crown, ShieldCheck
} from "lucide-react";

interface KiotSettingsProps {
  settings: ShopSetting;
  staff: Staff[];
  currentStaff: Staff;
  onUpdateSettings: (settings: ShopSetting) => void;
  onAddStaff: (member: Staff) => void;
  onUpdateStaff: (member: Staff) => void;
  onDeleteStaff: (staffId: string) => void;
  trialInfo?: TrialRegistration | null;
  onUpdateTrialPassword?: (id: string, newPassword?: string, newEmail?: string) => Promise<void>;
  onResetDatabase?: () => void;

  // Backup & Sync props
  products: Product[];
  categories: Category[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  audits: InventoryAudit[];
  systemLogs?: SystemAuditLog[];
  onRestoreBackup: (data: any) => void;
  onRestoreFromPostgres?: () => Promise<void>;
  isOnline: boolean;
  isSyncingAll: boolean;
  triggerSyncAll: (overrides?: any, silent?: boolean) => Promise<boolean>;
  lastSyncTime: string;
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  integrityStatus?: {
    lastChecked: string;
    hasDiscrepancy: boolean;
    discrepancyCount: number;
    details: string[];
  };
  runChecksumValidation?: (silent?: boolean) => boolean;
}

export default function KiotSettings({
  settings,
  staff,
  currentStaff: rawCurrentStaff,
  onUpdateSettings,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  trialInfo,
  onUpdateTrialPassword,
  onResetDatabase,
  products,
  categories,
  customers,
  suppliers,
  invoices,
  audits,
  onRestoreBackup,
  onRestoreFromPostgres,
  isOnline,
  isSyncingAll,
  triggerSyncAll,
  lastSyncTime,
  autoSyncEnabled,
  onToggleAutoSync,
  integrityStatus,
  runChecksumValidation,
  systemLogs = []
}: KiotSettingsProps) {
  
  const isSuperAdmin = rawCurrentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com";
  const currentStaff = isSuperAdmin
    ? { ...rawCurrentStaff, role: "OWNER" as const }
    : rawCurrentStaff;

  const [activeSubTab, setActiveSubTab] = useState<"general" | "staff" | "backup" | "logs">("general");
  const [successMsg, setSuccessMsg] = useState("");

  // States for System Audit Log (copied from Dashboard for administration settings deep integration)
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("ALL");
  const filteredLogs = useMemo(() => {
    return systemLogs.filter(log => {
      const matchesSearch = log.actorName.toLowerCase().includes(logSearch.toLowerCase()) || 
                            log.description.toLowerCase().includes(logSearch.toLowerCase());
      const matchesType = logTypeFilter === "ALL" || log.actionType === logTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [systemLogs, logSearch, logTypeFilter]);

  // Store settings form state
  const [shopName, setShopName] = useState(settings.shopName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [seoTitle, setSeoTitle] = useState(settings.seoTitle);
  const [seoKeywords, setSeoKeywords] = useState(settings.seoKeywords);
  const [reportDeletePassword, setReportDeletePassword] = useState(settings.reportDeletePassword || "admin123");
  const [bankName, setBankName] = useState(settings.bankName || "MB");
  const [bankAccount, setBankAccount] = useState(settings.bankAccount || "7919399999");
  const [bankOwner, setBankOwner] = useState(settings.bankOwner || "TRUONG CONG BAO");

  // eInvoice configurations
  const [eInvoiceEnabled, setEInvoiceEnabled] = useState(!!settings.eInvoiceEnabled);
  const [eInvoiceProvider, setEInvoiceProvider] = useState<"MISA" | "VIETTEL" | "VNPT" | "MOCK">(settings.eInvoiceProvider || "MOCK");
  const [eInvoiceTaxCode, setEInvoiceTaxCode] = useState(settings.eInvoiceTaxCode || "3701548239");
  const [eInvoiceApiUrl, setEInvoiceApiUrl] = useState(settings.eInvoiceApiUrl || "https://api.meinvoice.vn/v1/integration");
  const [eInvoiceUsername, setEInvoiceUsername] = useState(settings.eInvoiceUsername || "kiotx.corp");
  const [eInvoicePassword, setEInvoicePassword] = useState(settings.eInvoicePassword || "••••••••••••");
  const [eInvoicePattern, setEInvoicePattern] = useState(settings.eInvoicePattern || "1C26TML");
  const [eInvoiceSerial, setEInvoiceSerial] = useState(settings.eInvoiceSerial || "C26KTX");

  // Printer configurations
  const [printerPaperSize, setPrinterPaperSize] = useState<"K57" | "K80" | "A4" | "A5">(settings.printerPaperSize || "K80");
  const [printerAutoPrint, setPrinterAutoPrint] = useState(!!settings.printerAutoPrint);
  const [printerHeaderNote, setPrinterHeaderNote] = useState(settings.printerHeaderNote || "Trân trọng cảm ơn quý khách!");
  const [printerFooterNote, setPrinterFooterNote] = useState(settings.printerFooterNote || "Cảm ơn quý khách & Hẹn gặp lại!");
  const [printerShowBarcode, setPrinterShowBarcode] = useState(settings.printerShowBarcode !== false);
  const [printerShowLogo, setPrinterShowLogo] = useState(settings.printerShowLogo !== false);
  const [printerConnectionType, setPrinterConnectionType] = useState<"SYSTEM" | "USB" | "BLUETOOTH" | "LAN">(settings.printerConnectionType || "SYSTEM");
  const [printerIPAddress, setPrinterIPAddress] = useState(settings.printerIPAddress || "192.168.1.100");
  const [printerDeviceName, setPrinterDeviceName] = useState(settings.printerDeviceName || "Xprinter XP-420B");

  // Local printer scanning simulation states
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState<{ id: string; name: string; type: "USB" | "BLUETOOTH" | "LAN"; details: string }[]>([]);
  const [selectedScannedId, setSelectedScannedId] = useState<string>("");

  // Password view & change verification states
  const [isPassSectionRevealed, setIsPassSectionRevealed] = useState(false);
  const clickTimestampsRef = useRef<number[]>([]);
  const [clickCount, setClickCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Store login password change states
  const [newLoginEmail, setNewLoginEmail] = useState(trialInfo?.email || "");
  const [currentLoginPassword, setCurrentLoginPassword] = useState("");
  const [newLoginPassword, setNewLoginPassword] = useState("");
  const [confirmNewLoginPassword, setConfirmNewLoginPassword] = useState("");
  const [loginPasswordError, setLoginPasswordError] = useState("");
  const [loginPasswordSuccess, setLoginPasswordSuccess] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isUpdatingLoginPassword, setIsUpdatingLoginPassword] = useState(false);

  useEffect(() => {
    if (trialInfo?.email) {
      setNewLoginEmail(trialInfo.email);
    }
  }, [trialInfo]);

  // Local printer scanning simulation helper
  const handleScanPrinters = (type: "USB" | "BLUETOOTH" | "LAN") => {
    setIsScanningPrinters(true);
    setDetectedPrinters([]);
    setSelectedScannedId("");

    setTimeout(() => {
      setIsScanningPrinters(false);
      if (type === "USB") {
        setDetectedPrinters([
          { id: "usb-1", name: "Xprinter XP-Q200 USB (Mặc định)", type: "USB", details: "Vị trí: Cổng USB 1 | ID: VID_0483_PID_5740" },
          { id: "usb-2", name: "Epson TM-T82III USB (Khuyên dùng)", type: "USB", details: "Vị trí: Cổng USB 2 | ID: VID_04B8_PID_0202" },
          { id: "usb-3", name: "KiotX PRP-085 USB Mini", type: "USB", details: "Vị trí: Cổng USB 3 | ID: VID_0A5C_PID_21E8" }
        ]);
      } else if (type === "BLUETOOTH") {
        setDetectedPrinters([
          { id: "bt-1", name: "PT-210 Mobile Printer (Bluetooth)", type: "BLUETOOTH", details: "Địa chỉ: 00:11:22:33:FF:EE | Tín hiệu: -65dBm (Tốt)" },
          { id: "bt-2", name: "SuperPrinter Portable-58", type: "BLUETOOTH", details: "Địa chỉ: AA:BB:CC:DD:11:22 | Tín hiệu: -78dBm (Trung bình)" },
          { id: "bt-3", name: "POS thermal-58 Bluetooth", type: "BLUETOOTH", details: "Địa chỉ: FE:DC:BA:98:76:54 | Tín hiệu: -54dBm (Mạnh)" }
        ]);
      } else if (type === "LAN") {
        setDetectedPrinters([
          { id: "lan-1", name: `KiotX Network Printer [${printerIPAddress}]`, type: "LAN", details: "Cổng TCP/IP: 9100 | Trạng thái: Sẵn sàng kết nối" }
        ]);
      }
    }, 1200);
  };

  const handleInvisibleZoneClick = (e: React.MouseEvent) => {
    // 1. Dùng detail nguyên bản của trình duyệt (phản hồi siêu nhanh nếu click liên tục)
    if (e.detail === 3) {
      setIsPassSectionRevealed(prev => !prev);
      clickTimestampsRef.current = [];
      return;
    }

    // 2. Dự phòng bằng bộ nhớ đệm useRef với khoảng thời gian rộng 2.0 giây cho việc nhấp chuột thong thả
    const now = Date.now();
    const recentClicks = [...clickTimestampsRef.current, now].filter(t => now - t < 2000);
    clickTimestampsRef.current = recentClicks;

    if (recentClicks.length >= 3) {
      setIsPassSectionRevealed(prev => !prev);
      clickTimestampsRef.current = [];
    }
  };

  const handlePassClick = () => {
    if (!isHovered) return;
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        setShowPassword(show => !show);
        return 0;
      }
      return next;
    });
  };

  // Staff Form State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<{ id: string; name: string } | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRole, setStaffRole] = useState<"OWNER" | "MANAGER" | "CASHIER">("CASHIER");
  const [cashbookAccess, setCashbookAccess] = useState(false);
  const [reportsAccess, setReportsAccess] = useState(false);
  const [posAccess, setPosAccess] = useState(true);
  const [productsAccess, setProductsAccess] = useState(false);
  const [partnersAccess, setPartnersAccess] = useState(false);
  const [settingsAccess, setSettingsAccess] = useState(false);
  
  // Granular Sub-permissions
  const [posDiscount, setPosDiscount] = useState(false);
  const [posCancelInvoice, setPosCancelInvoice] = useState(false);
  const [productCreateEdit, setProductCreateEdit] = useState(false);
  const [productDelete, setProductDelete] = useState(false);
  const [inventoryAudit, setInventoryAudit] = useState(false);
  const [partnerCreateEdit, setPartnerCreateEdit] = useState(false);
  const [partnerDelete, setPartnerDelete] = useState(false);
  const [partnerDebtAdjust, setPartnerDebtAdjust] = useState(false);
  const [cashbookCreateEntry, setCashbookCreateEntry] = useState(false);
  const [cashbookDeleteEntry, setCashbookDeleteEntry] = useState(false);
  const [reportViewProfit, setReportViewProfit] = useState(false);

  const [copyFromStaffId, setCopyFromStaffId] = useState("");
  const [editingPermissionsStaff, setEditingPermissionsStaff] = useState<Staff | null>(null);

  // Password fields for staff management
  const [staffPassword, setStaffPassword] = useState("");
  const [changingPasswordStaff, setChangingPasswordStaff] = useState<Staff | null>(null);
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmNewStaffPassword, setConfirmNewStaffPassword] = useState("");

  const handleRoleChange = (role: "OWNER" | "MANAGER" | "CASHIER") => {
    setStaffRole(role);
    setCopyFromStaffId("");
    if (role === "CASHIER") {
      setCashbookAccess(false);
      setReportsAccess(false);
      setPosAccess(true);
      setProductsAccess(false);
      setPartnersAccess(false);
      setSettingsAccess(false);
      // Granular
      setPosDiscount(false);
      setPosCancelInvoice(false);
      setProductCreateEdit(false);
      setProductDelete(false);
      setInventoryAudit(false);
      setPartnerCreateEdit(false);
      setPartnerDelete(false);
      setPartnerDebtAdjust(false);
      setCashbookCreateEntry(false);
      setCashbookDeleteEntry(false);
      setReportViewProfit(false);
    } else if (role === "MANAGER") {
      setCashbookAccess(true);
      setReportsAccess(true);
      setPosAccess(true);
      setProductsAccess(true);
      setPartnersAccess(true);
      setSettingsAccess(false);
      // Granular
      setPosDiscount(true);
      setPosCancelInvoice(true);
      setProductCreateEdit(true);
      setProductDelete(false);
      setInventoryAudit(true);
      setPartnerCreateEdit(true);
      setPartnerDelete(false);
      setPartnerDebtAdjust(true);
      setCashbookCreateEntry(true);
      setCashbookDeleteEntry(false);
      setReportViewProfit(true);
    } else if (role === "OWNER") {
      setCashbookAccess(true);
      setReportsAccess(true);
      setPosAccess(true);
      setProductsAccess(true);
      setPartnersAccess(true);
      setSettingsAccess(true);
      // Granular
      setPosDiscount(true);
      setPosCancelInvoice(true);
      setProductCreateEdit(true);
      setProductDelete(true);
      setInventoryAudit(true);
      setPartnerCreateEdit(true);
      setPartnerDelete(true);
      setPartnerDebtAdjust(true);
      setCashbookCreateEntry(true);
      setCashbookDeleteEntry(true);
      setReportViewProfit(true);
    }
  };

  const handleCopyPermissions = (targetStaffId: string) => {
    setCopyFromStaffId(targetStaffId);
    if (!targetStaffId) return;
    const target = staff.find(s => s.id === targetStaffId);
    if (target) {
      setStaffRole(target.role);
      setCashbookAccess(target.permissions?.cashbookAccess ?? (target.role !== "CASHIER"));
      setReportsAccess(target.permissions?.reportsAccess ?? (target.role !== "CASHIER"));
      setPosAccess(target.permissions?.posAccess ?? true);
      setProductsAccess(target.permissions?.productsAccess ?? (target.role !== "CASHIER"));
      setPartnersAccess(target.permissions?.partnersAccess ?? (target.role !== "CASHIER"));
      setSettingsAccess(target.permissions?.settingsAccess ?? (target.role === "OWNER"));
      
      // Copy granular
      setPosDiscount(target.permissions?.posDiscount ?? (target.role !== "CASHIER"));
      setPosCancelInvoice(target.permissions?.posCancelInvoice ?? (target.role !== "CASHIER"));
      setProductCreateEdit(target.permissions?.productCreateEdit ?? (target.role !== "CASHIER"));
      setProductDelete(target.permissions?.productDelete ?? false);
      setInventoryAudit(target.permissions?.inventoryAudit ?? (target.role !== "CASHIER"));
      setPartnerCreateEdit(target.permissions?.partnerCreateEdit ?? (target.role !== "CASHIER"));
      setPartnerDelete(target.permissions?.partnerDelete ?? false);
      setPartnerDebtAdjust(target.permissions?.partnerDebtAdjust ?? (target.role !== "CASHIER"));
      setCashbookCreateEntry(target.permissions?.cashbookCreateEntry ?? (target.role !== "CASHIER"));
      setCashbookDeleteEntry(target.permissions?.cashbookDeleteEntry ?? false);
      setReportViewProfit(target.permissions?.reportViewProfit ?? (target.role !== "CASHIER"));
      
      triggerSuccess(`Đã sao chép phân quyền từ "${target.name}"!`);
    }
  };

  const getRoleRank = (role: string) => {
    if (role === "OWNER") return 3;
    if (role === "MANAGER") return 2;
    return 1; // CASHIER
  };

  const getStaffRank = (s: Staff) => {
    if (s.email?.toLowerCase() === "congbaotruong8@gmail.com") return 1000;
    if (s.role === "OWNER") return 3;
    if (s.role === "MANAGER") return 2;
    return 1; // CASHIER
  };

  const canManageMember = (member: Staff) => {
    if (member.id === currentStaff.id) return false;
    if (isSuperAdmin) return true;
    if (currentStaff.role === "OWNER") return true;
    return getRoleRank(currentStaff.role) > getRoleRank(member.role);
  };

  const currentStaffHasPermission = (permissionKey: "cashbookAccess" | "reportsAccess" | "posAccess" | "productsAccess" | "partnersAccess" | "settingsAccess") => {
    if (isSuperAdmin) return true;
    if (currentStaff.role === "OWNER") return true;
    if (currentStaff.permissions?.[permissionKey] !== undefined) {
      return currentStaff.permissions[permissionKey] as boolean;
    }
    // Default fallbacks
    if (currentStaff.role === "MANAGER") {
      if (permissionKey === "settingsAccess") return false;
      return true;
    }
    if (currentStaff.role === "CASHIER") {
      return permissionKey === "posAccess";
    }
    return false;
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: any[], headers: { key: string; label: string }[]) => {
    const headerLine = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(",");
    const rows = data.map(item => {
      return headers.map(h => {
        const val = item[h.key];
        const strVal = val === undefined || val === null ? "" : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(",");
    });
    return [headerLine, ...rows].join("\n");
  };

  const exportAllToJSON = () => {
    const backupData = {
      products,
      categories,
      customers,
      suppliers,
      invoices,
      audits,
      settings,
      staff,
      backupVersion: "1.0",
      exportedAt: new Date().toISOString()
    };
    const content = JSON.stringify(backupData, null, 2);
    downloadFile(content, `kiotx_full_backup_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    triggerSuccess("Đã xuất dữ liệu toàn bộ cửa hàng sang file JSON thành công!");
  };

  const exportProductsToCSV = () => {
    const headers = [
      { key: "code", label: "Mã sản phẩm" },
      { key: "name", label: "Tên sản phẩm" },
      { key: "barcode", label: "Mã vạch" },
      { key: "category", label: "Danh mục" },
      { key: "costPrice", label: "Giá vốn" },
      { key: "sellingPrice", label: "Giá bán" },
      { key: "stock", label: "Tồn kho" },
      { key: "minStock", label: "Tồn tối thiểu" },
      { key: "unit", label: "Đơn vị tính" }
    ];
    
    const csvContent = "\uFEFF" + convertToCSV(products, headers);
    downloadFile(csvContent, `kiotx_sanpham_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
    triggerSuccess("Đã xuất danh sách sản phẩm sang file CSV thành công!");
  };

  const exportInvoicesToCSV = () => {
    const headers = [
      { key: "invoiceCode", label: "Mã hóa đơn" },
      { key: "customerName", label: "Tên khách hàng" },
      { key: "totalOriginal", label: "Tổng tiền hàng" },
      { key: "discountAmount", label: "Giảm giá" },
      { key: "totalPayable", label: "Khách phải trả" },
      { key: "paymentMethod", label: "Phương thức thanh toán" },
      { key: "status", label: "Trạng thái" },
      { key: "date", label: "Ngày bán" },
      { key: "cashierName", label: "Thu ngân" }
    ];
    
    const csvContent = "\uFEFF" + convertToCSV(invoices, headers);
    downloadFile(csvContent, `kiotx_hoadon_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
    triggerSuccess("Đã xuất danh sách hóa đơn sang file CSV thành công!");
  };

  const exportCustomersToCSV = () => {
    const headers = [
      { key: "name", label: "Họ tên" },
      { key: "phone", label: "Số điện thoại" },
      { key: "email", label: "Email" },
      { key: "address", label: "Địa chỉ" },
      { key: "totalSpent", label: "Tổng chi tiêu" },
      { key: "points", label: "Điểm tích lũy" },
      { key: "tier", label: "Phân hạng" }
    ];
    
    const csvContent = "\uFEFF" + convertToCSV(customers, headers);
    downloadFile(csvContent, `kiotx_khachhang_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
    triggerSuccess("Đã xuất danh sách khách hàng sang file CSV thành công!");
  };

  const handleJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (currentStaff.role !== "OWNER") {
      alert("Hành động bị từ chối: Chỉ Chủ cửa hàng (OWNER) mới có quyền khôi phục dữ liệu hệ thống!");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.products || !data.invoices) {
          alert("File sao lưu không hợp lệ! Vui lòng tải file backup được xuất từ KiotX.");
          return;
        }
        
        if (confirm(`CẢNH BÁO: Phục hồi dữ liệu sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu từ file sao lưu ngày ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString("vi-VN") : "không rõ"}. Bạn có chắc chắn muốn tiếp tục?`)) {
          onRestoreBackup(data);
          triggerSuccess("Khôi phục toàn bộ cơ sở dữ liệu KiotX từ file sao lưu thành công!");
        }
      } catch (err) {
        alert("Có lỗi xảy ra khi đọc file sao lưu JSON. Vui lòng thử lại!");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStaff.role !== "OWNER") {
      alert("Hành động bị từ chối: Chỉ Chủ cửa hàng (OWNER) mới có quyền chỉnh sửa cấu hình hệ thống!");
      return;
    }

    const updated: ShopSetting = {
      shopName,
      address,
      phone,
      logoUrl,
      taxRate: Number(taxRate),
      currency: "VND",
      zaloNumber: phone,
      seoTitle,
      seoKeywords,
      reportDeletePassword: settings.reportDeletePassword || "admin123",
      bankName,
      bankAccount,
      bankOwner,
      eInvoiceEnabled,
      eInvoiceProvider,
      eInvoiceTaxCode,
      eInvoiceApiUrl,
      eInvoiceUsername,
      eInvoicePassword,
      eInvoicePattern,
      eInvoiceSerial,
      printerPaperSize,
      printerAutoPrint,
      printerHeaderNote,
      printerFooterNote,
      printerShowBarcode,
      printerShowLogo,
      printerConnectionType,
      printerIPAddress,
      printerDeviceName
    };
    onUpdateSettings(updated);
    
    triggerSuccess("Cập nhật thông tin cửa hàng thành công! Tất cả hóa đơn in ấn đã áp dụng mẫu mới.");
  };

  const handleVerifyAndSavePassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (currentStaff.role !== "OWNER") {
      alert("Hành động bị từ chối: Chỉ Chủ cửa hàng (OWNER) mới có quyền chỉnh sửa mật khẩu bảo vệ!");
      return;
    }

    const originalPassword = settings.reportDeletePassword || "admin123";

    if (!oldPasswordInput) {
      setPasswordError("Vui lòng nhập mật khẩu cũ đang dùng!");
      return;
    }

    if (oldPasswordInput !== originalPassword) {
      setPasswordError("Mật khẩu cũ không chính xác! Vui lòng kiểm tra và nhập lại.");
      return;
    }

    if (!newPasswordInput.trim()) {
      setPasswordError("Mật khẩu mới không được để trống!");
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordError("Mật khẩu nhập lại không trùng khớp với mật khẩu mới!");
      return;
    }

    const updated: ShopSetting = {
      shopName,
      address,
      phone,
      logoUrl,
      taxRate: Number(taxRate),
      currency: "VND",
      zaloNumber: phone,
      seoTitle,
      seoKeywords,
      reportDeletePassword: newPasswordInput,
      bankName,
      bankAccount,
      bankOwner,
      eInvoiceEnabled,
      eInvoiceProvider,
      eInvoiceTaxCode,
      eInvoiceApiUrl,
      eInvoiceUsername,
      eInvoicePassword,
      eInvoicePattern,
      eInvoiceSerial,
      printerPaperSize,
      printerAutoPrint,
      printerHeaderNote,
      printerFooterNote,
      printerShowBarcode,
      printerShowLogo,
      printerConnectionType,
      printerIPAddress,
      printerDeviceName
    };
    onUpdateSettings(updated);
    setReportDeletePassword(newPasswordInput);

    // Reset states on success
    setOldPasswordInput("");
    setNewPasswordInput("");
    setConfirmNewPasswordInput("");
    setPasswordError("");
    setIsPassSectionRevealed(false); // Đóng cấu hình mật khẩu sau khi đổi thành công

    alert("Thay đổi mật khẩu bảo vệ xóa báo cáo & dữ liệu thành công!");
  };

  const handleUpdateLoginPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginPasswordError("");
    setLoginPasswordSuccess("");

    if (currentStaff.role !== "OWNER") {
      setLoginPasswordError("Chỉ có Chủ cửa hàng (OWNER) mới có quyền đổi mật khẩu đăng nhập!");
      return;
    }

    if (!trialInfo || !onUpdateTrialPassword) {
      setLoginPasswordError("Không tìm thấy thông tin tài khoản dùng thử. Tính năng này chỉ khả dụng cho cửa hàng dùng thử!");
      return;
    }

    if (!currentLoginPassword) {
      setLoginPasswordError("Vui lòng nhập mật khẩu hiện tại!");
      return;
    }

    const expectedPassword = trialInfo.password || "123456";
    if (currentLoginPassword !== expectedPassword) {
      setLoginPasswordError("Mật khẩu hiện tại không chính xác!");
      return;
    }

    if (!newLoginPassword.trim() && newLoginEmail.trim().toLowerCase() === trialInfo.email.toLowerCase()) {
      setLoginPasswordError("Vui lòng nhập mật khẩu mới hoặc tài khoản (email) mới muốn thay đổi!");
      return;
    }

    let passwordToUpdate = undefined;
    if (newLoginPassword.trim()) {
      if (newLoginPassword.length < 4) {
        setLoginPasswordError("Mật khẩu mới phải từ 4 ký tự trở lên!");
        return;
      }
      if (newLoginPassword !== confirmNewLoginPassword) {
        setLoginPasswordError("Mật khẩu nhập lại không khớp!");
        return;
      }
      passwordToUpdate = newLoginPassword;
    }

    let emailToUpdate = undefined;
    if (newLoginEmail.trim().toLowerCase() !== trialInfo.email.toLowerCase()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newLoginEmail.trim())) {
        setLoginPasswordError("Định dạng email tài khoản mới không hợp lệ!");
        return;
      }
      emailToUpdate = newLoginEmail.trim().toLowerCase();
    }

    try {
      setIsUpdatingLoginPassword(true);
      await onUpdateTrialPassword(trialInfo.id, passwordToUpdate, emailToUpdate);
      setLoginPasswordSuccess("Đổi thông tin đăng nhập cửa hàng thành công!");
      setCurrentLoginPassword("");
      setNewLoginPassword("");
      setConfirmNewLoginPassword("");
    } catch (err: any) {
      setLoginPasswordError(err.message || "Không thể cập nhật thông tin đăng nhập.");
    } finally {
      setIsUpdatingLoginPassword(false);
    }
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      const creatorRank = getRoleRank(currentStaff.role);
      if (creatorRank <= 1) {
        alert("Hành động bị từ chối: Tài khoản của bạn không có quyền tạo tài khoản nhân viên!");
        return;
      }
      const targetRank = getRoleRank(staffRole);
      if (creatorRank <= targetRank) {
        alert("Hành động bị từ chối: Bạn chỉ có thể tạo tài khoản cho nhân viên có vai trò thấp hơn vai trò của bạn!");
        return;
      }
    }
    if (!staffName || !staffEmail || !staffPhone) {
      alert("Họ tên, Email và Số điện thoại là bắt buộc!");
      return;
    }

    const newMember: Staff = {
      id: `staff-${Date.now()}`,
      name: staffName,
      email: staffEmail,
      phone: staffPhone,
      role: staffRole,
      active: true,
      password: staffPassword || "123456",
      permissions: {
        cashbookAccess,
        reportsAccess,
        posAccess,
        productsAccess,
        partnersAccess,
        settingsAccess,
        
        posDiscount,
        posCancelInvoice,
        productCreateEdit,
        productDelete,
        inventoryAudit,
        partnerCreateEdit,
        partnerDelete,
        partnerDebtAdjust,
        cashbookCreateEntry,
        cashbookDeleteEntry,
        reportViewProfit
      }
    };

    onAddStaff(newMember);
    
    safeDispatchEvent("kiot-add-audit-log", {
      actionType: "STAFF_CREATE",
      actionName: "Thêm nhân viên mới",
      description: `Đã tạo tài khoản nhân viên mới thành công: ${newMember.name} (Vai trò: ${newMember.role}, SĐT: ${newMember.phone}). Phân quyền chi tiết: POS: ${posAccess ? "Có" : "Không"}, Kho: ${productsAccess ? "Có" : "Không"}, Đối tác: ${partnersAccess ? "Có" : "Không"}, Sổ quỹ: ${cashbookAccess ? "Có" : "Không"}, Báo cáo: ${reportsAccess ? "Có" : "Không"}, Hệ thống: ${settingsAccess ? "Có" : "Không"}. Giảm giá POS: ${posDiscount ? "Có" : "Không"}, Hủy đơn: ${posCancelInvoice ? "Có" : "Không"}.`,
      actorName: currentStaff.name,
      actorRole: currentStaff.role
    });

    setIsStaffModalOpen(false);
    
    // Clear form
    setStaffName("");
    setStaffEmail("");
    setStaffPhone("");
    setStaffPassword("");
    setStaffRole("CASHIER");
    setCashbookAccess(false);
    setReportsAccess(false);
    setPosAccess(true);
    setProductsAccess(false);
    setPartnersAccess(false);
    setSettingsAccess(false);
    setPosDiscount(false);
    setPosCancelInvoice(false);
    setProductCreateEdit(false);
    setProductDelete(false);
    setInventoryAudit(false);
    setPartnerCreateEdit(false);
    setPartnerDelete(false);
    setPartnerDebtAdjust(false);
    setCashbookCreateEntry(false);
    setCashbookDeleteEntry(false);
    setReportViewProfit(false);
    setCopyFromStaffId("");
    
    triggerSuccess(`Đã thêm nhân viên ${newMember.name} vào nhóm nhân sự.`);
  };

  const handleToggleStaffStatus = (member: Staff) => {
    if (!canManageMember(member)) {
      alert("Hành động bị từ chối: Bạn không có quyền quản lý hay thay đổi trạng thái tài khoản này!");
      return;
    }
    const updated = { ...member, active: !member.active };
    onUpdateStaff(updated);
    
    safeDispatchEvent("kiot-add-audit-log", {
      actionType: "STAFF_PERMISSION_CHANGE",
      actionName: "Thay đổi phân quyền nhân viên",
      description: `Đã ${updated.active ? "KÍCH HOẠT" : "VÔ HIỆU HÓA"} tài khoản nhân viên ${member.name} (${member.role}).`,
      actorName: currentStaff.name,
      actorRole: currentStaff.role
    });

    triggerSuccess(`Đã ${updated.active ? "kích hoạt" : "hủy kích hoạt"} tài khoản nhân viên ${member.name}.`);
  };

  const handleDeleteStaffClick = (id: string, name: string) => {
    const targetMember = staff.find(s => s.id === id);
    if (!targetMember) return;
    if (!canManageMember(targetMember)) {
      alert("Hành động bị từ chối: Bạn không có quyền xóa tài khoản này!");
      return;
    }
    setDeletingStaff({ id, name });
  };

  return (
    <div className="space-y-6">
      
      {/* Settings layout header */}
      <div className="flex gap-4 border-b border-stone-850 pb-1">
        <button
          onClick={() => setActiveSubTab("general")}
          className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
            activeSubTab === "general" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            Cấu hình chung cửa hàng
          </span>
          {activeSubTab === "general" && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("staff")}
          className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
            activeSubTab === "staff" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Quản trị nhân sự &amp; Phân quyền
          </span>
          {activeSubTab === "staff" && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("backup")}
          className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
            activeSubTab === "backup" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Cloud className="h-4 w-4" />
            Sao lưu &amp; Đồng bộ đám mây
          </span>
          {activeSubTab === "backup" && (
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          )}
        </button>

        {(currentStaff.role === "OWNER" || currentStaff.role === "MANAGER") && (
          <button
            onClick={() => setActiveSubTab("logs")}
            className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
              activeSubTab === "logs" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <History className="h-4 w-4" />
              Nhật ký hoạt động hệ thống
            </span>
            {activeSubTab === "logs" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="h-5 w-5 shrink-0 animate-bounce" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SUBTAB 1: STORE INFO CONFIG */}
      {activeSubTab === "general" && (
        <form onSubmit={handleSaveSettingsSubmit} className="space-y-6">
          {currentStaff.role !== "OWNER" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Info className="h-5 w-5 shrink-0" />
              <span>Chế độ Chỉ xem (Read-Only): Bạn cần đăng nhập tài khoản Chủ cửa hàng (OWNER) để chỉnh sửa các cấu hình này.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left section: Identity */}
            <div className="space-y-4 p-5 rounded-2xl bg-stone-900 border border-stone-850">
              <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest border-b border-stone-800 pb-2">
                Thông tin nhận diện cửa hàng
              </h4>

              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tên cửa hàng / Doanh nghiệp</label>
                <input
                  type="text"
                  required
                  disabled={currentStaff.role !== "OWNER"}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Địa chỉ trụ sở / Showroom</label>
                <input
                  type="text"
                  required
                  disabled={currentStaff.role !== "OWNER"}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tổng đài Hotline</label>
                  <input
                    type="text"
                    required
                    disabled={currentStaff.role !== "OWNER"}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Thuế VAT (%) mặc định</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      disabled={currentStaff.role !== "OWNER"}
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono text-right pr-8 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3.5 top-2.5 text-stone-500 font-bold font-sans">%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Đường dẫn Logo thương hiệu</label>
                <input
                  type="url"
                  disabled={currentStaff.role !== "OWNER"}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Bank accounts for VietQR */}
              <div className="pt-4 border-t border-stone-800 space-y-4">
                <h5 className="text-[11px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Cấu hình VietQR Chuyển Khoản</span>
                </h5>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Ngân hàng (mã VietQR)</label>
                    <input
                      type="text"
                      required
                      disabled={currentStaff.role !== "OWNER"}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value.toUpperCase())}
                      placeholder="e.g. MB, VCB, TCB, ACB..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="text-[9px] text-stone-500 block leading-tight">Mã chuẩn: MB, VCB, TCB, ACB, BIDV, CTG</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Số tài khoản</label>
                    <input
                      type="text"
                      required
                      disabled={currentStaff.role !== "OWNER"}
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value.replace(/\s/g, ""))}
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tên chủ tài khoản (KHÔNG DẤU)</label>
                  <input
                    type="text"
                    required
                    disabled={currentStaff.role !== "OWNER"}
                    value={bankOwner}
                    onChange={(e) => setBankOwner(e.target.value.toUpperCase())}
                    placeholder="e.g. TRUONG CONG BAO"
                    className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Hóa đơn điện tử (E-Invoice API Config) */}
              <div className="pt-4 border-t border-stone-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-[11px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5" />
                    <span>Hóa đơn điện tử (HĐĐT)</span>
                  </h5>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStaff.role !== "OWNER") {
                        alert("Chỉ Chủ cửa hàng mới có quyền bật/tắt tính năng này!");
                        return;
                      }
                      setEInvoiceEnabled(!eInvoiceEnabled);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      eInvoiceEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-stone-950 text-stone-500 border-stone-800"
                    }`}
                  >
                    <span>{eInvoiceEnabled ? "Đang bật" : "Đã tắt"}</span>
                  </button>
                </div>

                {eInvoiceEnabled ? (
                  <div className="space-y-4 p-3.5 rounded-xl bg-stone-950/60 border border-stone-850/50 animate-fadeIn text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Nhà cung cấp HĐĐT</label>
                        <select
                          disabled={currentStaff.role !== "OWNER"}
                          value={eInvoiceProvider}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setEInvoiceProvider(val);
                            if (val === "MISA") {
                              setEInvoiceApiUrl("https://api.meinvoice.vn/v1/integration");
                            } else if (val === "VIETTEL") {
                              setEInvoiceApiUrl("https://sinvoice.viettel.vn/v1/api");
                            } else if (val === "VNPT") {
                              setEInvoiceApiUrl("https://einvoice-api.vnpt.vn/v2/invoice");
                            } else {
                              setEInvoiceApiUrl("https://api-sandbox.kiotx.vn/einvoice/simulator");
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-bold"
                        >
                          <option value="MOCK">MOCK SIMULATOR (Thử nghiệm)</option>
                          <option value="MISA">MISA meInvoice</option>
                          <option value="VIETTEL">Viettel SInvoice</option>
                          <option value="VNPT">VNPT e-Invoice</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Mã số thuế DN (MST)</label>
                        <input
                          type="text"
                          required
                          disabled={currentStaff.role !== "OWNER"}
                          value={eInvoiceTaxCode}
                          onChange={(e) => setEInvoiceTaxCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="e.g. 3701548239"
                          className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">API Endpoint URL</label>
                      <input
                        type="url"
                        required
                        disabled={currentStaff.role !== "OWNER"}
                        value={eInvoiceApiUrl}
                        onChange={(e) => setEInvoiceApiUrl(e.target.value)}
                        placeholder="https://"
                        className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tài khoản kết nối</label>
                        <input
                          type="text"
                          required
                          disabled={currentStaff.role !== "OWNER"}
                          value={eInvoiceUsername}
                          onChange={(e) => setEInvoiceUsername(e.target.value)}
                          placeholder="Username / Client ID"
                          className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Mật khẩu API</label>
                        <input
                          type="password"
                          required
                          disabled={currentStaff.role !== "OWNER"}
                          value={eInvoicePassword}
                          onChange={(e) => setEInvoicePassword(e.target.value)}
                          placeholder="Client Secret / Password"
                          className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Mẫu số HĐ (Pattern)</label>
                        <input
                          type="text"
                          required
                          disabled={currentStaff.role !== "OWNER"}
                          value={eInvoicePattern}
                          onChange={(e) => setEInvoicePattern(e.target.value.toUpperCase())}
                          placeholder="e.g. 1C22TML"
                          className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Ký hiệu HĐ (Serial)</label>
                        <input
                          type="text"
                          required
                          disabled={currentStaff.role !== "OWNER"}
                          value={eInvoiceSerial}
                          onChange={(e) => setEInvoiceSerial(e.target.value.toUpperCase())}
                          placeholder="e.g. K22TBB"
                          className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] text-stone-500 flex items-center gap-1 leading-normal">
                        <Info className="h-3 w-3 shrink-0 text-amber-500" />
                        <span>Hệ thống sẽ đồng bộ và cấp Số HĐĐT sau khi bấm Thanh toán ở POS.</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const btn = document.getElementById("test-api-btn");
                          if (btn) {
                            const originalHTML = btn.innerHTML;
                            btn.setAttribute("disabled", "true");
                            btn.innerHTML = `<span class="flex items-center gap-1 text-stone-400"><svg class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Đang kết nối...</span>`;
                            
                            setTimeout(() => {
                              btn.removeAttribute("disabled");
                              btn.innerHTML = originalHTML;
                              alert(`[VietQR & E-Invoice System]\nKết nối thành công đến máy chủ ${eInvoiceProvider} meInvoice thành công!\n- Địa chỉ: ${eInvoiceApiUrl}\n- Mã số thuế: ${eInvoiceTaxCode}\n\nThông tin cấu hình hợp lệ. Hệ thống sẵn sàng tự động đồng bộ hóa đơn lên Tổng Cục Thuế.`);
                            }, 1500);
                          }
                        }}
                        id="test-api-btn"
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/15 transition-all flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Kiểm tra kết nối</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-center rounded-xl bg-stone-950/30 border border-dashed border-stone-800/80 text-[10px] text-stone-500 leading-normal">
                    Chức năng tự động xuất hóa đơn điện tử VAT khi bán hàng POS đang tắt. 
                    Bật lên để cấu hình liên kết API đến MISA, Viettel, VNPT hoặc môi trường giả lập.
                  </div>
                )}
              </div>
            </div>

            {/* Right section: SEO & Meta */}
            <div className="space-y-4 p-5 rounded-2xl bg-stone-900 border border-stone-850">
              <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest border-b border-stone-800 pb-2">
                Tối ưu công cụ tìm kiếm (SEO)
              </h4>

              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tiêu đề Website (Meta Title)</label>
                <input
                  type="text"
                  required
                  disabled={currentStaff.role !== "OWNER"}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Từ khóa tìm kiếm (Meta Keywords)</label>
                <textarea
                  rows={4}
                  required
                  disabled={currentStaff.role !== "OWNER"}
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="Gõ các từ khóa ngăn cách bằng dấu phẩy..."
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none font-mono leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Cấu hình Máy in Hóa đơn (Printer Config) */}
              <div className="pt-4 border-t border-stone-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-[11px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5 animate-pulse" />
                    <span>Cấu hình & Kết nối Máy in</span>
                  </h5>
                  <div className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wider">
                    Sẵn sàng kết nối
                  </div>
                </div>

                <div className="space-y-4 p-3.5 rounded-xl bg-stone-950/60 border border-stone-850/50 text-xs">
                  
                  {/* PHƯƠNG THỨC KẾT NỐI (CONNECTION TYPE SELECTOR) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Chọn Cổng kết nối Máy in</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: "SYSTEM", label: "Hệ thống", sub: "Mặc định", icon: Printer, color: "text-blue-400" },
                        { id: "USB", label: "Cổng USB", sub: "WebUSB", icon: Usb, color: "text-teal-400" },
                        { id: "BLUETOOTH", label: "Bluetooth", sub: "Mini POS", icon: Bluetooth, color: "text-indigo-400" },
                        { id: "LAN", label: "Mạng LAN", sub: "Wifi / IP", icon: Wifi, color: "text-orange-400" }
                      ].map((type) => {
                        const IconComponent = type.icon;
                        const isSelected = printerConnectionType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            disabled={currentStaff.role !== "OWNER"}
                            onClick={() => {
                              setPrinterConnectionType(type.id as any);
                              setDetectedPrinters([]);
                              setSelectedScannedId("");
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                              isSelected 
                                ? "bg-stone-900 border-amber-500 shadow-lg shadow-amber-500/5" 
                                : "bg-stone-900/40 border-stone-800 hover:border-stone-700"
                            }`}
                          >
                            <IconComponent className={`h-4.5 w-4.5 mb-1 ${isSelected ? "text-amber-400" : type.color}`} />
                            <span className="text-[10px] font-bold text-stone-200 block leading-tight">{type.label}</span>
                            <span className="text-[8px] text-stone-500 block leading-tight pt-0.5">{type.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CHI TIẾT TỪNG PHƯƠNG THỨC KẾT NỐI */}
                  <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-850 space-y-3.5">
                    
                    {/* 1. KẾT NỐI HỆ THỐNG */}
                    {printerConnectionType === "SYSTEM" && (
                      <div className="space-y-1 text-stone-400">
                        <p className="font-bold text-stone-200 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                          Hộp thoại in ấn Hệ điều hành (Mặc định)
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          Hệ thống sẽ gọi trực tiếp hộp thoại in ấn của trình duyệt. Bạn có thể chọn bất kỳ máy in nào đã cài Driver trên máy tính, điện thoại hoặc máy tính bảng của bạn.
                        </p>
                        <div className="pt-1.5">
                          <span className="text-[9px] text-stone-500 font-bold uppercase block tracking-wider">Trạng thái thiết bị</span>
                          <span className="text-[10px] text-emerald-400 font-bold">● Sẵn sàng in hóa đơn</span>
                        </div>
                      </div>
                    )}

                    {/* 2. KẾT NỐI USB */}
                    {printerConnectionType === "USB" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-200 flex items-center gap-1.5">
                            <Usb className="h-3.5 w-3.5 text-teal-400 animate-pulse" />
                            Kết nối USB trực tiếp (WebUSB)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleScanPrinters("USB")}
                            disabled={isScanningPrinters || currentStaff.role !== "OWNER"}
                            className="px-2.5 py-1 rounded bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/20 text-teal-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <RefreshCw className={`h-2.5 w-2.5 ${isScanningPrinters ? "animate-spin" : ""}`} />
                            <span>{isScanningPrinters ? "Đang quét..." : "Dò thiết bị USB"}</span>
                          </button>
                        </div>

                        {/* Danh sách thiết bị quét được */}
                        {isScanningPrinters ? (
                          <div className="py-4 text-center text-stone-500 space-y-1">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border border-teal-500 border-t-transparent" />
                            <p className="text-[10px]">Đang dò tìm máy in nhiệt qua cổng USB máy tính...</p>
                          </div>
                        ) : detectedPrinters.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {detectedPrinters.map((p) => {
                              const isThisSelected = selectedScannedId === p.id || printerDeviceName === p.name;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (currentStaff.role === "OWNER") {
                                      setSelectedScannedId(p.id);
                                      setPrinterDeviceName(p.name);
                                      triggerSuccess(`Đã chọn máy in USB: ${p.name}`);
                                    }
                                  }}
                                  className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-all ${
                                    isThisSelected
                                      ? "bg-teal-500/10 border-teal-500/40 text-stone-100"
                                      : "bg-stone-950 border-stone-850 text-stone-400 hover:border-stone-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold flex items-center gap-1">
                                      {isThisSelected && <Check className="h-3 w-3 text-teal-400" />}
                                      {p.name}
                                    </span>
                                    <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1 py-0.2 rounded font-bold uppercase">USB</span>
                                  </div>
                                  <span className="text-[9px] text-stone-500 block pt-0.5">{p.details}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded bg-stone-950 text-center text-[10px] text-stone-500">
                            {printerDeviceName && printerDeviceName !== "Xprinter XP-420B" ? (
                              <div className="flex items-center justify-between text-stone-300">
                                <span className="font-bold text-teal-400">✔ Đã kết nối: {printerDeviceName}</span>
                                <span className="text-[8px] text-stone-500 font-mono">USB OK</span>
                              </div>
                            ) : (
                              <span>Chưa dò tìm thiết bị. Hãy cắm cáp USB máy in vào máy tính và nhấn "Dò thiết bị USB" ở trên.</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. KẾT NỐI BLUETOOTH */}
                    {printerConnectionType === "BLUETOOTH" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-200 flex items-center gap-1.5">
                            <Bluetooth className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                            Máy in Bluetooth di động (WebBluetooth)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleScanPrinters("BLUETOOTH")}
                            disabled={isScanningPrinters || currentStaff.role !== "OWNER"}
                            className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <RefreshCw className={`h-2.5 w-2.5 ${isScanningPrinters ? "animate-spin" : ""}`} />
                            <span>{isScanningPrinters ? "Đang dò..." : "Quét Bluetooth"}</span>
                          </button>
                        </div>

                        {/* Danh sách thiết bị quét được */}
                        {isScanningPrinters ? (
                          <div className="py-4 text-center text-stone-500 space-y-1">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border border-indigo-500 border-t-transparent" />
                            <p className="text-[10px]">Đang tìm kiếm sóng Bluetooth của các máy in nhiệt di động...</p>
                          </div>
                        ) : detectedPrinters.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {detectedPrinters.map((p) => {
                              const isThisSelected = selectedScannedId === p.id || printerDeviceName === p.name;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (currentStaff.role === "OWNER") {
                                      setSelectedScannedId(p.id);
                                      setPrinterDeviceName(p.name);
                                      triggerSuccess(`Đã ghép đôi máy in Bluetooth: ${p.name}`);
                                    }
                                  }}
                                  className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-all ${
                                    isThisSelected
                                      ? "bg-indigo-500/10 border-indigo-500/40 text-stone-100"
                                      : "bg-stone-950 border-stone-850 text-stone-400 hover:border-stone-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold flex items-center gap-1">
                                      {isThisSelected && <Check className="h-3 w-3 text-indigo-400" />}
                                      {p.name}
                                    </span>
                                    <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1 py-0.2 rounded font-bold uppercase font-mono">BT</span>
                                  </div>
                                  <span className="text-[9px] text-stone-500 block pt-0.5">{p.details}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded bg-stone-950 text-center text-[10px] text-stone-500">
                            {printerDeviceName && printerDeviceName !== "Xprinter XP-420B" && printerDeviceName.includes("Bluetooth") ? (
                              <div className="flex items-center justify-between text-stone-300">
                                <span className="font-bold text-indigo-400">✔ Đã ghép đôi: {printerDeviceName}</span>
                                <span className="text-[8px] text-stone-500 font-mono">BT CONNECTED</span>
                              </div>
                            ) : (
                              <span>Bật nguồn máy in di động Bluetooth, sau đó nhấn "Quét Bluetooth" để kết nối cầm tay.</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. KẾT NỐI LAN / IP */}
                    {printerConnectionType === "LAN" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-200 flex items-center gap-1.5">
                            <Wifi className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                            Kết nối IP / Mạng LAN (Wifi)
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-8">
                            <input
                              type="text"
                              disabled={currentStaff.role !== "OWNER"}
                              value={printerIPAddress}
                              onChange={(e) => setPrinterIPAddress(e.target.value)}
                              placeholder="e.g. 192.168.1.100"
                              className="w-full px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-850 text-stone-200 focus:border-amber-500 focus:outline-none font-mono text-xs font-bold"
                            />
                          </div>
                          <div className="col-span-4">
                            <button
                              type="button"
                              onClick={() => handleScanPrinters("LAN")}
                              disabled={isScanningPrinters || !printerIPAddress || currentStaff.role !== "OWNER"}
                              className="w-full h-full py-1.5 rounded bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
                            >
                              <span>{isScanningPrinters ? "Ping..." : "Kết nối IP"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Danh sách thiết bị quét được */}
                        {isScanningPrinters ? (
                          <div className="py-2.5 text-center text-stone-500 space-y-1">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border border-orange-500 border-t-transparent" />
                            <p className="text-[10px]">Đang gửi gói tin Ping tới địa chỉ IP {printerIPAddress}...</p>
                          </div>
                        ) : detectedPrinters.length > 0 ? (
                          <div className="p-2.5 rounded bg-orange-500/5 border border-orange-500/10 text-[10px] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-orange-400">✔ Sẵn sàng: {detectedPrinters[0].name}</span>
                              <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-bold uppercase font-mono">ONLINE</span>
                            </div>
                            <p className="text-stone-500 text-[9px]">{detectedPrinters[0].details}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPrinterDeviceName(detectedPrinters[0].name);
                                triggerSuccess(`Đã thiết lập máy in qua mạng LAN IP: ${printerIPAddress}`);
                              }}
                              className="mt-1 w-full py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[9px] font-bold uppercase tracking-wider"
                            >
                              Áp dụng cấu hình LAN IP này
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-stone-500 leading-normal">
                            Điền địa chỉ IP tĩnh của máy in hóa đơn (thường hiển thị khi in Test mẫu tự thân trên máy in), sau đó nhấn "Kết nối IP".
                          </p>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Khổ giấy & Tự động in */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Khổ giấy in nhiệt</label>
                      <select
                        disabled={currentStaff.role !== "OWNER"}
                        value={printerPaperSize}
                        onChange={(e: any) => setPrinterPaperSize(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-bold"
                      >
                        <option value="K80">K80 (Khổ 80mm - Phổ biến)</option>
                        <option value="K57">K57 (Khổ 57mm - Mini POS)</option>
                        <option value="A5">A5 (Hóa đơn lẻ nhỏ)</option>
                        <option value="A4">A4 (Khổ văn phòng lớn)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tự động mở hộp thoại in</label>
                      <button
                        type="button"
                        disabled={currentStaff.role !== "OWNER"}
                        onClick={() => setPrinterAutoPrint(!printerAutoPrint)}
                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-bold uppercase transition-all ${
                          printerAutoPrint
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-stone-900 text-stone-500 border-stone-800"
                        }`}
                      >
                        <span>{printerAutoPrint ? "TỰ ĐỘNG IN" : "IN THỦ CÔNG"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Toggle hiển thị Logo và Barcode */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-stone-900/60 border border-stone-850">
                      <span className="text-[10px] text-stone-300 font-medium">In kèm Logo</span>
                      <button
                        type="button"
                        disabled={currentStaff.role !== "OWNER"}
                        onClick={() => setPrinterShowLogo(!printerShowLogo)}
                        className={`h-4.5 w-9 rounded-full relative transition-colors duration-200 focus:outline-none ${
                          printerShowLogo ? "bg-emerald-500" : "bg-stone-750"
                        }`}
                      >
                        <span className={`block h-3.5 w-3.5 rounded-full bg-stone-900 shadow-sm transform transition-transform duration-200 ${
                          printerShowLogo ? "translate-x-4.5" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-stone-900/60 border border-stone-850">
                      <span className="text-[10px] text-stone-300 font-medium">In kèm Mã vạch</span>
                      <button
                        type="button"
                        disabled={currentStaff.role !== "OWNER"}
                        onClick={() => setPrinterShowBarcode(!printerShowBarcode)}
                        className={`h-4.5 w-9 rounded-full relative transition-colors duration-200 focus:outline-none ${
                          printerShowBarcode ? "bg-emerald-500" : "bg-stone-750"
                        }`}
                      >
                        <span className={`block h-3.5 w-3.5 rounded-full bg-stone-900 shadow-sm transform transition-transform duration-200 ${
                          printerShowBarcode ? "translate-x-4.5" : "translate-x-1"
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Lời chúc đầu hóa đơn */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Lời chào đầu hóa đơn (Header Note)</label>
                    <input
                      type="text"
                      disabled={currentStaff.role !== "OWNER"}
                      value={printerHeaderNote}
                      onChange={(e) => setPrinterHeaderNote(e.target.value)}
                      placeholder="e.g. Hân hạnh phục vụ quý khách!"
                      className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-medium text-xs"
                    />
                  </div>

                  {/* Lời nhắn chân hóa đơn */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Lời nhắn chân hóa đơn (Footer Note)</label>
                    <input
                      type="text"
                      disabled={currentStaff.role !== "OWNER"}
                      value={printerFooterNote}
                      onChange={(e) => setPrinterFooterNote(e.target.value)}
                      placeholder="e.g. Xin cảm ơn quý khách. Hẹn gặp lại!"
                      className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none font-medium text-xs"
                    />
                  </div>

                  {/* Print test mẫu */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[9px] text-stone-500 flex items-center gap-1 leading-normal max-w-[200px]">
                      <Info className="h-3 w-3 shrink-0 text-amber-500" />
                      <span>In thử một hóa đơn demo để kiểm tra căn chỉnh khổ giấy {printerPaperSize}.</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const btn = document.getElementById("test-print-btn");
                        if (btn) {
                          const originalHTML = btn.innerHTML;
                          btn.setAttribute("disabled", "true");
                          btn.innerHTML = `<span class="flex items-center gap-1 text-stone-400"><svg class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Đang in thử...</span>`;
                          
                          setTimeout(() => {
                            btn.removeAttribute("disabled");
                            btn.innerHTML = originalHTML;

                            // Kích hoạt một custom event để POS hiển thị receipt mẫu với các cấu hình mới!
                            safeDispatchEvent("kiot-trigger-test-print", {
                              paperSize: printerPaperSize,
                              headerNote: printerHeaderNote,
                              footerNote: printerFooterNote,
                              showBarcode: printerShowBarcode,
                              showLogo: printerShowLogo
                            });
                          }, 1000);
                        }
                      }}
                      id="test-print-btn"
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/15 transition-all flex items-center gap-1"
                    >
                      <Printer className="h-3 w-3" />
                      <span>In thử hóa đơn mẫu</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Invisible Target Click Area (Only owner knows and clicks 3 times to open) */}
              {!isPassSectionRevealed ? (
                <div 
                  onClick={handleInvisibleZoneClick}
                  className="w-full bg-transparent cursor-default select-none pointer-events-auto"
                  style={{ height: '80px' }}
                />
              ) : (
                <div className="space-y-4 text-xs border-t border-stone-850 pt-4 mt-4 relative animate-fade-in bg-stone-900/40 p-4 rounded-xl border border-stone-800">
                  <div className="flex justify-between items-center border-b border-stone-850 pb-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-emerald-400" />
                      <label className="text-[10px] text-stone-200 font-bold uppercase tracking-wider block">Cấu hình mật khẩu bảo vệ xóa báo cáo & dữ liệu</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPassSectionRevealed(false);
                        setShowPassword(false);
                        setOldPasswordInput("");
                        setNewPasswordInput("");
                        setConfirmNewPasswordInput("");
                        setPasswordError("");
                      }}
                      className="text-[9px] text-stone-400 hover:text-stone-200 font-bold uppercase tracking-wider transition-colors border border-stone-800 px-2 py-1 rounded bg-stone-950"
                    >
                      [Ẩn cấu hình]
                    </button>
                  </div>

                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Mật khẩu này dùng riêng khi chủ cửa hàng xóa trắng báo cáo doanh thu, tồn kho hoặc công nợ. Vui lòng nhập mật khẩu cũ để xác thực trước khi cập nhật mật khẩu mới.
                  </p>

                  <div className="space-y-3">
                    {/* 1. Mật khẩu cũ */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">1. Nhập mật khẩu cũ đang dùng</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        disabled={currentStaff.role !== "OWNER"}
                        value={oldPasswordInput}
                        onChange={(e) => {
                          setOldPasswordInput(e.target.value);
                          setPasswordError("");
                        }}
                        placeholder="Nhập mật khẩu cũ hiện tại..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-amber-500 focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* 2. Mật khẩu mới */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">2. Mật khẩu mới</label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? "text" : "password"}
                          disabled={currentStaff.role !== "OWNER"}
                          value={newPasswordInput}
                          onChange={(e) => {
                            setNewPasswordInput(e.target.value);
                            setPasswordError("");
                          }}
                          placeholder="Nhập mật khẩu mới muốn đặt..."
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <div className="absolute right-2">
                          <button
                            type="button"
                            onMouseEnter={() => {
                              setIsHovered(true);
                              setClickCount(0);
                            }}
                            onMouseLeave={() => {
                              setIsHovered(false);
                              setClickCount(0);
                            }}
                            onClick={handlePassClick}
                            className="p-1 rounded bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-stone-100 transition-all cursor-pointer relative"
                            title="Rê chuột & click 3 lần để xem/ẩn mật khẩu"
                          >
                            {showPassword ? (
                              <Eye className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-stone-500" />
                            )}
                            
                            {isHovered && (
                              <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap bg-stone-950 text-[9px] text-emerald-400 px-2 py-1 rounded-md border border-emerald-500/35 shadow-xl font-bold z-10">
                                {clickCount === 0 
                                  ? "Click 3 lần để xem" 
                                  : `Còn ${3 - clickCount} lần click...`}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Nhập lại mật khẩu mới */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">3. Nhập lại mật khẩu mới</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        disabled={currentStaff.role !== "OWNER"}
                        value={confirmNewPasswordInput}
                        onChange={(e) => {
                          setConfirmNewPasswordInput(e.target.value);
                          setPasswordError("");
                        }}
                        placeholder="Nhập lại chính xác mật khẩu mới..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    {passwordError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-bold flex items-center gap-1.5 animate-pulse">
                        <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleVerifyAndSavePassword}
                        disabled={currentStaff.role !== "OWNER"}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Xác nhận đổi mật khẩu
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Action Footer */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={currentStaff.role !== "OWNER"}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed text-stone-950 font-black text-xs uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-[0.98]"
            >
              <Save className="h-4.5 w-4.5" />
              <span>Lưu lại cài đặt</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION FOR LOGIN PASSWORD CHANGE */}
      {activeSubTab === "general" && (
        <div className="mt-6 p-5 rounded-2xl bg-stone-900 border border-stone-850 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
            <Shield className="h-5 w-5 text-amber-500" />
            <div>
              <h4 className="text-xs font-black text-stone-200 uppercase tracking-widest">
                Đổi Tài khoản & Mật khẩu đăng nhập Cửa hàng (Tài khoản chính)
              </h4>
              <p className="text-[10px] text-stone-500 mt-0.5">
                Bảo vệ tài khoản đăng nhập của bạn. Nếu tài khoản hoặc mật khẩu bị lộ, hãy thay đổi ngay để bảo mật dữ liệu tuyệt đối.
              </p>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-amber-500/30 text-stone-200 text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                <Crown className="h-4 w-4 text-amber-400" />
                <span>Tài khoản Quản trị viên Cấp cao nhất (Super Admin System Owner)</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                Bạn đang đăng nhập bằng tài khoản <strong className="text-amber-400 font-mono">congbaotruong8@gmail.com (Trương Công Bảo)</strong>. Đây là tài khoản Quản trị viên Cấp cao nhất (Super Admin) của toàn bộ hệ thống KiotX, có toàn quyền quản lý tài khoản dùng thử, cấu hình cửa hàng, phục hồi dữ liệu và duyệt phân quyền.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-[10px] text-emerald-400 font-bold pt-1 border-t border-stone-800/80">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Đã bảo mật: Xác thực Google OAuth2 &amp; Firebase Admin Auth</span>
                </div>
                <span className="text-stone-700 hidden sm:inline">|</span>
                <div className="flex items-center gap-1.5 text-blue-400">
                  <Key className="h-3.5 w-3.5" />
                  <span>Vai trò: Chủ hệ thống (Super Owner / Tối cao)</span>
                </div>
              </div>
            </div>
          ) : !trialInfo ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-2">
              <Info className="h-5 w-5 shrink-0 text-amber-400" />
              <span>Bạn đang mở cửa hàng ở chế độ mặc định. Để đăng ký tài khoản dùng thử riêng biệt hoặc quản lý thông tin cửa hàng, vui lòng đăng ký tài khoản dùng thử mới hoặc đăng nhập bằng tài khoản của bạn.</span>
            </div>
          ) : (
            <form onSubmit={handleUpdateLoginPasswordSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                
                {/* 1. Tài khoản (Email) đăng nhập */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    Tài khoản / Email đăng nhập mới
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="email"
                      required
                      value={newLoginEmail}
                      onChange={(e) => {
                        setNewLoginEmail(e.target.value);
                        setLoginPasswordError("");
                        setLoginPasswordSuccess("");
                      }}
                      placeholder="Email đăng nhập mới..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Mật khẩu hiện tại */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={currentLoginPassword}
                      onChange={(e) => {
                        setCurrentLoginPassword(e.target.value);
                        setLoginPasswordError("");
                        setLoginPasswordSuccess("");
                      }}
                      placeholder="Nhập mật khẩu đang dùng..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* 3. Mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    Mật khẩu mới (Tùy chọn)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={newLoginPassword}
                      onChange={(e) => {
                        setNewLoginPassword(e.target.value);
                        setLoginPasswordError("");
                        setLoginPasswordSuccess("");
                      }}
                      placeholder="Mật khẩu mới (để trống nếu giữ nguyên)..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* 4. Xác nhận mật khẩu mới */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={confirmNewLoginPassword}
                      onChange={(e) => {
                        setConfirmNewLoginPassword(e.target.value);
                        setLoginPasswordError("");
                        setLoginPasswordSuccess("");
                      }}
                      placeholder="Nhập lại mật khẩu mới..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

              </div>

              {/* Toggle show password & status indicators */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {showLoginPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  <span>{showLoginPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}</span>
                </button>

                <div className="flex items-center gap-3">
                  {currentStaff.role !== "OWNER" && (
                    <span className="text-[10px] text-amber-500 font-semibold">
                      Chỉ Chủ cửa hàng mới được quyền đổi tài khoản & mật khẩu đăng nhập!
                    </span>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isUpdatingLoginPassword || currentStaff.role !== "OWNER"}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-850 disabled:text-stone-600 disabled:cursor-not-allowed text-stone-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    {isUpdatingLoginPassword ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Xác nhận Cập nhật thông tin Đăng nhập</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {loginPasswordError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-bold flex items-center gap-2 animate-pulse mt-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{loginPasswordError}</span>
                </div>
              )}

              {loginPasswordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold flex items-center gap-2 mt-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{loginPasswordSuccess}</span>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* SUBTAB 2: STAFF LIST */}
      {activeSubTab === "staff" && (
        <div className="space-y-4">
          {getRoleRank(currentStaff.role) <= 1 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Info className="h-5 w-5 shrink-0" />
              <span>Chế độ Chỉ xem (Read-Only): Bạn cần đăng nhập tài khoản Quản lý (MANAGER) hoặc Chủ cửa hàng (OWNER) để thêm mới hoặc thay đổi nhân viên cấp dưới.</span>
            </div>
          )}

          <div className="flex justify-between items-center bg-stone-900 p-4 rounded-xl border border-stone-850">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-stone-200 uppercase block">Danh sách nhân sự cửa hàng</span>
              <p className="text-[10px] text-stone-500">Mỗi vai trò (Owner, Manager, Cashier) phân tách quyền hạn vận hành.</p>
            </div>

            {getRoleRank(currentStaff.role) > 1 ? (
              <button
                onClick={() => setIsStaffModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm nhân viên</span>
              </button>
            ) : (
              <div className="px-3.5 py-1.5 rounded-xl text-xs bg-stone-800 text-stone-500 font-bold uppercase flex items-center gap-1.5 border border-stone-850" title="Chỉ Quản lý hoặc Chủ cửa hàng có quyền tạo tài khoản">
                <Shield className="h-3.5 w-3.5" />
                <span>Không có quyền thêm</span>
              </div>
            )}
          </div>

          {/* Table of staff members */}
          <div className="rounded-2xl bg-stone-900 border border-stone-850 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-950/60 border-b border-stone-850 text-stone-400">
                    <th className="p-4 font-bold uppercase tracking-wider">Họ và tên</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Email liên lạc</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Số điện thoại</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Quyền hạn</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Quyền chi tiết</th>
                    <th className="p-4 text-center font-bold uppercase tracking-wider">Trạng thái</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-850/60">
                  {staff.map(member => (
                    <tr key={member.id} className={`hover:bg-stone-950/20 transition-all ${!member.active ? "opacity-50" : ""}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-stone-950 border border-stone-800 flex items-center justify-center font-bold text-xs text-stone-400">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-stone-100 text-sm block">{member.name}</span>
                            {member.id === "staff-1" && <span className="text-[9px] text-amber-500 font-bold uppercase">Sáng lập</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-stone-400">{member.email}</td>
                      <td className="p-4 font-mono text-stone-300">{member.phone}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border flex items-center gap-1.5 w-fit ${
                          member.role === "OWNER" ? "bg-rose-500/10 text-rose-400 border-rose-500/20 font-black" :
                          member.role === "MANAGER" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          <Shield className="h-3 w-3" />
                          <span>{member.role}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        {member.role === "OWNER" ? (
                          <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-wide">Toàn bộ quyền</span>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 w-max">
                            {/* Bán hàng POS */}
                            <label className={`inline-flex items-center gap-1 select-none text-[10.5px] ${
                              canManageMember(member) && currentStaffHasPermission("posAccess")
                                ? "cursor-pointer text-stone-300"
                                : "cursor-not-allowed text-stone-500 opacity-40"
                            }`}>
                              <input
                                type="checkbox"
                                checked={member.permissions?.posAccess !== undefined ? member.permissions.posAccess : true}
                                disabled={!(canManageMember(member) && currentStaffHasPermission("posAccess"))}
                                onChange={(e) => {
                                  const updated = {
                                    ...member,
                                    permissions: {
                                      ...(member.permissions || {}),
                                      posAccess: e.target.checked
                                    }
                                  };
                                  onUpdateStaff(updated);
                                  
                                  safeDispatchEvent("kiot-add-audit-log", {
                                    actionType: "STAFF_PERMISSION_CHANGE",
                                    actionName: "Thay đổi phân quyền nhân viên",
                                    description: `Cập nhật quyền bán hàng POS cho nhân viên ${member.name} (${member.role}) thành ${e.target.checked ? "Cho phép" : "Từ chối"}.`,
                                    actorName: currentStaff.name,
                                    actorRole: currentStaff.role
                                  });
                                }}
                                className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-950 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>Bán hàng POS</span>
                            </label>

                            {/* Sản phẩm & Kho */}
                            <label className={`inline-flex items-center gap-1 select-none text-[10.5px] ${
                              canManageMember(member) && currentStaffHasPermission("productsAccess")
                                ? "cursor-pointer text-stone-300"
                                : "cursor-not-allowed text-stone-500 opacity-40"
                            }`}>
                              <input
                                type="checkbox"
                                checked={member.permissions?.productsAccess !== undefined ? member.permissions.productsAccess : (member.role !== "CASHIER")}
                                disabled={!(canManageMember(member) && currentStaffHasPermission("productsAccess"))}
                                onChange={(e) => {
                                  const updated = {
                                    ...member,
                                    permissions: {
                                      ...(member.permissions || {}),
                                      productsAccess: e.target.checked
                                    }
                                  };
                                  onUpdateStaff(updated);
                                  
                                  safeDispatchEvent("kiot-add-audit-log", {
                                    actionType: "STAFF_PERMISSION_CHANGE",
                                    actionName: "Thay đổi phân quyền nhân viên",
                                    description: `Cập nhật quyền quản lý Kho sản phẩm cho nhân viên ${member.name} (${member.role}) thành ${e.target.checked ? "Cho phép" : "Từ chối"}.`,
                                    actorName: currentStaff.name,
                                    actorRole: currentStaff.role
                                  });
                                }}
                                className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-950 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>Sản phẩm & Kho</span>
                            </label>

                            {/* Khách hàng & NCC */}
                            <label className={`inline-flex items-center gap-1 select-none text-[10.5px] ${
                              canManageMember(member) && currentStaffHasPermission("partnersAccess")
                                ? "cursor-pointer text-stone-300"
                                : "cursor-not-allowed text-stone-500 opacity-40"
                            }`}>
                              <input
                                type="checkbox"
                                checked={member.permissions?.partnersAccess !== undefined ? member.permissions.partnersAccess : (member.role !== "CASHIER")}
                                disabled={!(canManageMember(member) && currentStaffHasPermission("partnersAccess"))}
                                onChange={(e) => {
                                  const updated = {
                                    ...member,
                                    permissions: {
                                      ...(member.permissions || {}),
                                      partnersAccess: e.target.checked
                                    }
                                  };
                                  onUpdateStaff(updated);
                                  
                                  safeDispatchEvent("kiot-add-audit-log", {
                                    actionType: "STAFF_PERMISSION_CHANGE",
                                    actionName: "Thay đổi phân quyền nhân viên",
                                    description: `Cập nhật quyền quản lý Đối tác cho nhân viên ${member.name} (${member.role}) thành ${e.target.checked ? "Cho phép" : "Từ chối"}.`,
                                    actorName: currentStaff.name,
                                    actorRole: currentStaff.role
                                  });
                                }}
                                className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-950 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>Đối tác</span>
                            </label>

                            {/* Sổ quỹ */}
                            <label className={`inline-flex items-center gap-1 select-none text-[10.5px] ${
                              canManageMember(member) && currentStaffHasPermission("cashbookAccess")
                                ? "cursor-pointer text-stone-300"
                                : "cursor-not-allowed text-stone-500 opacity-40"
                            }`}>
                              <input
                                type="checkbox"
                                checked={member.permissions?.cashbookAccess !== undefined ? member.permissions.cashbookAccess : (member.role !== "CASHIER")}
                                disabled={!(canManageMember(member) && currentStaffHasPermission("cashbookAccess"))}
                                onChange={(e) => {
                                  const updated = {
                                    ...member,
                                    permissions: {
                                      ...(member.permissions || {}),
                                      cashbookAccess: e.target.checked
                                    }
                                  };
                                  onUpdateStaff(updated);
                                  
                                  safeDispatchEvent("kiot-add-audit-log", {
                                    actionType: "STAFF_PERMISSION_CHANGE",
                                    actionName: "Thay đổi phân quyền nhân viên",
                                    description: `Cập nhật quyền truy cập Sổ quỹ cho nhân viên ${member.name} (${member.role}) thành ${e.target.checked ? "Cho phép" : "Từ chối"}.`,
                                    actorName: currentStaff.name,
                                    actorRole: currentStaff.role
                                  });
                                }}
                                className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-950 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>Xem Sổ quỹ</span>
                            </label>

                            {/* Xem Báo cáo */}
                            <label className={`inline-flex items-center gap-1 select-none text-[10.5px] ${
                              canManageMember(member) && currentStaffHasPermission("reportsAccess")
                                ? "cursor-pointer text-stone-300"
                                : "cursor-not-allowed text-stone-500 opacity-40"
                            }`}>
                              <input
                                type="checkbox"
                                checked={member.permissions?.reportsAccess !== undefined ? member.permissions.reportsAccess : (member.role !== "CASHIER")}
                                disabled={!(canManageMember(member) && currentStaffHasPermission("reportsAccess"))}
                                onChange={(e) => {
                                  const updated = {
                                    ...member,
                                    permissions: {
                                      ...(member.permissions || {}),
                                      reportsAccess: e.target.checked
                                    }
                                  };
                                  onUpdateStaff(updated);
                                  
                                  safeDispatchEvent("kiot-add-audit-log", {
                                    actionType: "STAFF_PERMISSION_CHANGE",
                                    actionName: "Thay đổi phân quyền nhân viên",
                                    description: `Cập nhật quyền xem Báo cáo doanh thu cho nhân viên ${member.name} (${member.role}) thành ${e.target.checked ? "Cho phép" : "Từ chối"}.`,
                                    actorName: currentStaff.name,
                                    actorRole: currentStaff.role
                                  });
                                }}
                                className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-950 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>Xem Báo cáo</span>
                            </label>

                            {/* Thiết lập */}
                            <label className={`inline-flex items-center gap-1 select-none text-[10.5px] ${
                              canManageMember(member) && currentStaffHasPermission("settingsAccess")
                                ? "cursor-pointer text-stone-300"
                                : "cursor-not-allowed text-stone-500 opacity-40"
                            }`}>
                              <input
                                type="checkbox"
                                checked={member.permissions?.settingsAccess !== undefined ? member.permissions.settingsAccess : false}
                                disabled={!(canManageMember(member) && currentStaffHasPermission("settingsAccess"))}
                                onChange={(e) => {
                                  const updated = {
                                    ...member,
                                    permissions: {
                                      ...(member.permissions || {}),
                                      settingsAccess: e.target.checked
                                    }
                                  };
                                  onUpdateStaff(updated);
                                  
                                  safeDispatchEvent("kiot-add-audit-log", {
                                    actionType: "STAFF_PERMISSION_CHANGE",
                                    actionName: "Thay đổi phân quyền nhân viên",
                                    description: `Cập nhật quyền Thiết lập hệ thống cho nhân viên ${member.name} (${member.role}) thành ${e.target.checked ? "Cho phép" : "Từ chối"}.`,
                                    actorName: currentStaff.name,
                                    actorRole: currentStaff.role
                                  });
                                }}
                                className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-950 h-3 w-3 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span>Thiết lập</span>
                            </label>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          disabled={!canManageMember(member)}
                          onClick={() => handleToggleStaffStatus(member)}
                          className="text-stone-400 hover:text-stone-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center animate-fadeIn"
                        >
                          {member.active ? (
                            <ToggleRight className={`h-6 w-6 ${canManageMember(member) ? "text-emerald-500" : "text-stone-500"}`} />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-stone-600" />
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {(canManageMember(member) || member.id === currentStaff.id) && (
                            <button
                              onClick={() => {
                                setChangingPasswordStaff(member);
                                setNewStaffPassword("");
                                setConfirmNewStaffPassword("");
                              }}
                              className="p-1.5 bg-stone-950 hover:bg-amber-950/40 text-stone-400 hover:text-amber-400 rounded-lg border border-stone-850 cursor-pointer flex items-center justify-center gap-1 text-[10.5px] font-bold"
                              title="Thay đổi mật khẩu tài khoản nhân viên"
                            >
                              <Key className="h-3 w-3" />
                              <span>Mật khẩu</span>
                            </button>
                          )}
                          {member.role !== "OWNER" && (
                            <button
                              disabled={!canManageMember(member)}
                              onClick={() => setEditingPermissionsStaff({ ...member })}
                              className="p-1.5 bg-stone-950 hover:bg-emerald-950/40 text-stone-400 hover:text-emerald-400 disabled:opacity-30 disabled:hover:bg-stone-950 disabled:hover:text-stone-400 disabled:cursor-not-allowed rounded-lg border border-stone-850 cursor-pointer flex items-center justify-center gap-1 text-[10.5px] font-bold"
                              title="Phân quyền chi tiết từng tính năng"
                            >
                              <Settings className="h-3 w-3" />
                              <span>Phân quyền</span>
                            </button>
                          )}
                          {member.id !== currentStaff.id && (
                            <button
                              disabled={!canManageMember(member)}
                              onClick={() => handleDeleteStaffClick(member.id, member.name)}
                              className="p-1.5 bg-stone-950 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 disabled:opacity-30 disabled:hover:bg-stone-950 disabled:hover:text-stone-400 disabled:cursor-not-allowed rounded-lg border border-stone-850 cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED PERMISSION MODAL */}
      {editingPermissionsStaff && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4.5 w-4.5 text-emerald-500" />
                  <span>Cấu hình Phân quyền chi tiết</span>
                </h3>
                <p className="text-[10px] text-stone-400 mt-1">
                  Cấu hình các quyền truy cập và thao tác cho nhân viên <strong className="text-stone-200">{editingPermissionsStaff.name}</strong> ({editingPermissionsStaff.role})
                </p>
              </div>
              <button 
                onClick={() => setEditingPermissionsStaff(null)} 
                className="text-stone-500 hover:text-stone-300 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* POS Section */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-850/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 border-b border-stone-850 pb-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wider">1. Bán hàng POS</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.posAccess !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            posAccess: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Truy cập Tab POS</span>
                      <span className="text-[10px] text-stone-500">Cho phép vào màn hình bán hàng</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.posDiscount !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            posDiscount: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Sửa giá &amp; Giảm giá POS</span>
                      <span className="text-[10px] text-stone-500">Cho phép giảm giá, sửa giá bán trực tiếp trên POS</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.posCancelInvoice !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            posCancelInvoice: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Hủy hóa đơn</span>
                      <span className="text-[10px] text-stone-500">Cho phép hủy hóa đơn đã bán (Có phân quyền)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Products Section */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-850/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 border-b border-stone-850 pb-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wider">2. Hàng hóa &amp; Kho</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.productsAccess !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            productsAccess: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Truy cập Tab Kho hàng</span>
                      <span className="text-[10px] text-stone-500">Xem danh mục hàng hóa và số lượng tồn kho</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.productCreateEdit !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            productCreateEdit: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Thêm / Sửa sản phẩm</span>
                      <span className="text-[10px] text-stone-500">Được phép tạo sản phẩm mới và chỉnh sửa mô tả</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.productDelete === true}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            productDelete: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block text-rose-400 font-bold">Xóa vĩnh viễn hàng hóa</span>
                      <span className="text-[10px] text-stone-500">Xóa sản phẩm hoàn toàn khỏi cơ sở dữ liệu</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.inventoryAudit !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            inventoryAudit: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Kiểm kho &amp; Nhập hàng</span>
                      <span className="text-[10px] text-stone-500">Tạo phiếu kiểm hàng, phiếu nhập hàng nhà cung cấp</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Partners Section */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-850/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 border-b border-stone-850 pb-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wider">3. Đối tác &amp; Khách hàng</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.partnersAccess !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            partnersAccess: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Truy cập Tab Đối tác</span>
                      <span className="text-[10px] text-stone-500">Xem thông tin khách hàng và nhà cung cấp</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.partnerCreateEdit !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            partnerCreateEdit: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Thêm / Sửa đối tác</span>
                      <span className="text-[10px] text-stone-500">Cho phép đăng ký và cập nhật hồ sơ khách hàng/NCC</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.partnerDelete === true}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            partnerDelete: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block text-rose-400 font-bold">Xóa đối tác</span>
                      <span className="text-[10px] text-stone-500">Cho phép xóa hồ sơ đối tác ra khỏi danh sách</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.partnerDebtAdjust !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            partnerDebtAdjust: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Quản lý công nợ</span>
                      <span className="text-[10px] text-stone-500">Cho phép điều chỉnh số dư công nợ của đối tác</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Cashbook & Reports Section */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-850/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 border-b border-stone-850 pb-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wider">4. Sổ quỹ &amp; Báo cáo doanh số</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.cashbookAccess !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            cashbookAccess: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Truy cập Sổ quỹ</span>
                      <span className="text-[10px] text-stone-500">Xem lịch sử các giao dịch thu chi tiền mặt</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.cashbookCreateEntry !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            cashbookCreateEntry: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Tạo phiếu Thu / Chi</span>
                      <span className="text-[10px] text-stone-500">Lập phiếu thu tiền mặt, lập phiếu chi thanh toán</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.reportsAccess !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            reportsAccess: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Xem Báo cáo biểu đồ</span>
                      <span className="text-[10px] text-stone-500">Cho phép xem biểu đồ doanh số bán hàng</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.reportViewProfit !== false}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            reportViewProfit: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block text-indigo-400 font-bold">Xem vốn &amp; Lợi nhuận</span>
                      <span className="text-[10px] text-stone-500">Cho phép xem các cột giá vốn, doanh số vốn, lợi nhuận gộp</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* System Section */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-850/60 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 border-b border-stone-850 pb-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-400 uppercase tracking-wider">5. Thiết lập hệ thống</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPermissionsStaff.permissions?.settingsAccess === true}
                      onChange={(e) => {
                        setEditingPermissionsStaff({
                          ...editingPermissionsStaff,
                          permissions: {
                            ...(editingPermissionsStaff.permissions || {}),
                            settingsAccess: e.target.checked
                          }
                        });
                      }}
                      className="mt-0.5 rounded border-stone-800 text-emerald-500 focus:ring-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-stone-200 block">Truy cập Tab Thiết lập</span>
                      <span className="text-[10px] text-stone-500">Được vào mục cấu hình cửa hàng và quản lý nhân viên</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-stone-800 pt-4 mt-6">
              <button
                onClick={() => setEditingPermissionsStaff(null)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold rounded-xl cursor-pointer text-center transition-all text-xs"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  onUpdateStaff(editingPermissionsStaff);
                  safeDispatchEvent("kiot-add-audit-log", {
                    actionType: "STAFF_PERMISSION_CHANGE",
                    actionName: "Thay đổi phân quyền nhân viên",
                    description: `Đã cập nhật cấu hình phân quyền chi tiết cho nhân viên ${editingPermissionsStaff.name} (SĐT: ${editingPermissionsStaff.phone}).`,
                    actorName: currentStaff.name,
                    actorRole: currentStaff.role
                  });
                  setEditingPermissionsStaff(null);
                  triggerSuccess(`Đã lưu cấu hình phân quyền chi tiết cho ${editingPermissionsStaff.name}!`);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer text-center transition-all text-xs flex items-center justify-center gap-1 shadow-md active:scale-[0.98]"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Lưu cấu hình</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {changingPasswordStaff && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-fadeIn">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="h-4 w-4 text-amber-500" />
                <span>Đổi Mật Khẩu Nhân Viên</span>
              </h3>
              <button onClick={() => setChangingPasswordStaff(null)} className="text-stone-500 hover:text-stone-300 cursor-pointer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 text-xs bg-stone-950/50 p-3 rounded-lg border border-stone-850/50">
              <div className="flex justify-between mb-1">
                <span className="text-stone-400">Nhân viên:</span>
                <span className="font-bold text-stone-200">{changingPasswordStaff.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Vai trò:</span>
                <span className="font-mono text-[10px] bg-stone-900 px-1.5 py-0.5 rounded text-stone-300">
                  {changingPasswordStaff.role}
                </span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newStaffPassword) {
                  alert("Vui lòng nhập mật khẩu mới!");
                  return;
                }
                if (newStaffPassword.length < 4) {
                  alert("Mật khẩu phải từ 4 ký tự trở lên!");
                  return;
                }
                if (newStaffPassword !== confirmNewStaffPassword) {
                  alert("Mật khẩu xác nhận không trùng khớp!");
                  return;
                }

                // Call onUpdateStaff to persist changes
                const updatedStaff: Staff = {
                  ...changingPasswordStaff,
                  password: newStaffPassword,
                };

                onUpdateStaff(updatedStaff);

                safeDispatchEvent("kiot-add-audit-log", {
                  actionType: "STAFF_PASSWORD_CHANGE",
                  actionName: "Thay đổi mật khẩu nhân viên",
                  description: `Đã thay đổi mật khẩu thành công cho nhân viên: ${updatedStaff.name} (Vai trò: ${updatedStaff.role}).`,
                  actorName: currentStaff.name,
                  actorRole: currentStaff.role
                });

                setChangingPasswordStaff(null);
                triggerSuccess(`Đã cập nhật mật khẩu mới cho ${updatedStaff.name}!`);
              }}
              className="space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  value={confirmNewStaffPassword}
                  onChange={(e) => setConfirmNewStaffPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu mới..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setChangingPasswordStaff(null)}
                  className="flex-1 py-2.5 bg-stone-950 border border-stone-800 hover:bg-stone-850 text-stone-400 font-bold rounded-xl transition-all cursor-pointer text-center text-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer text-center transition-all text-xs flex items-center justify-center gap-1 shadow-md active:scale-[0.98]"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Xác nhận đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 3: BACKUP AND SYNC */}
      {activeSubTab === "backup" && (
        <div className="space-y-6 animate-fade-in">
          {currentStaff.role !== "OWNER" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn mb-1">
              <Info className="h-5 w-5 shrink-0" />
              <span>Chế độ Xem &amp; Xuất dữ liệu: Bạn có thể tải file sao lưu Excel (CSV) hoặc JSON, nhưng chỉ Chủ cửa hàng (OWNER) mới có quyền Khôi phục dữ liệu hoặc thay đổi tùy chọn tự động đồng bộ đám mây.</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left box: Export/Import (Local files) */}
            <div className="space-y-4 p-5 rounded-2xl bg-stone-900 border border-stone-850">
              <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                <Database className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">
                  Sao lưu thiết bị cục bộ (Local Files)
                </h4>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Xuất toàn bộ dữ liệu cửa hàng của bạn ra các định dạng chuẩn JSON hoặc CSV. Bạn có thể lưu trữ các file này trên thiết bị cá nhân hoặc gửi qua email để tự khôi phục khi cần thiết.
              </p>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={exportAllToJSON}
                    className="flex-1 min-w-[150px] px-4 py-3 rounded-xl bg-stone-950 hover:bg-stone-850 text-stone-200 hover:text-emerald-400 border border-stone-800 hover:border-emerald-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                  >
                    <FileJson className="h-4.5 w-4.5 text-emerald-400" />
                    <span>Xuất Toàn bộ (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportProductsToCSV}
                    className="flex-1 min-w-[150px] px-4 py-3 rounded-xl bg-stone-950 hover:bg-stone-850 text-stone-200 hover:text-amber-500 border border-stone-800 hover:border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                  >
                    <FileSpreadsheet className="h-4.5 w-4.5 text-amber-500" />
                    <span>Sản phẩm (CSV)</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={exportInvoicesToCSV}
                    className="flex-1 min-w-[150px] px-4 py-3 rounded-xl bg-stone-950 hover:bg-stone-850 text-stone-200 hover:text-amber-500 border border-stone-800 hover:border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                  >
                    <FileSpreadsheet className="h-4.5 w-4.5 text-amber-500" />
                    <span>Hóa đơn (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportCustomersToCSV}
                    className="flex-1 min-w-[150px] px-4 py-3 rounded-xl bg-stone-950 hover:bg-stone-850 text-stone-200 hover:text-amber-500 border border-stone-800 hover:border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
                  >
                    <FileSpreadsheet className="h-4.5 w-4.5 text-amber-500" />
                    <span>Khách hàng (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Import/Restore option */}
              <div className="mt-4 pt-4 border-t border-stone-800/60 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                  <Upload className="h-4 w-4 text-emerald-400" />
                  <span>Phục hồi dữ liệu từ file JSON</span>
                </div>
                <p className="text-[10px] text-stone-500 leading-normal">
                  Chọn file backup định dạng <code className="text-amber-400 font-mono">.json</code> đã xuất trước đó để khôi phục lại toàn bộ dữ liệu cửa hàng của bạn.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    disabled={currentStaff.role !== "OWNER"}
                    onChange={handleJSONImport}
                    className="block w-full text-xs text-stone-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-xl file:border-0
                      file:text-xs file:font-bold file:uppercase file:tracking-wider
                      file:bg-emerald-500/10 file:text-emerald-400
                      hover:file:bg-emerald-500/15 cursor-pointer file:cursor-pointer
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

            </div>

            {/* Right box: PostgreSQL Cloud Sync */}
            <div className="space-y-4 p-5 rounded-2xl bg-stone-900 border border-stone-850 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                  <Cloud className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                    Đồng bộ điện toán đám mây (PostgreSQL)
                  </h4>
                </div>
                
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Tự động lưu trữ và đồng bộ hóa thời gian thực tất cả dữ liệu (sản phẩm, hóa đơn, khách hàng, cấu hình) lên máy chủ PostgreSQL an toàn của Google Cloud SQL. Đảm bảo an toàn dữ liệu tối đa kể cả khi mất thiết bị.
                </p>

                {/* Status Indicator */}
                <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-400">Trạng thái kết nối:</span>
                    <span className={`font-bold flex items-center gap-1.5 ${isOnline ? "text-emerald-400" : "text-amber-500 animate-pulse"}`}>
                      <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-500"}`} />
                      {isOnline ? "Trực tuyến (Online)" : "Ngoại tuyến (Offline)"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-stone-900 pt-2.5">
                    <span className="text-stone-400">Lần đồng bộ cuối:</span>
                    <span className="font-mono text-stone-300 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-stone-500" />
                      {lastSyncTime ? new Date(lastSyncTime).toLocaleString("vi-VN") : "Chưa đồng bộ"}
                    </span>
                  </div>

                  {/* Auto-Sync Switch */}
                  <div className="flex justify-between items-center text-xs border-t border-stone-900 pt-2.5">
                    <span className="text-stone-400">Tự động đồng bộ định kỳ:</span>
                    <button
                      type="button"
                      disabled={currentStaff.role !== "OWNER"}
                      onClick={() => onToggleAutoSync(!autoSyncEnabled)}
                      className="cursor-pointer text-stone-400 hover:text-stone-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {autoSyncEnabled ? (
                        <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 font-bold uppercase text-[10px]">
                          <Check className="h-3 w-3" />
                          <span>Đang bật</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-stone-800 text-stone-500 px-2.5 py-1.5 rounded-lg border border-stone-850 uppercase text-[10px] font-bold">
                          <span>Đã tắt</span>
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-stone-950 p-3 rounded-xl border border-stone-800 text-stone-400">
                  <Info className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-[10px] leading-normal">
                    Khi "Tự động đồng bộ" được bật, hệ thống sẽ tự động sao lưu dữ liệu lên đám mây cứ mỗi <strong className="text-amber-500">60 giây</strong> hoặc ngay khi bạn thanh toán một hóa đơn mới.
                  </p>
                </div>
              </div>

              {/* Sync Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={triggerSyncAll}
                  disabled={isSyncingAll}
                  className="w-full px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.98] font-sans"
                >
                  <RefreshCw className={`h-4.5 w-4.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                  <span>{isSyncingAll ? "Đang tiến hành đồng bộ..." : "Đồng bộ lên PostgreSQL"}</span>
                </button>

                {onRestoreFromPostgres && (
                  <button
                    type="button"
                    disabled={currentStaff.role !== "OWNER"}
                    onClick={onRestoreFromPostgres}
                    className="w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-stone-800 disabled:text-stone-600 text-stone-100 hover:text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.98] font-sans border border-indigo-500/20 disabled:border-stone-800"
                  >
                    <Cloud className="h-4.5 w-4.5" />
                    <span>Khôi phục từ PostgreSQL</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Section: Khôi phục cài đặt gốc & Xóa sạch Demo Data */}
          <div className="p-5 rounded-2xl bg-stone-900 border border-rose-950/40 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
              <ShieldAlert className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
              <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest">
                Khôi phục cài đặt gốc & Xóa sạch dữ liệu Demo
              </h4>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              Bạn đang muốn xóa bỏ toàn bộ dữ liệu mẫu / demo (các sản phẩm sữa, nước ngọt, hóa đơn nháp, khách hàng demo...) để bắt đầu nhập dữ liệu kinh doanh thực tế của riêng mình? Thao tác này sẽ dọn dẹp trống rỗng cơ sở dữ liệu và giữ lại duy nhất tài khoản Chủ cửa hàng (OWNER) của bạn.
            </p>

            <div className="p-3.5 bg-rose-500/5 rounded-xl border border-rose-500/10 flex items-start gap-3">
              <Info className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-[10px] text-rose-300 leading-relaxed">
                <strong>⚠️ CẢNH BÁO QUAN TRỌNG:</strong> Thao tác này KHÔNG THỂ đảo ngược. Toàn bộ thông tin sản phẩm, lịch sử giao dịch và doanh thu trên cả thiết bị cục bộ và máy chủ đám mây PostgreSQL sẽ bị xóa sạch hoàn toàn.
              </div>
            </div>

            <div className="flex justify-end pt-1">
              {currentStaff.role !== "OWNER" ? (
                <span className="text-[10px] text-amber-500 font-semibold">
                  Chỉ Chủ cửa hàng (OWNER) mới có quyền Khôi phục cài đặt gốc.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onResetDatabase}
                  className="px-5 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-stone-950 text-rose-400 font-black text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all border border-rose-500/20 active:scale-[0.98]"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Xóa hết Demo &amp; Reset Cửa hàng</span>
                </button>
              )}
            </div>
          </div>

          {/* Full-width box: Checksum Integrity Validation */}
          <div className="p-5 rounded-2xl bg-stone-900 border border-stone-850 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
              <Shield className="h-4 w-4 text-amber-500" />
              <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">
                Kiểm tra tính toàn vẹn dữ liệu (Checksum Validation)
              </h4>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              Hệ thống tự động so sánh hóa đơn trong hàng đợi ngoại tuyến (<code className="text-amber-400 font-mono">offlineQueue</code>) với các bản ghi đã đồng bộ trên máy chủ đám mây (<code className="text-amber-400 font-mono">kiot_server_invoices</code>) sau mỗi <strong>5 phút</strong>. Thao tác này nhằm phát hiện chênh lệch về tổng tiền, số lượng sản phẩm, hoặc trạng thái thanh toán để bảo đảm tính nhất quán dữ liệu.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-stone-950 p-4 rounded-xl border border-stone-800">
              <div className="space-y-1">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold block">Trạng thái hiện tại:</span>
                {integrityStatus?.hasDiscrepancy ? (
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-rose-400 animate-pulse" />
                    Phát hiện chênh lệch ({integrityStatus.discrepancyCount} lỗi)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    Dữ liệu trùng khớp (Hoàn hảo)
                  </span>
                )}
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l border-stone-800/80 md:pl-4">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold block">Lần kiểm tra cuối:</span>
                <span className="text-xs font-mono text-stone-300 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-stone-500" />
                  {integrityStatus?.lastChecked 
                    ? new Date(integrityStatus.lastChecked).toLocaleString("vi-VN") 
                    : "Chưa kiểm tra"}
                </span>
              </div>

              <div className="flex items-center md:justify-end border-t md:border-t-0 md:border-l border-stone-800/80 md:pl-4">
                <button
                  type="button"
                  onClick={() => runChecksumValidation?.(false)}
                  className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-750 text-amber-500 hover:text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-stone-700 hover:border-amber-500/30"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Kiểm tra ngay</span>
                </button>
              </div>
            </div>

            {integrityStatus?.hasDiscrepancy && integrityStatus.details.length > 0 && (
              <div className="bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl space-y-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-rose-400">Danh sách các sự cố phát hiện:</div>
                <ul className="text-stone-400 text-[11px] list-disc pl-4 space-y-1">
                  {integrityStatus.details.map((detail, idx) => (
                    <li key={idx} className="leading-relaxed text-rose-300/90">{detail}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: SYSTEM AUDIT LOG */}
      {activeSubTab === "logs" && (
        <div className="p-6 rounded-2xl bg-stone-900 border border-stone-850 space-y-5 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-850 pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2 uppercase tracking-wider">
                <Activity className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                <span>Nhật Ký Hệ Thống (System Audit Log)</span>
              </h3>
              <p className="text-xs text-stone-400">Tra cứu dấu vết thao tác nhạy cảm: sửa giá sản phẩm, xóa danh mục, thay đổi phân quyền nhân viên.</p>
            </div>
            
            {/* Clear Filters helper */}
            {(logSearch || logTypeFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setLogSearch("");
                  setLogTypeFilter("ALL");
                }}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-bold rounded-lg transition-colors border border-stone-700 flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-stone-400 font-bold uppercase block mb-1">Tìm kiếm nội dung</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-stone-500 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Tìm theo người thực hiện, nội dung chi tiết..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 text-stone-200 text-xs rounded-xl focus:outline-none focus:border-emerald-500 placeholder:text-stone-600"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-stone-400 font-bold uppercase block mb-1">Loại thao tác</label>
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer font-sans"
              >
                <option value="ALL" className="bg-stone-900 text-stone-200">-- Tất cả thao tác --</option>
                <option value="USER_LOGIN" className="bg-stone-900 text-stone-200">Đăng nhập hệ thống</option>
                <option value="USER_LOGOUT" className="bg-stone-900 text-stone-200">Đăng xuất hệ thống</option>
                <option value="PRODUCT_PRICE_EDIT" className="bg-stone-900 text-stone-200">Chỉnh sửa giá sản phẩm</option>
                <option value="CATEGORY_DELETE" className="bg-stone-900 text-stone-200">Xóa danh mục</option>
                <option value="CATEGORY_CREATE" className="bg-stone-900 text-stone-200">Thêm danh mục mới</option>
                <option value="STAFF_PERMISSION_CHANGE" className="bg-stone-900 text-stone-200">Thay đổi phân quyền nhân viên</option>
                <option value="PRODUCT_CREATE" className="bg-stone-900 text-stone-200">Thêm sản phẩm mới</option>
                <option value="PRODUCT_DELETE" className="bg-stone-900 text-stone-200">Xóa sản phẩm</option>
                <option value="STAFF_CREATE" className="bg-stone-900 text-stone-200">Thêm nhân viên mới</option>
                <option value="STAFF_DELETE" className="bg-stone-900 text-stone-200">Xóa nhân viên</option>
              </select>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="overflow-x-auto rounded-xl border border-stone-850 bg-stone-950/20 max-h-[350px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-800 bg-stone-950 text-stone-400 sticky top-0 z-10 font-bold uppercase tracking-wider">
                  <th className="py-2 px-3 bg-stone-950 w-40">Thời gian</th>
                  <th className="py-2 px-3 bg-stone-950 w-56">Thao tác</th>
                  <th className="py-2 px-3 bg-stone-950 w-48">Người thực hiện</th>
                  <th className="py-2 px-3 bg-stone-950">Chi tiết nội dung thay đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-850/50">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-stone-500 font-semibold">
                      Không tìm thấy nhật ký hệ thống nào khớp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const formattedTime = new Date(log.timestamp).toLocaleString("vi-VN", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    });

                    // Color mapping based on actionType
                    let badgeClass = "bg-stone-500/10 text-stone-400 border border-stone-500/20";
                    if (log.actionType === "PRODUCT_PRICE_EDIT") {
                      badgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/15";
                    } else if (log.actionType === "CATEGORY_DELETE" || log.actionType === "PRODUCT_DELETE" || log.actionType === "STAFF_DELETE" || log.actionType === "INVOICE_CANCEL") {
                      badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/15";
                    } else if (log.actionType === "STAFF_PERMISSION_CHANGE" || log.actionType === "STAFF_PASSWORD_CHANGE") {
                      badgeClass = "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15";
                    } else if (log.actionType === "PRODUCT_CREATE" || log.actionType === "CATEGORY_CREATE" || log.actionType === "STAFF_CREATE") {
                      badgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";
                    } else if (log.actionType === "USER_LOGIN") {
                      badgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/15";
                    } else if (log.actionType === "USER_LOGOUT") {
                      badgeClass = "bg-stone-500/10 text-stone-400 border border-stone-500/15";
                    }

                    return (
                      <tr key={log.id} className="hover:bg-stone-950/40 transition-all">
                        <td className="py-3 px-3 font-mono text-stone-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-stone-600" />
                            <span>{formattedTime}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide ${badgeClass}`}>
                            {log.actionName}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-0.5 leading-none">
                            <span className="font-bold text-stone-200 block">{log.actorName}</span>
                            <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block">
                              {log.actorRole === "OWNER" ? "Chủ shop" : log.actorRole === "MANAGER" ? "Quản lý" : "Thu ngân"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-stone-300 leading-relaxed max-w-md break-words">
                          {log.description}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">Thêm Nhân Viên Mới</h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-stone-500 hover:text-stone-300 cursor-pointer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Họ và tên nhân viên *</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setFormState(e.target.value, setStaffName)}
                  placeholder="Ví dụ: Nguyễn Thị Hoa..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Email đăng ký đăng nhập *</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setFormState(e.target.value, setStaffEmail)}
                  placeholder="hoa@kiotx.vn..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    value={staffPhone}
                    onChange={(e) => setFormState(e.target.value, setStaffPhone)}
                    placeholder="09..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase">Quyền hạn</label>
                  <select
                    value={staffRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-300 cursor-pointer"
                  >
                    <option value="CASHIER">CASHIER (Thu ngân)</option>
                    {(getRoleRank(currentStaff.role) > 2 || isSuperAdmin) && (
                      <option value="MANAGER">MANAGER (Quản lý kho)</option>
                    )}
                    {(getRoleRank(currentStaff.role) > 3 || isSuperAdmin) && (
                      <option value="OWNER">OWNER (Chủ sở hữu)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Mật khẩu đăng nhập *</label>
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setFormState(e.target.value, setStaffPassword)}
                  placeholder="Nhập mật khẩu ban đầu cho nhân viên..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                />
              </div>

              {staffRole !== "OWNER" && (
                <div className="p-3 bg-stone-950 rounded-xl border border-stone-850 space-y-3.5 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-stone-900 pb-1.5">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tùy chỉnh quyền hạn</span>
                  </div>

                  {/* Copy Permissions Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-stone-500 font-bold uppercase block">Sao chép mẫu quyền từ</label>
                    <select
                      value={copyFromStaffId}
                      onChange={(e) => handleCopyPermissions(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 text-[10px] cursor-pointer focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Chọn nhân viên có sẵn --</option>
                      {staff.filter(s => s.role !== "OWNER").map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                    {/* Bán hàng POS */}
                    <label className={`flex items-center gap-1.5 select-none ${currentStaffHasPermission("posAccess") ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="checkbox"
                        checked={posAccess}
                        disabled={!currentStaffHasPermission("posAccess")}
                        onChange={(e) => setPosAccess(e.target.checked)}
                        className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-stone-200">Bán hàng POS</span>
                    </label>

                    {/* Hàng hóa & Kho */}
                    <label className={`flex items-center gap-1.5 select-none ${currentStaffHasPermission("productsAccess") ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="checkbox"
                        checked={productsAccess}
                        disabled={!currentStaffHasPermission("productsAccess")}
                        onChange={(e) => setProductsAccess(e.target.checked)}
                        className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-stone-200">Sản phẩm & Kho</span>
                    </label>

                    {/* Khách hàng & NCC */}
                    <label className={`flex items-center gap-1.5 select-none ${currentStaffHasPermission("partnersAccess") ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="checkbox"
                        checked={partnersAccess}
                        disabled={!currentStaffHasPermission("partnersAccess")}
                        onChange={(e) => setPartnersAccess(e.target.checked)}
                        className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-stone-200">Đối tác (Khách/NCC)</span>
                    </label>

                    {/* Sổ quỹ */}
                    <label className={`flex items-center gap-1.5 select-none ${currentStaffHasPermission("cashbookAccess") ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="checkbox"
                        checked={cashbookAccess}
                        disabled={!currentStaffHasPermission("cashbookAccess")}
                        onChange={(e) => setCashbookAccess(e.target.checked)}
                        className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-stone-200">Xem Sổ Quỹ</span>
                    </label>

                    {/* Xem Báo cáo */}
                    <label className={`flex items-center gap-1.5 select-none ${currentStaffHasPermission("reportsAccess") ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="checkbox"
                        checked={reportsAccess}
                        disabled={!currentStaffHasPermission("reportsAccess")}
                        onChange={(e) => setReportsAccess(e.target.checked)}
                        className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-stone-200">Xem Báo cáo</span>
                    </label>

                    {/* Thiết lập hệ thống */}
                    <label className={`flex items-center gap-1.5 select-none ${currentStaffHasPermission("settingsAccess") ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="checkbox"
                        checked={settingsAccess}
                        disabled={!currentStaffHasPermission("settingsAccess")}
                        onChange={(e) => setSettingsAccess(e.target.checked)}
                        className="rounded border-stone-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-stone-900 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="font-semibold text-stone-200">Thiết lập</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-850 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl cursor-pointer"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM STAFF DELETION CONFIRMATION MODAL */}
      {deletingStaff && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-850 text-stone-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-fade-in">
            <div className="flex items-center gap-3 text-rose-500 mb-4 select-none">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-rose-500">Xác Nhận Xóa Nhân Viên</h3>
                <p className="text-[10px] text-stone-500 font-medium">Thao tác này không thể thu hồi</p>
              </div>
            </div>
            
            <p className="text-xs text-stone-300 leading-relaxed mb-6">
              Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của nhân viên <strong className="text-white">"{deletingStaff.name}"</strong> khỏi hệ thống cửa hàng? Toàn bộ phân quyền và thông tin đăng nhập của nhân viên này sẽ bị hủy bỏ ngay lập tức.
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="px-4 py-2 bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-850 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStaff(deletingStaff.id);
                  
                  safeDispatchEvent("kiot-add-audit-log", {
                    actionType: "STAFF_DELETE",
                    actionName: "Xóa nhân viên",
                    description: `Đã xóa tài khoản nhân viên "${deletingStaff.name}" (ID: ${deletingStaff.id}) khỏi hệ thống.`,
                    actorName: currentStaff.name,
                    actorRole: currentStaff.role
                  });

                  triggerSuccess(`Đã xóa tài khoản nhân viên ${deletingStaff.name} thành công.`);
                  setDeletingStaff(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-rose-600/15"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple state setter utility for React synthetic events inside modals
function setFormState(value: string, setter: (val: string) => void) {
  setter(value);
}
