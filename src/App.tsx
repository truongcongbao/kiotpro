import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Product, Category, Customer, Supplier, Invoice, Staff, ShopSetting, InventoryAudit, PurchaseOrder, CashbookEntry, Project, CashShift, SystemAuditLog, TrialRegistration, StoreFeatureFlags, isModuleEnabled 
} from "./types";
import { 
  DEFAULT_PRODUCTS, DEFAULT_CATEGORIES, DEFAULT_CUSTOMERS, 
  DEFAULT_SUPPLIERS, DEFAULT_INVOICES, DEFAULT_STAFF, 
  DEFAULT_SETTINGS, DEFAULT_AUDITS, DEFAULT_PURCHASE_ORDERS,
  DEFAULT_CASHBOOK, DEFAULT_PROJECTS, DEFAULT_SYSTEM_LOGS
} from "./data/kiotDefaults";
import { db, auth, googleAuthProvider, safeSetDoc, safeDeleteDoc } from "./lib/firebase";
import { safeDispatchEvent } from "./lib/events";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import KiotDashboard from "./components/KiotDashboard";
import KiotPOS from "./components/KiotPOS";
import KiotProducts from "./components/KiotProducts";
import KiotPartners from "./components/KiotPartners";
import KiotSettings from "./components/KiotSettings";
import KiotLogin from "./components/KiotLogin";
import KiotRestrictedView from "./components/KiotRestrictedView";
import KiotCashbook from "./components/KiotCashbook";
import KiotTrialsManager from "./components/KiotTrialsManager";
import TrialExtensionModal from "./components/TrialExtensionModal";
import Chatbox from "./components/Chatbox";
import ToastContainer from "./components/ToastContainer";
import { 
  Activity, LayoutDashboard, ShoppingCart, Package, Users, Settings, 
  Bot, Clock, Moon, Sun, RefreshCw, LogOut, ShieldCheck, Heart,
  Wifi, WifiOff, Wallet, Briefcase, Lock, Menu, ChevronLeft, ChevronRight, Sparkles,
  XCircle, Mail, User
} from "lucide-react";

function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key);
    if (value) {
      return JSON.parse(value) as T;
    }
  } catch (error) {
    console.warn(`Error parsing localStorage key "${key}":`, error);
    try {
      localStorage.setItem(key, JSON.stringify(defaultValue));
    } catch (_) {}
  }
  return defaultValue;
}

const formatVNDate = (isoStr?: string) => {
  if (!isoStr) return "Chưa xác định";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch (e) {
    return isoStr;
  }
};

