import { Component, Input, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-takeaway',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './takeaway.component.html',
  styleUrls: ['./takeaway.component.css']
})
export class TakeawayComponent implements OnInit {

  @Input() restaurantId!: number;

  private API = environment.apiUrl;

  mode: 'list' | 'create' = 'list';

  orders: any[] = [];
  products: any[] = [];
  cart: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTakeawayOrders();
  }

  /* ================= LIST ================= */

  loadTakeawayOrders(): void {
    this.http.get<any>(
      `${this.API}/order/takeaway?restaurantId=${this.restaurantId}`
    ).subscribe(res => {
      this.orders = res.orders || [];
    });
  }

  startNewOrder(): void {
    this.mode = 'create';
    this.cart = [];
    this.loadProducts();
  }

  cancelCreate(): void {
    this.mode = 'list';
  }

  /* ================= PRODUCTS ================= */

  loadProducts(): void {
    this.http.get<any[]>(
      `${this.API}/product?restaurantId=${this.restaurantId}`
    ).subscribe(res => {
      this.products = res || [];
    });
  }
markDone(orderId: number): void {

  this.http.put(
    `${this.API}/order/${orderId}/complete?restaurantId=${this.restaurantId}`,
    {}
  ).subscribe({
    next: () => {
      this.loadTakeawayOrders(); // refresh list
    },
    error: (err) => console.error('Complete failed', err)
  });

}

  addToCart(product: any): void {
    const existing = this.cart.find(x => x.productID === product.productID);

    if (existing) {
      existing.quantity++;
      existing.total = existing.quantity * existing.price;
    } else {
      this.cart.push({
        productID: product.productID,
        productName: product.productName,
        price: product.price,
        quantity: 1,
        total: product.price
      });
    }
  }
getItemQuantity(productId: number): number {
  const item = this.cart.find(x => x.productID === productId);
  return item ? item.quantity : 0;
}

  getCartTotal(): number {
    return this.cart.reduce((sum, item) => sum + item.total, 0);
  }

  /* ================= PLACE ORDER ================= */

  placeOrder(): void {

    const payload = {
      orderItems: this.cart.map(item => ({
        productID: item.productID,
        quantity: item.quantity
      }))
    };

    this.http.post<any>(
      `${this.API}/order/generate?restaurantId=${this.restaurantId}&source=takeaway`,
      payload
    ).subscribe({
      next: () => {
        this.mode = 'list';
        this.loadTakeawayOrders();
      },
      error: (err) => console.error('Order creation failed', err)
    });
  }

  /* ================= UI HELPERS ================= */

  getStatusBadge(status: string): string {
    const map: any = {
      Pending: 'bg-secondary',
      Confirmed: 'bg-primary',
      Served: 'bg-info',
      Completed: 'bg-success',
      Cancelled: 'bg-danger'
    };
    return map[status] || 'bg-light text-dark';
  }
}
