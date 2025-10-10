import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';



@Component({
  selector: 'app-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager.component.html',
  styleUrls: ['./manager.component.css'],
})
export class ManagerComponent implements OnInit {
  readonly CATEGORY_URL = `${environment.apiUrl}/categories`;
  readonly SUBCATEGORY_URL = `${environment.apiUrl}/subcategories`;
  readonly ORDER_API = `${environment.apiUrl}/order`;
  readonly PRODUCT_URL = `${environment.apiUrl}/product`;
  readonly REPORT_API = `${environment.apiUrl}/order/report`;
  
  // Fixed: Remove duplicate declarations and use proper names
  readonly RESTAURANT_TABLE_API = `${environment.apiUrl}/restauranttables`; // Renamed
  readonly USER_API = `${environment.apiUrl}/user`; // Renamed
readonly OFFER_API = `${environment.apiUrl}/offer`;

  // New API URLs for advanced features
  readonly STAFF_MANAGEMENT_API = `${environment.apiUrl}/staffmanagement`; // Renamed
  readonly TABLE_MANAGEMENT_API = `${environment.apiUrl}/tablemanagement`; // Renamed
  readonly EXPENSE_API = `${environment.apiUrl}/expense`;
  readonly CUSTOMER_API = `${environment.apiUrl}/customer`;
  readonly ADVANCED_ANALYTICS_API = `${environment.apiUrl}/advancedanalytics`;
 // NEW: Staff Management
  staffMembers: any[] = [];
  staffShifts: any[] = [];
  staffPerformance: any[] = [];
  staffLeaderboard: any[] = [];
  
  // NEW: Table Management
  tableStatus: any[] = [];
  reservations: any[] = [];
  floorPlan: any[] = [];
  
  // NEW: Expense Tracking
  expenses: any[] = [];
  expenseSummary: any[] = [];
  budgets: any[] = [];
  expenseCategories = ['Food', 'Beverage', 'Labor', 'Utilities', 'Rent', 'Supplies', 'Marketing', 'Maintenance', 'Insurance', 'Other'];
  
  // NEW: Customer Management
  customers: any[] = [];
  customerFeedback: any[] = [];
  loyaltyProgram: any = {};
  customerAnalytics: any = {};
  
  // NEW: Advanced Analytics
  advancedDashboard: any = {};
  predictiveData: any = {};
  competitiveAnalysis: any = {};
  kpis: any = {};

  showAddStaffModal: boolean = false;
showCreateShiftModal: boolean = false;
  // NEW: Chart data for analytics
  staffPerformanceChartData: any = {};
  expenseBreakdownChartData: any = {};
  customerSegmentationChartData: any = {};
  kpiTrendChartData: any = {};

  showOfferModal: boolean = false;

  // NEW: Form models
  newStaff: any = {};
  newShift: any = {};
  newExpense: any = {};
  newReservation: any = {};
  newBudget: any = {};

  activeOrders: any[] = [];
  inProgressOrders: any[] = [];
  awaitingServiceOrders: any[] = [];
  pendingPaymentOrders: any[] = [];

  // ✨ START: NEW DASHBOARD DATA
  oldestPendingOrder: any = null;
  kitchenBacklogItems: number = 0;
  unacknowledgedNotifications: any[] = [];
  waiterRequests: any[] = [];
  todayStats: { revenue: number, aov: number, cancelled: number } = { revenue: 0, aov: 0, cancelled: 0 };
// ✨ END: NEW DASHBOARD DATA

restaurantId: number = 0; 

  // Section management
selectedSection: 'dashboard' | 'history' | 'editMenu' | 'settings' | 'reports' | 'staff' | 'tables' | 'expenses' | 'customers' | 'advanced' | 'offers' = 'dashboard';  isSidebarOpen = false;

  // Product management
  products: any[] = [];
  filteredProducts: any[] = [];
  subcategories: any[] = [];
  categories: any[] = [];
  searchText = '';
  isModalOpen = false;
  isEditMode = false;
  modalProduct: any = {};

