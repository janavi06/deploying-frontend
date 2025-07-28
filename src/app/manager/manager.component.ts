import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { environment } from '../../environments/environment';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

restaurantId: number = 0; 

  // Section management
selectedSection: 'dashboard' | 'history' | 'editMenu' | 'settings' | 'reports' = 'history';
  isSidebarOpen = false;

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

  selectSection(section: any) {
    this.selectedSection = section;
    this.isSidebarOpen = false;
    if (section === 'history') this.applyFilters();
    if (section === 'reports') this.loadReportData();
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
      case 'Confirmed':
      case 'Ready':
        return 'bg-primary';
      case 'In Progress':
        return 'bg-info';
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

  handleImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.modalProduct.imageUrl = reader.result as string;
      reader.readAsDataURL(file);
    }
  }
}