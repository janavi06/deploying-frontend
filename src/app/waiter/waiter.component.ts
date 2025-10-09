  import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { Router ,ActivatedRoute} from '@angular/router';
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
  unitPrice: number; // ✅ ADD THIS
  orderItemID?: number; // ✅ ADD THIS - crucial for updates

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
  availableTables: any[] = []; // ✅ ADD: To store the list of tables

selectedOrderForEdit: any = null;
showEditOrderModal = false;
availableProducts: any[] = [];
orderChangeHistory: any[] = [];
showChangeHistoryModal = false;
selectedProductCategory: string = '';
// Add these properties to your component class
originalOrderData: any = null;
isSavingChanges = false;
pendingChanges: { 
  quantityUpdates: Map<number, number>, 
  itemsToRemove: number[],
  itemsToAdd: any[] 
} = {
  quantityUpdates: new Map<number, number>(),
  itemsToRemove: [],
  itemsToAdd: []
};


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

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute) {}
ngOnInit(): void {
  // ✅ Get restaurantId from URL parameters FIRST
  this.route.queryParams.subscribe(params => {
    const urlRestaurantId = params['restaurantId'] || 
                           params['restaurantid'] || 
                           params['restaurant'] || 
                           params['rid'] || 
                           0;
    
    if (urlRestaurantId) {
      this.restaurantId = +urlRestaurantId;
      this.initializeDashboard();
    } else {
      // Fallback: try to get from localStorage or user data
      this.initializeFromPersistedData();
    }

    
  });

  window.addEventListener('beforeunload', () => {
    this.persistUIState();
  });

  
}

private initializeFromPersistedData(): void {
  // Try to get restaurantId from localStorage first
  const persistedRestaurantId = localStorage.getItem('waiter_restaurantId');
  if (persistedRestaurantId) {
    this.restaurantId = +persistedRestaurantId;
    this.initializeDashboard();
    return;
  }

  // Fallback to user data
  const userData = localStorage.getItem('userData');
  if (userData) {
    const user = JSON.parse(userData);
    this.restaurantId = user.restaurantId || user.restaurantID || 0;
  }
  
  if (this.restaurantId) {
    // Persist for future refreshes
    localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
    this.initializeDashboard();
  } else {
    this.showRestaurantError();
  }
}
  private initializeFromUserData(): void {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      this.restaurantId = user.restaurantId || user.restaurantID || 0;
    }
    
    if (this.restaurantId) {
      this.initializeDashboard();
    } else {
      this.showRestaurantError();
    }
  }

private initializeDashboard(): void {
  console.log('✅ Initializing waiter dashboard for restaurant:', this.restaurantId);
  
  // Persist restaurantId immediately
  localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
  
  // Restore UI state
  this.restoreUIState();
  
  // Update page title
  document.title = `Waiter Dashboard - Restaurant ${this.restaurantId}`;

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
  this.setupPaymentPolling(); // ✅ ADD THIS LINE

  // Set up intervals
  setInterval(() => {
    if (this.selectedSection === 'history') {
      this.refreshHistoryOnly();
    }
  }, 15000);

  setInterval(() => this.getOrders(), 10000);
  setInterval(() => this.persistUIState(), 30000); // Every 30 seconds
}
  private showRestaurantError(): void {
    this.error = 'No restaurant specified. Please access via: https://scanui.netlify.app/waiter?restaurantId=YOUR_RESTAURANT_ID';
    console.error(this.error);
  }

 // ✅ ADD method to generate shareable URL
  getShareableUrl(): string {
    return `https://scanui.netlify.app/waiter?restaurantId=${this.restaurantId}`;
  }

  // ✅ ADD method to copy URL to clipboard
  copyShareableUrl(): void {
    navigator.clipboard.writeText(this.getShareableUrl()).then(() => {
    });
  }

ngOnDestroy(): void {
  // Clear all intervals when component is destroyed
  if (this.notificationCheckInterval) {
    clearInterval(this.notificationCheckInterval);
  }
  
  if (this.requestPollingInterval) {
    clearInterval(this.requestPollingInterval);
  }
  
  // Remove event listener
  window.removeEventListener('beforeunload', () => {
    this.persistUIState();
  });

  
}
private persistUIState(): void {
  const uiState = {
    selectedSection: this.selectedSection,
    selectedTableNo: this.selectedTableNo,
    selectedPayTab: this.selectedPayTab,
    historyFilter: this.historyFilter,
    isSidebarOpen: this.isSidebarOpen,
    lastUpdated: Date.now()
  };
  localStorage.setItem('waiter_ui_state', JSON.stringify(uiState));
}

