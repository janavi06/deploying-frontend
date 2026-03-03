import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { CustomizationModalComponent } from '../customization-modal/customization-modal.component';

@Component({
  selector: 'app-takeaway',
  standalone: true,
  imports: [CommonModule, MatDialogModule, FormsModule],
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

  /* ================= PAYMENT STATE ================= */

  showPaymentModal = false;
  selectedOrder: any = null;

  paymentMode: 'Cash' | 'UPI' | 'Partial' = 'Cash';

  partialCashAmount: number = 0;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog
  ) {}

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

  /* ================= PAYMENT FLOW ================= */

  openTakeawayPayment(order: any) {
    this.selectedOrder = order;
    this.paymentMode = 'Cash';
    this.partialCashAmount = 0;
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedOrder = null;
  }

  confirmTakeawayPayment() {

    if (!this.selectedOrder) return;

    const remaining = this.selectedOrder.remainingAmount;

    /* ================= FULL CASH ================= */
    if (this.paymentMode === 'Cash') {
      this.processPayment('Cash', remaining);
      return;
    }

    /* ================= FULL UPI ================= */
    if (this.paymentMode === 'UPI') {
      this.processPayment('UPI', remaining);
      return;
    }

    /* ================= PARTIAL ================= */
    if (this.paymentMode === 'Partial') {

      if (this.partialCashAmount <= 0 || this.partialCashAmount >= remaining) {
        return;
      }

      const upiAmount = remaining - this.partialCashAmount;

      // 1️⃣ Cash Payment
      this.http.put(
        `${this.API}/order/${this.selectedOrder.orderID}/takeaway/pay-and-serve?restaurantId=${this.restaurantId}`,
        { method: 'Cash', amount: this.partialCashAmount }
      ).subscribe({
        next: () => {

          // 2️⃣ UPI Payment
          this.http.put(
            `${this.API}/order/${this.selectedOrder.orderID}/takeaway/pay-and-serve?restaurantId=${this.restaurantId}`,
            { method: 'UPI', amount: upiAmount }
          ).subscribe({
            next: () => {
              this.closePaymentModal();
              this.loadTakeawayOrders();
            }
          });

        }
      });
    }
  }

  processPayment(method: string, amount: number) {
    this.http.put(
      `${this.API}/order/${this.selectedOrder.orderID}/takeaway/pay-and-serve?restaurantId=${this.restaurantId}`,
      { method, amount }
    ).subscribe({
      next: () => {
        this.closePaymentModal();
        this.loadTakeawayOrders();
      }
    });
  }

  /* ================= CREATE ================= */

  startNewOrder(): void {
    this.mode = 'create';
    this.cart = [];
    this.loadProducts();
  }

  cancelCreate(): void {
    this.mode = 'list';
  }

  loadProducts(): void {
    this.http.get<any[]>(
      `${this.API}/product?restaurantId=${this.restaurantId}`
    ).subscribe(res => {
      this.products = res || [];
    });
  }

  /* ================= CUSTOMIZATION ================= */

  openProductCustomization(product: any): void {

    if (!product.customizationOptions || product.customizationOptions.length === 0) {
      this.addToCart(product, []);
      return;
    }

    const dialogRef = this.dialog.open(CustomizationModalComponent, {
      width: '420px',
      data: { product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const selectedId = result.customizationOptionID;
      const customizationIds = selectedId ? [selectedId] : [];

      this.addToCart(product, customizationIds);
    });
  }

  /* ================= CART ================= */

  addToCart(product: any, customizationIds: number[]): void {

    const customizationPrice = product.customizationOptions
      ? product.customizationOptions
          .filter((c: any) =>
            customizationIds.includes(c.customizationOptionID))
          .reduce((sum: number, c: any) => sum + c.fixedPrice, 0)
      : 0;

    const unitPrice = product.price + customizationPrice;

    const existing = this.cart.find(x =>
      x.productID === product.productID &&
      JSON.stringify(x.customizationOptionIds) === JSON.stringify(customizationIds)
    );

    if (existing) {
      existing.quantity++;
      existing.total = existing.quantity * existing.unitPrice;
    } else {
      this.cart.push({
        productID: product.productID,
        productName: product.productName,
        unitPrice: unitPrice,
        quantity: 1,
        total: unitPrice,
        customizationOptionIds: customizationIds
      });
    }
  }

  getItemQuantity(productId: number): number {
    return this.cart
      .filter(x => x.productID === productId)
      .reduce((sum, x) => sum + x.quantity, 0);
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, item) => sum + item.total, 0);
  }

  /* ================= PLACE ORDER ================= */

  placeOrder(): void {

    const payload = {
      orderItems: this.cart.map(item => ({
        productID: item.productID,
        quantity: item.quantity,
        customizationOptionIds: item.customizationOptionIds
      }))
    };

    this.http.post<any>(
      `${this.API}/order/generate?restaurantId=${this.restaurantId}&source=takeaway`,
      payload
    ).subscribe({
      next: () => {
        this.mode = 'list';
        this.loadTakeawayOrders();
      }
    });
  }

  /* ================= UI ================= */

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