import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { PendingPaymentsComponent } from '../pending-payments/pending-payments.component';  // ← import it!
import { NewOrderComponent } from '../new-order/new-order.component';
import { QRCodeComponent } from 'angularx-qrcode';


export enum OrderStatus {
  Pending   = "Pending",
  Confirmed = "Confirmed",
  Served    = "Served",
  Completed = "Completed",
  Cancelled = "Cancelled"
}
export enum KitchenStatus {
  Pending = "Pending",
  Preparing = "Preparing",
  Ready = "Ready"
  // Remove Served status
}
export interface OrderItem {
  productID:   number;
  productName?: string;
  quantity:    number;
}

export interface PaymentInfo {
  method: string;
  status: string;
  amount: number;
  paidAt?: Date | null;
}

export interface Order {
  orderID: number;
  userID?: number;
  orderStatus: OrderStatus;
  waiterUserID?: number;
  isAssigned?: boolean;
  tableNo?: number;
  items?: OrderItem[];
  createdAt?: Date;
  closedAt?: Date;
  latestPayment?: PaymentInfo;   // ✅ ADD THIS LINE
    kitchenStatus?: KitchenStatus;  // Add this line

}


export interface WaiterRequest {
  waiterRequestID: number;
  message:         string;
  tableNumber:     number;
  requestTime:     string;
    isAccepted?:     boolean; // <-- add this

}

@Component({
  selector: 'app-waiter',
    standalone: true, 
  templateUrl: './waiter.component.html',
  styleUrls: ['./waiter.component.css'],

  imports: [CommonModule, FormsModule, HttpClientModule, PendingPaymentsComponent,NewOrderComponent,QRCodeComponent],
})
export class WaiterComponent implements OnInit {
  orders: Order[] = [];
  historyOrders: Order[] = [];
  selectedOrder?: Order;
  waiterRequests: WaiterRequest[] = [];
  OrderStatus = OrderStatus;
readyNotifications: any[] = [];
readyOrderMessages: { notificationId: number; message: string; orderId: number; tableNo: number; timestamp: number }[] = [];
  KitchenStatus = KitchenStatus;   // ✅ ADD THIS LINE

  isSidebarOpen = false;
  selectedSection: 'orders' | 'requests' | 'history' | 'pendingPayments' | 'readyOrders' | 'newOrder' = 'orders';
 pendingPayments: any[] = [];
restaurantId: number = 0; // ✅ public + numeric

private newOrderSound = new Audio('assets/sounds/new-order.mp3');
private readyOrderSound = new Audio('assets/sounds/ready-order.mp3');
private paymentSound   = new Audio('assets/sounds/payment-pending.mp3');
activeAlerts: { type: 'order' | 'ready' | 'payment', message: string, timestamp: number }[] = [];

  viewMode: 'grid' | 'list' = 'grid';
  selectedStatus = 'all';
  statusFilters = ['all', 'pending', 'confirmed', 'served'];

// readyNotifications: any[] = [];
groupedUpcomingOrders: { tableNo: number; orders: Order[]; expanded: boolean }[] = [];
readyTables: { tableNo: number, orders: Order[] }[] = [];
selectedReadyTable: number | null = null;
upcomingOrdersSorted: Order[] = [];
lastSeenOrderID: number = Number(localStorage.getItem('lastSeenOrderID') || 0);
selectedTableNo: number | null = null;
historyFilter: 'today' | '2days' | 'all' = 'today';
allHistoryOrders: Order[] = [];  // full copy to preserve


selectedPayTab: 'verify' | 'collect' = 'verify';

verifyPayments: any[] = [];
collectPayments: any[] = [];

collectModal = {
  open: false,
  orderId: 0,
  paymentId: 0,
  amount: 0,
  upiUri: '',
  tab: 'UPI' as 'UPI' | 'CASH'
};

busyCollect = false;


unreadRequests: any[] = [];
private requestPollingInterval: any;
private notificationSound = new Audio('assets/sounds/notification.mp3');


private notificationCheckInterval: any;

private readonly API_BASE = `${environment.apiUrl}`;

  private httpOptions: { headers: HttpHeaders } = { headers: new HttpHeaders() };

