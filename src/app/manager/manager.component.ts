import { Component, OnInit,ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { ActivatedRoute, Router } from '@angular/router'; 
import { AuthService } from '../services/auth.service'; 
import { InventoryManagementComponent } from '../inventory-management/inventory-management.component';
import { ManagerReportsComponent } from '../manager-reports/manager-reports.component';

import jsPDF from 'jspdf';



@Component({
  selector: 'app-manager',
  standalone: true,
  imports: [CommonModule, FormsModule,  InventoryManagementComponent,    ManagerReportsComponent],
      encapsulation: ViewEncapsulation.None,   
  templateUrl: './manager.component.html',
  styleUrls: ['./manager.component.css'],
})
export class ManagerComponent implements OnInit {
  readonly CATEGORY_URL = `${environment.apiUrl}/categories`;
  readonly SUBCATEGORY_URL = `${environment.apiUrl}/subcategories`;
  readonly ORDER_API = `${environment.apiUrl}/order`;
  readonly PRODUCT_URL = `${environment.apiUrl}/product`;
  
readonly OFFER_API = `${environment.apiUrl}/offer`;

  readonly EXPENSE_API = `${environment.apiUrl}/expense`;

  activeMenuTab: 'items' | 'categories' | 'subcategories' = 'items';


  expenses: any[] = [];
  expenseSummary: any[] = [];
  budgets: any[] = [];
  expenseCategories = ['Food', 'Beverage', 'Labor', 'Utilities', 'Rent', 'Supplies', 'Marketing', 'Maintenance', 'Insurance', 'Other'];
  

  
  expenseBreakdownChartData: any = {};
  showOfferModal: boolean = false;

 
  newExpense: any = {};
  newBudget: any = {};

  activeOrders: any[] = [];
  inProgressOrders: any[] = [];
  awaitingServiceOrders: any[] = [];
  pendingPaymentOrders: any[] = [];

  oldestPendingOrder: any = null;
  kitchenBacklogItems: number = 0;
  unacknowledgedNotifications: any[] = [];
  waiterRequests: any[] = [];
  todayStats: { revenue: number, aov: number, cancelled: number } = { revenue: 0, aov: 0, cancelled: 0 };

restaurantId: number = 0; 

selectedSection: 'dashboard' | 'history' | 'inventory'|'editMenu' |'reports' | 'settings'|   'expenses' |  'offers' = 'dashboard';  isSidebarOpen = false;

  products: any[] = [];
  filteredProducts: any[] = [];
  subcategories: any[] = [];
  categories: any[] = [];
  searchText = '';
  isModalOpen = false;
  isEditMode = false;
  modalProduct: any = {};



activeOffers: any[] = [];
offerStats: any = {
  totalOffers: 0,
  activeOffers: 0,
  totalDiscounts: 0,
  ordersWithOffers: 0
};
offerPerformanceChartData: any = {};
newOffer: any = {
  offerType: 'percent',
  discountPercent: null,
  discountAmount: null,
  code: '',
  description: '',
  minBillAmount: 0,
  validFrom: '',
  validTo: '',
  autoApply: true,
  isActive: true
};

currentYear = new Date().getFullYear();

  filterDateOption: 'today' | 'yesterday' | 'last7' | 'last30' | 'thismonth' | 'lastmonth' | 'custom' = 'last7';
  customStartDate: string = '';
  customEndDate: string = '';
  filterTableNo: number | null = null;
  filterStatus: string = '';
  filterPaymentMethod: string = '';





billHtmlContent: string = '';
showBillModal: boolean = false;



showCategoryModal: boolean = false;
showSubcategoryModal: boolean = false;
isEditCategoryMode: boolean = false;
isEditSubcategoryMode: boolean = false;

modalCategory: any = {
  categoryName: '',
  categoryDescription: '',
  isAvailable: true
};

modalSubcategory: any = {
  subCategoryName: '',
  subCategoryDescription: '',
  categoryID: null,
  isAvailable: true
};

  constructor(private http: HttpClient, private route: ActivatedRoute,private router: Router,  private authService: AuthService ) {
    const today = new Date();
    this.customStartDate = this.formatDate(new Date(today.setDate(today.getDate() - 6)))
    this.customEndDate = this.formatDate(new Date());

  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.restaurantId = +params['restaurantId']; 
      if (this.restaurantId && this.restaurantId > 0) {
        this.initializeComponent();
      } else {
        console.error(' Invalid restaurantId from route');
        this.redirectToLogin();
      }
    });
  }

