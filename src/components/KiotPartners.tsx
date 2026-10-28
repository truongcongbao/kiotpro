import React, { useState, useMemo } from "react";
import { Customer, Supplier, Staff, CashbookEntry } from "../types";
import { 
  Search, Plus, Edit2, Trash2, Users, Briefcase, Award, CheckCircle, 
  MapPin, Phone, Mail, Award as AwardIcon, Star, Sparkles, Receipt, DollarSign, Wallet, Lock
} from "lucide-react";
import { safeDispatchEvent } from "../lib/events";

interface KiotPartnersProps {
  customers: Customer[];
  suppliers: Supplier[];
  currentStaff: Staff;
  onAddCustomer: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onAddSupplier: (supplier: Supplier) => void;
  onEditSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onAddCashbookEntry?: (entry: CashbookEntry) => void;
}

export default function KiotPartners({
  customers,
  suppliers,
  currentStaff,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
  onAddCashbookEntry
}: KiotPartnersProps) {
  
  const hasPermission = (perm: "partnerCreateEdit" | "partnerDelete" | "partnerDebtAdjust") => {
    if (!currentStaff) return true;
    if (currentStaff.role === "OWNER") return true;
    if (currentStaff.permissions?.[perm] !== undefined) {
      return currentStaff.permissions[perm];
    }
    if (currentStaff.role === "MANAGER") {
      if (perm === "partnerDelete") return false;
      return true;
    }
    return false;
  };

  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">("customers");
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("Tất cả");

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Customer Form state
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custSpent, setCustSpent] = useState<number>(0);
  const [custPoints, setCustPoints] = useState<number>(0);
  const [custTier, setCustTier] = useState<"Standard" | "Bronze" | "Silver" | "Gold" | "Diamond">("Standard");
  const [custDebt, setCustDebt] = useState<number>(0);

  // Supplier Form state
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supCompany, setSupCompany] = useState("");
  const [supDebt, setSupDebt] = useState<number>(0);

  const formatVND = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  // Filter customers list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.phone.includes(searchQuery) ||
                          (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchTier = tierFilter === "Tất cả" || c.tier === tierFilter;
      return matchSearch && matchTier;
    });
  }, [customers, searchQuery, tierFilter]);

  // Filter suppliers list
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      return s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             s.phone.includes(searchQuery) ||
             (s.companyName && s.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [suppliers, searchQuery]);

  const handleCollectDebt = (customer: Customer) => {
    if (!hasPermission("partnerDebtAdjust")) {
      safeDispatchEvent("kiot-toast", {
        type: "error",
        title: "TỪ CHỐI TRUY CẬP 🚫",
        message: "Tài khoản của bạn không có quyền Thu hồi nợ đối tác!"
      });
      return;
    }
    const currentDebt = customer.debt || 0;
    if (currentDebt <= 0) return;

    const payStr = prompt(`[THU HỒI NỢ KHÁCH HÀNG]\nKhách hàng: ${customer.name}\nSố nợ hiện tại: ${formatVND(currentDebt)}\n\nNhập số tiền khách hàng thanh toán đợt này:`, currentDebt.toString());
    if (payStr === null) return;

    const payAmount = Number(payStr);
    if (isNaN(payAmount) || payAmount <= 0) {
      alert("Số tiền nhập vào không hợp lệ!");
      return;
    }

    if (payAmount > currentDebt) {
      alert("Số tiền thanh toán vượt quá số nợ hiện tại!");
      return;
    }

    const updatedCustomer: Customer = {
      ...customer,
      debt: currentDebt - payAmount
    };
    onEditCustomer(updatedCustomer);

    // Create cashbook entry if callback exists
    if (onAddCashbookEntry) {
      const newEntry: CashbookEntry = {
        id: `cb-${Date.now()}`,
        entryCode: `SQ${Math.floor(100000 + Math.random() * 900000)}`,
        type: "INCOME",
        amount: payAmount,
        category: "Thu nợ khách hàng",
        description: `Thu hồi nợ từ đối tác ${customer.name}`,
        paymentMethod: "CASH",
        date: new Date().toISOString(),
        creatorName: currentStaff.name
      };
      onAddCashbookEntry(newEntry);
    }

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "Thu hồi nợ thành công! 📝",
      message: `Đã thu ${payAmount.toLocaleString("vi-VN")}đ từ ${customer.name}. Nợ còn lại: ${(currentDebt - payAmount).toLocaleString("vi-VN")}đ.`
    });
  };

  const handlePaySupplierDebt = (supplier: Supplier) => {
    if (!hasPermission("partnerDebtAdjust")) {
      safeDispatchEvent("kiot-toast", {
        type: "error",
        title: "TỪ CHỐI TRUY CẬP 🚫",
        message: "Tài khoản của bạn không có quyền Trả nợ nhà cung cấp!"
      });
      return;
    }
    const currentDebt = supplier.debt || 0;
    if (currentDebt <= 0) return;

    const payStr = prompt(`[THANH TOÁN NỢ NHÀ CUNG CẤP]\nNhà cung cấp: ${supplier.name}\nSố tiền đang nợ: ${formatVND(currentDebt)}\n\nNhập số tiền bạn muốn trả đợt này:`, currentDebt.toString());
    if (payStr === null) return;

    const payAmount = Number(payStr);
    if (isNaN(payAmount) || payAmount <= 0) {
      alert("Số tiền nhập vào không hợp lệ!");
      return;
    }

    if (payAmount > currentDebt) {
      alert("Số tiền thanh toán vượt quá số nợ đang nợ!");
      return;
    }

    const updatedSupplier: Supplier = {
      ...supplier,
      debt: currentDebt - payAmount
    };
    onEditSupplier(updatedSupplier);

    // Create cashbook entry if callback exists
    if (onAddCashbookEntry) {
      const newEntry: CashbookEntry = {
        id: `cb-${Date.now()}`,
        entryCode: `SQ${Math.floor(100000 + Math.random() * 900000)}`,
        type: "EXPENSE",
        amount: payAmount,
        category: "Trả tiền NCC",
        description: `Thanh toán công nợ mua hàng cho ${supplier.name}`,
        paymentMethod: "BANK_TRANSFER",
        date: new Date().toISOString(),
        creatorName: currentStaff.name
      };
      onAddCashbookEntry(newEntry);
    }

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "Thanh toán nợ NCC thành công! 💳",
      message: `Đã chi ${payAmount.toLocaleString("vi-VN")}đ trả cho ${supplier.name}. Nợ còn lại: ${(currentDebt - payAmount).toLocaleString("vi-VN")}đ.`
    });
  };

  // Handle open Customer Modal
  const handleOpenCustomerModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustName(customer.name);
      setCustPhone(customer.phone);
      setCustEmail(customer.email || "");
      setCustAddress(customer.address || "");
      setCustSpent(customer.totalSpent);
      setCustPoints(customer.points);
      setCustTier(customer.tier);
      setCustDebt(customer.debt || 0);
    } else {
      setEditingCustomer(null);
      setCustName("");
      setCustPhone("");
      setCustEmail("");
      setCustAddress("");
      setCustSpent(0);
      setCustPoints(0);
      setCustTier("Standard");
      setCustDebt(0);
    }
    setIsCustomerModalOpen(true);
  };

  // Save Customer
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      alert("Tên khách hàng và số điện thoại là bắt buộc!");
      return;
    }

    const customerData: Customer = {
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
      name: custName,
      phone: custPhone,
      email: custEmail || undefined,
      address: custAddress || undefined,
      totalSpent: Number(custSpent),
      points: Number(custPoints),
      tier: custTier,
      debt: Number(custDebt),
      avatar: editingCustomer?.avatar
    };

    if (editingCustomer) {
      onEditCustomer(customerData);
    } else {
      onAddCustomer(customerData);
    }

    setIsCustomerModalOpen(false);
  };

  // Partner to delete state for modal
  const [partnerToDelete, setPartnerToDelete] = useState<{ id: string; name: string; type: "customer" | "supplier" } | null>(null);

  // Delete Customer
  const handleDeleteCustomerClick = (id: string, name: string) => {
    if (id === "cust-4") {
      safeDispatchEvent("kiot-toast", {
        type: "error",
        title: "Không thể xóa",
        message: "Không thể xóa tài khoản Khách vãng lai mặc định của hệ thống!"
      });
      return;
    }
    setPartnerToDelete({ id, name, type: "customer" });
  };

  // Handle open Supplier Modal
  const handleOpenSupplierModal = (supplier: Supplier | null = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupName(supplier.name);
      setSupPhone(supplier.phone);
      setSupEmail(supplier.email || "");
      setSupAddress(supplier.address || "");
      setSupCompany(supplier.companyName || "");
      setSupDebt(supplier.debt || 0);
    } else {
      setEditingSupplier(null);
      setSupName("");
      setSupPhone("");
      setSupEmail("");
      setSupAddress("");
      setSupCompany("");
      setSupDebt(0);
    }
    setIsSupplierModalOpen(true);
  };

  // Save Supplier
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName || !supPhone) {
      alert("Tên nhà cung cấp và số điện thoại là bắt buộc!");
      return;
    }

    const supplierData: Supplier = {
      id: editingSupplier ? editingSupplier.id : `sup-${Date.now()}`,
      name: supName,
      phone: supPhone,
      email: supEmail || undefined,
      address: supAddress || undefined,
      companyName: supCompany || undefined,
      debt: Number(supDebt)
    };

    if (editingSupplier) {
      onEditSupplier(supplierData);
    } else {
      onAddSupplier(supplierData);
    }

    setIsSupplierModalOpen(false);
  };

  // Delete Supplier
  const handleDeleteSupplierClick = (id: string, name: string) => {
    setPartnerToDelete({ id, name, type: "supplier" });
  };

  return (
    <div className="space-y-6">
      
      {/* Sub tabs choice: Customers or Suppliers */}
      <div className="flex items-center justify-between border-b border-stone-850 pb-1">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab("customers"); setSearchQuery(""); }}
            className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
              activeTab === "customers" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Khách hàng ({customers.length})
            </span>
            {activeTab === "customers" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab("suppliers"); setSearchQuery(""); }}
            className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
              activeTab === "suppliers" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" />
              Nhà cung cấp ({suppliers.length})
            </span>
            {activeTab === "suppliers" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>
        </div>

        <button
          disabled={!hasPermission("partnerCreateEdit")}
          onClick={() => activeTab === "customers" ? handleOpenCustomerModal(null) : handleOpenSupplierModal(null)}
          className="px-4 py-1.5 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={hasPermission("partnerCreateEdit") ? "" : "Bạn không có quyền thêm đối tác"}
        >
          {hasPermission("partnerCreateEdit") ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4 text-stone-850" />}
          <span>{activeTab === "customers" ? "Thêm khách hàng" : "Thêm nhà cung cấp"}</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMERS DIRECTORY */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          
          {/* Quick Loyalty Card Rules Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-r from-stone-900 to-stone-950 border border-stone-850 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/15">
                <AwardIcon className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold block uppercase">Cơ chế tích điểm</span>
                <p className="text-xs text-stone-300">Nhận ngay <span className="text-amber-400 font-bold">1 điểm</span> cho mỗi <span className="font-mono text-amber-400 font-bold">10,000 VND</span> hóa đơn.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-stone-900 to-stone-950 border border-stone-850 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold block uppercase">Nâng hạng Diamond</span>
                <p className="text-xs text-stone-300">Tự động nâng khi doanh số đạt trên <span className="font-mono text-emerald-400 font-bold">30,000,000đ</span>.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-r from-stone-900 to-stone-950 border border-stone-850 flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-stone-500 font-bold block uppercase">Bảng vàng thành viên</span>
                <p className="text-xs text-stone-300">Hiện có <span className="font-mono text-indigo-400 font-bold">{customers.filter(c => c.tier !== "Standard").length}</span> đối tác VIP đang hoạt động.</p>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-850 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm khách hàng theo tên, sđt hoặc email..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Hạng thẻ thành viên:</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Tất cả">Tất cả hạng thẻ</option>
                <option value="Standard">Standard</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Diamond">Diamond</option>
              </select>
            </div>
          </div>

          {/* Customers Table */}
          <div className="rounded-2xl bg-stone-900 border border-stone-850 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-950/60 border-b border-stone-850 text-stone-400">
                    <th className="p-4 font-bold uppercase tracking-wider">Mã / Avatar</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Tên đối tác</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Hạng thẻ</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Liên hệ</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Điểm tích lũy</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Tổng mua hàng</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider text-rose-400">Nợ hiện tại</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-850/60">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-stone-500">
                        Không tìm thấy khách hàng phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const isWalkIn = c.id === "cust-4";
                      return (
                        <tr key={c.id} className="hover:bg-stone-950/20 transition-all group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {c.avatar ? (
                                <img src={c.avatar} alt={c.name} className="h-9 w-9 rounded-full object-cover border border-stone-800" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-stone-950 border border-stone-800 flex items-center justify-center font-bold text-xs text-stone-500">
                                  {c.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-mono text-[10px] text-stone-500">{c.id.toUpperCase().slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-stone-100 text-sm block">{c.name}</span>
                              {c.address && (
                                <span className="text-[10px] text-stone-500 flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-stone-600 shrink-0" />
                                  <span className="truncate max-w-[150px]">{c.address}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              c.tier === "Diamond" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]" :
                              c.tier === "Gold" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]" :
                              c.tier === "Silver" ? "bg-slate-300/10 text-slate-300 border-slate-300/20" :
                              c.tier === "Bronze" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                              "bg-stone-950 text-stone-500 border-stone-850"
                            }`}>
                              {c.tier}
                            </span>
                          </td>
                          <td className="p-4 text-stone-300">
                            <div className="space-y-0.5">
                              <span className="font-mono flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3 text-stone-600 shrink-0" />
                                {c.phone}
                              </span>
                              {c.email && (
                                <span className="flex items-center gap-1 text-[10px] text-stone-500">
                                  <Mail className="h-3 w-3 text-stone-600 shrink-0" />
                                  {c.email}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-amber-500 text-sm">{c.points.toLocaleString("vi-VN")} đ</td>
                          <td className="p-4 text-right font-mono font-extrabold text-stone-100 text-sm">{formatVND(c.totalSpent)}</td>
                          <td className="p-4 text-right font-mono font-extrabold text-rose-400 text-sm">
                            {c.debt && c.debt > 0 ? (
                              <span className="px-2 py-1 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">{formatVND(c.debt)}</span>
                            ) : (
                              <span className="text-stone-600">-</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {!isWalkIn && (
                              <div className="flex items-center justify-end gap-2">
                                {c.debt && c.debt > 0 ? (
                                  <button
                                    disabled={!hasPermission("partnerDebtAdjust")}
                                    onClick={() => handleCollectDebt(c)}
                                    className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-emerald-900/30 cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                    title={hasPermission("partnerDebtAdjust") ? "Thu nợ khách hàng" : "Không có quyền thu nợ"}
                                  >
                                    {hasPermission("partnerDebtAdjust") ? <Receipt className="h-3 w-3" /> : <Lock className="h-3 w-3 text-stone-500" />}
                                    <span>Thu nợ</span>
                                  </button>
                                ) : null}
                                <button
                                  disabled={!hasPermission("partnerCreateEdit")}
                                  onClick={() => handleOpenCustomerModal(c)}
                                  className="p-2 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-stone-850 cursor-pointer"
                                  title={hasPermission("partnerCreateEdit") ? "Chỉnh sửa thông tin" : "Không có quyền sửa thông tin"}
                                >
                                  {hasPermission("partnerCreateEdit") ? <Edit2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-500" />}
                                </button>
                                <button
                                  disabled={!hasPermission("partnerDelete")}
                                  onClick={() => handleDeleteCustomerClick(c.id, c.name)}
                                  className="p-2 bg-stone-950 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-stone-850 cursor-pointer"
                                  title={hasPermission("partnerDelete") ? "Xóa đối tác" : "Không có quyền xóa đối tác"}
                                >
                                  {hasPermission("partnerDelete") ? <Trash2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-500" />}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SUPPLIERS DIRECTORY */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-850">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhà cung cấp theo tên, sđt, công ty liên kết..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-stone-900 border border-stone-850 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-950/60 border-b border-stone-850 text-stone-400">
                    <th className="p-4 font-bold uppercase tracking-wider">Mã nhà CC</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Tên đơn vị phân phối</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Công ty / Tổ chức</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Liên hệ</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Địa chỉ chi nhánh</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider text-rose-400">Cần trả NCC</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-850/60">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-stone-500">
                        Không tìm thấy nhà cung cấp thỏa mãn.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map(s => (
                      <tr key={s.id} className="hover:bg-stone-950/20 transition-all">
                        <td className="p-4 font-mono font-bold text-stone-500">{s.id.toUpperCase().slice(0, 8)}</td>
                        <td className="p-4">
                          <span className="font-bold text-stone-100 text-sm block">{s.name}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-stone-300 font-semibold">{s.companyName || "Cá nhân kinh doanh"}</span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className="font-mono flex items-center gap-1 text-xs">
                              <Phone className="h-3 w-3 text-stone-600 shrink-0" />
                              {s.phone}
                            </span>
                            {s.email && (
                              <span className="flex items-center gap-1 text-[10px] text-stone-500">
                                <Mail className="h-3 w-3 text-stone-600 shrink-0" />
                                {s.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-stone-400">
                          {s.address ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-stone-600 shrink-0" />
                              {s.address}
                            </span>
                          ) : (
                            <span className="text-stone-600">Chưa cung cấp</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono font-extrabold text-orange-400 text-sm">
                          {s.debt && s.debt > 0 ? (
                            <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">{formatVND(s.debt)}</span>
                          ) : (
                            <span className="text-stone-600">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {s.debt && s.debt > 0 ? (
                              <button
                                disabled={!hasPermission("partnerDebtAdjust")}
                                onClick={() => handlePaySupplierDebt(s)}
                                className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-rose-900/30 cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                title={hasPermission("partnerDebtAdjust") ? "Trả tiền nợ nhà cung cấp" : "Không có quyền thanh toán nợ"}
                              >
                                {hasPermission("partnerDebtAdjust") ? <Receipt className="h-3 w-3" /> : <Lock className="h-3 w-3 text-stone-500" />}
                                <span>Trả nợ</span>
                              </button>
                            ) : null}
                            <button
                              disabled={!hasPermission("partnerCreateEdit")}
                              onClick={() => handleOpenSupplierModal(s)}
                              className="p-2 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-stone-850 cursor-pointer"
                              title={hasPermission("partnerCreateEdit") ? "Chỉnh sửa thông tin" : "Không có quyền sửa thông tin"}
                            >
                              {hasPermission("partnerCreateEdit") ? <Edit2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-500" />}
                            </button>
                            <button
                              disabled={!hasPermission("partnerDelete")}
                              onClick={() => handleDeleteSupplierClick(s.id, s.name)}
                              className="p-2 bg-stone-950 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg border border-stone-850 cursor-pointer"
                              title={hasPermission("partnerDelete") ? "Xóa nhà cung cấp" : "Không có quyền xóa nhà cung cấp"}
                            >
                              {hasPermission("partnerDelete") ? <Trash2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-500" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">
                {editingCustomer ? "Cập Nhật Hồ Sơ Thành Viên" : "Đăng Ký Khách Hàng VIP"}
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-stone-500 hover:text-stone-300">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Họ và tên khách hàng *</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Nguyễn Văn A..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="09..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase">Hạng thành viên</label>
                  <select
                    value={custTier}
                    onChange={(e) => setCustTier(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-300"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Bronze">Bronze</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Diamond">Diamond</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Hộp thư điện tử (Email)</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Địa chỉ thường trú</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Quận/Huyện..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Công nợ ban đầu (Nợ phải thu) (VND)</label>
                <input
                  type="number"
                  value={custDebt || ""}
                  onChange={(e) => setCustDebt(Number(e.target.value))}
                  placeholder="Ví dụ: 5000000..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                />
              </div>

              {editingCustomer && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-stone-950 border border-stone-850">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-stone-500 uppercase font-bold block">Tổng tiền đã mua</span>
                    <span className="font-bold text-stone-200 font-mono text-xs">{formatVND(custSpent)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-stone-500 uppercase font-bold block">Điểm tích lũy</span>
                    <span className="font-bold text-amber-400 font-mono text-xs">{custPoints}đ</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-850 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl cursor-pointer"
                >
                  {editingCustomer ? "Lưu thay đổi" : "Tạo thành viên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">
                {editingSupplier ? "Cập Nhật Nhà Cung Cấp" : "Thêm Nhà Cung Cấp Mới"}
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-stone-500 hover:text-stone-300">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Tên người đại diện phân phối *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Ví dụ: Anh Nguyễn Văn A..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="E.g., 028..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase">Tên Công ty liên kết</label>
                  <input
                    type="text"
                    value={supCompany}
                    onChange={(e) => setSupCompany(e.target.value)}
                    placeholder="Công ty CP..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Hộp thư điện tử (Email)</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="distribution@company.vn"
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Địa chỉ văn phòng giao dịch</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Thành phố..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-stone-400 font-bold uppercase">Công nợ ban đầu (Nợ phải trả) (VND)</label>
                <input
                  type="number"
                  value={supDebt || ""}
                  onChange={(e) => setSupDebt(Number(e.target.value))}
                  placeholder="Ví dụ: 8500000..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-850 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl cursor-pointer"
                >
                  {editingSupplier ? "Lưu thay đổi" : "Thêm nhà CC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA ĐỐI TÁC */}
      {partnerToDelete && (
        <div 
          className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPartnerToDelete(null);
          }}
        >
          <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-6 space-y-4 text-stone-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-100">
                  {partnerToDelete.type === "customer" ? "Xóa khách hàng?" : "Xóa nhà cung cấp?"}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Bạn có chắc chắn muốn xóa <strong className="text-rose-400">"{partnerToDelete.name}"</strong> khỏi hệ thống?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPartnerToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  if (partnerToDelete.type === "customer") {
                    onDeleteCustomer(partnerToDelete.id);
                  } else {
                    onDeleteSupplier(partnerToDelete.id);
                  }
                  setPartnerToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Đồng ý xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