  constructor(private http: HttpClient, private router: Router) {}
ngOnInit(): void {
  const token = localStorage.getItem('jwt');
  const raw = localStorage.getItem('restaurantId') || '';
    this.restaurantId = Number(raw) || 0;       // ✅

 if (!this.restaurantId) {
      alert('Restaurant ID not found. Please log in again.');
      return;
    }
  this.httpOptions = token
    ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    : { headers: new HttpHeaders() };

      // ✅ Safely parse lastSeenOrderID
  const saved = localStorage.getItem('lastSeenOrderID');
  this.lastSeenOrderID = saved && !isNaN(+saved) ? +saved : 0;


  this.getOrders();
  this.getWaiterRequests();
  this.checkForReadyNotifications();
  this.setupNotificationPolling();
  this.setupRequestPolling();
this.setupPendingPaymentPolling();
  this.fetchPendingPayments();    // ✅ THIS IS MISSING – ADD THIS!

  
setInterval(() => {
  if (this.selectedSection === 'history') {
    this.refreshHistoryOnly();
  }
}, 15000);




  // ✅ Auto-refresh every 10 seconds
  setInterval(() => this.getOrders(), 10000); // or 7000 ms
}

ngOnDestroy(): void {
  // Clear all intervals when component is destroyed
  if (this.notificationCheckInterval) {
    clearInterval(this.notificationCheckInterval);
  }
  
  if (this.requestPollingInterval) {
    clearInterval(this.requestPollingInterval);
  }
  
}

switchPayTab(tab: 'verify' | 'collect') {
  if (this.selectedPayTab === tab) return;
  this.selectedPayTab = tab;
  this.loadPendingByTab();
}

private loadPendingByTab(): void {
  // If your backend supports ?channel=Customer|Waiter, use the two fetch* methods below.
  // Otherwise, we’ll split on the client (fallback) using common fields.
  this.fetchPendingPayments();
}

private splitPending(payments: any[]) {
  // Try common fields first:
  // channel: 'Customer' | 'Waiter'  OR  source: 'customer' | 'waiter'  OR  createdBy: 'Customer' | 'Waiter'
  const isCustomer = (p: any) =>
    (p.channel && p.channel.toLowerCase() === 'customer') ||
    (p.source && p.source.toLowerCase() === 'customer') ||
    (p.createdBy && p.createdBy.toLowerCase() === 'customer') ||
    p.paymentChannel === 0; // if you used enum on backend

  this.verifyPayments  = payments.filter(isCustomer);
  this.collectPayments = payments.filter(p => !isCustomer(p));
}

selectTableForOrders(tableNo: number): void {
  this.selectedTableNo = tableNo;
}

private setupPendingPaymentPolling(): void {
  this.fetchPendingPayments(); // initial
  setInterval(() => this.fetchPendingPayments(), 10000);
}

navigateToNewOrder(): void {
  this.selectedSection = 'newOrder'; // ✅ no router nav
}

onNewOrderPlaced(e: { orderID: number }) {
  this.pushAlert('order', `🆕 New order #${e.orderID} created.`);
  // optional: this.getOrders();
}

onNewOrderClosed() {
  this.selectedSection = 'orders';
  this.getOrders(); // refresh list after closing
}



