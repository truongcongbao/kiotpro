import React, { useState, useMemo } from "react";
import { CashbookEntry, Staff, CashShift, Invoice } from "../types";
import { 
  PlusCircle, ArrowUpRight, ArrowDownRight, Wallet, DollarSign, 
  Layers, Filter, Download, Calendar, CheckCircle, RefreshCw, ClipboardList,
  AlertTriangle, Lock, Unlock, Clock, FileText, BarChart3, TrendingUp, AlertCircle
} from "lucide-react";
import { safeDispatchEvent } from "../lib/events";

interface KiotCashbookProps {
  cashbook: CashbookEntry[];
  currentStaff: Staff;
  onAddEntry: (newEntry: CashbookEntry) => void;
  cashShifts?: CashShift[];
  onSaveShifts?: (updatedShifts: CashShift[]) => void;
  invoices?: Invoice[];
}

export default function KiotCashbook({ 
  cashbook, 
  currentStaff, 
  onAddEntry,
  cashShifts = [],
  onSaveShifts = () => {},
  invoices = []
}: KiotCashbookProps) {
  const hasPermission = (perm: "cashbookCreateEntry" | "cashbookDeleteEntry") => {
    if (!currentStaff) return true;
    if (currentStaff.role === "OWNER") return true;
    if (currentStaff.permissions?.[perm] !== undefined) {
      return currentStaff.permissions[perm];
    }
    if (currentStaff.role === "MANAGER") {
      return true;
    }
    return false;
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState("Chi phí vận hành");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [filterMethod, setFilterMethod] = useState<"ALL" | "CASH" | "BANK_TRANSFER">("ALL");

  // Dual tab for cashbook logs or shift management
  const [activeSubTab, setActiveSubTab] = useState<"entries" | "shifts">("entries");

  // Shift Opening & Closing states
  const [initialCashInput, setInitialCashInput] = useState<number>(1000000); // 1.000.000 VND default
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [actualBankInput, setActualBankInput] = useState<number>(0);
  const [shiftNotes, setShiftNotes] = useState<string>("");

  const categories = {
    INCOME: ["Thu nợ khách hàng", "Doanh thu bán hàng", "Doanh thu khác", "Thu hồi tạm ứng"],
    EXPENSE: ["Chi phí vận hành", "Trả tiền NCC", "Lương & Thưởng nhân viên", "Tiền xăng xe / Vận chuyển", "Tiền điện / nước", "Chi phí khác"]
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert("Số tiền phải lớn hơn 0");
      return;
    }
    if (!description.trim()) {
      alert("Vui lòng nhập lý do thu/chi");
      return;
    }

    const newEntry: CashbookEntry = {
      id: `cb-${Date.now()}`,
      entryCode: `SQ${Math.floor(100000 + Math.random() * 900000)}`,
      type: modalType,
      amount,
      category,
      description,
      paymentMethod,
      date: new Date().toISOString(),
      creatorName: currentStaff.name
    };

    onAddEntry(newEntry);
    setShowAddModal(false);
    
    // Reset form
    setAmount(0);
    setDescription("");
    
    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: modalType === "INCOME" ? "Tạo phiếu thu thành công! 🎉" : "Tạo phiếu chi thành công! 💸",
      message: `Đã ghi nhận giao dịch ${newEntry.entryCode} số tiền ${amount.toLocaleString("vi-VN")}đ vào sổ quỹ.`
    });
  };

  // Sổ quỹ calculations
  const totalIncome = cashbook
    .filter(e => e.type === "INCOME")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpense = cashbook
    .filter(e => e.type === "EXPENSE")
    .reduce((sum, e) => sum + e.amount, 0);

  const balance = totalIncome - totalExpense;

  const cashBalance = cashbook
    .reduce((sum, e) => {
      if (e.paymentMethod === "CASH") {
        return sum + (e.type === "INCOME" ? e.amount : -e.amount);
      }
      return sum;
    }, 0);

  const bankBalance = cashbook
    .reduce((sum, e) => {
      if (e.paymentMethod === "BANK_TRANSFER") {
        return sum + (e.type === "INCOME" ? e.amount : -e.amount);
      }
      return sum;
    }, 0);

  const filteredEntries = cashbook.filter(e => {
    const matchesType = filterType === "ALL" || e.type === filterType;
    const matchesMethod = filterMethod === "ALL" || e.paymentMethod === filterMethod;
    return matchesType && matchesMethod;
  });

  // Shift Management Logic
  const activeShift = useMemo(() => {
    return cashShifts.find(s => s.status === "ACTIVE");
  }, [cashShifts]);

  // Calculations for active shift
  const shiftMetrics = useMemo(() => {
    if (!activeShift) return { expectedCash: 0, expectedBank: 0, invoiceCash: 0, invoiceBank: 0, cashIncome: 0, cashExpense: 0, bankIncome: 0, bankExpense: 0 };

    const startTime = new Date(activeShift.startTime);

    // 1. Invoices collected after shift start
    const shiftInvoices = invoices.filter(inv => {
      return inv.status === "COMPLETED" && new Date(inv.date) >= startTime;
    });

    const invoiceCash = shiftInvoices
      .filter(inv => inv.paymentMethod === "CASH")
      .reduce((sum, inv) => sum + inv.totalPayable, 0);

    const invoiceBank = shiftInvoices
      .filter(inv => inv.paymentMethod === "BANK_TRANSFER" || inv.paymentMethod === "CREDIT_CARD")
      .reduce((sum, inv) => sum + inv.totalPayable, 0);

    // 2. Cashbook transactions after shift start
    const shiftCashbook = cashbook.filter(entry => {
      return new Date(entry.date) >= startTime;
    });

    const cashIncome = shiftCashbook
      .filter(e => e.type === "INCOME" && e.paymentMethod === "CASH")
      .reduce((sum, e) => sum + e.amount, 0);

    const cashExpense = shiftCashbook
      .filter(e => e.type === "EXPENSE" && e.paymentMethod === "CASH")
      .reduce((sum, e) => sum + e.amount, 0);

    const bankIncome = shiftCashbook
      .filter(e => e.type === "INCOME" && e.paymentMethod === "BANK_TRANSFER")
      .reduce((sum, e) => sum + e.amount, 0);

    const bankExpense = shiftCashbook
      .filter(e => e.type === "EXPENSE" && e.paymentMethod === "BANK_TRANSFER")
      .reduce((sum, e) => sum + e.amount, 0);

    const expectedCash = activeShift.initialCash + invoiceCash + cashIncome - cashExpense;
    const expectedBank = invoiceBank + bankIncome - bankExpense;

    return {
      expectedCash,
      expectedBank,
      invoiceCash,
      invoiceBank,
      cashIncome,
      cashExpense,
      bankIncome,
      bankExpense
    };
  }, [activeShift, invoices, cashbook]);

  const handleOpenShift = () => {
    if (!hasPermission("cashbookCreateEntry")) {
      safeDispatchEvent("kiot-toast", {
        type: "error",
        title: "TỪ CHỐI TRUY CẬP 🚫",
        message: "Tài khoản của bạn không có quyền mở ca bán hàng!"
      });
      return;
    }
    if (initialCashInput < 0) {
      alert("Số dư đầu ca không thể nhỏ hơn 0");
      return;
    }

    const newShift: CashShift = {
      id: `shift-${Date.now()}`,
      code: `CC${String(cashShifts.length + 1).padStart(6, "0")}`,
      startTime: new Date().toISOString(),
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      initialCash: initialCashInput,
      expectedCash: initialCashInput,
      expectedBank: 0,
      status: "ACTIVE"
    };

    onSaveShifts([newShift, ...cashShifts]);
    
    // Autofill actual count forms with current estimates
    setActualCashInput(initialCashInput);
    setActualBankInput(0);
    setShiftNotes("");

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "Khởi tạo ca thành công! 🔓",
      message: `Ca bán hàng ${newShift.code} hoạt động with số dư tiền lẻ đầu ca là ${initialCashInput.toLocaleString("vi-VN")}đ.`
    });
  };

  const handleCloseActiveShift = () => {
    if (!hasPermission("cashbookCreateEntry")) {
      safeDispatchEvent("kiot-toast", {
        type: "error",
        title: "TỪ CHỐI TRUY CẬP 🚫",
        message: "Tài khoản của bạn không có quyền chốt ca bàn giao!"
      });
      return;
    }
    if (!activeShift) return;

    const confirmClose = confirm("Bạn có chắc chắn muốn CHỐT CA BÁN HÀNG và lưu biên bản bàn giao quỹ?");
    if (!confirmClose) return;

    const updatedShifts = cashShifts.map(s => {
      if (s.id === activeShift.id) {
        return {
          ...s,
          endTime: new Date().toISOString(),
          expectedCash: shiftMetrics.expectedCash,
          expectedBank: shiftMetrics.expectedBank,
          actualCash: actualCashInput,
          actualBank: actualBankInput,
          notes: shiftNotes,
          status: "COMPLETED" as const
        };
      }
      return s;
    });

    onSaveShifts(updatedShifts);

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "Chốt ca & Bàn giao quỹ thành công! 🔐",
      message: `Ca bán hàng ${activeShift.code} đã được chốt và bàn giao két tiền hoàn chỉnh.`
    });
  };

  return (
    <div className="space-y-6" id="kiot-cashbook-tab">
      
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Balance Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Tồn Quỹ Sổ Quỹ</p>
              <h3 className="text-xl font-black text-emerald-400 mt-1">
                {balance.toLocaleString("vi-VN")} <span className="text-xs">đ</span>
              </h3>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-800/80 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-stone-500 block">Tiền mặt:</span>
              <strong className="text-stone-300 font-mono">{cashBalance.toLocaleString("vi-VN")}đ</strong>
            </div>
            <div>
              <span className="text-stone-500 block">Chuyển khoản:</span>
              <strong className="text-stone-300 font-mono">{bankBalance.toLocaleString("vi-VN")}đ</strong>
            </div>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Tổng Thu Sổ Quỹ</p>
              <h3 className="text-xl font-black text-blue-400 mt-1">
                +{totalIncome.toLocaleString("vi-VN")} <span className="text-xs">đ</span>
              </h3>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-800/80">
            <span className="text-[11px] text-stone-500 block">Số phiếu thu: <strong className="text-stone-300 font-mono">{cashbook.filter(e => e.type === "INCOME").length} phiếu</strong></span>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ArrowDownRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Tổng Chi Sổ Quỹ</p>
              <h3 className="text-xl font-black text-rose-400 mt-1">
                -{totalExpense.toLocaleString("vi-VN")} <span className="text-xs">đ</span>
              </h3>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-800/80">
            <span className="text-[11px] text-stone-500 block">Số phiếu chi: <strong className="text-stone-300 font-mono">{cashbook.filter(e => e.type === "EXPENSE").length} phiếu</strong></span>
          </div>
        </div>

        {/* Handover / Active Shift Indicator Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Trạng Thái Két Thu Ngân</span>
              <div className="flex items-center gap-1.5 mt-1">
                {activeShift ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-400 font-mono">{activeShift.code} Đang mở</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-stone-600" />
                    <span className="text-xs font-bold text-stone-500">Đã chốt / Chưa mở ca</span>
                  </>
                )}
              </div>
            </div>
            {activeShift && (
              <span className="text-[9px] font-mono font-bold text-stone-500 flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-500" />
                {new Date(activeShift.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          
          <button
            onClick={() => setActiveSubTab("shifts")}
            className="mt-3 w-full py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {activeShift ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            <span>{activeShift ? "Chốt Ca Bàn Giao" : "Mở Ca / Đối Soát"}</span>
          </button>
        </div>
      </div>

      {/* Main Cashbook Tabs Switcher */}
      <div className="flex border-b border-stone-850 gap-2">
        <button
          onClick={() => setActiveSubTab("entries")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "entries" 
              ? "border-emerald-500 text-emerald-400" 
              : "border-transparent text-stone-500 hover:text-stone-300"
          }`}
        >
          <ClipboardList className="h-4.5 w-4.5" />
          <span>Sổ Quỹ Thu Chi</span>
        </button>
        <button
          onClick={() => {
            setActiveSubTab("shifts");
            if (activeShift) {
              setActualCashInput(shiftMetrics.expectedCash);
              setActualBankInput(shiftMetrics.expectedBank);
            }
          }}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "shifts" 
              ? "border-emerald-500 text-emerald-400" 
              : "border-transparent text-stone-500 hover:text-stone-300"
          }`}
        >
          <RefreshCw className="h-4.5 w-4.5" />
          <span>Chốt Ca &amp; Bàn Giao Quỹ ({cashShifts.length})</span>
        </button>
      </div>

      {/* WORKSPACE CONTENT */}
      {activeSubTab === "entries" && (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-stone-800/80">
            <div>
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-500" />
                <span>Nhật Ký Giao Dịch Dòng Tiền</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">Danh sách các khoản thu và chi phục vụ vận hành cửa hàng, lấy hàng, nợ đối tác và lương nhân viên.</p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                disabled={!hasPermission("cashbookCreateEntry")}
                onClick={() => {
                  setModalType("INCOME");
                  setCategory(categories.INCOME[0]);
                  setShowAddModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 select-none disabled:opacity-40 disabled:cursor-not-allowed"
                title={hasPermission("cashbookCreateEntry") ? "Tạo phiếu thu dòng tiền mới" : "Bạn không có quyền lập phiếu thu"}
              >
                {hasPermission("cashbookCreateEntry") ? <PlusCircle className="h-4 w-4" /> : <Lock className="h-4 w-4 text-stone-850" />}
                <span>Tạo Phiếu Thu</span>
              </button>

              <button
                disabled={!hasPermission("cashbookCreateEntry")}
                onClick={() => {
                  setModalType("EXPENSE");
                  setCategory(categories.EXPENSE[0]);
                  setShowAddModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-500/10 select-none disabled:opacity-40 disabled:cursor-not-allowed"
                title={hasPermission("cashbookCreateEntry") ? "Tạo phiếu chi dòng tiền mới" : "Bạn không có quyền lập phiếu chi"}
              >
                {hasPermission("cashbookCreateEntry") ? <PlusCircle className="h-4 w-4" /> : <Lock className="h-4 w-4 text-stone-850" />}
                <span>Tạo Phiếu Chi</span>
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="flex flex-wrap items-center justify-between gap-3 my-4 p-3 bg-stone-950/60 rounded-xl border border-stone-850">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-400">Lọc nhanh:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by Type */}
              <div className="flex bg-stone-900 border border-stone-800 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setFilterType("ALL")}
                  className={`px-3 py-1 rounded-md transition-all ${filterType === "ALL" ? "bg-stone-850 text-stone-200 font-bold" : "text-stone-500 hover:text-stone-400"}`}
                >
                  Tất cả loại
                </button>
                <button
                  onClick={() => setFilterType("INCOME")}
                  className={`px-3 py-1 rounded-md transition-all ${filterType === "INCOME" ? "bg-emerald-500/10 text-emerald-400 font-bold" : "text-stone-500 hover:text-stone-400"}`}
                >
                  Chỉ Thu
                </button>
                <button
                  onClick={() => setFilterType("EXPENSE")}
                  className={`px-3 py-1 rounded-md transition-all ${filterType === "EXPENSE" ? "bg-rose-500/10 text-rose-400 font-bold" : "text-stone-500 hover:text-stone-400"}`}
                >
                  Chỉ Chi
                </button>
              </div>

              {/* Filter by Method */}
              <div className="flex bg-stone-900 border border-stone-800 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setFilterMethod("ALL")}
                  className={`px-3 py-1 rounded-md transition-all ${filterMethod === "ALL" ? "bg-stone-850 text-stone-200 font-bold" : "text-stone-500 hover:text-stone-400"}`}
                >
                  Tất cả ví
                </button>
                <button
                  onClick={() => setFilterMethod("CASH")}
                  className={`px-3 py-1 rounded-md transition-all ${filterMethod === "CASH" ? "bg-stone-850 text-stone-200 font-bold" : "text-stone-500 hover:text-stone-400"}`}
                >
                  Tiền mặt
                </button>
                <button
                  onClick={() => setFilterMethod("BANK_TRANSFER")}
                  className={`px-3 py-1 rounded-md transition-all ${filterMethod === "BANK_TRANSFER" ? "bg-stone-850 text-stone-200 font-bold" : "text-stone-500 hover:text-stone-400"}`}
                >
                  Chuyển khoản
                </button>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-800/80 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Mã Phiếu</th>
                  <th className="py-3 px-4">Ngày giao dịch</th>
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Khoản mục</th>
                  <th className="py-3 px-4">Lý do thu / chi</th>
                  <th className="py-3 px-4">Giá trị</th>
                  <th className="py-3 px-4">Hình thức</th>
                  <th className="py-3 px-4">Người tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/50 text-stone-300 text-xs">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-stone-500 italic">
                      Chưa có giao dịch thu chi nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-stone-850/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-500">{entry.entryCode}</td>
                      <td className="py-3 px-4 text-stone-400">
                        {new Date(entry.date).toLocaleString("vi-VN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-black ${
                          entry.type === "INCOME" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/10"
                        }`}>
                          {entry.type === "INCOME" ? "THU" : "CHI"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">{entry.category}</td>
                      <td className="py-3 px-4 max-w-[200px] truncate" title={entry.description}>{entry.description}</td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={entry.type === "INCOME" ? "text-emerald-400" : "text-rose-400"}>
                          {entry.type === "INCOME" ? "+" : "-"}
                          {entry.amount.toLocaleString("vi-VN")}đ
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-stone-400">
                          {entry.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-500">{entry.creatorName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "shifts" && (
        <div className="space-y-6">
          
          {/* Active Shift Card or Launcher */}
          {activeShift ? (
            /* ACTIVE SHIFT: RENDER CHỐT CA REPORT FORM */
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Theoretical stats (7/12) */}
              <div className="xl:col-span-7 space-y-4">
                <div className="p-5 rounded-2xl bg-stone-900 border border-stone-850 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-850">
                    <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="h-4.5 w-4.5" />
                      <span>Thông tin ca bán lẻ đang hoạt động</span>
                    </h3>
                    <span className="font-mono text-xs font-bold text-stone-400 bg-stone-950 px-2 py-1 rounded border border-stone-850">{activeShift.code}</span>
                  </div>

                  {/* Operational stats list */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-stone-950 rounded-xl border border-stone-850 space-y-1">
                      <span className="text-stone-500 block text-[9px] uppercase tracking-wider">Nhân viên trực</span>
                      <strong className="text-stone-300 block">{activeShift.staffName}</strong>
                    </div>
                    <div className="p-3.5 bg-stone-950 rounded-xl border border-stone-850 space-y-1">
                      <span className="text-stone-500 block text-[9px] uppercase tracking-wider">Thời gian mở ca</span>
                      <strong className="text-stone-300 block font-mono">{new Date(activeShift.startTime).toLocaleString("vi-VN")}</strong>
                    </div>
                  </div>

                  {/* Calculations Details Card */}
                  <div className="p-4 bg-stone-950 rounded-2xl border border-stone-850 space-y-3 text-xs">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Báo cáo dòng tiền lý thuyết trong ca:</span>
                    
                    <div className="space-y-2">
                      {/* Tiền mặt đầu ca */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Tiền lẻ bàn giao đầu ca (A):</span>
                        <span className="font-mono text-stone-300">{activeShift.initialCash.toLocaleString("vi-VN")}đ</span>
                      </div>
                      
                      {/* Bán hàng tiền mặt */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Bán hàng thu Tiền Mặt (B):</span>
                        <span className="font-mono text-emerald-400">+{shiftMetrics.invoiceCash.toLocaleString("vi-VN")}đ</span>
                      </div>

                      {/* Thu sổ quỹ */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Thu Sổ Quỹ (CASH) (C):</span>
                        <span className="font-mono text-emerald-400">+{shiftMetrics.cashIncome.toLocaleString("vi-VN")}đ</span>
                      </div>

                      {/* Chi sổ quỹ */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Chi Sổ Quỹ (CASH) (D):</span>
                        <span className="font-mono text-rose-400">-{shiftMetrics.cashExpense.toLocaleString("vi-VN")}đ</span>
                      </div>

                      <div className="h-px bg-stone-900 my-1" />

                      {/* Tiền mặt lý thuyết */}
                      <div className="flex justify-between items-center text-stone-200 font-bold bg-stone-900 p-2 rounded-lg">
                        <span>Tồn Tiền Mặt Lý Thuyết (A+B+C-D):</span>
                        <span className="font-mono text-emerald-400 text-sm font-black">{shiftMetrics.expectedCash.toLocaleString("vi-VN")}đ</span>
                      </div>
                    </div>

                    <div className="h-px bg-stone-850 my-2" />

                    <div className="space-y-2">
                      {/* Doanh số chuyển khoản */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Doanh số Chuyển Khoản (E):</span>
                        <span className="font-mono text-stone-300">+{shiftMetrics.invoiceBank.toLocaleString("vi-VN")}đ</span>
                      </div>

                      {/* Thu sổ quỹ bank */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Thu Sổ Quỹ (BANK) (F):</span>
                        <span className="font-mono text-stone-300">+{shiftMetrics.bankIncome.toLocaleString("vi-VN")}đ</span>
                      </div>

                      {/* Chi sổ quỹ bank */}
                      <div className="flex justify-between items-center text-stone-400">
                        <span>Chi Sổ Quỹ (BANK) (G):</span>
                        <span className="font-mono text-rose-400">-{shiftMetrics.bankExpense.toLocaleString("vi-VN")}đ</span>
                      </div>

                      <div className="h-px bg-stone-900 my-1" />

                      {/* Chuyển khoản lý thuyết */}
                      <div className="flex justify-between items-center text-stone-200 font-bold bg-stone-900 p-2 rounded-lg">
                        <span>Chuyển Khoản Lý Thuyết (E+F-G):</span>
                        <span className="font-mono text-amber-500 text-sm font-black">{shiftMetrics.expectedBank.toLocaleString("vi-VN")}đ</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Physical check input (5/12) */}
              <div className="xl:col-span-5 space-y-4">
                <div className="p-5 rounded-2xl bg-stone-900 border border-stone-850 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle className="h-4.5 w-4.5" />
                    <span>Đối soát thực tế két tiền</span>
                  </h3>

                  {/* Actual Cash count field */}
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tổng tiền mặt thực tế đếm được cuối ca *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
                      <input
                        type="number"
                        value={actualCashInput}
                        onChange={(e) => setActualCashInput(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                        placeholder="Số tiền mặt trong ngăn kéo..."
                      />
                    </div>
                    {/* Discrepancy indicator */}
                    {(() => {
                      const diff = actualCashInput - shiftMetrics.expectedCash;
                      if (diff === 0) {
                        return <span className="text-[10px] text-stone-500 font-bold block">Khớp tiền mặt tuyệt đối (0đ)</span>;
                      } else if (diff > 0) {
                        return <span className="text-[10px] text-emerald-400 font-bold block">Thừa tiền mặt: +{diff.toLocaleString("vi-VN")}đ (Thừa so với hệ thống)</span>;
                      } else {
                        return <span className="text-[10px] text-rose-400 font-bold block animate-pulse">Thiếu hụt tiền mặt: {diff.toLocaleString("vi-VN")}đ (Hao hụt két tiền!)</span>;
                      }
                    })()}
                  </div>

                  {/* Actual Bank count field */}
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tổng số tiền tài khoản thực tế (Đối chiếu app ngân hàng) *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
                      <input
                        type="number"
                        value={actualBankInput}
                        onChange={(e) => setActualBankInput(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                        placeholder="Số tiền hiển thị trên biến động số dư ngân hàng..."
                      />
                    </div>
                    {/* Discrepancy indicator */}
                    {(() => {
                      const diff = actualBankInput - shiftMetrics.expectedBank;
                      if (diff === 0) {
                        return <span className="text-[10px] text-stone-500 font-bold block">Khớp tiền chuyển khoản tuyệt đối (0đ)</span>;
                      } else if (diff > 0) {
                        return <span className="text-[10px] text-emerald-400 font-bold block">Thừa chuyển khoản: +{diff.toLocaleString("vi-VN")}đ</span>;
                      } else {
                        return <span className="text-[10px] text-rose-400 font-bold block">Thiếu chuyển khoản: {diff.toLocaleString("vi-VN")}đ (Sai lệch báo có!)</span>;
                      }
                    })()}
                  </div>

                  {/* Shift closure notes */}
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Ghi chú khi bàn giao ca</label>
                    <textarea
                      rows={2}
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                      placeholder="VD: Bàn giao két 5 tờ 200k, 10 tờ 50k. Thừa 10k thối dư khách tặng..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Completion CTAs */}
                  <button
                    disabled={!hasPermission("cashbookCreateEntry")}
                    type="button"
                    onClick={handleCloseActiveShift}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 select-none disabled:opacity-40 disabled:cursor-not-allowed"
                    title={hasPermission("cashbookCreateEntry") ? "Hoàn tất chốt ca bàn giao quỹ" : "Bạn không có quyền chốt ca"}
                  >
                    <Lock className="h-4.5 w-4.5" />
                    <span>Hoàn Tất Chốt Ca &amp; Bàn Giao Quỹ</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* NO ACTIVE SHIFT: RENDER SHIFT OPEN FORM */
            <div className="p-8 max-w-md mx-auto rounded-3xl bg-stone-900 border border-stone-800 space-y-5 shadow-2xl">
              <div className="text-center space-y-1.5">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
                  <Unlock className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">Mở ca bán hàng mới</h3>
                <p className="text-xs text-stone-500">Két tiền bán lẻ đang trống. Vui lòng khai báo số tiền mặt thối lẻ trong két để bắt đầu phiên làm việc.</p>
              </div>

              {/* Input for initial cash */}
              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tiền lẻ bàn giao đầu ca (Tiền mặt trong két)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-2.5 h-4 w-4 text-stone-500" />
                  <input
                    type="number"
                    value={initialCashInput}
                    onChange={(e) => setInitialCashInput(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                    placeholder="Nhập số tiền..."
                  />
                  <span className="absolute right-4 top-2.5 text-stone-500 font-bold font-mono">đ</span>
                </div>
              </div>

              <button
                disabled={!hasPermission("cashbookCreateEntry")}
                type="button"
                onClick={handleOpenShift}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 select-none disabled:opacity-40 disabled:cursor-not-allowed"
                title={hasPermission("cashbookCreateEntry") ? "Bắt đầu ca bán hàng mới" : "Bạn không có quyền bắt đầu ca"}
              >
                <Unlock className="h-4 w-4" />
                <span>Bắt Đầu Phiên Ca Mới</span>
              </button>
            </div>
          )}

          {/* Historic Completed Shifts List */}
          <div className="mt-8 space-y-4">
            <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-stone-500" />
              <span>Biên bản chốt ca lịch sử ({cashShifts.filter(s => s.status === "COMPLETED").length})</span>
            </h3>

            {cashShifts.filter(s => s.status === "COMPLETED").length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-stone-900/50 border border-stone-850 text-stone-600 italic text-xs">
                Chưa có biên bản bàn giao chốt ca lịch sử nào được ghi nhận.
              </div>
            ) : (
              <div className="space-y-3.5">
                {cashShifts.filter(s => s.status === "COMPLETED").map(shift => {
                  const cashDiff = (shift.actualCash || 0) - shift.expectedCash;
                  const bankDiff = (shift.actualBank || 0) - shift.expectedBank;
                  
                  return (
                    <div key={shift.id} className="p-4 rounded-xl bg-stone-900 border border-stone-850 space-y-3 hover:border-stone-800 transition-all text-xs">
                      
                      {/* Shift Header */}
                      <div className="flex justify-between items-center border-b border-stone-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4.5 w-4.5 text-amber-500" />
                          <span className="font-mono font-black text-stone-200">{shift.code}</span>
                          <span className="px-2 py-0.5 rounded bg-stone-950 text-stone-400 text-[9px] font-bold border border-stone-850">Đã chốt két</span>
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono font-bold flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(shift.startTime).toLocaleString("vi-VN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            &rarr;
                            {shift.endTime ? new Date(shift.endTime).toLocaleString("vi-VN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Shift detail stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9px] uppercase tracking-wide">Nhân viên ca trực</span>
                          <span className="text-stone-300 font-bold">{shift.staffName}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9px] uppercase tracking-wide">Tiền mặt đầu ca</span>
                          <span className="text-stone-300 font-mono font-bold">{shift.initialCash.toLocaleString("vi-VN")}đ</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9px] uppercase tracking-wide">Tiền mặt (Lý thuyết / Thực tế)</span>
                          <span className="text-stone-300 font-mono font-bold">
                            {shift.expectedCash.toLocaleString("vi-VN")}đ / {(shift.actualCash || 0).toLocaleString("vi-VN")}đ
                            <span className={`block text-[9.5px] font-bold ${cashDiff === 0 ? "text-stone-500" : cashDiff > 0 ? "text-emerald-400" : "text-rose-400 font-black animate-pulse"}`}>
                              {cashDiff === 0 ? "Khớp két" : cashDiff > 0 ? `Thừa +${cashDiff.toLocaleString("vi-VN")}đ` : `Hụt ${cashDiff.toLocaleString("vi-VN")}đ`}
                            </span>
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9px] uppercase tracking-wide">Ngân hàng (Lý thuyết / Thực tế)</span>
                          <span className="text-stone-300 font-mono font-bold">
                            {shift.expectedBank.toLocaleString("vi-VN")}đ / {(shift.actualBank || 0).toLocaleString("vi-VN")}đ
                            <span className={`block text-[9.5px] font-bold ${bankDiff === 0 ? "text-stone-500" : bankDiff > 0 ? "text-emerald-400" : "text-rose-400 font-black"}`}>
                              {bankDiff === 0 ? "Khớp ngân hàng" : bankDiff > 0 ? `Thừa +${bankDiff.toLocaleString("vi-VN")}đ` : `Hụt ${bankDiff.toLocaleString("vi-VN")}đ`}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Shift Notes if any */}
                      {shift.notes && (
                        <div className="p-2.5 bg-stone-950 rounded-lg border border-stone-850/80 text-[11px] text-stone-400 italic">
                          <strong>Ghi chú:</strong> {shift.notes}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* Create Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-scale-in">
            <h3 className="text-base font-black text-stone-100 flex items-center gap-2 pb-4 border-b border-stone-800">
              <PlusCircle className={`h-5 w-5 ${modalType === "INCOME" ? "text-emerald-400" : "text-rose-400"}`} />
              <span>{modalType === "INCOME" ? "Tạo Phiếu Thu Sổ Quỹ" : "Tạo Phiếu Chi Sổ Quỹ"}</span>
            </h3>

            <form onSubmit={handleAddTransaction} className="mt-4 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Số tiền giao dịch (VND)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    placeholder="Nhập số tiền..."
                  />
                  <span className="absolute right-4 top-2.5 text-stone-500 font-bold">đ</span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Loại / Khoản mục</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-200 focus:outline-none focus:border-emerald-500 text-xs"
                >
                  {(modalType === "INCOME" ? categories.INCOME : categories.EXPENSE).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Phương thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      paymentMethod === "CASH" 
                        ? "bg-stone-800 border-emerald-500/50 text-stone-100" 
                        : "bg-stone-950 border-stone-800 text-stone-500"
                    }`}
                  >
                    Tiền mặt (Két)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("BANK_TRANSFER")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      paymentMethod === "BANK_TRANSFER" 
                        ? "bg-stone-800 border-emerald-500/50 text-stone-100" 
                        : "bg-stone-950 border-stone-800 text-stone-500"
                    }`}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Lý do thu / chi</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2 text-stone-200 text-xs focus:outline-none focus:border-emerald-500"
                  placeholder="Ghi rõ nội dung lý do thu hoặc chi để đối chứng..."
                />
              </div>

              {/* Creator Name (Readonly preview) */}
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Người lập phiếu</label>
                <input
                  type="text"
                  disabled
                  value={currentStaff.name}
                  className="w-full bg-stone-900 border border-stone-850 rounded-xl px-4 py-2 text-stone-500 text-xs"
                />
              </div>

              {/* Submit / Cancel CTAs */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl text-stone-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                    modalType === "INCOME" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
                  }`}
                >
                  Lưu giao dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
