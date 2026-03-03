import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-manager-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-reports.component.html',
  styleUrls: ['./manager-reports.component.css']
})
export class ManagerReportsComponent implements OnInit {

  @Input() restaurantId!: number;

  dateFilterMode: 'all' | 'today' | 'month' | 'custom' = 'all';
  rangeLabel = 'All Orders';

  activeSection: 'overview' | 'live' | 'sales' | 'orders' | 'past' | 'items' | 'categories' = 'overview';

  overview: any = {};
  sales: any = {};
  orders: any = {};
selectedOrder: any = null;

  liveOrders: any[] = [];
  pastOrders: any[] = [];

  items: any[] = [];
  categories: any[] = [];

  startDate!: string;
  endDate!: string;
orderTypeFilter: string = '';
  loading = false;
  error: string | null = null;

  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (!this.restaurantId) {
      console.error('restaurantId missing in ManagerReportsComponent');
      return;
    }
    this.loadOverview();
  }
reloadActiveSection() {
  if (this.activeSection === 'overview') this.loadOverview();
  if (this.activeSection === 'live') this.loadLiveOrders();
  if (this.activeSection === 'sales') this.loadSales();
  if (this.activeSection === 'orders') this.loadOrders();
  if (this.activeSection === 'past') this.loadPastOrders();
  if (this.activeSection === 'items') this.loadItems();
  if (this.activeSection === 'categories') this.loadCategories();
}
  setSection(section: any) {
    this.activeSection = section;
    this.error = null;

    if (section === 'overview') this.loadOverview();
    if (section === 'live') this.loadLiveOrders();
    if (section === 'sales') this.loadSales();
    if (section === 'orders') this.loadOrders();
    if (section === 'past') this.loadPastOrders();
    if (section === 'items') this.loadItems();
    if (section === 'categories') this.loadCategories();
  }

  private formatDate(d: Date) {
    return d.toISOString().substring(0, 10);
  }

  setToday() {
    const today = new Date();
    this.startDate = this.formatDate(today);
    this.endDate = this.formatDate(today);
    this.dateFilterMode = 'today';
    this.rangeLabel = 'Today';
    this.loadPastOrders();
  }

  onFilterChange() {
    if (this.dateFilterMode === 'all') {
      this.setAll();
    }
    if (this.dateFilterMode === 'today') {
      this.setToday();
    }
    if (this.dateFilterMode === 'month') {
      this.setThisMonth();
    }
  }

  setThisMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date();
    this.startDate = this.formatDate(first);
    this.endDate = this.formatDate(last);
    this.dateFilterMode = 'month';
    this.rangeLabel = 'This Month';
    this.loadPastOrders();
  }
openOrderModal(order: any) {

  // Calculate gross & discount safely
  const grossTotal = (order.items ?? [])
    .reduce((sum: number, i: any) => sum + (i.originalPrice || 0), 0);

  const totalDiscount = (order.items ?? [])
    .reduce((sum: number, i: any) => sum + (i.discountAmount || 0), 0);

  this.selectedOrder = {
    ...order,
    grossTotal,
    totalDiscount
  };
}

closeOrderModal() {
  this.selectedOrder = null;
}

  setAll() {
    this.dateFilterMode = 'all';
    this.rangeLabel = 'All Orders';
    this.startDate = '';
    this.endDate = '';
    this.loadPastOrders();
  }

  applyCustomRange() {
    if (!this.startDate || !this.endDate) return;
    this.dateFilterMode = 'custom';
    this.rangeLabel = `${this.startDate} → ${this.endDate}`;
    this.loadPastOrders();
  }

  /* ========== Overview ========== */
  loadOverview() {
    this.loading = true;
this.http.get<any>(
  `${this.api}/order/manager/reports/dashboard-stats?restaurantId=${this.restaurantId}&orderType=${this.orderTypeFilter}`
)      .subscribe({
        next: res => {
          this.overview = res ?? {};
          this.calculateExtraMetrics();
        },
        error: err => this.handleError(err),
        complete: () => this.loading = false
      });
  }

  private calculateExtraMetrics() {
    if (this.overview.totalOrders > 0) {
      // defensive rounding
      this.overview.avgOrderValue = Math.round((this.overview.totalRevenue || 0) / (this.overview.totalOrders || 1));
    } else {
      this.overview.avgOrderValue = 0;
    }
  }

  /* ========== Live Orders ========== */
  loadLiveOrders() {
    this.loading = true;
this.http.get<any[]>(
  `${this.api}/order/manager/reports/live-orders?restaurantId=${this.restaurantId}&orderType=${this.orderTypeFilter}`
)      .subscribe({
        next: res => this.liveOrders = res ?? [],
        error: err => this.handleError(err),
        complete: () => this.loading = false
      });
  }

  /* ========== Sales ========== */
  loadSales() {
    if (!this.startDate || !this.endDate) {
      this.error = 'Please select start and end dates for Sales report';
      return;
    }
    this.loading = true;
this.http.get<any>(
  `${this.api}/order/manager/reports/sales?restaurantId=${this.restaurantId}&startDate=${this.startDate}&endDate=${this.endDate}&orderType=${this.orderTypeFilter}`
)      .subscribe({
        next: res => this.sales = res,
        error: err => this.handleError(err),
        complete: () => this.loading = false
      });
  }

  /* ========== Orders ========== */
  loadOrders() {
    this.loading = true;
this.http.get<any>(
  `${this.api}/order/manager/reports/orders?restaurantId=${this.restaurantId}&orderType=${this.orderTypeFilter}`
)      .subscribe({
        next: res => this.orders = res,
        error: err => this.handleError(err),
        complete: () => this.loading = false
      });
  }