 private refreshHistoryOnly(): void {
    this.http.get<any>(`${this.API_BASE}/order/with-waiter?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: res => {
          const all = this.unwrapArray<any>(res.orders).map(o => ({
            orderID: o.orderID,
            tableNo: o.tableNo,
            orderStatus: this.mapOrderStatus(o.orderStatus),
            kitchenStatus: o.kitchenStatus ? this.mapKitchenStatus(o.kitchenStatus) : KitchenStatus.Pending,
            items: this.unwrapArray<any>(o.items).map(i => ({
              productID: i.productID,
              productName: i.productName,
              quantity: i.quantity
            })),
            createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
            closedAt: o.closedAt ? new Date(o.closedAt) : undefined,
            latestPayment: o.latestPayment ? {
              method: o.latestPayment.method,
              status: o.latestPayment.status,
              amount: o.latestPayment.amount,
              paidAt: o.latestPayment.paidAt ? new Date(o.latestPayment.paidAt) : null
            } : undefined
          }));

          this.allHistoryOrders = all.filter(o =>
            o.orderStatus === OrderStatus.Served ||
            o.orderStatus === OrderStatus.Completed ||
            o.orderStatus === OrderStatus.Cancelled
          );

          this.applyHistoryFilter();
        },
        error: err => console.error('Error refreshing history:', err)
      });
  }
updateReadyTables(): void {
  this.readyTables = this.groupByTable(this.readyToServeOrders);
}

selectTable(tableNo: number | null): void {
  this.selectedReadyTable = tableNo;
}

vibrate(pattern: number | number[] = [200]): void {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}


hasNewOrder(tableNo: number): boolean {
  const now = Date.now();
  return this.readyOrderMessages.some(m =>
    m.tableNo === tableNo && now - m.timestamp < 20000
  );
}



private setupRequestPolling(): void {
  this.requestPollingInterval = setInterval(() => {
    this.checkForNewRequests();
  }, 5000); // Check every 5 seconds
}

checkForNewRequests(): void {
    this.http.get<any[]>(`${this.API_BASE}/order/waiter/requests/unnotified?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: (requests) => {
          if (requests.length > 0) {
            this.notificationSound.play().catch(e => console.log('Audio playback failed:', e));
            this.unreadRequests = [...requests, ...this.unreadRequests];

            requests.forEach(request => {
              this.http.put(
                `${this.API_BASE}/order/waiter/requests/mark-notified/${request.waiterRequestID}`,
                null,
                this.httpOptions
              ).subscribe();
            });
          }
        },
        error: (err) => console.error('Error checking waiter requests:', err)
      });
  }

get selectedReadyOrders(): Order[] {
  if (this.selectedReadyTable === null) {
    return this.readyToServeOrders;
  }

  const table = this.readyTables.find(t => t.tableNo === this.selectedReadyTable);
  return table?.orders || [];
}





 // ✅ ADD THIS METHOD TO FIX THE ERROR
  clearAllNotifications() {
    this.http.delete('/api/WaiterRequest/clear-all').subscribe(() => {
      this.waiterRequests = [];
    });
  }

markPaymentPaid(paymentID: number | undefined): void {
  if (!paymentID) {
    console.error('Invalid paymentID: undefined');
    return;
  }

  this.http.put(`${this.API_BASE}/order/pending-payments/${paymentID}/clear`, null, this.httpOptions)
    .subscribe({
      next: (response: any) => {
        alert(response.message);
        this.pendingPayments = this.pendingPayments.filter(p => p.paymentID !== paymentID);  // ✅ FIXED HERE (was paymentId before)
      },
      error: (err) => {
        console.error('Failed to clear payment:', err);
        alert('Error clearing payment.');
      }
    });
}





setupNotificationPolling(): void {
  // Check for ready notifications every 30 seconds
  this.notificationCheckInterval = setInterval(() => {
    this.checkForReadyNotifications();
  }, 30000);
}

checkForReadyNotifications(): void {
    this.http.get<any[]>(`${this.API_BASE}/order/waiter/notifications?restaurantId=${this.restaurantId}`, this.httpOptions)
    .subscribe({
      next: (notifications) => {
        if (notifications.length > 0) {
          this.readyNotifications = notifications;

          notifications.forEach(n => {
const exists = this.readyOrderMessages.some(m => m.notificationId === n.notificationId);
            if (!exists) {
              const msg = `✅ Order #${n.orderId} for Table ${n.tableNo} is ready to serve.`;

              this.readyOrderSound.play().catch(() => {});
              this.vibrate();
              this.pushAlert('ready', msg);

              // Add to local ready messages
this.readyOrderMessages.push({
  notificationId: n.notificationId,
  message: msg,
  orderId: n.orderId,
  tableNo: n.tableNo,
  timestamp: Date.now()
});


                  this.acknowledgeNotification(n.notificationId);


              // Auto-dismiss ready message after 10s (UI purpose only)
setTimeout(() => {
  this.readyOrderMessages = this.readyOrderMessages.filter(m => m.notificationId !== n.notificationId);
}, 10000);

            }
          });
        } else {
          this.readyNotifications = []; // Auto-clear
        }
      },
      error: (err) => console.error('Error checking ready notifications:', err)
    });
}


