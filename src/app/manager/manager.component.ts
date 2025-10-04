import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { environment } from '../../environments/environment';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, NgChartsModule],
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

  // NEW: Chart data for analytics
  staffPerformanceChartData: any = {};
  expenseBreakdownChartData: any = {};
  customerSegmentationChartData: any = {};
  kpiTrendChartData: any = {};

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
selectedSection: 'dashboard' | 'history' | 'editMenu' | 'settings' | 'reports' | 'staff' | 'tables' | 'expenses' | 'customers' | 'advanced' = 'dashboard';  isSidebarOpen = false;

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
    topTables: []
  };

  // Charts
  salesTrendChartData: any = { labels: [], datasets: [] };
  paymentMethodChartData: any = { labels: [], datasets: [] };
  hourlySalesChartData: any = { labels: [], datasets: [] };
  topItemsChartData: any = { labels: [], datasets: [] };
  categoryRevenueChartData: any = { labels: [], datasets: [] };

  // ✨ START: NEW CHART DATA
  waiterLoadChartData: any = { labels: [], datasets: [] };
// ✨ END: NEW CHART DATA

  // Chart options
  salesTrendChartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Revenue (₹)' }
      },
      x: {
        title: { display: true, text: 'Date' }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => `₹${context.raw.toLocaleString('en-IN')}`
        }
      }
    }
  };

doughnutChartOptions = {
  responsive: true,
  plugins: {
    legend: { 
      position: 'bottom' as const // Explicitly type as const
    }
  }
};
  barChartOptions = {
    responsive: true,
    scales: {
      y: { beginAtZero: true }
    }
  };

horizontalBarChartOptions = {
  responsive: true,
  indexAxis: 'y' as const, // Explicitly type as const
  scales: {
    x: {
      beginAtZero: true,
      title: { display: true, text: 'Quantity Sold' }
    }
  }
};