  // Order history
  allOrders: any[] = [];
  filteredOrders: any[] = [];
  paginatedOrders: any[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  sortColumn: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  orderStatuses = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Served', 'Completed', 'Cancelled'];
  paymentMethods = ['Cash', 'Card', 'UPI'];

  // Add these properties
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

  // Filters
  filterDateOption: 'today' | 'yesterday' | 'last7' | 'last30' | 'thismonth' | 'lastmonth' | 'custom' = 'last7';
  customStartDate: string = '';
  customEndDate: string = '';
  filterTableNo: number | null = null;
  filterStatus: string = '';
  filterPaymentMethod: string = '';

  // Reports
  reportTypes = [
    { value: 'sales', label: 'Sales', icon: 'bi bi-currency-dollar' },
    { value: 'items', label: 'Items', icon: 'bi bi-list-ul' },
    { value: 'category', label: 'Category', icon: 'bi bi-tags' },
    { value: 'orders', label: 'Orders', icon: 'bi bi-receipt' },
    { value: 'monthly', label: 'Monthly', icon: 'bi bi-calendar-month' }
  ];

  selectedReport: string = 'sales';
  reportTimeRange: string = 'last7';
  customReportStartDate: string = '';
  customReportEndDate: string = '';
  comparePeriod: 'none' | 'previous' | 'lastyear' = 'none';
billHtmlContent: string = '';
showBillModal: boolean = false;
currentYear = new Date().getFullYear();

// Initialize newCustomer object
newCustomer: any = {
  name: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  preferences: '',
  allergies: '',
  isVIP: false
};



  // Report data
reportData: any = {
  totalRevenue: 0,
  totalOrders: 0,
  avgOrderValue: 0,
  cancellationRate: 0,
  revenueChange: 0,
  orderChange: 0,
  aovChange: 0,
  cancellationChange: 0,
  topItems: [],
  bottomItems: [],
  categoryPerformance: [],
  dailyData: [],
  topTables: [],
  paymentMethods: [],
  hourlyData: [],
  totalCancellations: 0
};
  constructor(private http: HttpClient) {
    const today = new Date();
    this.customStartDate = this.formatDate(new Date(today.setDate(today.getDate() - 6)))
    this.customEndDate = this.formatDate(new Date());
    this.customReportStartDate = this.customStartDate;
    this.customReportEndDate = this.customEndDate;
  }

ngOnInit(): void {
      this.restaurantId = Number(localStorage.getItem('restaurantId') || '0');

  this.loadSubCategories();
  this.loadCategories();
  this.loadProducts();
  this.loadAllOrders();
  this.loadReportData();

   // NEW: Load additional features
    this.loadStaffData();
    this.loadTableData();
    this.loadExpenseData();
    this.loadCustomerData();
    this.loadAdvancedAnalytics();
  this.loadOffersData();

  // Auto-refresh intervals
    setInterval(() => {
      this.loadDashboardData();
      this.loadTableData(); // Refresh table status
    }, 15000);
 


   // 👇 START THE DASHBOARD REFRESHER 👇
    this.loadDashboardData();
    setInterval(() => {
      this.loadDashboardData();
    }, 15000); // refresh every 15 seconds
  

  // Auto-refresh every 60 seconds
  setInterval(() => {
    if (this.selectedSection === 'history') {
      this.loadAllOrders(); // refresh only in history section
    }
  }, 60000); // every 60 seconds
}

  // Add these methods to your ManagerComponent class

viewOrderDetails(orderID: number) {
  // Implement order details viewing logic
  console.log('Viewing details for order:', orderID);
}

// ✨ MODIFIED: loadDashboardData to include new data points
loadDashboardData(): void {
    this.http.get<any>(`${this.ORDER_API}/dashboard/active-orders?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.activeOrders = res.data.orders.map((o: any) => ({
          ...o,
          lastUpdated: new Date(o.lastUpdated),
          timeInStatus: this.getTimeInStatus(new Date(o.createdAt)) // Simplified initial timer logic
        })).sort((a: any, b: any) => {
          return b.lastUpdated.getTime() - a.lastUpdated.getTime();
        });

        // Categorize orders for summary cards
        this.inProgressOrders = this.activeOrders.filter(o => o.status === 'In Progress' || o.status === 'Confirmed');
        this.awaitingServiceOrders = this.activeOrders.filter(o => o.status === 'Awaiting Service');
        this.pendingPaymentOrders = this.activeOrders.filter(o => o.status === 'Pending Payment' || o.status === 'Served');

        // New KPI logic
        const oldestPending = this.activeOrders
          .filter(o => o.status === 'Pending')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

        this.oldestPendingOrder = oldestPending;

      },
      error: (err) => {
        console.error('Error loading dashboard data:', err);
      },
    });

    // Fetch real-time operational data
    this.loadOperationalKpis();
    this.loadWaiterRequests();
    this.loadTodayStats();
  }

// ✨ NEW: Load Operational KPIs (Kitchen Backlog & Notifications)
  loadOperationalKpis(): void {
    // Kitchen Backlog
    this.http.get<any>(`${this.ORDER_API}/dashboard/kitchen-backlog?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.kitchenBacklogItems = res.totalPendingItems,
      error: (err) => console.error('Error loading kitchen backlog:', err)
    });

    // Waiter Notifications (Awaiting Service)
    this.http.get<any[]>(`${this.ORDER_API}/waiter/notifications?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.unacknowledgedNotifications = res.map(n => ({
        ...n,
        timeElapsed: this.getTimeInStatus(new Date(n.createdAt))
      })),
      error: (err) => console.error('Error loading notifications:', err)
    });
  }

// ✨ NEW: Load Waiter Call Requests
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
// ✨ NEW: Load Today's Key Financial Stats
  loadTodayStats(): void {
    const today = this.formatDate(new Date());
    const params = {
      restaurantId: this.restaurantId,
      startDate: today,
      endDate: today,
      status: 'Completed', // Only completed orders count for revenue/AOV
    };

    this.http.get<any>(`${this.REPORT_API}/today-summary`, { params }).subscribe({
      next: (res) => {
        this.todayStats = {
          revenue: res.totalRevenue || 0,
          aov: res.avgOrderValue || 0,
          cancelled: res.totalCancelled || 0
        };
      },
      error: (err) => console.error('Error loading today stats:', err)
    });
  }



// Add these methods
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


// Add this helper method to close modals
closeModalById(modalId: string): void {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Remove show class and backdrop
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    
    // Remove backdrop
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
        alert('Failed to delete offer');
      }
    });
  }
}

prepareOfferPerformanceChart(performanceData: any): void {
  // Use safe data access with fallbacks
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


// Update the selectSection method to load offers data
selectSection(section: any) {
  this.selectedSection = section;
  this.isSidebarOpen = false;
  if (section === 'history') {
    this.applyFilters();
  } else if (section === 'reports') {
    this.loadReportData();
  } else if (section === 'dashboard') {
    this.loadDashboardData();
  } else if (section === 'offers') {
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
      alert('Failed to load bill.');
    }
  });
}

closeBillModal(): void {
  this.showBillModal = false;
  this.billHtmlContent = '';
}

reprintBill(orderID: number) {
  // Implement bill reprinting logic
  window.open(`${this.ORDER_API}/${orderID}/bill`, '_blank');
}
getPages(): number[] {
  const pages: number[] = [];
  for (let i = 1; i <= this.totalPages; i++) {
    pages.push(i);
  }
  return pages;
}
viewOrderTimeline(orderID: number) {
  // Implement timeline viewing logic
  console.log('Viewing timeline for order:', orderID);
}

exportReport() {
  // Implement report export logic
  this.downloadOrderHistoryCSV();
}

// Add this property to make Math available in template
Math = Math;

  // UI Methods
  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }


  // Product Management Methods
  onSearchChange() {
    const q = this.searchText.trim().toLowerCase();
    this.filteredProducts = this.products.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase() ?? '').includes(q)
    );
  }

  // Order History Methods
  loadAllOrders() {
    this.http.get<{ message: string; orders: any[] }>(`${this.ORDER_API}/with-waiter?restaurantId=${this.restaurantId}`).subscribe({
      next: res => {
        this.allOrders = res.orders.map(o => ({
          orderID: o.orderID,
          createdAt: new Date(o.createdAt),
          tableNo: o.tableNo,
          status: o.orderStatus,
          items: o.items,
          showItems: false,
          subtotal: o.subtotal || 0,
          discountAmount: o.discountAmount || 0,
          cgst: o.cgst || 0,
          sgst: o.sgst || 0,
          serviceCharge: o.serviceCharge || 0,
          totalAmount: o.totalAmount || 0,
          paymentMethod: o.latestPayment?.method || 'Pending',
          customerName: o.customerName || 'Guest'
        }));

        this.applyFilters();
      },
      error: err => console.error('Error loading orders:', err)
    });
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
getTableCountByStatus(status: string): number {
  return this.tableStatus.filter(t => t.status === status).length;
}
  applyFilters(): void {
    // Convert dates to Date objects for comparison
    const startDate = this.customStartDate ? new Date(this.customStartDate) : null;
    const endDate = this.customEndDate ? new Date(this.customEndDate + 'T23:59:59') : null;

    this.filteredOrders = this.allOrders
      .filter(order => {
        const orderDate = order.createdAt;
        let ok = true;
        
        // Date filtering
        if (startDate) ok = ok && orderDate >= startDate;
        if (endDate) ok = ok && orderDate <= endDate;
        
        // Other filters
        if (this.filterTableNo != null) ok = ok && order.tableNo == this.filterTableNo;
        if (this.filterStatus) ok = ok && order.status?.toLowerCase() === this.filterStatus.toLowerCase();
        if (this.filterPaymentMethod) ok = ok && order.paymentMethod?.toLowerCase() === this.filterPaymentMethod.toLowerCase();
        
        // Search text
        if (this.searchText) {
          const searchLower = this.searchText.toLowerCase();
          ok = ok && (
            order.orderID.toString().includes(searchLower) ||
            (order.tableNo?.toString().includes(searchLower)) ||
            order.items.some((i: any) => i.productName.toLowerCase().includes(searchLower)
          ))
        }
        return ok;
      })
      .sort((a, b) => {
        const aValue = a[this.sortColumn];
        const bValue = b[this.sortColumn];
        
        if (this.sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    
    this.updatePagination();
  }



  sortOrders(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  // Pagination Methods
  updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredOrders.length / this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.paginateOrders();
  }

  paginateOrders(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.paginateOrders();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginateOrders();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginateOrders();
    }
  }


  downloadBill(orderId: number): void {
    const url = `${this.ORDER_API}/${orderId}/bill`;
    window.open(url, '_blank');
  }

  toggleItems(order: any): void {
    order.showItems = !order.showItems;
  }

  // Reports Methods
// Update the loadReportData method to handle the API response properly
loadReportData(): void {
  const params: any = {
    restaurantId: this.restaurantId,
    reportType: this.selectedReport,
    timeRange: this.reportTimeRange
  };

  if (this.reportTimeRange === 'custom') {
    params.startDate = this.customReportStartDate;
    params.endDate = this.customReportEndDate;
  }

  if (this.comparePeriod !== 'none') {
    params.compareWith = this.comparePeriod;
  }

  this.http.get(`${this.REPORT_API}/sales-analytics`, { params }).subscribe({
    next: (res: any) => {
      // Ensure all required properties are set
      this.reportData = {
        totalRevenue: res.totalRevenue || 0,
        totalOrders: res.totalOrders || 0,
        avgOrderValue: res.avgOrderValue || 0,
        cancellationRate: res.cancellationRate || 0,
        revenueChange: res.revenueChange || 0,
        orderChange: res.orderChange || 0,
        aovChange: res.aovChange || 0,
        cancellationChange: res.cancellationChange || 0,
        topItems: res.topItems || [],
        bottomItems: res.bottomItems || [],
        categoryPerformance: res.categoryPerformance || [],
        dailyData: res.dailyData || [],
        topTables: res.topTables || [],
        paymentMethods: res.paymentMethods || [],
        hourlyData: res.hourlyData || [],
        totalCancellations: res.totalCancellations || 0
      };
    },
    error: err => {
      console.error('Error loading report:', err);
      // Set default empty data on error
      this.reportData = {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        cancellationRate: 0,
        revenueChange: 0,
        orderChange: 0,
        aovChange: 0,
        cancellationChange: 0,
        topItems: [],
        bottomItems: [],
        categoryPerformance: [],
        dailyData: [],
        topTables: [],
        paymentMethods: [],
        hourlyData: [],
        totalCancellations: 0
      };
    }
  });
}

calculateSuccessRate(): number {
  const total = this.filteredOrders.length;
  const successful = this.filteredOrders.filter(o => o.status !== 'Cancelled').length;
  return total > 0 ? successful / total : 0;
}

// Get payment badge class
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

getPaymentMethodPercentage(methodAmount: number): string {
  if (!this.reportData.totalRevenue || this.reportData.totalRevenue <= 0) {
    return '0%';
  }
  const percentage = (methodAmount / this.reportData.totalRevenue) * 100;
  return percentage.toFixed(1) + '%';
}

// Add this helper method for safe number display
safeNumber(value: any, defaultValue: number = 0): number {
  return Number(value) || defaultValue;
}

  selectReport(report: string): void {
    this.selectedReport = report;
    this.loadReportData();
  }


  getComparisonPeriod(): string {
    switch (this.comparePeriod) {
      case 'previous': return 'previous period';
      case 'lastyear': return 'last year';
      default: return '';
    }
  }
exportToCSV() {
  const headers = [
    'Order ID', 'Date', 'Time', 'Table Number', 'Customer Name', 
    'Total Items', 'Subtotal', 'Discount', 'CGST', 'SGST', 
    'Service Charge', 'Total Amount', 'Payment Method', 'Payment Status',
    'Order Duration', 'Item Details'
  ];

  const csvRows = this.filteredOrders.map((order: any) => {
    const itemDetails = order.items.map((item: any) => 
      `${item.productName} x${item.quantity} @ ₹${item.unitPrice}`
    ).join('; ');

    const orderDate = new Date(order.createdAt);
    
    return [
      order.orderID,
      orderDate.toLocaleDateString(),
      orderDate.toLocaleTimeString(),
      order.tableNo || 'Takeaway',
      order.customerName || 'Guest',
      order.items.length,
      this.calculateSubtotal(order).toFixed(2),
      order.discountAmount || '0.00',
      order.cgst || '0.00',
      order.sgst || '0.00',
      order.serviceCharge || '0.00',
      this.calculateOrderTotal(order).toFixed(2),
      order.paymentMethod || 'Pending',
      order.status,
      this.getOrderDuration(order),
      `"${itemDetails}"`
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });

  // Add summary section
  const summary = [
    [],
    ['SUMMARY'],
    ['Total Orders:', this.filteredOrders.length],
    ['Total Revenue:', `₹${this.calculateTotalRevenue().toFixed(2)}`],
    ['Average Order Value:', `₹${this.calculateAverageOrderValue().toFixed(2)}`],
    ['Success Rate:', `${(this.calculateSuccessRate() * 100).toFixed(1)}%`],
    ['Report Period:', this.getFormattedDateRange()],
    ['Generated On:', new Date().toLocaleString()],
    []
  ];

  const summaryCsv = summary.map(row => row.map(field => `"${field}"`).join(','));
  const csvContent = [headers.join(','), ...csvRows, ...summaryCsv].join('\n');
  
  this.downloadFile(csvContent, 'text/csv', 
    `Order_History_${this.getRestaurantName()}_${new Date().toISOString().slice(0,10)}.csv`);
}

// Helper Methods
getPaymentMethodBreakdown() {
  const methods: any = {};
  this.filteredOrders.forEach(order => {
    const method = order.paymentMethod || 'Pending';
    if (!methods[method]) {
      methods[method] = { count: 0, amount: 0 };
    }
    methods[method].count++;
    methods[method].amount += this.calculateOrderTotal(order);
  });

  const totalAmount = this.calculateTotalRevenue();
  return Object.keys(methods).map(method => ({
    method,
    count: methods[method].count,
    amount: methods[method].amount,
    percentage: totalAmount > 0 ? ((methods[method].amount / totalAmount) * 100).toFixed(1) : '0.0'
  }));
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

getRestaurantName(): string {
  // You can get this from your restaurant service or use a default
  // For now, using a default name - you can enhance this by fetching actual restaurant data
  return 'Restaurant';
}

getFormattedDateRange(): string {
  if (this.filterDateOption === 'custom' && this.customStartDate && this.customEndDate) {
    const start = new Date(this.customStartDate);
    const end = new Date(this.customEndDate);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }
  return this.filterDateOption.charAt(0).toUpperCase() + this.filterDateOption.slice(1);
}



// Update resetFilters to remove status filter
resetFilters(): void {
  this.filterDateOption = 'last7';
  this.filterTableNo = null;
  this.filterPaymentMethod = '';
  this.searchText = '';
  this.onDateOptionChange();
  this.applyFilters();
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

exportToPDF() {
  const doc = new jsPDF();
  
  // Restaurant Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('ORDER HISTORY REPORT', 105, 20, { align: 'center' });
  
  // Report Details
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Restaurant: ${this.getRestaurantName()}`, 20, 35);
  doc.text(`Period: ${this.getFormattedDateRange()}`, 20, 42);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 49);
  doc.text(`Total Orders: ${this.filteredOrders.length}`, 140, 35);
  doc.text(`Total Revenue: ₹${this.calculateTotalRevenue().toLocaleString('en-IN')}`, 140, 42);
  doc.text(`Success Rate: ${(this.calculateSuccessRate() * 100).toFixed(1)}%`, 140, 49);

