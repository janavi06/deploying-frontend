 import { Component, OnInit , ViewEncapsulation} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { Router ,ActivatedRoute, NavigationStart} from '@angular/router';
import { environment } from '../../environments/environment';
import { PendingPaymentsComponent } from '../pending-payments/pending-payments.component';  // ← import it!
import { NewOrderComponent } from '../new-order/new-order.component';
import { QRCodeComponent } from 'angularx-qrcode';
import { firstValueFrom } from 'rxjs'; // ✅ ADD THIS IMPORT
import { AuthService } from '../services/auth.service'; // <-- ADD IMPORT

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
  paymentID?: any; // Add these optional properties
  paymentId?: any;
}
export interface Order {
  orderID: number;
  orderNumber: number; // ✅ ADD THIS LINE
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
  totalAmount?: number; // ✅ ADD THIS LINE
    paymentMethod?: string; // ✅ ADD THIS
  paymentStatus?: string; // ✅ ADD THIS

}
export interface RestaurantDetails {
  name: string;
  address: string;
  upiId?: string;
  upiName?: string;
  // Add other properties you need
}
export interface WaiterRequest {
  waiterRequestID: number;
  message:         string;
  tableNumber:     number;
  requestTime:     string;
    isAccepted?:     boolean; // <-- add this

}
// Add to your existing properties

@Component({
  selector: 'app-waiter',
    standalone: true, 
  templateUrl: './waiter.component.html',
  styleUrls: ['./waiter.component.css'],
    encapsulation: ViewEncapsulation.None ,


  imports: [CommonModule, FormsModule, HttpClientModule, PendingPaymentsComponent,NewOrderComponent,QRCodeComponent],
})
export class WaiterComponent implements OnInit {
  orders: Order[] = [];
  historyOrders: Order[] = [];
  selectedOrder?: Order;
  waiterRequests: WaiterRequest[] = [];
  OrderStatus = OrderStatus;

  paymentModal = {
  open: false,
  orderId: 0,
  tableNo: 0,
  amount: 0,
  selectedMethod: 'UPI' as 'UPI' | 'Cash',
  busy: false
};
readyNotifications: any[] = [];
readyOrderMessages: { notificationId: number; orderNumber: number; message: string; orderId: number; tableNo: number; timestamp: number }[] = [];
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
  orderNumberMap: { [orderID: number]: number } = {}; // ✅ ADD THIS PROPERTY

  viewMode: 'grid' | 'list' = 'grid';
  selectedStatus = 'all';
  statusFilters = ['all', 'pending', 'confirmed', 'served'];
private readonly PRINT_API = 'http://localhost:9000/api/print';

  restaurantDetails: RestaurantDetails = {
    name: 'Restaurant',
    address: 'Address not available',
    upiId: '',
    upiName: ''
  };
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
markAsPaidModal = {
  open: false,
  orderId: 0,
  tableNo: 0,
  amount: 0,
  selectedMethod: 'Cash' as 'Cash' | 'UPI',
  busy: false,
  paymentId: 0,
    orderNumber: 0 // ✅ ADD THIS

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
  tab: 'UPI' as 'UPI' | 'CASH',
    orderNumber: 0 // ✅ ADD THIS

};

busyCollect = false;


unreadRequests: any[] = [];
private requestPollingInterval: any;
private notificationSound = new Audio('assets/sounds/notification.mp3');


private notificationCheckInterval: any;

private readonly API_BASE = `${environment.apiUrl}`;

  private httpOptions: { headers: HttpHeaders } = { headers: new HttpHeaders() };

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute,private auth: AuthService) {
      this.setupRouterEvents(); // ✅ ADD THIS

  }
// ✅✅✅ THIS IS THE FIX ✅✅✅
ngOnInit(): void {
  // ✅ FIX: Subscribe to 'params' (from the URL /waiter/1)
  // instead of 'queryParams' (from the URL /waiter?restaurantId=1)
  this.route.params.subscribe(params => {
    const routeRestaurantId = params['restaurantId'];
    
    if (routeRestaurantId) {
      this.restaurantId = +routeRestaurantId;
      this.initializeDashboard(); // ✅ Good: Initialize dashboard *after* getting ID
    } else {
      // This block should not be reached if the AuthGuard is working,
      // but we'll leave the error here as a fallback.
      this.showRestaurantError();
    }
  });

  window.addEventListener('beforeunload', () => {
    this.persistUIState();
  });
}

getShareableUrl(): string {
  // ✅ FIX: Use pathname which will be /waiter/1
  const baseUrl = window.location.origin + window.location.pathname;
  return baseUrl; // The URL itself is now shareable
}

refreshUrl(): void {
  // This method might not be needed anymore, but we'll leave it
  this.updateUrlWithRestaurantId();
}
private updateUrlWithRestaurantId(): void {
  const currentUrl = this.router.url;
  
  // Check if URL already has restaurantId
  if (!currentUrl.includes('restaurantId=') && this.restaurantId) {
    // Navigate to same route with restaurantId parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { restaurantId: this.restaurantId },
      queryParamsHandling: 'merge', // This preserves other query params
      replaceUrl: true // This replaces current history entry
    });
  }
}
  
// ✅ ADD: Method to handle navigation with restaurantId
private navigateWithRestaurantId(commands: any[]): void {
  if (this.restaurantId) {
    const navigationExtras = {
      queryParams: { restaurantId: this.restaurantId },
      queryParamsHandling: 'merge' as const
    };
    this.router.navigate(commands, navigationExtras);
  } else {
    this.router.navigate(commands);
  }
}