pieChartOptions = {
  responsive: true,
  plugins: {
    legend: { 
      position: 'bottom' as const // Explicitly type as const
    }
  }
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

        this.prepareWaiterLoadChart();
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

// ✨ NEW: Prepare Waiter Load Chart Data
  prepareWaiterLoadChart(): void {
    const waiterLoad = this.activeOrders.reduce((acc, order) => {
      const waiterName = order.waiterName || `Waiter ${order.waiterUserID || 'Unassigned'}`;
      acc[waiterName] = (acc[waiterName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.waiterLoadChartData = {
      labels: Object.keys(waiterLoad),
      datasets: [
        {
          label: 'Active Orders Assigned',
          data: Object.values(waiterLoad),
          backgroundColor: '#6366f1',
          hoverBackgroundColor: '#4f46e5'
        }
      ]
    };
  }

  // Override selectSection to also load dashboard data
  selectSection(section: any) {
    this.selectedSection = section;
    this.isSidebarOpen = false;
    if (section === 'history') {
      this.applyFilters();
    } else if (section === 'reports') {
      this.loadReportData();
    } else if (section === 'dashboard') {
      this.loadDashboardData();
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

  resetFilters(): void {
    this.filterDateOption = 'last7';
    this.filterTableNo = null;
    this.filterStatus = '';
    this.filterPaymentMethod = '';
    this.searchText = '';
    this.onDateOptionChange();
    this.applyFilters();
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
        this.reportData = res;
        this.prepareChartData(res);
      },
      error: err => console.error('Error loading report:', err)
    });
  }


  selectReport(report: string): void {
    this.selectedReport = report;
    this.loadReportData();
  }

  prepareChartData(reportData: any): void {
    // Sales Trend Chart
    this.salesTrendChartData = {
      labels: reportData.timeSeriesData?.labels || [],
      datasets: [
        {
          label: 'Revenue',
          data: reportData.timeSeriesData?.revenues || [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          yAxisID: 'y'
        }
      ]
    };
    
    // Payment Method Chart
    this.paymentMethodChartData = {
      labels: reportData.paymentMethods?.map((p: any) => p.method) || [],
      datasets: [{
        data: reportData.paymentMethods?.map((p: any) => p.amount) || [],
        backgroundColor: ['#3b82f6', '#10b981', '#6366f1']
      }]
    };

    // Hourly Sales Chart
    this.hourlySalesChartData = {
      labels: reportData.hourlyData?.labels || [],
      datasets: [
        {
          label: 'Hourly Revenue',
          data: reportData.hourlyData?.revenues || [],
          backgroundColor: 'rgba(75, 192, 192, 0.6)'
        }
      ]
    };

    // Top Items Chart
    this.topItemsChartData = {
      labels: reportData.topItems?.map((i: any) => i.productName) || [],
      datasets: [
        {
          label: 'Quantity Sold',
          data: reportData.topItems?.map((i: any) => i.quantity) || [],
          backgroundColor: 'rgba(153, 102, 255, 0.6)'
        }
      ]
    };

    // Category Revenue Chart
    this.categoryRevenueChartData = {
      labels: reportData.categoryPerformance?.map((c: any) => c.categoryName) || [],
      datasets: [
        {
          label: 'Revenue by Category',
          data: reportData.categoryPerformance?.map((c: any) => c.revenue) || [],
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ]
        }
      ]
    };
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
    'Order ID', 'Date/Time', 'Table', 'Status', 'Payment Method', 
    'Items Count', 'Subtotal', 'Discount', 'Tax', 'Service Charge', 'Total'
  ];

  const csvRows = this.filteredOrders.map((order: any) => {
    const items = order.items.map((i: any) => 
      `${i.productName} x${i.quantity}` + 
      (i.customizations?.length ? ` (${i.customizations.map((c: any) => c.optionName).join(', ')})` : '')
    ).join('; ');

    return [
      order.orderID,
      order.createdAt.toISOString(),
      order.tableNo || 'Takeaway',
      order.status,
      order.paymentMethod || 'Pending',
      order.items.length,
      this.calculateSubtotal(order),
      order.discountAmount || 0,
      (order.cgst || 0) + (order.sgst || 0),
      order.serviceCharge || 0,
      this.calculateOrderTotal(order)
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  this.downloadFile(csvContent, 'text/csv', `orders_${new Date().toISOString().slice(0,10)}.csv`);
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

  // Add title
  doc.setFontSize(18);
  doc.text('Order History Report', 14, 22);

  // Add date range
  doc.setFontSize(10);
  doc.text(`Date Range: ${this.getFormattedDateRange()}`, 14, 30);

  const headers = [
    'Order ID', 
    'Date', 
    'Table', 
    'Status', 
    'Payment', 
    'Items', 
    'Amount'
  ];

  const data = this.filteredOrders.map(order => [
    order.orderID,
    order.createdAt.toLocaleDateString(),
    order.tableNo || 'Takeaway',
    order.status,
    order.paymentMethod || 'Pending',
    order.items.length,
    this.calculateOrderTotal(order).toFixed(2)
  ]);

  // ✅ Correct call
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 35,
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold'
    }
  });

  doc.save(`orders_${new Date().toISOString().slice(0, 10)}.pdf`);
}


private getFormattedDateRange(): string {
  if (this.filterDateOption === 'custom' && this.customStartDate && this.customEndDate) {
    return `${new Date(this.customStartDate).toLocaleDateString()} - ${new Date(this.customEndDate).toLocaleDateString()}`;
  }
  return this.filterDateOption.charAt(0).toUpperCase() + this.filterDateOption.slice(1);
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
        this.prepareStaffPerformanceChart();
      },
      error: (err) => console.error('Error loading staff performance:', err)
    });
  }

  addStaff(): void {
    this.http.post(`${this.STAFF_MANAGEMENT_API}/staff`, {
      ...this.newStaff,
      restaurantId: this.restaurantId
    }).subscribe({
      next: () => {
        this.loadStaffData();
        this.newStaff = {};
        // Close modal or reset form
      },
      error: (err) => console.error('Error adding staff:', err)
    });
  }

  createShift(): void {
    this.http.post(`${this.STAFF_MANAGEMENT_API}/shifts`, {
      ...this.newShift,
      restaurantId: this.restaurantId
    }).subscribe({
      next: () => {
        this.loadStaffData();
        this.newShift = {};
      },
      error: (err) => console.error('Error creating shift:', err)
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
        this.prepareExpenseBreakdownChart();
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
        this.prepareCustomerSegmentationChart();
      },
      error: (err) => console.error('Error loading customer analytics:', err)
    });

    this.http.get<any>(`${this.CUSTOMER_API}/loyalty?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => this.loyaltyProgram = res.program,
      error: (err) => console.error('Error loading loyalty program:', err)
    });
  }

  // NEW: Advanced Analytics Methods
  loadAdvancedAnalytics(): void {
    this.http.get<any>(`${this.ADVANCED_ANALYTICS_API}/dashboard?restaurantId=${this.restaurantId}`).subscribe({
      next: (res) => {
        this.advancedDashboard = res;
        this.prepareKPITrendChart();
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

  // NEW: Chart Preparation Methods
  prepareStaffPerformanceChart(): void {
    this.staffPerformanceChartData = {
      labels: this.staffLeaderboard.map(s => s.staffName),
      datasets: [
        {
          label: 'Total Sales',
          data: this.staffLeaderboard.map(s => s.totalSales),
          backgroundColor: '#3b82f6'
        },
        {
          label: 'Efficiency Score',
          data: this.staffLeaderboard.map(s => s.avgEfficiency),
          backgroundColor: '#10b981',
          type: 'line',
          yAxisID: 'y1'
        }
      ]
    };
  }

  prepareExpenseBreakdownChart(): void {
    this.expenseBreakdownChartData = {
      labels: this.expenseSummary.map(e => e.category),
      datasets: [{
        data: this.expenseSummary.map(e => e.totalAmount),
        backgroundColor: [
          '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
          '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b'
        ]
      }]
    };
  }

  prepareCustomerSegmentationChart(): void {
    if (this.customerAnalytics.customerSegmentation) {
      this.customerSegmentationChartData = {
        labels: Object.keys(this.customerAnalytics.customerSegmentation),
        datasets: [{
          data: Object.values(this.customerAnalytics.customerSegmentation),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
        }]
      };
    }
  }

  prepareKPITrendChart(): void {
    // This would use historical KPI data
    this.kpiTrendChartData = {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'Revenue',
          data: [12000, 15000, 14000, 16000],
          borderColor: '#3b82f6',
          tension: 0.3
        },
        {
          label: 'Customer Satisfaction',
          data: [4.2, 4.5, 4.3, 4.6],
          borderColor: '#10b981',
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    };
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
  handleImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.modalProduct.imageUrl = reader.result as string;
      reader.readAsDataURL(file);
    }
  }
}