showReadyOrderNotification(notifications: any[]): void {
  notifications.forEach(n => {
    const exists = this.readyOrderMessages.some(m => m.orderId === n.orderId);
    if (!exists) {
      const message = `Table ${n.tableNo} → Order ${n.orderId} is ready to serve!`;

      this.readyOrderMessages.push({
        notificationId: n.notificationId,
message: message,
        orderId: n.orderId,
        tableNo: n.tableNo,
        timestamp: Date.now()
      });

      this.newOrderSound.play().catch(e => console.log('Sound failed:', e));

      setTimeout(() => {
        this.readyOrderMessages = this.readyOrderMessages.filter(m => m.orderId !== n.orderId);
      }, 10000);
    }
  });
}





dismissReadyNotification(index: number): void {
  this.readyOrderMessages.splice(index, 1);
}

serveReadyOrder(orderId: number): void {
  this.http.put(`${this.API_BASE}/order/${orderId}/mark-served`, null, this.httpOptions)
    .subscribe({
      next: () => {
        this.readyNotifications = this.readyNotifications.filter(n => n.orderId !== orderId);
        this.readyOrderMessages = this.readyOrderMessages.filter(m => m.orderId !== orderId);
      },
      error: (err) => console.error('Error marking order served:', err)
    });
}

acknowledgeNotification(notificationId: number): void {
  this.http.put(
  `${this.API_BASE}/order/waiter/notifications/${notificationId}/acknowledge`,
    null,
    this.httpOptions
  ).subscribe({
    next: () => {
      this.readyNotifications = this.readyNotifications.filter(n => n.notificationId !== notificationId);
    },
    error: err => console.error('Error acknowledging notification:', err)
  });
}



  /** Helper to unwrap a JSON-NET wrapper or return the array directly */
  private unwrapArray<T>(maybeWrapped: any): T[] {
    if (Array.isArray(maybeWrapped)) {
      return maybeWrapped;
    }
    if (maybeWrapped?.$values && Array.isArray(maybeWrapped.$values)) {
      return maybeWrapped.$values;
    }
    return [];
  }

  checkForNewPendingPayments(): void {
    this.http.get<any[]>(`${this.API_BASE}/order/pending-payments/unnotified?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: (payments) => {
          if (payments.length > 0) {
            this.paymentSound.play().catch(() => {});
            this.vibrate();

            payments.forEach(p => {
              const msg = `💰 Payment pending for Table ${p.tableNo}, Order #${p.orderID}`;
              this.pushAlert('payment', msg);

              this.http.put(
                `${this.API_BASE}/order/pending-payments/${p.paymentID}/mark-notified`,
                null,
                this.httpOptions
              ).subscribe();
            });

            this.pendingPayments = [...payments, ...this.pendingPayments];
          }
        },
        error: err => console.error('Error checking pending payments:', err)
      });
  }
openCollectModal(p: any) {
  this.collectModal.open = true;
  this.collectModal.orderId = p.orderID;
  this.collectModal.amount = p.amount;
  this.collectModal.paymentId = p.paymentID || 0;
  this.collectModal.upiUri = '';
  this.collectModal.tab = 'UPI';
}

closeCollectModal() {
  this.collectModal.open = false;
  this.collectModal.upiUri = '';
  this.collectModal.paymentId = 0;
}

async initiateUpi() {
  this.busyCollect = true;
  try {
    const resp: any = await this.http.post(
      `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter`,
      {},
      this.httpOptions
    ).toPromise();
    this.collectModal.paymentId = resp?.paymentId || 0;
    this.collectModal.amount = +resp?.amount || this.collectModal.amount || 0;
    this.collectModal.upiUri = resp?.upiUri || '';
  } finally {
    this.busyCollect = false;
  }
}