private restoreUIState(): void {
  const saved = localStorage.getItem('waiter_ui_state');
  if (saved) {
    try {
      const uiState = JSON.parse(saved);
      
      // Only restore if not too old (e.g., within last 2 hours)
      if (Date.now() - (uiState.lastUpdated || 0) < 2 * 60 * 60 * 1000) {
        this.selectedSection = uiState.selectedSection || 'orders';
        this.selectedTableNo = uiState.selectedTableNo;
        this.selectedPayTab = uiState.selectedPayTab || 'verify';
        this.historyFilter = uiState.historyFilter || 'today';
        this.isSidebarOpen = uiState.isSidebarOpen || false;
      }
    } catch (e) {
      console.warn('Failed to restore UI state:', e);
    }
  }
}
switchPayTab(tab: 'verify' | 'collect') {
  if (this.selectedPayTab === tab) return;
  this.selectedPayTab = tab;
    this.persistUIState(); // ✅ Persist tab selection

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

private setupPaymentPolling(): void {
  // Initial load
  this.fetchPendingPayments();
  
  // Set up intervals for automatic refresh
  setInterval(() => {
    if (this.selectedSection === 'pendingPayments') {
      this.fetchPendingPayments();
    }
  }, 10000); // Full refresh every 10 seconds
  
  // Check for new payments more frequently
  setInterval(() => {
    if (this.selectedSection === 'pendingPayments') {
      this.checkForNewPendingPayments();
    }
  }, 5000); // Check for new payments every 5 seconds
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
    this.persistUIState(); // ✅ Persist table selection

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
    this.pushAlert('order', ` Order #${e.orderID} placed - Payment pending in Collect tab`);
  }
  
  // Refresh orders to show the new order in the correct section
  this.getOrders();
}