  // Summary Section
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text('SUMMARY OVERVIEW', 20, 65);
  
  doc.setFontSize(10);
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Orders', this.filteredOrders.length.toString()],
    ['Completed Orders', this.filteredOrders.filter(o => o.status === 'Completed').length.toString()],
    ['Cancelled Orders', this.filteredOrders.filter(o => o.status === 'Cancelled').length.toString()],
    ['Total Revenue', `₹${this.calculateTotalRevenue().toLocaleString('en-IN')}`],
    ['Average Order Value', `₹${this.calculateAverageOrderValue().toLocaleString('en-IN')}`],
    ['Success Rate', `${(this.calculateSuccessRate() * 100).toFixed(1)}%`]
  ];

  autoTable(doc, {
    head: [summaryData[0]],
    body: summaryData.slice(1),
    startY: 70,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // Detailed Orders Table
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.text('DETAILED ORDER BREAKDOWN', 20, finalY);

  const orderData = this.filteredOrders.map(order => [
    order.orderID.toString(),
    order.createdAt.toLocaleDateString(),
    order.tableNo || 'Takeaway',
    order.items.length.toString(),
    `₹${this.calculateOrderTotal(order).toLocaleString('en-IN')}`,
    order.paymentMethod || 'Pending',
    this.getOrderDuration(order)
  ]);

  autoTable(doc, {
    head: [['Order ID', 'Date', 'Table', 'Items', 'Amount', 'Payment', 'Duration']],
    body: orderData,
    startY: finalY + 5,
    theme: 'grid',
    headStyles: { fillColor: [52, 152, 219] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 15 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 }
    }
  });

  // Payment Method Breakdown
  const paymentSummaryY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.text('PAYMENT METHOD ANALYSIS', 20, paymentSummaryY);

  const paymentMethods = this.getPaymentMethodBreakdown();
  const paymentData = paymentMethods.map(p => [p.method, p.count.toString(), `₹${p.amount.toLocaleString('en-IN')}`, `${p.percentage}%`]);

  autoTable(doc, {
    head: [['Payment Method', 'Orders', 'Amount', '% of Total']],
    body: paymentData,
    startY: paymentSummaryY + 5,
    theme: 'grid',
    headStyles: { fillColor: [39, 174, 96] },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text(`Generated by Restaurant Management System`, 105, 295, { align: 'center' });
  }

  doc.save(`Order_Report_${this.getRestaurantName()}_${new Date().toISOString().slice(0,10)}.pdf`);
}



  downloadOrderHistoryCSV() {
    let csv = 'OrderID,Date,Table,Status,Payment Method,Items,Subtotal,Discount,Tax,Service Charge,Total\n';
    this.filteredOrders.forEach((o: any) => {
      const items = o.items.map((i: any) => `${i.productName} x${i.quantity}`).join('; ');
      csv += `${o.orderID},${o.createdAt.toISOString()},${o.tableNo},${o.status},${o.paymentMethod},"${items}",${o.subtotal},${o.discountAmount},${o.cgst + o.sgst},${o.serviceCharge},${o.totalAmount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-history-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // Utility Methods
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

  calculateTotalRevenue(): number {
    return this.filteredOrders.reduce((sum, order) => sum + this.calculateOrderTotal(order), 0);
  }

  calculateAverageOrderValue(): number {
    return this.filteredOrders.length > 0 
      ? this.calculateTotalRevenue() / this.filteredOrders.length 
      : 0;
  }

  calculateCancellationRate(): number {
    const total = this.filteredOrders.length;
    const cancelled = this.filteredOrders.filter(o => o.status === 'Cancelled').length;
    return total > 0 ? cancelled / total : 0;
  }

 getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Completed':
      case 'Served':
        return 'bg-success';
      case 'Awaiting Service':
        return 'bg-info'; // New status
      case 'Pending Payment':
        return 'bg-success'; // New status
      case 'Confirmed':
      case 'Ready':
        return 'bg-primary';
      case 'In Progress':
        return 'bg-warning'; // New status
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

  // Data Loading Methods

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

// NEW: Staff Management Methods
  loadStaffData(): void {
    this.http.get<any>(`${this.STAFF_MANAGEMENT_API}/staff?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.staffMembers = res.data,
      error: (err) => console.error('Error loading staff:', err)
    });

    this.http.get<any>(`${this.STAFF_MANAGEMENT_API}/shifts?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.staffShifts = res.data,
      error: (err) => console.error('Error loading shifts:', err)
    });

    this.http.get<any>(`${this.STAFF_MANAGEMENT_API}/performance?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.staffPerformance = res.performance;
        this.staffLeaderboard = res.leaderboard;
      },
      error: (err) => console.error('Error loading staff performance:', err)
    });
  }

 

  // NEW: Table Management Methods
  loadTableData(): void {
    this.http.get<any>(`${this.TABLE_MANAGEMENT_API}/status?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.tableStatus = res.data;
        this.prepareFloorPlan();
      },
      error: (err) => console.error('Error loading table status:', err)
    });

    this.http.get<any>(`${this.TABLE_MANAGEMENT_API}/reservations?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.reservations = res.data,
      error: (err) => console.error('Error loading reservations:', err)
    });
  }

  updateTableStatus(tableId: number, status: string): void {
    this.http.put(`${this.TABLE_MANAGEMENT_API}/status/${tableId}?restaurantId=${this.restaurantId}`, status).subscribe({
      next: () => this.loadTableData(),
      error: (err) => console.error('Error updating table status:', err)
    });
  }

  createReservation(): void {
    this.http.post(`${this.TABLE_MANAGEMENT_API}/reservations`, {
      ...this.newReservation,
      restaurantId: this.restaurantId
    }).subscribe({
      next: () => {
        this.loadTableData();
        this.newReservation = {};
      },
      error: (err) => console.error('Error creating reservation:', err)
    });
  }

  // NEW: Expense Tracking Methods
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

  // NEW: Customer Management Methods
  loadCustomerData(): void {
    this.http.get<any>(`${this.CUSTOMER_API}?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.customers = res.data,
      error: (err) => console.error('Error loading customers:', err)
    });

    this.http.get<any>(`${this.CUSTOMER_API}/analytics?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.customerAnalytics = res.data;
      },
      error: (err) => console.error('Error loading customer analytics:', err)
    });

    this.http.get<any>(`${this.CUSTOMER_API}/loyalty?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.loyaltyProgram = res.program,
      error: (err) => console.error('Error loading loyalty program:', err)
    });
  }

  showModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'block';
      document.body.classList.add('modal-open');
      
      // Add backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  }

  // Helper method to hide modal
  hideModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      
      // Remove backdrop
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
    }
  }

  // NEW: Advanced Analytics Methods
  loadAdvancedAnalytics(): void {
    this.http.get<any>(`${this.ADVANCED_ANALYTICS_API}/dashboard?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.advancedDashboard = res;
      },
      error: (err) => console.error('Error loading advanced analytics:', err)
    });

    this.http.get<any>(`${this.ADVANCED_ANALYTICS_API}/predictive?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.predictiveData = res.data,
      error: (err) => console.error('Error loading predictive data:', err)
    });

    this.http.get<any>(`${this.ADVANCED_ANALYTICS_API}/competitive?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.competitiveAnalysis = res.data,
      error: (err) => console.error('Error loading competitive analysis:', err)
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    this.http.get<any>(`${this.ADVANCED_ANALYTICS_API}/kpis?restaurantId=${this.restaurantId}&startDate=${startDate.toISOString()}&endDate=${new Date().toISOString()}`).subscribe({
      next: (res) => this.kpis = res.data,
      error: (err) => console.error('Error loading KPIs:', err)
    });
  }


