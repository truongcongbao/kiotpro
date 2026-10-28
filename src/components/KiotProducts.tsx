import React, { useState, useMemo } from "react";
import { Product, Category, InventoryAudit, InventoryAuditItem, PurchaseOrder, Supplier, PurchaseOrderItem, Staff } from "../types";
import { safeDispatchEvent } from "../lib/events";
import * as XLSX from "xlsx";
import { 
  Search, Plus, Edit2, Trash2, Tag, Layers, CheckCircle, AlertTriangle, 
  ArrowUpDown, Filter, Upload, Download, RefreshCw, Clipboard, Calendar, FileText,
  User, DollarSign, ShoppingBag, PlusCircle, MinusCircle, Truck, Lock
} from "lucide-react";

interface KiotProductsProps {
  products: Product[];
  categories: Category[];
  audits: InventoryAudit[];
  purchaseOrders?: PurchaseOrder[];
  suppliers?: Supplier[];
  currentStaff?: Staff | null;
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onImportProducts?: (imported: Product[]) => void;
  onDeleteProduct: (productId: string) => void;
  onAddCategory: (category: Category) => void;
  onAddAudit: (audit: InventoryAudit) => void;
  onApplyAuditStock: (audit: InventoryAudit) => void;
  onAddPurchaseOrder?: (po: PurchaseOrder) => void;
}