async finalizeIfPaid() {
  if (!this.collectModal.paymentId) return;
  this.busyCollect = true;
  try {
    const s: any = await this.http.get(
      `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/status?restaurantId=${this.restaurantId}`,
      this.httpOptions
    ).toPromise();

    if (s?.status === 'Paid') {
      this.onPaymentCleared(this.collectModal.paymentId);
      this.closeCollectModal();
      window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill`, '_blank');
    } else {
      alert('Still pending. Ask customer to complete payment.');
    }
  } finally {
    this.busyCollect = false;
  }
}

async markCashReceived() {
  this.busyCollect = true;
  try {
    if (!this.collectModal.paymentId) {
      const started: any = await this.http.post(
        `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter&method=Cash`,
        {},
        this.httpOptions
      ).toPromise();
      this.collectModal.paymentId = started?.paymentId || 0;
    }

    await this.http.post(
      `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/cash-complete?restaurantId=${this.restaurantId}`,
      {},
      this.httpOptions
    ).toPromise();

    this.onPaymentCleared(this.collectModal.paymentId);
    this.closeCollectModal();
    window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill`, '_blank');
  } finally {
    this.busyCollect = false;
  }
}




onPaymentCleared(paymentId: number): void {
  this.pendingPayments = this.pendingPayments.filter(p => p.paymentID !== paymentId);
  this.verifyPayments  = this.verifyPayments.filter(p => p.paymentID !== paymentId);
  this.collectPayments = this.collectPayments.filter(p => p.paymentID !== paymentId);
  this.fetchPendingPayments();
}


fetchPendingPayments(): void {
  this.http.get<any[]>(`${this.API_BASE}/order/pending-payments?restaurantId=${this.restaurantId}`, this.httpOptions)
    .subscribe({
      next: (payments) => {
        this.pendingPayments = payments || [];
        this.splitPending(this.pendingPayments);
      },
      error: err => console.error('Error fetching pending payments:', err)
    });
}


  mapOrderStatus(status: any): OrderStatus {
    if (typeof status === 'number') {
      return [
        OrderStatus.Pending,
        OrderStatus.Confirmed,
        OrderStatus.Served,
        OrderStatus.Completed,
        OrderStatus.Cancelled
      ][status] ?? OrderStatus.Pending;
    }
    if (typeof status === 'string') {
      return (Object.values(OrderStatus).includes(status as OrderStatus)
        ? status
        : OrderStatus.Pending) as OrderStatus;
    }
    return OrderStatus.Pending;
  }

  getStatusCount(filter: string): number {
    return filter === 'all'
      ? this.orders.length
      : this.orders.filter(o => o.orderStatus.toLowerCase() === filter).length;
  }

  get filteredOrders(): Order[] {
    return this.orders.filter(o =>
      this.selectedStatus === 'all' ||
      o.orderStatus.toLowerCase() === this.selectedStatus
    );
  }


  getAvailableActions(order: Order): string[] {
    const actions: Record<OrderStatus, string[]> = {
      [OrderStatus.Pending]:   ['confirm','cancel'],
      [OrderStatus.Confirmed]: ['serve','cancel'],
      [OrderStatus.Served]:    ['complete'],
      [OrderStatus.Completed]: [],
      [OrderStatus.Cancelled]: []
    };
    return actions[order.orderStatus] || [];
  }

  isOrderUrgent(order: Order): boolean {
    if (!order.createdAt) return false;
    return order.orderStatus === OrderStatus.Pending &&
           (Date.now() - order.createdAt.getTime()) > 15 * 60_000;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  get groupedOrdersByTable(): { tableNo: number; orders: Order[] }[] {
    const map: Record<number, Order[]> = {};
    this.filteredOrders.forEach(o => {
      if (o.tableNo != null) {
        (map[o.tableNo] = map[o.tableNo] || []).push(o);
      }
    });
    return Object.entries(map).map(([table, orders]) => ({
      tableNo: +table,
      orders
    }));
  }

  pushAlert(type: 'order' | 'ready' | 'payment', message: string): void {
  const now = Date.now();

  // Avoid duplicates
  if (this.activeAlerts.some(a => a.message === message)) return;

  this.activeAlerts.push({ type, message, timestamp: now });

  setTimeout(() => {
    this.activeAlerts = this.activeAlerts.filter(a => a.timestamp !== now);
  }, 20000); // auto-dismiss after 20s
}


  private getOrders(): void {
    this.http.get<any>(`${this.API_BASE}/order/with-waiter?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: res => {
          const all = this.unwrapArray<any>(res.orders).map(o => ({
            orderID: o.orderID,
            tableNo: o.tableNo,
            orderStatus: this.mapOrderStatus(o.orderStatus),
            kitchenStatus: o.kitchenStatus ? this.mapKitchenStatus(o.kitchenStatus) : KitchenStatus.Pending,
            items: this.unwrapArray<any>(o.items).map(i => ({
              productID: i.productID,
              productName: i.productName,
              quantity: i.quantity
            })),
            createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
            closedAt: o.closedAt ? new Date(o.closedAt) : undefined,
            latestPayment: o.latestPayment ? {
              method: o.latestPayment.method,
              status: o.latestPayment.status,
              amount: o.latestPayment.amount,
              paidAt: o.latestPayment.paidAt ? new Date(o.latestPayment.paidAt) : null
            } : undefined
          }));

          this.orders = all.filter(o =>
            o.orderStatus === OrderStatus.Pending || o.orderStatus === OrderStatus.Confirmed
          );

          this.groupedUpcomingOrders = this.groupOrdersByTable(this.upcomingOrders);
          if (!this.selectedTableNo && this.groupedUpcomingOrders.length > 0) {
            this.selectedTableNo = this.groupedUpcomingOrders[0].tableNo;
          }

          const newOrders = this.orders.filter(o =>
            (o.orderStatus === OrderStatus.Pending || o.orderStatus === OrderStatus.Confirmed) &&
            o.orderID > this.lastSeenOrderID
          );

          newOrders.forEach(o => {
            this.pushAlert('order', `🆕 New order #${o.orderID} from Table ${o.tableNo} placed.`);
          });

          if (newOrders.length > 0) {
            this.newOrderSound.play().catch(() => {});
            this.vibrate();
            this.lastSeenOrderID = Math.max(...newOrders.map(o => o.orderID), this.lastSeenOrderID);
            localStorage.setItem('lastSeenOrderID', this.lastSeenOrderID.toString());
          }

          this.allHistoryOrders = all.filter(o =>
            o.orderStatus === OrderStatus.Served ||
            o.orderStatus === OrderStatus.Completed ||
            o.orderStatus === OrderStatus.Cancelled
          );
          this.applyHistoryFilter();

          this.updateReadyTables();
          this.upcomingOrdersSorted = this.upcomingOrders
            .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
        },
        error: err => console.error('Error fetching orders:', err)
      });
  }
