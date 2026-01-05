import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { Router, ActivatedRoute, NavigationStart } from '@angular/router';
import { environment } from '../../environments/environment';
import { PendingPaymentsComponent } from '../pending-payments/pending-payments.component';  
import { NewOrderComponent } from '../new-order/new-order.component';
import { QRCodeComponent } from 'angularx-qrcode';
import { firstValueFrom } from 'rxjs'; 
import { AuthService } from '../services/auth.service'; 

export enum OrderStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Served = "Served",
  Completed = "Completed",
  Cancelled = "Cancelled"
}
export enum KitchenStatus {
  Pending = "Pending",
  Preparing = "Preparing",
  Ready = "Ready"
}
export interface OrderItem {
  productID: number;
  productName?: string;
  quantity: number;
  customizations?: any[]; 
  unitPrice?: number;
  orderItemID?: number; 

}

export interface PaymentInfo {
  method: string;
  status: string;
  amount: number;
  paidAt?: Date | null;
  paymentID?: any; 
  paymentId?: any;
}
export interface Order {
  orderID: number;
  orderNumber: number;
  userID?: number;
  orderStatus: OrderStatus;
  waiterUserID?: number;
  isAssigned?: boolean;
  tableNo?: number;
  items?: OrderItem[];
  createdAt?: Date;
  closedAt?: Date;
  latestPayment?: PaymentInfo;   
  kitchenStatus?: KitchenStatus;  
  totalAmount?: number; 
  paymentMethod?: string; 
  paymentStatus?: string; 

}
export interface RestaurantDetails {
  name: string;
  address: string;
  upiId?: string;
  upiName?: string;
}
export interface WaiterRequest {
  waiterRequestID: number;
  message: string;
  tableNumber: number;
  requestTime: string;
  isAccepted?: boolean;
}

