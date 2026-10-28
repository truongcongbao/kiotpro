import React, { useState } from "react";
import { 
  Sparkles, Search, Calendar, Phone, Mail, MapPin, FileText, CheckCircle, 
  XCircle, Trash2, Clock, ShieldCheck, Heart, User, RefreshCw, Layers, Plus,
  Eye, EyeOff, Lock, ShoppingCart, Package, Users, Wallet, LayoutDashboard, Bot, FileSpreadsheet,
  ChevronDown, ChevronUp, Check
} from "lucide-react";
import { TrialRegistration, StoreFeatureFlags, COUNTRY_CODES, isModuleEnabled } from "../types";

const safeFormatInputDate = (dateStr: string): string => {
  try {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch (e) {
    return "";
  }
};

const safeFormatLocalDate = (dateStr: string): string => {
  try {
    if (!dateStr) return "Chưa rõ";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa rõ";
    return d.toLocaleDateString("vi-VN");
  } catch (e) {
    return "Chưa rõ";
  }
};

interface KiotTrialsManagerProps {
  trials: TrialRegistration[];
  onUpdateTrialStatus: (id: string, status: "TRIAL_ACTIVE" | "EXPIRED" | "CONVERTED") => Promise<void>;
  onExtendTrial: (id: string, days: number) => Promise<void>;
  onSetTrialExpirationDate: (id: string, dateStr: string) => Promise<void>;
  onDeleteTrial: (id: string) => Promise<void>;
  onUpdateTrialPassword: (id: string, newPassword: string) => Promise<void>;
  onUpdateTrialAllowedModules?: (id: string, allowedModules: StoreFeatureFlags) => Promise<void>;
  onResetDatabase?: () => void;
  onCreateTrial?: (newTrial: Omit<TrialRegistration, 'id' | 'createdAt'>) => Promise<void>;
}

export default function KiotTrialsManager({
  trials,
  onUpdateTrialStatus,
  onExtendTrial,
  onSetTrialExpirationDate,
  onDeleteTrial,
  onUpdateTrialPassword,
  onUpdateTrialAllowedModules,
  onResetDatabase,
  onCreateTrial
}: KiotTrialsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<("TRIAL_ACTIVE" | "EXPIRED" | "CONVERTED")[]>(["TRIAL_ACTIVE", "EXPIRED", "CONVERTED"]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingPasswordTrialId, setEditingPasswordTrialId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [confirmingDeleteTrialId, setConfirmingDeleteTrialId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Store Feature Modal state
  const [selectedFeatureTrial, setSelectedFeatureTrial] = useState<TrialRegistration | null>(null);
  const [featureForm, setFeatureForm] = useState<StoreFeatureFlags>({});
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    pos: true,
    products: true,
    partners: false,
    cashbook: false,
    reports: false,
    einvoice: false,
    aiAssistant: false,
  });

  const parseModState = (val: any, defaultSubs: Record<string, boolean>) => {
    if (val === false) {
      const disabledSubs: Record<string, boolean> = { enabled: false };
      Object.keys(defaultSubs).forEach(k => { disabledSubs[k] = false; });
      return disabledSubs;
    }
    if (val === true || val === undefined || val === null) {
      return { enabled: true, ...defaultSubs };
    }
    if (typeof val === "object") {
      return {
        enabled: val.enabled !== false,
        ...defaultSubs,
        ...val
      };
    }
    return { enabled: true, ...defaultSubs };
  };

  const openFeatureModal = (trial: TrialRegistration) => {
    setSelectedFeatureTrial(trial);
    const current = trial.allowedModules || {};
    setFeatureForm({
      pos: parseModState(current.pos, { allowDiscount: true, allowPriceEdit: true, allowReturn: true, allowCancelInvoice: true }),
      products: parseModState(current.products, { allowCreateEdit: true, allowViewCostPrice: true, allowStockAudit: true, allowPurchaseOrder: true }),
      partners: parseModState(current.partners, { allowCreateEdit: true, allowViewDebt: true, allowDebtPayment: true }),
      cashbook: parseModState(current.cashbook, { allowCreateReceipt: true, allowViewBalance: true }),
      reports: parseModState(current.reports, { allowViewRevenue: true, allowViewProfit: true }),
      einvoice: parseModState(current.einvoice, { allowExport: true }),
      aiAssistant: parseModState(current.aiAssistant, { allowChat: true }),
    });
  };

  const getEnabledCount = (trial: TrialRegistration) => {
    const flags = trial.allowedModules || {};
    let c = 0;
    if (isModuleEnabled(flags.pos)) c++;
    if (isModuleEnabled(flags.products)) c++;
    if (isModuleEnabled(flags.partners)) c++;
    if (isModuleEnabled(flags.cashbook)) c++;
    if (isModuleEnabled(flags.reports)) c++;
    if (isModuleEnabled(flags.einvoice)) c++;
    if (isModuleEnabled(flags.aiAssistant)) c++;
    return c;
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    shopName: "",
    ownerName: "",
    phoneRegion: "",
    phone: "",
    email: "",
    shopType: "F&B (Nhà hàng / Cafe)",
    password: "demo" + Math.floor(100 + Math.random() * 900),
    days: 20
  });
  const [isCreating, setIsCreating] = useState(false);

  // Real-time warnings for manual creation form
  const [localPhoneWarning, setLocalPhoneWarning] = useState<string | null>(null);
  const [localEmailWarning, setLocalEmailWarning] = useState<string | null>(null);

  // Real-time phone check
  React.useEffect(() => {
    const phone = createForm.phone.trim();
    if (!phone) {
      setLocalPhoneWarning(null);
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");

    const config = COUNTRY_CODES.find(c => c.code === createForm.phoneRegion);
    if (config) {
      const { lengths, name, dialCode } = config;
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      
      if (cleanPhone.length > 0) {
        if (lengths.length === 1) {
          const expected = lengths[0];
          if (cleanPhone.length !== expected) {
            const diff = cleanPhone.length - expected;
            setLocalPhoneWarning(`⚠️ SĐT ${name} (${dialCode}) bắt buộc phải có đúng ${expected} chữ số (Bạn nhập ${cleanPhone.length} số, đang ${diff > 0 ? `dư ${diff}` : `thiếu ${Math.abs(diff)}`} số).`);
            return;
          }
        } else {
          if (cleanPhone.length < minLen || cleanPhone.length > maxLen) {
            setLocalPhoneWarning(`⚠️ SĐT ${name} (${dialCode}) phải có từ ${minLen} đến ${maxLen} chữ số (Bạn nhập ${cleanPhone.length} số).`);
            return;
          }
        }
      }

      if (createForm.phoneRegion === "VN" && phone.length > 0 && !phone.startsWith("0")) {
        setLocalPhoneWarning("⚠️ SĐT Việt Nam (+84) phải bắt đầu bằng chữ số 0 (Ví dụ: 0901234567).");
        return;
      }
    }

    // Duplicate check
    const isPhoneExisted = trials.some(t => {
      const dPhoneClean = (t.phone || "").replace(/\D/g, "");
      return (dPhoneClean === cleanPhone && cleanPhone.length > 0) || t.phone === phone;
    });

    if (isPhoneExisted) {
      setLocalPhoneWarning(`⚠️ Số điện thoại "${phone}" đã được đăng ký dùng thử trước đó! Vui lòng chọn số khác.`);
    } else {
      setLocalPhoneWarning(null);
    }
  }, [createForm.phone, createForm.phoneRegion, trials]);

  // Real-time email check
  React.useEffect(() => {
    const email = createForm.email.trim().toLowerCase();
    if (!email) {
      setLocalEmailWarning(null);
      return;
    }

    if (email === "congbaotruong8@gmail.com") {
      setLocalEmailWarning("⚠️ Email 'congbaotruong8@gmail.com' là tài khoản quản trị viên / chủ hệ thống KiotX! Không thể đăng ký dùng thử.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalEmailWarning("⚠️ Định dạng email không hợp lệ (Ví dụ: khachhang@gmail.com).");
      return;
    }

    const isExisted = trials.some(t => t.email.trim().toLowerCase() === email);
    if (isExisted) {
      setLocalEmailWarning(`⚠️ Email/Gmail "${createForm.email}" này đã được đăng ký trước đó trên hệ thống! Vui lòng sử dụng email khác.`);
    } else {
      setLocalEmailWarning(null);
    }
  }, [createForm.email, trials]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateTrial) return;

    if (localEmailWarning) {
      alert(localEmailWarning);
      return;
    }
    if (localPhoneWarning) {
      alert(localPhoneWarning);
      return;
    }
    
    if (!createForm.shopName || !createForm.ownerName || !createForm.phone) {
      alert("Vui lòng điền đầy đủ các thông tin bắt buộc: Tên cửa hàng, Chủ cửa hàng, Số điện thoại.");
      return;
    }

    // 1. Check if phone region is selected
    if (!createForm.phoneRegion) {
      alert("Lỗi: Bạn chưa chọn Khu vực/Quốc gia cho số điện thoại! Vui lòng chọn khu vực thích hợp (Ví dụ: Việt Nam (+84)).");
      return;
    }

    // 2. Validate phone format based on region
    const cleanPhone = createForm.phone.replace(/\D/g, ""); // extract only digits
    const config = COUNTRY_CODES.find(c => c.code === createForm.phoneRegion);
    if (config) {
      const { lengths, name, dialCode } = config;
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      
      if (lengths.length === 1) {
        const expected = lengths[0];
        if (cleanPhone.length !== expected) {
          const diff = cleanPhone.length - expected;
          alert(`Lỗi định dạng SĐT: Số điện thoại ${name} (${dialCode}) bắt buộc phải có đúng ${expected} chữ số! Bạn đang nhập ${cleanPhone.length} số (bị ${diff > 0 ? `thừa/dư ${diff}` : `thiếu ${Math.abs(diff)}`} chữ số). Vui lòng nhập chính xác ${expected} chữ số.`);
          return;
        }
      } else {
        if (cleanPhone.length < minLen || cleanPhone.length > maxLen) {
          alert(`Lỗi định dạng SĐT: Số điện thoại ${name} (${dialCode}) phải có từ ${minLen} đến ${maxLen} chữ số! Bạn đang nhập ${cleanPhone.length} số.`);
          return;
        }
      }

      if (createForm.phoneRegion === "VN" && !createForm.phone.trim().startsWith("0")) {
        alert("Lỗi định dạng SĐT: Số điện thoại Việt Nam (+84) phải bắt đầu bằng chữ số 0 (Ví dụ: 0901234567).");
        return;
      }
    }

    // 3. Determine the final email to be registered
    const finalEmail = (createForm.email || `${cleanPhone}@kiotx.vn`).trim().toLowerCase();

    // 4. Block owner's email from being used as a trial
    if (finalEmail === "congbaotruong8@gmail.com") {
      alert(`Lỗi tạo: Không thể dùng email chủ sở hữu hệ thống "congbaotruong8@gmail.com" để đăng ký tài khoản dùng thử!`);
      return;
    }

    // 5. Check if email already registered in existing trials list
    const isExisted = trials.some(t => t.email.trim().toLowerCase() === finalEmail);
    if (isExisted) {
      alert(`Lỗi tạo: Địa chỉ Email/Gmail "${finalEmail}" này đã được sử dụng đăng ký trước đó trên hệ thống! Vui lòng sử dụng địa chỉ email khác hoặc số điện thoại khác.`);
      return;
    }

    // 6. Check if phone already registered in existing trials list (both exact and clean digits)
    const isPhoneExisted = trials.some(t => {
      const dPhoneClean = (t.phone || "").replace(/\D/g, "");
      return (dPhoneClean === cleanPhone && cleanPhone.length > 0) || t.phone === createForm.phone.trim();
    });
    if (isPhoneExisted) {
      alert(`Lỗi tạo: Số điện thoại "${createForm.phone}" này đã được đăng ký dùng thử trước đó trên hệ thống! Vui lòng sử dụng số điện thoại khác.`);
      return;
    }

    setIsCreating(true);
    try {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + createForm.days);
      
      await onCreateTrial({
        shopName: createForm.shopName,
        ownerName: createForm.ownerName,
        phone: createForm.phone,
        email: finalEmail,
        password: createForm.password,
        expireDate: expireDate.toISOString(),
        status: "TRIAL_ACTIVE",
        address: "Chưa cập nhật",
        notes: `Ngành hàng: ${createForm.shopType}`
      });

      // Reset form
      setCreateForm({
        shopName: "",
        ownerName: "",
        phoneRegion: "",
        phone: "",
        email: "",
        shopType: "F&B (Nhà hàng / Cafe)",
        password: "demo" + Math.floor(100 + Math.random() * 900),
        days: 20
      });
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Statistics calculation
  const totalCount = trials.length;
  const activeCount = trials.filter(t => t.status === "TRIAL_ACTIVE").length;
  const expiredCount = trials.filter(t => t.status === "EXPIRED").length;
  const convertedCount = trials.filter(t => t.status === "CONVERTED").length;

  // Filtered list
  const filteredTrials = trials.filter(t => {
    const matchesSearch = 
      t.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone.includes(searchQuery) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch && selectedStatuses.includes(t.status as any);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "TRIAL_ACTIVE":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Đang dùng thử</span>
          </span>
        );
      case "EXPIRED":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            <span>Hết hạn dùng thử</span>
          </span>
        );
      case "CONVERTED":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span>Đã mua bản quyền</span>
          </span>
        );
      default:
        return null;
    }
  };

  const calculateDaysLeft = (expireDateStr: string) => {
    try {
      if (!expireDateStr) return 0;
      const t = new Date(expireDateStr).getTime();
      if (isNaN(t)) return 0;
      const diffTime = t - Date.now();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return 0;
    }
  };

  const handleAction = async (id: string, actionFn: () => Promise<void>) => {
    setActionLoadingId(id);
    try {
      await actionFn();
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-850 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-wider text-stone-100 flex items-center gap-2">
              Quản Lý Cửa Hàng & Dùng Thử
            </h1>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Hệ thống phân phối và theo dõi các nhà hàng đăng ký dùng thử KiotX trong 20 ngày. Bạn có thể gia hạn hoặc tạm khóa.
          </p>
        </div>

        {/* OWNER BADGE */}
        <div className="px-4 py-2 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center gap-3 self-start sm:self-auto shadow-md">
          <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xs text-white">
            CB
          </div>
          <div className="text-left">
            <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider block leading-none">Chủ phần mềm</span>
            <span className="text-xs font-bold text-stone-200">Trương Công Bảo</span>
          </div>
        </div>
      </div>

      {/* STATS BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STAT 1: TOTAL */}
        <div className="bg-stone-900/40 border border-stone-850/80 p-4 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-stone-800 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Tổng số đăng ký</span>
            <span className="text-2xl font-black text-stone-100 font-mono leading-none block">{totalCount}</span>
            <span className="text-[10px] text-stone-400 block">Nhà hàng / Quán ăn</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-stone-950 flex items-center justify-center text-stone-400 border border-stone-850 group-hover:text-indigo-400 transition-all">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* STAT 2: ACTIVE */}
        <div className="bg-stone-900/40 border border-stone-850/80 p-4 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/20 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider block flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              Đang hoạt động
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono leading-none block">{activeCount}</span>
            <span className="text-[10px] text-stone-400 block">Trong thời gian 20 ngày</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-stone-950 flex items-center justify-center text-emerald-500 border border-stone-850/40">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* STAT 3: EXPIRED */}
        <div className="bg-stone-900/40 border border-stone-850/80 p-4 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-rose-500/20 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Đã hết hạn</span>
            <span className="text-2xl font-black text-rose-400 font-mono leading-none block">{expiredCount}</span>
            <span className="text-[10px] text-stone-400 block">Cần gia hạn hoặc nâng cấp</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-stone-950 flex items-center justify-center text-rose-500 border border-stone-850/40">
            <XCircle className="h-5 w-5" />
          </div>
        </div>

        {/* STAT 4: CONVERTED */}
        <div className="bg-stone-900/40 border border-stone-850/80 p-4 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-indigo-500/20 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Đã mua bản quyền</span>
            <span className="text-2xl font-black text-indigo-400 font-mono leading-none block">{convertedCount}</span>
            <span className="text-[10px] text-stone-400 block">Khách hàng chính thức</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-stone-950 flex items-center justify-center text-indigo-400 border border-stone-850/40">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-stone-950/40 border border-stone-850/80">
        {/* Search & Manual Creation Button */}
        <div className="w-full lg:max-w-xl flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
            <input
              type="text"
              placeholder="Tìm kiếm tên quán, số điện thoại, người đại diện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-xs focus:outline-none focus:border-indigo-500 placeholder-stone-500 transition-all font-sans font-medium"
            />
          </div>
          {onCreateTrial && (
            <button
              onClick={() => {
                setCreateForm(prev => ({
                  ...prev,
                  password: "demo" + Math.floor(100 + Math.random() * 900)
                }));
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-stone-100 font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-lg shadow-indigo-500/15"
            >
              <Plus className="h-4 w-4 text-stone-100" />
              <span>Tạo khách thủ công</span>
            </button>
          )}
        </div>

        {/* Tabs Filter (Multiple Selection) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Lọc trạng thái (chọn nhiều):</span>
          <div className="flex flex-wrap gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-850">
            {[
              { key: "TRIAL_ACTIVE", label: `Dùng thử (${activeCount})` },
              { key: "EXPIRED", label: `Đã hết hạn (${expiredCount})` },
              { key: "CONVERTED", label: `Mua bản quyền (${convertedCount})` }
            ].map(btn => {
              const isSelected = selectedStatuses.includes(btn.key as any);
              return (
                <button
                  key={btn.key}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedStatuses(selectedStatuses.filter(s => s !== btn.key) as any);
                    } else {
                      setSelectedStatuses([...selectedStatuses, btn.key as any]);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md font-black"
                      : "bg-stone-900/40 border-stone-850 text-stone-400 hover:text-stone-200 hover:bg-stone-900/80"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    isSelected ? "bg-white" : "bg-stone-600"
                  }`} />
                  {btn.label}
                </button>
              );
            })}
            
            <button
              onClick={() => setSelectedStatuses(["TRIAL_ACTIVE", "EXPIRED", "CONVERTED"])}
              className="px-2.5 py-1.5 text-[10px] font-black uppercase text-stone-400 hover:text-stone-250 cursor-pointer transition-all hover:bg-stone-900/50 rounded-lg"
            >
              Chọn tất cả
            </button>
            <button
              onClick={() => setSelectedStatuses([])}
              className="px-2.5 py-1.5 text-[10px] font-black uppercase text-stone-500 hover:text-stone-400 cursor-pointer transition-all hover:bg-stone-900/50 rounded-lg"
            >
              Xóa lọc
            </button>
          </div>
        </div>
      </div>

      {/* TABLE STATS CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Shops */}
        <div className="bg-stone-900/30 border border-stone-850 p-4 rounded-xl flex items-center justify-between relative overflow-hidden group hover:border-indigo-500/20 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tổng số cửa hàng</span>
            <span className="text-xl font-black text-stone-100 font-mono leading-none block">{totalCount}</span>
            <span className="text-[9px] text-stone-500 block">Hệ thống SaaS KiotX</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-stone-950 flex items-center justify-center text-indigo-400 border border-stone-850">
            <Layers className="h-4 w-4" />
          </div>
        </div>

        {/* Card 2: TRIAL_ACTIVE */}
        <div className="bg-stone-900/30 border border-stone-850 p-4 rounded-xl flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/20 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Đang hoạt động (Trial Active)
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono leading-none block">{activeCount}</span>
            <span className="text-[9px] text-stone-500 block">Truy cập đầy đủ tính năng</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-stone-950 flex items-center justify-center text-emerald-500 border border-stone-850/50">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        {/* Card 3: EXPIRED */}
        <div className="bg-stone-900/30 border border-stone-850 p-4 rounded-xl flex items-center justify-between relative overflow-hidden group hover:border-rose-500/20 transition-all">
          <div className="space-y-1">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Đã hết hạn (Expired)</span>
            <span className="text-xl font-black text-rose-400 font-mono leading-none block">{expiredCount}</span>
            <span className="text-[9px] text-stone-500 block">Yêu cầu gia hạn thêm ngày</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-stone-950 flex items-center justify-center text-rose-500 border border-stone-850/50">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* REGISTRATION LIST TABLE */}
      <div className="bg-stone-900/20 border border-stone-850 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-850 bg-stone-950/40 text-[10px] text-stone-400 font-black uppercase tracking-wider">
                <th className="py-4 px-4 sm:px-6">Thông tin cửa hàng</th>
                <th className="py-4 px-4">Người đại diện</th>
                <th className="py-4 px-4">Mật khẩu</th>
                <th className="py-4 px-4">Ngày đăng ký / hết hạn</th>
                <th className="py-4 px-4">Hạn dùng thử</th>
                <th className="py-4 px-4 text-center">Trạng thái</th>
                <th className="py-4 px-4 sm:px-6 text-right">Thao tác quản trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-850/60 text-xs text-stone-300">
              {filteredTrials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500 font-sans font-medium">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Layers className="h-8 w-8 mx-auto text-stone-600 opacity-60 animate-bounce" />
                      <p className="text-xs">Không tìm thấy yêu cầu dùng thử nào phù hợp.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrials.map(trial => {
                  const daysLeft = calculateDaysLeft(trial.expireDate);
                  const isExpired = trial.status === "EXPIRED" || daysLeft <= 0;

                  return (
                    <tr key={trial.id} className="hover:bg-stone-950/20 transition-all">
                      {/* Shop Info */}
                      <td className="py-4 px-4 sm:px-6 space-y-1">
                        <div className="font-extrabold text-stone-200 text-sm flex items-center gap-2">
                          <span>{trial.shopName}</span>
                          <button
                            onClick={() => openFeatureModal(trial)}
                            className="px-2 py-0.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                            title="Nhấp để cấp hoặc giới hạn từng tính năng cho cửa hàng này"
                          >
                            <Lock className="h-3 w-3 text-indigo-400" />
                            <span>Quyền ({getEnabledCount(trial)}/7)</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-stone-400 text-[11px]">
                          <MapPin className="h-3 w-3 shrink-0 text-stone-500" />
                          <span>{trial.address || "Chưa cung cấp địa chỉ"}</span>
                        </div>
                        {trial.notes && (
                          <div className="text-[10px] text-indigo-400 italic bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 w-fit">
                            Ghi chú: {trial.notes}
                          </div>
                        )}
                      </td>

                      {/* Rep Person */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="font-bold text-stone-200 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-stone-500" />
                          <span>{trial.ownerName}</span>
                        </div>
                        <div className="space-y-0.5 font-mono text-[11px] text-stone-400">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-stone-500" />
                            <span>{trial.phone}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-stone-500" />
                            <span>{trial.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Mật khẩu */}
                      <td className="py-4 px-4 font-mono text-xs text-stone-300">
                        {editingPasswordTrialId === trial.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newPasswordValue}
                              onChange={(e) => setNewPasswordValue(e.target.value)}
                              className="bg-stone-950 border border-stone-800 text-amber-400 font-bold px-2 py-1 rounded text-[11px] w-28 focus:outline-none focus:border-amber-500 font-mono"
                              placeholder="Mật khẩu mới"
                              autoFocus
                            />
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={async () => {
                                if (!newPasswordValue.trim()) {
                                  alert("Mật khẩu không được để trống!");
                                  return;
                                }
                                setActionLoadingId(trial.id);
                                try {
                                  await onUpdateTrialPassword(trial.id, newPasswordValue.trim());
                                  setEditingPasswordTrialId(null);
                                } catch (e) {}
                                setActionLoadingId(null);
                              }}
                              className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded text-[10px] font-sans font-bold uppercase transition-all cursor-pointer"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingPasswordTrialId(null)}
                              className="px-2 py-1 bg-stone-800 hover:bg-stone-750 text-stone-400 rounded text-[10px] font-sans font-bold uppercase transition-all cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-stone-950 border border-stone-800 px-2 py-1 rounded-xl text-amber-400 font-bold text-[11px] select-all cursor-help flex items-center min-w-[70px] justify-center tracking-wider" title="Nhấp đúp chuột để sao chép">
                              {visiblePasswords[trial.id] ? (trial.password || "(Trống)") : "••••••"}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(trial.id)}
                              className="p-1.5 hover:bg-stone-850 rounded-lg text-stone-400 hover:text-stone-250 transition-all cursor-pointer flex items-center justify-center border border-stone-850 bg-stone-950/40"
                              title={visiblePasswords[trial.id] ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                            >
                              {visiblePasswords[trial.id] ? (
                                <EyeOff className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <Eye className="h-3.5 w-3.5 shrink-0" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPasswordTrialId(trial.id);
                                setNewPasswordValue(trial.password || "");
                              }}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-sans font-bold underline cursor-pointer hover:no-underline ml-1"
                            >
                              Đổi
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Reg / Exp Dates */}
                      <td className="py-4 px-4 space-y-1.5 font-mono text-[11px] text-stone-400">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-stone-500 font-sans font-extrabold uppercase">Tạo:</span>
                          <span>{safeFormatLocalDate(trial.createdAt)}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] text-amber-500 font-sans font-extrabold uppercase">Hết hạn:</span>
                          <div className="flex items-center gap-1.5 bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-amber-500/50 rounded-xl px-2 py-1 transition-all w-fit cursor-pointer group shadow-inner">
                            <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                            <input 
                              type="date"
                              value={safeFormatInputDate(trial.expireDate)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAction(trial.id, () => onSetTrialExpirationDate(trial.id, e.target.value));
                                }
                              }}
                              className="bg-transparent text-stone-200 text-xs font-mono outline-none cursor-pointer w-28 [color-scheme:dark] select-none"
                              title="Nhấp vào để chọn ngày hết hạn tùy ý bằng lịch"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Days remaining badge */}
                      <td className="py-4 px-4 font-sans">
                        {trial.status === "CONVERTED" ? (
                          <span className="text-[11px] text-indigo-400 font-black flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            <span>Vĩnh viễn</span>
                          </span>
                        ) : trial.status === "EXPIRED" || daysLeft <= 0 ? (
                          <span className="text-[11px] text-rose-400 font-black flex items-center gap-1">
                            <span>Quá hạn</span>
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-black">
                              <span className="text-sm font-black text-emerald-400 font-mono">{daysLeft}</span>
                              <span className="text-[10px] text-stone-400 font-medium">ngày còn lại</span>
                            </div>
                            <div className="w-20 bg-stone-900 rounded-full h-1 overflow-hidden border border-stone-800">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${Math.min(100, (daysLeft / 20) * 100)}%` }} 
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          <select
                            value={trial.status}
                            disabled={actionLoadingId !== null}
                            onChange={(e) => {
                              const newStatus = e.target.value as "TRIAL_ACTIVE" | "EXPIRED" | "CONVERTED";
                              handleAction(trial.id, () => onUpdateTrialStatus(trial.id, newStatus));
                            }}
                            className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border cursor-pointer outline-none transition-all [color-scheme:dark] select-none ${
                              trial.status === "TRIAL_ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                : trial.status === "EXPIRED"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20"
                            }`}
                            title="Nhấp để thay đổi trạng thái đăng ký"
                          >
                            <option value="TRIAL_ACTIVE" className="bg-stone-950 text-emerald-400 font-black uppercase">
                              Đang dùng thử
                            </option>
                            <option value="EXPIRED" className="bg-stone-950 text-rose-400 font-black uppercase">
                              Hết hạn
                            </option>
                            <option value="CONVERTED" className="bg-stone-950 text-indigo-400 font-black uppercase">
                              Đã mua bản quyền
                            </option>
                          </select>
                        </div>
                      </td>

                      {/* Administrative Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                           {/* EXTEND BUTTONS */}
                           <div className="flex items-center gap-1.5">
                             <button
                               disabled={actionLoadingId !== null}
                               onClick={() => handleAction(trial.id, () => onExtendTrial(trial.id, 30))}
                               className="px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all flex items-center gap-1"
                               title="Gia hạn dùng thử thêm 30 ngày"
                             >
                               <Calendar className="h-3 w-3" />
                               <span>+30 Ngày</span>
                             </button>
                             <button
                               disabled={actionLoadingId !== null}
                               onClick={() => handleAction(trial.id, async () => {
                                 await onExtendTrial(trial.id, 365);
                                 if (trial.status !== "CONVERTED") {
                                   await onUpdateTrialStatus(trial.id, "CONVERTED");
                                 }
                               })}
                               className="px-2 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all flex items-center gap-1"
                               title="Gia hạn hoặc Mua bản quyền thêm 365 ngày (1 Năm)"
                             >
                               <Sparkles className="h-3 w-3 text-indigo-400" />
                               <span>+365 Ngày</span>
                             </button>
                           </div>

                          {/* ACTIVATE / DEACTIVATE BUTTONS */}
                          {trial.status !== "EXPIRED" && (
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={() => handleAction(trial.id, () => onUpdateTrialStatus(trial.id, "EXPIRED"))}
                              className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all"
                              title="Khóa dùng thử của cửa hàng"
                            >
                              Khóa dùng
                            </button>
                          )}

                          {trial.status === "EXPIRED" && (
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={() => handleAction(trial.id, () => onUpdateTrialStatus(trial.id, "TRIAL_ACTIVE"))}
                              className="px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all"
                              title="Kích hoạt lại tài khoản dùng thử"
                            >
                              Mở khóa
                            </button>
                          )}


                          {/* DELETE REQUEST */}
                          {confirmingDeleteTrialId === trial.id ? (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-1 rounded-lg animate-pulse">
                              <span className="text-[9px] text-rose-400 font-bold uppercase px-1">Xác nhận xóa?</span>
                              <button
                                disabled={actionLoadingId !== null}
                                onClick={() => handleAction(trial.id, async () => {
                                  await onDeleteTrial(trial.id);
                                  setConfirmingDeleteTrialId(null);
                                })}
                                className="px-1.5 py-0.5 bg-rose-500 text-stone-950 hover:bg-rose-400 rounded text-[9px] font-sans font-bold uppercase transition-all cursor-pointer"
                              >
                                Có
                              </button>
                              <button
                                onClick={() => setConfirmingDeleteTrialId(null)}
                                className="px-1.5 py-0.5 bg-stone-800 text-stone-400 hover:bg-stone-700 rounded text-[9px] font-sans font-bold uppercase transition-all cursor-pointer"
                              >
                                Không
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={() => setConfirmingDeleteTrialId(trial.id)}
                              className="p-1.5 text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-rose-500/10"
                              title="Xóa vĩnh viễn thông tin đăng ký"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CẤU HÌNH BẢO MẬT & PHÁT TRIỂN NÂNG CAO (SUPER ADMIN) */}
      {onResetDatabase && (
        <div className="mt-8 p-5 rounded-2xl bg-stone-900 border border-stone-850 hover:border-red-500/20 transition-all space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-32 w-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-850 pb-3">
            <div className="space-y-1">
              <h3 className="text-xs font-black text-stone-100 flex items-center gap-2 uppercase tracking-wider">
                <Trash2 className="h-4 w-4 text-rose-500" />
                <span>Cấu hình Bảo mật & Phát triển nâng cao (Super Admin)</span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Khu vực an toàn dành riêng cho Nhà phát triển và Quản trị viên cấp cao nhất để dọn dẹp hoặc cài đặt lại hệ thống.
              </p>
            </div>
            <span className="text-[10px] text-rose-400 bg-rose-500/10 font-black px-2 py-1 rounded-lg border border-rose-500/15 uppercase tracking-widest self-start sm:self-auto flex items-center gap-1">
              <span>Bảo mật cấp cao</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-950/60 p-4 rounded-xl border border-stone-850/60">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-stone-200">Đặt lại toàn bộ Cơ sở dữ liệu (Reset DB)</h4>
              <p className="text-[11px] text-stone-400 max-w-xl">
                Hành động này sẽ xóa trắng toàn bộ dữ liệu giao dịch hiện có (hóa đơn, sản phẩm tự thêm, dòng tiền) và khôi phục lại kho dữ liệu demo chuẩn ban đầu của hệ thống KiotX.
              </p>
            </div>

            {showResetConfirm ? (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 p-2 rounded-xl shrink-0">
                <span className="text-[10px] text-rose-400 font-black uppercase px-1">Bạn có CHẮC CHẮN không?</span>
                <button
                  onClick={() => {
                    onResetDatabase();
                    setShowResetConfirm(false);
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-stone-950 font-bold uppercase rounded-lg text-[10px] transition-all cursor-pointer"
                >
                  Xác nhận Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold uppercase rounded-lg text-[10px] transition-all cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2 bg-stone-900 hover:bg-red-950/40 text-stone-400 hover:text-red-400 border border-stone-800 hover:border-red-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
              >
                Reset Database
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL TẠO KHÁCH THỦ CÔNG */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-6 shadow-[0_0_50px_rgba(99,102,241,0.15)] relative overflow-hidden animate-scaleUp">
            {/* Background glowing */}
            <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-stone-850 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-black text-stone-100 flex items-center gap-2 uppercase tracking-wider">
                  <User className="h-4.5 w-4.5 text-indigo-400" />
                  <span>Tạo Khách Hàng Thủ Công (SaaS)</span>
                </h3>
                <p className="text-[10px] text-stone-400">
                  Cấp tài khoản dùng thử KiotX tức thì cho khách hàng mới của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tên cửa hàng */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Tên cửa hàng <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Cà Phê Minh Anh, Shop Thời Trang KiotX"
                    value={createForm.shopName}
                    onChange={e => setCreateForm(prev => ({ ...prev, shopName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                {/* Tên chủ cửa hàng */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Tên chủ cửa hàng <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={createForm.ownerName}
                    onChange={e => setCreateForm(prev => ({ ...prev, ownerName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                {/* Số điện thoại */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Khu vực & Số điện thoại <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={createForm.phoneRegion}
                      onChange={e => setCreateForm(prev => ({ ...prev, phoneRegion: e.target.value }))}
                      className={`w-[110px] shrink-0 px-2 py-2 bg-stone-950 border rounded-xl text-xs text-stone-200 focus:outline-none focus:border-indigo-500 cursor-pointer font-bold ${
                        !createForm.phoneRegion ? "border-amber-500/50 text-amber-400 bg-amber-500/5" : "border-stone-800"
                      }`}
                    >
                      <option value="">-- Quốc gia --</option>
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} ({c.dialCode})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      placeholder={
                        (() => {
                          const config = COUNTRY_CODES.find(c => c.code === createForm.phoneRegion);
                          return config ? `${config.name}: ${config.placeholder}` : "Nhập số điện thoại";
                        })()
                      }
                      value={createForm.phone}
                      onChange={e => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                      className={`flex-1 px-3 py-2 bg-stone-950 border rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-mono font-medium ${
                        localPhoneWarning ? "border-rose-500/80 text-rose-200 bg-rose-500/5" : "border-stone-800"
                      }`}
                    />
                  </div>
                  {localPhoneWarning && (
                    <span className="text-[11px] text-rose-400 font-medium block leading-normal mt-1 animate-pulse">
                      {localPhoneWarning}
                    </span>
                  )}
                  {!createForm.phoneRegion && (
                    <span className="text-[9px] text-amber-500 font-semibold block leading-tight mt-0.5">
                      ⚠ Bắt buộc chọn Khu vực trước khi nhập SĐT
                    </span>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Email liên hệ (Không bắt buộc)</label>
                  <input
                    type="email"
                    placeholder="Ví dụ: khachhang@gmail.com"
                    value={createForm.email}
                    onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-3 py-2 bg-stone-950 border rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-medium ${
                      localEmailWarning ? "border-rose-500/80 text-rose-200 bg-rose-500/5" : "border-stone-800"
                    }`}
                  />
                  {localEmailWarning && (
                    <span className="text-[11px] text-rose-400 font-medium block leading-normal mt-1 animate-pulse">
                      {localEmailWarning}
                    </span>
                  )}
                </div>

                {/* Lĩnh vực kinh doanh */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Ngành hàng kinh doanh</label>
                  <select
                    value={createForm.shopType}
                    onChange={e => setCreateForm(prev => ({ ...prev, shopType: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  >
                    <option value="F&B (Nhà hàng / Cafe)">F&B (Nhà hàng / Cafe)</option>
                    <option value="Tạp hóa / Siêu thị mini">Tạp hóa / Siêu thị mini</option>
                    <option value="Thời trang / Mỹ phẩm">Thời trang / Mỹ phẩm</option>
                    <option value="Nhà thuốc / Y tế">Nhà thuốc / Y tế</option>
                    <option value="Vật liệu xây dựng / Nội thất">Vật liệu xây dựng / Nội thất</option>
                    <option value="Lĩnh vực kinh doanh khác">Lĩnh vực kinh doanh khác</option>
                  </select>
                </div>

                {/* Mật khẩu truy cập */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Mật khẩu Demo mặc định</label>
                  <input
                    type="text"
                    required
                    placeholder="demo123"
                    value={createForm.password}
                    onChange={e => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-mono font-medium"
                  />
                </div>

                {/* Thời gian dùng thử */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider block">Số ngày cấp phép dùng thử</label>
                  <select
                    value={createForm.days}
                    onChange={e => setCreateForm(prev => ({ ...prev, days: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  >
                    <option value={7}>Dùng thử 7 Ngày</option>
                    <option value={15}>Dùng thử 15 Ngày</option>
                    <option value={20}>Mặc định hệ thống KiotX (20 Ngày)</option>
                    <option value={30}>Dùng thử nâng cao (30 Ngày)</option>
                    <option value={90}>Dùng thử VIP (90 Ngày)</option>
                    <option value={365}>Dùng thử 1 Năm (365 Ngày)</option>
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 border-t border-stone-850 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold uppercase rounded-xl text-[11px] transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase rounded-xl text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Xác nhận cấp demo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STORE FEATURE PERMISSIONS MODAL */}
      {selectedFeatureTrial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 max-w-2xl w-full space-y-4 shadow-2xl relative overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-850 pb-3.5 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-black uppercase text-stone-100 tracking-wide">
                    Phân Quyền Tính Năng Cửa Hàng (SaaS)
                  </h3>
                </div>
                <p className="text-xs text-stone-400">
                  Cửa hàng: <strong className="text-stone-200 font-bold">{selectedFeatureTrial.shopName}</strong> ({selectedFeatureTrial.ownerName} - {selectedFeatureTrial.phone})
                </p>
              </div>
              <button
                onClick={() => setSelectedFeatureTrial(null)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-all cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Presets Bar */}
            <div className="space-y-1.5 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                Cấu hình nhanh gói quyền mẫu:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFeatureForm({
                    pos: { enabled: true, allowDiscount: true, allowPriceEdit: true, allowReturn: true, allowCancelInvoice: true },
                    products: { enabled: true, allowCreateEdit: true, allowViewCostPrice: true, allowStockAudit: true, allowPurchaseOrder: true },
                    partners: { enabled: true, allowCreateEdit: true, allowViewDebt: true, allowDebtPayment: true },
                    cashbook: { enabled: true, allowCreateReceipt: true, allowViewBalance: true },
                    reports: { enabled: true, allowViewRevenue: true, allowViewProfit: true },
                    einvoice: { enabled: true, allowExport: true },
                    aiAssistant: { enabled: true, allowChat: true },
                  })}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                >
                  🌟 Gói Toàn Năng (7/7 Quyền)
                </button>
                <button
                  type="button"
                  onClick={() => setFeatureForm({
                    pos: { enabled: true, allowDiscount: true, allowPriceEdit: false, allowReturn: true, allowCancelInvoice: false },
                    products: { enabled: true, allowCreateEdit: true, allowViewCostPrice: false, allowStockAudit: false, allowPurchaseOrder: true },
                    partners: { enabled: true, allowCreateEdit: true, allowViewDebt: true, allowDebtPayment: true },
                    cashbook: { enabled: true, allowCreateReceipt: true, allowViewBalance: false },
                    reports: { enabled: true, allowViewRevenue: true, allowViewProfit: false },
                    einvoice: { enabled: false, allowExport: false },
                    aiAssistant: { enabled: true, allowChat: true },
                  })}
                  className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                >
                  🏪 Cửa Hàng Bán Lẻ / Siêu Thị
                </button>
                <button
                  type="button"
                  onClick={() => setFeatureForm({
                    pos: { enabled: true, allowDiscount: true, allowPriceEdit: false, allowReturn: false, allowCancelInvoice: false },
                    products: { enabled: true, allowCreateEdit: false, allowViewCostPrice: false, allowStockAudit: false, allowPurchaseOrder: false },
                    partners: { enabled: false, allowCreateEdit: false, allowViewDebt: false, allowDebtPayment: false },
                    cashbook: { enabled: false, allowCreateReceipt: false, allowViewBalance: false },
                    reports: { enabled: false, allowViewRevenue: false, allowViewProfit: false },
                    einvoice: { enabled: false, allowExport: false },
                    aiAssistant: { enabled: false, allowChat: false },
                  })}
                  className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                >
                  🔒 Thu Ngân Cơ Bản (Chỉ POS)
                </button>
              </div>
            </div>

            {/* Major Modules & Sub-Permissions Nested Accordion / Cards List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 custom-scrollbar">
              {[
                {
                  key: "pos",
                  title: "1. Quầy Bán Hàng & Thu Ngân (POS)",
                  desc: "Mở ca bán hàng, chọn món, tính tiền, in hóa đơn & thanh toán QR",
                  icon: ShoppingCart,
                  subs: [
                    { key: "allowDiscount", label: "Giảm giá / Chiết khấu đơn hàng", desc: "Cho phép áp dụng giảm giá tiền mặt hoặc % khi tính tiền" },
                    { key: "allowPriceEdit", label: "Chỉnh sửa đơn giá trực tiếp", desc: "Cho phép thay đổi đơn giá bán của mặt hàng tại màn hình POS" },
                    { key: "allowReturn", label: "Trả hàng & Đổi hàng", desc: "Cho phép nhận trả lại hàng và hoàn tiền cho khách" },
                    { key: "allowCancelInvoice", label: "Hủy hóa đơn bán hàng", desc: "Cho phép thực hiện hủy hóa đơn bán thành công" },
                  ]
                },
                {
                  key: "products",
                  title: "2. Quản Lý Hàng Hóa & Kho Bãi",
                  desc: "Danh mục sản phẩm, bảng giá, kho bãi, kiểm kê & nhập hàng",
                  icon: Package,
                  subs: [
                    { key: "allowCreateEdit", label: "Thêm / Sửa / Xóa sản phẩm", desc: "Cho phép cập nhật thông tin tên, mã SKU, thuộc tính sản phẩm" },
                    { key: "allowViewCostPrice", label: "Xem giá vốn hàng bán", desc: "Cho phép hiển thị thông tin giá vốn & biên lợi nhuận" },
                    { key: "allowStockAudit", label: "Kiểm kho & Điều chỉnh tồn kho", desc: "Cho phép tạo phiếu kiểm kê thực tế và cân bằng tồn kho" },
                    { key: "allowPurchaseOrder", label: "Nhập hàng từ nhà cung cấp", desc: "Cho phép lập đơn nhập kho và ghi nhận nợ NCC" },
                  ]
                },
                {
                  key: "partners",
                  title: "3. Khách Hàng & Đối Tác (NCC)",
                  desc: "Quản lý dữ liệu thông tin đối tác, nhóm khách & theo dõi công nợ",
                  icon: Users,
                  subs: [
                    { key: "allowCreateEdit", label: "Thêm / Sửa thông tin đối tác", desc: "Cho phép thêm mới hoặc cập nhật hồ sơ khách hàng, NCC" },
                    { key: "allowViewDebt", label: "Xem sổ công nợ đối tác", desc: "Cho phép xem chi tiết dư nợ phải thu & nợ phải trả" },
                    { key: "allowDebtPayment", label: "Thanh toán & Thu nợ đối tác", desc: "Cho phép lập phiếu thu nợ khách hoặc trả nợ NCC" },
                  ]
                },
                {
                  key: "cashbook",
                  title: "4. Sổ Quỹ & Dòng Tiền Thu Chi",
                  desc: "Sổ quỹ tiền mặt, tài khoản ngân hàng & quản lý phiếu thu chi",
                  icon: Wallet,
                  subs: [
                    { key: "allowCreateReceipt", label: "Tạo phiếu thu / phiếu chi", desc: "Cho phép lập các chứng từ thu chi ngoài bán hàng" },
                    { key: "allowViewBalance", label: "Xem tổng số dư quỹ", desc: "Cho phép xem tổng tiền mặt tồn quỹ & số dư ngân hàng" },
                  ]
                },
                {
                  key: "reports",
                  title: "5. Báo Cáo & Phân Tích Kinh Doanh",
                  desc: "Biểu đồ tổng quan doanh thu, giá vốn, lợi nhuận & tình hình bán hàng",
                  icon: LayoutDashboard,
                  subs: [
                    { key: "allowViewRevenue", label: "Xem báo cáo doanh thu", desc: "Cho phép xem tổng doanh thu bán hàng theo thời gian" },
                    { key: "allowViewProfit", label: "Xem báo cáo lợi nhuận & giá vốn", desc: "Cho phép xem báo cáo lãi lỗ thực tế của cửa hàng" },
                  ]
                },
                {
                  key: "einvoice",
                  title: "6. Hóa Đơn Điện Tử (MISA / Viettel)",
                  desc: "Tích hợp kết nối & phát hành hóa đơn điện tử tự động",
                  icon: FileSpreadsheet,
                  subs: [
                    { key: "allowExport", label: "Phát hành & Xuất HĐĐT", desc: "Cho phép ký và truyền dữ liệu hóa đơn điện tử" },
                  ]
                },
                {
                  key: "aiAssistant",
                  title: "7. Trợ Lý Trí Tuệ Nhân Tạo (AI KiotX)",
                  desc: "Chatbot AI phân tích doanh số, xu hướng & tư vấn vận hành",
                  icon: Bot,
                  subs: [
                    { key: "allowChat", label: "Trò chuyện & Hỏi đáp với AI", desc: "Cho phép gửi câu hỏi tra cứu dữ liệu & phân tích báo cáo" },
                  ]
                },
              ].map(mod => {
                const Icon = mod.icon;
                const modVal: any = featureForm[mod.key as keyof StoreFeatureFlags] || {};
                const isModEnabled = typeof modVal === "boolean" ? modVal : modVal.enabled !== false;
                const isExpanded = expandedModules[mod.key] ?? false;

                const toggleMaster = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setFeatureForm(prev => {
                    const currentObj: any = prev[mod.key as keyof StoreFeatureFlags] || {};
                    const newStatus = !isModEnabled;
                    if (typeof currentObj === "object") {
                      const updated = { ...currentObj, enabled: newStatus };
                      mod.subs.forEach(s => { updated[s.key] = newStatus; });
                      return { ...prev, [mod.key]: updated };
                    } else {
                      const updated: any = { enabled: newStatus };
                      mod.subs.forEach(s => { updated[s.key] = newStatus; });
                      return { ...prev, [mod.key]: updated };
                    }
                  });
                };

                const toggleSub = (subKey: string) => {
                  setFeatureForm(prev => {
                    const currentObj: any = typeof prev[mod.key as keyof StoreFeatureFlags] === "object"
                      ? { ...prev[mod.key as keyof StoreFeatureFlags] }
                      : { enabled: true };

                    currentObj[subKey] = !(currentObj[subKey] ?? true);
                    return { ...prev, [mod.key]: currentObj };
                  });
                };

                // Count active sub permissions
                const activeSubsCount = mod.subs.filter(s => {
                  if (!isModEnabled) return false;
                  if (typeof modVal === "boolean") return modVal;
                  return modVal[s.key] !== false;
                }).length;

                return (
                  <div
                    key={mod.key}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isModEnabled
                        ? "bg-stone-950/80 border-indigo-500/30"
                        : "bg-stone-950/40 border-stone-850/60 opacity-70"
                    }`}
                  >
                    {/* Major Module Header */}
                    <div
                      onClick={() => setExpandedModules(prev => ({ ...prev, [mod.key]: !isExpanded }))}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-stone-850/40 transition-all select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isModEnabled ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-stone-900 text-stone-600 border border-stone-800"
                        }`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-stone-100 uppercase tracking-wide">{mod.title}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full uppercase ${
                              isModEnabled ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" : "bg-stone-850 text-stone-500"
                            }`}>
                              {isModEnabled ? `${activeSubsCount}/${mod.subs.length} quyền nhỏ` : "Đã khóa hết"}
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-400 block">{mod.desc}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Master Enable/Disable Toggle */}
                        <button
                          type="button"
                          onClick={toggleMaster}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                            isModEnabled
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                              : "bg-stone-800 text-stone-500 border border-stone-750 hover:bg-stone-750"
                          }`}
                        >
                          {isModEnabled ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span>Đang Mở</span>
                            </>
                          ) : (
                            <span>Đã Khóa</span>
                          )}
                        </button>

                        <div className="text-stone-500 hover:text-stone-300 p-1">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Sub-permissions Grid (Rendered when expanded) */}
                    {isExpanded && (
                      <div className="bg-stone-900/90 border-t border-stone-850 p-3 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between px-1">
                          <span>Chi tiết tính năng nhỏ (Sub-permissions):</span>
                          {!isModEnabled && <span className="text-rose-400 italic font-normal">* Cần mở quyền lớn để bật tính năng nhỏ</span>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {mod.subs.map(sub => {
                            const isSubEnabled = isModEnabled && (typeof modVal === "boolean" ? modVal : modVal[sub.key] !== false);

                            return (
                              <div
                                key={sub.key}
                                onClick={() => {
                                  if (!isModEnabled) return;
                                  toggleSub(sub.key);
                                }}
                                className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 select-none ${
                                  !isModEnabled
                                    ? "bg-stone-950/30 border-stone-850/40 opacity-40 cursor-not-allowed"
                                    : isSubEnabled
                                    ? "bg-indigo-950/20 border-indigo-500/20 text-stone-200 cursor-pointer hover:bg-indigo-900/20"
                                    : "bg-stone-950/60 border-stone-800/60 text-stone-500 cursor-pointer hover:bg-stone-850/50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={!isModEnabled}
                                  checked={isSubEnabled}
                                  onChange={() => {}}
                                  className="mt-0.5 h-3.5 w-3.5 accent-indigo-500 shrink-0 cursor-pointer"
                                />
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <span className={`text-[11px] font-bold block truncate ${
                                    isSubEnabled ? "text-stone-200" : "text-stone-400"
                                  }`}>
                                    {sub.label}
                                  </span>
                                  <span className="text-[9.5px] text-stone-400 leading-tight block line-clamp-2">
                                    {sub.desc}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 border-t border-stone-850 pt-3.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedFeatureTrial(null)}
                className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold uppercase rounded-xl text-[11px] transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSavingFeatures}
                onClick={async () => {
                  if (!selectedFeatureTrial) return;
                  setIsSavingFeatures(true);
                  try {
                    if (onUpdateTrialAllowedModules) {
                      await onUpdateTrialAllowedModules(selectedFeatureTrial.id, featureForm);
                    }
                    setSelectedFeatureTrial(null);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsSavingFeatures(false);
                  }
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase rounded-xl text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isSavingFeatures ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Cập Nhật Phân Quyền Chi Tiết</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
