// inventory-management.component.ts
import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

enum StockTransactionType {
  Purchase = 0,
  Adjustment = 1,
  Waste = 2,
  Sale = 3,
  Return = 4
}

interface InventoryItem {
  inventoryItemID: number;
  itemName: string;
  sku?: string | null;
  unitOfMeasure?: string;
  currentQuantity: number;
  reorderLevel: number;
  averageUnitCost: number;
  isActive?: boolean;
  restaurantID: number;
}

interface StockTransaction {
  stockTransactionID?: number;
  inventoryItemID: number;
  transactionType: number;
  quantityChange: number;
  unitCost: number;
  reference?: string | null;
  adjustmentReason?: string | null;
  transactionTime?: string;
  restaurantID: number;
  createdBy?: string | null;
}
interface UnitConversion {
  unitConversionID?: number;
  inventoryItemID: number;
  fromUnit: string;
  toUnit: string;
  conversionFactor: number;
  restaurantID: number;
}
interface Product {
  productID: number;
  productName: string;
  price: number;
  restaurantID: number;
}

interface ProductRecipeRow {
  productRecipeID: number;
  productID: number;
  inventoryItemID: number | null;
  quantityPerUnit: number;
  restaurantID: number;
}

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DecimalPipe, DatePipe],
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class InventoryManagementComponent implements OnInit, OnDestroy {
activeTab: 'items' | 'transactions' | 'recipes' | 'conversions' | 'audit' | 'analytics' = 'items';
  items: InventoryItem[] = [];
  transactions: StockTransaction[] = [];
turnover: any = null;
deadStock: any[] = [];
wasteAnalytics: any = null;
  products: Product[] = [];
  selectedProductId: number | null = null;
  recipeItems: ProductRecipeRow[] = [];
conversions: UnitConversion[] = [];
selectedConversionItemId: number | null = null;
auditItemId: number | null = null;
physicalQuantity: number = 0;
varianceReport: any[] = [];
newConversion: Partial<UnitConversion> = {
  inventoryItemID: 0,
  fromUnit: '',
  toUnit: '',
  conversionFactor: 1
};
  searchTerm = '';
  selectedItemId: number | null = null;

  showItemModal = false;
  showTransactionModal = false;

  isSavingTransaction = false;
  isSavingItem = false;
  isSavingRecipe = false;

  restaurantId = Number(localStorage.getItem('restaurantId')) || 1;

  currentItem: Partial<InventoryItem> = this.getEmptyItem();
  currentTransaction: Partial<StockTransaction> = this.getEmptyTransaction();
  editingItem = false;

  private refreshTimerId: any = null;
  private subs: Subscription[] = [];

constructor(
  private http: HttpClient,
  private decimalPipe: DecimalPipe,
  private datePipe: DatePipe
) {
  this.restaurantId = Number(localStorage.getItem('restaurantId')) || 1;

  this.newConversion = {
    inventoryItemID: 0,
    fromUnit: '',
    toUnit: '',
    conversionFactor: 1,
    restaurantID: this.restaurantId
  };
}
  ngOnInit(): void {
    this.loadItems();
    this.loadProducts();

    // Auto-refresh items every 30s (only items to avoid too many calls)
    this.refreshTimerId = setInterval(() => {
      if (this.activeTab === 'items') this.loadItems();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimerId) clearInterval(this.refreshTimerId);
    this.subs.forEach(s => s.unsubscribe());
  }
loadConversions() {
  if (!this.selectedConversionItemId) return;

  const url = `${environment.apiUrl}/inventory/conversions/${this.selectedConversionItemId}?restaurantId=${this.restaurantId}`;

  this.http.get<UnitConversion[]>(url).subscribe({
    next: res => this.conversions = res || [],
    error: () => this.conversions = []
  });
}
performAudit() {
  if (!this.auditItemId) {
    alert('Select item');
    return;
  }

  const url = `${environment.apiUrl}/inventory/audit?inventoryItemId=${this.auditItemId}&physicalQuantity=${this.physicalQuantity}&restaurantId=${this.restaurantId}`;

  this.http.post(url, {}).subscribe({
    next: () => {
      alert('Audit completed');
      this.loadItems();
      this.loadVarianceReport();
    }
  });
}
loadVarianceReport() {
  const url = `${environment.apiUrl}/inventory/variance-report?restaurantId=${this.restaurantId}`;

  this.http.get<any[]>(url).subscribe({
    next: res => this.varianceReport = res || []
  });
}
saveConversion() {
  if (!this.newConversion.inventoryItemID ||
      !this.newConversion.fromUnit ||
      !this.newConversion.toUnit ||
      !this.newConversion.conversionFactor) {
    alert('All fields required');
    return;
  }

  this.newConversion.restaurantID = this.restaurantId;

  this.http.post(`${environment.apiUrl}/inventory/conversions`, this.newConversion)
    .subscribe({
      next: () => {
        this.loadConversions();
        this.newConversion = {
          inventoryItemID: this.selectedConversionItemId!,
          fromUnit: '',
          toUnit: '',
          conversionFactor: 1,
          restaurantID: this.restaurantId
        };
      }
    });
}
  setActiveTab(tab: any) {
    this.activeTab = tab;
    // always refresh items when switching (keeps UI in sync)
    this.loadItems();
    if (tab === 'transactions') this.loadTransactions();
    if (tab === 'recipes' && this.selectedProductId) this.loadRecipe();
    if (tab === 'analytics') this.loadAnalytics();
  }
loadAnalytics() {
  const turnoverUrl = `${environment.apiUrl}/inventory/analytics/turnover?restaurantId=${this.restaurantId}`;
  const deadUrl = `${environment.apiUrl}/inventory/analytics/dead-stock?restaurantId=${this.restaurantId}`;
  const wasteUrl = `${environment.apiUrl}/inventory/analytics/waste?restaurantId=${this.restaurantId}`;

  forkJoin({
    turnover: this.http.get(turnoverUrl),
    dead: this.http.get<any[]>(deadUrl),
    waste: this.http.get(wasteUrl)
  }).subscribe(res => {
    this.turnover = res.turnover;
    this.deadStock = res.dead;
    this.wasteAnalytics = res.waste;
  });
}
  /******************************
   * Items
   ******************************/
  loadItems() {
    let url = `${environment.apiUrl}/inventory/items?restaurantId=${this.restaurantId}`;
    if (this.searchTerm) url += `&search=${encodeURIComponent(this.searchTerm)}`;
    const sub = this.http.get<any[]>(url).subscribe({
      next: res => {
        this.items = (res || []).map(i => ({
          inventoryItemID: i.inventoryItemID ?? i.inventoryItemID ?? i.InventoryItemID ?? 0,
          itemName: i.itemName ?? i.itemName ?? i.ItemName ?? '',
          sku: i.sku ?? i.sku ?? i.SKU ?? null,
          unitOfMeasure: i.unitOfMeasure ?? i.unitOfMeasure ?? i.UnitOfMeasure ?? 'unit',
          currentQuantity: Number(i.currentQuantity ?? i.CurrentQuantity ?? 0),
          reorderLevel: Number(i.reorderLevel ?? i.ReorderLevel ?? 0),
          averageUnitCost: Number(i.averageUnitCost ?? i.AverageUnitCost ?? 0),
          isActive: i.isActive ?? i.IsActive ?? true,
          restaurantID: i.restaurantID ?? i.RestaurantID ?? this.restaurantId
        }));
      },
      error: () => {
        this.items = [];
      }
    });
    this.subs.push(sub);
  }

  searchItems() {
    clearTimeout((this as any)._searchTimer);
    (this as any)._searchTimer = setTimeout(() => this.loadItems(), 400);
  }

  saveItem() {
    if (!this.currentItem.itemName) {
      alert('Item name required.');
      return;
    }
    this.isSavingItem = true;
    const payload: any = {
      ...this.currentItem,
      restaurantID: this.restaurantId
    };

    const request = this.editingItem
      ? this.http.put(`${environment.apiUrl}/inventory/items/${this.currentItem.inventoryItemID}`, payload)
      : this.http.post(`${environment.apiUrl}/inventory/items`, payload);

    const sub = request.subscribe({
      next: () => {
        this.isSavingItem = false;
        this.closeItemModal();
        this.loadItems();
      },
      error: err => {
        this.isSavingItem = false;
        alert(err?.error || 'Failed to save item');
      }
    });
    this.subs.push(sub);
  }

  deleteItem(id: number) {
    if (!confirm('Delete item?')) return;
    const sub = this.http.delete(`${environment.apiUrl}/inventory/items/${id}?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: () => this.loadItems(),
        error: err => alert(err?.error || 'Delete failed')
      });
    this.subs.push(sub);
  }

  openItemModal(item?: InventoryItem) {
    this.currentItem = item ? { ...item } : this.getEmptyItem();
    this.editingItem = !!item;
    this.showItemModal = true;
  }

  closeItemModal() {
    this.showItemModal = false;
  }

  editItem(item: InventoryItem) {
    this.openItemModal(item);
  }

  private getEmptyItem(): Partial<InventoryItem> {
    return {
      inventoryItemID: 0,
      itemName: '',
      unitOfMeasure: 'unit',
      reorderLevel: 0,
      restaurantID: this.restaurantId,
      isActive: true,
      currentQuantity: 0,
      averageUnitCost: 0
    };
  }

  /******************************
   * Transactions
   ******************************/
  saveTransaction() {
    if (!this.currentTransaction.inventoryItemID) {
      alert('Select item.');
      return;
    }

    const type = Number(this.currentTransaction.transactionType);
    let qty = Number(this.currentTransaction.quantityChange);

    if (!qty || isNaN(qty) || qty === 0) {
      alert('Quantity must be non-zero.');
      return;
    }

    // Convert quantity sign based on type
    switch (type) {
      case StockTransactionType.Purchase:
      case StockTransactionType.Return:
        qty = Math.abs(qty);
        break;
      case StockTransactionType.Waste:
      case StockTransactionType.Sale:
        qty = -Math.abs(qty);
        break;
      case StockTransactionType.Adjustment:
        // allow positive or negative as entered
        break;
      default:
        // safety: treat as adjustment if unknown
        break;
    }

    const item = this.items.find(i => i.inventoryItemID === Number(this.currentTransaction.inventoryItemID));
    if (item && qty < 0 && Math.abs(qty) > item.currentQuantity) {
      alert(`Insufficient stock for ${item.itemName}. Available ${item.currentQuantity}`);
      return;
    }

    if (type === StockTransactionType.Adjustment && (!this.currentTransaction.adjustmentReason || (this.currentTransaction.adjustmentReason || '').trim().length === 0)) {
      alert('Adjustment reason required.');
      return;
    }

    const payload: StockTransaction = {
      inventoryItemID: Number(this.currentTransaction.inventoryItemID),
      transactionType: type,
      quantityChange: qty,
      unitCost: Number(this.currentTransaction.unitCost) || 0,
      adjustmentReason: this.currentTransaction.adjustmentReason || null,
      restaurantID: this.restaurantId
    };

    this.isSavingTransaction = true;
    const sub = this.http.post(`${environment.apiUrl}/inventory/transactions`, payload).subscribe({
      next: () => {
        this.isSavingTransaction = false;
        this.closeTransactionModal();
        this.loadItems();
        this.loadTransactions();
      },
      error: (err) => {
        this.isSavingTransaction = false;
        const msg = err?.error || 'Operation failed.';
        if (msg && typeof msg === 'string' && msg.toLowerCase().includes('modified')) {
          alert('Stock changed concurrently. Refreshing items.');
          this.loadItems();
        } else {
          alert(msg);
        }
      }
    });
    this.subs.push(sub);
  }

  loadTransactions() {
    let url = `${environment.apiUrl}/inventory/transactions?restaurantId=${this.restaurantId}`;
    if (this.selectedItemId) url += `&itemId=${this.selectedItemId}`;
    const sub = this.http.get<any[]>(url).subscribe({
      next: res => {
        this.transactions = (res || []).map(t => ({
          stockTransactionID: t.stockTransactionID ?? t.stockTransactionID ?? t.StockTransactionID,
          inventoryItemID: t.inventoryItemID ?? t.inventoryItemID ?? t.InventoryItemID,
          transactionType: t.transactionType ?? t.TransactionType,
          quantityChange: Number(t.quantityChange ?? t.QuantityChange ?? 0),
          unitCost: Number(t.unitCost ?? t.UnitCost ?? 0),
          reference: t.reference ?? t.Reference ?? null,
          transactionTime: t.transactionTime ?? t.TransactionTime ?? null,
          restaurantID: t.restaurantID ?? t.RestaurantID ?? this.restaurantId
        }));
      },
      error: () => this.transactions = []
    });
    this.subs.push(sub);
  }

  openTransactionModal() {
    this.currentTransaction = this.getEmptyTransaction();
    this.showTransactionModal = true;
  }

  closeTransactionModal() {
    this.showTransactionModal = false;
  }

  private getEmptyTransaction(): Partial<StockTransaction> {
    return {
      inventoryItemID: 0,
      transactionType: StockTransactionType.Purchase,
      quantityChange: 0,
      unitCost: 0,
      adjustmentReason: '',
      restaurantID: this.restaurantId
    };
  }

  /******************************
   * Utilities / display
   ******************************/
  getInventoryItemName(id: number | null): string {
    if (!id) return 'Unknown';
    const item = this.items.find(i => i.inventoryItemID === id);
    return item ? item.itemName : `#${id}`;
  }

  getTransactionTypeLabel(type: number | undefined): string {
    if (type === undefined || type === null) return 'Unknown';
    return StockTransactionType[type] ?? 'Unknown';
  }

  formatNumber(val: number | null | undefined) {
    return this.decimalPipe.transform(val ?? 0, '1.4-4');
  }

  formatDate(val: string | undefined) {
    try {
      return this.datePipe.transform(val ?? null, 'short');
    } catch {
      return val;
    }
  }

  getLowStockItems() {
    return this.items.filter(i => i.currentQuantity <= (i.reorderLevel ?? 0));
  }

  getStockValue(item: InventoryItem) {
    return (item.currentQuantity ?? 0) * (item.averageUnitCost ?? 0);
  }

  /******************************
   * Recipes: UI + CRUD
   ******************************/
  loadProducts() {
    const url = `${environment.apiUrl}/product?restaurantId=${this.restaurantId}`;
    const sub = this.http.get<any[]>(url).subscribe({
      next: res => this.products = (res || []).map(p => ({
        productID: p.productID ?? p.productID ?? p.ProductID,
        productName: p.productName ?? p.productName ?? p.ProductName,
        price: p.price ?? p.Price ?? 0,
        restaurantID: p.restaurantID ?? p.RestaurantID ?? this.restaurantId
      })),
      error: () => this.products = []
    });
    this.subs.push(sub);
  }

  onProductChange() {
    this.loadRecipe();
  }

  loadRecipe() {
    this.recipeItems = [];
    if (!this.selectedProductId) return;
    const url = `${environment.apiUrl}/inventory/recipes/${this.selectedProductId}?restaurantId=${this.restaurantId}`;
    const sub = this.http.get<any[]>(url).subscribe({
      next: res => {
        this.recipeItems = (res || []).map(r => ({
          productRecipeID: r.productRecipeID ?? r.ProductRecipeID ?? 0,
          productID: (r.productID ?? r.ProductID) ?? this.selectedProductId!,
          inventoryItemID: (r.inventoryItemID ?? r.InventoryItemID) ?? null,
          quantityPerUnit: Number(r.quantityPerUnit ?? r.QuantityPerUnit ?? 0),
          restaurantID: r.restaurantID ?? r.RestaurantID ?? this.restaurantId
        }));
      },
      error: () => this.recipeItems = []
    });
    this.subs.push(sub);
  }

  addRecipeItem() {
    if (!this.selectedProductId) {
      alert('Select a product first.');
      return;
    }
    this.recipeItems.push({
      productRecipeID: 0,
      productID: this.selectedProductId,
      inventoryItemID: null,
      quantityPerUnit: 0,
      restaurantID: this.restaurantId
    });
  }

  saveRecipeItem(row: ProductRecipeRow) {
    if (!row.inventoryItemID) {
      alert('Select an ingredient (inventory item).');
      return;
    }
    if (!row.quantityPerUnit || row.quantityPerUnit <= 0) {
      alert('Quantity per unit must be > 0.');
      return;
    }
    this.isSavingRecipe = true;

    const payload = {
      ProductRecipeID: row.productRecipeID || 0,
      ProductID: row.productID,
      InventoryItemID: row.inventoryItemID,
      QuantityPerUnit: parseFloat(String(row.quantityPerUnit)),
      RestaurantID: row.restaurantID || this.restaurantId
    };

    const sub = this.http.post<any>(`${environment.apiUrl}/inventory/recipes`, payload).subscribe({
      next: () => {
        this.isSavingRecipe = false;
        this.loadRecipe();
      },
      error: (err) => {
        this.isSavingRecipe = false;
        alert(err?.error || 'Failed to save recipe item');
      }
    });
    this.subs.push(sub);
  }

  saveAllRecipeItems() {
    if (!this.selectedProductId) {
      alert('Select a product first.');
      return;
    }
    for (const r of this.recipeItems) {
      if (!r.inventoryItemID || !r.quantityPerUnit || r.quantityPerUnit <= 0) {
        alert('All rows must have an ingredient and quantity > 0 before saving.');
        return;
      }
    }
    this.isSavingRecipe = true;

    const requests = this.recipeItems.map(r => {
      const payload = {
        ProductRecipeID: r.productRecipeID || 0,
        ProductID: r.productID,
        InventoryItemID: r.inventoryItemID,
        QuantityPerUnit: parseFloat(String(r.quantityPerUnit)),
        RestaurantID: r.restaurantID || this.restaurantId
      };
      return this.http.post(`${environment.apiUrl}/inventory/recipes`, payload);
    });

    const sub = forkJoin(requests).subscribe({
      next: () => {
        this.isSavingRecipe = false;
        this.loadRecipe();
      },
      error: (err) => {
        this.isSavingRecipe = false;
        alert(err?.error || 'Failed to save recipes');
      }
    });
    this.subs.push(sub);
  }

  deleteRecipeItem(productRecipeId: number | null | undefined) {
    if (!productRecipeId || productRecipeId === 0) {
      this.recipeItems = this.recipeItems.filter(r => r.productRecipeID !== productRecipeId);
      return;
    }
    if (!confirm('Remove this ingredient from recipe?')) return;

    const url = `${environment.apiUrl}/inventory/recipes/${productRecipeId}?restaurantId=${this.restaurantId}`;
    const sub = this.http.delete(url).subscribe({
      next: () => this.loadRecipe(),
      error: err => alert(err?.error || 'Failed to delete recipe item')
    });
    this.subs.push(sub);
  }
}