@Component({
  selector: 'app-waiter',
  standalone: true,
  templateUrl: './waiter.component.html',
  styleUrls: ['./waiter.component.css'],
  encapsulation: ViewEncapsulation.None,


  imports: [CommonModule, FormsModule, HttpClientModule, PendingPaymentsComponent, NewOrderComponent, QRCodeComponent],
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
  KitchenStatus = KitchenStatus;  
  error = '';
  isSidebarOpen = false;
  selectedSection: 'orders' | 'requests' | 'history' | 'pendingPayments' | 'readyOrders' | 'newOrder' = 'orders';
  pendingPayments: any[] = [];
  restaurantId: number = 0; 
  showProductList = false;
  productSearch = '';
  selectedCategory = '';
  productCategories: string[] = [];
  filteredAvailableProducts: any[] = [];
  productQuantities: Map<number, number> = new Map();
  private newOrderSound = new Audio('assets/sounds/new-order.mp3');
  private readyOrderSound = new Audio('assets/sounds/ready-order.mp3');
  private paymentSound = new Audio('assets/sounds/payment-pending.mp3');
  activeAlerts: { type: 'order' | 'ready' | 'payment', message: string, timestamp: number }[] = [];
  orderNumberMap: { [orderID: number]: number } = {}; 
  viewMode: 'grid' | 'list' = 'grid';
  selectedStatus = 'all';
  statusFilters = ['all', 'pending', 'confirmed', 'served'];

  restaurantDetails: RestaurantDetails = {
    name: 'Restaurant',
    address: 'Address not available',
    upiId: '',
    upiName: ''
  };
  groupedUpcomingOrders: { tableNo: number; orders: Order[]; expanded: boolean }[] = [];
  readyTables: { tableNo: number, orders: Order[] }[] = [];
  selectedReadyTable: number | null = null;
  upcomingOrdersSorted: Order[] = [];
  lastSeenOrderID: number = Number(localStorage.getItem('lastSeenOrderID') || 0);
  selectedTableNo: number | null = null;
  historyFilter: 'today' | '2days' | 'all' = 'today';
  allHistoryOrders: Order[] = [];  
  availableTables: any[] = []; 

  selectedOrderForEdit: any = null;
  showEditOrderModal = false;
  availableProducts: any[] = [];
  orderChangeHistory: any[] = [];
  showChangeHistoryModal = false;
  selectedProductCategory: string = '';
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
    orderNumber: 0

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
    orderNumber: 0 

  };

  busyCollect = false;


  unreadRequests: any[] = [];
  private requestPollingInterval: any;
  private notificationSound = new Audio('assets/sounds/notification.mp3');


  private notificationCheckInterval: any;

  private readonly API_BASE = `${environment.apiUrl}`;

  private httpOptions: { headers: HttpHeaders } = { headers: new HttpHeaders() };

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, private auth: AuthService) {
    this.setupRouterEvents(); 

  }

  ngOnInit(): void {
 
    this.route.params.subscribe(params => {
      const routeRestaurantId = params['restaurantId'];

      if (routeRestaurantId) {
        this.restaurantId = +routeRestaurantId;
        this.initializeDashboard(); 
      } else {

        this.showRestaurantError();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.persistUIState();
    });
  }

  getShareableUrl(): string {
    const baseUrl = window.location.origin + window.location.pathname;
    return baseUrl; 
  }

  refreshUrl(): void {
    this.updateUrlWithRestaurantId();
  }
  private updateUrlWithRestaurantId(): void {
    const currentUrl = this.router.url;

    if (!currentUrl.includes('restaurantId=') && this.restaurantId) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { restaurantId: this.restaurantId },
        queryParamsHandling: 'merge', 
        replaceUrl: true 
      });
    }
  }
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
    const persistedRestaurantId = localStorage.getItem('waiter_restaurantId');
    if (persistedRestaurantId) {
      this.restaurantId = +persistedRestaurantId;
      this.initializeDashboard();
      this.updateUrlWithRestaurantId(); 
      return;
    }

    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      this.restaurantId = user.restaurantId || user.restaurantID || 0;
    }

    if (this.restaurantId) {
      localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
      this.initializeDashboard();
      this.updateUrlWithRestaurantId(); 
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

    localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
    this.updateUrlWithRestaurantId();
    this.restoreUIState();

    document.title = `Waiter Dashboard - Restaurant ${this.restaurantId}`;

    this.httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };

    this.loadRestaurantDetails();

    // Initialize all data
    this.getOrders();
    this.getWaiterRequests();
    this.checkForReadyNotifications();
    this.setupNotificationPolling();
    this.setupRequestPolling();
    this.setupPaymentPolling();

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

  private validateUrl(): void {
    const currentUrl = new URL(window.location.href);
    const urlParams = new URLSearchParams(currentUrl.search);
    const urlRestaurantId = urlParams.get('restaurantId');

    if (urlRestaurantId && +urlRestaurantId !== this.restaurantId) {
      this.restaurantId = +urlRestaurantId;
      localStorage.setItem('waiter_restaurantId', this.restaurantId.toString());
    }

    if (this.restaurantId && !urlRestaurantId) {
      this.updateUrlWithRestaurantId();
    }
  }
  copyShareableUrl(): void {
    navigator.clipboard.writeText(this.getShareableUrl()).then(() => {
    });
  }
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
    this.persistUIState(); 

    this.loadPendingByTab();
  }

  async placeWaiterOrder(paymentPreference: 'PayNow' | 'PayLater' = 'PayLater'): Promise<void> {
    try {
      const orderPayload = {
        
      };

      const response: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/generate?restaurantId=${this.restaurantId}&source=waiter&paymentPreference=${paymentPreference}`,
          orderPayload,
          this.httpOptions
        )
      );

      if (paymentPreference === 'PayNow') {
    
      } else {
   
      }

      this.getOrders(); 
    } catch (error) {
      console.error('Error placing waiter order:', error);
    }
  }

  private setupPaymentPolling(): void {
    this.fetchPendingPayments();

    setInterval(() => {
      if (this.selectedSection === 'pendingPayments') {
        this.fetchPendingPayments();
      }
    }, 10000); 

    setInterval(() => {
      if (this.selectedSection === 'pendingPayments') {
        this.checkForNewPendingPayments();
      }
    }, 5000); 
  }
  private loadPendingByTab(): void {

    this.fetchPendingPayments();
  }

  private splitPending(payments: any[]) {
    this.verifyPayments = payments.filter(p =>
      p.paymentChannel === 0 ||
      p.source?.toLowerCase() === 'customer' ||
      (p.paymentChannel === undefined && p.source?.toLowerCase() !== 'waiter')
    ).map(p => ({
      ...p,
      orderNumber: p.orderNumber || p.orderID 
    }));

    this.collectPayments = payments.filter(p =>
      p.paymentChannel === 1 ||
      p.source?.toLowerCase() === 'waiter' ||
      (p.paymentChannel === undefined && p.source?.toLowerCase() === 'waiter')
    ).map(p => ({
      ...p,
      orderNumber: p.orderNumber || p.orderID 
    }));

    console.log('Verify Payments:', this.verifyPayments);
    console.log('Collect Payments:', this.collectPayments);
  }
  selectTableForOrders(tableNo: number): void {
    this.selectedTableNo = tableNo;
    this.persistUIState(); 

  }

  private setupPendingPaymentPolling(): void {
    this.fetchPendingPayments(); 
    setInterval(() => this.fetchPendingPayments(), 10000);
  }

  navigateToNewOrder(): void {
    this.selectedSection = 'newOrder'; 
  }

  onNewOrderPlaced(e: {
    orderID: number;
    orderNumber?: number; 

    paymentStatus?: string;
    paymentMethod?: string;
    paymentPreference?: string
  }) {
    if (e.paymentPreference === 'PayNow') {
      if (e.paymentStatus === 'created') {
      } else if (e.paymentStatus === 'paid') {
      }
    } else {
     
    }
    this.getOrders();
  }

  onNewOrderClosed() {
    this.selectedSection = 'orders';
    this.getOrders(); 
  }

  private refreshHistoryOnly(): void {
    if (!this.restaurantId) return;

    this.http.get<any>(`${this.API_BASE}/order/with-waiter?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: res => {
          const all = this.unwrapArray<any>(res.orders).map(o => ({
            orderID: o.orderID,
            orderNumber: o.orderNumber || o.orderID, 
            tableNo: o.tableNo,
            totalAmount: o.totalAmount,
            orderStatus: this.mapOrderStatus(o.orderStatus),
            kitchenStatus: o.kitchenStatus ? this.mapKitchenStatus(o.kitchenStatus) : KitchenStatus.Pending,
            items: this.unwrapArray<any>(o.items).map(i => ({
              productID: i.productID,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice ?? 0 
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

    this.persistUIState(); 
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

  clearAllNotifications() {
    this.http.delete('/api/WaiterRequest/clear-all').subscribe(() => {
      this.waiterRequests = [];
    });
  }

  markPaymentPaid(payment: any): void { 


    const paymentID = payment.paymentID || payment.paymentId || payment.id || payment.PaymentID;


    if (!paymentID) {
      console.error('Invalid paymentID: undefined. Full payment object:', payment);
      return;
    }


    this.http.put(`${this.API_BASE}/order/pending-payments/${paymentID}/clear?restaurantId=${this.restaurantId}`, null, this.httpOptions)
      .subscribe({
        next: (response: any) => {
          alert(response.message);
          this.pendingPayments = this.pendingPayments.filter(p =>
            (p.paymentID || p.paymentId || p.id || p.PaymentID) !== paymentID
          );
          this.verifyPayments = this.verifyPayments.filter(p =>
            (p.paymentID || p.paymentId || p.id || p.PaymentID) !== paymentID
          );
          this.collectPayments = this.collectPayments.filter(p =>
            (p.paymentID || p.paymentId || p.id || p.PaymentID) !== paymentID
          );

          this.fetchPendingPayments();
        },
        error: (err) => {
          console.error('Failed to clear payment:', err);
        }
      });
  }
  logout(): void {
    if (confirm('Are you sure you want to log out?')) {
      this.auth.logout(); 
    }
  }




  setupNotificationPolling(): void {
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
                const msg = ` Order #${orderNumber} for Table ${n.tableNo} is ready to serve.`;

                this.readyOrderSound.play().catch(() => { });
                this.vibrate();

                this.readyOrderMessages.push({
                  notificationId: n.notificationId,
                  message: msg,
                  orderId: n.orderId,
                  orderNumber: orderNumber, 
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
        const orderNumber = n.orderNumber || n.orderId; 
        const message = `Table ${n.tableNo} → Order #${orderNumber} is ready to serve!`;

        this.readyOrderMessages.push({
          notificationId: n.notificationId,
          message: message,
          orderId: n.orderId,
          orderNumber: orderNumber, 
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
    this.openMarkAsPaidModal(order);
  }
  private ensureRestaurantDetails(): Promise<void> {
    return new Promise(async (resolve) => {
      if (this.restaurantDetails.name && this.restaurantDetails.name !== 'Restaurant' &&
        this.restaurantDetails.address && this.restaurantDetails.address !== 'Address not available') {
        resolve();
        return;
      }

      await this.loadRestaurantDetails();
      resolve();
    });
  }

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
  async initiateUpi() {
    if (!this.restaurantId) return;

    this.busyCollect = true;
    try {
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
      console.log(' No restaurant ID available for fetching payments');
      return;
    }


    this.http.get<any[]>(`${this.API_BASE}/order/pending-payments?restaurantId=${this.restaurantId}`, this.httpOptions)
      .subscribe({
        next: (payments) => {

          this.pendingPayments = (payments || []).map(p => ({
            ...p,
            paymentId: p.paymentID || p.paymentId || p.id,
            orderNumber: p.orderNumber || p.orderID 
          }));

          this.splitPending(this.pendingPayments);
          console.log(' Payments updated:', {
            total: this.pendingPayments.length,
            verify: this.verifyPayments.length,
            collect: this.collectPayments.length
          });
        },
        error: err => {
          console.error(' Error fetching pending payments:', err);
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

            this.paymentSound.play().catch(() => { });
            this.vibrate();

            this.pendingPayments = [...newPayments, ...this.pendingPayments];
            this.splitPending(this.pendingPayments);

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

          }
        },
        error: err => console.error('Error checking new payments:', err)
      });
  }


  async testPaymentEndpoints(): Promise<void> {
    if (!this.collectModal.paymentId) return;


    try {
      const status: any = await firstValueFrom(
        this.http.get(
          `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/status?restaurantId=${this.restaurantId}`,
          this.httpOptions
        )
      );

      const complete: any = await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );

    } catch (error: any) {
      console.error(' Endpoint test failed:', error);
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
      [OrderStatus.Pending]: ['confirm', 'cancel'],
      [OrderStatus.Confirmed]: ['serve', 'cancel'],
      [OrderStatus.Served]: ['complete'],
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
    this.persistUIState(); 

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

    if (this.activeAlerts.some(a => a.message === message)) return;

    this.activeAlerts.push({ type, message, timestamp: now });

    setTimeout(() => {
      this.activeAlerts = this.activeAlerts.filter(a => a.timestamp !== now);
    }, 2000); 
  }

  async markUpiAsPaid(): Promise<void> {
    this.busyCollect = true;
    try {
      const orderReference = this.collectModal.orderNumber ?
        `Order #${this.collectModal.orderNumber}` :
        `Order #${this.collectModal.orderId}`;

      const paymentData = this.collectPayments.find(p =>
        (p.paymentID || p.paymentId) === this.collectModal.paymentId
      );

      console.log('🔍 Payment data for UPI:', paymentData);

      if (!paymentData) {
        throw new Error('Payment data not found');
      }

      await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );

      await this.printOrderBill(this.collectModal.orderId);

      this.onPaymentCleared(this.collectModal.paymentId);
      this.closeCollectModal();

      this.getOrders();

    } catch (error: any) {
      console.error(' Error marking UPI as paid:', error);
    } finally {
      this.busyCollect = false;
    }
  }

  async markCashReceived() {
    this.busyCollect = true;
    try {
      const orderReference = this.collectModal.orderNumber ?
        `Order #${this.collectModal.orderNumber}` :
        `Order #${this.collectModal.orderId}`;

      const paymentData = this.collectPayments.find(p =>
        (p.paymentID || p.paymentId) === this.collectModal.paymentId
      );


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

      // 2. Mark cash payment as completed
      await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${this.collectModal.paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );

      // 3. Print bill
      await this.printOrderBill(this.collectModal.orderId);

      // 4. Success handling
      this.closeCollectModal();

      // 5. Refresh data
      setTimeout(() => {
        this.fetchPendingPayments();
        this.getOrders();
      }, 1000);

    } catch (error: any) {
      console.error(' Error marking cash received:', error);
    } finally {
      this.busyCollect = false;
    }
  }

  debugPaymentData(): void {
    console.log('=== PAYMENT DATA DEBUG ===');
    console.log('Collect Payments:', this.collectPayments);
    console.log('Verify Payments:', this.verifyPayments);
    console.log('Pending Payments:', this.pendingPayments);

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

  }

  openCollectModal(p: any) {


    this.collectModal.open = true;
    this.collectModal.orderId = p.orderID;
    this.collectModal.orderNumber = p.orderNumber || p.orderID; 
    this.collectModal.amount = p.amount;
    this.collectModal.paymentId = p.paymentID || p.paymentId || 0;
    this.collectModal.upiUri = '';
    this.collectModal.tab = 'UPI';

    this.debugPaymentData();
  }



  async printOrderBill(orderId: number): Promise<void> {
    if (!this.restaurantId) return;

    try {
      await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/${orderId}/print-bill?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );

    } catch (error) {
      console.error('Print failed:', error);
    }
  }


  private async loadRestaurantDetails(): Promise<void> {
    try {
      if (!this.restaurantId) {
        console.warn('No restaurant ID available for loading details');
        return;
      }
      const response: any = await firstValueFrom(
        this.http.get(`${this.API_BASE}/order/restaurant/${this.restaurantId}/details`, this.httpOptions)
      );

      if (response) {
        this.restaurantDetails = {
          name: response.name || 'Restaurant',
          address: response.address || 'Address not available',
          upiId: response.upiId || response.upi_ID,
          upiName: response.upiName || response.upi_Name || response.name
        };
      } else {
        console.warn(' No restaurant details in response');
      }
    } catch (error) {
      console.error(' Error loading restaurant details:', error);
      this.restaurantDetails = {
        name: 'Restaurant',
        address: 'Address not available',
        upiId: '',
        upiName: ''
      };
    }
  }
  
  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
  }


  getTableNoFromOrder(orderId: number): number {
    const order = this.orders.find(o => o.orderID === orderId);
    return order?.tableNo || 0;
  }

  setCollectModalTab(tab: 'UPI' | 'CASH'): void {
    this.collectModal.tab = tab;
  }

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
      (o.orderStatus === OrderStatus.Served && !this.isOrderPaid(o)) 
    );

    this.allHistoryOrders = all.filter(o =>
      o.orderStatus === OrderStatus.Completed ||
      o.orderStatus === OrderStatus.Cancelled ||
      (o.orderStatus === OrderStatus.Served && this.isOrderPaid(o))
    );

    this.applyHistoryFilter();
    this.groupedUpcomingOrders = this.groupOrdersByTable(this.orders);
    this.runTableSelectionLogic();
    this.updateReadyTables();

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
      paidAt: o.latestPayment.paidAt
        ? new Date(o.latestPayment.paidAt)
        : null,
      paymentID: o.latestPayment.paymentID || o.latestPayment.paymentId,
      paymentId: o.latestPayment.paymentId || o.latestPayment.paymentID
    };
  }

  if (o.orderNumber) {
    this.orderNumberMap[o.orderID] = o.orderNumber;
  }

  return {
    orderID: o.orderID,
    orderNumber: o.orderNumber || o.orderID,
    tableNo: o.tableNo,
    totalAmount: o.totalAmount,
    orderStatus: this.mapOrderStatus(o.orderStatus),
    kitchenStatus: o.kitchenStatus
      ? this.mapKitchenStatus(o.kitchenStatus)
      : KitchenStatus.Pending,

    items: this.unwrapArray<any>(o.items).map((i: any) => {
      const customizationTotal =
        (i.customizations || []).reduce(
          (sum: number, c: any) =>
            sum + (c.fixedPrice ?? c.price ?? 0),
          0
        );

      return {
        productID: i.productID,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: (i.unitPrice ?? 0) + customizationTotal,
        orderItemID:
          i.orderItemID || i.orderItemId || i.id || i.OrderItemID,
        customizations: i.customizations || []
      };
    }),

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

    this.persistUIState(); 
  }

  toggleTableGroup(tableGroup: any): void {
    tableGroup.expanded = !tableGroup.expanded;
  }



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


  get readyToServeOrders(): Order[] {
    return this.orders.filter(o =>
      o.orderStatus === OrderStatus.Confirmed
    );
  }
  async serveOrder(orderID: number): Promise<void> {
    if (!this.restaurantId) return;

    const order = this.orders.find(o => o.orderID === orderID);

    if (!order) return;

    try {
      await firstValueFrom(
        this.http.put(`${this.API_BASE}/Order/${orderID}/serve?restaurantId=${this.restaurantId}`, null, this.httpOptions)
      );

      this.getOrders();

      const orderReference = order.orderNumber ? `Order #${order.orderNumber}` : `Order #${orderID}`;

      this.printOrderBill(orderID);
    } catch (error: any) {
      console.error('Error serving order:', error);
      const orderReference = order.orderNumber ? `Order #${order.orderNumber}` : `Order #${orderID}`;
    }
  }

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
      },
      error: err => {
        console.error('Alternative serve also failed:', err);
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
      expanded: false  
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
        this.waiterRequests = this.waiterRequests.filter(req => req.waiterRequestID !== requestId);
      },
      error: err => console.error('Error completing request:', err)
    });
  }
  getElapsedTime(dt?: Date): string {
    if (!dt) return '';
    const mins = Math.floor((Date.now() - dt.getTime()) / 60000);
    return mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  }

  updateOrderItemQuantity(item: any, newQuantity: number): void {

    const orderItemID = item.orderItemID || item.orderItemId || item.id || item.OrderItemID || item.itemId;

    if (!orderItemID) {
      console.error(' No valid order item ID found for item:', item);
      return;
    }

    if (this.isOrderLocked()) {

      return;
    }

    if (newQuantity <= 0) {
      this.removeOrderItem(item);
      return;
    }

    this.pendingChanges.quantityUpdates.set(orderItemID, newQuantity);

    const itemIndex = this.selectedOrderForEdit.items.findIndex((i: any) =>
      (i.orderItemID || i.orderItemId || i.id || i.OrderItemID || i.itemId) === orderItemID
    );

    if (itemIndex !== -1) {
      this.selectedOrderForEdit.items[itemIndex].quantity = newQuantity;
    }
this.selectedOrderForEdit.totalAmount =
  this.recalculateOrderTotal(this.selectedOrderForEdit);
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

    const orderReference = order.orderNumber ? `Order #${order.orderNumber}` : `Order #${order.orderID}`;
    const reason = prompt(`Reason for cancelling ${orderReference}:`);
    if (reason === null) return; 

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
    this.isSidebarOpen = false; 
    this.persistUIState(); 
  }
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

    const totalChanges =
      this.pendingChanges.quantityUpdates.size +
      this.pendingChanges.itemsToRemove.length +
      this.pendingChanges.itemsToAdd.length +
      (tableHasChanged ? 1 : 0);

    if (tableHasChanged) {
      const payload = {
        newTableNo: +this.selectedOrderForEdit.tableNo,
        changedByUserId: this.getCurrentUserId()
      };
      await firstValueFrom(
        this.http.put(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/change-table?restaurantId=${this.restaurantId}`, payload, this.httpOptions)
      );
      successCount++;
    }

    for (const [orderItemID, newQuantity] of this.pendingChanges.quantityUpdates) {
      const payload = {
        quantity: newQuantity,
        changedByUserId: this.getCurrentUserId()
      };
      await firstValueFrom(
        this.http.put(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/update-item/${orderItemID}?restaurantId=${this.restaurantId}`, payload, this.httpOptions)
      );
      successCount++;
    }

    for (const orderItemID of this.pendingChanges.itemsToRemove) {
      const payload = {
        quantity: 0,
        changedByUserId: this.getCurrentUserId()
      };
      await firstValueFrom(
        this.http.put(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/update-item/${orderItemID}?restaurantId=${this.restaurantId}`, payload, this.httpOptions)
      );
      successCount++;
    }

    for (const item of this.pendingChanges.itemsToAdd) {
      const payload = {
        productID: item.productID,
        quantity: item.quantity,
        changedByUserId: this.getCurrentUserId()
      };
      await firstValueFrom(
        this.http.post(`${this.API_BASE}/order/${this.selectedOrderForEdit.orderID}/add-item?restaurantId=${this.restaurantId}`, payload, this.httpOptions)
      );
      successCount++;
    }

    if (successCount === totalChanges) {
      const newTotal = this.recalculateOrderTotal(this.selectedOrderForEdit);
      this.selectedOrderForEdit.totalAmount = newTotal;

      const index = this.orders.findIndex(o => o.orderID === this.selectedOrderForEdit.orderID);
      if (index !== -1) {
        this.orders[index] = JSON.parse(JSON.stringify(this.selectedOrderForEdit));

        if (this.orders[index].latestPayment && this.orders[index].latestPayment?.status === 'Pending') {
          this.orders[index].latestPayment!.amount = newTotal;
        }
      }

      this.groupedUpcomingOrders = this.groupOrdersByTable(this.orders);
      this.runTableSelectionLogic();

      this.resetPendingChanges();
      this.showEditOrderModal = false;
      
      setTimeout(() => this.getOrders(), 1500);

    } else {
      throw new Error('Some changes could not be saved');
    }

  } catch (error: any) {
    console.error(' Error saving order changes:', error);
  } finally {
    this.isSavingChanges = false;
  }
}
  

  private async refreshOrdersAfterEdit(): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.getOrders();

    } catch (error) {
      console.error('Error refreshing orders after edit:', error);
    }
  }
  private runTableSelectionLogic(): void {
    const selectedTableHasOrders = this.groupedUpcomingOrders.some(g => g.tableNo === this.selectedTableNo);
    if (!this.selectedTableNo || !selectedTableHasOrders) {
      if (this.groupedUpcomingOrders.length > 0) {
        this.selectedTableNo = this.groupedUpcomingOrders[0].tableNo;
      } else {
        this.selectedTableNo = null;
      }
    }

    this.persistUIState(); 
  }
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
        await firstValueFrom(
          this.http.put(
            `${this.API_BASE}/order/payments/${response.paymentId}/complete?restaurantId=${this.restaurantId}`,
            {},
            this.httpOptions
          )
        );
        this.pushAlert('payment', `Cash payment collected for Order #${orderId}`);
      } else {
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
  
  isOrderLocked(): boolean {
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
private recalculateOrderTotal(order: any): number {
  if (!order || !order.items) return 0;

  return order.items.reduce((sum: number, item: any) => {
    const price = item.unitPrice ?? 0;
    const qty = item.quantity ?? 0;
    return sum + (price * qty);
  }, 0);
}

 

addSelectedProductsToOrder(): void {
  if (this.isOrderLocked()) return;

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
          customizations: [] 
        });
      }
    }
  });

  if (productsToAdd.length > 0) {
    this.pendingChanges.itemsToAdd.push(...productsToAdd);
    this.selectedOrderForEdit.items.push(...productsToAdd);
    
    this.selectedOrderForEdit.totalAmount = this.recalculateOrderTotal(this.selectedOrderForEdit);
    
    this.productQuantities.clear();
    this.showProductList = false;
  }
}
removeOrderItem(item: any): void {

  const orderItemID =
    item.orderItemID || item.orderItemId || item.id || item.OrderItemID || item.itemId;

  if (!orderItemID) {
    console.error(' No valid order item ID found for item:', item);
    return;
  }

  if (this.isOrderLocked()) {
    return;
  }

  if (
    confirm(
      `Remove ${item.productName} from order?\nThis change will be saved when you click "Save Changes".`
    )
  ) {
    this.pendingChanges.itemsToRemove.push(orderItemID);

    this.selectedOrderForEdit.items =
      this.selectedOrderForEdit.items.filter((i: any) =>
        (i.orderItemID || i.orderItemId || i.id || i.OrderItemID || i.itemId) !== orderItemID
      );

    this.selectedOrderForEdit.totalAmount =
      this.recalculateOrderTotal(this.selectedOrderForEdit);

  }
}
  openEditOrderModal(order: any): void {
    this.selectedOrderForEdit = JSON.parse(JSON.stringify(order)); 
    this.originalOrderData = JSON.parse(JSON.stringify(order)); 
    this.showProductList = false;
    this.productSearch = '';
    this.selectedCategory = '';
    this.productQuantities.clear();
    this.resetPendingChanges(); 
    this.loadAvailableProducts();
    this.loadAvailableTables(); 

    this.showEditOrderModal = true;
  }
  resetPendingChanges(): void {
    this.pendingChanges = {
      quantityUpdates: new Map<number, number>(),
      itemsToRemove: [],
      itemsToAdd: []
    };
  }
  loadAvailableTables(): void {
    if (!this.restaurantId) return;
    this.http.get<any[]>(`${this.API_BASE}/restauranttables?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (tables) => {
          this.availableTables = tables.sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));
        },
        error: (err) => {
          console.error(' Error loading available tables:', err);
          this.availableTables = []; 
        }
      });
  }
  hasUnsavedChanges(): boolean {
    const tableChanged = this.selectedOrderForEdit?.tableNo !== this.originalOrderData?.tableNo;

    return this.pendingChanges.quantityUpdates.size > 0 ||
      this.pendingChanges.itemsToRemove.length > 0 ||
      this.pendingChanges.itemsToAdd.length > 0 ||
      tableChanged; 
  }


  loadAvailableProducts(): void {
    this.http.get<any[]>(`${environment.apiUrl}/product?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (products) => {
          this.availableProducts = products.filter(p => p.isAvailable);
          this.filterProducts(); 
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

    let paymentId = 0;

    if (order.latestPayment) {
      paymentId = (order.latestPayment as any).paymentID ||
        (order.latestPayment as any).paymentId || 0;
    }

    if (!paymentId) {
      const collectPayment = this.collectPayments.find(p => p.orderID === order.orderID);
      if (collectPayment) {
        paymentId = collectPayment.paymentID || collectPayment.paymentId;
      }
    }

    this.markAsPaidModal = {
      open: true,
      orderId: order.orderID,
      orderNumber: order.orderNumber || order.orderID, 
      tableNo: order.tableNo || 0,
      amount: order.totalAmount || 0,
      selectedMethod: order.latestPayment?.method === 'UPI' ? 'UPI' : 'Cash',
      busy: false,
      paymentId: paymentId
    };
  }

  async confirmMarkAsPaid(): Promise<void> {
    if (!this.restaurantId) return;

    this.markAsPaidModal.busy = true;

    try {
      let paymentId = this.markAsPaidModal.paymentId;

      if (!paymentId) {

        const response: any = await firstValueFrom(
          this.http.post(
            `${this.API_BASE}/order/payments/initiate?orderId=${this.markAsPaidModal.orderId}&restaurantId=${this.restaurantId}&method=${this.markAsPaidModal.selectedMethod}&channel=Waiter`,
            {},
            this.httpOptions
          )
        );

        if (response && response.paymentId) {
          paymentId = response.paymentId;
          console.log(' Created payment with ID:', paymentId);
        } else {
          throw new Error('Failed to create payment record');
        }
      }

      await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );

      await this.printOrderBill(this.markAsPaidModal.orderId);

      const orderReference = this.markAsPaidModal.orderNumber ?
        `Order #${this.markAsPaidModal.orderNumber}` :
        `Order #${this.markAsPaidModal.orderId}`;

      this.closeMarkAsPaidModal();
      this.getOrders();
      this.fetchPendingPayments();

    } catch (error: any) {
      console.error('Error marking order as paid:', error);
      const orderReference = this.markAsPaidModal.orderNumber ?
        `Order #${this.markAsPaidModal.orderNumber}` :
        `Order #${this.markAsPaidModal.orderId}`;
    } finally {
      this.markAsPaidModal.busy = false;
    }
  }

  private async createPaymentForOrder(order: Order): Promise<void> {
    try {

      const response: any = await firstValueFrom(
        this.http.post(
          `${this.API_BASE}/order/payments/initiate?orderId=${order.orderID}&restaurantId=${this.restaurantId}&method=Cash&channel=Waiter`,
          {},
          this.httpOptions
        )
      );

      if (response && response.paymentId) {
        console.log('Created payment with ID:', response.paymentId);

        await firstValueFrom(
          this.http.put(
            `${this.API_BASE}/order/payments/${response.paymentId}/complete?restaurantId=${this.restaurantId}`,
            {},
            this.httpOptions
          )
        );

        this.getOrders();
        this.printOrderBill(order.orderID);
      } else {
        throw new Error('No payment ID in response');
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      this.pushAlert('payment', `Failed to create payment: ${error.error?.message || error.message}`);
    }
  }
  private async markOrderAsPaidDirect(orderId: number, paymentId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(
          `${this.API_BASE}/order/payments/${paymentId}/complete?restaurantId=${this.restaurantId}`,
          {},
          this.httpOptions
        )
      );
      this.printOrderBill(orderId);
    } catch (error: any) {
      console.error('Error marking cash payment:', error);
      throw error;
    }
  }

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


      const paidStatuses = ['Paid', 'Completed', 'Success', 'Success'];
      if (paidStatuses.includes(statusResponse?.status)) {
        this.onPaymentCleared(this.collectModal.paymentId);
        this.closeCollectModal();
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