private initializeComponent(): void {
  localStorage.setItem('restaurantId', this.restaurantId.toString());
  localStorage.setItem('userRole', this.authService.role || '');
  

    
    this.loadSubCategories();
    this.loadCategories();
    this.loadProducts();

    this.loadExpenseData();
    this.loadOffersData();

    
 
  }

  private redirectToLogin(): void {
    console.warn('Redirecting to login due to invalid restaurant context');
    this.router.navigate(['/login']);
  }

viewOrderDetails(orderID: number) {
}


  loadOperationalKpis(): void {
    this.http.get<any>(`${this.ORDER_API}/dashboard/kitchen-backlog?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.kitchenBacklogItems = res.totalPendingItems,
      error: (err) => console.error('Error loading kitchen backlog:', err)
    });

    this.http.get<any[]>(`${this.ORDER_API}/waiter/notifications?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.unacknowledgedNotifications = res.map(n => ({
        ...n,
        timeElapsed: this.getTimeInStatus(new Date(n.createdAt))
      })),
      error: (err) => console.error('Error loading notifications:', err)
    });
  }

  loadWaiterRequests(): void {
    this.http.get<any>(`${this.ORDER_API}/waiter-requests?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.waiterRequests = res.data.map((r: any) => ({
        ...r,
        timeElapsed: this.getTimeInStatus(new Date(r.requestTime))
      })).sort((a: any, b: any) => new Date(a.requestTime).getTime() - new Date(b.requestTime).getTime()),
      error: (err) => console.error('Error loading waiter requests:', err)
    });
  }
 isOverdue(timestamp: string | Date, minutes: number): boolean {
    const dateObj = (timestamp instanceof Date) ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMin = diffMs / (1000 * 60);
    return diffMin > minutes;
  }

loadOffersData(): void {
  this.loadActiveOffers();
  this.loadOfferStats();
  this.loadOfferPerformance();
}

loadActiveOffers(): void {
  this.http.get<any>(`${this.OFFER_API}/restaurant/${this.restaurantId}`).subscribe({
    next: (res) => {
      this.activeOffers = res;
    },
    error: (err) => console.error('Error loading offers:', err)
  });
}

loadOfferStats(): void {
  this.http.get<any>(`${this.OFFER_API}/stats?restaurantId=${this.restaurantId}`).subscribe({
    next: (res) => {
      this.offerStats = res;
    },
    error: (err) => console.error('Error loading offer stats:', err)
  });
}

loadOfferPerformance(): void {
  this.http.get<any>(`${this.OFFER_API}/performance?restaurantId=${this.restaurantId}`).subscribe({
    next: (res) => {
      this.prepareOfferPerformanceChart(res);
    },
    error: (err) => console.error('Error loading offer performance:', err)
  });
}

closeModalById(modalId: string): void {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }
}

deleteOffer(offerID: number): void {
  if (confirm('Are you sure you want to delete this offer?')) {
    this.http.delete(`${this.OFFER_API}/${offerID}?restaurantId=${this.restaurantId}`).subscribe({
      next: () => {
        this.loadOffersData();
      },
      error: (err) => {
        console.error('Error deleting offer:', err);
      }
    });
  }
}

prepareOfferPerformanceChart(performanceData: any): void {
  const labels = performanceData?.labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const orders = performanceData?.orders || [0, 0, 0, 0];
  const discounts = performanceData?.discounts || [0, 0, 0, 0];

  this.offerPerformanceChartData = {
    labels: labels,
    datasets: [
      {
        label: 'Orders with Offers',
        data: orders,
        backgroundColor: '#3b82f6',
        yAxisID: 'y'
      },
      {
        label: 'Discount Amount (₹)',
        data: discounts,
        backgroundColor: '#10b981',
        type: 'line' as const,
        yAxisID: 'y1',
        borderColor: '#10b981',
        borderWidth: 2,
        fill: false
      }
    ]
  };
}

selectSection(section: any) {
  this.selectedSection = section;
  this.isSidebarOpen = false;
     if (section === 'offers') {
    this.loadOffersData();
  }
}

viewBill(orderId: number): void {
  this.http.get(`${this.ORDER_API}/${orderId}/bill-html`, { responseType: 'text' }).subscribe({
    next: (html: string) => {
      this.billHtmlContent = html;
      this.showBillModal = true;
    },
    error: err => {
      console.error('Failed to load bill:', err);
    }
  });
}
closeBillModal(): void {
  this.showBillModal = false;
  this.billHtmlContent = '';
}

reprintBill(orderID: number) {
  window.open(`${this.ORDER_API}/${orderID}/bill`, '_blank');
}

viewOrderTimeline(orderID: number) {

}


Math = Math;

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  onSearchChange() {
    const q = this.searchText.trim().toLowerCase();
    this.filteredProducts = this.products.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase() ?? '').includes(q)
    );
  }


  onDateOptionChange(): void {
    const today = new Date();
    
    switch (this.filterDateOption) {
      case 'today':
        this.customStartDate = this.formatDate(today);
        this.customEndDate = this.formatDate(today);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        this.customStartDate = this.formatDate(yesterday);
        this.customEndDate = this.formatDate(yesterday);
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(today.getDate() - 6);
        this.customStartDate = this.formatDate(last7);
        this.customEndDate = this.formatDate(today);
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(today.getDate() - 29);
        this.customStartDate = this.formatDate(last30);
        this.customEndDate = this.formatDate(today);
        break;
      case 'thismonth':
        this.customStartDate = this.formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
        this.customEndDate = this.formatDate(today);
        break;
      case 'lastmonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        this.customStartDate = this.formatDate(lastMonth);
        this.customEndDate = this.formatDate(new Date(today.getFullYear(), today.getMonth(), 0));
        break;
      default:
        this.customStartDate = '';
        this.customEndDate = '';
    }
  }


downloadBill(orderId: number): void {
  const url = `${this.ORDER_API}/${orderId}/bill`;
  window.open(url, '_blank');
}
  toggleItems(order: any): void {
    order.showItems = !order.showItems;
  }


getPaymentBadgeClass(paymentMethod: string): string {
  switch (paymentMethod?.toLowerCase()) {
    case 'cash':
      return 'bg-success';
    case 'card':
      return 'bg-primary';
    case 'upi':
      return 'bg-info';
    default:
      return 'bg-secondary';
  }
}

openAddCategoryModal(): void {
  this.isEditCategoryMode = false;
  this.modalCategory = {
    categoryName: '',
    categoryDescription: '',
    isAvailable: true
  };
  this.showCategoryModal = true;
}

openEditCategoryModal(category: any): void {
  this.isEditCategoryMode = true;
  this.modalCategory = { ...category };
  this.showCategoryModal = true;
}

closeCategoryModal(): void {
  this.showCategoryModal = false;
}

addCategory(): void {
  const newCategory = {
    categoryName: this.modalCategory.categoryName,
    categoryDescription: this.modalCategory.categoryDescription,
    isAvailable: this.modalCategory.isAvailable,
    restaurantId: this.restaurantId
  };

  this.http.post(this.CATEGORY_URL, newCategory).subscribe({
    next: () => {
      this.loadCategories();
      this.closeCategoryModal();
    },
    error: err => console.error('Add category failed:', err)
  });
}

updateCategory(): void {
  const payload = {
    categoryID: this.modalCategory.categoryID,
    categoryName: this.modalCategory.categoryName,
    categoryDescription: this.modalCategory.categoryDescription,
    isAvailable: this.modalCategory.isAvailable,
    restaurantId: this.restaurantId
  };

  this.http.put(`${this.CATEGORY_URL}/${payload.categoryID}`, payload).subscribe({
    next: () => {
      this.loadCategories();
      this.closeCategoryModal();
    },
    error: err => console.error('Update category error:', err)
  });
}

deleteCategory(categoryID: number): void {
  if (!confirm('Delete this category? This will fail if there are items in this category.')) return;
  
  this.http.delete(`${this.CATEGORY_URL}/${categoryID}?restaurantId=${this.restaurantId}`).subscribe({
    next: () => this.loadCategories(),
    error: err => {
      console.error('Delete category failed:', err);
    }
  });
}

toggleCategoryAvailability(category: any): void {
  const newAvail = !category.isAvailable;
  const payload = { isAvailable: newAvail };
  
  this.http.put(`${this.CATEGORY_URL}/${category.categoryID}/availability?restaurantId=${this.restaurantId}`, payload).subscribe({
    next: () => category.isAvailable = newAvail,
    error: err => console.error('Category availability update failed:', err)
  });
}

openAddSubcategoryModal(): void {
  this.isEditSubcategoryMode = false;
  this.modalSubcategory = {
    subCategoryName: '',
    subCategoryDescription: '',
    categoryID: null,
    isAvailable: true
  };
  this.showSubcategoryModal = true;
}

openEditSubcategoryModal(subcategory: any): void {
  this.isEditSubcategoryMode = true;
  this.modalSubcategory = { ...subcategory };
  this.showSubcategoryModal = true;
}

closeSubcategoryModal(): void {
  this.showSubcategoryModal = false;
}

addSubcategory(): void {
  const newSubcategory = {
    subCategoryName: this.modalSubcategory.subCategoryName,
    subCategoryDescription: this.modalSubcategory.subCategoryDescription,
    categoryID: this.modalSubcategory.categoryID,
    isAvailable: this.modalSubcategory.isAvailable,
    restaurantId: this.restaurantId
  };

  this.http.post(this.SUBCATEGORY_URL, newSubcategory).subscribe({
    next: () => {
      this.loadSubCategories();
      this.closeSubcategoryModal();
    },
    error: err => console.error('Add subcategory failed:', err)
  });
}

updateSubcategory(): void {
  const payload = {
    subCategoryID: this.modalSubcategory.subCategoryID,
    subCategoryName: this.modalSubcategory.subCategoryName,
    subCategoryDescription: this.modalSubcategory.subCategoryDescription,
    categoryID: this.modalSubcategory.categoryID,
    isAvailable: this.modalSubcategory.isAvailable,
    restaurantId: this.restaurantId
  };

  this.http.put(`${this.SUBCATEGORY_URL}/${payload.subCategoryID}`, payload).subscribe({
    next: () => {
      this.loadSubCategories();
      this.closeSubcategoryModal();
    },
    error: err => console.error('Update subcategory error:', err)
  });
}

deleteSubcategory(subCategoryID: number): void {
  if (!confirm('Delete this subcategory? This will fail if there are items in this subcategory.')) return;
  
  this.http.delete(`${this.SUBCATEGORY_URL}/${subCategoryID}?restaurantId=${this.restaurantId}`).subscribe({
    next: () => this.loadSubCategories(),
    error: err => {
      console.error('Delete subcategory failed:', err);
    }
  });
}

toggleSubcategoryAvailability(subcategory: any): void {
  const newAvail = !subcategory.isAvailable;
  const payload = { isAvailable: newAvail };
  
  this.http.put(`${this.SUBCATEGORY_URL}/${subcategory.subCategoryID}/availability?restaurantId=${this.restaurantId}`, payload).subscribe({
    next: () => subcategory.isAvailable = newAvail,
    error: err => console.error('Subcategory availability update failed:', err)
  });
}

getCategoryName(categoryID: number): string {
  const category = this.categories.find(c => c.categoryID === categoryID);
  return category ? category.categoryName : '—';
}

getSubcategoryName(subCategoryID: number): string {
  const subcategory = this.subcategories.find(sc => sc.subCategoryID === subCategoryID);
  return subcategory ? subcategory.subCategoryName : '—';
}

getCategoryItemCount(categoryID: number): number {
  return this.products.filter(p => p.categoryID === categoryID).length;
}

getSubcategoryItemCount(subCategoryID: number): number {
  return this.products.filter(p => p.subCategoryID === subCategoryID).length;
}
safeNumber(value: any, defaultValue: number = 0): number {
  return Number(value) || defaultValue;
}


getOrderDuration(order: any): string {
  if (!order.closedAt) return 'Ongoing';
  
  const created = new Date(order.createdAt);
  const closed = new Date(order.closedAt);
  const durationMs = closed.getTime() - created.getTime();
  const durationMins = Math.round(durationMs / (1000 * 60));
  
  if (durationMins < 60) return `${durationMins} mins`;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

getFormattedDateRange(): string {
  if (this.filterDateOption === 'custom' && this.customStartDate && this.customEndDate) {
    const start = new Date(this.customStartDate);
    const end = new Date(this.customEndDate);
    return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  
  const rangeMap: any = {
    'today': 'Today',
    'yesterday': 'Yesterday', 
    'last7': 'Last 7 Days',
    'last30': 'Last 30 Days',
    'thismonth': 'This Month',
    'lastmonth': 'Last Month'
  };
  
  return rangeMap[this.filterDateOption] || 'Custom Range';
}

getRestaurantName(): string {
  return 'Restaurant';
}

resetFilters(): void {
  this.filterDateOption = 'last7';
  this.filterTableNo = null;
  this.filterPaymentMethod = '';
  this.searchText = '';
  this.onDateOptionChange();
}
private downloadFile(data: string, type: string, filename: string) {
  const blob = new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
safeString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

acknowledgeWaiterRequest(id: number): void {
  this.http.put(`${this.ORDER_API}/waiter-requests/${id}/accept`, {}).subscribe({
    next: () => {
      this.loadWaiterRequests();
      console.log('Waiter request acknowledged');
    },
    error: (err) => {
      console.error('Failed to acknowledge request:', err);
      alert('Failed to acknowledge waiter request');
    }
  });
}
  calculateOrderTotal(order: any): number {
    return order.totalAmount || 
      (order.subtotal || 0) + 
      (order.cgst || 0) + 
      (order.sgst || 0) + 
      (order.serviceCharge || 0) - 
      (order.discountAmount || 0);
  }

  calculateSubtotal(order: any): number {
    return order.subtotal || 
      order.items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
  }



 getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Completed':
      case 'Served':
        return 'bg-success';
      case 'Awaiting Service':
        return 'bg-info'; 
      case 'Pending Payment':
        return 'bg-success'; 
      case 'Confirmed':
      case 'Ready':
        return 'bg-primary';
      case 'In Progress':
        return 'bg-warning'; 
      case 'Pending':
        return 'bg-warning';
      case 'Cancelled':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  loadCategories() {
    this.http.get<any[]>(`${this.CATEGORY_URL}?restaurantId=${this.restaurantId}`).subscribe({
      next: data => this.categories = data,
      error: err => console.error('Error loading categories:', err)
    });
  }

  loadSubCategories() {
    this.http.get<any[]>(`${this.SUBCATEGORY_URL}?restaurantId=${this.restaurantId}`).subscribe({
      next: data => this.subcategories = data,
      error: err => console.error('Error loading subcategories:', err)
    });
  }


  loadExpenseData(): void {
    this.http.get<any>(`${this.EXPENSE_API}?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.expenses = res.expenses;
        this.expenseSummary = res.summary;
      },
      error: (err) => console.error('Error loading expenses:', err)
    });

    const today = new Date();
    this.http.get<any>(`${this.EXPENSE_API}/budgets?restaurantId=${this.restaurantId}&year=${today.getFullYear()}&month=${today.getMonth() + 1}`).subscribe({
      next: (res) => this.budgets = res.data,
      error: (err) => console.error('Error loading budgets:', err)
    });
  }

  addExpense(): void {
    this.http.post(`${this.EXPENSE_API}`, {
      ...this.newExpense,
      restaurantId: this.restaurantId
    }).subscribe({
      next: () => {
        this.loadExpenseData();
        this.newExpense = {};
      },
      error: (err) => console.error('Error adding expense:', err)
    });
  }

  saveBudget(): void {
    this.http.post(`${this.EXPENSE_API}/budgets`, {
      ...this.newBudget,
      restaurantId: this.restaurantId
    }).subscribe({
      next: () => {
        this.loadExpenseData();
        this.newBudget = {};
      },
      error: (err) => console.error('Error saving budget:', err)
    });
  }

  showModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'block';
      document.body.classList.add('modal-open');
      
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  }
  hideModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
    }
  }

 