// Staff Management Methods
editStaff(staff: any): void {
  // Populate the form with staff data for editing
  this.newStaff = { ...staff };
  // You might want to open a modal or switch to edit mode
  console.log('Editing staff:', staff);
  // Example: Open edit modal
  // this.openEditStaffModal(staff);
}

deleteStaff(staffID: number): void {
  if (confirm('Are you sure you want to delete this staff member?')) {
    this.http.delete(`${this.STAFF_MANAGEMENT_API}/staff/${staffID}?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (res: any) => {
          this.loadStaffData();
          console.log('Staff deleted successfully:', res);
          // Show success message
        },
        error: (err) => {
          console.error('Error deleting staff:', err);
          alert('Failed to delete staff member');
        }
      });
  }
}

markShiftComplete(shiftID: number): void {
  this.http.put(`${this.STAFF_MANAGEMENT_API}/shifts/${shiftID}/complete?restaurantId=${this.restaurantId}`, {})
    .subscribe({
      next: (res: any) => {
        this.loadStaffData();
        console.log('Shift marked as complete:', res);
      },
      error: (err) => {
        console.error('Error completing shift:', err);
        alert('Failed to mark shift as complete');
      }
    });
}

deleteShift(shiftID: number): void {
  if (confirm('Are you sure you want to delete this shift?')) {
    this.http.delete(`${this.STAFF_MANAGEMENT_API}/shifts/${shiftID}?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (res: any) => {
          this.loadStaffData();
          console.log('Shift deleted successfully:', res);
        },
        error: (err) => {
          console.error('Error deleting shift:', err);
          alert('Failed to delete shift');
        }
      });
  }
}