onNewOrderClosed() {
  this.selectedSection = 'orders';
  this.getOrders(); // refresh list after closing
}



  private refreshHistoryOnly(): void {
    if (!this.restaurantId) return;
    
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
            unitPrice: i.unitPrice ?? 0 // required field
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
  
  this.persistUIState(); // ✅ Persist filter changes
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



  // ✅ UPDATED: Include restaurantId in request polling
  private setupRequestPolling(): void {
    this.requestPollingInterval = setInterval(() => {
      if (this.restaurantId) {
        this.checkForNewRequests();
      }
    }, 5000);
  }

  checkForNewRequests(): void {
    if (!this.restaurantId) return;
    
    this.http.get<any[]>(`${this.API_BASE}/order/waiter/requests/unnotified?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: (requests) => {
          if (requests.length > 0) {
            this.notificationSound.play().catch(e => console.log('Audio playback failed:', e));
            this.unreadRequests = [...requests, ...this.unreadRequests];

            requests.forEach(request => {
              this.http.put(
                `${this.API_BASE}/order/waiter/requests/mark-notified/${request.waiterRequestID}?restaurantId=${this.restaurantId}`,
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
    if (!this.restaurantId) return;
    
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

                this.readyOrderMessages.push({
                  notificationId: n.notificationId,
                  message: msg,
                  orderId: n.orderId,
                  tableNo: n.tableNo,
                  timestamp: Date.now()
                });

                this.acknowledgeNotification(n.notificationId);

                setTimeout(() => {
                  this.readyOrderMessages = this.readyOrderMessages.filter(m => m.notificationId !== n.notificationId);
                }, 10000);
              }
            });
          } else {
            this.readyNotifications = [];
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
    if (!this.restaurantId) return;
    
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
      }
    } catch (error: any) {
      console.error('Error initiating UPI:', error);
    } finally {
      this.busyCollect = false;
    }
  }

// In the collect modal finalizeIfPaid method, update the status check:
// async finalizeIfPaid() {
//   if (!this.collectModal.paymentId) {
//     alert('No payment ID found. Please generate QR code first.');
//     return;
//   }
  
//   this.busyCollect = true;
//   try {
//     const statusResponse: any = await firstValueFrom(
//       this.http.get(
//         `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/status?restaurantId=${this.restaurantId}`,
//         this.httpOptions
//       )
//     );

//     console.log('Payment Status Response:', statusResponse);

//     // Handle different possible status values
//     const paidStatuses = ['Paid', 'Completed', 'Success', 'Success'];
//     if (paidStatuses.includes(statusResponse?.status)) {
//       this.onPaymentCleared(this.collectModal.paymentId);
//       this.closeCollectModal();
      
//       // Open bill in new tab
//       window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
//       this.pushAlert('payment', `✅ UPI payment received for Order #${this.collectModal.orderId}`);
      
//       // Refresh orders to move to history
//       this.getOrders();
//     } else {
//       alert(`Payment status: ${statusResponse?.status || 'Pending'}. Please ask customer to complete payment.`);
//     }
//   } catch (error: any) {
//     console.error('Error checking payment status:', error);
//     alert(`Error checking payment status: ${error.error?.message || 'Please try again'}`);
//   } finally {
//     this.busyCollect = false;
//   }
// }
// Helper method to get table number from order


// Fix the markCashReceived method
// async markCashReceived() {
//   this.busyCollect = true;
//   try {
//     // First, initiate payment if not already done
//     if (!this.collectModal.paymentId) {
//       const started: any = await firstValueFrom(
//         this.http.post(
//           `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter&method=Cash`,
//           {},
//           this.httpOptions
//         )
//       );
      
//       if (started?.paymentId) {
//         this.collectModal.paymentId = started.paymentId;
//       } else {
//         throw new Error('Failed to initiate cash payment');
//       }
//     }

//     // Mark cash payment as completed
//     const result: any = await firstValueFrom(
//       this.http.post(
//         `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/cash-complete?restaurantId=${this.restaurantId}`,
//         {},
//         this.httpOptions
//       )
//     );

//     if (result.success) {
//       this.onPaymentCleared(this.collectModal.paymentId);
//       this.closeCollectModal();
      
//       // Open bill in new tab
//       window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
//       this.pushAlert('payment', `✅ Cash payment of ₹${this.collectModal.amount} collected for Order #${this.collectModal.orderId}`);
      
//       // Refresh orders to move to history
//       this.getOrders();
//     } else {
//       throw new Error(result.message || 'Failed to mark cash as received');
//     }
//   } catch (error: any) {
//     console.error('Error marking cash received:', error);
//     alert(`Error: ${error.error?.message || 'Failed to process cash payment'}`);
//   } finally {
//     this.busyCollect = false;
//   }
// }


// Enhanced fetchPendingPayments to handle different ID formats
fetchPendingPayments(): void {
  if (!this.restaurantId) {
    console.log('❌ No restaurant ID available for fetching payments');
    return;
  }
  
  console.log('🔄 Fetching pending payments...');
  
  this.http.get<any[]>(`${this.API_BASE}/order/pending-payments?restaurantId=${this.restaurantId}`, this.httpOptions)
    .subscribe({
      next: (payments) => {
        console.log('📦 Raw payments from API:', payments);
        
        this.pendingPayments = (payments || []).map(p => ({
          ...p,
          paymentId: p.paymentID || p.paymentId || p.id
        }));
        
        this.splitPending(this.pendingPayments);
        console.log('✅ Payments updated:', {
          total: this.pendingPayments.length,
          verify: this.verifyPayments.length,
          collect: this.collectPayments.length
        });
      },
      error: err => {
        console.error('❌ Error fetching pending payments:', err);
        this.error = 'Failed to load pending payments';
      }
    });
}
private checkForNewPendingPayments(): void {
  if (!this.restaurantId || this.selectedSection !== 'pendingPayments') return;
  
  this.http.get<any[]>(`${this.API_BASE}/order/pending-payments/unnotified?restaurantId=${this.restaurantId}`, this.httpOptions)
    .subscribe({
      next: (newPayments) => {
        if (newPayments.length > 0) {
          console.log('🆕 New pending payments detected:', newPayments.length);
          
          // Play sound for new payments
          this.paymentSound.play().catch(() => {});
          this.vibrate();
          
          // Add new payments to the beginning of the list
          this.pendingPayments = [...newPayments, ...this.pendingPayments];
          this.splitPending(this.pendingPayments);
          
          // Mark as notified
          newPayments.forEach(payment => {
            const paymentId = payment.paymentID || payment.paymentId;
            if (paymentId) {
              this.http.put(
                `${this.API_BASE}/order/pending-payments/${paymentId}/mark-notified?restaurantId=${this.restaurantId}`,
                null,
                this.httpOptions
              ).subscribe();
            }
          });
          
          this.pushAlert('payment', `💰 ${newPayments.length} new payment(s) pending`);
        }
      },
      error: err => console.error('Error checking new payments:', err)
    });
}
// async markUpiAsPaid(): Promise<void> {
//   if (!this.collectModal.paymentId) {
//     alert('No payment ID found. Please generate QR code first.');
//     return;
//   }
  
//   this.busyCollect = true;
//   try {
//     // ✅ FIX: Use PUT instead of POST for completion
//     const result: any = await firstValueFrom(
//       this.http.put(
//         `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
//         {},
//         this.httpOptions
//       )
//     );

//     // ✅ FIX: Handle different success response formats
//     if (result.success !== false) {
//       // If we get here, payment was successful
//       this.onPaymentCleared(this.collectModal.paymentId);
//       this.closeCollectModal();
      
//       // Open bill in new tab
//       window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
//       this.pushAlert('payment', `✅ UPI payment marked as paid for Order #${this.collectModal.orderId}`);
      
//       // Refresh orders to move to history
//       this.getOrders();
//     } else {
//       // Only throw error if success is explicitly false
//       throw new Error(result.message || 'Failed to mark UPI payment as paid');
//     }
//   } catch (error: any) {
//     console.error('Error marking UPI as paid:', error);
    
//     // ✅ FIX: Check if this is actually a success message in error form
//     if (error.error?.message?.includes('completed successfully') || 
//         error.message?.includes('completed successfully')) {
//       // This is actually a success - process it as such
//       console.log('🔄 Processing successful payment from error format');
//       this.onPaymentCleared(this.collectModal.paymentId);
//       this.closeCollectModal();
      
//       window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
//       this.pushAlert('payment', `✅ UPI payment completed for Order #${this.collectModal.orderId}`);
//       this.getOrders();
//     } else {
//       // This is a real error
//       alert(`Error: ${error.error?.message || error.message || 'Failed to process UPI payment'}`);
//     }
//   } finally {
//     this.busyCollect = false;
//   }
// }
// Add this debug method to test your endpoints
async testPaymentEndpoints(): Promise<void> {
  if (!this.collectModal.paymentId) return;
  
  console.log('🔧 Testing payment endpoints for payment ID:', this.collectModal.paymentId);
  
  try {
    // Test GET endpoint
    const status: any = await firstValueFrom(
      this.http.get(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/status?restaurantId=${this.restaurantId}`,
        this.httpOptions
      )
    );
    console.log('✅ GET status works:', status);
    
    // Test PUT endpoint
    const complete: any = await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );
    console.log('✅ PUT complete works:', complete);
    
  } catch (error: any) {
    console.error('❌ Endpoint test failed:', error);
    console.log('Error details:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      method: error.method
    });
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
      this.persistUIState(); // ✅ Persist sidebar state

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

// Simplified UPI payment method
async markUpiAsPaid(): Promise<void> {
  if (!this.collectModal.paymentId) {
    // If no payment ID exists, create one first
    try {
      const started: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter&method=UPI`,
          {},
          this.httpOptions
        )
      );
      
      if (started?.paymentId) {
        this.collectModal.paymentId = started.paymentId;
      } else {
        alert('Failed to create payment record');
        return;
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Failed to create payment record');
      return;
    }
  }
  
  this.busyCollect = true;
  try {
    // Simply mark payment as complete
    await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    // Success - close modal and refresh data
    this.closeCollectModal();
    this.pushAlert('payment', `✅ UPI payment completed! Order #${this.collectModal.orderId} moved to history`);
    
    // Refresh data
    setTimeout(() => {
      this.fetchPendingPayments();
      this.getOrders();
    }, 1000);
    
  } catch (error: any) {
    console.error('Error marking UPI as paid:', error);
    alert('Failed to mark payment as paid. Please try again.');
  } finally {
    this.busyCollect = false;
  }
}

// Simplified Cash payment method
async markCashReceived() {
  this.busyCollect = true;
  try {
    // First, create payment record if not exists
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
        throw new Error('Failed to create cash payment record');
      }
    }

    // Mark cash payment as completed
    await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    // Success
    this.closeCollectModal();
    this.pushAlert('payment', `✅ Cash payment received! Order #${this.collectModal.orderId} moved to history`);
    
    // Refresh data
    setTimeout(() => {
      this.fetchPendingPayments();
      this.getOrders();
    }, 1000);
    
  } catch (error: any) {
    console.error('Error marking cash received:', error);
    alert('Failed to process cash payment. Please try again.');
  } finally {
    this.busyCollect = false;
  }
}

// Helper method to get table number
getTableNoFromOrder(orderId: number): number {
  const order = this.orders.find(o => o.orderID === orderId);
  return order?.tableNo || 0;
}

// Set modal tab
setCollectModalTab(tab: 'UPI' | 'CASH'): void {
  this.collectModal.tab = tab;
}
  // ✅ UPDATED: All API calls now include restaurantId
private getOrders(): void {
  if (!this.restaurantId) return;

  this.http.get<any>(`${this.API_BASE}/order/with-waiter?restaurantId=${this.restaurantId}`, this.httpOptions)
    .subscribe({
      next: res => {
        const all = this.unwrapArray<any>(res.orders).map(o => ({
          orderID: o.orderID,
          tableNo: o.tableNo,
          orderStatus: this.mapOrderStatus(o.orderStatus),
          // ✅ Kitchen status is just for display, not for logic
          kitchenStatus: o.kitchenStatus ? this.mapKitchenStatus(o.kitchenStatus) : KitchenStatus.Pending,
          items: this.unwrapArray<any>(o.items).map(i => ({
            productID: i.productID,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice, 
            orderItemID: i.orderItemID || i.orderItemId || i.id || i.OrderItemID,
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

        // ✅ SIMPLE RULE: Active orders are ONLY Pending and Confirmed
        this.orders = all.filter(o =>
          o.orderStatus === OrderStatus.Pending || 
          o.orderStatus === OrderStatus.Confirmed
        );

        // ✅ SIMPLE RULE: History orders are EVERYTHING ELSE
        this.allHistoryOrders = all.filter(o =>
          o.orderStatus === OrderStatus.Completed ||
          o.orderStatus === OrderStatus.Cancelled ||
          o.orderStatus === OrderStatus.Served
        );

        this.applyHistoryFilter();
        
        // Group orders for display (kitchen status doesn't affect grouping)
        this.groupedUpcomingOrders = this.groupOrdersByTable(this.orders);
        if (!this.selectedTableNo && this.groupedUpcomingOrders.length > 0) {
          this.selectedTableNo = this.groupedUpcomingOrders[0].tableNo;
        }

        // Update display arrays
        this.updateReadyTables();
      },
      error: err => console.error('Error fetching orders:', err)
    });
}lyHistoryFilter(): void {
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
  
  this.persistUIState(); // ✅ Persist filter changes
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

  // ✅ UPDATED: Include restaurantId in waiter requests
  getWaiterRequests(): void {
    if (!this.restaurantId) return;
    
    this.http.get<{ data: WaiterRequest[] }>(
      `${this.API_BASE}/order/waiter-requests?restaurantId=${this.restaurantId}`, 
      this.httpOptions
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
  // If you still want to show ready orders, base it purely on order status
  return this.orders.filter(o => 
    o.orderStatus === OrderStatus.Confirmed
    // ✅ No kitchen status dependency
  );
}
serveOrder(orderID: number): void {
  if (!this.restaurantId) return;
  
  this.http.put(`${this.API_BASE}/Order/${orderID}/serve?restaurantId=${this.restaurantId}`, null, this.httpOptions)
    .subscribe({
      next: () => {
        this.getOrders(); // Refresh the orders list
        this.pushAlert('order', `✅ Order #${orderID} marked as served and moved to history`);
      },
      error: err => {
        console.error('Error serving order:', err);
        alert('Failed to mark order as served');
      }
    });
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
    if (!this.restaurantId) return;
    
    this.http.put(
      `${this.API_BASE}/order/waiter-requests/${requestId}/accept?restaurantId=${this.restaurantId}`,
      null,
      this.httpOptions
    ).subscribe({
      next: () => {
        const accepted = this.unreadRequests.find(r => r.waiterRequestID === requestId);
        this.unreadRequests = this.unreadRequests.filter(r => r.waiterRequestID !== requestId);

        if (accepted && !this.waiterRequests.some(r => r.waiterRequestID === requestId)) {
          this.waiterRequests.push({ ...accepted, isAccepted: true });
        }

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
  console.log('🔄 Updating item quantity:', item, newQuantity);
  
  const orderItemID = item.orderItemID || item.orderItemId || item.id || item.OrderItemID || item.itemId;
  
  if (!orderItemID) {
    console.error('❌ No valid order item ID found for item:', item);
    return;
  }

  if (this.isOrderLocked()) {

    return;
  }

  if (newQuantity <= 0) {
    this.removeOrderItem(item);
    return;
  }

  // Store the change in pending changes instead of making API call immediately
  this.pendingChanges.quantityUpdates.set(orderItemID, newQuantity);
  
  // Update the UI immediately for better UX
  const itemIndex = this.selectedOrderForEdit.items.findIndex((i: any) => 
    (i.orderItemID || i.orderItemId || i.id || i.OrderItemID || i.itemId) === orderItemID
  );
  
  if (itemIndex !== -1) {
    this.selectedOrderForEdit.items[itemIndex].quantity = newQuantity;
  }
  
  this.pushAlert('order', `📝 Quantity updated for ${item.productName} to ${newQuantity} (Pending Save)`);
}


addItemToOrder(product: any): void {
  if (this.isOrderLocked()) {
    return;
  }

  const payload = {
    productID: product.productID,
    quantity: 1,
    changedByUserId: this.getCurrentUserId()
  };

  this.http.post(
    `${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/add-item?restaurantId=${this.restaurantId}`,
    payload,
    this.httpOptions
  ).subscribe({
    next: () => {
      this.getOrders();
      this.pushAlert('order', `✅ Added ${product.productName} to order`);
      this.showEditOrderModal = false;
    },
    error: (err) => {
      console.error('Error adding item to order:', err);
    }
  });
}
cancelOrder(order: any): void {
  if (this.isOrderLocked()) {
    return;
  }

  const reason = prompt('Reason for cancellation:');
  if (reason === null) return; // User cancelled

  const payload = {
    reason: reason || 'No reason provided',
    changedByUserId: this.getCurrentUserId()
  };

  this.http.delete(
    `${this.API_BASE}/order/${order.orderID}/cancel?restaurantId=${this.restaurantId}`,
    { 
      body: payload,
      headers: this.httpOptions.headers 
    }
  ).subscribe({
    next: () => {
      this.getOrders();
      this.pushAlert('order', `❌ Order #${order.orderID} cancelled`);
      this.showEditOrderModal = false;
    },
    error: (err) => {
      console.error('Error cancelling order:', err);
      alert('Failed to cancel order: ' + (err.error?.message || err.message));
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
  this.persistUIState(); // ✅ Persist on section change

}
// Original close method
closeEditOrderModal(): void {
  this.showEditOrderModal = false;
  this.resetPendingChanges();
}
getCustomizationsText(customizations: any[] | undefined): string {
  if (!customizations || customizations.length === 0) return '';
  return customizations.map(c => c.optionName).join(', ');
}

closeEditOrderModalWithConfirmation(): void {
  if (this.hasUnsavedChanges()) {
    if (confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
      this.closeEditOrderModal();
    }
  } else {
    this.closeEditOrderModal();
  }
}

async saveOrderChanges(): Promise<void> {
  if (this.isSavingChanges || !this.hasUnsavedChanges()) {
    return;
  }

  this.isSavingChanges = true;

  try {
    let successCount = 0;
    const tableHasChanged = this.selectedOrderForEdit.tableNo !== this.originalOrderData.tableNo;
    const totalChanges = this.pendingChanges.quantityUpdates.size +
                         this.pendingChanges.itemsToRemove.length +
                         this.pendingChanges.itemsToAdd.length +
                         (tableHasChanged ? 1 : 0);

    // --- 1. Process Table Change First ---
    if (tableHasChanged) {
      try {
        const payload = {
          // This is the fix: The '+' converts the string value from the dropdown to a number.
          newTableNo: +this.selectedOrderForEdit.tableNo,
          changedByUserId: this.getCurrentUserId()
        };

        await firstValueFrom(
          this.http.put(
            `${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/change-table?restaurantId=${this.restaurantId}`,
            payload,
            this.httpOptions
          )
        );
        successCount++;
      } catch (error: any) {
        console.error(`Error changing table for order ${this.selectedOrderForEdit.orderID}:`, error);
        throw new Error(`Failed to change table: ${error.error?.message || 'Server error'}`);
      }
    }

    // --- 2. Process Item Quantity Updates ---
    for (const [orderItemID, newQuantity] of this.pendingChanges.quantityUpdates) {
      try {
        const payload = {
          quantity: newQuantity,
          changedByUserId: this.getCurrentUserId()
        };
        await firstValueFrom(
          this.http.put(
            `${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/update-item/${orderItemID}?restaurantId=${this.restaurantId}`,
            payload,
            this.httpOptions
          )
        );
        successCount++;
      } catch (error) {
        console.error(`Error updating item ${orderItemID}:`, error);
        throw new Error(`Failed to update item quantity: ${error}`);
      }
    }

    // --- 3. Process Item Removals ---
    for (const orderItemID of this.pendingChanges.itemsToRemove) {
      try {
        const payload = {
          quantity: 0, // Setting quantity to 0 removes the item
          changedByUserId: this.getCurrentUserId()
        };
        await firstValueFrom(
          this.http.put(
            `${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/update-item/${orderItemID}?restaurantId=${this.restaurantId}`,
            payload,
            this.httpOptions
          )
        );
        successCount++;
      } catch (error) {
        console.error(`Error removing item ${orderItemID}:`, error);
        throw new Error(`Failed to remove item: ${error}`);
      }
    }

    // --- 4. Process New Items ---
    for (const product of this.pendingChanges.itemsToAdd) {
      try {
        const payload = {
          productID: product.productID,
          quantity: product.quantity,
          changedByUserId: this.getCurrentUserId()
        };
        await firstValueFrom(
          this.http.post(
            `${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/add-item?restaurantId=${this.restaurantId}`,
            payload,
            this.httpOptions
          )
        );
        successCount++;
      } catch (error) {
        console.error(`Error adding item ${product.productID}:`, error);
        throw new Error(`Failed to add item: ${error}`);
      }
    }

    // --- Finalization ---
    if (successCount === totalChanges) {
      this.pushAlert('order', `✅ Successfully saved ${successCount} changes to order #${this.selectedOrderForEdit.orderID}`);
      this.resetPendingChanges();
      this.getOrders(); // Refresh orders from server
      this.showEditOrderModal = false; // Close modal
    } else {
      throw new Error(`Only ${successCount} out of ${totalChanges} changes were saved`);
    }

  } catch (error: any) {
    console.error('Error saving order changes:', error);
    this.pushAlert('order', `❌ Error saving changes: ${error.message}`);
    // Refresh data to ensure consistency with the server state
    this.getOrders();
  } finally {
    this.isSavingChanges = false;
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
      this.pushAlert('payment', `Cash payment collected for Order #${orderId}`);
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
  if (this.isOrderLocked()) {
    return;
  }

  const productsToAdd: any[] = [];
  
  this.productQuantities.forEach((quantity, productId) => {
    if (quantity > 0) {
      const product = this.availableProducts.find(p => p.productID === productId);
      if (product) {
        productsToAdd.push({
          productID: productId,
          quantity: quantity,
          productName: product.productName,
          unitPrice: product.price,
          // Temporary ID for UI display
          tempId: Date.now() + productId
        });
      }
    }
  });

  if (productsToAdd.length === 0) {
    return;
  }

  // Add to pending changes and update UI
  this.pendingChanges.itemsToAdd.push(...productsToAdd);
  
  // Add to UI immediately for better UX
  this.selectedOrderForEdit.items.push(...productsToAdd);
  
  this.pushAlert('order', `✅ Added ${productsToAdd.length} items to order (Pending Save)`);
  
  // Clear selection
  this.productQuantities.clear();
  this.showProductList = false;
}

printOrderBill(orderId: number): void {
  const url = `${this.API_BASE}/order/${orderId}/bill?restaurantId=${this.restaurantId}`;
  window.open(url, '_blank');
}

removeOrderItem(item: any): void {
  console.log('🗑️ Marking item for removal:', item);
  
  const orderItemID = item.orderItemID || item.orderItemId || item.id || item.OrderItemID || item.itemId;
  
  if (!orderItemID) {
    console.error('❌ No valid order item ID found for item:', item);
    return;
  }

  if (this.isOrderLocked()) {
    return;
  }

  if (confirm(`Remove ${item.productName} from order? This change will be saved when you click "Save Changes".`)) {
    // Mark for removal in pending changes
    this.pendingChanges.itemsToRemove.push(orderItemID);
    
    // Remove from UI immediately for better UX
    this.selectedOrderForEdit.items = this.selectedOrderForEdit.items.filter((i: any) => 
      (i.orderItemID || i.orderItemId || i.id || i.OrderItemID || i.itemId) !== orderItemID
    );
    
    this.pushAlert('order', `❌ Marked ${item.productName} for removal (Pending Save)`);
  }
}

// Enhanced openEditOrderModal method
openEditOrderModal(order: any): void {
  this.selectedOrderForEdit = JSON.parse(JSON.stringify(order)); // Deep copy
  this.originalOrderData = JSON.parse(JSON.stringify(order)); // Store original for comparison
  this.showProductList = false;
  this.productSearch = '';
  this.selectedCategory = '';
  this.productQuantities.clear();
  this.resetPendingChanges(); // Reset changes when opening modal
  this.loadAvailableProducts();
      this.loadAvailableTables(); // ✅ ADD THIS LINE

  this.showEditOrderModal = true;
}
// Reset pending changes
resetPendingChanges(): void {
  this.pendingChanges = {
    quantityUpdates: new Map<number, number>(),
    itemsToRemove: [],
    itemsToAdd: []
  };
}
 // ✅ ADD: New method to fetch all available tables for the restaurant
  loadAvailableTables(): void {
    if (!this.restaurantId) return;
    this.http.get<any[]>(`${this.API_BASE}/restauranttables?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (tables) => {
          this.availableTables = tables.sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));
          console.log('✅ Loaded available tables:', this.availableTables);
        },
        error: (err) => {
          console.error('❌ Error loading available tables:', err);
          this.availableTables = []; // Reset on error to prevent issues
        }
      });
  }
// Check if there are unsaved changes
 hasUnsavedChanges(): boolean {
    const tableChanged = this.selectedOrderForEdit?.tableNo !== this.originalOrderData?.tableNo;

    return this.pendingChanges.quantityUpdates.size > 0 ||
           this.pendingChanges.itemsToRemove.length > 0 ||
           this.pendingChanges.itemsToAdd.length > 0 ||
           tableChanged; // ✅ ADD THIS CHECK
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
shouldShowServeButton(order: Order): boolean {
  return order.orderStatus !== OrderStatus.Served && 
         order.orderStatus !== OrderStatus.Completed && 
         order.orderStatus !== OrderStatus.Cancelled;
}


onPaymentCleared(paymentId: number): void {
  // Simply remove from payment lists
  this.pendingPayments = this.pendingPayments.filter(p => 
    (p.paymentID || p.paymentId) !== paymentId
  );
  this.verifyPayments = this.verifyPayments.filter(p => 
    (p.paymentID || p.paymentId) !== paymentId
  );
  this.collectPayments = this.collectPayments.filter(p => 
    (p.paymentID || p.paymentId) !== paymentId
  );
}
// Also update the finalizeIfPaid method to remove bill download
async finalizeIfPaid() {
  if (!this.collectModal.paymentId) {
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
      
      // ❌ REMOVED: Bill download
      // window.open(`${this.API_BASE}/order/${this.collectModal.orderId}/bill?restaurantId=${this.restaurantId}`, '_blank');
      
      this.pushAlert('payment', `✅ UPI payment received for Order #${this.collectModal.orderId}`);
      
      // Refresh orders to move to history
      this.getOrders();
    } else {
    }
  } catch (error: any) {
    console.error('Error checking payment status:', error);
  } finally {
    this.busyCollect = false;
  }
}

}   