// Expense Management Methods
deleteExpense(expenseID: number): void {
  if (confirm('Are you sure you want to delete this expense?')) {
    this.http.delete(`${this.EXPENSE_API}/${expenseID}?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (res: any) => {
          this.loadExpenseData();
          console.log('Expense deleted successfully:', res);
        },
        error: (err) => {
          console.error('Error deleting expense:', err);
          alert('Failed to delete expense');
        }
      });
  }
}


  // NEW: Export Methods
  exportExpenseReport(): void {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    this.http.get(`${this.EXPENSE_API}/reports?restaurantId=${this.restaurantId}&startDate=${startDate.toISOString()}&endDate=${new Date().toISOString()}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expense-report-${new Date().toISOString().slice(0,10)}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error exporting expense report:', err)
    });
  }

  exportStaffSchedule(): void {
    // Implement PDF export for staff schedule
    const doc = new jsPDF();
    // Add staff schedule content
    doc.save(`staff-schedule-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // NEW: Mobile Optimization - Responsive methods
  isMobileScreen(): boolean {
    return window.innerWidth < 768;
  }

  // NEW: Integration methods
  integrateWithQuickBooks(): void {
    // Implement QuickBooks integration
    console.log('Integrating with QuickBooks...');
  }

  integrateWithDeliveryPlatforms(): void {
    // Implement delivery platform integration
    console.log('Integrating with delivery platforms...');
  }

  loadProducts() {
      if (this.restaurantId === 0) return;

    this.http.get<any[]>(`${this.PRODUCT_URL}?restaurantId=${this.restaurantId}`).subscribe({
      next: products => {
        this.products = products;
        this.filteredProducts = [...products];
      },
      error: err => console.error('Error loading products:', err)
    });
  }


  getSubcategoriesByCategory(categoryID: number) {
    return this.subcategories.filter(sc => sc.categoryID === categoryID);
  }

  // Product Modal Methods
  openAddModal() {
    this.isEditMode = false;
    this.modalProduct = {
      productName: '',
      price: 0,
      productDescription: '',
      isAvailable: true,
      subCategoryID: null,
      categoryID: null
    };
    this.isModalOpen = true;
  }

  openEditModal(p: any) {
    this.isEditMode = true;
    this.modalProduct = { ...p };
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

addProductModal() {
  const newProduct = {
    productName: this.modalProduct.productName,
    price: this.modalProduct.price,
    productDescription: this.modalProduct.productDescription,
    categoryID: this.modalProduct.categoryID,
    subCategoryID: this.modalProduct.subCategoryID,
    isAvailable: this.modalProduct.isAvailable,
    restaurantId: this.restaurantId
  };
  
  if (!newProduct.productName || newProduct.price <= 0) return;
    this.http.post(`${this.PRODUCT_URL}?restaurantId=${this.restaurantId}`, newProduct).subscribe({
    next: () => { 
      this.loadProducts(); 
      this.closeModal(); 
    },
    error: err => console.error('Add failed:', err)
  });
}

updateProductModal() {
  const payload = {
    productID: this.modalProduct.productID,
    productName: this.modalProduct.productName,
    price: this.modalProduct.price,
    productDescription: this.modalProduct.productDescription,
    categoryID: this.modalProduct.categoryID,
    subCategoryID: this.modalProduct.subCategoryID,
    isAvailable: this.modalProduct.isAvailable,
    restaurantId: this.restaurantId
  };

  this.http.put(`${this.PRODUCT_URL}/${payload.productID}?restaurantId=${this.restaurantId}`, payload).subscribe({
    next: () => { 
      this.loadProducts(); 
      this.closeModal(); 
    },
    error: err => console.error('Update error:', err)
  });
}

  deleteProduct(id: number) {
    if (!confirm('Delete this item?')) return;
    this.http.delete(`${this.PRODUCT_URL}/${id}?restaurantId=${this.restaurantId}`).subscribe({
      next: () => this.loadProducts(),
      error: err => console.error('Delete failed:', err)
    });
  }

toggleAvailability(product: any): void {
  const newAvail = !product.isAvailable;
  // Fix: Send a JSON object with the availability status.
  const payload = { isAvailable: newAvail };
  this.http.put(`${environment.apiUrl}/product/${product.productID}/availability?restaurantId=${this.restaurantId}`, payload, {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text'
  }).subscribe({
    next: () => product.isAvailable = newAvail,
    error: err => console.error('Availability update failed:', err)
  });
}

private safeCreateDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}


getTimeInStatus(timestamp: string | Date | undefined | null): string {
  const dateObj = this.safeCreateDate(timestamp);
  
  if (!dateObj) {
    return 'N/A';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMin = Math.round(diffMs / (1000 * 60));

  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }

  const diffHr = (diffMs / (1000 * 60 * 60));
  return `${diffHr.toFixed(1)} hrs ago`;
}
// Open offer modal
openOfferModal(): void {
  this.showOfferModal = true;
  // Prevent body scrolling when modal is open
  document.body.classList.add('modal-open');
}

// Close offer modal
closeOfferModal(): void {
  this.showOfferModal = false;
  // Re-enable body scrolling
  document.body.classList.remove('modal-open');
  this.resetNewOffer();
}

// Handle offer type changes
onOfferTypeChange(): void {
  // Reset the other type's value when switching
  if (this.newOffer.offerType === 'percent') {
    this.newOffer.discountAmount = null;
  } else {
    this.newOffer.discountPercent = null;
  }
}

// Handle offer code changes
onOfferCodeChange(): void {
  // If code is provided, disable auto-apply; if empty, enable it
  if (this.newOffer.code && this.newOffer.code.trim() !== '') {
    this.newOffer.autoApply = false;
  } else {
    this.newOffer.autoApply = true;
  }
}

// Validate offer form
isOfferFormValid(): boolean {
  if (!this.newOffer.description || !this.newOffer.validFrom || !this.newOffer.validTo) {
    return false;
  }

  if (this.newOffer.offerType === 'percent') {
    return !!(this.newOffer.discountPercent && this.newOffer.discountPercent > 0 && this.newOffer.discountPercent <= 100);
  } else {
    return !!(this.newOffer.discountAmount && this.newOffer.discountAmount > 0);
  }
}

// Update your createOffer method in manager.component.ts
createOffer(): void {
  if (!this.isOfferFormValid()) {
    alert('Please fill in all required fields correctly.');
    return;
  }

  // Prepare the offer data with RestaurantID
  const offerData = {
    restaurantID: this.restaurantId, // ✅ CRITICAL: Add this line
    code: this.newOffer.code?.trim() || null,
    description: this.newOffer.description,
    discountAmount: this.newOffer.offerType === 'amount' ? this.newOffer.discountAmount : null,
    discountPercent: this.newOffer.offerType === 'percent' ? this.newOffer.discountPercent : null,
    minBillAmount: this.newOffer.minBillAmount || 0,
    validFrom: new Date(this.newOffer.validFrom).toISOString(),
    validTo: new Date(this.newOffer.validTo).toISOString(),
    autoApply: this.newOffer.autoApply,
    isActive: true
  };

  console.log('🔍 Sending offer data:', offerData); // Debug log

  // ✅ FIX: Include restaurantId as both query parameter AND in body
  this.http.post(`${this.OFFER_API}?restaurantId=${this.restaurantId}`, offerData).subscribe({
    next: (res: any) => {
      this.loadOffersData();
      this.closeOfferModal();
      alert('Offer created successfully!');
    },
    error: (err) => {
      console.error('❌ Error creating offer:', err);
      alert('Failed to create offer: ' + (err.error?.message || 'Unknown error'));
    }
  });
}
// Update your resetNewOffer method
resetNewOffer(): void {
  this.newOffer = {
    offerType: 'percent',
    discountPercent: null,
    discountAmount: null,
    code: '',
    description: '',
    minBillAmount: 0,
    validFrom: '',
    validTo: '',
    autoApply: true,
    isActive: true
  };
}






  handleImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.modalProduct.imageUrl = reader.result as string;
      reader.readAsDataURL(file);
    }
  }
} 