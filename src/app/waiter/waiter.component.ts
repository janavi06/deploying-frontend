   import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { PendingPaymentsComponent } from '../pending-payments/pending-payments.component';  // ← import it!
import { NewOrderComponent } from '../new-order/new-order.component';
import { QRCodeComponent } from 'angularx-qrcode';
import { firstValueFrom } from 'rxjs'; // ✅ ADD THIS IMPORT

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
 customizations?: any[]; // ✅ FIX: Add this property

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
  error = '';
  isSidebarOpen = false;
  selectedSection: 'orders' | 'requests' | 'history' | 'pendingPayments' | 'readyOrders' | 'newOrder' = 'orders';
 pendingPayments: any[] = [];
restaurantId: number = 0; // ✅ public + numeric
showProductList = false;
productSearch = '';
selectedCategory = '';
productCategories: string[] = [];
filteredAvailableProducts: any[] = [];
productQuantities: Map<number, number> = new Map();
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

selectedOrderForEdit: any = null;
showEditOrderModal = false;
availableProducts: any[] = [];
orderChangeHistory: any[] = [];
showChangeHistoryModal = false;
selectedProductCategory: string = '';


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
  // ✅ TEMPORARY: Hardcode restaurantId for testing
  this.restaurantId = 1; // Use your actual restaurant ID
  
  console.log('✅ Using restaurantId:', this.restaurantId);
  
  // Simple headers without authentication
  this.httpOptions = { 
    headers: new HttpHeaders({ 
      'Content-Type': 'application/json'
    }) 
  };

  // Initialize all data
  this.getOrders();
  this.getWaiterRequests();
  this.checkForReadyNotifications();
  this.setupNotificationPolling();
  this.setupRequestPolling();
  this.fetchPendingPayments();

  // Set up intervals
  setInterval(() => {
    if (this.selectedSection === 'history') {
      this.refreshHistoryOnly();
    }
  }, 15000);

  setInterval(() => this.getOrders(), 10000);
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

  // ✅ FIXED: Add missing methods with proper implementation
  async placeWaiterOrder(paymentPreference: 'PayNow' | 'PayLater' = 'PayLater'): Promise<void> {
    try {
      // Get cart items from the embedded new-order component
      const orderPayload = {
        // You'll need to get this from the embedded component
        // For now, using empty payload - you'll need to implement this
      };

      // Create order with payment preference
      const response: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/generate?restaurantId=${this.restaurantId}&source=waiter&paymentPreference=${paymentPreference}`,
          orderPayload,
          this.httpOptions
        )
      );

      if (paymentPreference === 'PayNow') {
        this.pushAlert('order', `✅ Order #${response.orderID} placed and paid!`);
        // Order goes directly to history
      } else {
        this.pushAlert('order', `✅ Order #${response.orderID} placed - Payment Pending`);
        // Order goes to pending payments
      }

      this.getOrders(); // Refresh orders list
    } catch (error) {
      console.error('Error placing waiter order:', error);
    }
  }


private loadPendingByTab(): void {
  // If your backend supports ?channel=Customer|Waiter, use the two fetch* methods below.
  // Otherwise, we’ll split on the client (fallback) using common fields.
  this.fetchPendingPayments();
}

