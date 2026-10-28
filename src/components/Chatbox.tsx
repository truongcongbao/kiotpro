import { useState, useRef, useEffect, FormEvent } from "react";
import { Message, Product, Invoice, ShopSetting, CashbookEntry, Project, Staff } from "../types";
import { MessageSquare, Send, X, Bot, HelpCircle, Activity, User } from "lucide-react";

interface ChatboxProps {
  isOpen: boolean;
  onClose: () => void;
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
  currentStaff?: Staff | null;
  products?: Product[];
  invoices?: Invoice[];
  settings?: ShopSetting | null;
  cashbook?: CashbookEntry[];
  projects?: Project[];
}

export default function Chatbox({ 
  isOpen, 
  onClose, 
  externalPrompt, 
  onClearExternalPrompt,
  currentStaff,
  products = [],
  invoices = [],
  settings = null,
  cashbook = [],
  projects = []
}: ChatboxProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      text: "Xin chào! Tôi là KiotX AI Co-Pilot — Trợ lý vận hành cửa hàng thông minh của bạn.\n\nTối ưu hóa doanh số và theo dõi tồn kho chưa bao giờ dễ dàng hơn thế! Tôi có thể giúp bạn phân tích dữ liệu bán hàng, dự báo doanh thu, gợi ý chương trình khuyến mãi để kích cầu, hoặc rà soát các sản phẩm sắp hết kho. Bạn cần tôi hỗ trợ phân tích nội dung gì hôm nay?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestionChips = [
    "Sản phẩm nào bán chạy nhất?",
    "Làm sao cải thiện lợi nhuận?",
    "Các mặt hàng nào cần nhập kho?",
    "Báo cáo sơ bộ doanh thu & sổ quỹ?"
  ];

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Update welcome message dynamically based on shop settings
  useEffect(() => {
    if (settings) {
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === "welcome"
            ? {
                ...msg,
                text: `Xin chào! Tôi là KiotX AI Co-Pilot — Trợ lý phân tích & vận hành cửa hàng thông minh của ${settings.shopName || "KiotX Store"}.\n\nTôi sẵn sàng hỗ trợ phân tích báo cáo bán hàng, rà soát sổ quỹ hoặc cảnh báo tồn kho tối thiểu của bạn. Bạn cần tôi hỗ trợ phân tích nội dung nào hôm nay?`
              }
            : msg
        )
      );
    }
  }, [settings]);

  // Handle external prompts
  useEffect(() => {
    if (isOpen && externalPrompt) {
      handleSendMessage(externalPrompt);
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
  }, [isOpen, externalPrompt]);

  const generateStoreContext = (): string => {
    const shopName = settings?.shopName || "KiotX Store";
    const address = settings?.address || "Chưa thiết lập";
    const phone = settings?.phone || "Chưa thiết lập";
    
    // 1. Basic info
    const basicInfo = `Cửa hàng: ${shopName}
Địa chỉ: ${address}
SĐT liên hệ: ${phone}`;

    // 2. Products
    const productCount = products.length;
    const lowStockProducts = products.filter(p => p.stock <= (p.minStock || 5));
    const sampleProducts = products.slice(0, 15).map(p => 
      `- ${p.name} (Mã: ${p.code}, Giá: ${p.sellingPrice.toLocaleString()}đ, Tồn: ${p.stock} ${p.unit || "đơn vị"})`
    ).join("\n");

    // 3. Invoices
    const completedInvs = invoices.filter(i => i.status === "COMPLETED");
    const totalSales = completedInvs.reduce((acc, curr) => acc + curr.totalPayable, 0);
    const invoiceSummary = completedInvs.slice(-5).map(i => 
      `- Mã HĐ: ${i.invoiceCode}, Khách: ${i.customerName || "Khách lẻ"}, Tổng: ${i.totalPayable.toLocaleString()}đ, Ngày: ${i.date ? i.date.substring(0, 10) : ""}`
    ).join("\n");

    // 4. Cashbook
    const totalIncome = cashbook.filter(c => c.type === "INCOME").reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = cashbook.filter(c => c.type === "EXPENSE").reduce((acc, curr) => acc + curr.amount, 0);
    const cashBalance = totalIncome - totalExpense;

    // 5. Projects
    const projectSummary = projects.map(p => 
      `- Dự án: ${p.name}, Khách: ${p.customerName}, Giá trị dự toán: ${p.budget.toLocaleString()}đ, Trạng thái: ${p.status}`
    ).join("\n");

    return `--- THÔNG TIN CỬA HÀNG ---
${basicInfo}

--- DANH SÁCH SẢN PHẨM ---
Tổng mặt hàng: ${productCount}
Chi tiết hàng hóa (tối đa 15 dòng):
${sampleProducts || "(Không có sản phẩm nào)"}

Mặt hàng sắp hết kho (tồn dưới tối thiểu):
${lowStockProducts.map(p => `- ${p.name} (Còn ${p.stock}, tối thiểu: ${p.minStock || 5})`).join("\n") || "Không có sản phẩm nào sắp hết kho."}

--- DOANH THU & HÓA ĐƠN ---
Doanh thu bán hàng (Hóa đơn hoàn thành): ${totalSales.toLocaleString()}đ (Tổng cộng ${completedInvs.length} hóa đơn)
Lịch sử hóa đơn gần đây:
${invoiceSummary || "(Chưa có hóa đơn nào)"}

--- SỔ QUỸ (THU CHI VẬN HÀNH) ---
Tổng quỹ thu: ${totalIncome.toLocaleString()}đ
Tổng quỹ chi: ${totalExpense.toLocaleString()}đ
Số dư khả dụng hiện tại: ${cashBalance.toLocaleString()}đ

--- TIẾN ĐỘ DỰ ÁN/CÔNG TRÌNH (RẤT QUAN TRỌNG) ---
Số lượng dự án đang theo dõi: ${projects.length}
Chi tiết dự án:
${projectSummary || "(Chưa lập dự án nào)"}`;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // 1. Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      // Create history for API (maximum last 10 messages)
      const formattedHistory = messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          text: m.text
        }));

      // Generate the latest store database context
      const storeContext = generateStoreContext();

      // 2. Fetch from Express API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: formattedHistory,
          storeContext: storeContext,
          userRole: currentStaff ? currentStaff.role : "GUEST",
          userName: currentStaff ? currentStaff.name : "Khách vãng lai"
        })
      });

      const data = await response.json();
      
      const modelMsg: Message = {
        id: `model-${Date.now()}`,
        role: "model",
        text: data.text || "Tôi đã nhận thông tin và đang xử lý dữ liệu của bạn.",
        timestamp: new Date().toISOString()
      };
      
      setMessages((prev) => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chatbot API fetch error:", error);
      
      // Fallback offline analytics intelligence using local state
      let answer = "";
      if (text.includes("sắp hết") || text.includes("kho") || text.includes("nhập")) {
        const lowStock = products.filter(p => p.stock <= (p.minStock || 5));
        if (lowStock.length > 0) {
          answer = `Dưới đây là các mặt hàng sắp hết kho cần bổ sung: ${lowStock.map(p => `${p.name} (còn ${p.stock} ${p.unit || ""})`).join(", ")}.`;
        } else {
          answer = "Hiện tại tất cả các mặt hàng đều có lượng tồn kho an toàn!";
        }
      } else if (text.includes("bán chạy") || text.includes("chạy nhất")) {
        answer = "Dựa trên dữ liệu hóa đơn gần đây: Các dòng sản phẩm thiết kế vách trần hoặc các mặt hàng có lượt thanh toán nhiều nhất đang chiếm tỉ trọng cao trong tổng doanh thu của cửa hàng!";
      } else if (text.includes("doanh thu") || text.includes("tiền") || text.includes("quỹ")) {
        const totalSales = invoices.filter(i => i.status === "COMPLETED").reduce((acc, curr) => acc + curr.totalPayable, 0);
        answer = `Doanh thu bán hàng hiện tại đạt ${totalSales.toLocaleString()}đ từ ${invoices.length} giao dịch. Để xem phân tích chuyên sâu hơn, vui lòng kết nối internet ổn định để kích hoạt AI Co-Pilot.`;
      } else {
        answer = "Hệ thống AI tạm thời hoạt động ngoại tuyến. Tôi vẫn ghi nhận thông tin và sẽ sẵn sàng phân tích biểu đồ nâng cao ngay khi có kết nối trở lại!";
      }

      const offlineMsg: Message = {
        id: `offline-${Date.now()}`,
        role: "model",
        text: answer + " (Phân tích ngoại tuyến từ KiotX Engine)",
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, offlineMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-stone-900 border-l border-stone-800 shadow-2xl flex flex-col animate-slide-in">
      {/* Drawer Header with Web3 glowing theme */}
      <div className="p-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Bot className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-stone-100 uppercase tracking-wide flex items-center gap-1.5">
              <span>KiotX Co-Pilot</span>
              <span className="px-1.5 py-0.5 text-[8px] bg-emerald-500 text-stone-950 font-black rounded-full">ACTIVE</span>
            </h3>
            <span className="text-[10px] text-stone-500 flex items-center gap-1 font-semibold">
              Trí tuệ nhân tạo phân tích cửa hàng
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer transition-colors"
          aria-label="Đóng Chat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="grow overflow-y-auto p-4 space-y-4 bg-stone-900/40">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
              {/* Avatar indicator */}
              <div
                className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                  isUser 
                    ? "bg-emerald-500 text-stone-950 border-emerald-400" 
                    : "bg-stone-950 text-emerald-400 border-stone-800"
                }`}
              >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              {/* Text Bubble */}
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-sm border ${
                  isUser
                    ? "bg-emerald-500 border-emerald-500/20 text-stone-950 font-semibold rounded-tr-none shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "bg-stone-950 border-stone-850 text-stone-200 rounded-tl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator Bubble */}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] mr-auto animate-pulse">
            <div className="h-7 w-7 rounded-full bg-stone-950 text-stone-300 shrink-0 flex items-center justify-center border border-stone-800">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-850 text-stone-400 text-xs flex items-center gap-1.5 rounded-tl-none">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce delay-150" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce delay-300" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 2 && !isLoading && (
        <div className="px-4 py-3 bg-stone-950/40 border-t border-stone-850">
          <span className="block text-[9px] uppercase font-bold text-stone-500 mb-2 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span>Phân tích nhanh cửa hàng:</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                className="text-[11px] font-bold text-stone-300 bg-stone-950 border border-stone-850 rounded-lg py-1.5 px-3 hover:border-emerald-500/50 hover:bg-stone-900 transition-all cursor-pointer text-left shadow-sm"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Form Input */}
      <form onSubmit={handleFormSubmit} className="p-4 border-t border-stone-850 bg-stone-950">
        <div className="relative flex items-center rounded-xl bg-stone-900 border border-stone-800 focus-within:border-emerald-500/50 p-1.5 transition-all">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder="Hỏi ý kiến trợ lý AI về tình hình kinh doanh..."
            className="grow px-3 py-2 bg-transparent text-stone-200 text-xs sm:text-sm focus:outline-none placeholder-stone-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="p-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-850 text-stone-950 disabled:text-stone-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Gửi tin nhắn"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        
        <div className="flex justify-between items-center text-[10px] text-stone-600 pt-3">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
            <span>Kết nối trực tiếp Cơ sở dữ liệu KiotX</span>
          </span>
        </div>
      </form>
    </div>
  );
}