export default function App() {
  // 1. Tab & Theme navigation
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [liveTime, setLiveTime] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("kiot_is_sidebar_open");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem("kiot_is_sidebar_open", String(next));
      return next;
    });
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Keep track of deleted trial IDs to prevent synchronization feedback loops
  const deletedTrialIdsRef = useRef<Set<string>>(new Set());

  // Staff Logged-In State (simulated or via Firebase Google Auth)
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(() => {
    try {
      const local = localStorage.getItem("kiot_current_staff");
      if (local) {
        const parsed = JSON.parse(local) as Staff;
        if (parsed.email?.toLowerCase() === "congbaotruong8@gmail.com") {
          parsed.role = "OWNER";
        }
        return parsed;
      }
      return null;
    } catch (e) {
      console.warn("Failed to parse current staff, resetting:", e);
      localStorage.removeItem("kiot_current_staff");
      return null;
    }
  });

  // Offline & Synchronization States
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    const saved = localStorage.getItem("kiot_is_online");
    return saved !== null ? saved === "true" : (typeof window !== "undefined" ? window.navigator.onLine : true);
  });
  const [isRealOnline, setIsRealOnline] = useState<boolean>(() => {
    return typeof window !== "undefined" ? window.navigator.onLine : true;
  });
  const [isManualOffline, setIsManualOffline] = useState<boolean>(() => {
    return localStorage.getItem("kiot_manual_offline") === "true";
  });
  const [offlineQueue, setOfflineQueue] = useState<Invoice[]>(() => {
    return safeGetLocalStorage<Invoice[]>("kiot_offline_queue", []);
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(isSyncing);
  isSyncingRef.current = isSyncing;

  // Background cloud database connection check state
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const isSyncingAllRef = useRef(isSyncingAll);
  isSyncingAllRef.current = isSyncingAll;
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem("kiot_last_sync_time") || "";
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("kiot_auto_sync_enabled");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem("kiot_auto_sync_enabled", String(enabled));
  };

  // Checksum / Integrity validation state
  const [integrityStatus, setIntegrityStatus] = useState<{
    lastChecked: string;
    hasDiscrepancy: boolean;
    discrepancyCount: number;
    details: string[];
  }>(() => {
    return {
      lastChecked: localStorage.getItem("kiot_last_integrity_check") || "",
      hasDiscrepancy: false,
      discrepancyCount: 0,
      details: []
    };
  });

  const runChecksumValidation = useCallback((silent = true) => {
    try {
      const offlineRaw = localStorage.getItem("kiot_offline_queue");
      const offlineInvs: Invoice[] = offlineRaw ? JSON.parse(offlineRaw) : [];

      const serverInvsRaw = localStorage.getItem("kiot_server_invoices");
      const serverInvs: Invoice[] = serverInvsRaw ? JSON.parse(serverInvsRaw) : [];
      
      const serverMap = new Map<string, Invoice>();
      serverInvs.forEach(inv => {
        if (inv.invoiceCode) {
          serverMap.set(inv.invoiceCode, inv);
        }
        serverMap.set(inv.id, inv);
      });

      const discrepancies: string[] = [];

      for (const offlineInv of offlineInvs) {
        const match = serverMap.get(offlineInv.invoiceCode || "") || serverMap.get(offlineInv.id);
        if (match) {
          const totalOffline = offlineInv.totalPayable || 0;
          const totalServer = match.totalPayable || 0;
          const totalDiff = Math.abs(totalOffline - totalServer) > 0.1;
          const itemsDiff = (offlineInv.items?.length || 0) !== (match.items?.length || 0);
          const paymentDiff = offlineInv.paymentMethod !== match.paymentMethod;

          if (totalDiff || itemsDiff || paymentDiff) {
            discrepancies.push(
              `Hóa đơn ${offlineInv.invoiceCode || offlineInv.id.substring(0, 8)} bị lệch dữ liệu (Tổng tiền/Sản phẩm/Phương thức không khớp giữa offline và server).`
            );
          } else {
            discrepancies.push(
              `Hóa đơn ${offlineInv.invoiceCode || offlineInv.id.substring(0, 8)} đã có trên Server nhưng vẫn nằm trong hàng đợi offline.`
            );
          }
        }
      }

      const timestamp = new Date().toISOString();
      const hasDiff = discrepancies.length > 0;

      localStorage.setItem("kiot_last_integrity_check", timestamp);

      setIntegrityStatus({
        lastChecked: timestamp,
        hasDiscrepancy: hasDiff,
        discrepancyCount: discrepancies.length,
        details: discrepancies
      });

      if (hasDiff) {
        safeDispatchEvent("kiot-toast", {
          type: "stock-warning",
          title: "Cảnh báo toàn vẹn dữ liệu ⚠️",
          message: `Hệ thống phát hiện ${discrepancies.length} hóa đơn bị chênh lệch hoặc trùng lặp giữa hàng đợi offline và server. Vui lòng kiểm tra lại!`
        });
      } else if (!silent) {
        safeDispatchEvent("kiot-toast", {
          type: "success",
          title: "Dữ liệu hoàn toàn khớp! 🎉",
          message: "Tính toàn vẹn dữ liệu được đảm bảo. Không phát hiện chênh lệch giữa hàng đợi offline và server."
        });
      }
      return hasDiff;
    } catch (err) {
      console.error("Error running checksum validation:", err);
      return false;
    }
  }, []);

  // Integrity Check interval timer: every 5 minutes (300,000ms)
  useEffect(() => {
    // Run an initial check shortly after app starts (e.g., 5 seconds)
    const initialTimeout = setTimeout(() => {
      runChecksumValidation(true);
    }, 5000);

    const interval = setInterval(() => {
      console.log("[Integrity Check] Running scheduled 5-minute checksum validation...");
      runChecksumValidation(true);
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [runChecksumValidation]);

  const isTabAllowed = (tabId: string, roleOrStaff: string | Staff | null | undefined): boolean => {
    if (!roleOrStaff) return false;
    let role = "";
    let staffMember: Staff | null = null;
    if (typeof roleOrStaff === "string") {
      role = roleOrStaff;
      if (currentStaff && currentStaff.role === role) {
        staffMember = currentStaff;
      }
    } else {
      staffMember = roleOrStaff;
      role = roleOrStaff.role;
    }

    // Bypass permissions for Super Admin
    if (staffMember && staffMember.email?.toLowerCase() === "congbaotruong8@gmail.com") return true;
    if (currentStaff && currentStaff.email?.toLowerCase() === "congbaotruong8@gmail.com") return true;

    // Check Store-level Feature Restrictions set by Software Admin
    if (trialInfo?.allowedModules) {
      const flags = trialInfo.allowedModules;
      if (tabId === "pos" && !isModuleEnabled(flags.pos)) return false;
      if (tabId === "products" && !isModuleEnabled(flags.products)) return false;
      if (tabId === "partners" && !isModuleEnabled(flags.partners)) return false;
      if (tabId === "cashbook" && !isModuleEnabled(flags.cashbook)) return false;
      if (tabId === "dashboard" && !isModuleEnabled(flags.reports)) return false;
    }

    if (role === "OWNER") return true;

    // Check custom permissions first if we have a staff member
    if (staffMember && staffMember.permissions) {
      const perms = staffMember.permissions;
      if (tabId === "cashbook" && perms.cashbookAccess !== undefined) return perms.cashbookAccess;
      if (tabId === "dashboard" && perms.reportsAccess !== undefined) return perms.reportsAccess;
      if (tabId === "pos" && perms.posAccess !== undefined) return perms.posAccess;
      if (tabId === "products" && perms.productsAccess !== undefined) return perms.productsAccess;
      if (tabId === "partners" && perms.partnersAccess !== undefined) return perms.partnersAccess;
      if (tabId === "settings" && perms.settingsAccess !== undefined) return perms.settingsAccess;
    }

    // Default fallbacks
    if (role === "MANAGER") {
      return true;
    }
    if (role === "CASHIER") {
      return tabId === "pos";
    }
    return false;
  };

  // 2. Persistent States (Synchronized with LocalStorage)
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<ShopSetting | null>(null);
  const [audits, setAudits] = useState<InventoryAudit[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [cashbook, setCashbook] = useState<CashbookEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cashShifts, setCashShifts] = useState<CashShift[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemAuditLog[]>([]);

  // 2a. Trial-SaaS Management & Local Countdown states
  const [trialRegistrations, setTrialRegistrations] = useState<TrialRegistration[]>([]);
  const [trialInfo, setTrialInfo] = useState<TrialRegistration | null>(() => {
    try {
      const localTrial = localStorage.getItem("kiot_trial_info");
      return localTrial ? JSON.parse(localTrial) : null;
    } catch (e) {
      return null;
    }
  });
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isOpenTrialModal, setIsOpenTrialModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetType, setResetType] = useState<"hard" | "selective">("hard");
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<"registration" | "today" | "yesterday" | "1hour" | "custom">("registration");
  const [customResetDateTime, setCustomResetDateTime] = useState<string>(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  });

  // 3. Initialize data when trialInfo changes (or on mount)
  useEffect(() => {
    const prefix = trialInfo ? `kiot_trial_${trialInfo.id}_` : "kiot_";
    
    // For trial stores (buyers), start completely fresh/empty ([]) as requested!
    // For standard demo, load pre-populated default mock records for immediate test.
    const prods = safeGetLocalStorage<Product[]>(`${prefix}products`, trialInfo ? [] : DEFAULT_PRODUCTS);
    setProducts(prods);

    const cats = safeGetLocalStorage<Category[]>(`${prefix}categories`, trialInfo ? [] : DEFAULT_CATEGORIES);
    setCategories(cats);

    const custs = safeGetLocalStorage<Customer[]>(`${prefix}customers`, trialInfo ? [] : DEFAULT_CUSTOMERS);
    setCustomers(custs);

    const sups = safeGetLocalStorage<Supplier[]>(`${prefix}suppliers`, trialInfo ? [] : DEFAULT_SUPPLIERS);
    setSuppliers(sups);

    const invs = safeGetLocalStorage<Invoice[]>(`${prefix}invoices`, trialInfo ? [] : DEFAULT_INVOICES);
    setInvoices(invs);

    // Seed the trial owner staff dynamically if they are logged in and staff list is empty
    let defaultStaffList: Staff[] = trialInfo ? [] : DEFAULT_STAFF;
    if (trialInfo) {
      const currentStaffLocal = localStorage.getItem("kiot_current_staff");
      if (currentStaffLocal) {
        try {
          const parsedStaff = JSON.parse(currentStaffLocal) as Staff;
          defaultStaffList = [parsedStaff];
        } catch (e) {}
      }
    }
    const stf = safeGetLocalStorage<Staff[]>(`${prefix}staff`, defaultStaffList);
    setStaff(stf);

    let trialDefaultSettings = DEFAULT_SETTINGS;
    if (trialInfo) {
      trialDefaultSettings = {
        ...DEFAULT_SETTINGS,
        shopName: trialInfo.shopName,
        address: trialInfo.address || "Đang dùng thử KiotX",
        phone: trialInfo.phone
      };
    }
    const sett = safeGetLocalStorage<ShopSetting>(`${prefix}settings`, trialDefaultSettings);
    setSettings(sett);

    const auds = safeGetLocalStorage<InventoryAudit[]>(`${prefix}audits`, trialInfo ? [] : DEFAULT_AUDITS);
    setAudits(auds);

    const pos = safeGetLocalStorage<PurchaseOrder[]>(`${prefix}purchase_orders`, trialInfo ? [] : DEFAULT_PURCHASE_ORDERS);
    setPurchaseOrders(pos);

    const cbs = safeGetLocalStorage<CashbookEntry[]>(`${prefix}cashbook`, trialInfo ? [] : DEFAULT_CASHBOOK);
    setCashbook(cbs);

    const projs = safeGetLocalStorage<Project[]>(`${prefix}projects`, trialInfo ? [] : DEFAULT_PROJECTS);
    setProjects(projs);

    const shifts = safeGetLocalStorage<CashShift[]>(`${prefix}cash_shifts`, []);
    setCashShifts(shifts);

    const logs = safeGetLocalStorage<SystemAuditLog[]>(`${prefix}system_logs`, trialInfo ? [] : DEFAULT_SYSTEM_LOGS);
    setSystemLogs(logs);

    // Update HTML tab title dynamically
    if (sett) {
      document.title = sett.shopName;
    }

    // Load Theme preference
    const localTheme = localStorage.getItem("kiot_theme");
    if (localTheme) setTheme(localTheme as "dark" | "light");

    // Load or initialize Simulated Server Database for demonstration/sync backup
    const serverInvs = localStorage.getItem("kiot_server_invoices");
    if (!serverInvs) {
      localStorage.setItem("kiot_server_invoices", JSON.stringify(DEFAULT_INVOICES));
    }
  }, [trialInfo]);

  // 3a. SaaS Trial Polling Loader (from PostgreSQL)
  useEffect(() => {
    if (currentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com") {
      const fetchTrialsList = async () => {
        try {
          const res = await fetch("/api/trials");
          if (res.ok) {
            const list = await res.json();
            list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setTrialRegistrations(list);
          }
        } catch (error) {
          console.warn("Lỗi tải thông tin dùng thử từ PostgreSQL:", error);
        }
      };
      fetchTrialsList();
      const interval = setInterval(fetchTrialsList, 10000); // Poll every 10s
      return () => clearInterval(interval);
    } else {
      setTrialRegistrations([]);
    }
  }, [currentStaff]);

  // 3b. Sync existing, new & deleted Firestore "kiot_trials" directly to PostgreSQL (runs unconditionally on startup)
  useEffect(() => {
    const trialsCol = collection(db, "kiot_trials");
    const unsubscribe = onSnapshot(trialsCol, async (snapshot) => {
      // Load persistently deleted trial IDs from local storage to skip cache-based updates
      let persistedDeletedIds: string[] = [];
      try {
        const storedStr = localStorage.getItem("kiot_deleted_trial_ids");
        if (storedStr) {
          persistedDeletedIds = JSON.parse(storedStr);
        }
      } catch (e) {
        console.warn("Lỗi đọc kiot_deleted_trial_ids từ localStorage:", e);
      }

      for (const change of snapshot.docChanges()) {
        const trial = change.doc.data() as TrialRegistration;
        const id = change.doc.id;

        const isDeleted = deletedTrialIdsRef.current.has(id) || persistedDeletedIds.includes(id);

        if (change.type === "removed") {
          deletedTrialIdsRef.current.add(id);
          // Add to local storage too if not already there
          if (!persistedDeletedIds.includes(id)) {
            persistedDeletedIds.push(id);
            localStorage.setItem("kiot_deleted_trial_ids", JSON.stringify(persistedDeletedIds));
          }
          // Document was deleted from Firestore, delete from PostgreSQL too
          try {
            await fetch(`/api/trials/${id}`, { method: "DELETE" });
          } catch (err) {
            console.error("Lỗi đồng bộ xóa dùng thử sang PostgreSQL:", err);
          }
        } else {
          // If the ID is in deleted list, skip to prevent re-creation from cache or snapshot latency
          if (isDeleted) {
            console.log(`Bỏ qua đồng bộ ngược vì trial ${id} đã bị xóa vĩnh viễn (kiểm tra Local Storage / Ref).`);
            continue;
          }
          // Document was added or modified, upsert to PostgreSQL
          try {
            await fetch("/api/trials", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(trial),
            });
          } catch (err) {
            console.error("Lỗi đồng bộ dùng thử sang PostgreSQL:", err);
          }
        }
      }

      // Force refresh of trial registrations if user is logged in as admin to keep UI perfectly in sync
      if (currentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com") {
        try {
          const trialsRes = await fetch("/api/trials");
          if (trialsRes.ok) {
            const list = await trialsRes.json();
            // Filter out any locally deleted trials to ensure absolute UI consistency
            const filteredList = list.filter((t: any) => !deletedTrialIdsRef.current.has(t.id) && !persistedDeletedIds.includes(t.id));
            filteredList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setTrialRegistrations(filteredList);
          }
        } catch (reloadErr) {
          console.warn("Lỗi tải lại danh sách dùng thử sau khi đồng bộ:", reloadErr);
        }
      }
    });
    return () => unsubscribe();
  }, [currentStaff]);

  useEffect(() => {
    const localTrial = localStorage.getItem("kiot_trial_info");
    if (localTrial) {
      try {
        const parsed = JSON.parse(localTrial) as TrialRegistration;
        setTrialInfo(parsed);
        const diffTime = new Date(parsed.expireDate).getTime() - Date.now();
        setTrialDaysLeft(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        // Setup polling sync for their own store!
        const fetchOwnTrial = async () => {
          try {
            const res = await fetch("/api/trials");
            if (res.ok) {
              const list = await res.json();
              const freshData = list.find((t: any) => t.id === parsed.id) as TrialRegistration | undefined;
              if (freshData) {
                localStorage.setItem("kiot_trial_info", JSON.stringify(freshData));
                setTrialInfo(freshData);
                const freshDiff = new Date(freshData.expireDate).getTime() - Date.now();
                setTrialDaysLeft(Math.ceil(freshDiff / (1000 * 60 * 60 * 24)));

                // Also update the general settings name if changed
                const settingsStr = localStorage.getItem("kiot_settings");
                if (settingsStr) {
                  try {
                    const currentSettings = JSON.parse(settingsStr);
                    if (currentSettings.shopName !== freshData.shopName) {
                      currentSettings.shopName = freshData.shopName;
                      localStorage.setItem("kiot_settings", JSON.stringify(currentSettings));
                      setSettings(currentSettings);
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (err) {
            console.warn("Lỗi đồng bộ thông tin dùng thử từ PostgreSQL:", err);
          }
        };

        fetchOwnTrial();
        const interval = setInterval(fetchOwnTrial, 15000); // Poll every 15s
        return () => clearInterval(interval);
      } catch (e) {
        console.warn("Lỗi đọc thông tin dùng thử cục bộ:", e);
      }
    } else {
      setTrialInfo(null);
      setTrialDaysLeft(null);
    }
  }, [currentStaff]);

  const handleUpdateTrialStatus = async (id: string, status: "TRIAL_ACTIVE" | "EXPIRED" | "CONVERTED") => {
    try {
      const targetTrial = trialRegistrations.find(t => t.id === id);
      if (targetTrial) {
        const updated = { ...targetTrial, status };

        // 1. Update on Firebase Firestore first
        await safeSetDoc(doc(db, "kiot_trials", id), updated);

        // 2. Update on PostgreSQL
        const res = await fetch("/api/trials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });
        if (!res.ok) throw new Error("Cập nhật trên server thất bại");

        // Force reload from backend
        const trialsRes = await fetch("/api/trials");
        if (trialsRes.ok) {
          const list = await trialsRes.json();
          list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTrialRegistrations(list);
        }
        
        // Also update local storage if the updated trial matches currently logged in trial store!
        const localTrialStr = localStorage.getItem("kiot_trial_info");
        if (localTrialStr) {
          try {
            const localTrial = JSON.parse(localTrialStr) as TrialRegistration;
            if (localTrial.id === id) {
              localStorage.setItem("kiot_trial_info", JSON.stringify(updated));
              setTrialInfo(updated);
            }
          } catch (e) {}
        }

        safeDispatchEvent("kiot-toast", {
          type: "success",
          title: "Đã cập nhật trạng thái",
          message: `Cửa hàng "${targetTrial.shopName}" đã chuyển trạng thái thành công.`
        });
      }
    } catch (err) {
      console.error("Lỗi cập nhật dùng thử:", err);
      alert("Không thể cập nhật trạng thái dùng thử.");
    }
  };

  const handleExtendTrial = async (id: string, days: number) => {
    try {
      let targetTrial = trialRegistrations.find(t => t.id === id);
      if (!targetTrial && trialInfo && trialInfo.id === id) {
        targetTrial = trialInfo;
      }
      if (targetTrial) {
        const currentExp = new Date(targetTrial.expireDate);
        const newExp = new Date(currentExp.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
        const updated = { 
          ...targetTrial, 
          expireDate: newExp,
          status: "TRIAL_ACTIVE" as const
        };

        // 1. Update on Firebase Firestore first
        await safeSetDoc(doc(db, "kiot_trials", id), updated);

        // 2. Update on PostgreSQL
        const res = await fetch("/api/trials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });
        if (!res.ok) throw new Error("Gia hạn trên server thất bại");

        // Force reload from backend
        const trialsRes = await fetch("/api/trials");
        if (trialsRes.ok) {
          const list = await trialsRes.json();
          list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTrialRegistrations(list);
        }

        // Also update local storage if it's the current trial store
        const localTrialStr = localStorage.getItem("kiot_trial_info");
        if (localTrialStr) {
          try {
            const localTrial = JSON.parse(localTrialStr) as TrialRegistration;
            if (localTrial.id === id) {
              localStorage.setItem("kiot_trial_info", JSON.stringify(updated));
              setTrialInfo(updated);
              const diffTime = new Date(newExp).getTime() - Date.now();
              setTrialDaysLeft(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            }
          } catch (e) {}
        }

        safeDispatchEvent("kiot-toast", {
          type: "success",
          title: "Đã gia hạn thành công",
          message: `Cửa hàng "${targetTrial.shopName}" đã được cộng thêm ${days} ngày dùng thử.`
        });
      }
    } catch (err) {
      console.error("Lỗi gia hạn dùng thử:", err);
      alert("Không thể gia hạn dùng thử.");
    }
  };

  const handleSetTrialExpirationDate = async (id: string, dateStr: string) => {
    try {
      let targetTrial = trialRegistrations.find(t => t.id === id);
      if (!targetTrial && trialInfo && trialInfo.id === id) {
        targetTrial = trialInfo;
      }
      if (targetTrial) {
        const newExp = new Date(dateStr).toISOString();
        const updated = { 
          ...targetTrial, 
          expireDate: newExp,
          status: targetTrial.status === "CONVERTED" ? ("CONVERTED" as const) : ("TRIAL_ACTIVE" as const)
        };

        // 1. Update on Firebase Firestore first
        await safeSetDoc(doc(db, "kiot_trials", id), updated);

        // 2. Update on PostgreSQL
        const res = await fetch("/api/trials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });
        if (!res.ok) throw new Error("Cập nhật ngày hết hạn trên server thất bại");

        // Force reload from backend
        const trialsRes = await fetch("/api/trials");
        if (trialsRes.ok) {
          const list = await trialsRes.json();
          list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTrialRegistrations(list);
        }

        // Also update local storage if it's the current trial store
        const localTrialStr = localStorage.getItem("kiot_trial_info");
        if (localTrialStr) {
          try {
            const localTrial = JSON.parse(localTrialStr) as TrialRegistration;
            if (localTrial.id === id) {
              localStorage.setItem("kiot_trial_info", JSON.stringify(updated));
              setTrialInfo(updated);
              const diffTime = new Date(newExp).getTime() - Date.now();
              setTrialDaysLeft(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            }
          } catch (e) {}
        }

        safeDispatchEvent("kiot-toast", {
          type: "success",
          title: "Đã cập nhật ngày hết hạn",
          message: `Cửa hàng "${targetTrial.shopName}" đã được chuyển ngày hết hạn thành ${new Date(dateStr).toLocaleDateString("vi-VN")}.`
        });
      }
    } catch (err) {
      console.error("Lỗi cập nhật ngày dùng thử:", err);
      alert("Không thể cập nhật ngày dùng thử.");
    }
  };

  const handleUpdateTrialPassword = async (id: string, newPassword?: string, newEmail?: string) => {
    try {
      let targetTrial = trialRegistrations.find(t => t.id === id);
      if (!targetTrial && trialInfo && trialInfo.id === id) {
        targetTrial = trialInfo;
      }
      if (targetTrial) {
        const updated = { 
          ...targetTrial, 
        };
        if (newPassword) {
          updated.password = newPassword;
        }
        if (newEmail && newEmail.trim() !== "") {
          updated.email = newEmail.trim().toLowerCase();
          
          // Keep default OWNER staff email in sync so login is smooth
          const oldEmail = targetTrial.email;
          const updatedStaff = staff.map(s => {
            if (s.email.toLowerCase() === oldEmail.toLowerCase() && s.role === "OWNER") {
              return { ...s, email: newEmail.trim().toLowerCase() };
            }
            return s;
          });
          saveStaff(updatedStaff);

          // Update currentStaff if they are the OWNER whose email is being updated
          if (currentStaff && currentStaff.role === "OWNER" && currentStaff.email.toLowerCase() === oldEmail.toLowerCase()) {
            const updatedCurrentStaff = { ...currentStaff, email: newEmail.trim().toLowerCase() };
            setCurrentStaff(updatedCurrentStaff);
            localStorage.setItem("kiot_current_staff", JSON.stringify(updatedCurrentStaff));
          }
        }

        // 1. Update on Firebase Firestore first
        await safeSetDoc(doc(db, "kiot_trials", id), updated);

        // 2. Update on PostgreSQL
        const res = await fetch("/api/trials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });
        if (!res.ok) throw new Error("Cập nhật thông tin tài khoản trên server thất bại");

        // Force reload from backend
        const trialsRes = await fetch("/api/trials");
        if (trialsRes.ok) {
          const list = await trialsRes.json();
          list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTrialRegistrations(list);
        }

        // Also update local storage if it's the current trial store
        const localTrialStr = localStorage.getItem("kiot_trial_info");
        if (localTrialStr) {
          try {
            const localTrial = JSON.parse(localTrialStr) as TrialRegistration;
            if (localTrial.id === id) {
              localStorage.setItem("kiot_trial_info", JSON.stringify(updated));
              setTrialInfo(updated);
            }
          } catch (e) {}
        }

        safeDispatchEvent("kiot-toast", {
          type: "success",
          title: "Đã cập nhật tài khoản",
          message: `Cập nhật thông tin đăng nhập cho cửa hàng "${targetTrial.shopName}" thành công.`
        });
      }
    } catch (err: any) {
      console.error("Lỗi cập nhật mật khẩu:", err);
      alert(`Không thể đổi mật khẩu dùng thử: ${err.message || err}`);
    }
  };

  const handleUpdateTrialAllowedModules = async (id: string, allowedModules: StoreFeatureFlags) => {
    try {
      const targetTrial = trialRegistrations.find(t => t.id === id);
      if (!targetTrial) return;

      const updated: TrialRegistration = { ...targetTrial, allowedModules };

      // 1. Update state immediately
      setTrialRegistrations(prev => prev.map(t => t.id === id ? updated : t));

      // 2. Update Firebase Firestore
      await safeSetDoc(doc(db, "kiot_trials", id), updated);

      // 3. Update PostgreSQL server
      const res = await fetch("/api/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error("Cập nhật phân quyền tính năng trên server thất bại");

      // 4. Update current trialInfo if matches
      const localTrialStr = localStorage.getItem("kiot_trial_info");
      if (localTrialStr) {
        try {
          const localTrial = JSON.parse(localTrialStr) as TrialRegistration;
          if (localTrial.id === id) {
            localStorage.setItem("kiot_trial_info", JSON.stringify(updated));
            setTrialInfo(updated);
          }
        } catch (e) {}
      }

      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "Đã cập nhật phân quyền 🔒",
        message: `Cập nhật phân quyền tính năng cho cửa hàng "${targetTrial.shopName}" thành công.`
      });
    } catch (err: any) {
      console.error("Lỗi cập nhật phân quyền cửa hàng:", err);
      alert(`Không thể phân quyền tính năng cửa hàng: ${err.message || err}`);
    }
  };

  const handleDeleteTrial = async (id: string) => {
    try {
      const isOwner = currentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com";
      console.log(`[handleDeleteTrial] Đang xử lý yêu cầu xóa thử nghiệm ID: ${id}. Quyền Owner: ${isOwner}`);
      
      if (!isOwner) {
        console.error(`[handleDeleteTrial] Quyền bị từ chối: Email ${currentStaff?.email || "Chưa đăng nhập"} không có quyền xóa đăng ký dùng thử.`);
        safeDispatchEvent("kiot-toast", {
          type: "error",
          title: "Từ chối truy cập",
          message: "Chỉ chủ sở hữu (Super Admin) mới có quyền xóa đăng ký dùng thử."
        });
        return;
      }

      const targetTrial = trialRegistrations.find(t => t.id === id);
      const name = targetTrial?.shopName || id;

      // 1. Optimistic UI Update: immediately mark as deleted and filter state to hide row instantly
      deletedTrialIdsRef.current.add(id);
      
      // Persist the deletion status to local storage immediately to prevent onSnapshot/cache race condition
      let persistedDeletedIds: string[] = [];
      try {
        const storedStr = localStorage.getItem("kiot_deleted_trial_ids") || "[]";
        persistedDeletedIds = JSON.parse(storedStr);
        if (!persistedDeletedIds.includes(id)) {
          persistedDeletedIds.push(id);
          localStorage.setItem("kiot_deleted_trial_ids", JSON.stringify(persistedDeletedIds));
        }
      } catch (e) {
        localStorage.setItem("kiot_deleted_trial_ids", JSON.stringify([id]));
        persistedDeletedIds = [id];
      }

      setTrialRegistrations(prev => prev.filter(t => t.id !== id));

      safeDispatchEvent("kiot-toast", {
        type: "info",
        title: "Đang xóa dữ liệu...",
        message: `Đang thực hiện xóa cưỡng bức cửa hàng "${name}" trên toàn hệ thống.`
      });

      // 2. Perform secondary/optional client-side Firestore delete (runs in background, errors tolerated)
      try {
        console.log(`[handleDeleteTrial] Gửi yêu cầu xóa Firestore client-side ID: ${id}...`);
        await safeDeleteDoc(doc(db, "kiot_trials", id));
      } catch (firestoreErr: any) {
        console.warn("[handleDeleteTrial] Gặp lỗi khi xóa trên client Firestore (sẽ được dọn dẹp triệt để bởi Server backend):", firestoreErr.message || firestoreErr);
      }

      // 3. Trigger Server-side Force Cascade Delete (PostgreSQL + Server-side Firestore REST bypass)
      try {
        console.log(`[handleDeleteTrial] Gửi yêu cầu force-delete tới Server cho ID: ${id}...`);
        const res = await fetch(`/api/trials/force-delete/${id}?adminEmail=congbaotruong8@gmail.com`, {
          method: "DELETE"
        });
        
        console.log(`[handleDeleteTrial] Kết quả force-delete Server status:`, res.status, res.statusText);
        
        if (res.ok) {
          const result = await res.json();
          console.log(`[handleDeleteTrial] Đã xóa cưỡng bức thành công cửa hàng [${name}]:`, result);
          safeDispatchEvent("kiot-toast", {
            type: "success",
            title: "Xóa thành công",
            message: `Cửa hàng "${name}" và toàn bộ dữ liệu đã được dọn dẹp triệt để.`
          });
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error("[handleDeleteTrial] Lỗi chi tiết từ API Force-Delete:", errData);
          safeDispatchEvent("kiot-toast", {
            type: "error",
            title: "Lỗi dọn dẹp",
            message: `Lỗi máy chủ khi dọn dẹp: ${errData.error || "Không xác định"}`
          });
        }
      } catch (serverErr: any) {
        console.error("[handleDeleteTrial] Lỗi kết nối khi gửi yêu cầu force-delete:", serverErr);
        safeDispatchEvent("kiot-toast", {
          type: "error",
          title: "Lỗi kết nối",
          message: "Không thể kết nối tới máy chủ để thực hiện dọn dẹp triệt để."
        });
      }

      // 4. Force reload from backend to ensure state parity
      try {
        const trialsRes = await fetch("/api/trials");
        if (trialsRes.ok) {
          const list = await trialsRes.json();
          const filteredList = list.filter((t: any) => t.id !== id && !persistedDeletedIds.includes(t.id)); // Double check local deleted set
          filteredList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTrialRegistrations(filteredList);
        }
      } catch (reloadErr) {
        console.warn("Lỗi tải lại danh sách dùng thử sau khi xóa:", reloadErr);
      }

      // 5. Clear local storage if they deleted the active trial
      const localTrialStr = localStorage.getItem("kiot_trial_info");
      if (localTrialStr) {
        try {
          const localTrial = JSON.parse(localTrialStr) as TrialRegistration;
          if (localTrial.id === id) {
            localStorage.removeItem("kiot_trial_info");
            setTrialInfo(null);
            setTrialDaysLeft(null);
          }
        } catch (e) {}
      }

    } catch (err: any) {
      console.error("[handleDeleteTrial] Gặp lỗi không mong muốn:", err);
    }
  };

  const handleCreateTrial = async (newTrial: Omit<TrialRegistration, 'id' | 'createdAt'>) => {
    try {
      const cleanEmail = newTrial.email.trim().toLowerCase();
      
      // Explicitly block admin email
      if (cleanEmail === "congbaotruong8@gmail.com") {
        alert(`Lỗi tạo: Không thể sử dụng email quản trị viên "congbaotruong8@gmail.com" để cấp tài khoản dùng thử.`);
        return;
      }

      // Check if email already registered
      const isExisted = trialRegistrations.some(t => t.email.trim().toLowerCase() === cleanEmail);
      if (isExisted) {
        alert(`Lỗi tạo: Gmail/Email "${newTrial.email}" đã được đăng ký dùng thử trước đó trên hệ thống! Vui lòng chọn địa chỉ email khác.`);
        return;
      }

      // Check if phone already registered (both exact and clean digits matching)
      const cleanPhoneDigits = newTrial.phone.replace(/\D/g, "");
      const isPhoneExisted = trialRegistrations.some(t => {
        const dPhoneClean = (t.phone || "").replace(/\D/g, "");
        return (dPhoneClean === cleanPhoneDigits && cleanPhoneDigits.length > 0) || t.phone === newTrial.phone.trim();
      });
      if (isPhoneExisted) {
        alert(`Lỗi tạo: Số điện thoại "${newTrial.phone}" này đã được đăng ký dùng thử trước đó trên hệ thống! Vui lòng sử dụng số điện thoại khác.`);
        return;
      }

      const trialId = `trial-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const trialData: TrialRegistration = {
        ...newTrial,
        id: trialId,
        createdAt,
      };

      // 1. Save directly to Firestore for congbaotruong8@gmail.com to see
      await safeSetDoc(doc(db, "kiot_trials", trialId), trialData);

      // 2. Sync directly to PostgreSQL database
      const res = await fetch("/api/trials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(trialData),
      });

      if (!res.ok) throw new Error("Không thể lưu đăng ký dùng thử lên server");

      // 3. Force reload from backend
      const trialsRes = await fetch("/api/trials");
      if (trialsRes.ok) {
        const list = await trialsRes.json();
        list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTrialRegistrations(list);
      }

      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "Tạo khách hàng thành công",
        message: `Cửa hàng dùng thử "${trialData.shopName}" đã được tạo thành công thủ công.`
      });
    } catch (err: any) {
      console.error("Lỗi tạo khách hàng thủ công:", err);
      alert(`Không thể tạo khách hàng: ${err.message || err}`);
    }
  };

  // 4. Live Clock Ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // 4a. Global Keyboard Shortcuts Listener for Cashier/POS Quick Actions
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        if (currentStaff && !isTabAllowed("cashbook", currentStaff)) {
          return;
        }
        e.preventDefault();
        handleTabChange("cashbook");
        return;
      }

      const posKeys = ["F1", "F2", "F4", "F8", "F9"];
      if (!posKeys.includes(e.key)) return;

      // Check if user is allowed to access POS
      if (currentStaff && !isTabAllowed("pos", currentStaff)) {
        return;
      }

      // If they are on another tab, automatically redirect them to the POS tab first!
      if (activeTab !== "pos") {
        e.preventDefault();
        handleTabChange("pos");

        // Stagger slightly to allow the POS component to fully mount
        setTimeout(() => {
          triggerAction(e.key);
        }, 180);
      }
    };

    const triggerAction = (key: string) => {
      if (key === "F1") {
        const searchInput = document.getElementById("pos-product-search");
        if (searchInput) {
          (searchInput as HTMLInputElement).focus();
          (searchInput as HTMLInputElement).select();
        }
      } else if (key === "F9") {
        const checkoutBtn = document.getElementById("pos-checkout-btn");
        if (checkoutBtn) {
          (checkoutBtn as HTMLButtonElement).click();
        }
      } else if (key === "F8") {
        const customerSelect = document.getElementById("pos-customer-select");
        if (customerSelect) {
          (customerSelect as HTMLSelectElement).focus();
        }
      } else if (key === "F2") {
        window.dispatchEvent(new CustomEvent("kiot-trigger-new-customer"));
      } else if (key === "F4") {
        window.dispatchEvent(new CustomEvent("kiot-clear-cart"));
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [activeTab, currentStaff]);

  // 4b. Firebase Auth and Role-Based Login Handlers
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userEmail = user.email?.toLowerCase() || "";
        console.log(`[onAuthStateChanged] Google user logged in: ${userEmail}`);

        // 1. Check if the user is the Super Admin (congbaotruong8@gmail.com)
        if (userEmail === "congbaotruong8@gmail.com") {
          const adminStaff: Staff = {
            id: `staff-${user.uid}`,
            name: "Trương Công Bảo (Super Admin)",
            email: "congbaotruong8@gmail.com",
            role: "OWNER",
            phone: "0901234567",
            active: true
          };
          setCurrentStaff(adminStaff);
          localStorage.setItem("kiot_current_staff", JSON.stringify(adminStaff));
          
          // Clear any active trial info since admin is viewing overall SaaS system
          setTrialInfo(null);
          localStorage.removeItem("kiot_trial_info");
          return;
        }

        // 2. For any other Google/Gmail user:
        // Automatically check/create their trial registration so they get their own store
        try {
          const { collection, getDocs, query, where, doc } = await import("firebase/firestore");
          const trialsRef = collection(db, "kiot_trials");
          const q = query(trialsRef, where("email", "==", userEmail));
          const querySnapshot = await getDocs(q);
          
          let userTrial: TrialRegistration | null = null;
          
          if (!querySnapshot.empty) {
            userTrial = querySnapshot.docs[0].data() as TrialRegistration;
            console.log(`[onAuthStateChanged] Found existing trial for ${userEmail}:`, userTrial);
          } else {
            // Auto-provision a new TrialRegistration (SaaS Trial user) on the fly!
            console.log(`[onAuthStateChanged] Auto-registering new SaaS trial for Gmail: ${userEmail}`);
            const trialId = `trial-${user.uid}`;
            const createdAt = new Date().toISOString();
            const expireDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(); // 20 days
            
            userTrial = {
              id: trialId,
              shopName: `Cửa hàng của ${user.displayName || user.email?.split("@")[0]}`,
              ownerName: user.displayName || user.email?.split("@")[0] || "Khách hàng Google",
              phone: "",
              email: userEmail,
              password: "", // Google accounts don't need passwords
              address: "Đăng nhập qua Google",
              notes: "Tự động kích hoạt qua Google Sign-In",
              createdAt,
              expireDate,
              status: "TRIAL_ACTIVE"
            };
            
            // Save to Firestore
            await safeSetDoc(doc(db, "kiot_trials", trialId), userTrial);
            
            // Sync to PostgreSQL server
            try {
              await fetch("/api/trials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userTrial)
              });
            } catch (pgErr) {
              console.warn("Lỗi đồng bộ dùng thử Google mới sang PostgreSQL:", pgErr);
            }
          }
          
          // Set trial info
          setTrialInfo(userTrial);
          localStorage.setItem("kiot_trial_info", JSON.stringify(userTrial));
          
          // Now prepare the client staff state for this user
          const trialStaff: Staff = {
            id: `staff-${user.uid}`,
            name: user.displayName || user.email?.split("@")[0] || "Chủ cửa hàng (Google)",
            email: userEmail,
            role: "OWNER",
            phone: "",
            active: true
          };
          
          setCurrentStaff(trialStaff);
          localStorage.setItem("kiot_current_staff", JSON.stringify(trialStaff));
          
          // Also make sure they are in the active staff list for their prefix
          const prefix = `kiot_trial_${userTrial.id}_`;
          const localStaffStr = localStorage.getItem(`${prefix}staff`);
          let trialStaffList: Staff[] = [];
          if (localStaffStr) {
            try { trialStaffList = JSON.parse(localStaffStr); } catch (e) {}
          }
          if (!trialStaffList.some(s => s.email.toLowerCase() === userEmail)) {
            trialStaffList.push(trialStaff);
            localStorage.setItem(`${prefix}staff`, JSON.stringify(trialStaffList));
          }
          setStaff(trialStaffList);
          
        } catch (err) {
          console.error("Lỗi đồng bộ hoặc khởi tạo tài khoản dùng thử Google:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "Đăng nhập Google thành công! 🎉",
        message: "Tài khoản Google đã kết nối và đồng bộ vai trò thành viên."
      });
    } catch (err: any) {
      console.warn("Lỗi Google Sign-In:", err?.code, err?.message);
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        safeDispatchEvent("kiot-toast", {
          type: "warning",
          title: "Đã hủy đăng nhập",
          message: "Cửa sổ đăng nhập Google đã được đóng."
        });
      } else if (err?.code === "auth/popup-blocked") {
        safeDispatchEvent("kiot-toast", {
          type: "warning",
          title: "Cửa sổ Pop-up bị chặn",
          message: "Trình duyệt đang chặn cửa sổ đăng nhập Google. Vui lòng cho phép Pop-up trên trình duyệt hoặc đăng nhập bằng tài khoản nhanh / mật khẩu."
        });
      } else if (err?.code === "auth/unauthorized-domain") {
        safeDispatchEvent("kiot-toast", {
          type: "error",
          title: "Tên miền chưa được cấp quyền",
          message: "Tên miền hiện tại cần được thêm vào Firebase Authorized Domains."
        });
      } else {
        safeDispatchEvent("kiot-toast", {
          type: "error",
          title: "Không thể kết nối Google Auth",
          message: err?.message || "Vui lòng thử lại hoặc đăng nhập bằng tài khoản mẫu / mật khẩu."
        });
      }
    }
  };

  const handleSelectSimulatedStaff = (selected: Staff) => {
    setCurrentStaff(selected);
    localStorage.setItem("kiot_current_staff", JSON.stringify(selected));
    
    // Automatically redirect CASHIER to POS screen, and OWNER/MANAGER to Dashboard
    if (selected.role === "CASHIER") {
      handleTabChange("pos");
    } else {
      handleTabChange("dashboard");
    }

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "Đăng nhập thành công! 🔓",
      message: `Chào mừng ${selected.role === "OWNER" ? "Chủ tiệm" : selected.role === "MANAGER" ? "Quản lý" : "Thu ngân"}: ${selected.name}`
    });
  };

  const handleLogout = async () => {
    await signOut(auth).catch(() => {});
    
    if (currentStaff) {
      const logoutLog: SystemAuditLog = {
        id: `log-logout-${Date.now()}`,
        actionType: "USER_LOGOUT",
        actionName: "Đăng xuất hệ thống",
        description: `Nhân viên ${currentStaff.name} đã đăng xuất khỏi phiên làm việc an toàn.`,
        actorName: currentStaff.name,
        actorRole: currentStaff.role,
        timestamp: new Date().toISOString()
      };
      
      const updatedLogs = [logoutLog, ...systemLogs];
      setSystemLogs(updatedLogs);
      localStorage.setItem(getDynamicKey("system_logs"), JSON.stringify(updatedLogs));
      
      if (isOnline && autoSyncEnabled) {
        safeSetDoc(doc(db, "kiot_system_logs", logoutLog.id), logoutLog).catch(err => {
          console.error("Lỗi đồng bộ nhật ký đăng xuất lên Firestore:", err);
        });
        triggerSyncAll({ systemLogs: updatedLogs }, true);
      }
      
      // Clean up sessionStorage keys for this staff to allow new login log on re-login
      const loggedKeyToday = `kiot_login_logged_for_${currentStaff.id}_${new Date().toISOString().slice(0, 10)}`;
      sessionStorage.removeItem(loggedKeyToday);
    }

    setCurrentStaff(null);
    setTrialInfo(null);
    setTrialDaysLeft(null);
    localStorage.removeItem("kiot_current_staff");
    localStorage.removeItem("kiot_trial_info");
    safeDispatchEvent("kiot-toast", {
      type: "info",
      title: "Đã đăng xuất 🔒",
      message: "Bạn đã đăng xuất khỏi phiên làm việc an toàn."
    });
  };

  // Synchronization engine for Offline -> Online data replication
  const triggerSync = async (targetQueue?: Invoice[]) => {
    const queueToSync = targetQueue || offlineQueue;
    if (queueToSync.length === 0) return;

    setIsSyncing(true);
    
    // Dispatch a beautiful synchronizing toast
    safeDispatchEvent("kiot-toast", {
      type: "invoice",
      title: "Đang tự động đồng bộ...",
      message: `Đang kết nối đám mây để tải lên ${queueToSync.length} hóa đơn bán hàng ngoại tuyến.`
    });

    // Simulate network delay to make it highly realistic and satisfying to watch
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const serverInvs = localStorage.getItem("kiot_server_invoices");
      const currentServerList: Invoice[] = serverInvs ? JSON.parse(serverInvs) : [];
      
      // Merge unique invoices by code/id
      const merged = [...queueToSync, ...currentServerList];
      // Keep only unique ones by invoiceCode
      const uniqueMergedMap = new Map<string, Invoice>();
      merged.forEach(inv => {
        if (inv.invoiceCode) {
          uniqueMergedMap.set(inv.invoiceCode, inv);
        } else {
          uniqueMergedMap.set(inv.id, inv);
        }
      });
      const uniqueMerged = Array.from(uniqueMergedMap.values());

      localStorage.setItem("kiot_server_invoices", JSON.stringify(uniqueMerged));
      
      // Upload offline-queued invoices directly to Firestore
      for (const inv of queueToSync) {
        await safeSetDoc(doc(db, "kiot_invoices", inv.id), inv);
      }
      
      // Directly sync all current states (including newly processed offline invoices and cashbook logs) to PostgreSQL
      if (autoSyncEnabled) {
        const latestInvoices = JSON.parse(localStorage.getItem(getDynamicKey("invoices")) || "[]");
        const latestProducts = JSON.parse(localStorage.getItem(getDynamicKey("products")) || "[]");
        const latestCustomers = JSON.parse(localStorage.getItem(getDynamicKey("customers")) || "[]");
        const latestCashbook = JSON.parse(localStorage.getItem(getDynamicKey("cashbook")) || "[]");

        const syncSuccess = await triggerSyncAll({
          invoices: latestInvoices,
          products: latestProducts,
          customers: latestCustomers,
          cashbook: latestCashbook
        }, true);

        if (!syncSuccess) {
          throw new Error("Không thể đồng bộ dữ liệu sang PostgreSQL (Cloud SQL).");
        }
      }

      // Clear offline queue ONLY AFTER successful sync to both Firestore and PostgreSQL!
      localStorage.setItem("kiot_offline_queue", JSON.stringify([]));
      setOfflineQueue([]);

      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "Đồng bộ thành công! 🎉",
        message: `Đã đẩy thành công ${queueToSync.length} hóa đơn từ thiết bị cục bộ lên cơ sở dữ liệu đám mây và máy chủ PostgreSQL.`
      });
    } catch (err: any) {
      console.error("Lỗi đồng bộ đám mây:", err);
      safeDispatchEvent("kiot-toast", {
        type: "stock-warning",
        title: "Lỗi đồng bộ dữ liệu",
        message: `Gặp sự cố kết nối với máy chủ đám mây: ${err?.message || err || "Không rõ nguyên nhân"}.`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Monitor online/offline states from the browser environment & active ping check
  useEffect(() => {
    let active = true;

    // Active polling ping to detect connection cuts or slow failures on real machines
    const checkRealInternet = async (): Promise<boolean> => {
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        return false;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        
        const res = await fetch(`/api/ping?t=${Date.now()}`, { 
          method: "GET",
          signal: controller.signal,
          headers: { 
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
        clearTimeout(timeoutId);
        return res.ok;
      } catch (e) {
        return false;
      }
    };

    const handleOnline = async () => {
      // Re-verify with active ping to be 100% sure we have real internet before going online
      const isReallyOnline = await checkRealInternet();
      if (!active) return;
      
      setIsRealOnline(isReallyOnline);
      if (isReallyOnline) {
        if (!isManualOffline) {
          setIsOnline(true);
          safeDispatchEvent("kiot-toast", {
            type: "success",
            title: "Đã kết nối Wi-Fi/Internet! 🌐",
            message: "Đã phát hiện tín hiệu mạng trực tuyến trên máy thật. Hệ thống chuyển sang chế độ Online."
          });
        }
      } else {
        setIsOnline(false);
        safeDispatchEvent("kiot-toast", {
          type: "stock-warning",
          title: "Không có Internet thực tế ⚠️",
          message: "Máy đã kết nối Wi-Fi nhưng không có internet. Hệ thống chuyển sang chế độ Offline."
        });
      }
    };

    const handleOffline = () => {
      setIsRealOnline(false);
      setIsOnline(false);
      safeDispatchEvent("kiot-toast", {
        type: "stock-warning",
        title: "Mất kết nối mạng máy thật! ❌",
        message: "Hệ thống đã nhận biết thiết bị vừa mất kết nối Wi-Fi/Internet trên máy thật. Đã chuyển sang chế độ bán hàng Ngoại tuyến (Offline)."
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Perform continuous background real-network health checks every 8 seconds
    const interval = setInterval(async () => {
      const isReallyOnline = await checkRealInternet();
      if (!active) return;

      setIsRealOnline(isReallyOnline);

      if (!isReallyOnline) {
        if (isOnline) {
          setIsOnline(false);
          safeDispatchEvent("kiot-toast", {
            type: "stock-warning",
            title: "Sự cố mất kết nối mạng! 📡",
            message: "Mất tín hiệu kết nối Wi-Fi/Mạng trên máy thật. Hệ thống chuyển đổi tức thì sang chế độ Ngoại tuyến để tránh gián đoạn."
          });
        }
      } else {
        // If it got restored and user was offline but didn't force offline manually
        if (!isOnline && !isManualOffline) {
          setIsOnline(true);
          safeDispatchEvent("kiot-toast", {
            type: "success",
            title: "Mạng trực tuyến trở lại! ✅",
            message: "Đã kết nối lại Wi-Fi và Internet thành công trên máy thật. Hệ thống bắt đầu đồng bộ hóa."
          });
        }
      }
    }, 8000);

    // Initial hardware connection verification on mount
    checkRealInternet().then(status => {
      if (active) {
        setIsRealOnline(status);
        if (!status && isOnline) {
          setIsOnline(false);
        }
      }
    });

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, isManualOffline]);

  // Trigger sync automatically when going online
  useEffect(() => {
    localStorage.setItem("kiot_is_online", String(isOnline));
    if (isOnline && offlineQueue.length > 0 && !isSyncing) {
      triggerSync();
    }
  }, [isOnline, offlineQueue, isSyncing]);

  // 4c. Custom Event Listeners for System Audit Logging and Sidebar control
  useEffect(() => {
    const handleAddAuditLog = (e: CustomEvent<Omit<SystemAuditLog, "id" | "timestamp">>) => {
      const newLog: SystemAuditLog = {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        actionType: e.detail.actionType,
        actionName: e.detail.actionName,
        description: e.detail.description,
        actorName: e.detail.actorName,
        actorRole: e.detail.actorRole,
        timestamp: new Date().toISOString()
      };
      setSystemLogs(prev => {
        const updated = [newLog, ...prev];
        localStorage.setItem("kiot_system_logs", JSON.stringify(updated));
        
        // Direct save to online server/firestore if enabled
        if (isOnline && autoSyncEnabled) {
          safeSetDoc(doc(db, "kiot_system_logs", newLog.id), newLog).catch(err => {
            console.error("Lỗi đồng bộ nhật ký lên Firestore:", err);
          });
        }
        
        return updated;
      });
    };

    const handleSetSidebar = (e: CustomEvent<{ open: boolean }>) => {
      setIsSidebarOpen(e.detail.open);
      localStorage.setItem("kiot_is_sidebar_open", String(e.detail.open));
    };

    window.addEventListener("kiot-add-audit-log" as any, handleAddAuditLog as any);
    window.addEventListener("kiot-set-sidebar" as any, handleSetSidebar as any);

    return () => {
      window.removeEventListener("kiot-add-audit-log" as any, handleAddAuditLog as any);
      window.removeEventListener("kiot-set-sidebar" as any, handleSetSidebar as any);
    };
  }, [isOnline, autoSyncEnabled]);

  // 4d. Automatically log Login and Logout events in System Audit Log
  useEffect(() => {
    if (currentStaff) {
      const loggedKey = `kiot_login_logged_for_${currentStaff.id}_${new Date().toISOString().slice(0, 10)}`;
      const alreadyLogged = sessionStorage.getItem(loggedKey);
      
      if (!alreadyLogged) {
        // Mark as logged in this browser session for today
        sessionStorage.setItem(loggedKey, "true");
        
        // Add log entry
        const loginLog: SystemAuditLog = {
          id: `log-login-${Date.now()}`,
          actionType: "USER_LOGIN",
          actionName: "Đăng nhập hệ thống",
          description: `Thành viên ${currentStaff.name} (vai trò ${
            currentStaff.role === "OWNER" ? "Chủ cửa hàng" : currentStaff.role === "MANAGER" ? "Quản lý" : "Thu ngân"
          }) đã đăng nhập thành công vào hệ thống KiotX Pro.`,
          actorName: currentStaff.name,
          actorRole: currentStaff.role,
          timestamp: new Date().toISOString()
        };
        
        setSystemLogs(prev => {
          const updated = [loginLog, ...prev];
          localStorage.setItem(getDynamicKey("system_logs"), JSON.stringify(updated));
          if (isOnline && autoSyncEnabled) {
            safeSetDoc(doc(db, "kiot_system_logs", loginLog.id), loginLog).catch(err => {
              console.error("Lỗi đồng bộ nhật ký đăng nhập lên Firestore:", err);
            });
            // Trigger sync all
            triggerSyncAll({ systemLogs: updated }, true);
          }
          return updated;
        });
      }
    }
  }, [currentStaff, isOnline, autoSyncEnabled, trialInfo]);

  // 5. State Persistence Helpers (Save to state + LocalStorage)
  const getDynamicKey = (baseKey: string) => {
    return trialInfo ? `kiot_trial_${trialInfo.id}_${baseKey}` : `kiot_${baseKey}`;
  };

  const saveProducts = (updated: Product[]) => {
    // Only check for stock alerts if products was already loaded (not empty initial load)
    if (products.length > 0) {
      updated.forEach(newP => {
        const oldP = products.find(p => p.id === newP.id);
        if (oldP) {
          // Check if stock decreased and crossed the minStock threshold
          if (newP.stock <= newP.minStock && oldP.stock > newP.minStock) {
            safeDispatchEvent("kiot-toast", {
              type: "stock-warning",
              title: "Cảnh báo tồn kho tối thiểu",
              message: `Sản phẩm "${newP.name}" (${newP.unit}) đã chạm ngưỡng tối thiểu! Tồn kho hiện tại: ${newP.stock} (Yêu cầu tối thiểu: ${newP.minStock})`
            });
          }
        }
      });
    }
    setProducts(updated);
    localStorage.setItem(getDynamicKey("products"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ products: updated }, true);
    }
  };

  const saveCategories = (updated: Category[]) => {
    setCategories(updated);
    localStorage.setItem(getDynamicKey("categories"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ categories: updated }, true);
    }
  };

  const saveCustomers = (updated: Customer[]) => {
    setCustomers(updated);
    localStorage.setItem(getDynamicKey("customers"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ customers: updated }, true);
    }
  };

  const saveSuppliers = (updated: Supplier[]) => {
    setSuppliers(updated);
    localStorage.setItem(getDynamicKey("suppliers"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ suppliers: updated }, true);
    }
  };

  const saveInvoices = (updated: Invoice[]) => {
    setInvoices(updated);
    localStorage.setItem(getDynamicKey("invoices"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ invoices: updated }, true);
    }
  };

  const saveStaff = (updated: Staff[]) => {
    setStaff(updated);
    localStorage.setItem(getDynamicKey("staff"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ staff: updated }, true);
    }
  };

  const saveSettings = (updated: ShopSetting) => {
    setSettings(updated);
    localStorage.setItem(getDynamicKey("settings"), JSON.stringify(updated));
    
    // Update HTML tab title dynamically
    document.title = updated.shopName;
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ settings: updated }, true);
    }
  };

  const saveAudits = (updated: InventoryAudit[]) => {
    setAudits(updated);
    localStorage.setItem(getDynamicKey("audits"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ audits: updated }, true);
    }
  };

  const savePurchaseOrders = (updated: PurchaseOrder[]) => {
    setPurchaseOrders(updated);
    localStorage.setItem(getDynamicKey("purchase_orders"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ purchaseOrders: updated }, true);
    }
  };

  const saveCashbook = (updated: CashbookEntry[]) => {
    setCashbook(updated);
    localStorage.setItem(getDynamicKey("cashbook"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ cashbook: updated }, true);
    }
  };

  const saveProjects = (updated: Project[]) => {
    setProjects(updated);
    localStorage.setItem(getDynamicKey("projects"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ projects: updated }, true);
    }
  };

  const saveCashShifts = (updated: CashShift[]) => {
    setCashShifts(updated);
    localStorage.setItem(getDynamicKey("cash_shifts"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ cashShifts: updated }, true);
    }
  };

  const saveSystemLogs = (updated: SystemAuditLog[]) => {
    setSystemLogs(updated);
    localStorage.setItem(getDynamicKey("system_logs"), JSON.stringify(updated));
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({ systemLogs: updated }, true);
    }
  };

  // PostgreSQL Full Cloud Backup & Synchronize Engine
  const triggerSyncAll = async (
    overrides?: {
      products?: Product[];
      categories?: Category[];
      customers?: Customer[];
      suppliers?: Supplier[];
      invoices?: Invoice[];
      staff?: Staff[];
      settings?: ShopSetting;
      audits?: InventoryAudit[];
      purchaseOrders?: PurchaseOrder[];
      cashbook?: CashbookEntry[];
      projects?: Project[];
      cashShifts?: CashShift[];
      systemLogs?: SystemAuditLog[];
    },
    silent = false
  ): Promise<boolean> => {
    if (!isOnline) {
      if (!silent) {
        safeDispatchEvent("kiot-toast", {
          type: "stock-warning",
          title: "Đồng bộ thất bại",
          message: "Không thể tiến hành đồng bộ khi đang ngoại tuyến (Offline)."
        });
      }
      return false;
    }

    const tenantId = trialInfo?.id || "demo";
    if (!silent) setIsSyncingAll(true);
    try {
      let syncPayload: any = {};
      if (overrides) {
        // Partial update: ONLY send tables explicitly specified in overrides
        if (overrides.products !== undefined) syncPayload.products = overrides.products;
        if (overrides.categories !== undefined) syncPayload.categories = overrides.categories;
        if (overrides.customers !== undefined) syncPayload.customers = overrides.customers;
        if (overrides.suppliers !== undefined) syncPayload.suppliers = overrides.suppliers;
        if (overrides.invoices !== undefined) syncPayload.invoices = overrides.invoices;
        if (overrides.staff !== undefined) syncPayload.staff = overrides.staff;
        if (overrides.settings !== undefined) syncPayload.settings = overrides.settings;
        if (overrides.audits !== undefined) syncPayload.audits = overrides.audits;
        if (overrides.purchaseOrders !== undefined) syncPayload.purchaseOrders = overrides.purchaseOrders;
        if (overrides.cashbook !== undefined) syncPayload.cashbook = overrides.cashbook;
        if (overrides.projects !== undefined) syncPayload.projects = overrides.projects;
        if (overrides.cashShifts !== undefined) syncPayload.cashShifts = overrides.cashShifts;
        if (overrides.systemLogs !== undefined) syncPayload.systemLogs = overrides.systemLogs;
      } else {
        // Full update: send everything
        syncPayload = {
          products,
          categories,
          customers,
          suppliers,
          invoices,
          staff,
          settings,
          audits,
          purchaseOrders,
          cashbook,
          projects,
          cashShifts,
          systemLogs
        };
      }

      let response: Response | null = null;
      let lastFetchErr: any = null;
      const jsonBody = JSON.stringify(syncPayload);

      // Retry up to 3 times for transient network/fetch interruptions
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await fetch(`/api/kiot/sync/${tenantId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: jsonBody
          });
          if (response) break;
        } catch (fetchErr: any) {
          lastFetchErr = fetchErr;
          console.warn(`[Kiot Sync Retry ${attempt}/3] Network interruption:`, fetchErr);
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          }
        }
      }

      if (!response) {
        throw new Error(
          lastFetchErr?.message === "Failed to fetch"
            ? "Kết nối mạng hoặc máy chủ đồng bộ tạm thời bị gián đoạn (Failed to fetch). Dữ liệu đã được lưu an toàn tại máy của bạn và sẽ tự đồng bộ khi có mạng."
            : (lastFetchErr?.message || "Không thể kết nối máy chủ đồng bộ PostgreSQL.")
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        let parsedErr = errorText;
        try {
          const errObj = JSON.parse(errorText);
          if (errObj && errObj.error) parsedErr = errObj.error;
        } catch (_) {}
        throw new Error(parsedErr || "Máy chủ PostgreSQL phản hồi lỗi (Mã " + response.status + ").");
      }

      const nowStr = new Date().toISOString();
      setLastSyncTime(nowStr);
      localStorage.setItem("kiot_last_sync_time", nowStr);

      if (!silent) {
        safeDispatchEvent("kiot-toast", {
          type: "success",
          title: "Đồng bộ PostgreSQL thành công! 🎉",
          message: "Tất cả dữ liệu sản phẩm, hóa đơn, cấu hình của bạn đã được sao lưu an toàn lên cơ sở dữ liệu PostgreSQL (Cloud SQL)."
        });
      }
      return true;
    } catch (error: any) {
      console.error("Lỗi đồng bộ PostgreSQL: ", error);
      if (!silent) {
        safeDispatchEvent("kiot-toast", {
          type: "stock-warning",
          title: "Lỗi đồng bộ đám mây",
          message: `Không thể lưu dữ liệu vào cơ sở dữ liệu PostgreSQL: ${error?.message || "Lỗi kết nối máy chủ backend"}.`
        });
      }
      return false;
    } finally {
      if (!silent) setIsSyncingAll(false);
    }
  };

  const handleRestoreBackup = (data: any) => {
    if (data.products) saveProducts(data.products);
    if (data.categories) saveCategories(data.categories);
    if (data.customers) saveCustomers(data.customers);
    if (data.suppliers) saveSuppliers(data.suppliers);
    if (data.invoices) saveInvoices(data.invoices);
    if (data.staff) saveStaff(data.staff);
    if (data.audits) saveAudits(data.audits);
    if (data.settings) saveSettings(data.settings);
    if (data.purchaseOrders) savePurchaseOrders(data.purchaseOrders);
    if (data.cashbook) saveCashbook(data.cashbook);
    if (data.projects) saveProjects(data.projects);
    
    // Auto sync to cloud if online after restore
    if (isOnline && autoSyncEnabled) {
      setTimeout(() => {
        triggerSyncAll();
      }, 1500);
    }
  };

  const handleRestoreFromPostgres = async () => {
    if (!isOnline) {
      safeDispatchEvent("kiot-toast", {
        type: "stock-warning",
        title: "Khôi phục thất bại",
        message: "Không thể phục hồi khi đang ngoại tuyến."
      });
      return;
    }

    const tenantId = trialInfo?.id || "demo";
    try {
      let res: Response | null = null;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch(`/api/kiot/load/${tenantId}`);
          if (res) break;
        } catch (fetchErr) {
          lastErr = fetchErr;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }

      if (!res) {
        throw new Error(lastErr?.message === "Failed to fetch" ? "Kết nối mạng hoặc máy chủ bị gián đoạn (Failed to fetch)." : (lastErr?.message || "Không thể tải dữ liệu từ máy chủ."));
      }

      if (!res.ok) {
        throw new Error("Không thể tải dữ liệu từ PostgreSQL (Mã lỗi " + res.status + ").");
      }
      const data = await res.json();
      
      // Load tables to state and localStorage
      if (data.products) saveProducts(data.products);
      if (data.categories) saveCategories(data.categories);
      if (data.customers) saveCustomers(data.customers);
      if (data.suppliers) saveSuppliers(data.suppliers);
      if (data.invoices) saveInvoices(data.invoices);
      if (data.audits) saveAudits(data.audits);
      if (data.staff) {
        saveStaff(data.staff);
      }
      if (data.settings) {
        saveSettings(data.settings);
      }
      if (data.purchaseOrders) savePurchaseOrders(data.purchaseOrders);
      if (data.cashbook) saveCashbook(data.cashbook);
      if (data.projects) saveProjects(data.projects);
      if (data.systemLogs) {
        setSystemLogs(data.systemLogs);
        localStorage.setItem(getDynamicKey("system_logs"), JSON.stringify(data.systemLogs));
      }

      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "Khôi phục thành công! 🎉",
        message: "Toàn bộ dữ liệu của bạn đã được tải xuống và khôi phục hoàn toàn từ đám mây PostgreSQL."
      });
    } catch (error: any) {
      console.error("Lỗi phục hồi từ PostgreSQL:", error);
      alert("Có lỗi xảy ra khi phục hồi dữ liệu từ PostgreSQL: " + error.message);
    }
  };

  // 5b. Real-Time Cross-Device Sync Engine (Initial safe pull/push & Periodic background sync)
  useEffect(() => {
    if (!isOnline) return;
    const tenantId = trialInfo?.id || "demo";

    const getLocalData = <T,>(key: string): T[] => {
      const str = localStorage.getItem(getDynamicKey(key));
      if (!str) return [];
      try { return JSON.parse(str); } catch (e) { return []; }
    };

    const mergeLists = <T extends { id: string | number }>(localList: T[], serverList: T[]): T[] => {
      if (!serverList || serverList.length === 0) return localList || [];
      if (!localList || localList.length === 0) return serverList || [];
      const mergedMap = new Map<string | number, T>();
      // Insert server items first
      serverList.forEach(item => { if (item && item.id) mergedMap.set(item.id, item); });
      // Overlay with local items (local represents newer state from this active session)
      localList.forEach(item => { if (item && item.id) mergedMap.set(item.id, item); });
      return Array.from(mergedMap.values());
    };

    const syncState = async (isInitial = false) => {
      if (isSyncingRef.current || isSyncingAllRef.current) {
        console.log("[Cross-Device Sync] Skipping background sync pull because a sync/push is actively running...");
        return;
      }
      try {
        console.log(`[Cross-Device Sync] Synchronizing tenant ${tenantId}...`);
        const res = await fetch(`/api/kiot/load/${tenantId}`);
        if (!res.ok) throw new Error("Load failed");
        
        const data = await res.json();
        const hasCloudData = (data.products && data.products.length > 0) || 
                             (data.invoices && data.invoices.length > 0) ||
                             (data.customers && data.customers.length > 0) ||
                             (data.settings && data.settings.shopName);

        const localProducts = getLocalData<Product>("products");
        const localCategories = getLocalData<Category>("categories");
        const localCustomers = getLocalData<Customer>("customers");
        const localSuppliers = getLocalData<Supplier>("suppliers");
        const localInvoices = getLocalData<Invoice>("invoices");
        const localAudits = getLocalData<InventoryAudit>("audits");
        const localStaff = getLocalData<Staff>("staff");
        const localPurchaseOrders = getLocalData<PurchaseOrder>("purchase_orders");
        const localCashbook = getLocalData<CashbookEntry>("cashbook");
        const localProjects = getLocalData<Project>("projects");
        const localSystemLogs = getLocalData<SystemAuditLog>("system_logs");
        
        if (hasCloudData) {
          // Cloud has data. Let's load or merge it safely!
          if (data.products) {
            const merged = mergeLists(localProducts, data.products);
            setProducts(merged);
            localStorage.setItem(getDynamicKey("products"), JSON.stringify(merged));
          }
          if (data.categories) {
            const merged = mergeLists(localCategories, data.categories);
            setCategories(merged);
            localStorage.setItem(getDynamicKey("categories"), JSON.stringify(merged));
          }
          if (data.customers) {
            const merged = mergeLists(localCustomers, data.customers);
            setCustomers(merged);
            localStorage.setItem(getDynamicKey("customers"), JSON.stringify(merged));
          }
          if (data.suppliers) {
            const merged = mergeLists(localSuppliers, data.suppliers);
            setSuppliers(merged);
            localStorage.setItem(getDynamicKey("suppliers"), JSON.stringify(merged));
          }
          if (data.invoices) {
            const merged = mergeLists(localInvoices, data.invoices);
            setInvoices(merged);
            localStorage.setItem(getDynamicKey("invoices"), JSON.stringify(merged));
          }
          if (data.audits) {
            const merged = mergeLists(localAudits, data.audits);
            setAudits(merged);
            localStorage.setItem(getDynamicKey("audits"), JSON.stringify(merged));
          }
          if (data.staff) {
            const merged = mergeLists(localStaff, data.staff);
            setStaff(merged);
            localStorage.setItem(getDynamicKey("staff"), JSON.stringify(merged));
          }
          if (data.settings) {
            setSettings(data.settings);
            localStorage.setItem(getDynamicKey("settings"), JSON.stringify(data.settings));
            document.title = data.settings.shopName;
          }
          if (data.purchaseOrders) {
            const merged = mergeLists(localPurchaseOrders, data.purchaseOrders);
            setPurchaseOrders(merged);
            localStorage.setItem(getDynamicKey("purchase_orders"), JSON.stringify(merged));
          }
          if (data.cashbook) {
            const merged = mergeLists(localCashbook, data.cashbook);
            setCashbook(merged);
            localStorage.setItem(getDynamicKey("cashbook"), JSON.stringify(merged));
          }
          if (data.projects) {
            const merged = mergeLists(localProjects, data.projects);
            setProjects(merged);
            localStorage.setItem(getDynamicKey("projects"), JSON.stringify(merged));
          }
          if (data.systemLogs) {
            const merged = mergeLists(localSystemLogs, data.systemLogs);
            setSystemLogs(merged);
            localStorage.setItem(getDynamicKey("system_logs"), JSON.stringify(merged));
          }
          
          const nowStr = new Date().toISOString();
          setLastSyncTime(nowStr);
          localStorage.setItem("kiot_last_sync_time", nowStr);
          
          if (isInitial) {
            safeDispatchEvent("kiot-toast", {
              type: "success",
              title: "Đồng bộ đám mây thành công! 🌐",
              message: "Cửa hàng của bạn đã được kết nối và tải toàn bộ dữ liệu đồng bộ thời gian thực từ đám mây."
            });
          }
        } else if (isInitial && localProducts.length > 0) {
          // Cloud has NO data but local HAS data: automatically upload to initialize cloud!
          console.log(`[Cross-Device Sync] Cloud is empty but local has data. Uploading local state...`);
          await triggerSyncAll(undefined, true);
        }
      } catch (err) {
        console.warn("[Cross-Device Sync] Background sync helper error:", err);
      }
    };

    // Initial sync
    const timeout = setTimeout(() => syncState(true), 1500);

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      if (autoSyncEnabled) {
        syncState(false);
      }
    }, 30000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [trialInfo, isOnline, autoSyncEnabled]);

  // 6. Database Mutation Handlers
  const handleAddInvoice = (newInv: Invoice) => {
    const updatedInvoices = [newInv, ...invoices];
    
    // Save invoices locally
    setInvoices(updatedInvoices);
    localStorage.setItem(getDynamicKey("invoices"), JSON.stringify(updatedInvoices));

    const matchedCustomer = newInv.customerId ? customers.find(c => c.id === newInv.customerId) : null;
    const customerEmail = matchedCustomer?.email;

    // Network status handling for simulated cloud vs offline sync
    if (isOnline) {
      // Direct save to online server simulation
      const serverInvs = localStorage.getItem("kiot_server_invoices");
      const currentServerList: Invoice[] = serverInvs ? JSON.parse(serverInvs) : [];
      localStorage.setItem("kiot_server_invoices", JSON.stringify([newInv, ...currentServerList]));

      // Immediate Firestore backup if auto-sync is enabled
      if (autoSyncEnabled) {
        safeSetDoc(doc(db, "kiot_invoices", newInv.id), newInv).catch(err => {
          console.error("Lỗi đồng bộ hóa đơn lên Firestore:", err);
        });
      }

      // Dispatch success toast with server synced tag
      safeDispatchEvent("kiot-toast", {
        type: "invoice",
        title: "Bán hàng trực tuyến thành công",
        message: `Hóa đơn ${newInv.invoiceCode} đã được đồng bộ lên hệ thống máy chủ đám mây.`
      });

      // Send invoice email if customer email is available
      if (customerEmail) {
        fetch("/api/kiot/email-invoice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoice: {
              ...newInv,
              trialId: trialInfo?.id || "default"
            },
            customerEmail,
            shopSetting: settings,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              console.log("Email sent successfully:", data);
              if (data.sentResult?.isDemo && data.sentResult?.previewUrl) {
                safeDispatchEvent("kiot-toast", {
                  type: "success",
                  title: "Thư xác nhận (Demo)",
                  message: `Hóa đơn #${newInv.invoiceCode} đã được gửi đến ${customerEmail}. Xem hộp thư tại: ${data.sentResult.previewUrl}`,
                });
              } else {
                safeDispatchEvent("kiot-toast", {
                  type: "success",
                  title: "Đã gửi hóa đơn qua email",
                  message: `Đã gửi email xác nhận hóa đơn đến hòm thư ${customerEmail} thành công.`,
                });
              }
            } else {
              console.error("Email sending returned error response:", data.error);
            }
          })
          .catch((err) => {
            console.error("Failed to send invoice email via API:", err);
          });
      }
    } else {
      // Queue for offline sync when internet returns
      const updatedQueue = [newInv, ...offlineQueue];
      setOfflineQueue(updatedQueue);
      localStorage.setItem("kiot_offline_queue", JSON.stringify(updatedQueue));

      // Dispatch alert toast indicating it is cached locally
      safeDispatchEvent("kiot-toast", {
        type: "stock-warning",
        title: "Bán hàng ngoại tuyến (Offline) thành công",
        message: `Hóa đơn ${newInv.invoiceCode} đã được lưu tạm tại thiết bị này. Hệ thống sẽ tự đồng bộ khi có mạng.`
      });
    }

    // If customer is attached, accumulate totalSpent and points, update tier
    let updatedCustomers = customers;
    if (newInv.customerId) {
      updatedCustomers = customers.map(c => {
        if (c.id === newInv.customerId) {
          const newSpent = c.totalSpent + newInv.totalPayable;
          const newPoints = c.points + newInv.pointsEarned;
          const currentDebt = c.debt || 0;
          const newDebt = newInv.paymentMethod === "DEBT" ? currentDebt + newInv.totalPayable : currentDebt;
          
          // Determine tier based on total spent
          let newTier = c.tier;
          if (newSpent >= 50000000) newTier = "Diamond";
          else if (newSpent >= 20000000) newTier = "Gold";
          else if (newSpent >= 10000000) newTier = "Silver";
          else if (newSpent >= 5000000) newTier = "Bronze";

          return { ...c, totalSpent: newSpent, points: newPoints, tier: newTier, debt: newDebt };
        }
        return c;
      });
      // Save customers locally
      setCustomers(updatedCustomers);
      localStorage.setItem(getDynamicKey("customers"), JSON.stringify(updatedCustomers));
    }

    // Automatically record sales income in cashbook if paid immediately
    let updatedCashbook = cashbook;
    if (newInv.paymentMethod === "CASH" || newInv.paymentMethod === "BANK_TRANSFER" || newInv.paymentMethod === "CREDIT_CARD") {
      const cashbookMethod = newInv.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH";
      const newEntry: CashbookEntry = {
        id: `cb-${Date.now()}`,
        entryCode: `SQ${Math.floor(100000 + Math.random() * 900000)}`,
        type: "INCOME",
        amount: newInv.totalPayable,
        category: "Doanh thu bán hàng",
        description: `Thu tiền bán hàng - Hóa đơn ${newInv.invoiceCode}`,
        paymentMethod: cashbookMethod as "CASH" | "BANK_TRANSFER",
        date: newInv.date,
        creatorName: newInv.cashierName || "Hệ thống"
      };
      updatedCashbook = [newEntry, ...cashbook];
      // Save cashbook locally
      setCashbook(updatedCashbook);
      localStorage.setItem(getDynamicKey("cashbook"), JSON.stringify(updatedCashbook));
    }

    // Trigger ONE SINGLE synchronized database backup to PostgreSQL containing all local overrides!
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({
        invoices: updatedInvoices,
        customers: updatedCustomers,
        cashbook: updatedCashbook
      }, true);
    }
  };

  const handleUpdateInvoice = (updatedInv: Invoice) => {
    const updatedInvoices = invoices.map(inv => inv.id === updatedInv.id ? updatedInv : inv);
    saveInvoices(updatedInvoices);

    // Save/backup to online server simulation
    const serverInvs = localStorage.getItem("kiot_server_invoices");
    if (serverInvs) {
      const currentServerList: Invoice[] = JSON.parse(serverInvs);
      const updatedServerList = currentServerList.map(inv => inv.id === updatedInv.id ? updatedInv : inv);
      localStorage.setItem("kiot_server_invoices", JSON.stringify(updatedServerList));
    }

    // Cloud/Sync backup if online and auto-sync is enabled
    if (isOnline && autoSyncEnabled) {
      safeSetDoc(doc(db, "kiot_invoices", updatedInv.id), updatedInv).catch(err => {
        console.error("Lỗi đồng bộ hóa đơn cập nhật lên Firestore:", err);
      });
    }

    // Add system log
    const newLog: SystemAuditLog = {
      id: `log-${Date.now()}`,
      actionType: "INVOICE_UPDATE",
      actionName: "Cập nhật hóa đơn",
      description: `Phát hành hóa đơn điện tử cho hóa đơn ${updatedInv.invoiceCode}.`,
      actorName: currentStaff?.name || "Hệ thống",
      actorRole: currentStaff?.role || "OWNER",
      timestamp: new Date().toISOString()
    };
    saveSystemLogs([newLog, ...systemLogs]);
  };

  const handleCancelInvoice = (invoiceId: string, reason: string, cancelledBy: string) => {
    // 1. Update the Invoice status, details
    const targetInvoice = invoices.find(inv => inv.id === invoiceId);
    if (!targetInvoice || targetInvoice.status === "CANCELLED") return;

    const cancelledInv: Invoice = {
      ...targetInvoice,
      status: "CANCELLED",
      cancelReason: reason,
      cancelledBy: cancelledBy,
      cancelDate: new Date().toISOString()
    };

    const updatedInvoices = invoices.map(inv => inv.id === invoiceId ? cancelledInv : inv);
    
    // Save invoices locally
    setInvoices(updatedInvoices);
    localStorage.setItem(getDynamicKey("invoices"), JSON.stringify(updatedInvoices));

    // 2. Restore Inventory (Hoàn kho)
    const updatedProducts = products.map(p => {
      const orderItem = targetInvoice.items.find(item => item.productId === p.id);
      if (orderItem) {
        return {
          ...p,
          stock: p.stock + orderItem.quantity
        };
      }
      return p;
    });

    // Notify components that stock was modified to refresh views
    if (products.length === updatedProducts.length) {
      updatedProducts.forEach((p, idx) => {
        if (p.stock !== products[idx].stock) {
          safeDispatchEvent("kiot-product-stock-change", {
            productId: p.id,
            newStock: p.stock
          });
        }
      });
    }

    // Save products locally
    setProducts(updatedProducts);
    localStorage.setItem(getDynamicKey("products"), JSON.stringify(updatedProducts));

    // 3. Revert Customer values (Dòng khách hàng)
    let updatedCustomers = customers;
    if (targetInvoice.customerId) {
      updatedCustomers = customers.map(c => {
        if (c.id === targetInvoice.customerId) {
          const newSpent = Math.max(0, c.totalSpent - targetInvoice.totalPayable);
          const newPoints = Math.max(0, c.points - targetInvoice.pointsEarned);
          const currentDebt = c.debt || 0;
          const newDebt = targetInvoice.paymentMethod === "DEBT" ? Math.max(0, currentDebt - targetInvoice.totalPayable) : currentDebt;

          // Re-evaluate tier
          let newTier = c.tier;
          if (newSpent >= 50000000) newTier = "Diamond";
          else if (newSpent >= 20000000) newTier = "Gold";
          else if (newSpent >= 10000000) newTier = "Silver";
          else if (newSpent >= 5000000) newTier = "Bronze";
          else newTier = "Standard";

          return { ...c, totalSpent: newSpent, points: newPoints, tier: newTier, debt: newDebt };
        }
        return c;
      });
      // Save customers locally
      setCustomers(updatedCustomers);
      localStorage.setItem(getDynamicKey("customers"), JSON.stringify(updatedCustomers));
    }

    // 4. Reverse Cashbook flow (Đảo dòng tiền)
    let updatedCashbookList = [...cashbook];
    if (targetInvoice.paymentMethod === "CASH" || targetInvoice.paymentMethod === "BANK_TRANSFER" || targetInvoice.paymentMethod === "CREDIT_CARD") {
      const cashbookMethod = targetInvoice.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH";
      const newEntry: CashbookEntry = {
        id: `cb-${Date.now()}`,
        entryCode: `SQ${Math.floor(100000 + Math.random() * 900000)}`,
        type: "EXPENSE",
        amount: targetInvoice.totalPayable,
        category: "Chi hủy đơn hàng / Hoàn trả khách",
        description: `Hoàn tiền do hủy hóa đơn ${targetInvoice.invoiceCode} - Lý do: ${reason}`,
        paymentMethod: cashbookMethod as "CASH" | "BANK_TRANSFER",
        date: new Date().toISOString().split("T")[0],
        creatorName: cancelledBy
      };
      updatedCashbookList = [newEntry, ...cashbook];
      // Save cashbook locally
      setCashbook(updatedCashbookList);
      localStorage.setItem(getDynamicKey("cashbook"), JSON.stringify(updatedCashbookList));
    }

    // 5. Cloud/Sync backups if online and auto-sync is enabled
    if (isOnline && autoSyncEnabled) {
      // Direct save to online server simulation
      const serverInvs = localStorage.getItem("kiot_server_invoices");
      if (serverInvs) {
        const currentServerList: Invoice[] = JSON.parse(serverInvs);
        const updatedServerList = currentServerList.map(inv => inv.id === invoiceId ? cancelledInv : inv);
        localStorage.setItem("kiot_server_invoices", JSON.stringify(updatedServerList));
      }

      // Sync specific cancelled invoice
      safeSetDoc(doc(db, "kiot_invoices", invoiceId), cancelledInv).catch(err => {
        console.error("Lỗi đồng bộ hóa đơn hủy lên Firestore:", err);
      });

      // Sync restored products
      targetInvoice.items.forEach(item => {
        const prod = updatedProducts.find(p => p.id === item.productId);
        if (prod) {
          safeSetDoc(doc(db, "kiot_products", prod.id), prod).catch(err => {
            console.error("Lỗi đồng bộ tồn kho sản phẩm hoàn lên Firestore:", err);
          });
        }
      });

      // Sync updated customer if any
      if (targetInvoice.customerId) {
        const cust = updatedCustomers.find(c => c.id === targetInvoice.customerId);
        if (cust) {
          safeSetDoc(doc(db, "kiot_customers", cust.id), cust).catch(err => {
            console.error("Lỗi đồng bộ khách hàng hoàn điểm lên Firestore:", err);
          });
        }
      }

      // Sync new Cashbook reverse entry if any
      if (updatedCashbookList.length > cashbook.length) {
        const entry = updatedCashbookList[0];
        safeSetDoc(doc(db, "kiot_cashbook", entry.id), entry).catch(err => {
          console.error("Lỗi đồng bộ phiếu chi hoàn tiền lên Firestore:", err);
        });
      }

      // Single consolidated backup sync to PostgreSQL
      triggerSyncAll({
        invoices: updatedInvoices,
        products: updatedProducts,
        customers: updatedCustomers,
        cashbook: updatedCashbookList
      }, true);
    }

    // Dispatch custom event for a beautiful toast
    safeDispatchEvent("kiot-toast", {
      type: "stock-warning", // use stock-warning for red/alert look
      title: "ĐÃ HỦY HÓA ĐƠN",
      message: `Hóa đơn ${targetInvoice.invoiceCode} đã được hủy. Hệ thống tự động hoàn kho ${targetInvoice.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm và đảo dòng tiền.`
    });
  };

  const handleUpdateProductStock = (productId: string, newStock: number) => {
    const updated = products.map(p => p.id === productId ? { ...p, stock: Math.max(0, newStock) } : p);
    saveProducts(updated);
  };

  // Reset database completely to defaults
  const handleResetDatabase = () => {
    if (currentStaff) {
      const isOwner = currentStaff.email?.toLowerCase() === "congbaotruong8@gmail.com";
      const isAllowed = isOwner || currentStaff.role === "OWNER" || currentStaff.role === "MANAGER";
      if (!isAllowed) {
        safeDispatchEvent("kiot-toast", {
          type: "stock-warning",
          title: "Quyền bị từ chối",
          message: "Chỉ Chủ cửa hàng (Owner) hoặc Quản lý (Manager) mới có quyền reset cơ sở dữ liệu."
        });
        return;
      }
    }
    setShowResetConfirmModal(true);
  };

  const executeResetDatabase = async () => {
    setShowResetConfirmModal(false);
    const prefix = trialInfo ? `kiot_trial_${trialInfo.id}_` : "kiot_";

    // Helper to clear all kiot_ local storage keys, preserving session/identity keys
    const clearKiotLocalStorageKeys = () => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("kiot_")) {
          // Preserve the critical session/identity keys
          if (
            key !== "kiot_current_staff" && 
            key !== "kiot_theme" && 
            key !== "kiot_trial_info" &&
            key !== "kiot_deleted_trial_ids"
          ) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    };

    if (resetType === "hard") {
      // 1. HARD RESET: Complete slate wipeout
      const defaultSettingsForTrial = {
        shopName: trialInfo ? trialInfo.shopName : "KiotX Store",
        address: (trialInfo && trialInfo.address) || "Đang dùng thử KiotX",
        phone: trialInfo ? trialInfo.phone : "0900000000",
        taxRate: 0,
        currency: "VND",
        zaloNumber: trialInfo ? trialInfo.phone : "0900000000",
        seoTitle: trialInfo ? trialInfo.shopName : "KiotX Store",
        seoKeywords: "kiotx, shop",
        eInvoiceEnabled: false
      };

      const keptStaff = currentStaff ? [currentStaff] : DEFAULT_STAFF;

      if (trialInfo) {
        // SaaS trial store complete hard reset
        try {
          const response = await fetch(`/api/kiot/sync/${trialInfo.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              products: [],
              categories: [],
              customers: [],
              suppliers: [],
              invoices: [],
              staff: keptStaff,
              settings: defaultSettingsForTrial,
              audits: [],
              purchaseOrders: [],
              cashbook: [],
              projects: [],
              systemLogs: [],
              cashShifts: []
            })
          });

          if (response.ok) {
            console.log("Đã đồng bộ hard reset database của dùng thử lên PostgreSQL thành công.");
          } else {
            throw new Error("Server sync error");
          }
        } catch (err) {
          console.warn("Lỗi đồng bộ reset database lên PostgreSQL:", err);
        }
      }

      // Clear local storage and reload to trigger clean initialization
      clearKiotLocalStorageKeys();
      window.location.reload();

    } else {
      // 2. SELECTIVE ROLLBACK: Keep master catalog lists, filter transactions based on target time
      let targetDate = new Date();
      if (selectedCheckpoint === "today") {
        targetDate.setHours(0, 0, 0, 0);
      } else if (selectedCheckpoint === "yesterday") {
        targetDate.setDate(targetDate.getDate() - 1);
        targetDate.setHours(0, 0, 0, 0);
      } else if (selectedCheckpoint === "1hour") {
        targetDate = new Date(Date.now() - 60 * 60 * 1000);
      } else if (selectedCheckpoint === "custom") {
        targetDate = new Date(customResetDateTime);
      } else if (selectedCheckpoint === "registration") {
        targetDate = trialInfo ? new Date(trialInfo.createdAt) : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      }

      const isBeforeOrEqual = (dateStr?: string) => {
        if (!dateStr) return true;
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) {
            // Try fallback parsing if just YYYY-MM-DD format
            return new Date(dateStr + "T00:00:00").getTime() <= targetDate.getTime();
          }
          return d.getTime() <= targetDate.getTime();
        } catch (e) {
          return true;
        }
      };

      // Filter local lists
      const filteredInvoices = invoices.filter(item => isBeforeOrEqual(item.date));
      const filteredCashbook = cashbook.filter(item => isBeforeOrEqual(item.date));
      const filteredAudits = audits.filter(item => isBeforeOrEqual(item.date));
      const filteredPurchaseOrders = purchaseOrders.filter(item => isBeforeOrEqual(item.date));
      const filteredProjects = projects.filter(item => isBeforeOrEqual(item.startDate));
      const filteredCashShifts = cashShifts.filter(item => isBeforeOrEqual(item.startTime));
      const filteredSystemLogs = systemLogs.filter(item => isBeforeOrEqual(item.timestamp));

      if (trialInfo) {
        // SaaS trial store selective rollback sync
        try {
          const response = await fetch(`/api/kiot/sync/${trialInfo.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              products,
              categories,
              customers,
              suppliers,
              staff,
              settings,
              invoices: filteredInvoices,
              cashbook: filteredCashbook,
              audits: filteredAudits,
              purchaseOrders: filteredPurchaseOrders,
              projects: filteredProjects,
              systemLogs: filteredSystemLogs,
              cashShifts: filteredCashShifts
            })
          });

          if (response.ok) {
            console.log("Đã đồng bộ selective rollback lên PostgreSQL.");
          } else {
            throw new Error("Server sync error");
          }
        } catch (err) {
          console.warn("Lỗi đồng bộ selective rollback lên PostgreSQL:", err);
        }
      }

      // Save filtered lists back to local storage to persist instantly
      localStorage.setItem(`${prefix}invoices`, JSON.stringify(filteredInvoices));
      localStorage.setItem(`${prefix}cashbook`, JSON.stringify(filteredCashbook));
      localStorage.setItem(`${prefix}audits`, JSON.stringify(filteredAudits));
      localStorage.setItem(`${prefix}purchase_orders`, JSON.stringify(filteredPurchaseOrders));
      localStorage.setItem(`${prefix}projects`, JSON.stringify(filteredProjects));
      localStorage.setItem(`${prefix}cash_shifts`, JSON.stringify(filteredCashShifts));
      localStorage.setItem(`${prefix}system_logs`, JSON.stringify(filteredSystemLogs));

      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "Đã phục hồi dữ liệu! 🕒",
        message: `Hệ thống đã quay ngược cơ sở dữ liệu về trạng thái lúc ${targetDate.toLocaleTimeString("vi-VN")} ngày ${targetDate.toLocaleDateString("vi-VN")}`
      });

      // Reload to reflect all state updates cleanly
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleDeleteReportsData = (
    type: "invoices" | "cashbook" | "all",
    rangeType: "day" | "month" | "year" | "all",
    value: string
  ) => {
    const isMatch = (itemDate: string) => {
      if (rangeType === "all") return true;
      if (!itemDate) return false;
      const datePart = itemDate.split("T")[0]; // YYYY-MM-DD
      if (rangeType === "day") {
        return datePart === value;
      }
      if (rangeType === "month") {
        return datePart.substring(0, 7) === value; // YYYY-MM
      }
      if (rangeType === "year") {
        return datePart.substring(0, 4) === value; // YYYY
      }
      return false;
    };

    let deletedInvoicesCount = 0;
    let deletedCashbookCount = 0;

    let updatedInvoices = invoices;
    let updatedCashbook = cashbook;

    if (type === "invoices" || type === "all") {
      const originalLen = invoices.length;
      const matchedInvs = invoices.filter(inv => isMatch(inv.date));
      updatedInvoices = invoices.filter(inv => !isMatch(inv.date));
      deletedInvoicesCount = originalLen - updatedInvoices.length;
      
      setInvoices(updatedInvoices);
      localStorage.setItem(getDynamicKey("invoices"), JSON.stringify(updatedInvoices));

      // Delete from Firestore if online
      if (isOnline) {
        matchedInvs.forEach(inv => {
          safeDeleteDoc(doc(db, "kiot_invoices", inv.id)).catch(err => {
            console.error("Lỗi xóa hóa đơn trên Firestore:", err);
          });
        });
      }
    }

    if (type === "cashbook" || type === "all") {
      const originalLen = cashbook.length;
      const matchedEntries = cashbook.filter(entry => isMatch(entry.date));
      updatedCashbook = cashbook.filter(entry => !isMatch(entry.date));
      deletedCashbookCount = originalLen - updatedCashbook.length;
      
      setCashbook(updatedCashbook);
      localStorage.setItem(getDynamicKey("cashbook"), JSON.stringify(updatedCashbook));

      // Delete from Firestore if online
      if (isOnline) {
        matchedEntries.forEach(entry => {
          safeDeleteDoc(doc(db, "kiot_cashbook", entry.id)).catch(err => {
            console.error("Lỗi xóa sổ quỹ trên Firestore:", err);
          });
        });
      }
    }

    // Unified Cloud Sync to PostgreSQL (Cloud SQL)
    if (isOnline && autoSyncEnabled) {
      triggerSyncAll({
        invoices: updatedInvoices,
        cashbook: updatedCashbook
      }, true);
    }

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "Xóa dữ liệu thành công",
      message: `Đã xóa ${deletedInvoicesCount} hóa đơn và ${deletedCashbookCount} phiếu thu chi trong khoảng thời gian đã chọn.`
    });

    return { deletedInvoicesCount, deletedCashbookCount };
  };

  // Toggle Theme helper
  const handleToggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("kiot_theme", newTheme);
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="font-bold text-xs uppercase tracking-widest">Đang khởi động hệ thống KiotX...</span>
        </div>
      </div>
    );
  }

  if (!currentStaff) {
    return (
      <KiotLogin
        onSelectStaff={handleSelectSimulatedStaff}
        onGoogleLogin={handleGoogleLogin}
        isSyncing={isSyncing}
        shopName={settings.shopName}
      />
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased transition-all overflow-x-hidden ${
      theme === "dark" 
        ? "bg-stone-950 text-stone-200 selection:bg-emerald-500 selection:text-stone-950" 
        : "bg-stone-50 text-stone-800 selection:bg-emerald-500 selection:text-stone-950"
    }`}>
      
      {/* GLOWING WEB3 BG GRID ACCENTS (Only in dark theme for high fidelity aesthetics) */}
      {theme === "dark" && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-25">
          <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
          <div className="absolute top-[40%] right-[20%] h-[400px] w-[400px] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>
      )}

      {/* MASTER FLEX CONTAINER (Sidebar + Main panel) */}
      <div className="relative z-10 flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden">
        
        {/* SIDEBAR NAVIGATION RAIL (Web3 Neon Cyberpunk style) */}
        <aside className={`shrink-0 flex flex-col justify-between transition-all duration-300 z-20 md:h-full md:overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent ${
          isSidebarOpen 
            ? "w-full md:w-64 p-4 border-b md:border-b-0 md:border-r opacity-100" 
            : "w-0 h-0 p-0 md:w-0 overflow-hidden border-0 opacity-0 pointer-events-none"
        } ${
          theme === "dark" 
            ? "bg-stone-900/80 border-stone-850 backdrop-blur-xl" 
            : "bg-white border-stone-200"
        }`}>
          <div className="space-y-6">
            {/* Logo and Brand Title */}
            <div className="flex items-center justify-between px-2 pb-4 border-b border-stone-850/60 gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-0.5 shadow-lg shadow-emerald-500/10">
                  <div className="h-full w-full rounded-[14px] bg-stone-950 flex items-center justify-center font-black text-emerald-400 font-mono text-base tracking-tighter">
                    Kx
                  </div>
                </div>
                <div className="space-y-0.5 leading-none">
                  <h1 className="text-sm font-black uppercase tracking-wider text-stone-100 flex items-center gap-1">
                    <span className="truncate">KiotX PRO</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  </h1>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest leading-none">v1.2.6 (Bản chuẩn)</p>
                </div>
              </div>
              <button
                onClick={handleToggleSidebar}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  theme === "dark" 
                    ? "bg-stone-950 text-stone-400 border-stone-850 hover:bg-stone-900 hover:text-emerald-400" 
                    : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200 hover:text-stone-800"
                }`}
                title="Đóng thanh công cụ"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* SaaS Trial status on Sidebar if present */}
            {trialInfo && (
              <div className={`p-3 rounded-xl space-y-2 ${
                theme === "dark" ? "bg-stone-950/60 border border-stone-850/80" : "bg-stone-100/80 border border-stone-200"
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    <span className="text-amber-500 uppercase flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                      {trialInfo.status === "CONVERTED" ? "Bản quyền PRO" : "Dùng thử 20 ngày"}
                    </span>
                    <span className={trialInfo.status === "CONVERTED" ? "text-emerald-400" : (trialDaysLeft !== null && trialDaysLeft <= 3 ? "text-rose-400" : "text-emerald-400")}>
                      {trialInfo.status === "CONVERTED" ? "Trọn đời" : `Còn ${trialDaysLeft !== null ? Math.max(0, trialDaysLeft) : 0} ngày`}
                    </span>
                  </div>
                  {trialInfo.status !== "CONVERTED" ? (
                    <div className="w-full bg-stone-900 rounded-full h-1 overflow-hidden border border-stone-850/60">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          trialDaysLeft !== null && trialDaysLeft <= 3 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                        }`} 
                        style={{ width: `${Math.max(0, Math.min(100, (trialDaysLeft !== null ? trialDaysLeft : 0) / 20 * 100))}%` }} 
                      />
                    </div>
                  ) : (
                    <div className="w-full bg-emerald-500/10 rounded h-1 overflow-hidden" />
                  )}
                  {/* Button Gia hạn dùng thử */}
                  <button
                    onClick={() => setIsOpenTrialModal(true)}
                    className="w-full mt-1.5 px-2 py-1 bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 hover:border-indigo-500/40 text-[9px] font-bold uppercase tracking-wider text-indigo-300 hover:text-white rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Sparkles className="h-2.5 w-2.5 shrink-0 animate-pulse" />
                    <span>{trialInfo.status === "CONVERTED" ? "Thông tin Bản quyền" : "Gia hạn dùng thử"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Main Tabs Navigation */}
            <nav className="space-y-1.5">
              {[
                { id: "dashboard", label: "Tổng quan", desc: "Doanh thu, báo cáo, tồn kho", icon: LayoutDashboard },
                { id: "pos", label: "Bán hàng POS", desc: "Mở quầy bán hàng trực quan", icon: ShoppingCart, highlight: true },
                { id: "products", label: "Hàng hóa & Kho", desc: "Quản lý tồn, kiểm kho thực tế", icon: Package },
                { id: "partners", label: "Khách hàng & NCC", desc: "Đối tác VIP, tích điểm, NCC", icon: Users },
                { id: "cashbook", label: "Sổ Quỹ", desc: "Dòng tiền thu chi, két quỹ", icon: Wallet },
                { id: "settings", label: "Thiết lập", desc: "Nhân viên, thông tin biên lai", icon: Settings },
                ...(currentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com" ? [
                  { id: "trials_manager", label: "Dùng thử SaaS", desc: "Quản lý cấp phép & dùng thử", icon: Sparkles }
                ] : [])
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isAllowed = isTabAllowed(item.id, currentStaff);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between transition-all text-left relative cursor-pointer group ${
                      isActive 
                        ? item.highlight 
                          ? "bg-emerald-500 text-stone-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.25)]" 
                          : item.id === "trials_manager"
                            ? "bg-indigo-600 text-stone-100 border-l-4 border-indigo-400 font-bold shadow-[0_0_15px_rgba(79,70,229,0.25)]"
                            : "bg-stone-800 text-stone-100 border-l-4 border-emerald-500 font-bold"
                        : !isAllowed
                          ? "opacity-60 hover:opacity-85 text-stone-500 hover:text-stone-400"
                          : theme === "dark"
                            ? "hover:bg-stone-850 text-stone-400 hover:text-stone-200"
                            : "hover:bg-stone-100 text-stone-600 hover:text-stone-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 shrink-0 ${
                        isActive 
                          ? "text-inherit" 
                          : item.highlight 
                            ? "text-emerald-400 group-hover:animate-bounce" 
                            : item.id === "trials_manager"
                              ? "text-indigo-400 animate-pulse"
                              : !isAllowed
                                ? "text-stone-600"
                                : "text-stone-500"
                      }`} />
                      <div className="space-y-0.5 leading-none">
                        <span className="text-xs uppercase tracking-wider font-extrabold block">{item.label}</span>
                        <span className={`text-[9px] block ${isActive ? "text-inherit opacity-75" : "text-stone-500"}`}>{item.desc}</span>
                      </div>
                    </div>

                    {!isAllowed && (
                      <span className="text-stone-600 group-hover:text-amber-500 transition-colors" title="Bị hạn chế quyền truy cập">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}

                    {item.id === "pos" && isAllowed && !isActive && (
                      <span className="absolute right-3.5 px-1.5 py-0.5 text-[8px] bg-emerald-500/10 text-emerald-400 font-bold rounded-full border border-emerald-500/20 animate-pulse">
                        LIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="space-y-3.5 pt-6 border-t border-stone-850/60">
            {/* Quick Theme Toggle (Fully centered without Reset DB button for cleaner safety) */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={handleToggleTheme}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  theme === "dark" 
                    ? "bg-stone-950 text-amber-400 border-stone-850 hover:bg-stone-900" 
                    : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                }`}
                title={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest">
                KiotX SaaS Secure
              </span>
            </div>

            {/* Active Cashier Card */}
            {currentStaff && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950/40 border border-stone-850/50">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] text-emerald-400">
                    {currentStaff.name.split(" ").map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-0.5 leading-none">
                    <span className="text-[10px] font-bold text-stone-300 block truncate max-w-[100px]" title={currentStaff.name}>
                      {currentStaff.name}
                    </span>
                    <span className="text-[8px] text-stone-500 block uppercase font-bold tracking-wider">
                      {currentStaff.role === "OWNER" ? "Chủ cửa hàng" : currentStaff.role === "MANAGER" ? "Quản lý" : "Thu ngân"}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg hover:bg-stone-900 text-stone-500 hover:text-stone-300 transition-all cursor-pointer"
                  title="Đăng xuất khỏi quầy"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN DISPLAY REGION (Top Header Bar + Inner Content Panel) */}
        <main className="flex-1 flex flex-col min-h-screen md:h-full md:overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent">
          
          {/* TOP BAR PANEL (越南/Bình Dương Live Headquarter Indicators) */}
          <header className={`border-b p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-all ${
            theme === "dark" 
              ? "bg-stone-900/60 border-stone-850 backdrop-blur-md" 
              : "bg-white border-stone-200"
          }`}>
            <div className="flex items-center gap-3">
              {/* Sidebar Collapse/Expand Toggle Button */}
              <button
                onClick={handleToggleSidebar}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                  !isSidebarOpen 
                    ? theme === "dark"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse"
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : theme === "dark"
                      ? "bg-stone-950 text-stone-400 border-stone-850 hover:bg-stone-900 hover:text-stone-200"
                      : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200 hover:text-stone-800"
                }`}
                title={isSidebarOpen ? "Đóng thanh công cụ" : "Mở thanh công cụ (Menu)"}
              >
                {isSidebarOpen ? (
                  <Menu className="h-4 w-4 shrink-0" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Menu className="h-4 w-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider pr-1">MỞ MENU</span>
                  </div>
                )}
              </button>

              {/* Dynamic Screen Title */}
              <h2 className="text-sm font-black uppercase tracking-widest text-stone-100 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span>
                  {activeTab === "dashboard" ? "Bảng Điều Khiển Tổng Quan" :
                   activeTab === "pos" ? "Quầy Thu Ngân Bán Hàng" :
                   activeTab === "products" ? "Quản Lý Hàng Hóa & Kiểm Kho" :
                   activeTab === "partners" ? "Đối Tác Khách Hàng & Nhà Cung Cấp" : 
                   "Thiết Lập Hệ Thống"}
                </span>
              </h2>
            </div>

            {/* Real-time clocks, status, and AI trigger */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* Connection Status & Simulation Switcher (Modern Sliding Toggle Switch) */}
              <div 
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2.5 transition-all select-none ${
                  isOnline 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                    : !isRealOnline 
                      ? "bg-rose-500/5 border-rose-500/20 text-rose-400"
                      : "bg-stone-900 border-stone-850 text-stone-400"
                }`}
                title={isOnline ? "Bấm công tắc để ngắt kết nối mạng (Bán hàng Offline)" : "Bấm công tắc để kết nối mạng trực tuyến (Tự đồng bộ)"}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Mạng (Wi-Fi):</span>
                
                {/* Simulated Switch Widget */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => {
                    const targetState = !isOnline;
                    if (targetState) {
                      if (!isRealOnline) {
                        safeDispatchEvent("kiot-toast", {
                          type: "stock-warning",
                          title: "Không thể kết nối trực tuyến 📡",
                          message: "Thiết bị thực tế của bạn hiện đang mất tín hiệu Wi-Fi hoặc không có kết nối Internet!"
                        });
                        return;
                      }
                      setIsManualOffline(false);
                      localStorage.setItem("kiot_manual_offline", "false");
                      setIsOnline(true);
                      safeDispatchEvent("kiot-toast", {
                        type: "success",
                        title: "Chuyển sang Trực tuyến ✅",
                        message: "Đã bật kết nối mạng. Hệ thống tự động đồng bộ hóa hóa đơn và dữ liệu lên máy chủ đám mây."
                      });
                    } else {
                      setIsManualOffline(true);
                      localStorage.setItem("kiot_manual_offline", "true");
                      setIsOnline(false);
                      safeDispatchEvent("kiot-toast", {
                        type: "stock-warning",
                        title: "Chuyển sang Ngoại tuyến ⛔",
                        message: "Bạn đã chủ động tắt kết nối mạng. Dữ liệu bán hàng sẽ được lưu tạm tại trình duyệt."
                      });
                    }
                  }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center cursor-pointer ${
                    isOnline ? "bg-emerald-500/40 border border-emerald-500/30" : "bg-stone-800 border border-stone-700"
                  }`}
                >
                  <div 
                    className={`w-3.5 h-3.5 rounded-full transition-transform duration-200 shadow-md ${
                      isOnline 
                        ? "translate-x-4 bg-emerald-400" 
                        : "translate-x-0 bg-stone-500"
                    }`} 
                  />
                </button>

                {/* Status Indicator text and count */}
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider font-sans">
                  {isSyncing ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Đồng bộ...</span>
                    </span>
                  ) : isOnline ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Wifi className="h-3 w-3 animate-pulse" />
                      <span>Trực tuyến</span>
                    </span>
                  ) : !isRealOnline ? (
                    <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                      <WifiOff className="h-3 w-3 text-rose-400" />
                      <span>Mất Wi-Fi máy thật 📡</span>
                    </span>
                  ) : (
                    <span className="text-stone-400 flex items-center gap-1">
                      <WifiOff className="h-3 w-3 text-stone-500" />
                      <span>Ngoại tuyến (Tắt)</span>
                    </span>
                  )}

                  {offlineQueue.length > 0 && (
                    <span className="bg-amber-500 text-stone-950 text-[9px] px-1.5 py-0.5 rounded font-mono font-black animate-bounce shrink-0 ml-1">
                      {offlineQueue.length}
                    </span>
                  )}
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-2 ${
                theme === "dark" ? "bg-stone-950 border-stone-850 text-stone-300" : "bg-stone-100 border-stone-200 text-stone-700"
              }`}>
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold">{liveTime || "--:--:--"}</span>
                <span className="text-[9px] bg-stone-900 text-stone-500 font-sans px-1.5 py-0.5 rounded uppercase font-extrabold border border-stone-800">
                  ICT (GMT+7)
                </span>
              </div>

              {/* Bot trigger with glow badge */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.06)] animate-pulse transition-all"
              >
                <Bot className="h-4.5 w-4.5" />
                <span>Trợ Lý AI</span>
              </button>
            </div>
          </header>

          {/* Offline Mode Warning Banner */}
          {!isOnline && (
            <div className="bg-amber-500 text-stone-950 px-6 py-2.5 text-xs font-black uppercase tracking-wider flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-amber-600 shadow-md">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 animate-bounce text-stone-950 shrink-0" />
                <span>Bạn đang hoạt động ở chế độ Ngoại tuyến (Mất mạng). Bạn vẫn có thể thực hiện bán hàng & thanh toán bình thường!</span>
              </div>
              <div className="flex items-center gap-3">
                {offlineQueue.length > 0 ? (
                  <span className="bg-stone-900 text-amber-400 px-3 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wide border border-stone-800">
                    Chờ đồng bộ: {offlineQueue.length} hóa đơn
                  </span>
                ) : (
                  <span className="bg-emerald-950 text-emerald-400 px-3 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wide border border-emerald-900">
                    Sẵn sàng đồng bộ
                  </span>
                )}
                <button
                  onClick={() => setIsOnline(true)}
                  className="px-3 py-1 bg-stone-950 hover:bg-stone-900 text-white text-[10px] font-extrabold rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Kết nối lại
                </button>
              </div>
            </div>
          )}

          {/* INNER TAB PANEL ROUTER */}
          <div className="flex-1 p-6 z-10 max-w-7xl w-full mx-auto">
            <AnimatePresence mode="wait">
              {trialInfo && 
               trialInfo.status !== "CONVERTED" && 
               (trialInfo.status === "EXPIRED" || (trialDaysLeft !== null && trialDaysLeft <= 0)) && 
               currentStaff?.email?.toLowerCase() !== "congbaotruong8@gmail.com" ? (
                <motion.div
                  key="expired_lock"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center justify-center min-h-[60vh] py-12"
                >
                  <div className="w-full max-w-xl bg-stone-900 border border-stone-850 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-32 w-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto shadow-lg shadow-rose-500/5">
                      <XCircle className="h-8 w-8 text-rose-500 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-black text-rose-400 uppercase tracking-wider">Phần mềm đã hết hạn sử dụng</h3>
                      <p className="text-xs text-stone-400 leading-relaxed max-w-md mx-auto">
                        Cửa hàng <strong className="text-stone-200">"{trialInfo.shopName}"</strong> đã hết thời gian trải nghiệm dùng thử 20 ngày hoặc bị tạm ngưng hoạt động trên hệ thống KiotX SaaS.
                      </p>
                    </div>

                    {/* Support Info Box */}
                    <div className="bg-stone-950 border border-stone-850 p-4 rounded-2xl space-y-3.5 text-left max-w-md mx-auto">
                      <span className="text-[10px] text-stone-500 uppercase font-black tracking-wider block">Thông tin liên hệ gia hạn</span>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-500 block leading-none mb-0.5">Đại diện Admin phân phối</span>
                            <span className="text-xs font-bold text-stone-200">Trương Công Bảo</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-stone-500 block leading-none mb-0.5">Email liên hệ hỗ trợ</span>
                            <span className="text-xs font-mono font-bold text-stone-200">congbaotruong8@gmail.com</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                      <button
                        onClick={() => setIsOpenTrialModal(true)}
                        className="w-full sm:flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-stone-100 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
                      >
                        <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
                        <span>Gia hạn / Kích hoạt PRO</span>
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full sm:w-auto px-6 py-3 bg-stone-950 border border-stone-800 hover:bg-stone-850 text-stone-400 hover:text-stone-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                      >
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : !isTabAllowed(activeTab, currentStaff) ? (
                <motion.div
                  key="restricted"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  <KiotRestrictedView
                    activeTab={activeTab}
                    currentStaff={currentStaff}
                    onLogout={handleLogout}
                    onSwitchToOwner={() => handleSelectSimulatedStaff(staff.find(s => s.role === "OWNER") || staff[0])}
                    onSwitchToManager={() => handleSelectSimulatedStaff(staff.find(s => s.role === "MANAGER") || staff[0])}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeTab === "dashboard" && (
                    <KiotDashboard 
                      products={products} 
                      invoices={invoices} 
                      categories={categories}
                      currentStaff={currentStaff!}
                      staffList={staff}
                      systemLogs={systemLogs}
                      onNavigateToTab={handleTabChange}
                      onCancelInvoice={handleCancelInvoice}
                      onUpdateInvoice={handleUpdateInvoice}
                      customers={customers}
                      suppliers={suppliers}
                      settings={settings}
                      onDeleteReportsData={handleDeleteReportsData}
                    />
                  )}

                  {activeTab === "pos" && (
                    <KiotPOS
                      products={products}
                      customers={customers}
                      settings={settings}
                      suppliers={suppliers}
                      currentStaff={currentStaff!}
                      onAddInvoice={handleAddInvoice}
                      onAddCustomer={(newC) => saveCustomers([newC, ...customers])}
                      onUpdateProductStock={handleUpdateProductStock}
                      isOnline={isOnline}
                      isRealOnline={isRealOnline}
                      offlineQueueCount={offlineQueue.length}
                    />
                  )}

                  {activeTab === "products" && (
                    <KiotProducts
                      products={products}
                      categories={categories}
                      audits={audits}
                      purchaseOrders={purchaseOrders}
                      suppliers={suppliers}
                      currentStaff={currentStaff}
                      onAddProduct={(newP) => saveProducts([newP, ...products])}
                      onEditProduct={(editP) => saveProducts(products.map(p => p.id === editP.id ? editP : p))}
                      onImportProducts={(imported) => saveProducts(imported)}
                      onDeleteProduct={(delId) => saveProducts(products.filter(p => p.id !== delId))}
                      onAddCategory={(newC) => saveCategories([newC, ...categories])}
                      onAddAudit={(newA) => saveAudits([newA, ...audits])}
                      onApplyAuditStock={(audit) => {
                        // Update stock value of each target product based on physical count audit results
                        const updatedProds = products.map(p => {
                          const auditItem = audit.items.find(i => i.productId === p.id);
                          if (auditItem) {
                            return { ...p, stock: auditItem.actualQty };
                          }
                          return p;
                        });
                        saveProducts(updatedProds);
                      }}
                      onAddPurchaseOrder={(newPo) => {
                        savePurchaseOrders([newPo, ...purchaseOrders]);
                        
                        // Calculate new cost prices using Weighted Average Cost and increase stock levels
                        const updatedProds = products.map(p => {
                          const poItem = newPo.items.find(i => i.productId === p.id);
                          if (poItem) {
                            const oldStock = Math.max(0, p.stock);
                            const importedQty = poItem.quantity;
                            const oldCost = p.costPrice || 0;
                            const importPrice = poItem.costPrice;

                            // Formula: ((oldStock * oldCost) + (importedQty * importPrice)) / (oldStock + importedQty)
                            const newCost = (oldStock + importedQty) > 0
                              ? ((oldStock * oldCost) + (importedQty * importPrice)) / (oldStock + importedQty)
                              : importPrice;

                            return {
                              ...p,
                              stock: oldStock + importedQty,
                              costPrice: Math.round(newCost)
                            };
                          }
                          return p;
                        });
                        saveProducts(updatedProds);

                        // Track supplier debt if goods were purchased on credit
                        if (newPo.amountOwed > 0 && newPo.supplierId) {
                          const updatedSuppliers = suppliers.map(s => {
                            if (s.id === newPo.supplierId) {
                              return {
                                ...s,
                                debt: (s.debt || 0) + newPo.amountOwed
                              };
                            }
                            return s;
                          });
                          saveSuppliers(updatedSuppliers);
                        }
                      }}
                    />
                  )}

                  {activeTab === "partners" && (
                    <KiotPartners
                      customers={customers}
                      suppliers={suppliers}
                      currentStaff={currentStaff!}
                      onAddCustomer={(newC) => saveCustomers([newC, ...customers])}
                      onEditCustomer={(editC) => saveCustomers(customers.map(c => c.id === editC.id ? editC : c))}
                      onDeleteCustomer={(delId) => saveCustomers(customers.filter(c => c.id !== delId))}
                      onAddSupplier={(newS) => saveSuppliers([newS, ...suppliers])}
                      onEditSupplier={(editS) => saveSuppliers(suppliers.map(s => s.id === editS.id ? editS : s))}
                      onDeleteSupplier={(delId) => saveSuppliers(suppliers.filter(s => s.id !== delId))}
                      onAddCashbookEntry={(entry) => saveCashbook([entry, ...cashbook])}
                    />
                  )}

                  {activeTab === "cashbook" && (
                    <KiotCashbook
                      cashbook={cashbook}
                      currentStaff={currentStaff!}
                      onAddEntry={(newEntry) => saveCashbook([newEntry, ...cashbook])}
                      cashShifts={cashShifts}
                      onSaveShifts={(updatedShifts) => saveCashShifts(updatedShifts)}
                      invoices={invoices}
                    />
                  )}



                  {activeTab === "settings" && settings && (
                    <KiotSettings
                      settings={settings}
                      staff={staff}
                      currentStaff={currentStaff!}
                      onUpdateSettings={saveSettings}
                      onAddStaff={(newS) => saveStaff([...staff, newS])}
                      onUpdateStaff={(editS) => saveStaff(staff.map(s => s.id === editS.id ? editS : s))}
                      onDeleteStaff={(delId) => saveStaff(staff.filter(s => s.id !== delId))}
                      trialInfo={trialInfo}
                      onUpdateTrialPassword={handleUpdateTrialPassword}
                      products={products}
                      categories={categories}
                      customers={customers}
                      suppliers={suppliers}
                      invoices={invoices}
                      audits={audits}
                      systemLogs={systemLogs}
                      onRestoreBackup={handleRestoreBackup}
                      onRestoreFromPostgres={handleRestoreFromPostgres}
                      onResetDatabase={handleResetDatabase}
                      isOnline={isOnline}
                      isSyncingAll={isSyncingAll}
                      triggerSyncAll={triggerSyncAll}
                      lastSyncTime={lastSyncTime}
                      autoSyncEnabled={autoSyncEnabled}
                      onToggleAutoSync={handleToggleAutoSync}
                      integrityStatus={integrityStatus}
                      runChecksumValidation={runChecksumValidation}
                    />
                  )}

                  {activeTab === "trials_manager" && currentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com" && (
                    <KiotTrialsManager
                      trials={trialRegistrations}
                      onUpdateTrialStatus={handleUpdateTrialStatus}
                      onExtendTrial={handleExtendTrial}
                      onSetTrialExpirationDate={handleSetTrialExpirationDate}
                      onDeleteTrial={handleDeleteTrial}
                      onUpdateTrialPassword={handleUpdateTrialPassword}
                      onUpdateTrialAllowedModules={handleUpdateTrialAllowedModules}
                      onResetDatabase={handleResetDatabase}
                      onCreateTrial={handleCreateTrial}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* LOWER STATUS INFORMATION BAR (Architectural honesty, clean footer) */}
          <footer className={`border-t px-6 py-4 flex flex-col md:flex-row items-center justify-between text-[11px] font-mono tracking-wider ${
            theme === "dark" ? "bg-stone-900/40 border-stone-850 text-stone-500" : "bg-stone-50 border-stone-200 text-stone-500"
          }`}>
            <div className="flex flex-wrap gap-4 items-center justify-center md:justify-start">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>AES-256 Mã Hóa Thiết Bị</span>
              </span>
              <span>•</span>
              <span>Cơ sở dữ liệu cục bộ: <strong className="text-emerald-400">Đang chạy ({products.length} sản phẩm, {invoices.length} hóa đơn)</strong></span>
            </div>

            <div className="flex items-center gap-1 mt-2 md:mt-0 text-[10px]">
              <span>Thiết kế bởi Trương Công Bảo</span>
              <Heart className="h-3 w-3 text-rose-500 fill-rose-500 animate-pulse" />
              <span>&copy; 2026 KiotX Inc.</span>
            </div>
          </footer>

        </main>
      </div>

      {/* FLOATING ACTION TRIGGER FOR AI CO-PILOT CHATBOX */}
      {!isChatOpen && activeTab !== "pos" && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer z-40 border border-emerald-400"
          title="Trò chuyện với Trợ lý AI Co-Pilot"
        >
          <Bot className="h-5.5 w-5.5 animate-pulse" />
        </button>
      )}

      {/* AI CHATBOX COMPONENT DRAWED ON RIGHT */}
      <Chatbox 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        currentStaff={currentStaff}
        products={products}
        invoices={invoices}
        settings={settings}
        cashbook={cashbook}
        projects={projects}
      />

      {/* TRIAL EXTENSION SELF-SERVICE MODAL */}
      <TrialExtensionModal
        isOpen={isOpenTrialModal}
        onClose={() => setIsOpenTrialModal(false)}
        trialInfo={trialInfo}
        onExtendTrial={handleExtendTrial}
        onUpdateTrialStatus={handleUpdateTrialStatus}
      />

      {/* CUSTOM DB RESET CONFIRMATION MODAL (Prevents Iframe blocking & supports Time-Travel Rollback) */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 overflow-hidden relative"
            >
              {/* Top Warning Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 mt-0.5">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-stone-100 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Quản Lý & Phục Hồi Dữ Liệu
                  </h3>
                  <p className="text-xs text-stone-400">
                    Cửa hàng: <span className="text-stone-200 font-bold">{trialInfo?.shopName || (currentStaff?.email?.toLowerCase() === "congbaotruong8@gmail.com" ? "Hệ thống Chính KiotX (Super Admin)" : "KiotX Main Store")}</span>
                  </p>
                </div>
              </div>

              {/* Informative block about what "initial" is */}
              <div className="text-[11px] bg-stone-950/60 border border-stone-850 p-3 rounded-xl text-stone-400 space-y-1">
                <p className="font-bold text-stone-300">💡 Giải thích mốc thời gian "Mặc định / Ban đầu":</p>
                <p>
                  Mốc thời gian ban đầu của bạn là lúc đăng ký tài khoản dùng thử KiotX:{" "}
                  <strong className="text-amber-400">
                    {formatVNDate(trialInfo?.createdAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}
                  </strong>.
                </p>
                <p className="text-stone-500 text-[10px]">
                  Mọi dữ liệu hóa đơn, danh mục, và sổ quỹ phát sinh sau thời điểm này đều là dữ liệu mới tạo trong quá trình trải nghiệm của bạn.
                </p>
              </div>

              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 p-1 bg-stone-950 rounded-xl border border-stone-850">
                <button
                  type="button"
                  onClick={() => setResetType("hard")}
                  className={`py-1.5 px-3 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    resetType === "hard"
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                >
                  Wipe Sạch Toàn Bộ
                </button>
                <button
                  type="button"
                  onClick={() => setResetType("selective")}
                  className={`py-1.5 px-3 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    resetType === "selective"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                >
                  Quay Ngược Thời Gian
                </button>
              </div>

              {/* Reset Content Fields */}
              {resetType === "hard" ? (
                <div className="space-y-3">
                  <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3.5 space-y-2">
                    <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">
                      ⚠️ Cảnh báo xóa sạch (Hard Reset):
                    </span>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      Lựa chọn này sẽ xóa toàn bộ dữ liệu hiện tại (gồm cả sản phẩm, danh mục, khách hàng, nhà cung cấp) và trả hệ thống về một trang giấy trắng trống trơn lúc vừa đăng ký tài khoản.
                    </p>
                    <ul className="text-[11px] text-stone-500 space-y-1 list-disc pl-4 leading-relaxed font-medium">
                      <li>Khởi tạo lại danh mục rỗng sạch sẽ để nhập hàng mới</li>
                      <li>Xóa sạch toàn bộ hóa đơn đã bán & lịch sử doanh thu</li>
                      <li>Khôi phục sổ quỹ, công nợ và tất cả các nhật ký làm việc</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-xl p-3.5 space-y-2">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                      🕒 Quay ngược thời gian giữ nguyên danh mục:
                    </span>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      Giúp phục hồi/quay lại trạng thái dữ liệu tại một giờ hoặc ngày nhất định. Hệ thống sẽ <strong className="text-emerald-400">giữ nguyên</strong> danh mục sản phẩm, danh sách khách hàng và chỉ xóa bỏ hoặc thu hồi các giao dịch, hóa đơn bán lẻ, thu chi sổ quỹ phát sinh <strong className="text-rose-400">sau mốc thời gian</strong> được chọn.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                      Chọn điểm phục hồi (Checkpoint):
                    </span>

                    <div className="grid grid-cols-1 gap-2">
                      {/* Checkpoint 1: Registration Time */}
                      <label className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCheckpoint === "registration" 
                          ? "bg-stone-850 border-emerald-500/40 text-stone-100" 
                          : "bg-stone-950/40 border-stone-850 hover:bg-stone-850/60 text-stone-400"
                      }`}>
                        <input
                          type="radio"
                          name="checkpoint"
                          checked={selectedCheckpoint === "registration"}
                          onChange={() => setSelectedCheckpoint("registration")}
                          className="mt-1 accent-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px]">
                          <p className="font-bold text-stone-200">Lúc đăng ký cửa hàng</p>
                          <p className="text-stone-500">
                            {formatVNDate(trialInfo?.createdAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())} (Chỉ xóa giao dịch mới phát sinh)
                          </p>
                        </div>
                      </label>

                      {/* Checkpoint 2: 1 Hour ago */}
                      <label className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCheckpoint === "1hour" 
                          ? "bg-stone-850 border-emerald-500/40 text-stone-100" 
                          : "bg-stone-950/40 border-stone-850 hover:bg-stone-850/60 text-stone-400"
                      }`}>
                        <input
                          type="radio"
                          name="checkpoint"
                          checked={selectedCheckpoint === "1hour"}
                          onChange={() => setSelectedCheckpoint("1hour")}
                          className="mt-1 accent-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px]">
                          <p className="font-bold text-stone-200">1 giờ trước</p>
                          <p className="text-stone-500">
                            {formatVNDate(new Date(Date.now() - 60 * 60 * 1000).toISOString())} (Hữu ích khi lỡ tính sai tiền/hóa đơn hàng loạt vừa xong)
                          </p>
                        </div>
                      </label>

                      {/* Checkpoint 3: Today Start */}
                      <label className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCheckpoint === "today" 
                          ? "bg-stone-850 border-emerald-500/40 text-stone-100" 
                          : "bg-stone-950/40 border-stone-850 hover:bg-stone-850/60 text-stone-400"
                      }`}>
                        <input
                          type="radio"
                          name="checkpoint"
                          checked={selectedCheckpoint === "today"}
                          onChange={() => setSelectedCheckpoint("today")}
                          className="mt-1 accent-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px]">
                          <p className="font-bold text-stone-200">Đầu ngày hôm nay</p>
                          <p className="text-stone-500">
                            00:00 ngày hôm nay (Xóa sạch toàn bộ hóa đơn và thu chi thực hiện trong ngày hôm nay)
                          </p>
                        </div>
                      </label>

                      {/* Checkpoint 4: Yesterday Start */}
                      <label className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCheckpoint === "yesterday" 
                          ? "bg-stone-850 border-emerald-500/40 text-stone-100" 
                          : "bg-stone-950/40 border-stone-850 hover:bg-stone-850/60 text-stone-400"
                      }`}>
                        <input
                          type="radio"
                          name="checkpoint"
                          checked={selectedCheckpoint === "yesterday"}
                          onChange={() => setSelectedCheckpoint("yesterday")}
                          className="mt-1 accent-emerald-500 cursor-pointer"
                        />
                        <div className="text-[11px]">
                          <p className="font-bold text-stone-200">Đầu ngày hôm qua</p>
                          <p className="text-stone-500">
                            00:00 ngày hôm qua (Lùi lại 24-48 giờ trước)
                          </p>
                        </div>
                      </label>

                      {/* Checkpoint 5: Custom Time */}
                      <label className={`flex flex-col gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedCheckpoint === "custom" 
                          ? "bg-stone-850 border-emerald-500/40 text-stone-100" 
                          : "bg-stone-950/40 border-stone-850 hover:bg-stone-850/60 text-stone-400"
                      }`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="checkpoint"
                            checked={selectedCheckpoint === "custom"}
                            onChange={() => setSelectedCheckpoint("custom")}
                            className="mt-1 accent-emerald-500 cursor-pointer"
                          />
                          <div className="text-[11px]">
                            <p className="font-bold text-stone-200">Tùy chọn giờ cụ thể</p>
                            <p className="text-stone-500">Tự nhập tay mốc giờ và ngày bạn muốn quay lui</p>
                          </div>
                        </div>

                        {selectedCheckpoint === "custom" && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="pl-6 pt-1.5"
                          >
                            <input
                              type="datetime-local"
                              value={customResetDateTime}
                              onChange={(e) => setCustomResetDateTime(e.target.value)}
                              className="bg-stone-950 border border-stone-800 rounded-lg text-xs p-2 text-stone-200 block w-full focus:outline-none focus:border-emerald-500 text-center font-bold"
                            />
                          </motion.div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={executeResetDatabase}
                  className={`flex-1 py-2.5 px-4 text-stone-950 font-sans font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg ${
                    resetType === "hard"
                      ? "bg-rose-500 hover:bg-rose-400 shadow-rose-950/20"
                      : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-950/20"
                  }`}
                >
                  Xác nhận khôi phục
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="flex-1 py-2.5 px-4 bg-stone-800 hover:bg-stone-750 text-stone-400 font-sans font-bold text-xs uppercase tracking-wider rounded-xl border border-stone-750 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLOBAL HIGH-FIDELITY TOAST NOTIFICATIONS */}
      <ToastContainer />

    </div>
  );
}