loadPastOrders() {
  this.loading = true;

  let url = `${this.api}/order/manager/reports/past-orders?restaurantId=${this.restaurantId}`;

  // 🔥 Add Order Type Filter
  if (this.orderTypeFilter) {
    url += `&orderType=${encodeURIComponent(this.orderTypeFilter)}`;
  }

  // 🔥 Add Date Filter
  if (this.dateFilterMode !== 'all' && this.startDate && this.endDate) {
    url += `&startDate=${encodeURIComponent(this.startDate)}&endDate=${encodeURIComponent(this.endDate)}`;
  }

  this.http.get<any[]>(url).subscribe({
    next: res => {

      this.pastOrders = (res ?? []).map(o => {

        const cashPaid = Number(o.cashPaid ?? 0);
        const upiPaid = Number(o.upiPaid ?? 0);
        const totalPaid = Number(o.paid ?? 0);
        const total = Number(o.total ?? 0);

        const remaining = Number(
          o.remaining ?? Math.max(total - totalPaid, 0)
        );

        return {
          ...o,

          // 🔥 Ensure Order Type Exists
          orderType: o.orderType ?? 'Unknown',

          total,
          cashPaid,
          upiPaid,
          paid: totalPaid,
          remaining,

paymentMethod: o.paymentMethod ?? 'Pending',
          payments: (o.payments ?? []).map((p: any) => ({
            paymentMethod: p.paymentMethod,
            amount: Number(p.amount ?? 0),
            channel: p.channel,
            isPartial: p.isPartial,
            createdAt: p.createdAt,
            completedAt: p.completedAt
          })),

          items: (o.items ?? []).map((i: any) => ({
            ...i,
            originalPrice: Number(i.originalPrice ?? 0),
            discountAmount: Number(i.discountAmount ?? 0),
            finalPrice: Number(i.finalPrice ?? 0),
          }))
        };
      });

    },
    error: err => this.handleError(err),
    complete: () => this.loading = false
  });
}
  /* ========== Items ========== */
  loadItems() {
    if (!this.startDate || !this.endDate) {
      this.error = 'Please select start and end dates for Items report';
      return;
    }
    this.loading = true;

    this.http.get<any[]>(`${this.api}/order/manager/reports/items?restaurantId=${this.restaurantId}&startDate=${this.startDate}&endDate=${this.endDate}`)
      .subscribe({
        next: res => this.items = res ?? [],
        error: err => this.handleError(err),
        complete: () => this.loading = false
      });
  }

  /* ========== Categories ========== */
  loadCategories() {
    this.loading = true;
    this.http.get<any[]>(`${this.api}/order/manager/reports/categories?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: res => this.categories = res ?? [],
        error: err => this.handleError(err),
        complete: () => this.loading = false
      });
  }

  /* ========== CSV Export ========== */
  exportToCSV(data: any[], filename: string) {
    if (!data || !data.length) return;

    const flat = data.map(o => ({
      orderNumber: o.orderNumber,
      date: o.date ? new Date(o.date).toLocaleString() : '',
      table: o.table,
      status: o.status,
      total: o.total,
paymentMethod: o.paymentMethod,
      items: o.items?.map((i: any) =>
        `${i.itemName} x${i.quantity} | Gross:${(i.originalPrice || 0).toFixed(2)} | Discount:${(i.discountAmount || 0).toFixed(2)} | Net:${(i.finalPrice || 0).toFixed(2)} | Offer:${i.offerName || ''}`
      ).join(' || ')
    }));

    const headers = Object.keys(flat[0]);
    const rows = flat.map(r =>
      headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  }

  private handleError(err: any) {
    console.error(err);
    this.error = err?.error?.message || 'Failed to load report data';
    this.loading = false;
  }
}
