import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-manager-reports',
  standalone: true, // ✅ REQUIRED
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-reports.component.html',
  styleUrls: ['./manager-reports.component.css']
})
export class ManagerReportsComponent implements OnInit {

  @Input() restaurantId!: number; // ✅ FIX

  activeSection: string = 'overview';

  overview: any = {};
  sales: any = {};
  orders: any = {};
  items: any[] = [];
  categories: any[] = [];

  startDate!: string;
  endDate!: string;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (!this.restaurantId) {
      console.error('❌ ManagerReportsComponent: restaurantId missing');
      return;
    }

    this.loadOverview();
  }

  setSection(section: string) {
    this.activeSection = section;

    if (section === 'overview') this.loadOverview();
    if (section === 'sales') this.loadSales();
    if (section === 'orders') this.loadOrders();
    if (section === 'items') this.loadItems();
    if (section === 'categories') this.loadCategories();
  }

  loadOverview() {
    this.http
      .get<any>(`/api/order/manager/reports/overview?restaurantId=${this.restaurantId}`)
      .subscribe(res => this.overview = res);
  }

  loadSales() {
    if (!this.startDate || !this.endDate) return;

    this.http
      .get<any>(`/api/order/manager/reports/sales?restaurantId=${this.restaurantId}&startDate=${this.startDate}&endDate=${this.endDate}`)
      .subscribe(res => this.sales = res);
  }

  loadOrders() {
    this.http
      .get<any>(`/api/order/manager/reports/orders?restaurantId=${this.restaurantId}`)
      .subscribe(res => this.orders = res);
  }

  loadItems() {
    if (!this.startDate || !this.endDate) return;

    this.http
      .get<any[]>(`/api/order/manager/reports/items?restaurantId=${this.restaurantId}&startDate=${this.startDate}&endDate=${this.endDate}`)
      .subscribe(res => this.items = res);
  }

  loadCategories() {
    this.http
      .get<any[]>(`/api/order/manager/reports/categories?restaurantId=${this.restaurantId}`)
      .subscribe(res => this.categories = res);
  }
}
