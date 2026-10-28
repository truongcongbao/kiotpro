import React, { useState, useRef } from "react";
import { 
  ShieldCheck, ShieldAlert, Key, Users, ArrowRight, Sparkles, 
  Settings, ShoppingCart, LayoutDashboard, Database, UserCheck, Play,
  Building, Phone, Mail, MapPin, FileText, CheckCircle2, Star, ArrowLeft,
  Building2, Activity, Laptop, DollarSign, Check, PhoneCall
} from "lucide-react";
import { Staff, COUNTRY_CODES } from "../types";
import { doc } from "firebase/firestore";
import { db, safeSetDoc } from "../lib/firebase";

interface KiotLoginProps {
  onSelectStaff: (staff: Staff) => void;
  onGoogleLogin: () => Promise<void>;
  isSyncing: boolean;
  shopName: string;
}

export default function KiotLogin({
  onSelectStaff,
  onGoogleLogin,
  isSyncing,
  shopName
}: KiotLoginProps) {
  
  // viewMode is "landing" by default to welcome external guests just like Sapo & KiotViet
  const [viewMode, setViewMode] = useState<"landing" | "login">("landing");
  const [activeTab, setActiveTab] = useState<"credential" | "google">("credential");

  // Trial registration states
  const [trialShopName, setTrialShopName] = useState("");
  const [trialOwnerName, setTrialOwnerName] = useState("");
  const [trialPhoneRegion, setTrialPhoneRegion] = useState("");
  const [trialPhone, setTrialPhone] = useState("");
  const [trialEmail, setTrialEmail] = useState("");
  const [trialPassword, setTrialPassword] = useState("");
  const [trialAddress, setTrialAddress] = useState("");
  const [trialNotes, setTrialNotes] = useState("");
  const [isSubmittingTrial, setIsSubmittingTrial] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Real-time validation and duplicate warnings
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Real-time email validation effect
  React.useEffect(() => {
    const email = trialEmail.trim().toLowerCase();
    if (!email) {
      setEmailWarning(null);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailWarning("⚠️ Định dạng Email không hợp lệ (Ví dụ: ten@gmail.com).");
      return;
    }

    if (email === "congbaotruong8@gmail.com") {
      setEmailWarning("⚠️ Email 'congbaotruong8@gmail.com' là tài khoản quản trị viên / chủ hệ thống KiotX! Không thể đăng ký dùng thử.");
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingEmail(true);
      try {
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        const trialsRef = collection(db, "kiot_trials");
        const q = query(trialsRef, where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setEmailWarning(`⚠️ Email/Gmail "${trialEmail}" này đã được đăng ký dùng thử trước đó! Vui lòng sử dụng email khác.`);
        } else {
          setEmailWarning(null);
        }
      } catch (err) {
        console.warn("Lỗi kiểm tra trùng email:", err);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [trialEmail]);

  // Real-time phone validation effect
  React.useEffect(() => {
    const phone = trialPhone.trim();
    if (!phone) {
      setPhoneWarning(null);
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");

    const config = COUNTRY_CODES.find(c => c.code === trialPhoneRegion);
    if (config) {
      const { lengths, name, dialCode } = config;
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      
      if (cleanPhone.length > 0) {
        if (lengths.length === 1) {
          const expected = lengths[0];
          if (cleanPhone.length !== expected) {
            const diff = cleanPhone.length - expected;
            setPhoneWarning(`⚠️ SĐT ${name} (${dialCode}) bắt buộc phải có đúng ${expected} chữ số (Bạn nhập ${cleanPhone.length} số, đang ${diff > 0 ? `dư ${diff}` : `thiếu ${Math.abs(diff)}`} số).`);
            return;
          }
        } else {
          if (cleanPhone.length < minLen || cleanPhone.length > maxLen) {
            setPhoneWarning(`⚠️ SĐT ${name} (${dialCode}) phải có từ ${minLen} đến ${maxLen} chữ số (Bạn nhập ${cleanPhone.length} số).`);
            return;
          }
        }
      }

      if (trialPhoneRegion === "VN" && phone.length > 0 && !phone.startsWith("0")) {
        setPhoneWarning("⚠️ SĐT Việt Nam (+84) phải bắt đầu bằng chữ số 0 (Ví dụ: 0901234567).");
        return;
      }
    }

    const timer = setTimeout(async () => {
      setIsCheckingPhone(true);
      try {
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        const trialsRef = collection(db, "kiot_trials");
        
        // Exact phone check
        const qPhone = query(trialsRef, where("phone", "==", phone));
        const phoneSnapshot = await getDocs(qPhone);
        let exists = !phoneSnapshot.empty;

        if (!exists) {
          // Check clean digits match across all trials
          const allTrialsSnapshot = await getDocs(trialsRef);
          for (const doc of allTrialsSnapshot.docs) {
            const data = doc.data();
            const dPhone = (data.phone || "").replace(/\D/g, "");
            if (dPhone === cleanPhone && cleanPhone.length > 0) {
              exists = true;
              break;
            }
          }
        }

        if (exists) {
          setPhoneWarning(`⚠️ Số điện thoại "${phone}" này đã được đăng ký dùng thử trước đó! Vui lòng chọn số khác.`);
        } else {
          setPhoneWarning(null);
        }
      } catch (err) {
        console.warn("Lỗi kiểm tra trùng SĐT:", err);
      } finally {
        setIsCheckingPhone(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [trialPhone, trialPhoneRegion]);

  // Credential login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Form ref for scroll-to-registration action
  const registerFormRef = useRef<HTMLDivElement>(null);

  const scrollToRegister = () => {
    if (viewMode !== "landing") {
      setViewMode("landing");
      setTimeout(() => {
        registerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else {
      registerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleRegisterTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationError(null);

    if (emailWarning) {
      setRegistrationError(emailWarning);
      alert(emailWarning);
      return;
    }
    if (phoneWarning) {
      setRegistrationError(phoneWarning);
      alert(phoneWarning);
      return;
    }

    if (!trialShopName || !trialOwnerName || !trialPhone || !trialEmail || !trialPassword) {
      const errMsg = "Vui lòng nhập đầy đủ các trường thông tin bắt buộc!";
      setRegistrationError(errMsg);
      alert(errMsg);
      return;
    }

    // 1. Check if Phone Region is selected
    if (!trialPhoneRegion) {
      const errMsg = "Lỗi: Bạn chưa chọn Khu vực/Quốc gia cho số điện thoại! Vui lòng chọn khu vực thích hợp (Ví dụ: Việt Nam (+84)).";
      setRegistrationError(errMsg);
      alert(errMsg);
      return;
    }

    // 2. Validate phone number based on selected region
    const cleanPhone = trialPhone.replace(/\D/g, ""); // extract only digits
    const config = COUNTRY_CODES.find(c => c.code === trialPhoneRegion);
    if (config) {
      const { lengths, name, dialCode } = config;
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      
      if (lengths.length === 1) {
        const expected = lengths[0];
        if (cleanPhone.length !== expected) {
          const diff = cleanPhone.length - expected;
          const errMsg = `Lỗi định dạng SĐT: Số điện thoại ${name} (${dialCode}) bắt buộc phải có đúng ${expected} chữ số! Bạn đang nhập ${cleanPhone.length} số (bị ${diff > 0 ? `thừa/dư ${diff}` : `thiếu ${Math.abs(diff)}`} chữ số). Vui lòng nhập chính xác ${expected} chữ số.`;
          setRegistrationError(errMsg);
          alert(errMsg);
          return;
        }
      } else {
        if (cleanPhone.length < minLen || cleanPhone.length > maxLen) {
          const errMsg = `Lỗi định dạng SĐT: Số điện thoại ${name} (${dialCode}) phải có từ ${minLen} đến ${maxLen} chữ số! Bạn đang nhập ${cleanPhone.length} số.`;
          setRegistrationError(errMsg);
          alert(errMsg);
          return;
        }
      }

      if (trialPhoneRegion === "VN" && !trialPhone.trim().startsWith("0")) {
        const errMsg = "Lỗi định dạng SĐT: Số điện thoại Việt Nam (+84) phải bắt đầu bằng chữ số 0 (Ví dụ: 0901234567).";
        setRegistrationError(errMsg);
        alert(errMsg);
        return;
      }
    }

    setIsSubmittingTrial(true);
    try {
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const cleanEmail = trialEmail.trim().toLowerCase();

      // Explicitly block the system admin / master owner email from being registered as a trial
      if (cleanEmail === "congbaotruong8@gmail.com") {
        const errMsg = `Lỗi đăng ký: Email "congbaotruong8@gmail.com" là tài khoản quản trị viên / chủ hệ thống KiotX! Bạn không thể dùng email này để đăng ký tài khoản dùng thử mới.`;
        setRegistrationError(errMsg);
        alert(errMsg);
        setIsSubmittingTrial(false);
        return;
      }

      const trialsRef = collection(db, "kiot_trials");

      // Check if phone already registered in database (both exact and clean digits matching)
      const qPhone = query(trialsRef, where("phone", "==", trialPhone.trim()));
      const phoneSnapshot = await getDocs(qPhone);
      let phoneExists = !phoneSnapshot.empty;

      if (!phoneExists) {
        // Also check if any existing trial has the same clean phone digits
        const allTrialsSnapshot = await getDocs(trialsRef);
        for (const doc of allTrialsSnapshot.docs) {
          const data = doc.data();
          const dPhone = (data.phone || "").replace(/\D/g, "");
          if (dPhone === cleanPhone && cleanPhone.length > 0) {
            phoneExists = true;
            break;
          }
        }
      }

      if (phoneExists) {
        const errMsg = `Lỗi đăng ký: Số điện thoại "${trialPhone}" này đã được đăng ký sử dụng dùng thử trước đó trên hệ thống! Vui lòng sử dụng số điện thoại khác hoặc liên hệ Trương Công Bảo để được hỗ trợ giải phóng số điện thoại này.`;
        setRegistrationError(errMsg);
        alert(errMsg);
        setIsSubmittingTrial(false);
        return;
      }

      // Check if email already registered
      const q = query(trialsRef, where("email", "==", cleanEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const errMsg = `Lỗi đăng ký: Địa chỉ Gmail/Email "${trialEmail}" này đã được đăng ký sử dụng dùng thử trước đó trên hệ thống! Vui lòng sử dụng địa chỉ Gmail khác hoặc liên hệ Trương Công Bảo để được hỗ trợ giải phóng email này.`;
        setRegistrationError(errMsg);
        alert(errMsg);
        setIsSubmittingTrial(false);
        return;
      }

      const trialId = `trial-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const expireDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

      const newTrial = {
        id: trialId,
        shopName: trialShopName,
        ownerName: trialOwnerName,
        phone: trialPhone,
        email: trialEmail,
        password: trialPassword,
        address: trialAddress,
        notes: trialNotes,
        createdAt,
        expireDate,
        status: "TRIAL_ACTIVE" as const
      };

      // 1. Save directly to Firestore for congbaotruong8@gmail.com to see
      await safeSetDoc(doc(db, "kiot_trials", trialId), newTrial);

      // 1b. Sync directly to PostgreSQL database
      try {
        await fetch("/api/trials", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newTrial),
        });
      } catch (postgErr) {
        console.warn("Lỗi đồng bộ thông tin dùng thử sang PostgreSQL:", postgErr);
      }

      // 2. Save local trial info
      localStorage.setItem("kiot_trial_info", JSON.stringify(newTrial));

      // 3. Update shop settings in local storage so it reflects the custom shop name
      const customSettings = {
        shopName: trialShopName,
        address: trialAddress || "Đang dùng thử KiotX",
        phone: trialPhone,
        taxRate: 10,
        currency: "VND",
        logoUrl: ""
      };
      localStorage.setItem("kiot_settings", JSON.stringify(customSettings));

      // 4. Provision a guest staff profile and log in
      const trialStaff: Staff = {
        id: `staff-${trialId}`,
        name: trialOwnerName,
        email: trialEmail,
        role: "OWNER",
        phone: trialPhone,
        active: true
      };

      // Add to staff list in local storage
      const existingStaffStr = localStorage.getItem("kiot_staff");
      let currentStaffList: Staff[] = [];
      if (existingStaffStr) {
        try { currentStaffList = JSON.parse(existingStaffStr); } catch (err) {}
      }
      if (!currentStaffList.some(s => s.email.toLowerCase() === trialEmail.toLowerCase())) {
        currentStaffList.push(trialStaff);
        localStorage.setItem("kiot_staff", JSON.stringify(currentStaffList));
      }

      alert(`Đăng ký dùng thử thành công! Chào mừng nhà hàng "${trialShopName}" trải nghiệm 20 ngày miễn phí cùng KiotX.`);
      
      // Auto-select this staff to log in!
      onSelectStaff(trialStaff);

    } catch (err: any) {
      console.error("Lỗi đăng ký dùng thử:", err);
      alert("Gặp lỗi trong quá trình kết nối đăng ký dùng thử. Chi tiết: " + err.message);
    } finally {
      setIsSubmittingTrial(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      alert("Vui lòng nhập đầy đủ Email/Số điện thoại và Mật khẩu!");
      return;
    }
    setIsLoggingIn(true);
    try {
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      
      const trialsRef = collection(db, "kiot_trials");
      const cleanInput = loginEmail.trim();
      
      // Query by Email
      const qEmail = query(trialsRef, where("email", "==", cleanInput));
      let querySnapshot = await getDocs(qEmail);
      
      let docData: any = null;
      if (!querySnapshot.empty) {
        docData = querySnapshot.docs[0].data();
      } else {
        // Query by Phone
        const qPhone = query(trialsRef, where("phone", "==", cleanInput));
        querySnapshot = await getDocs(qPhone);
        if (!querySnapshot.empty) {
          docData = querySnapshot.docs[0].data();
        }
      }
      
      if (!docData) {
        alert("Không tìm thấy tài khoản dùng thử với Email hoặc Số điện thoại này! Vui lòng kiểm tra lại thông tin đăng ký hoặc dùng tab Demo.");
        setIsLoggingIn(false);
        return;
      }
      
      // Compare password
      if (docData.password && docData.password !== loginPassword) {
        alert("Mật khẩu đăng nhập không chính xác. Vui lòng kiểm tra lại!");
        setIsLoggingIn(false);
        return;
      }
      
      // Save trial info in local storage
      localStorage.setItem("kiot_trial_info", JSON.stringify(docData));
      
      // Update Shop settings
      const customSettings = {
        shopName: docData.shopName,
        address: docData.address || "Đang dùng thử KiotX",
        phone: docData.phone,
        taxRate: 10,
        currency: "VND",
        logoUrl: ""
      };
      localStorage.setItem("kiot_settings", JSON.stringify(customSettings));
      
      // Prepare staff
      const trialStaff: Staff = {
        id: `staff-${docData.id}`,
        name: docData.ownerName,
        email: docData.email,
        role: "OWNER",
        phone: docData.phone,
        active: true
      };
      
      // Add to local staff list
      const existingStaffStr = localStorage.getItem("kiot_staff");
      let currentStaffList: Staff[] = [];
      if (existingStaffStr) {
        try { currentStaffList = JSON.parse(existingStaffStr); } catch (err) {}
      }
      if (!currentStaffList.some(s => s.email.toLowerCase() === docData.email.toLowerCase())) {
        currentStaffList.push(trialStaff);
        localStorage.setItem("kiot_staff", JSON.stringify(currentStaffList));
      }
      
      alert(`Đăng nhập thành công vào cửa hàng "${docData.shopName}"!`);
      onSelectStaff(trialStaff);
      
    } catch (err: any) {
      console.error("Lỗi đăng nhập:", err);
      alert("Đã xảy ra lỗi kết nối cơ sở dữ liệu: " + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "OWNER": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "MANAGER": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "CASHIER": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default: return "bg-stone-500/10 text-stone-400 border-stone-500/20";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "OWNER": return "Chủ cửa hàng (OWNER)";
      case "MANAGER": return "Quản lý (MANAGER)";
      case "CASHIER": return "Thu ngân (CASHIER)";
      default: return role;
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 font-sans antialiased text-stone-200 flex flex-col relative overflow-x-hidden">
      
      {/* BACKGROUND ACCENTS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute top-[-10%] left-[-10%] h-[700px] w-[700px] rounded-full bg-emerald-500/10 blur-[150px]" />
        <div className="absolute bottom-[20%] right-[-10%] h-[800px] w-[800px] rounded-full bg-indigo-500/10 blur-[150px]" />
        <div className="absolute top-[40%] left-[30%] h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-20 w-full border-b border-stone-900 bg-stone-950/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode("landing")}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-0.5 shadow-lg shadow-emerald-500/10">
              <div className="h-full w-full rounded-[9px] bg-stone-950 flex items-center justify-center font-black text-emerald-400 font-mono text-base tracking-tighter">
                Kx
              </div>
            </div>
            <div className="space-y-0.5">
              <h1 className="text-base font-black uppercase tracking-wider text-stone-100 flex items-center gap-1.5 leading-none">
                <span>KiotX PRO</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </h1>
              <p className="text-[9px] text-stone-500 font-bold uppercase tracking-widest leading-none">SaaS Food & Beverage</p>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-stone-400">
            <button onClick={() => setViewMode("landing")} className="hover:text-emerald-400 transition-colors cursor-pointer">Trang chủ</button>
            <a href="#features" className="hover:text-emerald-400 transition-colors">Tính năng</a>
            <a href="#pricing" className="hover:text-emerald-400 transition-colors">Bảng giá</a>
            <a href="#support" className="hover:text-emerald-400 transition-colors">Hỗ trợ</a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            {viewMode === "landing" ? (
              <>
                <button
                  onClick={() => setViewMode("login")}
                  className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-850 rounded-xl border border-stone-800 transition-all cursor-pointer"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={scrollToRegister}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-stone-950 rounded-xl shadow-md shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                >
                  Dùng thử 20 ngày
                </button>
              </>
            ) : (
              <button
                onClick={() => setViewMode("landing")}
                className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-850 rounded-xl border border-stone-800 flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại
              </button>
            )}
          </div>
        </div>
      </header>

      {/* RENDER VIEW MODE */}
      {viewMode === "landing" ? (
        <main className="relative z-10 flex-1 flex flex-col">
          
          {/* HERO SECTION WITH INTEGRATED SAAS REGISTRATION */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 md:py-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* LEFT COLUMN: CONVERSION COPY */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Nền tảng quản lý SaaS vượt trội
                </div>
                <h1 className="text-3xl sm:text-5xl font-black text-stone-100 tracking-tight leading-tight uppercase">
                  Nền tảng Quản lý & Bán hàng <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400">Đột phá cho nhà hàng</span>
                </h1>
                <p className="text-sm sm:text-base text-stone-400 leading-relaxed max-w-2xl">
                  Chào mừng bạn đến với <strong>KiotX Pro</strong>. Giải pháp hoàn hảo được thiết kế tinh gọn chuyên sâu cho ngành dịch vụ ăn uống (F&B). Tích hợp quầy POS bán hàng siêu tốc 1 chạm, kiểm kê trừ kho nguyên vật liệu tự động, và đồng bộ dữ liệu đa thiết bị tức thời.
                </p>
              </div>

              {/* Unique selling points with clean checkmarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  "Quầy POS bán hàng 1 chạm cực mượt",
                  "Khấu hao nguyên vật liệu tự động",
                  "Báo cáo biểu đồ doanh thu real-time",
                  "Phân quyền nhân viên RBAC bảo mật",
                  "Đồng bộ Firestore tốc độ cực cao",
                  "Hoạt động mượt ngay cả khi mất mạng"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs text-stone-300 font-semibold">
                    <div className="h-5 w-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* High-conversion trust metrics */}
              <div className="pt-8 border-t border-stone-900 grid grid-cols-3 gap-6">
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 leading-none">20 ngày</div>
                  <div className="text-[10px] text-stone-500 uppercase tracking-wider font-bold mt-1.5">Dùng thử Full tính năng</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-teal-400 leading-none">0.1 giây</div>
                  <div className="text-[10px] text-stone-500 uppercase tracking-wider font-bold mt-1.5">Tốc độ Cloud Sync</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-400 leading-none">100%</div>
                  <div className="text-[10px] text-stone-500 uppercase tracking-wider font-bold mt-1.5">Không phát sinh chi phí</div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: REGISTRATION CARD (Ref for scrolling) */}
            <div ref={registerFormRef} className="lg:col-span-5">
              <div className="bg-stone-900/60 border border-stone-800 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 h-32 w-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                <div className="text-center mb-6 space-y-1.5 relative z-10">
                  <h3 className="text-lg font-black text-stone-100 uppercase tracking-wider">Đăng ký dùng thử</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Khởi tạo cửa hàng số của bạn trong <strong className="text-emerald-400">3 giây</strong> và trải nghiệm 20 ngày miễn phí đầy đủ tính năng.
                  </p>
                </div>

                <form onSubmit={handleRegisterTrial} className="space-y-4 relative z-10">
                  {registrationError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-200 text-xs flex gap-2.5 items-start leading-relaxed animate-pulse">
                      <ShieldAlert className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-red-400 block uppercase tracking-wider text-[10px]">Cảnh báo lỗi đăng ký</span>
                        <span>{registrationError}</span>
                      </div>
                    </div>
                  )}

                  {/* Tên cửa hàng */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Tên cửa hàng / Nhà hàng *</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: KiotX Coffee, Phở Hà Nội..."
                        value={trialShopName}
                        onChange={e => setTrialShopName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Người đại diện */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Họ & tên người quản lý *</label>
                    <div className="relative">
                      <UserCheck className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Nguyễn Văn Bảo"
                        value={trialOwnerName}
                        onChange={e => setTrialOwnerName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Số điện thoại */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Số điện thoại & Khu vực *</label>
                    <div className="flex gap-2">
                      <div className="w-[110px] shrink-0">
                        <select
                          required
                          value={trialPhoneRegion}
                          onChange={e => {
                            setTrialPhoneRegion(e.target.value);
                            setRegistrationError(null);
                          }}
                          className={`w-full px-2 py-2.5 bg-stone-950 border rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer h-[42px] font-semibold ${
                            !trialPhoneRegion ? "border-amber-500/50 text-amber-400 bg-amber-500/5" : "border-stone-850"
                          }`}
                        >
                          <option value="">-- Quốc gia --</option>
                          {COUNTRY_CODES.map(c => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code} ({c.dialCode})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                        <input
                          type="tel"
                          required
                          placeholder={
                            (() => {
                              const config = COUNTRY_CODES.find(c => c.code === trialPhoneRegion);
                              return config ? `${config.name}: ${config.placeholder}` : "Nhập số điện thoại";
                            })()
                          }
                          value={trialPhone}
                          onChange={e => {
                            setTrialPhone(e.target.value);
                            setRegistrationError(null);
                          }}
                          className={`w-full pl-9 pr-3 py-2.5 bg-stone-950 border rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono h-[42px] ${
                            phoneWarning ? "border-rose-500/80 text-rose-200 bg-rose-500/5" : (registrationError && registrationError.includes("SĐT") ? "border-red-500/50" : "border-stone-850")
                          }`}
                        />
                      </div>
                    </div>
                    {phoneWarning && (
                      <span className="text-[11px] text-rose-400 font-medium block leading-normal mt-1 animate-pulse">
                        {phoneWarning}
                      </span>
                    )}
                    {isCheckingPhone && (
                      <span className="text-[10px] text-stone-500 font-semibold block leading-normal mt-1 flex items-center gap-1.5">
                        <span className="h-3 w-3 border-2 border-stone-500 border-t-transparent rounded-full animate-spin" />
                        Đang kiểm tra số điện thoại trên hệ thống...
                      </span>
                    )}
                    {!trialPhoneRegion && (
                      <span className="text-[9px] text-amber-500 font-semibold block leading-normal mt-0.5">
                        ⚠ Vui lòng chọn Khu vực thích hợp trước khi nhập số điện thoại
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Địa chỉ Email liên hệ *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="email"
                        required
                        placeholder="Ví dụ: email@gmail.com"
                        value={trialEmail}
                        onChange={e => {
                          setTrialEmail(e.target.value);
                          setRegistrationError(null);
                        }}
                        className={`w-full pl-9 pr-3 py-2.5 bg-stone-950 border rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono ${
                          emailWarning ? "border-rose-500/80 text-rose-200 bg-rose-500/5" : (registrationError && registrationError.includes("Gmail") ? "border-red-500/50" : "border-stone-850")
                        }`}
                      />
                    </div>
                    {emailWarning && (
                      <span className="text-[11px] text-rose-400 font-medium block leading-normal mt-1 animate-pulse">
                        {emailWarning}
                      </span>
                    )}
                    {isCheckingEmail && (
                      <span className="text-[10px] text-stone-500 font-semibold block leading-normal mt-1 flex items-center gap-1.5">
                        <span className="h-3 w-3 border-2 border-stone-500 border-t-transparent rounded-full animate-spin" />
                        Đang kiểm tra email trên hệ thống...
                      </span>
                    )}
                  </div>

                  {/* Mật khẩu đăng nhập */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Mật khẩu đăng nhập *</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="password"
                        required
                        placeholder="Nhập mật khẩu bảo vệ cửa hàng"
                        value={trialPassword}
                        onChange={e => setTrialPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Địa chỉ quán */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Địa chỉ quán</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="text"
                        placeholder="Ví dụ: 123 Lê Lợi, Quận 1, TP. HCM"
                        value={trialAddress}
                        onChange={e => setTrialAddress(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Ghi chú */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Yêu cầu đặc thù (Không bắt buộc)</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                      <input
                        type="text"
                        placeholder="Ví dụ: Cần thiết lập cho chuỗi 2 chi nhánh..."
                        value={trialNotes}
                        onChange={e => setTrialNotes(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingTrial}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-emerald-800 disabled:to-emerald-950 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all mt-6"
                  >
                    {isSubmittingTrial ? (
                      <>
                        <div className="h-4 w-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                        <span>Đang khởi tạo hệ thống...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
                        <span>Bắt đầu dùng thử 20 ngày miễn phí</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Secure Badge */}
                <div className="mt-6 pt-4 border-t border-stone-850 flex items-center justify-between text-[10px] text-stone-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Bảo mật đám mây an toàn
                  </span>
                  <span>KiotX v2.1</span>
                </div>
              </div>
            </div>
          </section>

          {/* DETAILED FEATURES SHOWCASE */}
          <section id="features" className="border-t border-stone-900 bg-stone-950 py-20 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">GIẢI PHÁP TOÀN DIỆN</span>
                <h2 className="text-2xl sm:text-4xl font-black text-stone-100 tracking-tight uppercase">Công cụ vượt trội bứt phá doanh thu</h2>
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  KiotX mang đến bộ công cụ khép kín hỗ trợ đắc lực cho hoạt động vận hành của nhà hàng từ khâu Order, thanh toán tại quầy đến khâu thống kê lợi nhuận cuối tháng.
                </p>
              </div>

              {/* Grid 2x2 Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Feature 1 */}
                <div className="bg-stone-900/40 border border-stone-850 rounded-2xl p-6 sm:p-8 space-y-4 hover:border-emerald-500/20 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-stone-950 transition-all duration-300">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100 uppercase tracking-wide">Quầy POS Bán Hàng 1 Chạm Siêu Tốc</h3>
                  <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                    Giao diện quầy thu ngân tối giản, trực quan và cực nhanh. Hỗ trợ chọn món, áp dụng giảm giá, phụ thu, tích lũy điểm thưởng thành viên VIP, quét mã QR thanh toán động và in hóa đơn chuẩn khổ giấy 80mm chỉ trong một nốt nhạc.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="bg-stone-900/40 border border-stone-850 rounded-2xl p-6 sm:p-8 space-y-4 hover:border-teal-500/20 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500 group-hover:text-stone-950 transition-all duration-300">
                    <Database className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100 uppercase tracking-wide">Tự Động Định Lượng & Trừ Kho</h3>
                  <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                    Hệ thống định lượng nguyên vật liệu thông minh. Cho phép khai báo công thức sản xuất sản phẩm (Ví dụ: 1 ly cafe cần 20g bột cafe + 15ml sữa đặc). Mỗi khi bán ra thành công, kho nguyên vật liệu thô sẽ tự động khấu trừ tức thì.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-stone-900/40 border border-stone-850 rounded-2xl p-6 sm:p-8 space-y-4 hover:border-indigo-500/20 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-stone-950 transition-all duration-300">
                    <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100 uppercase tracking-wide">Sổ Quỹ Tiền Mặt & Doanh Thu Biểu Đồ</h3>
                  <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                    Theo dõi chặt chẽ dòng tiền thực tế thu chi hàng ngày. Hệ thống tự động tích hợp nguồn tiền từ hóa đơn vào Sổ Quỹ, hỗ trợ lập phiếu chi tiền mua hàng hóa, chi lương nhân viên nhanh chóng. Trực quan hóa kết quả kinh doanh bằng biểu đồ trực quan.
                  </p>
                </div>

                {/* Feature 4 */}
                <div className="bg-stone-900/40 border border-stone-850 rounded-2xl p-6 sm:p-8 space-y-4 hover:border-purple-500/20 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-stone-950 transition-all duration-300">
                    <Settings className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-100 uppercase tracking-wide">Đồng Bộ Cloud Real-time & Offline</h3>
                  <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                    Giải pháp lai đám mây (Cloud Hybrid) tối tân. Phần mềm lưu trữ dữ liệu an toàn trên Firestore đồng bộ tức thời giữa điện thoại, máy tính bảng và máy tính. Nếu mất kết nối internet, bạn vẫn có thể bán hàng, dữ liệu sẽ tự đồng bộ khi có mạng.
                  </p>
                </div>

              </div>
            </div>
          </section>

          {/* PRICING SECTION */}
          <section id="pricing" className="border-t border-stone-900 bg-stone-900/30 py-20 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">CHI PHÍ ĐẦU TƯ</span>
                <h2 className="text-2xl sm:text-4xl font-black text-stone-100 tracking-tight uppercase">Bảng giá minh bạch, hợp lý</h2>
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  Sở hữu ngay nền tảng quản lý chuyên nghiệp nhất hiện nay để tiết kiệm thời gian, tối đa hóa doanh thu và ngăn chặn thất thoát.
                </p>
              </div>

              {/* Pricing Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                
                {/* Gói Dùng thử */}
                <div className="bg-stone-950/60 border-2 border-stone-850 rounded-3xl p-8 relative flex flex-col justify-between space-y-8 hover:border-emerald-500/25 transition-all">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 bg-stone-900 border border-stone-800 px-2.5 py-1 rounded-md">Trải nghiệm</span>
                      <h3 className="text-xl font-bold text-stone-100 uppercase tracking-wide pt-2">GÓI DÙNG THỬ 20 NGÀY</h3>
                      <p className="text-xs text-stone-500">Thích hợp cho cửa hàng mới thành lập muốn trải nghiệm hệ thống quản trị hiện đại.</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-emerald-400">0đ</span>
                      <span className="text-xs text-stone-500">/ 20 ngày sử dụng</span>
                    </div>

                    <ul className="space-y-3 pt-4 border-t border-stone-900 text-xs text-stone-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Đầy đủ 100% tính năng cao cấp</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Không giới hạn sản phẩm & hóa đơn</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Phân quyền 3 nhân viên đồng thời</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Đồng bộ Firestore đám mây</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={scrollToRegister}
                    className="w-full py-3 bg-stone-900 hover:bg-stone-850 text-emerald-400 border border-stone-800 hover:border-emerald-500/25 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Đăng ký dùng thử ngay
                  </button>
                </div>

                {/* Gói Pro */}
                <div className="bg-stone-950/60 border-2 border-emerald-500/30 rounded-3xl p-8 relative flex flex-col justify-between space-y-8 shadow-xl shadow-emerald-500/5 hover:border-emerald-500/40 transition-all">
                  <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md animate-pulse">
                    Khuyên dùng
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">Chuyên nghiệp</span>
                      <h3 className="text-xl font-bold text-stone-100 uppercase tracking-wide pt-2">GÓI KIOTX PRO TRỌN ĐỜI</h3>
                      <p className="text-xs text-stone-500">Giải pháp vĩnh viễn, tối ưu cho nhà hàng muốn vận hành ổn định và bảo mật cao.</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-emerald-400">199.000đ</span>
                      <span className="text-xs text-stone-500">/ tháng (Thanh toán năm)</span>
                    </div>

                    <ul className="space-y-3 pt-4 border-t border-stone-900 text-xs text-stone-300">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="font-bold">Đồng bộ đám mây vĩnh viễn</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Không giới hạn số lượng nhân viên</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Được cấp tên miền con của cửa hàng</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-emerald-400">Hỗ trợ kỹ thuật 24/7 từ Trương Công Bảo</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => alert("Cảm ơn bạn đã quan tâm! Vui lòng liên hệ trực tiếp Trương Công Bảo qua email congbaotruong8@gmail.com để kích hoạt bản quyền chính thức.")}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                  >
                    Liên hệ nâng cấp ngay
                  </button>
                </div>

              </div>
            </div>
          </section>

          {/* SUPPORT / OWNER BIO */}
          <section id="support" className="border-t border-stone-900 bg-stone-950 py-16">
            <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
              <div className="h-16 w-16 bg-gradient-to-tr from-emerald-500 to-indigo-500 rounded-full mx-auto p-0.5 flex items-center justify-center">
                <div className="h-full w-full rounded-full bg-stone-950 flex items-center justify-center font-black text-emerald-400 font-mono text-xl">
                  B
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-stone-100">KiotX Pro được vận hành và hỗ trợ trực tiếp bởi</h3>
                <h4 className="text-2xl font-black text-emerald-400">Trương Công Bảo</h4>
                <p className="text-xs text-stone-500 font-mono uppercase tracking-widest">KiotX SaaS Architect & Lead Support</p>
              </div>
              <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-2xl mx-auto">
                Tôi cam kết đồng hành cùng quá trình vận hành kinh doanh của cửa hàng bạn. Toàn bộ các yêu cầu tùy chỉnh giao diện hóa đơn, thiết lập thiết bị in nhiệt, máy quét mã vạch và tối ưu hệ thống đều được hỗ trợ trực tiếp và chu đáo nhất.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-stone-900 border border-stone-850 rounded-2xl text-xs text-stone-300 font-semibold font-mono">
                  <Mail className="h-4 w-4 text-emerald-400" />
                  <span>congbaotruong8@gmail.com</span>
                </div>
                <button
                  onClick={() => alert("Thông tin Hotline: Vui lòng gửi yêu cầu qua email congbaotruong8@gmail.com để nhận cuộc gọi tư vấn trực tiếp từ Trương Công Bảo.")}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-850 border border-stone-850 rounded-2xl text-xs text-stone-300 hover:text-white font-semibold transition-all cursor-pointer"
                >
                  <PhoneCall className="h-4 w-4 text-teal-400" />
                  <span>Yêu cầu cuộc gọi tư vấn</span>
                </button>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="border-t border-stone-900 bg-stone-950 py-8 text-center text-xs text-stone-500 relative z-10">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p>© 2026 KiotX Pro SaaS. Bản quyền thuộc về Trương Công Bảo. Bảo lưu mọi quyền.</p>
              <div className="flex gap-4">
                <span className="hover:text-stone-300 cursor-pointer">Chính sách bảo mật</span>
                <span className="hover:text-stone-300 cursor-pointer">Điều khoản sử dụng</span>
              </div>
            </div>
          </footer>

        </main>
      ) : (
        /* INTERACTIVE LOGIN VIEW (GLASSMORPHIC CARDS WITH RBAC PERMISSION MAP) */
        <main className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch py-6">
            
            {/* LEFT COLUMN: BRAND PROMOTION & PERMISSION MATRIX */}
            <div className="md:col-span-5 space-y-6 text-left hidden md:flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode("landing")}>
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-0.5 shadow-xl shadow-emerald-500/15">
                      <div className="h-full w-full rounded-[14px] bg-stone-950 flex items-center justify-center font-black text-emerald-400 font-mono text-lg tracking-tighter">
                        Kx
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <h1 className="text-xl font-black uppercase tracking-wider text-stone-100 flex items-center gap-1.5">
                        <span>KiotX PRO</span>
                      </h1>
                      <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest leading-none">Hệ thống phân quyền thông minh</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">
                  Bảo mật thông tin tối đa bằng hệ thống phân quyền đa cấp dựa trên vai trò (RBAC), mã hóa dữ liệu đầu cuối và tự động lưu trữ lên đám mây Firestore thời gian thực.
                </p>

                {/* PERMISSION MATRIX MAP */}
                <div className="space-y-4 pt-4 border-t border-stone-850">
                  <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest">
                    Bản đồ phân quyền tài khoản (RBAC)
                  </h4>

                  <div className="space-y-3">
                    {/* OWNER RULE */}
                    <div className="bg-stone-900/40 border border-stone-850 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-200 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          Chủ cửa hàng (OWNER)
                        </span>
                        <span className="text-[9px] font-mono text-rose-400 font-bold uppercase">Toàn quyền</span>
                      </div>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        Toàn quyền cấu hình: POS, doanh thu, hàng hóa, nhân viên, sổ quỹ dòng tiền, thiết lập hóa đơn, đồng bộ/xóa phục hồi dữ liệu.
                      </p>
                    </div>

                    {/* MANAGER RULE */}
                    <div className="bg-stone-900/40 border border-stone-850 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-200 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Quản lý (MANAGER)
                        </span>
                        <span className="text-[9px] font-mono text-amber-400 font-bold uppercase">Hạn chế tài chính</span>
                      </div>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        Quản lý kho hàng, kiểm kê sản phẩm, thông tin đối tác, xem báo cáo tổng quan. Giới hạn các cấu hình tài chính & nhân viên.
                      </p>
                    </div>

                    {/* CASHIER RULE */}
                    <div className="bg-stone-900/40 border border-stone-850 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-200 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          Thu ngân (CASHIER)
                        </span>
                        <span className="text-[9px] font-mono text-blue-400 font-bold uppercase">POS độc lập</span>
                      </div>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        Chỉ mở được màn hình bán hàng POS và tra cứu điểm tích lũy thành viên. Toàn bộ thông tin báo cáo tài chính, quản lý giá kho đều bị ẩn.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-stone-600 flex items-center gap-1.5 pt-4">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Mã hóa bảo mật cấp cao TLS 1.3</span>
              </div>
            </div>

            {/* RIGHT COLUMN: INTERACTIVE LOGIN WINDOW */}
            <div className="md:col-span-7 flex flex-col justify-center">
              <div className="bg-stone-900/75 border border-stone-800 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative flex-1 flex flex-col justify-between">
                
                {/* Background absolute shape */}
                <div className="absolute top-0 right-0 h-28 w-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div>
                  {/* Tab Switchers */}
                  <div className="flex border-b border-stone-850 pb-3 mb-6 gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setActiveTab("credential")}
                      className={`pb-1 text-xs font-black uppercase tracking-wider relative cursor-pointer shrink-0 ${
                        activeTab === "credential" ? "text-emerald-400" : "text-stone-500 hover:text-stone-400"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Key className="h-4 w-4" />
                        <span>Đăng nhập tài khoản</span>
                      </span>
                      {activeTab === "credential" && (
                        <div className="absolute bottom-[-13px] inset-x-0 h-0.5 bg-emerald-500" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("google")}
                      className={`pb-1 text-xs font-black uppercase tracking-wider relative cursor-pointer shrink-0 ${
                        activeTab === "google" ? "text-emerald-400" : "text-stone-500 hover:text-stone-400"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>Đăng nhập Gmail</span>
                      </span>
                      {activeTab === "google" && (
                        <div className="absolute bottom-[-13px] inset-x-0 h-0.5 bg-emerald-500" />
                      )}
                    </button>
                  </div>

                  {/* Render Tabs */}
                  {activeTab === "credential" ? (
                    <form onSubmit={handleCredentialLogin} className="space-y-4 py-2">
                      <div className="text-xs text-stone-400 mb-2 leading-relaxed">
                        Đăng nhập bằng tài khoản dùng thử đã đăng ký trước đó của cửa hàng bạn:
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Email hoặc Số điện thoại</label>
                        <div className="relative">
                          <UserCheck className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                          <input
                            type="text"
                            required
                            placeholder="Nhập email hoặc số điện thoại đăng ký"
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Mật khẩu đăng nhập</label>
                          <button
                            type="button"
                            onClick={() => alert("Mẹo thử nghiệm: Nếu quên mật khẩu, bạn có thể tạo tài khoản dùng thử mới chỉ trong 3 giây ở Trang chủ bằng nút Đăng ký dùng thử.")}
                            className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                          >
                            Quên mật khẩu?
                          </button>
                        </div>
                        <div className="relative">
                          <Key className="absolute left-3 top-3 h-4 w-4 text-stone-500" />
                          <input
                            type="password"
                            required
                            placeholder="Nhập mật khẩu của bạn"
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-stone-950 border border-stone-850 rounded-xl text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 mt-4"
                      >
                        {isLoggingIn ? (
                          <>
                            <div className="h-4 w-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                            <span>Đang xác thực thông tin...</span>
                          </>
                        ) : (
                          <>
                            <span>Xác nhận Đăng nhập</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-5 py-4 text-center">
                      <div className="text-xs text-stone-400 leading-relaxed max-w-sm mx-auto">
                        Đăng nhập an toàn bằng tài khoản Google cá nhân của bạn. Hệ thống sẽ tự động liên kết với thông tin nhân sự trên đám mây của cửa hàng.
                      </div>

                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          onClick={onGoogleLogin}
                          disabled={isSyncing}
                          className="px-6 py-3.5 rounded-2xl bg-white hover:bg-stone-100 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer shadow-lg active:scale-[0.98] transition-all"
                        >
                          {/* Google SVG Icon */}
                          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1, 0, 0, 1, 0, 0)">
                              <path d="M21.35,11.1H12v2.7h5.38C16.88,15.22,15.1,16.2,12,16.2c-3.1,0-5.75-2.07-6.7-5c-0.25-0.74-0.38-1.54-0.38-2.37s0.14-1.63,0.38-2.37c0.95-2.92,3.6-5,6.7-5c1.8,0,3.32,0.67,4.52,1.76l2-2C16.65,1.52,14.5,0.8,12,0.8c-5,0-9.2,3.35-10.4,8c-0.3,1.03-0.45,2.12-0.45,3.2s0.15,2.17,0.45,3.2c1.2,4.65,5.4,8,10.4,8c3.25,0,6.03-1.08,8.02-2.95c2.1-1.95,3.38-4.74,3.38-8C23,12.15,22.45,11.5,21.35,11.1z" fill="#4285F4" />
                              <path d="M3.3,6.3C4.55,3.35,7.7,1.2,11.3,1.2c1.8,0,3.32,0.67,4.52,1.76l2-2C15.95,0.72,13.8,0,11.3,0c-5,0-9.2,3.35-10.4,8L3.3,6.3z" fill="#EA4335" />
                              <path d="M11.3,22.8c3.25,0,6.03-1.08,8.02-2.95l-2.45-1.9c-1.35,0.92-3.1,1.5-5.57,1.5c-3.6,0-6.75-2.15-7.78-5.1l-2.65,2.05C2.1,19.45,6.3,22.8,11.3,22.8z" fill="#34A853" />
                              <path d="M3.52,14.35C3.27,13.61,3.14,12.81,3.14,11.98s0.13-1.63,0.38-2.37L0.87,7.56C0.3,8.9,0,10.4,0,11.98s0.3,3.08,0.87,4.42L3.52,14.35z" fill="#FBBC05" />
                            </g>
                          </svg>
                          <span>Tiếp tục với Google</span>
                        </button>
                      </div>

                      <div className="p-3 bg-stone-950/80 border border-stone-850 rounded-xl max-w-sm mx-auto text-[11px] text-stone-400 space-y-1 text-left">
                        <div className="text-stone-300 font-bold flex items-center gap-1.5">
                          <span>💡 Lưu ý về Pop-up trình duyệt:</span>
                        </div>
                        <p className="text-[10px] text-stone-400 leading-normal">
                          Nếu trình duyệt chặn cửa sổ bật lên, hãy chọn <strong>"Luôn cho phép Pop-up"</strong> trên thanh địa chỉ, hoặc chọn tab <strong>"Tài khoản mẫu"</strong> để đăng nhập ngay mà không cần tài khoản Google.
                        </p>
                        <div className="pt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab("credential")}
                            className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                          >
                            → Chuyển sang Đăng nhập Mật khẩu / SĐT
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-stone-500 font-mono">
                        Xác thực an toàn qua Google Firebase Auth
                      </div>
                    </div>
                  )}
                </div>

                {/* Back to Home & Help Banner */}
                <div className="mt-8 pt-4 border-t border-stone-850 flex items-center justify-between text-[11px] text-stone-500">
                  <button 
                    onClick={() => setViewMode("landing")}
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors font-bold uppercase tracking-wider text-[10px]"
                  >
                    ← Quay lại trang chủ
                  </button>
                  <span>KiotX Security v2.1</span>
                </div>

              </div>
            </div>

          </div>
        </main>
      )}

    </div>
  );
}
