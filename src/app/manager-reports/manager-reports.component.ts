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
dateFilterMode:
  | 'all'
  | 'today'
  | 'month'
  | 'custom' = 'all';

rangeLabel = 'All Orders';

  activeSection:
    | 'overview'
    | 'live'
    | 'sales'
    | 'orders'
    | 'past'
    | 'items'
    | 'categories' = 'overview';

  overview: any = {};
  sales: any = {};
  orders: any = {};

  liveOrders: any[] = [];
  pastOrders: any[] = [];

  items: any[] = [];
  categories: any[] = [];

  startDate!: string;
  endDate!: string;

  loading = false;
  error: string | null = null;

  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (!this.restaurantId) {
      console.error(' restaurantId missing in ManagerReportsComponent');
      return;
    }
    this.loadOverview();
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

setAll() {
  this.dateFilterMode = 'all';
  this.rangeLabel = 'All Orders';
  this.loadPastOrders();
}

applyCustomRange() {
  if (!this.startDate || !this.endDate) return;
  this.dateFilterMode = 'custom';
  this.rangeLabel = `${this.startDate} → ${this.endDate}`;
  this.loadPastOrders();
}

private formatDate(d: Date) {
  return d.toISOString().substring(0, 10);
}

loadOverview() {
  this.loading = true;
  this.http.get<any>(
    `${this.api}/order/manager/reports/dashboard-stats?restaurantId=${this.restaurantId}`
  ).subscribe({
    next: res => {
      // res should now return: { totalRevenue, totalOrders, avgOrderValue, tableTurnover, hourlySales: [], topItems: [], payments: [] }
      this.overview = res;
      this.calculateExtraMetrics();
    },
    error: err => this.handleError(err),
    complete: () => this.loading = false
  });
}
private calculateExtraMetrics() {
  if (this.overview.totalOrders > 0) {
    this.overview.avgOrderValue = Math.round(this.overview.totalRevenue / this.overview.totalOrders);
  }
}
  loadLiveOrders() {
    this.loading = true;
    this.http.get<any[]>(
      `${this.api}/order/manager/reports/live-orders?restaurantId=${this.restaurantId}`
    ).subscribe({
      next: res => this.liveOrders = res ?? [],
      error: err => this.handleError(err),
      complete: () => this.loading = false
    });
  }

  loadSales() {
    if (!this.startDate || !this.endDate) return;
    this.loading = true;

    this.http.get<any>(
      `${this.api}/order/manager/reports/sales?restaurantId=${this.restaurantId}&startDate=${this.startDate}&endDate=${this.endDate}`
    ).subscribe({
      next: res => this.sales = res,
      error: err => this.handleError(err),
      complete: () => this.loading = false
    });
  }

  loadOrders() {
    this.loading = true;
    this.http.get<any>(
      `${this.api}/order/manager/reports/orders?restaurantId=${this.restaurantId}`
    ).subscribe({
      next: res => this.orders = res,
      error: err => this.handleError(err),
      complete: () => this.loading = false
    });
  }

loadPastOrders() {
  this.loading = true;

  let url = `${this.api}/order/manager/reports/past-orders?restaurantId=${this.restaurantId}`;

  if (this.dateFilterMode !== 'all' && this.startDate && this.endDate) {
    url += `&startDate=${this.startDate}&endDate=${this.endDate}`;
  }

  this.http.get<any[]>(url).subscribe({
    next: res => this.pastOrders = res ?? [],
    error: err => this.handleError(err),
    complete: () => this.loading = false
  });
}


  loadItems() {
    if (!this.startDate || !this.endDate) return;
    this.loading = true;

    this.http.get<any[]>(
      `${this.api}/order/manager/reports/items?restaurantId=${this.restaurantId}&startDate=${this.startDate}&endDate=${this.endDate}`
    ).subscribe({
      next: res => this.items = res ?? [],
      error: err => this.handleError(err),
      complete: () => this.loading = false
    });
  }

 
  loadCategories() {
    this.loading = true;
    this.http.get<any[]>(
      `${this.api}/order/manager/reports/categories?restaurantId=${this.restaurantId}`
    ).subscribe({
      next: res => this.categories = res ?? [],
      error: err => this.handleError(err),
      complete: () => this.loading = false
    });
  }

exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return;

  const flat = data.map(o => ({
    orderNumber: o.orderNumber,
    date: o.date,
    table: o.table,
    status: o.status,
    total: o.total,
    payment: o.paymentMode,
    items: o.items
      ?.map((i: any) => `${i.itemName} x${i.quantity}`)
      .join(' | ')
  }));

  const headers = Object.keys(flat[0]);
  const rows = flat.map(r =>
    headers.map(h => `"${r[h] ?? ''}"`).join(',')
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