private initializeFromPersistedData(): void {
  // Try to get restaurantId from localStorage first
  const persistedRestaurantId = localStorage.getItem('waiter_restaurantId');
  if (persistedRestaurantId) {
    this.restaurantId = +persistedRestaurantId;
    this.initializeDashboard();
    this.updateUrlWithRestaurantId(); // ✅ ADD THIS
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
    this.updateUrlWithRestaurantId(); // ✅ ADD THIS
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

// Call this in your ngOnInit
private initializeDashboard(): void {
  console.log('✅ Initializing waiter dashboard for restaurant:', this.restaurantId);
  
  // Persist restaurantId immediately
  localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
    this.updateUrlWithRestaurantId();
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

  // ✅ ADD: Load restaurant details
  this.loadRestaurantDetails();

  // Initialize all data
  this.getOrders();
  this.getWaiterRequests();
  this.checkForReadyNotifications();
  this.setupNotificationPolling();
  this.setupRequestPolling();
  this.setupPaymentPolling();

  // Set up intervals
  setInterval(() => {
    if (this.selectedSection === 'history') {
      this.refreshHistoryOnly();
    }
  }, 15000);

  setInterval(() => this.getOrders(), 10000);
  setInterval(() => this.persistUIState(), 30000);
}
  private showRestaurantError(): void {
    this.error = 'No restaurant specified. Please access via: https://scanui.netlify.app/waiter?restaurantId=YOUR_RESTAURANT_ID';
    console.error(this.error);
  }

 // ✅ ADD: Method to validate and correct URL on component load
private validateUrl(): void {
  const currentUrl = new URL(window.location.href);
  const urlParams = new URLSearchParams(currentUrl.search);
  const urlRestaurantId = urlParams.get('restaurantId');
  
  // If URL has different restaurantId than current, update current
  if (urlRestaurantId && +urlRestaurantId !== this.restaurantId) {
    this.restaurantId = +urlRestaurantId;
    localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
  }
  
  // If current restaurantId exists but URL doesn't have it, update URL
  if (this.restaurantId && !urlRestaurantId) {
    this.updateUrlWithRestaurantId();
  }
}
  // ✅ ADD method to copy URL to clipboard
  copyShareableUrl(): void {
    navigator.clipboard.writeText(this.getShareableUrl()).then(() => {
    });
  }
// ✅ ADD: Method to handle any external navigation while preserving restaurantId
private setupRouterEvents(): void {
  this.router.events.subscribe(event => {
    // If we're navigating away from this component but restaurantId exists,
    // ensure it's preserved in the URL
    if (event instanceof NavigationStart && this.restaurantId) {
      const currentUrl = event.url;
      
      // If navigating to a different route without restaurantId, add it
      if (!currentUrl.includes('restaurantId=') && !currentUrl.includes('login')) {
        setTimeout(() => {
          this.updateUrlWithRestaurantId();
        });
      }
    }
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
        // this.pushAlert('order', `✅ Order #${response.orderID} placed and paid!`);
        // Order goes directly to history
      } else {
        // this.pushAlert('order', `✅ Order #${response.orderID} placed - Payment Pending`);
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

  // ✅ UPDATE: Enhanced splitPending to include order numbers
  private splitPending(payments: any[]) {
    // Customer payments (paymentChannel === 0 OR source=Customer) need verification
    this.verifyPayments = payments.filter(p => 
      p.paymentChannel === 0 || 
      p.source?.toLowerCase() === 'customer' ||
      (p.paymentChannel === undefined && p.source?.toLowerCase() !== 'waiter')
    ).map(p => ({
      ...p,
      orderNumber: p.orderNumber || p.orderID // ✅ ENSURE ORDER NUMBER
    }));

    // Waiter payments (paymentChannel === 1 OR source=Waiter) need collection
    this.collectPayments = payments.filter(p => 
      p.paymentChannel === 1 ||
      p.source?.toLowerCase() === 'waiter' ||
      (p.paymentChannel === undefined && p.source?.toLowerCase() === 'waiter')
    ).map(p => ({
      ...p,
      orderNumber: p.orderNumber || p.orderID // ✅ ENSURE ORDER NUMBER
    }));
    
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
      orderNumber?: number; // ✅ ADD ORDER NUMBER

  paymentStatus?: string; 
  paymentMethod?: string;
  paymentPreference?: string 
}) {
  if (e.paymentPreference === 'PayNow') {
    if (e.paymentStatus === 'created') {
      // this.pushAlert('order', `🆕 Order #${e.orderID} created - Complete payment to confirm`);
    } else if (e.paymentStatus === 'paid') {
      // this.pushAlert('order', `✅ Order #${e.orderID} placed and paid via ${e.paymentMethod}! Check Orders section.`);
    }
  } else {
    // PayLater orders
    // this.pushAlert('order', ` Order #${e.orderID} placed - Payment pending in Collect tab`);
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
          orderNumber: o.orderNumber || o.orderID, // ✅ ADD ORDER NUMBER
          tableNo: o.tableNo,
          totalAmount: o.totalAmount,
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
          } : undefined // Changed from null to undefined
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
logout(): void {
    if (confirm('Are you sure you want to log out?')) {
      this.auth.logout(); // The auth service will handle redirecting to /login
    }
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
              const orderNumber = n.orderNumber || n.orderId;
              const msg = `✅ Order #${orderNumber} for Table ${n.tableNo} is ready to serve.`;

              this.readyOrderSound.play().catch(() => {});
              this.vibrate();
              // this.pushAlert('ready', msg);

              this.readyOrderMessages.push({
                notificationId: n.notificationId,
                message: msg,
                orderId: n.orderId,
                orderNumber: orderNumber, // ✅ ADD ORDER NUMBER
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
  getDisplayOrderNumber(orderID: number): string {
    const orderNumber = this.orderNumberMap[orderID];
    return orderNumber ? `#${orderNumber}` : `#${orderID}`;
  }

showReadyOrderNotification(notifications: any[]): void {
  notifications.forEach(n => {
    const exists = this.readyOrderMessages.some(m => m.orderId === n.orderId);
    if (!exists) {
      const orderNumber = n.orderNumber || n.orderId; // ✅ GET ORDER NUMBER
      const message = `Table ${n.tableNo} → Order #${orderNumber} is ready to serve!`;

      this.readyOrderMessages.push({
        notificationId: n.notificationId,
        message: message,
        orderId: n.orderId,
        orderNumber: orderNumber, // ✅ ADD ORDER NUMBER
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

closeMarkAsPaidModal(): void {
  this.markAsPaidModal.open = false;
  this.markAsPaidModal.busy = false;
}

async markOrderAsPaid(order: Order): Promise<void> {
  // Redirect to the new modal approach
  this.openMarkAsPaidModal(order);
}
private ensureRestaurantDetails(): Promise<void> {
  return new Promise(async (resolve) => {
    // If we already have valid restaurant details, resolve immediately
    if (this.restaurantDetails.name && this.restaurantDetails.name !== 'Restaurant' && 
        this.restaurantDetails.address && this.restaurantDetails.address !== 'Address not available') {
      resolve();
      return;
    }
    
    // Otherwise, load restaurant details
    await this.loadRestaurantDetails();
    resolve();
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

 


closeCollectModal() {
  this.collectModal.open = false;
  this.collectModal.orderId = 0;
  this.collectModal.paymentId = 0;
  this.collectModal.amount = 0;
  this.collectModal.upiUri = '';
  this.collectModal.tab = 'UPI';
  this.busyCollect = false;
}
// In your initiateUpi method
async initiateUpi() {
  if (!this.restaurantId) return;
  
  this.busyCollect = true;
  try {
    // Ensure restaurant details are loaded for UPI info
    if (!this.restaurantDetails.upiId) {
      await this.loadRestaurantDetails();
    }

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
      console.error('No UPI URI in response');
    }
  } catch (error: any) {
    console.error('Error initiating UPI:', error);
  } finally {
    this.busyCollect = false;
  }
}


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
            paymentId: p.paymentID || p.paymentId || p.id,
            orderNumber: p.orderNumber || p.orderID // ✅ ADD ORDER NUMBER
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
  }, 2000); // auto-dismiss after 20s
}

// Enhanced UPI payment method
async markUpiAsPaid(): Promise<void> {
  this.busyCollect = true;
  try {
      const orderReference = this.collectModal.orderNumber ? 
        `Order #${this.collectModal.orderNumber}` : 
        `Order #${this.collectModal.orderId}`;
    console.log('💰 Processing UPI payment for order:', this.collectModal.orderId);
    
    // Get the specific payment data for this modal
    const paymentData = this.collectPayments.find(p => 
      (p.paymentID || p.paymentId) === this.collectModal.paymentId
    );

    console.log('🔍 Payment data for UPI:', paymentData);

    if (!paymentData) {
      throw new Error('Payment data not found');
    }

    // 1. Mark payment as completed
    console.log('📝 Marking payment as completed...');
    await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    // 2. Print bill using payment data
    console.log('🖨️ Printing bill...');
    await this.printOrderBill(this.collectModal.orderId);

    // 3. Success handling
    console.log('✅ Payment completed successfully');
    this.onPaymentCleared(this.collectModal.paymentId);
    this.closeCollectModal();
    this.pushAlert('payment', `✅ UPI payment received for Order #${this.collectModal.orderId}`);
    
    // 4. Refresh orders
    this.getOrders();
    
  } catch (error: any) {
    console.error('❌ Error marking UPI as paid:', error);
    alert('Failed to process UPI payment. Please try again.');
  } finally {
    this.busyCollect = false;
  }
}

// Enhanced Cash payment method
async markCashReceived() {
  this.busyCollect = true;
  try {
          const orderReference = this.collectModal.orderNumber ? 
        `Order #${this.collectModal.orderNumber}` : 
        `Order #${this.collectModal.orderId}`;
    console.log('💰 Processing Cash payment for order:', this.collectModal.orderId);
    
    // Get the specific payment data for this modal
    const paymentData = this.collectPayments.find(p => 
      (p.paymentID || p.paymentId) === this.collectModal.paymentId
    );

    console.log('🔍 Payment data for Cash:', paymentData);

    // 1. Create payment record if not exists
    if (!this.collectModal.paymentId) {
      console.log('📝 Creating new cash payment record...');
      const started: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/payments/initiate?orderId=${this.collectModal.orderId}&restaurantId=${this.restaurantId}&channel=Waiter&method=Cash`,
          {},
          this.httpOptions
        )
      );
      
      if (started?.paymentId) {
        this.collectModal.paymentId = started.paymentId;
        console.log('✅ Created payment with ID:', this.collectModal.paymentId);
      } else {
        throw new Error('Failed to create cash payment record');
      }
    }

    // 2. Mark cash payment as completed
    console.log('📝 Marking cash payment as completed...');
    await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    // 3. Print bill
    console.log('🖨️ Printing bill...');
    await this.printOrderBill(this.collectModal.orderId);

    // 4. Success handling
    console.log('✅ Cash payment completed successfully');
    this.closeCollectModal();
    this.pushAlert('payment', `✅ Cash payment received! Order #${this.collectModal.orderId}`);
    
    // 5. Refresh data
    setTimeout(() => {
      this.fetchPendingPayments();
      this.getOrders();
    }, 1000);
    
  } catch (error: any) {
    console.error('❌ Error marking cash received:', error);
    alert('Failed to process cash payment. Please try again.');
  } finally {
    this.busyCollect = false;
  }
}

// Debug method to check payment data structure
debugPaymentData(): void {
  console.log('=== PAYMENT DATA DEBUG ===');
  console.log('Collect Payments:', this.collectPayments);
  console.log('Verify Payments:', this.verifyPayments);
  console.log('Pending Payments:', this.pendingPayments);
  
  // Check a specific payment
  if (this.collectPayments.length > 0) {
    const samplePayment = this.collectPayments[0];
    console.log('Sample Payment Structure:', {
      orderID: samplePayment.orderID,
      tableNo: samplePayment.tableNo,
      amount: samplePayment.amount,
      items: samplePayment.items,
      paymentID: samplePayment.paymentID,
      paymentId: samplePayment.paymentId
    });
  }
  
  console.log('=== END DEBUG ===');
}

openCollectModal(p: any) {
  console.log('📋 Opening collect modal with payment:', p);
  
  // Debug the payment structure
  console.log('Payment object keys:', Object.keys(p));
  console.log('Payment items:', p.items);
  console.log('Payment amount:', p.amount);
  console.log('Payment tableNo:', p.tableNo);

  this.collectModal.open = true;
  this.collectModal.orderId = p.orderID;
  this.collectModal.orderNumber = p.orderNumber || p.orderID; // ✅ ADD ORDER NUMBER
  this.collectModal.amount = p.amount;
  this.collectModal.paymentId = p.paymentID || p.paymentId || 0;
  this.collectModal.upiUri = '';
  this.collectModal.tab = 'UPI';
  
  // Debug all payment data
  this.debugPaymentData();
}

async simplePrintOrderBill(orderId: number): Promise<void> {
  try {
    // ✅ Ensure restaurant details are loaded
    await this.ensureRestaurantDetails();

    const paymentData = this.collectPayments.find(p => p.orderID === orderId) || 
                       this.verifyPayments.find(p => p.orderID === orderId);

    if (!paymentData) {
      console.error('No payment data found for order:', orderId);
      return;
    }

    const printData = {
      "Type": "BILL",
      "PrinterName": "RP327 Printer",
      "RestaurantName": this.restaurantDetails.name,
      "RestaurantAddress": this.restaurantDetails.address,
      "Order": {
        "OrderNumber": orderId.toString(),
        "TableNo": paymentData.tableNo?.toString() || "0",
        "Items": [{
          "Name": "Payment Received",
          "Qty": 1,
          "Price": paymentData.amount,
          "Modifiers": []
        }],
        "ServiceCharge": 0,
        "Tax": 0,
        "Discount": 0,
        "Total": paymentData.amount,
        "Notes": `Order #${orderId} - Payment completed`
      }
    };

    console.log('🖨️ Sending print data:', {
      restaurantName: printData.RestaurantName,
      restaurantAddress: printData.RestaurantAddress,
      orderNumber: printData.Order.OrderNumber
    });

    const response = await firstValueFrom(
      this.http.post(this.PRINT_API, printData, this.httpOptions)
    );

    console.log('Print successful:', response);
    this.pushAlert('order', `🖨️ Bill printed for Order #${orderId}`);

  } catch (error) {
    console.error('Print failed:', error);
    this.pushAlert('order', `⚠️ Printing failed for Order #${orderId}`);
  }
}
// Final print method with multiple approaches
async printOrderBill(orderId: number): Promise<void> {
  try {
    console.log('=== PRINT PROCESS START ===');
    
    // ✅ Ensure restaurant details are loaded first
    await this.ensureRestaurantDetails();
    
    console.log('✅ Restaurant details:', this.restaurantDetails);

    // Method 1: Try using payment data with items
    const paymentWithItems = this.collectPayments.find(p => p.orderID === orderId && p.items) || 
                            this.verifyPayments.find(p => p.orderID === orderId && p.items);
    
    if (paymentWithItems && paymentWithItems.items && paymentWithItems.items.length > 0) {
      console.log('✅ Using payment data with items');
      await this.printWithPaymentItems(orderId, paymentWithItems);
      return;
    }

    // Method 2: Try using basic payment data
    const anyPayment = this.collectPayments.find(p => p.orderID === orderId) || 
                      this.verifyPayments.find(p => p.orderID === orderId);
    
    if (anyPayment) {
      console.log('✅ Using basic payment data');
      await this.simplePrintOrderBill(orderId);
      return;
    }

    // Method 3: Fallback
    console.log('❌ No payment data found, using fallback');
    this.pushAlert('order', `❌ Cannot print - no data for Order #${orderId}`);

  } catch (error) {
    console.error('❌ All print methods failed:', error);
    this.pushAlert('order', `⚠️ Printing failed for Order #${orderId}`);
  }
}

private async printWithPaymentItems(orderId: number, paymentData: any): Promise<void> {
  // Ensure restaurant details are loaded
  if (!this.restaurantDetails.name) {
    await this.loadRestaurantDetails();
  }

  // Get the complete order with customizations
  const order = this.orders.find(o => o.orderID === orderId) || 
                this.historyOrders.find(o => o.orderID === orderId);

  if (!order || !order.items) {
    console.error('Order not found for printing');
    return;
  }
    const orderNumber = order.orderNumber || orderId;


  // Build items array including customizations
  const printItems: any[] = [];
  
  order.items.forEach(item => {
    // Add main product
    printItems.push({
      "Name": this.truncateText(item.productName || `Item`, 20),
      "Qty": item.quantity,
      "Price": item.unitPrice, // This should now include customization prices
      "Modifiers": []
    });

    // ✅ FIX: Add customizations as separate line items
    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach((customization: any) => {
        printItems.push({
          "Name": this.truncateText(`  + ${customization.optionName}`, 18),
          "Qty": 1,
          "Price": customization.fixedPrice || 0,
          "Modifiers": []
        });
      });
    }
  });

  const printData = {
    "Type": "BILL",
    "PrinterName": "RP327 Printer",
    "RestaurantName": this.restaurantDetails.name,
    "RestaurantAddress": this.restaurantDetails.address,
    "Order": {
  
        "OrderNumber": orderNumber.toString(), // ✅ USE ORDER NUMBER
      "TableNo": paymentData.tableNo?.toString() || "0",
      "Items": printItems,
      "ServiceCharge": 0,
      "Tax": 0,
      "Discount": 0,
      "Total": paymentData.amount,
      "Notes": "Thank you for your visit!"
    }
  };

  const response = await firstValueFrom(
    this.http.post(this.PRINT_API, printData, this.httpOptions)
  );
  
  console.log('✅ Print with customizations successful');
}
private async loadRestaurantDetails(): Promise<void> {
  try {
    if (!this.restaurantId) {
      console.warn('No restaurant ID available for loading details');
      return;
    }

    console.log('🔄 Loading restaurant details for ID:', this.restaurantId);
    
    // ✅ FIX: Use the correct endpoint path
    const response: any = await firstValueFrom(
      this.http.get(`${this.API_BASE}/order/restaurant/${this.restaurantId}/details`, this.httpOptions)
    );
    
    console.log('📥 Restaurant details response:', response);
    
    if (response) {
      this.restaurantDetails = {
        name: response.name || 'Restaurant',
        address: response.address || 'Address not available',
        upiId: response.upiId || response.upi_ID,
        upiName: response.upiName || response.upi_Name || response.name
      };
      console.log('✅ Restaurant details loaded:', this.restaurantDetails);
    } else {
      console.warn('⚠️ No restaurant details in response');
    }
  } catch (error) {
    console.error('❌ Error loading restaurant details:', error);
    // Use fallback values
    this.restaurantDetails = {
      name: 'Restaurant',
      address: 'Address not available',
      upiId: '',
      upiName: ''
    };
  }
}
// Fix these methods in your WaiterComponent

// CORRECTED: Get the actual base product price


// CORRECTED: Calculate order total properly
calculateOrderTotal(order: any): number {
  if (!order.items) return 0;
  
  let total = 0;
  order.items.forEach((item: any) => {
    // The unitPrice should already include base price + customizations
    total += (item.unitPrice * item.quantity);
  });
  
  return total;
}

// In waiter.component.ts

// CORRECTED: Calculate customizations total
getCustomizationsTotal(item: any): number {
  if (!item.customizations || !item.customizations.length) return 0;
  
  return item.customizations.reduce((total: number, custom: any) => {
    // Use the fixedPrice from the customization data sent by the backend
    const price = custom.fixedPrice || (custom.CustomizationOption ? custom.CustomizationOption.FixedPrice : 0);
    return total + (price || 0);
  }, 0);
}

// CORRECTED: Get the item's base price by subtracting customizations from the total unit price
getItemBasePrice(item: any): number {
  const customizationsTotal = this.getCustomizationsTotal(item);
  // Subtract the customization total from the final unit price sent by the API.
  // Use Math.max to prevent negative numbers if data is inconsistent.
  return Math.max(0, (item.unitPrice || 0) - customizationsTotal);
}
async enhancedPrintOrderBill(orderId: number): Promise<void> {
  try {
    // Ensure restaurant details are loaded
    if (!this.restaurantDetails.name) {
      await this.loadRestaurantDetails();
    }

    const order = this.orders.find(o => o.orderID === orderId) || 
                  this.historyOrders.find(o => o.orderID === orderId);
    
    if (!order) {
      console.warn('Order not found for printing');
      return;
    }

    // Calculate totals properly
    const subtotal = this.calculateOrderTotal(order);
    const tax = subtotal * 0.05;
    const serviceCharge = subtotal * 0.10;
    const total = subtotal + tax + serviceCharge;

    const printData = {
      "Type": "BILL",
      "PrinterName": "RP327 Printer",
      "RestaurantName": this.restaurantDetails.name,
      "RestaurantAddress": this.restaurantDetails.address,
      "Order": {
        "OrderNumber": orderId.toString(),
        "TableNo": order.tableNo?.toString() || "Takeaway",
        "Items": order.items?.map(item => ({
          "Name": this.truncateText(item.productName || `Item ${item.productID}`, 18),
          "Qty": item.quantity,
          "Price": item.unitPrice || 0,
          "Modifiers": item.customizations ? 
            item.customizations.map(c => c.optionName).slice(0, 2) : []
        })) || [],
        "ServiceCharge": serviceCharge,
        "Tax": tax,
        "Discount": 0,
        "Total": total,
        "Notes": "Payment completed successfully"
      }
    };

    const response: any = await firstValueFrom(
      this.http.post(this.PRINT_API, printData, this.httpOptions)
    );

    if (response && typeof response === 'string' && response.includes('Print job queued')) {
      this.pushAlert('order', `✅ Thermal bill printed for Order #${orderId}`);
    } else {
      throw new Error('Print job may have failed');
    }

  } catch (error) {
    console.error('Thermal printing error:', error);
    this.pushAlert('order', `⚠️ Printing failed for Order #${orderId}`);
  }
}
// Helper method to truncate long text for thermal printer
private truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
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
// In waiter.component.ts

private async getOrders(): Promise<void> {
  if (!this.restaurantId) return;

  try {
    const res = await firstValueFrom(
      this.http.get<any>(`${this.API_BASE}/order/with-waiter?restaurantId=${this.restaurantId}`, this.httpOptions)
    );
    
    const all = this.unwrapArray<any>(res.orders).map(o => this.mapOrderFromApi(o));

    this.orders = all.filter(o =>
      o.orderStatus === OrderStatus.Pending || 
      o.orderStatus === OrderStatus.Confirmed ||
      o.orderStatus === OrderStatus.Served
    );

    this.allHistoryOrders = all.filter(o =>
      o.orderStatus === OrderStatus.Completed ||
      (o.orderStatus === OrderStatus.Served && 
       o.latestPayment?.status === 'Success')
    );

    this.applyHistoryFilter();
    this.groupedUpcomingOrders = this.groupOrdersByTable(this.orders);
    
    // --- THIS BLOCK ---
    // if (!this.selectedTableNo && this.groupedUpcomingOrders.length > 0) {
    //   this.selectedTableNo = this.groupedUpcomingOrders[0].tableNo;
    // }
    // --- IS REPLACED BY THIS ---
    this.runTableSelectionLogic(); // ✅ Use the new helper function

    this.updateReadyTables();
    
    console.log('✅ Orders refreshed. Total active orders:', this.orders.length);

  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

private mapOrderFromApi(o: any): Order {
  let latestPayment: PaymentInfo | undefined = undefined;
  
  if (o.latestPayment) {
    latestPayment = {
      method: o.latestPayment.method,
      status: o.latestPayment.status,
      amount: o.latestPayment.amount,
      paidAt: o.latestPayment.paidAt ? new Date(o.latestPayment.paidAt) : null,
      paymentID: o.latestPayment.paymentID || o.latestPayment.paymentId,
      paymentId: o.latestPayment.paymentId || o.latestPayment.paymentID
    };
  }
  
  // ✅ STORE ORDER NUMBER MAPPING
  if (o.orderNumber) {
    this.orderNumberMap[o.orderID] = o.orderNumber;
  }
  
  return {
    orderID: o.orderID,
    orderNumber: o.orderNumber || o.orderID, // ✅ ADD ORDER NUMBER (fallback to orderID)
    tableNo: o.tableNo,
    totalAmount: o.totalAmount,
    orderStatus: this.mapOrderStatus(o.orderStatus),
    kitchenStatus: o.kitchenStatus ? this.mapKitchenStatus(o.kitchenStatus) : KitchenStatus.Pending,
    items: this.unwrapArray<any>(o.items).map((i: any) => ({
      productID: i.productID,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice, 
      orderItemID: i.orderItemID || i.orderItemId || i.id || i.OrderItemID,
      customizations: i.customizations || []
    })),
    createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
    closedAt: o.closedAt ? new Date(o.closedAt) : undefined,
    latestPayment: latestPayment
  };
}


isOrderPaid(order: Order): boolean {
  return order.latestPayment?.status === 'Success' || 
         order.latestPayment?.status === 'Paid' ||
         order.latestPayment?.status === 'Completed';
}
lyHistoryFilter(): void {
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
 async serveOrder(orderID: number): Promise<void> {
    if (!this.restaurantId) return;
    
    // Find the order to check payment status and get order number
    const order = this.orders.find(o => o.orderID === orderID);
    
    if (!order) return;

    try {
      // Call the serve endpoint
      await firstValueFrom(
        this.http.put(`${this.API_BASE}/Order/${orderID}/serve?restaurantId=${this.restaurantId}`, null, this.httpOptions)
      );
      
      // Refresh orders to reflect the change
      this.getOrders();
      
      const orderReference = order.orderNumber ? `Order #${order.orderNumber}` : `Order #${orderID}`;
      this.pushAlert('order', `✅ ${orderReference} marked as served`);
      
      // Print bill when serving (if not already printed)
      this.printOrderBill(orderID);
    } catch (error: any) {
      console.error('Error serving order:', error);
      const orderReference = order.orderNumber ? `Order #${order.orderNumber}` : `Order #${orderID}`;
      this.pushAlert('order', `❌ Failed to serve ${orderReference}: ${error.error?.message || error.message}`);
    }
  }

// Alternative method if main endpoint has restrictions
alternativeServeOrder(orderID: number): void {
  const payload = {
    orderStatus: OrderStatus.Served,
    changedByUserId: this.getCurrentUserId(),
    bypassPaymentCheck: true
  };

  this.http.put(
    `${this.API_BASE}/Order/${orderID}/status?restaurantId=${this.restaurantId}`,
    payload,
    this.httpOptions
  ).subscribe({
    next: () => {
      this.getOrders();
      this.pushAlert('order', `✅ Order #${orderID} served (alternative method)`);
    },
    error: err => {
      console.error('Alternative serve also failed:', err);
      alert('Failed to serve order. Please try manual status update.');
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
  // ✅ UPDATE: Enhanced cancelOrder to use order numbers
  cancelOrder(order: any): void {
    if (this.isOrderLocked()) {
      return;
    }

    const orderReference = order.orderNumber ? `Order #${order.orderNumber}` : `Order #${order.orderID}`;
    const reason = prompt(`Reason for cancelling ${orderReference}:`);
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
        this.pushAlert('order', `❌ ${orderReference} cancelled`);
        this.showEditOrderModal = false;
      },
      error: (err) => {
        console.error('Error cancelling order:', err);
        alert(`Failed to cancel ${orderReference}: ${err.error?.message || err.message}`);
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

// In waiter.component.ts

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
      
      // ✅✅✅ THE NEW FIX ✅✅✅
      // Instead of refreshing from the server (which has the bug),
      // we manually update our local data with the modal's data.

      // 1. Recalculate the total, since the server won't do it
      this.selectedOrderForEdit.totalAmount = this.calculateOrderTotal(this.selectedOrderForEdit);
      
      // 2. Find the old order in our 'this.orders' list
      const index = this.orders.findIndex(o => o.orderID === this.selectedOrderForEdit.orderID);
      
      if (index !== -1) {
        // 3. Replace the old order with our newly edited version
        // We use a deep copy to ensure Angular detects the change
        this.orders[index] = JSON.parse(JSON.stringify(this.selectedOrderForEdit));
        
        // 4. Re-group the orders (this.orders is now updated)
        this.groupedUpcomingOrders = this.groupOrdersByTable(this.orders);
        
        // 5. Re-run the table selection logic to be safe
        this.runTableSelectionLogic(); 

      } else {
        // Fallback: If we couldn't find it, just refresh everything
        await this.refreshOrdersAfterEdit();
      }
      
      this.showEditOrderModal = false; // Close modal
      
    } else {
      throw new Error(`Only ${successCount} out of ${totalChanges} changes were saved`);
    }

  } catch (error: any) {
    console.error('Error saving order changes:', error);
    this.pushAlert('order', `❌ Error saving changes: ${error.message}`);
    // Refresh data to ensure consistency with the server state
    await this.refreshOrdersAfterEdit();
  } finally {
    this.isSavingChanges = false;
  }
}
// In waiter.component.ts

private async refreshOrdersAfterEdit(): Promise<void> {
  try {
    // ✅ ADD: A short delay (e.g., 500ms) to allow the server's database
    // to commit the changes before we re-fetch the data.
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now, force the complete refresh of orders data
    await this.getOrders();
    
    // (The rest of this function is now redundant, as getOrders() handles everything)

  } catch (error) {
    console.error('Error refreshing orders after edit:', error);
  }
}
// In waiter.component.ts

private runTableSelectionLogic(): void {
  // Check if the currently selected table still has orders
  const selectedTableHasOrders = this.groupedUpcomingOrders.some(g => g.tableNo === this.selectedTableNo);

  // if not, or if no table is selected, pick a new one.
  if (!this.selectedTableNo || !selectedTableHasOrders) {
     if (this.groupedUpcomingOrders.length > 0) {
       // Default to the first table that has orders
       this.selectedTableNo = this.groupedUpcomingOrders[0].tableNo;
     } else {
       // No active orders left, show nothing
       this.selectedTableNo = null; 
     }
  }
  
  this.persistUIState(); // ✅ Good to persist this choice
}
// ✅ ADD: Method to fetch a single order by ID
private async fetchOrderById(orderId: number): Promise<Order | null> {
  try {
    const response: any = await firstValueFrom(
      this.http.get(`${this.API_BASE}/order/with-waiter?restaurantId=${this.restaurantId}`, this.httpOptions)
    );
    
    const allOrders = this.unwrapArray<any>(response.orders).map(o => this.mapOrderFromApi(o));
    return allOrders.find(order => order.orderID === orderId) || null;
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return null;
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
debugCustomizationPricing(order: any): void {
  console.log('🔍 Customization Pricing Debug:');
  
  order.items.forEach((item: any, index: number) => {
    const basePrice = this.getItemBasePrice(item);
    const customTotal = this.getCustomizationsTotal(item);
    const calculatedUnitPrice = basePrice + customTotal;
    
    console.log(`Item ${index + 1}:`, {
      productName: item.productName,
      basePrice: basePrice,
      customizationTotal: customTotal,
      calculatedUnitPrice: calculatedUnitPrice,
      actualUnitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.unitPrice * item.quantity,
      customizations: item.customizations
    });
  });
  
  console.log('Order Total:', this.calculateOrderTotal(order));
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


private async handlePrintFallback(orderId: number): Promise<void> {
  // Fallback: Open bill in new tab if printing fails
  const billUrl = `${this.API_BASE}/order/${orderId}/bill?restaurantId=${this.restaurantId}`;
  window.open(billUrl, '_blank');
  this.pushAlert('order', `📄 Bill opened in new tab for Order #${orderId}`);
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


openMarkAsPaidModal(order: Order): void {
  console.log('💰 Opening unified payment modal for order:', order);
  
  // Find the payment ID from various sources
  let paymentId = 0;
  
  if (order.latestPayment) {
    paymentId = (order.latestPayment as any).paymentID || 
                (order.latestPayment as any).paymentId || 0;
  }
  
  // If not found in latestPayment, search in pending payments
  if (!paymentId) {
    const collectPayment = this.collectPayments.find(p => p.orderID === order.orderID);
    if (collectPayment) {
      paymentId = collectPayment.paymentID || collectPayment.paymentId;
    }
  }

  this.markAsPaidModal = {
    open: true,
    orderId: order.orderID,
    orderNumber: order.orderNumber || order.orderID, // ✅ ADD ORDER NUMBER
    tableNo: order.tableNo || 0,
    amount: order.totalAmount || 0,
    selectedMethod: order.latestPayment?.method === 'UPI' ? 'UPI' : 'Cash', // Default based on existing method
    busy: false,
    paymentId: paymentId
  };
}

// Enhanced confirmMarkAsPaid to handle both new payments and existing payments
async confirmMarkAsPaid(): Promise<void> {
  if (!this.restaurantId) return;

  this.markAsPaidModal.busy = true;

  try {
    let paymentId = this.markAsPaidModal.paymentId;

    // If no payment ID exists, create a new payment record
    if (!paymentId) {
      console.log('🆕 Creating new payment record for order:', this.markAsPaidModal.orderId);
      
      const response: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/payments/initiate?orderId=${this.markAsPaidModal.orderId}&restaurantId=${this.restaurantId}&method=${this.markAsPaidModal.selectedMethod}&channel=Waiter`,
          {},
          this.httpOptions
        )
      );

      if (response && response.paymentId) {
        paymentId = response.paymentId;
        console.log('✅ Created payment with ID:', paymentId);
      } else {
        throw new Error('Failed to create payment record');
      }
    }

    // Mark payment as completed
    console.log('✅ Marking payment as completed:', paymentId);
    await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    // Print bill automatically
    await this.printOrderBill(this.markAsPaidModal.orderId);

   const orderReference = this.markAsPaidModal.orderNumber ? 
        `Order #${this.markAsPaidModal.orderNumber}` : 
        `Order #${this.markAsPaidModal.orderId}`;

    // Success handling
    this.pushAlert('payment', `✅ ${this.markAsPaidModal.selectedMethod} payment received for Order #${this.markAsPaidModal.orderId}`);
    
    // Close modal and refresh data
    this.closeMarkAsPaidModal();
    this.getOrders();
    this.fetchPendingPayments();

  } catch (error: any) {
    console.error('❌ Error marking order as paid:', error);
     const orderReference = this.markAsPaidModal.orderNumber ? 
        `Order #${this.markAsPaidModal.orderNumber}` : 
        `Order #${this.markAsPaidModal.orderId}`;
    this.pushAlert('payment', `❌ Failed to mark as paid: ${error.error?.message || error.message}`);
  } finally {
    this.markAsPaidModal.busy = false;
  }
}

// New method to create payment if none exists
private async createPaymentForOrder(order: Order): Promise<void> {
  try {
    console.log('🆕 Creating new payment record for order:', order.orderID);
    
    const response: any = await firstValueFrom(
      this.http.post(
        `${this.API_BASE}/order/payments/initiate?orderId=${order.orderID}&restaurantId=${this.restaurantId}&method=Cash&channel=Waiter`,
        {},
        this.httpOptions
      )
    );

    if (response && response.paymentId) {
      console.log('✅ Created payment with ID:', response.paymentId);
      
      // Immediately mark as paid
      await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${response.paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );

      this.pushAlert('payment', `✅ Created and marked Order #${order.orderID} as paid`);
      this.getOrders(); // Refresh orders
      this.printOrderBill(order.orderID);
    } else {
      throw new Error('No payment ID in response');
    }
  } catch (error: any) {
    console.error('Error creating payment:', error);
    this.pushAlert('payment', `❌ Failed to create payment: ${error.error?.message || error.message}`);
  }
}
// Direct method to mark order as paid (for cash payments)
private async markOrderAsPaidDirect(orderId: number, paymentId: number): Promise<void> {
  try {
    await firstValueFrom(
      this.http.put(
        `${this.API_BASE}/order/payments/${paymentId}/complete?restaurantId=${this.restaurantId}`,
        {},
        this.httpOptions
      )
    );

    this.pushAlert('payment', `✅ Cash payment received for Order #${orderId}`);
    this.printOrderBill(orderId);
  } catch (error: any) {
    console.error('Error marking cash payment:', error);
    throw error;
  }
}

// Enhanced payment status badge class with fallbacks
getPaymentStatusBadgeClass(status: string): string {
  if (!status) return 'bg-light text-dark';
  
  const classes: { [key: string]: string } = {
    'Pending': 'bg-warning text-dark',
    'Paid': 'bg-success text-white',
    'Completed': 'bg-success text-white',
    'Success': 'bg-success text-white',
    'Failed': 'bg-danger text-white',
    'Refunded': 'bg-secondary text-white'
  };
  return classes[status] || 'bg-light text-dark';
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