// Table Management Methods
updateReservationStatus(reservationID: number, status: string): void {
  this.http.put(`${this.TABLE_MANAGEMENT_API}/reservations/${reservationID}/status?restaurantId=${this.restaurantId}`, { status })
    .subscribe({
      next: (res: any) => {
        this.loadTableData();
        console.log('Reservation status updated:', res);
      },
      error: (err) => {
        console.error('Error updating reservation status:', err);
        alert('Failed to update reservation status');
      }
    });
}

cancelReservation(reservationID: number): void {
  if (confirm('Are you sure you want to cancel this reservation?')) {
    this.http.put(`${this.TABLE_MANAGEMENT_API}/reservations/${reservationID}/cancel?restaurantId=${this.restaurantId}`, {})
      .subscribe({
        next: (res: any) => {
          this.loadTableData();
          console.log('Reservation cancelled:', res);
        },
        error: (err) => {
          console.error('Error cancelling reservation:', err);
          alert('Failed to cancel reservation');
        }
      });
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

// Customer Management Methods
viewCustomerDetails(customerID: number): void {
  // Navigate to customer details page or open details modal
  console.log('Viewing customer details for ID:', customerID);
  // Example implementation:
  this.http.get(`${this.CUSTOMER_API}/${customerID}?restaurantId=${this.restaurantId}`)
    .subscribe({
      next: (customer: any) => {
        // Open modal with customer details
        console.log('Customer details:', customer);
        // this.openCustomerDetailsModal(customer);
      },
      error: (err) => {
        console.error('Error loading customer details:', err);
        alert('Failed to load customer details');
      }
    });
}

toggleVIP(customerID: number, isVIP: boolean): void {
  const action = isVIP ? 'add to VIP' : 'remove from VIP';
  if (confirm(`Are you sure you want to ${action} this customer?`)) {
    this.http.put(`${this.CUSTOMER_API}/${customerID}/vip?restaurantId=${this.restaurantId}`, { isVIP })
      .subscribe({
        next: (res: any) => {
          this.loadCustomerData();
          console.log('VIP status updated:', res);
        },
        error: (err) => {
          console.error('Error updating VIP status:', err);
          alert('Failed to update VIP status');
        }
      });
  }
}

resolveFeedback(feedbackID: number): void {
  this.http.put(`${this.CUSTOMER_API}/feedback/${feedbackID}/resolve?restaurantId=${this.restaurantId}`, {})
    .subscribe({
      next: (res: any) => {
        this.loadCustomerData();
        console.log('Feedback resolved:', res);
      },
      error: (err) => {
        console.error('Error resolving feedback:', err);
        alert('Failed to resolve feedback');
      }
    });
}

// Advanced Analytics Methods
refreshAnalytics(): void {
  this.loadAdvancedAnalytics();
  console.log('Analytics data refreshed');
}

addCustomer(): void {
  // Validate required fields
  if (!this.newCustomer.name || !this.newCustomer.phone) {
    alert('Please fill in all required fields');
    return;
  }

  this.http.post(`${this.CUSTOMER_API}`, {
    ...this.newCustomer,
    restaurantId: this.restaurantId
  }).subscribe({
    next: (res: any) => {
      this.loadCustomerData();
      this.newCustomer = {
        name: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        preferences: '',
        allergies: '',
        isVIP: false
      };
      console.log('Customer added successfully:', res);
      
      // Simple modal close without bootstrap dependency
      const modal = document.getElementById('addCustomerModal');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          backdrop.remove();
        }
      }
      
      alert('Customer added successfully!');
    },
    error: (err) => {
      console.error('Error adding customer:', err);
      alert('Failed to add customer');
    }
  });
}


  prepareFloorPlan(): void {
    this.floorPlan = this.tableStatus.map(table => ({
      ...table,
      statusColor: this.getTableStatusColor(table.status)
    }));
  }

  getTableStatusColor(status: string): string {
    switch (status) {
      case 'Available': return '#10b981';
      case 'Occupied': return '#ef4444';
      case 'Reserved': return '#f59e0b';
      case 'Cleaning': return '#6b7280';
      case 'Maintenance': return '#64748b';
      default: return '#9ca3af';
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
    
    this.http.post(this.PRODUCT_URL, newProduct).subscribe({
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

    this.http.put(`${this.PRODUCT_URL}/${payload.productID}`, payload).subscribe({
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
this.http.put(`${environment.apiUrl}/product/${product.productID}/availability?restaurantId=${this.restaurantId}`, newAvail, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text'
    }).subscribe({
      next: () => product.isAvailable = newAvail,
      error: err => console.error('Availability update failed:', err)
    });
  }
// ✨ NEW: Utility method for time display
getTimeInStatus(timestamp: string | Date): string { // <- Change input type
    const dateObj = (timestamp instanceof Date) ? timestamp : new Date(timestamp); // <- Handle string/Date
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMin = Math.round(diffMs / (1000 * 60));

    if (diffMin < 60) {
      return `${diffMin} min ago`;
    }

    const diffHr = (diffMs / (1000 * 60 * 60));
    return `${diffHr.toFixed(1)} hrs ago`;
  }

// ✨ NEW: Acknowledge Waiter Request
  acknowledgeWaiterRequest(id: number): void {
    this.http.put(`${this.ORDER_API}/waiter-requests/${id}/accept`, {}).subscribe({
      next: () => {
        this.loadWaiterRequests();
      },
      error: (err) => console.error('Failed to acknowledge request:', err)
    });
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

// Update your createOffer method
createOffer(): void {
  if (!this.isOfferFormValid()) {
    alert('Please fill in all required fields correctly.');
    return;
  }

  // Prepare the offer data
  const offerData = {
    restaurantID: this.restaurantId,
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

  this.http.post(this.OFFER_API, offerData).subscribe({
    next: (res: any) => {
      this.loadOffersData();
      this.closeOfferModal();
      alert('Offer created successfully!');
    },
    error: (err) => {
      console.error('Error creating offer:', err);
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

// Add these methods to your component
openAddStaffModal(): void {
  this.showAddStaffModal = true;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

closeAddStaffModal(): void {
  this.showAddStaffModal = false;
  document.body.style.overflow = ''; // Restore scrolling
  this.newStaff = {}; // Reset form
}

openCreateShiftModal(): void {
  this.showCreateShiftModal = true;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

closeCreateShiftModal(): void {
  this.showCreateShiftModal = false;
  document.body.style.overflow = ''; // Restore scrolling
  this.newShift = {}; // Reset form
}

// Update your existing addStaff method to close the modal
addStaff(): void {
  this.http.post(`${this.STAFF_MANAGEMENT_API}/staff`, {
    ...this.newStaff,
    restaurantId: this.restaurantId
  }).subscribe({
    next: () => {
      this.loadStaffData();
      this.closeAddStaffModal(); // Close modal on success
    },
    error: (err) => console.error('Error adding staff:', err)
  });
}

// Update your existing createShift method to close the modal
createShift(): void {
  this.http.post(`${this.STAFF_MANAGEMENT_API}/shifts`, {
    ...this.newShift,
    restaurantId: this.restaurantId
  }).subscribe({
    next: () => {
      this.loadStaffData();
      this.closeCreateShiftModal(); // Close modal on success
    },
    error: (err) => console.error('Error creating shift:', err)
  });
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