export default function KiotProducts({
  products,
  categories,
  audits,
  purchaseOrders = [],
  suppliers = [],
  currentStaff = null,
  onAddProduct,
  onEditProduct,
  onImportProducts,
  onDeleteProduct,
  onAddCategory,
  onAddAudit,
  onApplyAuditStock,
  onAddPurchaseOrder
}: KiotProductsProps) {
  
  const hasPermission = (perm: "productCreateEdit" | "productDelete" | "inventoryAudit") => {
    if (!currentStaff) return true;
    if (currentStaff.role === "OWNER") return true;
    if (currentStaff.permissions?.[perm] !== undefined) {
      return currentStaff.permissions[perm];
    }
    if (currentStaff.role === "MANAGER") {
      if (perm === "productDelete") return false;
      return true;
    }
    return false;
  };

  // Tab within products: Products List or Categories or Inventory Audit or Purchase Order
  const [activeSubTab, setActiveSubTab] = useState<"list" | "audit" | "purchase">("list");
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out" | "near_expiry" | "expired">("all");

  // Add/Edit Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Deleting confirmation state
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingProductName, setDeletingProductName] = useState<string>("");

  // Form State for Product
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formCostPrice, setFormCostPrice] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);
  const [formStock, setFormStock] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formUnit, setFormUnit] = useState("Cái");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");

  // Category list form
  const [newCatName, setNewCatName] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Import Excel State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Audit Form State
  const [isCreatingAudit, setIsCreatingAudit] = useState(false);
  const [auditItems, setAuditItems] = useState<{ product: Product; actualQty: number; notes: string }[]>([]);
  const [auditNote, setAuditNote] = useState("");

  // Purchase Order (Nhập Kho) Form State
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [poSelectedSupplierId, setPoSelectedSupplierId] = useState("");
  const [poItems, setPoItems] = useState<{ product: Product; quantity: number; costPrice: number }[]>([]);
  const [poAmountPaid, setPoAmountPaid] = useState<number>(0);
  const [poNote, setPoNote] = useState("");
  const [poSearchQuery, setPoSearchQuery] = useState("");

  // Format currency
  const formatVND = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  // Helper to get expiry status
  const getExpiryStatus = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime())) return null;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: "expired" as const, days: Math.abs(diffDays) };
    } else if (diffDays <= 30) {
      return { status: "near" as const, days: diffDays };
    }
    return { status: "good" as const, days: diffDays };
  };

  // Filter products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.barcode && p.barcode.includes(searchQuery));
      const matchesCategory = selectedCategory === "Tất cả" || p.category === selectedCategory;
      
      let matchesStock = true;
      if (stockFilter === "low") {
        matchesStock = p.stock <= p.minStock && p.stock > 0;
      } else if (stockFilter === "out") {
        matchesStock = p.stock <= 0;
      } else if (stockFilter === "near_expiry") {
        const exp = getExpiryStatus(p.expiryDate);
        matchesStock = exp !== null && exp.status === "near";
      } else if (stockFilter === "expired") {
        const exp = getExpiryStatus(p.expiryDate);
        matchesStock = exp !== null && exp.status === "expired";
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, stockFilter]);

  // Autocomplete products search for purchase draft
  const poFilteredSearchProducts = useMemo(() => {
    if (!poSearchQuery.trim()) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(poSearchQuery.toLowerCase()))
    ).slice(0, 5);
  }, [products, poSearchQuery]);

  // Open Add/Edit Product Modal
  const handleOpenProductModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormName(product.name);
      setFormCode(product.code);
      setFormBarcode(product.barcode || "");
      setFormCategory(product.category);
      setFormCostPrice(product.costPrice);
      setFormSellingPrice(product.sellingPrice);
      setFormStock(product.stock);
      setFormMinStock(product.minStock);
      setFormUnit(product.unit);
      setFormImageUrl(product.imageUrl || "");
      setFormExpiryDate(product.expiryDate || "");
    } else {
      setEditingProduct(null);
      // Auto-generate code
      const nextIdNum = products.length + 1;
      setFormCode(`SP${String(nextIdNum).padStart(6, "0")}`);
      setFormName("");
      setFormBarcode("");
      setFormCategory(categories[0]?.name || "Chưa phân loại");
      setFormCostPrice(0);
      setFormSellingPrice(0);
      setFormStock(0);
      setFormMinStock(5);
      setFormUnit("Cái");
      setFormImageUrl("");
      setFormExpiryDate("");
    }
    setIsProductModalOpen(true);
  };

  // Save Product (Create or Update)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCategory) {
      alert("Tên sản phẩm và nhóm hàng là bắt buộc!");
      return;
    }

    const prodData: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      code: formCode || `SP${String(Date.now()).slice(-6)}`,
      name: formName,
      barcode: formBarcode || undefined,
      category: formCategory,
      costPrice: Number(formCostPrice),
      sellingPrice: Number(formSellingPrice),
      stock: Number(formStock),
      minStock: Number(formMinStock),
      unit: formUnit,
      imageUrl: formImageUrl || undefined,
      expiryDate: formExpiryDate || undefined
    };

    if (editingProduct) {
      onEditProduct(prodData);
      
      // Log price edit or general edit
      if (editingProduct.sellingPrice !== prodData.sellingPrice || editingProduct.costPrice !== prodData.costPrice) {
        safeDispatchEvent("kiot-add-audit-log", {
          actionType: "PRODUCT_PRICE_EDIT",
          actionName: "Chỉnh sửa giá sản phẩm",
          description: `Thay đổi giá bán sản phẩm ${prodData.code} (${prodData.name}): Giá bán từ ${editingProduct.sellingPrice.toLocaleString("vi-VN")}đ thành ${prodData.sellingPrice.toLocaleString("vi-VN")}đ, Giá vốn từ ${editingProduct.costPrice.toLocaleString("vi-VN")}đ thành ${prodData.costPrice.toLocaleString("vi-VN")}đ.`,
          actorName: currentStaff?.name || "Chủ cửa hàng (Hệ thống)",
          actorRole: currentStaff?.role || "OWNER"
        });
      }
    } else {
      // Check duplicate code
      const dup = products.find(p => p.code === prodData.code);
      if (dup) {
        alert("Mã sản phẩm này đã được sử dụng!");
        return;
      }
      onAddProduct(prodData);
      
      safeDispatchEvent("kiot-add-audit-log", {
        actionType: "PRODUCT_CREATE",
        actionName: "Thêm sản phẩm mới",
        description: `Thêm sản phẩm thành công: ${prodData.name} (Mã: ${prodData.code}) với giá bán ${prodData.sellingPrice.toLocaleString("vi-VN")}đ, tồn kho ban đầu: ${prodData.stock} ${prodData.unit}.`,
        actorName: currentStaff?.name || "Chủ cửa hàng (Hệ thống)",
        actorRole: currentStaff?.role || "OWNER"
      });
    }

    setIsProductModalOpen(false);
  };

  // Add Category Handler
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    const dup = categories.find(c => c.name.toLowerCase() === newCatName.toLowerCase());
    if (dup) {
      alert("Danh mục này đã tồn tại!");
      return;
    }

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCatName,
      description: "Thêm mới thủ công"
    };

    onAddCategory(newCat);
    
    safeDispatchEvent("kiot-add-audit-log", {
      actionType: "CATEGORY_CREATE",
      actionName: "Thêm danh mục mới",
      description: `Đã thêm danh mục mới thành công: "${newCat.name}" (Mã: ${newCat.id}).`,
      actorName: currentStaff?.name || "Chủ cửa hàng (Hệ thống)",
      actorRole: currentStaff?.role || "OWNER"
    });

    setNewCatName("");
    setIsCategoryModalOpen(false);
  };

  // Delete product with confirmation
  const handleDeleteProductClick = (productId: string, name: string) => {
    setDeletingProductId(productId);
    setDeletingProductName(name);
  };

  const handleConfirmDeleteProduct = () => {
    if (deletingProductId) {
      onDeleteProduct(deletingProductId);
      
      safeDispatchEvent("kiot-add-audit-log", {
        actionType: "PRODUCT_DELETE",
        actionName: "Xóa sản phẩm",
        description: `Đã xóa sản phẩm "${deletingProductName}" (Mã: ${deletingProductId}) khỏi hệ thống.`,
        actorName: currentStaff?.name || "Chủ cửa hàng (Hệ thống)",
        actorRole: currentStaff?.role || "OWNER"
      });

      safeDispatchEvent("kiot-toast", {
        type: "success",
        title: "ĐÃ XÓA SẢN PHẨM",
        message: `Đã xóa sản phẩm "${deletingProductName}" khỏi hệ thống thành công.`
      });
      setDeletingProductId(null);
      setDeletingProductName("");
    }
  };

  // --- INVENTORY AUDIT FLOW ---
  const handleStartAudit = () => {
    setIsCreatingAudit(true);
    setAuditItems([]);
    setAuditNote("");
  };

  const handleAddProductToAudit = (prod: Product) => {
    const existing = auditItems.find(item => item.product.id === prod.id);
    if (existing) return;

    setAuditItems(prev => [...prev, { product: prod, actualQty: prod.stock, notes: "Kiểm đếm khớp" }]);
  };

  const handleRemoveProductFromAudit = (productId: string) => {
    setAuditItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleAuditQtyChange = (productId: string, actualQtyVal: number) => {
    setAuditItems(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, actualQty: Math.max(0, actualQtyVal) } 
        : item
    ));
  };

  const handleAuditItemNoteChange = (productId: string, noteStr: string) => {
    setAuditItems(prev => prev.map(item => 
      item.product.id === productId 
        ? { ...item, notes: noteStr } 
        : item
    ));
  };

  const handleCompleteAudit = () => {
    if (auditItems.length === 0) {
      alert("Vui lòng chọn ít nhất 1 sản phẩm để kiểm kho!");
      return;
    }

    const auditCode = `KK${new Date().getFullYear()}${String(audits.length + 1).padStart(4, "0")}`;
    const items: InventoryAuditItem[] = auditItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productCode: item.product.code,
      systemQty: item.product.stock,
      actualQty: item.actualQty,
      discrepancy: item.actualQty - item.product.stock,
      notes: item.notes
    }));

    const newAudit: InventoryAudit = {
      id: `audit-${Date.now()}`,
      auditCode,
      date: new Date().toISOString(),
      auditorName: "Trương Công Bảo", // Current logged-in staff
      items,
      status: "COMPLETED",
      notes: auditNote || undefined
    };

    onAddAudit(newAudit);
    onApplyAuditStock(newAudit); // Directly sync stock levels!
    setIsCreatingAudit(false);
    setAuditItems([]);
    setAuditNote("");
    
    alert(`Đã hoàn tất phiếu kiểm kho ${auditCode}! Hệ thống đã điều chỉnh lại số lượng tồn kho thực tế.`);
  };

  // --- PURCHASE ORDER HANDLERS (Weighted Average Costing) ---
  const handleStartPO = () => {
    setIsCreatingPO(true);
    setPoSelectedSupplierId(suppliers[0]?.id || "");
    setPoItems([]);
    setPoAmountPaid(0);
    setPoNote("");
    setPoSearchQuery("");
  };

  const handleAutoGeneratePO = () => {
    const lowStockProds = products.filter(p => p.stock < p.minStock);
    if (lowStockProds.length === 0) {
      alert("Tuyệt vời! Hiện tại không có sản phẩm nào có số lượng tồn dưới định mức tối thiểu. Không cần tạo phiếu bù kho.");
      return;
    }

    setIsCreatingPO(true);
    setPoSelectedSupplierId(suppliers[0]?.id || "");
    setPoAmountPaid(0);
    setPoNote("Hệ thống tự động đề xuất bù đủ kho cho các mặt hàng dưới định mức tối thiểu.");
    setPoSearchQuery("");

    const items = lowStockProds.map(p => ({
      product: p,
      quantity: Math.max(1, p.minStock - p.stock),
      costPrice: p.costPrice
    }));
    setPoItems(items);

    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "ĐÃ TỰ ĐỘNG LẬP PHIẾU NHÁP",
      message: `Đã tự động thêm ${items.length} mặt hàng sắp hết hàng vào phiếu nhập với số lượng bù đủ kho định mức.`
    });
  };

  const handleAddProductToPO = (prod: Product) => {
    const existing = poItems.find(item => item.product.id === prod.id);
    if (existing) return;
    setPoItems(prev => [...prev, { product: prod, quantity: 1, costPrice: prod.costPrice }]);
  };

  const handleRemoveProductFromPO = (productId: string) => {
    setPoItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handlePOQtyChange = (productId: string, qty: number) => {
    setPoItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity: Math.max(1, qty) } : item
    ));
  };

  const handlePOCostChange = (productId: string, cost: number) => {
    setPoItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, costPrice: Math.max(0, cost) } : item
    ));
  };

  const handleCompletePO = () => {
    if (poItems.length === 0) {
      alert("Vui lòng chọn ít nhất 1 sản phẩm để nhập kho!");
      return;
    }
    if (!poSelectedSupplierId) {
      alert("Vui lòng chọn Nhà cung cấp!");
      return;
    }

    const supplier = suppliers.find(s => s.id === poSelectedSupplierId);
    if (!supplier) {
      alert("Nhà cung cấp không tồn tại!");
      return;
    }

    const totalAmount = poItems.reduce((acc, curr) => acc + (curr.quantity * curr.costPrice), 0);
    const amountOwed = Math.max(0, totalAmount - poAmountPaid);

    const orderCode = `PN${new Date().getFullYear()}${String(purchaseOrders.length + 1).padStart(4, "0")}`;

    const items: PurchaseOrderItem[] = poItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productCode: item.product.code,
      quantity: item.quantity,
      costPrice: item.costPrice,
      total: item.quantity * item.costPrice
    }));

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      orderCode,
      date: new Date().toISOString(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      items,
      totalAmount,
      amountPaid: poAmountPaid,
      amountOwed,
      status: "COMPLETED"
    };

    if (onAddPurchaseOrder) {
      onAddPurchaseOrder(newPO);
    }

    setIsCreatingPO(false);
    setPoItems([]);
    
    alert(`Hoàn tất phiếu nhập kho ${orderCode}! Hệ thống đã tăng tồn kho và tự động điều chỉnh lại giá vốn bình quân gia quyền cho các sản phẩm.`);
  };

  // Actual excel export function with SheetJS (XLSX) for professional binary spreadsheet generation
  const handleExportExcel = () => {
    const headers = [
      "Mã sản phẩm",
      "Tên sản phẩm",
      "Nhóm hàng",
      "Giá vốn",
      "Giá bán",
      "Tồn kho",
      "Tồn tối thiểu",
      "Đơn vị tính",
      "Barcode"
    ];
    
    const rows = products.map(p => [
      p.code,
      p.name,
      p.category,
      p.costPrice,
      p.sellingPrice,
      p.stock,
      p.minStock,
      p.unit,
      p.barcode || ""
    ]);

    try {
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const data = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Set nice column widths for the generated Excel file
      ws['!cols'] = [
        { wch: 15 }, // Mã sản phẩm
        { wch: 35 }, // Tên sản phẩm
        { wch: 20 }, // Nhóm hàng
        { wch: 12 }, // Giá vốn
        { wch: 12 }, // Giá bán
        { wch: 10 }, // Tồn kho
        { wch: 12 }, // Tồn tối thiểu
        { wch: 10 }, // ĐVT
        { wch: 16 }  // Barcode
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Danh sách hàng hóa");
      XLSX.writeFile(wb, `Danh_Sach_Hang_Hoa_${new Date().toISOString().slice(0, 10)}.xlsx`);

      // Dispatch custom event for a beautiful toast
      safeDispatchEvent("kiot-toast", {
        type: "stock-warning",
        title: "XUẤT EXCEL THÀNH CÔNG",
        message: `Đã xuất ${products.length} mặt hàng ra file Excel (.xlsx) thành công!`
      });
    } catch (error: any) {
      alert("Lỗi khi xuất file Excel: " + error.message);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Mã sản phẩm",
      "Tên sản phẩm",
      "Nhóm hàng",
      "Giá vốn",
      "Giá bán",
      "Tồn kho",
      "Tồn tối thiểu",
      "Đơn vị tính",
      "Barcode"
    ];
    // Add sample products as template rows
    const samples = [
      ["SP000100", "Bột giặt OMO Matic 2kg", "Hóa mỹ phẩm", 120000, 155000, 50, 10, "Túi", "8934868121001"],
      ["SP000101", "Nước xả vải Downy Huyền Bí 1.8L", "Hóa mỹ phẩm", 110000, 145000, 40, 8, "Túi", "8934868121018"]
    ];

    try {
      const wb = XLSX.utils.book_new();
      const data = [headers, ...samples];
      const ws = XLSX.utils.aoa_to_sheet(data);

      ws['!cols'] = [
        { wch: 15 }, // Mã sản phẩm
        { wch: 35 }, // Tên sản phẩm
        { wch: 20 }, // Nhóm hàng
        { wch: 12 }, // Giá vốn
        { wch: 12 }, // Giá bán
        { wch: 10 }, // Tồn kho
        { wch: 12 }, // Tồn tối thiểu
        { wch: 10 }, // ĐVT
        { wch: 16 }  // Barcode
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Mẫu nhập hàng hóa");
      XLSX.writeFile(wb, "KiotX_Product_Template.xlsx");
    } catch (error: any) {
      alert("Lỗi khi tải file mẫu: " + error.message);
    }
  };

  const handleDeletePreviewItem = (index: number) => {
    setImportPreviewData(prev => prev.filter((_, i) => i !== index));
    safeDispatchEvent("kiot-toast", {
      type: "success",
      title: "ĐÃ LOẠI BỎ",
      message: "Đã xóa sản phẩm khỏi danh sách chuẩn bị nhập."
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    parseProductFile(file);
  };

  const parseProductFile = (file: File) => {
    const reader = new FileReader();
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    reader.onload = (event) => {
      try {
        let parsedRows: any[] = [];
        const logs: string[] = [`Đã đọc file "${file.name}".`];

        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to json array of arrays
          const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          if (sheetData.length <= 1) {
            throw new Error("File Excel không có dòng dữ liệu nào ngoài dòng tiêu đề.");
          }

          const headers = sheetData[0].map((h: any) => String(h || "").trim().toLowerCase());
          
          const indexMap: Record<string, number> = {
            code: headers.findIndex(h => h.includes("mã") || h.includes("code") || h.includes("sku")),
            name: headers.findIndex(h => h.includes("tên") || h.includes("name") || h.includes("sản phẩm")),
            category: headers.findIndex(h => h.includes("nhóm") || h.includes("loại") || h.includes("danh mục") || h.includes("category")),
            costPrice: headers.findIndex(h => h.includes("giá vốn") || h.includes("vốn") || h.includes("cost")),
            sellingPrice: headers.findIndex(h => h.includes("giá bán") || h.includes("bán") || h.includes("price")),
            stock: headers.findIndex(h => h.includes("tồn") || h.includes("kho") || h.includes("stock") || h.includes("số lượng")),
            minStock: headers.findIndex(h => h.includes("tối thiểu") || h.includes("cảnh báo") || h.includes("min")),
            unit: headers.findIndex(h => h.includes("đơn vị") || h.includes("dvt") || h.includes("unit")),
            barcode: headers.findIndex(h => h.includes("barcode") || h.includes("mã vạch") || h.includes("vạch"))
          };

          // Strict checking: MUST have name, and at least some price/stock/code columns matched to be valid product sheet
          const matchedKeys = Object.keys(indexMap).filter(k => indexMap[k] !== -1);
          const hasName = indexMap.name !== -1;
          const hasPriceOrStock = indexMap.sellingPrice !== -1 || indexMap.costPrice !== -1 || indexMap.stock !== -1;

          if (!hasName || !hasPriceOrStock || matchedKeys.length < 3) {
            throw new Error(
              `Cấu trúc file Excel không khớp với mẫu hàng hóa chuẩn!\n` +
              `- Phải chứa cột tiêu đề 'Tên sản phẩm' hoặc 'Tên'\n` +
              `- Phải chứa ít nhất cột Giá bán, Giá vốn hoặc Tồn kho.\n` +
              `Vui lòng kiểm tra lại file hoặc tải File Excel mẫu.`
            );
          }

          logs.push(`Phát hiện ${sheetData.length - 1} hàng dữ liệu trong sheet "${firstSheetName}".`);

          for (let i = 1; i < sheetData.length; i++) {
            const cols = sheetData[i];
            if (!cols || cols.length === 0) continue;

            const getValue = (field: string) => {
              const idx = indexMap[field];
              if (idx === undefined || idx === -1 || idx >= cols.length) return "";
              return String(cols[idx] ?? "").trim();
            };

            const rawCode = getValue("code");
            const name = getValue("name");
            const category = getValue("category") || "Chưa phân loại";
            const costPrice = parseFloat(getValue("costPrice").replace(/[^0-9.-]/g, "")) || 0;
            const sellingPrice = parseFloat(getValue("sellingPrice").replace(/[^0-9.-]/g, "")) || 0;
            const stock = parseFloat(getValue("stock").replace(/[^0-9.-]/g, "")) || 0;
            const minStock = parseFloat(getValue("minStock").replace(/[^0-9.-]/g, "")) || 5;
            const unit = getValue("unit") || "Cái";
            const barcode = getValue("barcode");

            const code = rawCode || `SP${String(products.length + parsedRows.length + 1).padStart(6, "0")}`;

            if (!name) {
              logs.push(`⚠️ Bỏ qua dòng ${i + 1}: Thiếu Tên sản phẩm.`);
              continue;
            }

            const isExisting = products.some(p => p.code.toLowerCase() === code.toLowerCase());

            parsedRows.push({
              code,
              name,
              category,
              costPrice,
              sellingPrice,
              stock,
              minStock,
              unit,
              barcode,
              action: isExisting ? "UPDATE" : "CREATE"
            });
          }
        } else {
          // Fallback to CSV text reader
          const text = event.target?.result as string;
          if (!text) throw new Error("File rỗng hoặc không đọc được dữ liệu.");

          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length <= 1) {
            throw new Error("File không có dòng dữ liệu nào ngoài dòng tiêu đề.");
          }

          const headerLine = lines[0];
          let separator = ",";
          if (headerLine.includes(";")) separator = ";";
          else if (headerLine.includes("\t")) separator = "\t";

          const headerCols = headerLine.split(separator).map(h => h.replace(/^[\uFEFF"]|["\r\n]$/g, '').trim().toLowerCase());
          
          const indexMap: Record<string, number> = {
            code: headerCols.findIndex(h => h.includes("mã") || h.includes("code") || h.includes("sku")),
            name: headerCols.findIndex(h => h.includes("tên") || h.includes("name") || h.includes("sản phẩm")),
            category: headerCols.findIndex(h => h.includes("nhóm") || h.includes("loại") || h.includes("danh mục") || h.includes("category")),
            costPrice: headerCols.findIndex(h => h.includes("giá vốn") || h.includes("vốn") || h.includes("cost")),
            sellingPrice: headerCols.findIndex(h => h.includes("giá bán") || h.includes("bán") || h.includes("price")),
            stock: headerCols.findIndex(h => h.includes("tồn") || h.includes("kho") || h.includes("stock") || h.includes("số lượng")),
            minStock: headerCols.findIndex(h => h.includes("tối thiểu") || h.includes("cảnh báo") || h.includes("min")),
            unit: headerCols.findIndex(h => h.includes("đơn vị") || h.includes("dvt") || h.includes("unit")),
            barcode: headerCols.findIndex(h => h.includes("barcode") || h.includes("mã vạch") || h.includes("vạch"))
          };

          // Strict checking: MUST have name, and at least some price/stock/code columns matched to be valid product sheet
          const matchedKeys = Object.keys(indexMap).filter(k => indexMap[k] !== -1);
          const hasName = indexMap.name !== -1;
          const hasPriceOrStock = indexMap.sellingPrice !== -1 || indexMap.costPrice !== -1 || indexMap.stock !== -1;

          if (!hasName || !hasPriceOrStock || matchedKeys.length < 3) {
            throw new Error(
              `Cấu trúc file CSV không khớp với mẫu hàng hóa chuẩn!\n` +
              `- Phải chứa cột tiêu đề 'Tên sản phẩm' hoặc 'Tên'\n` +
              `- Phải chứa ít nhất cột Giá bán, Giá vốn hoặc Tồn kho.\n` +
              `Vui lòng kiểm tra lại file hoặc tải File Excel mẫu.`
            );
          }

          logs.push(`Phát hiện ${lines.length - 1} hàng dữ liệu.`);

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            
            let cols: string[] = [];
            let currentField = "";
            let insideQuotes = false;
            
            for (let c = 0; c < line.length; c++) {
              const char = line[c];
              if (char === '"') {
                insideQuotes = !insideQuotes;
              } else if (char === separator && !insideQuotes) {
                cols.push(currentField.trim());
                currentField = "";
              } else {
                currentField += char;
              }
            }
            cols.push(currentField.trim());

            const getValue = (field: string) => {
              const idx = indexMap[field];
              if (idx === undefined || idx === -1 || idx >= cols.length) return "";
              return cols[idx].replace(/^"|"$/g, '').trim();
            };

            const rawCode = getValue("code");
            const name = getValue("name");
            const category = getValue("category") || "Chưa phân loại";
            const costPrice = parseFloat(getValue("costPrice").replace(/[^0-9.-]/g, "")) || 0;
            const sellingPrice = parseFloat(getValue("sellingPrice").replace(/[^0-9.-]/g, "")) || 0;
            const stock = parseFloat(getValue("stock").replace(/[^0-9.-]/g, "")) || 0;
            const minStock = parseFloat(getValue("minStock").replace(/[^0-9.-]/g, "")) || 5;
            const unit = getValue("unit") || "Cái";
            const barcode = getValue("barcode");

            const code = rawCode || `SP${String(products.length + parsedRows.length + 1).padStart(6, "0")}`;

            if (!name) {
              logs.push(`⚠️ Bỏ qua dòng ${i + 1}: Thiếu Tên sản phẩm.`);
              continue;
            }

            const isExisting = products.some(p => p.code.toLowerCase() === code.toLowerCase());

            parsedRows.push({
              code,
              name,
              category,
              costPrice,
              sellingPrice,
              stock,
              minStock,
              unit,
              barcode,
              action: isExisting ? "UPDATE" : "CREATE"
            });
          }
        }

        setImportPreviewData(parsedRows);
        logs.push(`🔍 Trích xuất thành công ${parsedRows.length} sản phẩm hợp lệ.`);
        setImportLogs(logs);
      } catch (err: any) {
        alert("Lỗi khi đọc file: " + err.message);
        setImportPreviewData([]);
        setImportFile(null);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleConfirmImport = () => {
    if (importPreviewData.length === 0) {
      alert("Không có dữ liệu hợp lệ để nhập.");
      return;
    }

    setIsImporting(true);
    const logs = [...importLogs, "🚀 Bắt đầu quá trình lưu trữ hàng hóa hàng loạt..."];
    setImportLogs(logs);

    setTimeout(() => {
      const updatedProducts = [...products];
      let addCount = 0;
      let editCount = 0;

      importPreviewData.forEach(item => {
        const existingIndex = updatedProducts.findIndex(p => p.code.toLowerCase() === item.code.toLowerCase());
        
        if (existingIndex !== -1) {
          updatedProducts[existingIndex] = {
            ...updatedProducts[existingIndex],
            name: item.name,
            category: item.category,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            stock: item.stock,
            minStock: item.minStock,
            unit: item.unit,
            barcode: item.barcode || updatedProducts[existingIndex].barcode
          };
          editCount++;
        } else {
          const newProduct: Product = {
            id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            code: item.code,
            name: item.name,
            category: item.category,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            stock: item.stock,
            minStock: item.minStock,
            unit: item.unit,
            barcode: item.barcode || "",
            imageUrl: ""
          };
          updatedProducts.unshift(newProduct);
          addCount++;
        }
      });

      if (onImportProducts) {
        onImportProducts(updatedProducts);
      }

      safeDispatchEvent("kiot-toast", {
        type: "stock-warning",
        title: "NHẬP EXCEL THÀNH CÔNG",
        message: `Đã cập nhật ${editCount} mặt hàng và thêm mới ${addCount} mặt hàng từ file Excel thành công!`
      });

      setIsImporting(false);
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreviewData([]);
      setImportLogs([]);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
      {/* Sub tabs: Product List & Inventory Audits */}
      <div className="flex items-center justify-between border-b border-stone-850 pb-1">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveSubTab("list")}
            className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer ${
              activeSubTab === "list" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span>Hàng hóa & Danh mục</span>
            {activeSubTab === "list" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>

          <button
            disabled={!hasPermission("inventoryAudit")}
            onClick={() => setActiveSubTab("audit")}
            className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeSubTab === "audit" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span className="flex items-center gap-1">
              {!hasPermission("inventoryAudit") && <Lock className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
              <span>Phiếu Kiểm Kho</span>
            </span>
            {activeSubTab === "audit" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>

          <button
            disabled={!hasPermission("inventoryAudit")}
            onClick={() => setActiveSubTab("purchase")}
            className={`pb-3 text-sm font-bold uppercase tracking-wider relative cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeSubTab === "purchase" ? "text-emerald-400" : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span className="flex items-center gap-1">
              {!hasPermission("inventoryAudit") && <Lock className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
              <span>Nhập Hàng (Giá vốn)</span>
            </span>
            {activeSubTab === "purchase" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </button>
        </div>

         {activeSubTab === "list" && (
          <div className="flex gap-2">
            <button
              disabled={!hasPermission("productCreateEdit")}
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs bg-stone-950 border border-stone-850 hover:bg-stone-900 text-stone-300 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={hasPermission("productCreateEdit") ? "Nhập hàng loạt sản phẩm từ file Excel (CSV)" : "Không có quyền nhập Excel"}
            >
              {hasPermission("productCreateEdit") ? <Upload className="h-3.5 w-3.5 text-indigo-400" /> : <Lock className="h-3.5 w-3.5 text-rose-500" />}
              <span>Nhập Excel</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg text-xs bg-stone-950 border border-stone-850 hover:bg-stone-900 text-stone-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Xuất toàn bộ danh sách sản phẩm ra file Excel"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Xuất Excel</span>
            </button>
            <button
              disabled={!hasPermission("productCreateEdit")}
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs bg-stone-950 border border-stone-850 hover:bg-stone-900 text-stone-300 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hasPermission("productCreateEdit") ? <Plus className="h-3.5 w-3.5 text-amber-500" /> : <Lock className="h-3.5 w-3.5 text-rose-500" />}
              <span>Thêm danh mục</span>
            </button>
            <button
              disabled={!hasPermission("productCreateEdit")}
              onClick={() => handleOpenProductModal(null)}
              className="px-4 py-1.5 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {hasPermission("productCreateEdit") ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4 text-stone-850" />}
              <span>Thêm sản phẩm</span>
            </button>
          </div>
        )}

        {activeSubTab === "audit" && !isCreatingAudit && (
          <button
            onClick={handleStartAudit}
            className="px-4 py-1.5 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Clipboard className="h-4 w-4" />
            <span>Tạo Phiếu Kiểm Kho</span>
          </button>
        )}

        {activeSubTab === "purchase" && !isCreatingPO && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoGeneratePO}
              className="px-4 py-1.5 rounded-lg text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer select-none"
              title="Tự động tìm các sản phẩm dưới định mức tối thiểu và đề xuất số lượng cần nhập để bù đủ kho"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <span>Gợi ý bù đủ kho</span>
            </button>
            <button
              onClick={handleStartPO}
              className="px-4 py-1.5 rounded-lg text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer select-none"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Phiếu Nhập Hàng</span>
            </button>
          </div>
        )}
      </div>

      {/* SUBTAB 1: PRODUCT MANAGEMENT LIST */}
      {activeSubTab === "list" && (
        <div className="space-y-4">
          
          {/* Filtering bar */}
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-850 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm hàng hóa theo tên, mã sản phẩm hoặc barcode..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            {/* Category selection & Stock limits dropdowns */}
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Nhóm hàng:</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Tất cả">Tất cả nhóm</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-stone-700 text-amber-500 hover:text-amber-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none"
                    title="Thêm nhanh danh mục sản phẩm mới"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm danh mục</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Trạng thái:</span>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Tất cả số lượng</option>
                  <option value="low">Sắp hết hàng (Dưới định mức)</option>
                  <option value="out">Đã hết hàng (Hết sạch)</option>
                  <option value="near_expiry">Sắp hết hạn sử dụng (Trong 30 ngày)</option>
                  <option value="expired">Đã hết hạn sử dụng</option>
                </select>
              </div>
            </div>
          </div>

          {/* Core Table Grid of Products */}
          <div className="rounded-2xl bg-stone-900 border border-stone-850 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-950/60 border-b border-stone-850 text-stone-400">
                    <th className="p-4 font-bold uppercase tracking-wider">Mã hàng</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Hình ảnh</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Tên mặt hàng</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Nhóm hàng</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Giá vốn</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Giá bán</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Tồn kho</th>
                    <th className="p-4 text-center font-bold uppercase tracking-wider">Đơn vị</th>
                    <th className="p-4 text-right font-bold uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-850/60">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-stone-500">
                        Chưa có sản phẩm nào thỏa mãn bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const isLowStock = p.stock <= p.minStock && p.stock > 0;
                      const isOutOfStock = p.stock <= 0;

                      return (
                        <tr key={p.id} className="hover:bg-stone-950/20 transition-all group">
                          <td className="p-4 font-mono font-bold text-stone-400 group-hover:text-emerald-400 transition-colors">{p.code}</td>
                          <td className="p-4">
                            <img
                              src={p.imageUrl || "https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=150&q=80"}
                              alt={p.name}
                              className="h-10 w-10 rounded-xl object-cover border border-stone-800"
                              referrerPolicy="no-referrer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-stone-100 text-sm block">{p.name}</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {p.barcode && <span className="text-[10px] text-stone-500 font-mono">Barcode: {p.barcode}</span>}
                                {(() => {
                                  const exp = getExpiryStatus(p.expiryDate);
                                  if (!exp) return null;
                                  
                                  if (exp.status === "expired") {
                                    return (
                                      <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/15 font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        <span>Đã hết hạn ({p.expiryDate})</span>
                                      </span>
                                    );
                                  } else if (exp.status === "near") {
                                    return (
                                      <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/15 font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        <span>Gần hết hạn (Còn {exp.days} ngày - {p.expiryDate})</span>
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="text-[9px] bg-stone-950 text-stone-400 px-1.5 py-0.5 rounded border border-stone-850 font-sans font-bold uppercase tracking-wider">
                                        HSD: {p.expiryDate}
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-950 text-stone-400 border border-stone-850 uppercase tracking-wider">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono text-stone-300 font-semibold">{formatVND(p.costPrice)}</td>
                          <td className="p-4 text-right font-mono text-emerald-400 font-bold">{formatVND(p.sellingPrice)}</td>
                          <td className="p-4 text-right font-mono font-extrabold">
                            <div className="flex flex-col items-end gap-1">
                              <span className={isOutOfStock ? "text-rose-500" : isLowStock ? "text-amber-500" : "text-stone-100"}>
                                {p.stock}
                              </span>
                              {isOutOfStock ? (
                                <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/15 font-sans font-bold uppercase tracking-wider">Hết hàng</span>
                              ) : isLowStock ? (
                                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/15 font-sans font-bold uppercase tracking-wider">Dưới tối thiểu ({p.minStock})</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-4 text-center text-stone-400 font-semibold">{p.unit}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                disabled={!hasPermission("productCreateEdit")}
                                onClick={() => handleOpenProductModal(p)}
                                className="p-2 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all border border-stone-850 cursor-pointer"
                                title={hasPermission("productCreateEdit") ? "Chỉnh sửa sản phẩm" : "Bạn không có quyền sửa sản phẩm"}
                              >
                                {hasPermission("productCreateEdit") ? <Edit2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-500" />}
                              </button>
                              <button
                                disabled={!hasPermission("productDelete")}
                                onClick={() => handleDeleteProductClick(p.id, p.name)}
                                className="p-2 bg-stone-950 hover:bg-rose-950/40 text-stone-400 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all border border-stone-850 cursor-pointer"
                                title={hasPermission("productDelete") ? "Xóa sản phẩm" : "Bạn không có quyền xóa sản phẩm"}
                              >
                                {hasPermission("productDelete") ? <Trash2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-stone-500" />}
                              </button>
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
        </div>
      )}

      {/* SUBTAB 2: INVENTORY AUDITING PANELS */}
      {activeSubTab === "audit" && (
        <div className="space-y-6">
          
          {/* Active Auditing interface */}
          {isCreatingAudit ? (
            <div className="p-6 rounded-2xl bg-stone-900 border border-stone-850 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider flex items-center gap-2">
                    <Clipboard className="h-4.5 w-4.5 text-emerald-400" />
                    <span>Lập Phiếu Kiểm Kê Hàng Hóa Kho</span>
                  </h3>
                  <p className="text-xs text-stone-400">Chọn hàng hóa, đối chiếu tồn hệ thống và nhập tồn kho thực tế đếm được.</p>
                </div>
                <button
                  onClick={() => setIsCreatingAudit(false)}
                  className="px-3.5 py-1.5 bg-stone-950 hover:bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800 text-xs rounded-xl transition-all cursor-pointer"
                >
                  Hủy phiếu
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Product search to add to audit list (4 cols) */}
                <div className="lg:col-span-4 space-y-4 bg-stone-950 p-4 rounded-xl border border-stone-850/60">
                  <span className="text-[10px] text-stone-400 font-black uppercase block tracking-wider">1. Click Chọn sản phẩm kiểm kê:</span>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-stone-600" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Gõ tìm sản phẩm..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-[11px] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent">
                    {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.includes(searchQuery)).map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductToAudit(p)}
                        className="p-2.5 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 cursor-pointer flex items-center justify-between text-xs transition-all"
                      >
                        <div>
                          <p className="font-bold text-stone-200">{p.name}</p>
                          <span className="text-[9px] text-stone-500 font-mono">{p.code} - Tồn HT: {p.stock}</span>
                        </div>
                        <Plus className="h-4 w-4 text-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Items Table (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-stone-800 bg-stone-950">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-900 border-b border-stone-800 text-stone-400 font-bold">
                          <th className="p-3">Sản phẩm</th>
                          <th className="p-3 text-right">Tồn hệ thống</th>
                          <th className="p-3 text-right">Thực tế đếm</th>
                          <th className="p-3 text-right">Chênh lệch</th>
                          <th className="p-3">Ghi chú</th>
                          <th className="p-3 text-right">Hủy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-850/40">
                        {auditItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-stone-500">
                              Hãy click chọn sản phẩm từ cột bên trái để bắt đầu kiểm kho.
                            </td>
                          </tr>
                        ) : (
                          auditItems.map(item => {
                            const diff = item.actualQty - item.product.stock;
                            const diffCost = diff * item.product.costPrice;

                            return (
                              <tr key={item.product.id} className="hover:bg-stone-900/40">
                                <td className="p-3">
                                  <div>
                                    <span className="font-bold text-stone-200 block">{item.product.name}</span>
                                    <span className="text-[9.5px] text-stone-500 font-mono">{item.product.code}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-right font-mono font-semibold text-stone-400">{item.product.stock}</td>
                                <td className="p-3 text-right">
                                  <input
                                    type="number"
                                    value={item.actualQty}
                                    onChange={(e) => handleAuditQtyChange(item.product.id, Number(e.target.value))}
                                    className="w-16 px-1.5 py-1 rounded bg-stone-900 border border-stone-800 text-center font-bold text-stone-100 focus:outline-none focus:border-emerald-500 font-mono"
                                  />
                                </td>
                                <td className="p-3 text-right font-mono font-extrabold">
                                  <span className={diff === 0 ? "text-stone-400" : diff > 0 ? "text-emerald-400" : "text-rose-500"}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                  {diff !== 0 && (
                                    <span className="text-[9px] text-stone-500 block font-normal">{formatVND(diffCost)}</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <input
                                    type="text"
                                    value={item.notes}
                                    onChange={(e) => handleAuditItemNoteChange(item.product.id, e.target.value)}
                                    placeholder="Lý do chênh lệch..."
                                    className="w-full px-2 py-1 rounded bg-stone-900 border border-stone-800 text-[11px] text-stone-300 focus:outline-none focus:border-emerald-500"
                                  />
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => handleRemoveProductFromAudit(item.product.id)}
                                    className="text-stone-600 hover:text-rose-400 cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Overall Voucher Settings */}
                  {auditItems.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Ghi chú chung cho phiếu kiểm</label>
                        <textarea
                          rows={2}
                          value={auditNote}
                          onChange={(e) => setAuditNote(e.target.value)}
                          placeholder="Mô tả đợt kiểm kho định kỳ..."
                          className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-stone-950 rounded-xl border border-stone-850 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-stone-400 block font-medium">Tổng giá trị điều chỉnh chênh lệch:</span>
                          <span className="text-sm font-black font-mono text-amber-500">
                            {formatVND(auditItems.reduce((acc, curr) => acc + ((curr.actualQty - curr.product.stock) * curr.product.costPrice), 0))}
                          </span>
                        </div>

                        <button
                          onClick={handleCompleteAudit}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase text-xs rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          Hoàn tất &amp; Đồng bộ tồn kho
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            /* Historical audits list list */
            <div className="space-y-4">
              {audits.map(aud => {
                const totalDiffQty = aud.items.reduce((acc, i) => acc + Math.abs(i.discrepancy), 0);
                return (
                  <div key={aud.id} className="p-4 rounded-xl bg-stone-900 border border-stone-850 hover:border-stone-800 transition-all space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-amber-500" />
                        <span className="text-xs font-black font-mono text-stone-200">{aud.auditCode}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/15">Đã cân bằng tồn</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono font-bold">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(aud.date).toLocaleString("vi-VN")}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Người thực hiện</span>
                        <span className="text-stone-300 font-bold">{aud.auditorName}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Số mặt hàng kiểm</span>
                        <span className="text-stone-300 font-bold font-mono">{aud.items.length} mặt hàng</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Tổng chênh lệch SL</span>
                        <span className={`font-black font-mono ${totalDiffQty === 0 ? "text-stone-400" : "text-rose-400 animate-pulse"}`}>
                          {totalDiffQty} cái
                        </span>
                      </div>
                      {aud.notes && (
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Ghi chú phiếu</span>
                          <span className="text-stone-400 italic line-clamp-1">{aud.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Detailed item discrepancy list under historic audit */}
                    <div className="p-3 bg-stone-950/60 rounded-lg border border-stone-850/60 text-[10.5px]">
                      <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Chi tiết hàng hóa có chênh lệch:</span>
                      <div className="space-y-1">
                        {aud.items.map(item => (
                          <div key={item.productCode} className="flex justify-between items-center py-0.5">
                            <span className="text-stone-400">{item.productName} ({item.productCode})</span>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-stone-500">Hệ thống: {item.systemQty} → Thực tế: {item.actualQty}</span>
                              <span className={`font-bold ${item.discrepancy === 0 ? "text-stone-400" : item.discrepancy > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* SUBTAB 3: NHẬP HÀNG (GIÁ VỐN BÌNH QUÂN) */}
      {activeSubTab === "purchase" && (
        <div className="space-y-4">
          {isCreatingPO ? (
            /* --- Create Purchase Order Screen --- */
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Search & Draft Items (7/12) */}
              <div className="xl:col-span-7 space-y-4">
                <div className="p-5 rounded-2xl bg-stone-900 border border-stone-850 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="h-4.5 w-4.5" />
                    <span>Chi Tiết Mặt Hàng Nhập Kho</span>
                  </h3>
                  
                  {/* Search / Add product to PO */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-stone-500" />
                    <input
                      type="text"
                      value={poSearchQuery}
                      onChange={(e) => setPoSearchQuery(e.target.value)}
                      placeholder="Tìm hàng hóa theo tên, mã hoặc barcode để nhập..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                    
                    {/* Autocomplete Dropdown list */}
                    {poFilteredSearchProducts.length > 0 && (
                      <div className="absolute top-11 inset-x-0 bg-stone-950 border border-stone-800 rounded-xl shadow-2xl z-20 overflow-hidden divide-y divide-stone-900">
                        {poFilteredSearchProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handleAddProductToPO(p);
                              setPoSearchQuery("");
                            }}
                            className="w-full px-4 py-2.5 hover:bg-stone-900 flex justify-between items-center text-left text-xs text-stone-300 transition-all cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-stone-100 block">{p.name}</span>
                              <span className="text-[10px] text-stone-500 font-mono">Mã: {p.code} | Hiện tại: {p.stock} {p.unit}</span>
                            </div>
                            <span className="font-mono text-emerald-400 font-bold">+{p.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Added Items Table */}
                  <div className="overflow-x-auto rounded-xl border border-stone-850 bg-stone-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-850 text-stone-400 text-[10px] uppercase tracking-wider bg-stone-950/40">
                          <th className="p-3 font-semibold">Tên hàng hóa</th>
                          <th className="p-3 text-center font-semibold w-24">Số lượng</th>
                          <th className="p-3 text-right font-semibold w-32">Đơn giá nhập</th>
                          <th className="p-3 text-right font-semibold w-32">Thành tiền</th>
                          <th className="p-3 text-center font-semibold w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-850/60 text-xs">
                        {poItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-stone-600 italic">
                              Chưa có sản phẩm nào. Hãy tìm kiếm ở trên để thêm vào phiếu nhập!
                            </td>
                          </tr>
                        ) : (
                          poItems.map(item => {
                            const subtotal = item.quantity * item.costPrice;
                            return (
                              <tr key={item.product.id} className="hover:bg-stone-900/30 transition-colors">
                                <td className="p-3">
                                  <span className="font-bold text-stone-200 block">{item.product.name}</span>
                                  <span className="text-[10px] text-stone-500 font-mono">
                                    Mã: {item.product.code} | Giá vốn hiện tại: {formatVND(item.product.costPrice)}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handlePOQtyChange(item.product.id, item.quantity - 1)}
                                      className="p-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400"
                                    >
                                      <MinusCircle className="h-3.5 w-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => handlePOQtyChange(item.product.id, Number(e.target.value))}
                                      className="w-12 py-1 bg-stone-950 text-center font-bold font-mono text-xs rounded border border-stone-800 text-stone-200 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handlePOQtyChange(item.product.id, item.quantity + 1)}
                                      className="p-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400"
                                    >
                                      <PlusCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <input
                                    type="number"
                                    value={item.costPrice}
                                    onChange={(e) => handlePOCostChange(item.product.id, Number(e.target.value))}
                                    className="w-full px-2 py-1 bg-stone-950 text-right font-bold font-mono text-xs rounded border border-stone-800 text-stone-200 focus:outline-none"
                                  />
                                </td>
                                <td className="p-3 text-right font-mono text-emerald-400 font-black">
                                  {formatVND(subtotal)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProductFromPO(item.product.id)}
                                    className="text-stone-500 hover:text-rose-400 p-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
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

              {/* Right Column: PO Summary & Supplier selection (5/12) */}
              <div className="xl:col-span-5 space-y-4">
                <div className="p-5 rounded-2xl bg-stone-900 border border-stone-850 space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                    <Truck className="h-4.5 w-4.5" />
                    <span>Thông Tin Nhập Hàng & Công Nợ</span>
                  </h3>
                  
                  {/* Select supplier */}
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Nhà cung cấp *</label>
                    <select
                      value={poSelectedSupplierId}
                      onChange={(e) => setPoSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-200"
                    >
                      <option value="">-- Chọn Nhà Cung Cấp --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                      ))}
                    </select>
                  </div>

                  {/* Summary card details */}
                  <div className="p-3 bg-stone-950 rounded-xl border border-stone-850 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Mã phiếu nhập:</span>
                      <span className="font-mono text-stone-300 font-bold">PN{new Date().getFullYear()}{String(purchaseOrders.length + 1).padStart(4, "0")}</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Người lập phiếu:</span>
                      <span className="text-stone-300 font-bold">Trương Công Bảo</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Tổng số sản phẩm:</span>
                      <span className="font-mono text-stone-200 font-bold">{poItems.length} sản phẩm</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400">
                      <span>Số lượng nhập:</span>
                      <span className="font-mono text-stone-200 font-bold">{poItems.reduce((acc, curr) => acc + curr.quantity, 0)} cái</span>
                    </div>
                    
                    <div className="h-px bg-stone-900 my-1" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-stone-300 font-bold text-sm">Tổng cộng tiền hàng:</span>
                      <span className="font-mono text-emerald-400 font-black text-sm">
                        {formatVND(poItems.reduce((acc, curr) => acc + (curr.quantity * curr.costPrice), 0))}
                      </span>
                    </div>
                  </div>

                  {/* Amount Paid field */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Thanh toán cho Nhà cung cấp</label>
                      <button
                        type="button"
                        onClick={() => setPoAmountPaid(poItems.reduce((acc, curr) => acc + (curr.quantity * curr.costPrice), 0))}
                        className="text-[10px] text-emerald-500 hover:text-emerald-400 underline font-bold"
                      >
                        Trả đủ 100%
                      </button>
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3.5 top-2.5 h-4 w-4 text-stone-500" />
                      <input
                        type="number"
                        value={poAmountPaid}
                        onChange={(e) => setPoAmountPaid(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                        placeholder="Số tiền thực trả cho nhà cung cấp..."
                      />
                    </div>
                  </div>

                  {/* Debt calculation display */}
                  {(() => {
                    const total = poItems.reduce((acc, curr) => acc + (curr.quantity * curr.costPrice), 0);
                    const debt = Math.max(0, total - poAmountPaid);
                    if (debt > 0) {
                      return (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                            <span>Ghi Nợ Trả Sau (Sổ Nợ Nhà Cung Cấp)</span>
                          </div>
                          <p className="leading-relaxed">
                            Cửa hàng đang ghi nợ nhà cung cấp số tiền <strong className="font-mono">{formatVND(debt)}</strong>. Khoản nợ này sẽ tự động tích lũy vào Sổ nợ Nhà Cung Cấp.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Note input */}
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Ghi chú phiếu nhập</label>
                    <textarea
                      rows={2}
                      value={poNote}
                      onChange={(e) => setPoNote(e.target.value)}
                      placeholder="Mô tả chứng từ nhập hàng, số hóa đơn đỏ..."
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Submission triggers */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPO(false)}
                      className="flex-1 py-2.5 text-xs bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-850 rounded-xl transition-all cursor-pointer text-center font-bold"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleCompletePO}
                      className="flex-1 py-2.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase rounded-xl transition-all shadow-md cursor-pointer text-center"
                    >
                      Hoàn Tất Nhập
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* --- Historic Purchase Orders List View --- */
            <div className="space-y-4">
              {purchaseOrders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-stone-900 border border-stone-850 text-stone-500 space-y-2">
                  <Truck className="h-8 w-8 mx-auto text-stone-600 animate-pulse" />
                  <p className="text-xs">Chưa có phiếu nhập kho nào được tạo.</p>
                  <div className="flex justify-center gap-4 mt-2">
                    <button
                      onClick={handleStartPO}
                      className="text-xs text-emerald-400 font-bold hover:underline"
                    >
                      Tạo phiếu nhập hàng đầu tiên &rarr;
                    </button>
                    <button
                      onClick={handleAutoGeneratePO}
                      className="text-xs text-amber-400 font-bold hover:underline"
                    >
                      Gợi ý bù đủ kho &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                purchaseOrders.map(po => {
                  return (
                    <div key={po.id} className="p-4 rounded-xl bg-stone-900 border border-stone-850 hover:border-stone-800 transition-all space-y-3">
                      <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4.5 w-4.5 text-emerald-500" />
                          <span className="text-xs font-black font-mono text-stone-200">{po.orderCode}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/15">Đã hoàn tất</span>
                          {po.amountOwed > 0 && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[9px] font-bold uppercase tracking-wider border border-rose-500/15">Còn nợ NCC</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono font-bold">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(po.date).toLocaleString("vi-VN")}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Nhà cung cấp</span>
                          <span className="text-stone-300 font-bold">{po.supplierName}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Số mặt hàng</span>
                          <span className="text-stone-300 font-bold font-mono">{po.items.length} dòng hàng</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Tổng tiền hàng</span>
                          <span className="font-bold font-mono text-emerald-400">{formatVND(po.totalAmount)}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-stone-500 block text-[9.5px] uppercase tracking-wide">Tiền đã trả / Còn nợ</span>
                          <span className="font-bold font-mono text-stone-300">
                            {formatVND(po.amountPaid)} / <span className={po.amountOwed > 0 ? "text-rose-400 font-bold" : "text-stone-400"}>{formatVND(po.amountOwed)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Item lists */}
                      <div className="p-3 bg-stone-950/60 rounded-lg border border-stone-850/60 text-[10.5px]">
                        <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider block mb-1">Chi tiết hàng hóa nhập kho (Giá vốn tính theo Bình quân gia quyền):</span>
                        <div className="space-y-1">
                          {po.items.map(item => (
                            <div key={item.productId} className="flex justify-between items-center py-0.5">
                              <span className="text-stone-400">{item.productName} ({item.productCode})</span>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-stone-500">Số lượng: {item.quantity} | Đơn giá: {formatVND(item.costPrice)}</span>
                                <span className="font-bold text-stone-300">{formatVND(item.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ADD/EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-lg rounded-2xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-5">
              <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider flex items-center gap-2">
                <Tag className="h-4.5 w-4.5 text-emerald-400" />
                <span>{editingProduct ? "Cập Nhật Sản Phẩm" : "Thêm Sản Phẩm Mới"}</span>
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-stone-500 hover:text-stone-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Tên sản phẩm *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nhập tên sản phẩm..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Mã sản phẩm *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Mã vạch / Barcode</label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="E.g., 893000000..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Nhóm hàng</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-300 text-xs"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Đơn vị tính</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-200 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Giá vốn (VND) *</label>
                  <input
                    type="number"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Giá bán (VND) *</label>
                  <input
                    type="number"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-emerald-400 font-bold font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Tồn kho ban đầu</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    disabled={editingProduct !== null} // Lock initial stock editing, force them to use inventory audit instead! Shows real software rigidity.
                    className={`w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono text-xs ${
                      editingProduct !== null ? "opacity-40 cursor-not-allowed bg-stone-950" : ""
                    }`}
                  />
                  {editingProduct !== null && (
                    <span className="text-[9px] text-amber-500 block leading-tight">Để chỉnh sửa tồn kho, hãy dùng tab &apos;Kiểm Kho&apos;.</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Tồn kho tối thiểu (Cảnh báo)</label>
                  <input
                    type="number"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Ngày hết hạn (HSD)</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">Đường dẫn hình ảnh (Image URL)</label>
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-850 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {editingProduct ? "Lưu thay đổi" : "Thêm hàng hóa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* IMPORT EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xs font-bold text-stone-100 uppercase tracking-wider">Nhập Hàng Hóa Từ Excel / CSV</h3>
              </div>
              <button onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportPreviewData([]);
              }} className="text-stone-500 hover:text-stone-300 cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Top description and download template */}
              <div className="bg-stone-950 p-4 rounded-xl border border-stone-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-stone-300">Sử dụng file mẫu chuẩn để nhập dữ liệu hàng loạt một cách chuẩn xác nhất.</p>
                  <p className="text-[10px] text-stone-500">Hệ thống hỗ trợ tự động khớp mã sản phẩm trùng để cập nhật thông tin.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-750 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase rounded-lg cursor-pointer flex items-center gap-1.5 shrink-0 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải file Excel mẫu</span>
                </button>
              </div>

              {/* Upload Zone */}
              <div className="border-2 border-dashed border-stone-800 hover:border-indigo-500/50 bg-stone-950/50 rounded-xl p-6 text-center transition-all relative">
                <input
                  key={importFile ? importFile.name : "empty"}
                  type="file"
                  accept=".csv, .txt, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2 pointer-events-none">
                  <div className="mx-auto w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-stone-400 border border-stone-800">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-stone-300">
                      {importFile ? `Tập tin: ${importFile.name}` : "Kéo thả file Excel hoặc click vào đây để chọn file"}
                    </p>
                    <p className="text-[10px] text-stone-500">Định dạng khuyên dùng: .csv mã hóa UTF-8</p>
                  </div>
                </div>
              </div>

              {/* Logs and Preview */}
              {importLogs.length > 0 && (
                <div className="space-y-3">
                  {/* Logs terminal */}
                  <div className="bg-stone-950 p-3 rounded-lg border border-stone-850/80 font-mono text-[9px] text-emerald-400 space-y-1 max-h-[80px] overflow-y-auto scrollbar-thin">
                    {importLogs.map((log, index) => (
                      <div key={index} className="flex gap-1.5">
                        <span className="text-emerald-700 select-none">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>

                  {/* Preview Table */}
                  {importPreviewData.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Xem trước danh sách ({importPreviewData.length} sản phẩm)</span>
                        <div className="flex gap-3 text-[9px] font-bold">
                          <span className="text-emerald-400 flex items-center gap-1">● {importPreviewData.filter(x => x.action === "CREATE").length} Thêm mới</span>
                          <span className="text-amber-400 flex items-center gap-1">● {importPreviewData.filter(x => x.action === "UPDATE").length} Cập nhật</span>
                        </div>
                      </div>

                      <div className="max-h-[180px] overflow-y-auto border border-stone-850 rounded-lg divide-y divide-stone-850 bg-stone-950/40 scrollbar-thin">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-stone-900 text-stone-400 font-bold sticky top-0 uppercase text-[9px] tracking-wider">
                            <tr>
                              <th className="p-2">Mã sản phẩm</th>
                              <th className="p-2">Tên sản phẩm</th>
                              <th className="p-2">Nhóm hàng</th>
                              <th className="p-2 text-right">Giá vốn</th>
                              <th className="p-2 text-right">Giá bán</th>
                              <th className="p-2 text-center">Tồn kho</th>
                              <th className="p-2 text-center">Đơn vị</th>
                              <th className="p-2 text-center">Trạng thái</th>
                              <th className="p-2 text-center">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-850/60">
                            {importPreviewData.map((row, index) => (
                              <tr key={index} className="hover:bg-stone-850/20 text-stone-300">
                                <td className="p-2 font-mono text-[10px] text-stone-400">{row.code}</td>
                                <td className="p-2 font-bold text-stone-200 truncate max-w-[120px]" title={row.name}>{row.name}</td>
                                <td className="p-2 text-stone-400">{row.category}</td>
                                <td className="p-2 text-right">{formatVND(row.costPrice)}</td>
                                <td className="p-2 text-right font-bold text-emerald-400">{formatVND(row.sellingPrice)}</td>
                                <td className="p-2 text-center font-bold">{row.stock}</td>
                                <td className="p-2 text-center text-stone-400">{row.unit}</td>
                                <td className="p-2 text-center">
                                  {row.action === "CREATE" ? (
                                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[8px] font-bold tracking-wider">MỚI</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[8px] font-bold tracking-wider">GHI ĐÈ</span>
                                  )}
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePreviewItem(index)}
                                    className="p-1 text-stone-500 hover:text-rose-400 hover:bg-rose-950/20 rounded transition-all cursor-pointer"
                                    title="Loại bỏ khỏi danh sách"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3.5 border-t border-stone-800 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportPreviewData([]);
                  }}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-bold uppercase rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || importPreviewData.length === 0}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-black text-xs uppercase rounded-xl cursor-pointer flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang xử lý nhập...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Xác nhận nhập kho ({importPreviewData.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <h3 className="text-xs font-bold text-stone-100 uppercase tracking-wider">Thêm Danh Mục Mới</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-stone-500 hover:text-stone-300">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddCategorySubmit} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="text-[10px] text-stone-400 font-bold uppercase block">Tên danh mục mới</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Ví dụ: Mỹ phẩm, Thức uống..."
                  className="w-full px-3 py-2.5 rounded-lg bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:outline-none text-stone-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl transition-all"
              >
                Tạo danh mục
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingProductId && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-stone-200 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
                <span>Xác Nhận Xóa Sản Phẩm</span>
              </h3>
              <button onClick={() => { setDeletingProductId(null); setDeletingProductName(""); }} className="text-stone-500 hover:text-stone-300">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-stone-300 leading-relaxed">
                Bạn có chắc chắn muốn xóa sản phẩm <strong className="text-rose-400 font-extrabold">"{deletingProductName}"</strong> khỏi hệ thống?
              </p>
              <p className="text-stone-500 text-[10px] leading-normal">
                Lưu ý: Hành động này không thể hoàn tác. Các hóa đơn bán hàng hoặc lịch sử giao dịch chứa sản phẩm này trước đây vẫn sẽ được giữ nguyên để bảo đảm tính chính xác của báo cáo tài chính.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeletingProductId(null); setDeletingProductName(""); }}
                  className="flex-1 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 font-bold transition-all cursor-pointer text-center"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteProduct}
                  className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-stone-950 font-black uppercase transition-all cursor-pointer text-center"
                >
                  Đồng ý xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple X icon replacement
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