applyHistoryFilter(): void {
  const now = new Date();

  if (this.historyFilter === 'all') {
    this.historyOrders = this.allHistoryOrders;
  } else if (this.historyFilter === '2days') {
    const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    this.historyOrders = this.allHistoryOrders.filter(o =>
      o.closedAt && new Date(o.closedAt) >= cutoff
    );
  } else if (this.historyFilter === 'today') {
    const today = now.toDateString();
    this.historyOrders = this.allHistoryOrders.filter(o =>
      o.closedAt && new Date(o.closedAt).toDateString() === today
    );
  }
}

toggleTableGroup(tableGroup: any): void {
  tableGroup.expanded = !tableGroup.expanded;
}



// Add this new helper method
private mapKitchenStatus(status: any): KitchenStatus {
  if (typeof status === 'number') {
    return [
      KitchenStatus.Pending,
      KitchenStatus.Preparing,
      KitchenStatus.Ready,
    
    ][status] ?? KitchenStatus.Pending;
  }
  if (typeof status === 'string') {
    return (Object.values(KitchenStatus).includes(status as KitchenStatus)
      ? status
      : KitchenStatus.Pending) as KitchenStatus;
  }
  return KitchenStatus.Pending;
}

groupOrdersByTable(orders: Order[]): { tableNo: number; orders: Order[]; expanded: boolean }[] {
  const map: Record<number, Order[]> = {};
  orders.forEach(o => {
    if (o.tableNo != null) {
      if (!map[o.tableNo]) map[o.tableNo] = [];
      map[o.tableNo].push(o);
    }
  });

  return Object.entries(map).map(([tableNo, orders]) => ({
    tableNo: +tableNo,
    orders,
    expanded: false
  }));
}

  getWaiterRequests(): void {
    this.http.get<{ data: WaiterRequest[] }>(
      `${this.API_BASE}/order/waiter-requests?restaurantId=${this.restaurantId}`, this.httpOptions
    ).subscribe({
      next: res => this.waiterRequests = res.data,
      error: err => console.error('Error fetching waiter requests:', err)
    });
  }


  getOrderCount(status: OrderStatus): number {
  return this.orders.filter(o => o.orderStatus === status).length;
}

