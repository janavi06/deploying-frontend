import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface InventoryItem {
  inventoryItemID: number;
  itemName: string;
  sku?: string;
  unitOfMeasure: string;
  currentQuantity: number;
  reorderLevel: number;
  averageUnitCost: number;
  isActive: boolean;
  restaurantID: number;
  createdAt: string;
  updatedAt: string;
}

interface StockTransaction {
  stockTransactionID: number;
  inventoryItemID: number;
  transactionType: StockTransactionType;
  quantityChange: number;
  unitCost: number;
  reference?: string;
  notes?: string;
  transactionTime: string;
  restaurantID: number;
}

interface ProductRecipe {
  productRecipeID: number;
  productID: number;
  inventoryItemID: number;
  quantityPerUnit: number;
  restaurantID: number;
}

enum StockTransactionType {
  Purchase = 0,
  Adjustment = 1,
  Waste = 2,
  Sale = 3,
  Return = 4
}

@Component({
  selector: 'app-inventory-management',
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.css'],
  imports: [CommonModule, FormsModule], // Add required imports here
  providers: [DecimalPipe, DatePipe] // Add pipe providers
})
export class InventoryManagementComponent implements OnInit {
  activeTab: 'items' | 'transactions' | 'recipes' = 'items';
  
  // Items
  items: InventoryItem[] = [];
  searchTerm: string = '';
  
  // Transactions
  transactions: StockTransaction[] = [];
  selectedItemId: number | null = null;
  dateFrom: string = '';
  dateTo: string = '';
  
  // Recipes
  recipes: ProductRecipe[] = [];
  selectedProductId: number | null = null;
  
  // Modals
  showItemModal: boolean = false;
  showTransactionModal: boolean = false;
  showRecipeModal: boolean = false;
  
  // Current editing objects
  currentItem: InventoryItem = this.getEmptyItem();
  currentTransaction: StockTransaction = this.getEmptyTransaction();
  editingItem: boolean = false;
  
  private restaurantId: number = 1; // This should come from auth service

  constructor(
    private http: HttpClient,
    private decimalPipe: DecimalPipe,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.loadItems();
  }

  setActiveTab(tab: 'items' | 'transactions' | 'recipes') {
    this.activeTab = tab;
    switch (tab) {
      case 'items':
        this.loadItems();
        break;
      case 'transactions':
        this.loadTransactions();
        break;
      case 'recipes':
        this.loadRecipes();
        break;
    }
  }

  // Items
  loadItems() {
    let url = `${environment.apiUrl}/inventory/items?restaurantId=${this.restaurantId}`;
    if (this.searchTerm) {
      url += `&search=${encodeURIComponent(this.searchTerm)}`;
    }
    
    this.http.get<InventoryItem[]>(url).subscribe({
      next: (data) => this.items = data,
      error: (error) => console.error('Error loading items:', error)
    });
  }

  searchItems() {
    this.loadItems();
  }

  openItemModal(item?: InventoryItem) {
    if (item) {
      this.currentItem = { ...item };
      this.editingItem = true;
    } else {
      this.currentItem = this.getEmptyItem();
      this.editingItem = false;
    }
    this.showItemModal = true;
  }

  // Add the missing editItem method
  editItem(item: InventoryItem) {
    this.openItemModal(item);
  }

  closeItemModal() {
    this.showItemModal = false;
    this.currentItem = this.getEmptyItem();
  }

  saveItem() {
    const itemToSave = { ...this.currentItem, restaurantID: this.restaurantId };
    
    const request = this.editingItem 
      ? this.http.put<InventoryItem>(`${environment.apiUrl}/inventory/items/${itemToSave.inventoryItemID}`, itemToSave)
      : this.http.post<InventoryItem>(`${environment.apiUrl}/inventory/items`, itemToSave);
    
    request.subscribe({
      next: () => {
        this.closeItemModal();
        this.loadItems();
      },
      error: (error) => console.error('Error saving item:', error)
    });
  }

  deleteItem(id: number) {
    if (confirm('Are you sure you want to delete this item?')) {
      this.http.delete(`${environment.apiUrl}/inventory/items/${id}?restaurantId=${this.restaurantId}`).subscribe({
        next: () => this.loadItems(),
        error: (error) => console.error('Error deleting item:', error)
      });
    }
  }