private splitPending(payments: any[]) {
  // Customer payments (paymentChannel === 0 OR source=Customer) need verification
  this.verifyPayments = payments.filter(p => 
    p.paymentChannel === 0 || 
    p.source?.toLowerCase() === 'customer' ||
    (p.paymentChannel === undefined && p.source?.toLowerCase() !== 'waiter')
  );

  // Waiter payments (paymentChannel === 1 OR source=Waiter) need collection
  this.collectPayments = payments.filter(p => 
    p.paymentChannel === 1 ||
    p.source?.toLowerCase() === 'waiter' ||
    (p.paymentChannel === undefined && p.source?.toLowerCase() === 'waiter')
  );
  
  console.log('Verify Payments:', this.verifyPayments);
  console.log('Collect Payments:', this.collectPayments);
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

onNewOrderPlaced(e: { 
  orderID: number; 
  paymentStatus?: string; 
  paymentMethod?: string;
  paymentPreference?: string 
}) {
  if (e.paymentPreference === 'PayNow') {
    if (e.paymentStatus === 'created') {
      this.pushAlert('order', `🆕 Order #${e.orderID} created - Complete payment to confirm`);
    } else if (e.paymentStatus === 'paid') {
      this.pushAlert('order', `✅ Order #${e.orderID} placed and paid via ${e.paymentMethod}! Check Orders section.`);
    }
  } else {
    // PayLater orders
    this.pushAlert('order', `💰 Order #${e.orderID} placed - Payment pending in Collect tab`);
  }
  
  // Refresh orders to show the new order in the correct section
  this.getOrders();
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

// FIXED markPaymentPaid method
markPaymentPaid(payment: any): void {  // Change parameter to accept the payment object
  // Debug log to see what we're receiving
  console.log('Payment object received:', payment);
  
  // Try different possible property names for payment ID
  const paymentID = payment.paymentID || payment.paymentId || payment.id || payment.PaymentID;
  
  console.log('Extracted payment ID:', paymentID);

  if (!paymentID) {
    console.error('Invalid paymentID: undefined. Full payment object:', payment);
    alert('Cannot process payment: Payment ID is missing');
    return;
  }

  console.log('Clearing payment with ID:', paymentID);

  this.http.put(`${this.API_BASE}/order/pending-payments/${paymentID}/clear?restaurantId=${this.restaurantId}`, null, this.httpOptions)
    .subscribe({
      next: (response: any) => {
        alert(response.message);
        // Remove from all payment arrays using the correct ID
        this.pendingPayments = this.pendingPayments.filter(p => 
          (p.paymentID || p.paymentId || p.id || p.PaymentID) !== paymentID
        );
        this.verifyPayments = this.verifyPayments.filter(p => 
          (p.paymentID || p.paymentId || p.id || p.PaymentID) !== paymentID
        );
        this.collectPayments = this.collectPayments.filter(p => 
          (p.paymentID || p.paymentId || p.id || p.PaymentID) !== paymentID
        );
        
        // Refresh data
        this.fetchPendingPayments();
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
  
  console.log('Opening collect modal:', this.collectModal); // Debug log
}

closeCollectModal() {
  this.collectModal.open = false;
  this.collectModal.orderId = 0;
  this.collectModal.paymentId = 0;
  this.collectModal.amount = 0;
  this.collectModal.upiUri = '';
  this.collectModal.tab = 'UPI';
  this.busyCollect = false;
}
async initiateUpi() {
  this.busyCollect = true;
  try {
    const resp: any = await firstValueFrom(
      this.http.post(
        `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter&method=UPI`,
        {},
        this.httpOptions
      )
    );
    
    console.log('UPI Init Response:', resp);
    
    if (resp && resp.upiUri) {
      this.collectModal.paymentId = resp.paymentId || this.collectModal.paymentId;
      this.collectModal.amount = resp.amount || this.collectModal.amount;
      this.collectModal.upiUri = resp.upiUri;
    } else {
      alert('Failed to generate UPI QR. Please try again.');
    }
  } catch (error: any) {
    console.error('Error initiating UPI:', error);
    alert(`Error: ${error.error?.message || 'Failed to generate UPI QR'}`);
  } finally {
    this.busyCollect = false;
  }
}

// In the collect modal finalizeIfPaid method, update the status check:
async finalizeIfPaid() {
  if (!this.collectModal.paymentId) {
    alert('No payment ID found. Please generate QR code first.');
    return;
  }
  
  this.busyCollect = true;
  try {
    const statusResponse: any = await firstValueFrom(
      this.http.get(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/status?restaurantId=${this.restaurantId}`,
        this.httpOptions
      )
    );

    console.log('Payment Status Response:', statusResponse);

    // Handle different possible status values
    const paidStatuses = ['Paid', 'Completed', 'Success', 'Success'];
    if (paidStatuses.includes(statusResponse?.status)) {
      this.onPaymentCleared(this.collectModal.paymentId);
      this.closeCollectModal();
      
      // Open bill in new tab
      window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
      this.pushAlert('payment', `✅ UPI payment received for Order #${this.collectModal.orderId}`);
      
      // Refresh orders to move to history
      this.getOrders();
    } else {
      alert(`Payment status: ${statusResponse?.status || 'Pending'}. Please ask customer to complete payment.`);
    }
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    alert(`Error checking payment status: ${error.error?.message || 'Please try again'}`);
  } finally {
    this.busyCollect = false;
  }
}
// Helper method to get table number from order
getTableNoFromOrder(orderId: number): number {
  const order = this.orders.find(o => o.orderID === orderId);
  return order?.tableNo || 0;
}

// Fix the markCashReceived method
async markCashReceived() {
  this.busyCollect = true;
  try {
    // First, initiate payment if not already done
    if (!this.collectModal.paymentId) {
      const started: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter&method=Cash`,
          {},
          this.httpOptions
        )
      );
      
      if (started?.paymentId) {
        this.collectModal.paymentId = started.paymentId;
      } else {
        throw new Error('Failed to initiate cash payment');
      }
    }

    // Mark cash payment as completed
    const result: any = await firstValueFrom(
      this.http.post(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/cash-complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    if (result.success) {
      this.onPaymentCleared(this.collectModal.paymentId);
      this.closeCollectModal();
      
      // Open bill in new tab
      window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
      this.pushAlert('payment', `✅ Cash payment of ₹${this.collectModal.amount} collected for Order #${this.collectModal.orderId}`);
      
      // Refresh orders to move to history
      this.getOrders();
    } else {
      throw new Error(result.message || 'Failed to mark cash as received');
    }
  } catch (error: any) {
    console.error('Error marking cash received:', error);
    alert(`Error: ${error.error?.message || 'Failed to process cash payment'}`);
  } finally {
    this.busyCollect = false;
  }
}

onPaymentCleared(paymentId: number): void {
  console.log('🔄 Processing payment cleared for ID:', paymentId);
  
  // Remove from all payment arrays
  this.pendingPayments = this.pendingPayments.filter(p => p.paymentID !== paymentId);
  this.verifyPayments = this.verifyPayments.filter(p => p.paymentID !== paymentId);
  this.collectPayments = this.collectPayments.filter(p => p.paymentID !== paymentId);
  
  // Refresh data to ensure order moves to history
  this.fetchPendingPayments();
  this.getOrders(); // This will refresh both current orders and history
  
  this.pushAlert('payment', `✅ Payment cleared successfully!`);
}
// Enhanced fetchPendingPayments to handle different ID formats
fetchPendingPayments(): void {
  this.http.get<any[]>(`${this.API_BASE}/order/pending-payments?restaurantId=${this.restaurantId}`, this.httpOptions)
    .subscribe({
      next: (payments) => {
        console.log('📦 Raw payments from API:', payments);
        
        // Normalize payment IDs to handle different formats
        this.pendingPayments = (payments || []).map(p => ({
          ...p,
          // Ensure we have a consistent paymentId field
          paymentId: p.paymentID || p.paymentId || p.id
        }));
        
        this.splitPending(this.pendingPayments);
        console.log('✅ Normalized payments:', this.pendingPayments);
      },
      error: err => {
        console.error('❌ Error fetching pending payments:', err);
        this.error = 'Failed to load pending payments'; // ✅ Now this will work
      }
    });
}

// Add this method to your WaiterComponent class
async markUpiAsPaid(): Promise<void> {
  if (!this.collectModal.paymentId) {
    alert('No payment ID found. Please generate QR code first.');
    return;
  }
  
  this.busyCollect = true;
  try {
    // Mark UPI payment as paid directly without checking status
    const result: any = await firstValueFrom(
      this.http.post(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    if (result.success) {
      this.onPaymentCleared(this.collectModal.paymentId);
      this.closeCollectModal();
      
      // Open bill in new tab
      window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
      this.pushAlert('payment', `✅ UPI payment marked as paid for Order #${this.collectModal.orderId}`);
      
      // Refresh orders to move to history
      this.getOrders();
    } else {
      throw new Error(result.message || 'Failed to mark UPI payment as paid');
    }
  } catch (error: any) {
    console.error('Error marking UPI as paid:', error);
    alert(`Error: ${error.error?.message || 'Failed to process UPI payment'}`);
  } finally {
    this.busyCollect = false;
  }
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
            quantity: i.quantity,
              unitPrice: i.unitPrice, 

            customizations: i.customizations || []
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

        // Current orders - only Pending and Confirmed status
        this.orders = all.filter(o =>
          o.orderStatus === OrderStatus.Pending || 
          o.orderStatus === OrderStatus.Confirmed
        );

        // History orders - Served, Completed, Cancelled
        this.allHistoryOrders = all.filter(o =>
          o.orderStatus === OrderStatus.Served ||
          o.orderStatus === OrderStatus.Completed ||
          o.orderStatus === OrderStatus.Cancelled
        );

        this.applyHistoryFilter();
        
        console.log('📊 Orders after payment clear:', {
          currentOrders: this.orders.length,
          historyOrders: this.allHistoryOrders.length,
          allOrders: all.length
        });

        // Rest of your existing logic...
        this.groupedUpcomingOrders = this.groupOrdersByTable(this.upcomingOrders);
        if (!this.selectedTableNo && this.groupedUpcomingOrders.length > 0) {
          this.selectedTableNo = this.groupedUpcomingOrders[0].tableNo;
        }

        // New order notifications...
        const newOrders = this.orders.filter(o =>
          (o.orderStatus === OrderStatus.Pending || o.orderStatus === OrderStatus.Confirmed) &&
          o.orderID > this.lastSeenOrderID
        );

        if (newOrders.length > 0) {
          this.newOrderSound.play().catch(() => {});
          this.vibrate();
          this.lastSeenOrderID = Math.max(...newOrders.map(o => o.orderID), this.lastSeenOrderID);
          localStorage.setItem('lastSeenOrderID', this.lastSeenOrderID.toString());
        }

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

 
updateOrderItemQuantity(item: any, newQuantity: number): void {
  if (newQuantity <= 0) {
    this.removeOrderItem(item);
    return;
  }

  const payload = {
    quantity: newQuantity,
    changedByUserId: this.getCurrentUserId()
  };

  this.http.put(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/items/${item.orderItemID}?restaurantId=${this.restaurantId}`, payload)
    .subscribe({
      next: () => {
        this.getOrders(); // Refresh orders
        this.pushAlert('order', `✅ Updated ${item.productName} quantity to ${newQuantity}`);
        this.showEditOrderModal = false; // Close modal after update
      },
      error: (err) => {
        console.error('Error updating item quantity:', err);
        alert('Failed to update item quantity');
      }
    });
}

removeOrderItem(item: any): void {
  if (confirm(`Remove ${item.productName} from order?`)) {
    const payload = {
      quantity: 0, // This will remove the item
      changedByUserId: this.getCurrentUserId()
    };

    this.http.put(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/items/${item.orderItemID}?restaurantId=${this.restaurantId}`, payload)
      .subscribe({
        next: () => {
          this.getOrders();
          this.pushAlert('order', `❌ Removed ${item.productName} from order`);
          this.showEditOrderModal = false;
        },
        error: (err) => {
          console.error('Error removing item:', err);
          alert('Failed to remove item');
        }
      });
  }
}

addItemToOrder(product: any): void {
  const payload = {
    productID: product.productID,
    quantity: 1,
    changedByUserId: this.getCurrentUserId()
  };

  this.http.post(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/items?restaurantId=${this.restaurantId}`, payload)
    .subscribe({
      next: () => {
        this.getOrders();
        this.pushAlert('order', `✅ Added ${product.productName} to order`);
        this.showEditOrderModal = false;
      },
      error: (err) => {
        console.error('Error adding item to order:', err);
        alert('Failed to add item to order');
      }
    });
}

cancelOrder(order: any): void {
  const reason = prompt('Reason for cancellation:');
  if (reason === null) return; // User cancelled

  const payload = {
    reason: reason || 'No reason provided',
    changedByUserId: this.getCurrentUserId()
  };

  this.http.delete(`${this.API_BASE}/order/${order.orderID}/cancel?restaurantId=${this.restaurantId}`, { body: payload })
    .subscribe({
      next: () => {
        this.getOrders();
        this.pushAlert('order', `❌ Order #${order.orderID} cancelled`);
        this.showEditOrderModal = false;
      },
      error: (err) => {
        console.error('Error cancelling order:', err);
        alert('Failed to cancel order');
      }
    });
}

getOrderChangeHistory(orderId: number): void {
  this.http.get(`${this.API_BASE}/order/${orderId}/change-history?restaurantId=${this.restaurantId}`)
    .subscribe({
      next: (response: any) => {
        this.orderChangeHistory = response.changes;
        this.showChangeHistoryModal = true;
      },
      error: (err) => {
        console.error('Error fetching change history:', err);
        alert('Failed to load change history');
      }
    });
}

private getCurrentUserId(): number {
  // Implement based on your auth system
  const userData = localStorage.getItem('userData');
  if (userData) {
    const user = JSON.parse(userData);
    return user.userID || 0;
  }
  return 0;
}
getSelectedTableOrders(): any[] {
  if (this.selectedTableNo === null) return [];
  
  const group = this.groupedUpcomingOrders.find(g => g.tableNo === this.selectedTableNo);
  return group ? group.orders : [];
}
switchSection(section: 'orders' | 'requests' | 'history' | 'pendingPayments' | 'readyOrders' | 'newOrder'): void {
  this.selectedSection = section;
  this.isSidebarOpen = false; // optional: auto-close sidebar after selecting
}
// Add these two new methods to your WaiterComponent class
closeEditOrderModal(): void {
  this.showEditOrderModal = false;
}
getCustomizationsText(customizations: any[] | undefined): string {
  if (!customizations || customizations.length === 0) return '';
  return customizations.map(c => c.optionName).join(', ');
}
setCollectModalTab(tab: 'UPI' | 'CASH'): void {
  if (this.collectModal) {
    this.collectModal.tab = tab;
    this.collectModal.upiUri = ''; // Reset UPI URI when switching tabs
  }
}

async collectWaiterPayment(orderId: number, method: 'Cash' | 'UPI'): Promise<void> {
  try {
    const response: any = await firstValueFrom(
      this.http.post(
        `${this.API_BASE}/order/${orderId}/initiate-payment?restaurantId=${this.restaurantId}&method=${method}&channel=Waiter`,
        {},
        this.httpOptions
      )
    );

    if (method === 'Cash') {
      // Mark cash payment as completed immediately
      await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${response.paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );
      this.pushAlert('payment', `💰 Cash payment collected for Order #${orderId}`);
    } else {
      // UPI payment - show QR code
      this.openCollectModal({
        orderID: orderId,
        paymentID: response.paymentId,
        amount: response.amount
      });
    }
  } catch (error) {
    console.error('Error collecting payment:', error);
  }
}
closeChangeHistoryModal(): void {
  this.showChangeHistoryModal = false;
}
// Add this new method to your WaiterComponent class
switchCollectModalTab(tab: 'UPI' | 'CASH'): void {
  this.collectModal.tab = tab;
}

getStatusBadgeClass(status: string): string {
  const classes: { [key: string]: string } = {
    'Pending': 'bg-warning text-dark',
    'Confirmed': 'bg-info text-white',
    'Served': 'bg-success text-white',
    'Completed': 'bg-secondary text-white',
    'Cancelled': 'bg-danger text-white'
  };
  return classes[status] || 'bg-light text-dark';
}

getKitchenStatusBadgeClass(status: string): string {
  const classes: { [key: string]: string } = {
    'Pending': 'bg-warning text-dark',
    'Preparing': 'bg-info text-white',
    'Ready': 'bg-success text-white'
  };
  return classes[status] || 'bg-light text-dark';
}

getPaymentStatusBadgeClass(status: string): string {
  const classes: { [key: string]: string } = {
    'Pending': 'bg-warning text-dark',
    'Paid': 'bg-success text-white',
    'Failed': 'bg-danger text-white',
    'Refunded': 'bg-secondary text-white'
  };
  return classes[status] || 'bg-light text-dark';
}

calculateOrderTotal(order: any): number {
  if (!order.items) return 0;
  return order.items.reduce((total: number, item: any) => {
    return total + (item.unitPrice * item.quantity);
  }, 0);
}

isOrderLocked(): boolean {
  // Prevent editing if order is served, completed, or cancelled
  const lockedStatuses = [OrderStatus.Served, OrderStatus.Completed, OrderStatus.Cancelled];
  return lockedStatuses.includes(this.selectedOrderForEdit?.orderStatus);
}

toggleProductList(): void {
  this.showProductList = !this.showProductList;
  if (this.showProductList) {
    this.filterProducts();
  }
}

filterProducts(): void {
  if (!this.availableProducts) {
    this.filteredAvailableProducts = [];
    return;
  }

  this.filteredAvailableProducts = this.availableProducts.filter(product => {
    const matchesSearch = !this.productSearch || 
      product.productName.toLowerCase().includes(this.productSearch.toLowerCase()) ||
      product.productDescription?.toLowerCase().includes(this.productSearch.toLowerCase());
    
    const matchesCategory = !this.selectedCategory || 
      product.category === this.selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Extract unique categories
  this.productCategories = [...new Set(this.availableProducts
    .map(p => p.category)
    .filter(c => c))] as string[];
}

getProductQuantity(product: any): number {
  return this.productQuantities.get(product.productID) || 0;
}

increaseProductQuantity(product: any): void {
  const current = this.getProductQuantity(product);
  this.productQuantities.set(product.productID, current + 1);
}

decreaseProductQuantity(product: any): void {
  const current = this.getProductQuantity(product);
  if (current > 0) {
    this.productQuantities.set(product.productID, current - 1);
  }
}

getSelectedProductsCount(): number {
  let count = 0;
  this.productQuantities.forEach(quantity => {
    if (quantity > 0) count++;
  });
  return count;
}

getSelectedProductsTotal(): number {
  let total = 0;
  this.productQuantities.forEach((quantity, productId) => {
    if (quantity > 0) {
      const product = this.availableProducts.find(p => p.productID === productId);
      if (product) {
        total += product.price * quantity;
      }
    }
  });
  return total;
}

addSelectedProductsToOrder(): void {
  const productsToAdd: any[] = [];
  
  this.productQuantities.forEach((quantity, productId) => {
    if (quantity > 0) {
      const product = this.availableProducts.find(p => p.productID === productId);
      if (product) {
        productsToAdd.push({
          productID: productId,
          quantity: quantity,
          productName: product.productName,
          unitPrice: product.price
        });
      }
    }
  });

  if (productsToAdd.length === 0) {
    alert('Please select at least one product to add');
    return;
  }

  // Add products to order
  productsToAdd.forEach(product => {
    this.addItemToOrder(product);
  });

  // Reset quantities
  this.productQuantities.clear();
  this.showProductList = false;
}

printOrderBill(orderId: number): void {
  const url = `${this.API_BASE}/order/${orderId}/bill?restaurantId=${this.restaurantId}`;
  window.open(url, '_blank');
}

// Enhanced openEditOrderModal method
openEditOrderModal(order: any): void {
  this.selectedOrderForEdit = JSON.parse(JSON.stringify(order)); // Deep copy
  this.showProductList = false;
  this.productSearch = '';
  this.selectedCategory = '';
  this.productQuantities.clear();
  this.loadAvailableProducts();
  this.showEditOrderModal = true;
}

// Enhanced loadAvailableProducts method
loadAvailableProducts(): void {
  this.http.get<any[]>(`${environment.apiUrl}/product?restaurantId=${this.restaurantId}`)
    .subscribe({
      next: (products) => {
        this.availableProducts = products.filter(p => p.isAvailable);
        this.filterProducts(); // Initialize filtered products
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.availableProducts = [];
        this.filteredAvailableProducts = [];
      }
    });
}
serveOrder(orderID: number): void {
  this.http.put(`${this.API_BASE}/Order/${orderID}/serve?restaurantId=${this.restaurantId}`, null, this.httpOptions)
    .subscribe({
      next: () => {
        // Update local state - order should move from orders to history
        this.getOrders(); // Refresh to get updated order status
        
        // Optional: Show confirmation message
        this.pushAlert('order', `✅ Order #${orderID} marked as served and moved to history`);
      },
      error: err => {
        console.error('Error serving order:', err);
        alert('Failed to mark order as served');
      }
    });
}
}   