get upcomingOrders(): Order[] {
  return this.orders.filter(o =>
    o.orderStatus === OrderStatus.Pending || o.orderStatus === OrderStatus.Confirmed
  );
}


// In your waiter.component.ts
get readyToServeOrders(): Order[] {
  return this.orders.filter(o => 
    o.orderStatus === OrderStatus.Confirmed &&
    o.kitchenStatus === KitchenStatus.Ready
  );
}


groupByTable(orders: Order[]): { tableNo: number; orders: Order[]; expanded: boolean }[] {
  const map: Record<number, Order[]> = {};
  orders.forEach(o => {
    if (o.tableNo != null) {
      if (!map[o.tableNo]) map[o.tableNo] = [];
      map[o.tableNo].push(o);
    }
  });

  return Object.entries(map).map(([tableNo, orders]) => ({
    tableNo: +tableNo,
    orders,
    expanded: false  // ✅ Add this
  }));
}



acceptRequest(requestId: number): void {
  this.http.put(
    `${this.API_BASE}/order/waiter-requests/${requestId}/accept`,
    null,
    this.httpOptions
  ).subscribe({
    next: () => {
      const accepted = this.unreadRequests.find(r => r.waiterRequestID === requestId);

      // Remove from unread list
      this.unreadRequests = this.unreadRequests.filter(r => r.waiterRequestID !== requestId);

      // Add to waiterRequests with accepted flag
      if (accepted && !this.waiterRequests.some(r => r.waiterRequestID === requestId)) {
        this.waiterRequests.push({ ...accepted, isAccepted: true });
      }

      // If already exists, update isAccepted flag
      const index = this.waiterRequests.findIndex(r => r.waiterRequestID === requestId);
      if (index !== -1) {
        this.waiterRequests[index].isAccepted = true;
      }
    },
    error: err => console.error('Error accepting request:', err)
  });
}



completeRequest(requestId: number): void {
  this.http.delete(
    `${this.API_BASE}/order/waiter-requests/${requestId}`,
    this.httpOptions
  ).subscribe({
    next: () => {
      // Remove from the displayed list
      this.waiterRequests = this.waiterRequests.filter(req => req.waiterRequestID !== requestId);
    },
    error: err => console.error('Error completing request:', err)
  });
}
  getElapsedTime(dt?: Date): string {
    if (!dt) return '';
    const mins = Math.floor((Date.now() - dt.getTime()) / 60000);
    return mins < 60 ? `${mins} min ago` : `${Math.floor(mins/60)}h ${mins%60}m ago`;
  }

  // handleOrderAction(orderID: number, action: string): void {
  //   const map: Record<string, () => void> = {
  //     confirm:  () => this.confirmOrder(orderID),
  //     serve:    () => this.serveOrder(orderID),
  //     complete: () => this.completeOrder(orderID),
  //     cancel:   () => this.cancelOrder(orderID)
  //   };
  //   (map[action] || (() => {}))();
  // }


serveOrder(orderID: number): void {
this.http.put(`${this.API_BASE}/Order/${orderID}/serve?restaurantId=${this.restaurantId}`, null, this.httpOptions)
    .subscribe({
      next: () => {
        // Update local state
        this.orders = this.orders.map(order => 
          order.orderID === orderID 
            ? { ...order, orderStatus: OrderStatus.Served }
            : order
        );
      },
      error: err => console.error('Error serving order:', err)
    });
}

}   
 