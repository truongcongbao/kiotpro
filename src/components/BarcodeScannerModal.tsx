import React, { useEffect, useRef, useState } from "react";
import { Product } from "../types";
import { 
  X, Camera, AlertTriangle, CheckCircle, RefreshCw, Barcode, Volume2, Sparkles, Plus, Search 
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export default function BarcodeScannerModal({ 
  isOpen, 
  onClose, 
  products, 
  onAddToCart 
}: BarcodeScannerModalProps) {
  
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  
  // Scanning feedback states
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string>("");
  const [scanErrorMsg, setScanErrorMsg] = useState<string>("");
  const [manualCode, setManualCode] = useState<string>("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCode = useRef<string>(null as any);
  const lastScannedTime = useRef<number>(0);
  const isTransitioningRef = useRef<boolean>(false);
  const shouldStopRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);

  // Safe stop scanner helper that avoids state transition conflicts
  const safeStopScanner = async () => {
    shouldStopRef.current = true;
    if (isTransitioningRef.current) {
      return;
    }
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const state = scanner.getState();
      // 2 = SCANNING, 3 = PAUSED
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
      setIsActive(false);
    } catch (err: any) {
      const errStr = String(err || "");
      if (!errStr.includes("Cannot transition") && !errStr.includes("not running")) {
        console.warn("Scanner stop handled:", err);
      }
    }
  };

  // Play standard barcode scanner beep sound
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.value = 1200; // Fast high pitch chirp
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime); // Gentle volume
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12); // Short chirp duration
    } catch (error) {
      console.warn("Unable to play scanner beep:", error);
    }
  };

  // Scan processor function
  const handleScanCode = (code: string, isSimulated = false) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Search product by barcode or by SKU code
    const matchedProduct = products.find(p => 
      (p.barcode && p.barcode === trimmed) || 
      p.code.toLowerCase() === trimmed.toLowerCase()
    );

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        setScanErrorMsg(`[${trimmed}] - "${matchedProduct.name}" đã hết hàng!`);
        setScanSuccessMsg("");
        setTimeout(() => setScanErrorMsg(""), 3500);
        return;
      }

      playBeep();
      onAddToCart(matchedProduct);
      
      // Flash feedback
      setScanSuccessMsg(`Đã thêm: ${matchedProduct.name} (${matchedProduct.unit})`);
      setScanErrorMsg("");
      setTimeout(() => setScanSuccessMsg(""), 3000);
    } else {
      setScanErrorMsg(`Không tìm thấy sản phẩm với mã: "${trimmed}"`);
      setScanSuccessMsg("");
      setTimeout(() => setScanErrorMsg(""), 4000);
    }
  };

  const startScanning = async (scanner: Html5Qrcode, cameraConfig: any) => {
    if (isTransitioningRef.current) return;
    setIsLoading(true);
    setErrorMsg("");
    isTransitioningRef.current = true;

    try {
      await scanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (width, height) => {
            // Rectangular standard box for barcodes
            const boxWidth = Math.min(width, 400) * 0.85;
            const boxHeight = Math.min(height, 250) * 0.45;
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          // Debounce scan results (avoid scanning same barcode multiple times within 1.5 seconds)
          const now = Date.now();
          if (lastScannedCode.current === decodedText && now - lastScannedTime.current < 1500) {
            return;
          }
          lastScannedCode.current = decodedText;
          lastScannedTime.current = now;
          
          handleScanCode(decodedText);
        },
        () => {
          // Error handler (silent frame reading errors)
        }
      );

      // If user closed modal while camera was spinning up
      if (shouldStopRef.current || !isMountedRef.current) {
        try {
          const state = scanner.getState();
          if (state === 2 || state === 3) {
            await scanner.stop();
          }
        } catch (_) {}
        setIsActive(false);
      } else {
        setIsActive(true);
      }
    } catch (err: any) {
      const errStr = String(err || "");
      if (errStr.includes("Cannot transition")) {
        // Silently swallow transition overlap error
        return;
      }
      console.error("Scanner start failed:", err);
      if (errStr.includes("NotAllowedError") || errStr.includes("Permission denied") || errStr.includes("permission") || errStr.includes("userMedia")) {
        setErrorMsg("PERMISSION_DENIED");
      } else {
        setErrorMsg("Không thể kết nối máy ảnh. Vui lòng kiểm tra quyền camera hoặc chọn một camera khác.");
      }
    } finally {
      isTransitioningRef.current = false;
      setIsLoading(false);
    }
  };

  // Change camera trigger
  const handleCameraChange = async (cameraId: string) => {
    if (!scannerRef.current || isTransitioningRef.current) return;
    setSelectedCameraId(cameraId);
    
    try {
      await safeStopScanner();
      if (isMountedRef.current && isOpen && scannerRef.current) {
        await startScanning(scannerRef.current, cameraId);
      }
    } catch (error) {
      console.error("Failed to switch camera:", error);
    }
  };

  // Manual code form search handler
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScanCode(manualCode);
      setManualCode("");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setIsActive(false);
      return;
    }
    
    isMountedRef.current = true;
    shouldStopRef.current = false;
    const elementId = "pos-scanner-viewport";
    let html5Qrcode: Html5Qrcode;
    
    // Set up brief timeout to guarantee DOM mounting before initializing scanner
    const timer = setTimeout(() => {
      if (!isMountedRef.current || shouldStopRef.current) return;
      try {
        html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;
        
        Html5Qrcode.getCameras().then(devices => {
          if (!isMountedRef.current || shouldStopRef.current) return;
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Search back camera default
            const backCam = devices.find(d => 
              d.label.toLowerCase().includes("back") || 
              d.label.toLowerCase().includes("sau") ||
              d.label.toLowerCase().includes("environment")
            );
            const selectedId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(selectedId);
            startScanning(html5Qrcode, selectedId);
          } else {
            // Fallback back camera
            startScanning(html5Qrcode, { facingMode: "environment" });
          }
        }).catch(err => {
          if (!isMountedRef.current || shouldStopRef.current) return;
          console.warn("Camera enumeration failed, trying direct start:", err);
          startScanning(html5Qrcode, { facingMode: "environment" });
        });
        
      } catch (e) {
        console.error("Failed to set up camera:", e);
        setErrorMsg("Không thể cài đặt phần mềm quét mã.");
      }
    }, 200);

    return () => {
      isMountedRef.current = false;
      shouldStopRef.current = true;
      clearTimeout(timer);
      safeStopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-12 max-h-[90vh]">
        
        {/* LEFT COMPARTMENT: Camera Video Port & Control (7 columns) */}
        <div className="md:col-span-7 flex flex-col justify-between border-r border-stone-850 p-5 bg-stone-950/40">
          <div className="space-y-4">
            {/* Header Title with scanning active pulse */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Camera className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-stone-100 flex items-center gap-1.5">
                    Quét Mã Vạch Hàng Hóa
                    {isActive && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
                  </h3>
                  <p className="text-[10px] text-stone-500">Giữ mã vạch trước ống kính để máy quét tự động nhận dạng</p>
                </div>
              </div>

              {/* Sound Beep Indicator badge */}
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800 text-[10px] text-stone-400 font-bold uppercase">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Âm thanh: Bật</span>
              </div>
            </div>

            {/* Error Message banner */}
            {errorMsg === "PERMISSION_DENIED" ? (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-400 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Quyền truy cập Camera bị chặn (Permission Denied) 🔒</span>
                </div>
                <div className="pl-6 space-y-1 text-[11px] leading-relaxed text-stone-300">
                  <p>Để bắt đầu quét mã vạch sản phẩm bằng camera, quý khách vui lòng:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Click vào <strong>biểu tượng ổ khóa hoặc camera</strong> ở góc trái thanh địa chỉ trình duyệt.</li>
                    <li>Chọn <strong>"Cho phép" (Allow)</strong> cho quyền truy cập máy ảnh.</li>
                    <li>Hoặc click vào nút <strong>"Mở trong tab mới" (Open in new tab)</strong> ở góc trên bên phải trang web, sau đó bật tính năng quét mã.</li>
                  </ol>
                  <p className="text-[10px] text-amber-400 font-medium italic mt-1">Mẹo: Bạn có thể nhập nhanh mã vạch/mã sản phẩm vào ô nhập thủ công ở góc phải để thêm sản phẩm ngay mà không cần camera!</p>
                </div>
              </div>
            ) : errorMsg ? (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            {/* LIVE VIEWER STAGE */}
            <div className="relative rounded-2xl border border-stone-850 overflow-hidden bg-stone-950 aspect-[4/3] flex items-center justify-center">
              {errorMsg === "PERMISSION_DENIED" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-stone-950">
                  <div className="h-12 w-12 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-amber-400">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-xs font-bold text-stone-300">Yêu cầu quyền truy cập Camera</h4>
                    <p className="text-[10px] text-stone-500 leading-normal">
                      Hãy cấp quyền sử dụng camera trong cài đặt trình duyệt của bạn hoặc mở website trong một tab mới để sử dụng tính năng này.
                    </p>
                  </div>
                </div>
              ) : (
                <div id="pos-scanner-viewport" className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
              )}
              
              {/* Scan viewport laser animation frame overlay */}
              {isActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                  {/* Hologram targeting reticle */}
                  <div className="w-[85%] h-[45%] border-2 border-emerald-500/35 rounded-xl flex items-center justify-center relative overflow-hidden bg-emerald-500/5">
                    {/* Corner accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                    
                    {/* Animated scanning laser line */}
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-scan-laser" />
                  </div>
                  
                  <span className="mt-3.5 px-3 py-1 bg-stone-950/95 border border-stone-800 text-stone-400 text-[10px] font-black tracking-widest uppercase rounded-full">
                    Khung đọc mã vạch
                  </span>
                </div>
              )}

              {isLoading && (
                <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center gap-2 z-20">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Đang kích hoạt Camera...</span>
                </div>
              )}
            </div>
          </div>

          {/* Camera Selection dropdown list */}
          <div className="mt-4 pt-3 border-t border-stone-850 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-stone-500 font-bold uppercase block">Chọn Thiết bị Máy ảnh</label>
              {cameras.length > 0 ? (
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {cameras.map((device, idx) => (
                    <option key={device.id} value={device.id}>
                      {device.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[10px] text-stone-400 italic">Mặc định thiết bị tích hợp</div>
              )}
            </div>

            <div className="flex items-center gap-2 self-end">
              <span className="text-[10px] text-stone-500 font-bold uppercase">Trạng thái:</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-stone-900 text-stone-500 border border-stone-800"
              }`}>
                {isActive ? "Sẵn sàng quét" : "Ngoại tuyến"}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COMPARTMENT: Search simulation, manual inputs & scanned lists (5 columns) */}
        <div className="md:col-span-5 flex flex-col justify-between p-5 bg-stone-900/60 max-h-full overflow-y-auto">
          <div className="space-y-5">
            {/* Modal Exit */}
            <div className="flex justify-between items-center pb-2 border-b border-stone-850">
              <div className="flex items-center gap-1">
                <Barcode className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">Thông Tin &amp; Giao Tiếp</span>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-850 hover:bg-stone-850 text-stone-400 hover:text-stone-100 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scan success/error Toast inside sidebar panel */}
            <div className="space-y-2">
              {scanSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn shadow-[0_0_15px_rgba(16,185,129,0.08)]">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                  <span className="truncate">{scanSuccessMsg}</span>
                </div>
              )}

              {scanErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span>{scanErrorMsg}</span>
                </div>
              )}

              {!scanSuccessMsg && !scanErrorMsg && (
                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-850 text-stone-500 text-xs flex items-center gap-2 italic">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>Sản phẩm quét thành công sẽ hiển thị ở đây và tự động cộng vào hóa đơn...</span>
                </div>
              )}
            </div>

            {/* Manual input backup */}
            <form onSubmit={handleManualSubmit} className="space-y-1.5">
              <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Quét bằng tay (Nhập Barcode / SKU)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 text-stone-500 h-3.5 w-3.5" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ví dụ: 893000000121..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs uppercase rounded-lg cursor-pointer shrink-0"
                >
                  Kiểm tra
                </button>
              </div>
            </form>

            {/* SIMULATED SCANNING COMPARTMENT (Must support testing on desktop/laptop!) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider block">Trình mô phỏng quét mã nhanh</span>
                <span className="text-[9px] text-amber-500 font-bold uppercase">Click để chạy thử</span>
              </div>
              
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleScanCode(p.barcode || p.code, true)}
                    className="w-full p-2 rounded-xl bg-stone-950 hover:bg-stone-850 border border-stone-850 text-left transition-all hover:border-emerald-500/30 flex items-center justify-between gap-3 cursor-pointer group group-hover:scale-102"
                  >
                    <div className="space-y-0.5 leading-none">
                      <span className="text-stone-300 font-bold text-[11px] block group-hover:text-emerald-400 transition-colors">
                        {p.name}
                      </span>
                      <span className="text-[9px] text-stone-500 font-mono flex items-center gap-1">
                        <Barcode className="h-3 w-3 text-stone-600" />
                        Mã: {p.barcode || p.code}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-amber-400 font-bold font-mono block">
                        {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p.sellingPrice)}
                      </span>
                      <span className="text-[9px] text-stone-500 block">
                        Kho: {p.stock}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-850 text-center">
            <button
              onClick={onClose}
              className="w-full py-2 bg-stone-950 hover:bg-stone-850 text-stone-300 hover:text-stone-100 border border-stone-800 rounded-xl font-bold text-xs uppercase cursor-pointer transition-colors"
            >
              Hoàn tất quét &amp; Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