  // Transactions
  loadTransactions() {
    let url = `${environment.apiUrl}/inventory/transactions?restaurantId=${this.restaurantId}`;
    
    if (this.selectedItemId) {
      url += `&itemId=${this.selectedItemId}`;
    }
    if (this.dateFrom) {
      url += `&from=${this.dateFrom}`;
    }
    if (this.dateTo) {
      url += `&to=${this.dateTo}`;
    }
    
    this.http.get<StockTransaction[]>(url).subscribe({
      next: (data) => this.transactions = data,
      error: (error) => console.error('Error loading transactions:', error)
    });
  }

  openTransactionModal() {
    this.currentTransaction = this.getEmptyTransaction();
    this.showTransactionModal = true;
  }

  closeTransactionModal() {
    this.showTransactionModal = false;
    this.currentTransaction = this.getEmptyTransaction();
  }

  saveTransaction() {
    const txToSave = { 
      ...this.currentTransaction, 
      restaurantID: this.restaurantId,
      transactionType: +this.currentTransaction.transactionType
    };
    
    this.http.post<StockTransaction>(`${environment.apiUrl}/inventory/transactions`, txToSave).subscribe({
      next: () => {
        this.closeTransactionModal();
        this.loadTransactions();
        this.loadItems(); // Refresh items to update quantities
      },
      error: (error) => console.error('Error saving transaction:', error)
    });
  }

  getTransactionTypeLabel(type: StockTransactionType): string {
    switch (type) {
      case StockTransactionType.Purchase: return 'Purchase';
      case StockTransactionType.Adjustment: return 'Adjustment';
      case StockTransactionType.Waste: return 'Waste';
      case StockTransactionType.Sale: return 'Sale';
      case StockTransactionType.Return: return 'Return';
      default: return 'Unknown';
    }
  }

  getTransactionTypeClass(type: StockTransactionType): string {
    switch (type) {
      case StockTransactionType.Purchase: return 'badge-success';
      case StockTransactionType.Return: return 'badge-info';
      case StockTransactionType.Adjustment: return 'badge-warning';
      case StockTransactionType.Waste: return 'badge-danger';
      case StockTransactionType.Sale: return 'badge-primary';
      default: return 'badge-secondary';
    }
  }

  // Helper method to format numbers
  formatNumber(value: number): string {
    return this.decimalPipe.transform(value, '1.2-2') || '0.00';
  }

  // Helper method to format dates
  formatDate(value: string): string {
    return this.datePipe.transform(value, 'short') || '';
  }

  // Recipes
  loadRecipes() {
    if (!this.selectedProductId) return;
    
    this.http.get<ProductRecipe[]>(
      `${environment.apiUrl}/inventory/recipes/${this.selectedProductId}?restaurantId=${this.restaurantId}`
    ).subscribe({
      next: (data) => this.recipes = data,
      error: (error) => console.error('Error loading recipes:', error)
    });
  }

  openRecipeModal() {
    this.showRecipeModal = true;
  }

  deleteRecipe(recipeId: number) {
    if (confirm('Are you sure you want to delete this recipe?')) {
      this.http.delete(`${environment.apiUrl}/inventory/recipes/${recipeId}?restaurantId=${this.restaurantId}`).subscribe({
        next: () => this.loadRecipes(),
        error: (error) => console.error('Error deleting recipe:', error)
      });
    }
  }

  // Helper methods
  getItemName(itemId: number): string {
    const item = this.items.find(i => i.inventoryItemID === itemId);
    return item ? item.itemName : 'Unknown';
  }

  getProductName(productId: number): string {
    // You'll need to implement this based on your products data
    return `Product ${productId}`;
  }

  private getEmptyItem(): InventoryItem {
    return {
      inventoryItemID: 0,
      itemName: '',
      sku: '',
      unitOfMeasure: 'unit',
      currentQuantity: 0,
      reorderLevel: 0,
      averageUnitCost: 0,
      isActive: true,
      restaurantID: this.restaurantId,
      createdAt: '',
      updatedAt: ''
    };
  }

  private getEmptyTransaction(): StockTransaction {
    return {
      stockTransactionID: 0,
      inventoryItemID: 0,
      transactionType: StockTransactionType.Purchase,
      quantityChange: 0,
      unitCost: 0,
      reference: '',
      notes: '',
      transactionTime: '',
      restaurantID: this.restaurantId
    };
  }
}