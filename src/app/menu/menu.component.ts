import { Component, OnInit} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CustomizationModalComponent } from '../customization-modal/customization-modal.component';
import { MatDialogModule } from '@angular/material/dialog';
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { PaymentService } from '../services/payment.service';
import { firstValueFrom } from 'rxjs';

export enum OrderStep {
  MENU = 1,
  ORDER_SUMMARY = 2,
  PAYMENT = 3,
  PAYMENT_PROCESSING = 4,
  RATING = 5
}

interface Product {
  productID: number;
  productName: string;
  price: number; 
  basePrice?: number; 
  productDescription?: string;
  imagePath?: string;
  categoryID: number;
  subCategoryID?: number;
  quantity: number;
  isVeg: boolean;
  isAvailable?: boolean;
  customizationOptions?: CustomizationOption[];
  customizationOptionIds?: number[];
  hasCustomizations?: boolean;
}

interface CartItem extends Product {
  quantity: number;
  customNote?: string;
  customizationOptionIds?: number[];
}

interface CustomizationOption {
  customizationOptionID: number;
  name: string;
  fixedPrice: number;
}

interface Category {
  categoryID: number;
  categoryName: string;
  products: Product[];
  subCategories: SubCategory[];
}

interface Review {
  orderID: number;
  stars: number;
}

interface SubCategory {
  subCategoryID: number;
  subCategoryName: string;
  categoryID: number;
  products: Product[];
}

interface OrderItem {
  productID: number;
  quantity: number;
  customizationOptionIds?: number[]; 
  unitPrice: number;
}

interface OrderSummary {
  orderID: number;
  orderNumber: number; 
  restaurantTableID: number;
  orderItems: Array<{
   productID: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  customNote?: string;
  customizations?: { customizationOptionID: number }[];
  }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  totalAmount: number;
  orderStatus: string; 
}

interface PaymentVerificationResponse {
  paid: boolean;
}

interface Offer {
  offerID: number;
  restaurantID: number;
  code?: string;
  description: string;
  discountAmount?: number;
  discountPercent?: number;
  minBillAmount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  autoApply: boolean;
}

export interface RestaurantInfo {
  restaurantID: number;
  name: string;
  description?: string;
  logoPath?: string;
   upiID?: string;     
  upiName?: string;   
}

export enum OrderStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Served = "Served",
  Completed = "Completed",
  Cancelled = "Cancelled"
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  standalone: true,

  imports: [CommonModule,  QRCodeComponent, FormsModule, HttpClientModule, MatDialogModule],
})
export class MenuComponent implements OnInit {
  private paymentPollTimer: any;
  isAdmin: boolean = false; 
  menuItems: Product[] = [];
  confirmedCart: OrderItem[] = [];
  newCart: OrderItem[] = [];
  orderID: number | null = null;
  categories: Category[] = [];
  subCategories: SubCategory[] = [];
  showWaiterOptions: boolean = false;
  isOrderProcessing: boolean = false;
  currentUserName: string = 'Guest';
  orderSummaryDetails: OrderSummary | null = null;
  restaurantTableID: number = 0;
  userID: number = 0;
  searchQuery: string = '';
  errorMessage: string = '';
  orderConfirmationTime: Date | null = null;
  orderCreatedAt: Date | null = null;
  formattedOrderDate: string = '';
  subCategoryStates: Map<number, boolean> = new Map<number, boolean>();
  currentStep: OrderStep = OrderStep.MENU;
  restaurantID: number = +(localStorage.getItem('restaurantId') || '0'); 
  OrderStep = OrderStep; 
  cartItems: Product[] = []; 
  quantityMap: { [productID: number]: number } = {}; 
  paymentQrData: string = '';
  selectedFilter: 'veg' | 'nonveg' | null = null;
  upiID: string = '';
  showUPIModal = false;
  isLoading: boolean = false;
  orderNumber: number | null = null; 
  upiName: string = 'DigiEat';
  Object = Object;
  submittedReviews = new Set<number>();
  restaurantName: string = '';
  restaurantDescription: string = '';
  restaurantLogoUrl: string = '';
  showCategorySelector = true;
  selectedCategoryID: number | null = null;
  ratings: number = 0;
  submitted: boolean = false;
  private statusPollingTimer: any = null; 
  selectedPaymentMethod: 'cash' | 'upi' | null = null;
  paymentLinks: any = null;
  showUPIOptions = false;
  paymentSuccess = false;
  paymentError = false;
  quantityDebounceTimer: any = null; 
  showConfirmationModal: boolean = false;
  orderStatus: string = '';
  showPaymentConfirmModal: boolean = false;
  showImageModal = false;
  modalImageUrl = '';
  modalImageAlt = '';
  modalImageLoaded = false;
  zoom = 1;
  offers: Offer[] = [];
  appliedOffer: Offer | null = null;
  discountAmount: number = 0;
  private readonly MIN_ZOOM = 1;
  private readonly MAX_ZOOM = 4;

private keydownHandler = (e: KeyboardEvent) => {
  if (this.showImageModal && e.key === 'Escape') this.closeImageModal();
};

private readonly API_BASE = environment.apiUrl;
 constructor(private http: HttpClient, private router: Router,private dialog: MatDialog,private paymentService: PaymentService) { }
private beforeUnloadListener = (event: BeforeUnloadEvent) => {
  this.saveOrderState();
};

async ngOnInit(): Promise<void> {
  this.isLoading = true;
  const queryParams = new URLSearchParams(window.location.search);
  const tableParam = queryParams.get('tableNo');
  const restaurantParam = queryParams.get('restaurantId');
  const stepFromQuery = queryParams.get('step');
  const tableID = tableParam ? +tableParam : +(localStorage.getItem('restaurantTableID') || '0');
  const restaurantID = restaurantParam ? +restaurantParam : +(localStorage.getItem('restaurantId') || '0');
  this.restaurantTableID = tableID;
  this.restaurantID = restaurantID;
  localStorage.setItem('restaurantTableID', String(this.restaurantTableID));
  localStorage.setItem('restaurantId', String(this.restaurantID));
  if (!tableParam || !restaurantParam) {
    const updatedURL = `${window.location.pathname}?tableNo=${this.restaurantTableID}&restaurantId=${this.restaurantID}`;
    window.history.replaceState({}, '', updatedURL);
  }
  const storageKey = `orderState_table_${this.restaurantTableID}`;
  const saved = localStorage.getItem(storageKey);
  let restoredFromStorage = false;

  if (saved) {
    try {
      const state = JSON.parse(saved);
      const createdAt = state.orderCreatedAt ? new Date(state.orderCreatedAt).getTime() : 0;
      const isExpired = Date.now() - createdAt > 60 * 60 * 1000;

      if (isExpired) {
        console.warn('Order expired. Clearing local storage.');
        localStorage.removeItem(storageKey);
      } else {
        const statusResp = await firstValueFrom(
          this.http.get<any>(`${this.API_BASE}/order/status/${state.orderID}?restaurantId=${state.restaurantID}`)
        );

        const status = statusResp.status;
        if (['Completed', 'Cancelled'].includes(status)) {
          console.warn('Order already completed/cancelled. Resetting.');
          localStorage.removeItem(storageKey);
        } else {
          this.orderID = state.orderID;
          this.userID = state.userID;
          this.orderCreatedAt = new Date(state.orderCreatedAt);
          this.confirmedCart = state.confirmedCart || [];
          this.newCart = state.newCart || [];

          const stepFromStorage = +state.currentStep;
          if (this.isValidOrderStep(stepFromStorage)) {
            this.currentStep = stepFromStorage;
            restoredFromStorage = true;
          }
        }
      }
    } catch (err) {
      console.warn('Invalid saved state. Clearing storage.');
      localStorage.removeItem(storageKey);
    }
  }

  if (!restoredFromStorage && stepFromQuery) {
    const parsed = +stepFromQuery;
    if (this.isValidOrderStep(parsed)) {
      this.currentStep = parsed;
    }
  }
  try {
    const restaurantResponse = await firstValueFrom(
      this.http.get<any>(`${this.API_BASE}/RestaurantTable/bynumber?tableNo=${this.restaurantTableID}&restaurantId=${this.restaurantID}`)
    );

    if (!restaurantResponse || !restaurantResponse.restaurantID) {
      throw new Error('Invalid restaurant information.');
    }
    if (restaurantResponse.restaurantID !== this.restaurantID) {
      console.warn('Restaurant ID mismatch. Updating with correct ID.');
      this.restaurantID = restaurantResponse.restaurantID;
      localStorage.setItem('restaurantId', this.restaurantID.toString());
    }

    this.restaurantName = restaurantResponse.name || '';
    this.restaurantDescription = restaurantResponse.description || '';
    this.restaurantLogoUrl = restaurantResponse.logoPath
      ? `${environment.baseUrl}/${restaurantResponse.logoPath.replace(/^\/+/, '')}`
      : '';

  } catch (err) {
    console.error('Failed to load restaurant info from table number and restaurant ID:', err);
        try {
      console.log('Trying fallback with table identifier only...');
      const fallbackResponse = await firstValueFrom(
        this.http.get<any>(`${this.API_BASE}/RestaurantTable/info?tableIdentifier=${this.restaurantTableID}`)
      );

      if (fallbackResponse && fallbackResponse.restaurantID) {
        this.restaurantID = fallbackResponse.restaurantID;
        localStorage.setItem('restaurantId', this.restaurantID.toString());
        
        this.restaurantName = fallbackResponse.name || '';
        this.restaurantDescription = fallbackResponse.description || '';
        this.restaurantLogoUrl = fallbackResponse.logoPath
          ? `${environment.baseUrl}/${fallbackResponse.logoPath.replace(/^\/+/, '')}`
          : '';
        const updatedURL = `${window.location.pathname}?tableNo=${this.restaurantTableID}&restaurantId=${this.restaurantID}`;
        window.history.replaceState({}, '', updatedURL);
      } else {
        throw new Error('Fallback also failed');
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      alert('Invalid table or restaurant information. Please rescan.');
      this.router.navigate(['/']);
      return;
    }
  }
  try {
    await Promise.all([
      this.fetchCategories(),
      this.fetchSubCategories(),
      this.fetchMenuItems()
    ]);

    this.showCategorySelector = true;
    this.selectedCategoryID = null;

    if (
      (this.currentStep === OrderStep.ORDER_SUMMARY ||
       this.currentStep === OrderStep.PAYMENT) &&
      this.orderID
    ) {
      await this.getOrderSummary();
    }

    if (!this.appliedOffer && this.orderSummaryDetails) {
      this.evaluateOffers();
    }

  } catch (err) {
    console.error('Error loading initial data:', err);
  } finally {
    this.isLoading = false;

    if (!this.currentStep) {
      this.currentStep = OrderStep.MENU;
    }

    window.addEventListener('beforeunload', this.beforeUnloadListener);
    window.addEventListener('popstate', this.onPopState);
  }
}

async loadRestaurantInfoFromTableNo(tableNo: number, restaurantId: number): Promise<void> {
  try {
    const url = `${this.API_BASE}/RestaurantTable/bynumber?tableNo=${tableNo}&restaurantId=${restaurantId}`;
    const data: any = await firstValueFrom(this.http.get(url));

    if (!data || !data.restaurantID) {
      throw new Error('Invalid restaurant information.');
    }

    this.restaurantID = data.restaurantID;
    this.restaurantTableID = data.restaurantTableID; 
    this.restaurantName = data.name || '';
    this.restaurantDescription = data.description || '';
    
    if (data.logoPath) {
      const cleanPath = data.logoPath.replace(/^\/+/, '');
      this.restaurantLogoUrl = `${environment.baseUrl}/${cleanPath}`;
    } else {
      this.restaurantLogoUrl = 'assets/images/default-logo.png';
    }

    localStorage.setItem('restaurantID', this.restaurantID.toString());
    localStorage.setItem('restaurantTableID', this.restaurantTableID.toString());

    const updatedURL = `${window.location.pathname}?tableNo=${tableNo}&restaurantId=${restaurantId}`;
    window.history.replaceState({}, '', updatedURL);

  } catch (error) {
    console.error(' Failed to load restaurant info from table number and restaurant ID:', error);
    throw error;
  }
}

getCartTotalAmount(): number {
  return this.newCart.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
}

removeFromCart(productID: number): void {
  const product = this.menuItems.find(p => p.productID === productID);
  if (product) {
    product.quantity = 0;
    product.price = product.basePrice ?? product.price;
  }
  this.newCart = this.newCart.filter(i => i.productID !== productID);
}
fetchOffers(): void {
  if (!this.restaurantID) {
    console.warn("No restaurantID found for fetching offers");
    return;
  }

  this.http.get<Offer[]>(`${this.API_BASE}/offer/restaurant/${this.restaurantID}`).subscribe({
    next: (data) => {
      this.offers = data;
      this.evaluateOffers();
    },
    error: (err) => {
      console.error("Failed to fetch offers:", err);
    }
  });
}

evaluateOffers(): void {
  const subtotal = this.orderSummaryDetails?.subtotal ?? 0;

  const now = new Date();

  const validOffers = this.offers.filter(o =>
    o.isActive &&
    o.autoApply &&
    subtotal >= o.minBillAmount &&
    new Date(o.validFrom) <= now &&
    new Date(o.validTo) >= now
  );
  let bestOffer: Offer | null = null;
  let maxDiscount = 0;

  for (const offer of validOffers) {
    let discount = 0;

    if (offer.discountAmount) {
      discount = offer.discountAmount;
    } else if (offer.discountPercent) {
      discount = (subtotal * offer.discountPercent) / 100;
    }

    if (discount > maxDiscount) {
      maxDiscount = discount;
      bestOffer = offer;
    }
  }
  this.appliedOffer = bestOffer;
  this.discountAmount = maxDiscount;




}
getFormattedDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  return isNaN(parsedDate.getTime()) ? 'N/A' : parsedDate.toLocaleString();
}
async placeFinalOrder(): Promise<void> {
  this.showConfirmationModal = false;

  try {
    const newOrder = await this.submitCartAndProceed();

    if (newOrder) {
      this.orderCreatedAt = new Date(newOrder.createdAt);
      this.formattedOrderDate = this.getFormattedDate(this.orderCreatedAt);
    }

    await this.getOrderSummary();
    this.goToStep(OrderStep.ORDER_SUMMARY);
    this.saveOrderState();

  } catch (error) {
    console.error('Order submission failed:', error);
  }
}
openImageModal(item: any) {
  this.modalImageUrl = this.getImageUrl(item.imagePath);
  this.modalImageAlt = item.productName;
  this.showImageModal = true;
  this.modalImageLoaded = false;
}

closeImageModal() {
  this.showImageModal = false;
  this.modalImageUrl = '';
  this.modalImageAlt = '';
}

onModalImageLoad() {
  this.modalImageLoaded = true;
}
onWheelZoom(event: WheelEvent) {
  event.preventDefault();
  const delta = -event.deltaY / 500;
  this.zoom = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, this.zoom + delta));
}
toggleZoom() {
  this.zoom = (this.zoom === 1) ? 2 : 1;
}
private isValidOrderStep(step: number): step is OrderStep {
  return Object.values(OrderStep).includes(step);
}
finalizeOrder(): void {
    const key = `orderState_table_${this.restaurantTableID}`;
    localStorage.removeItem(key);
    this.orderID = null;
    this.orderNumber = null; 
    this.newCart = [];
    this.confirmedCart = [];
    this.currentStep = OrderStep.MENU;
    this.menuItems.forEach(i => {
      i.quantity = 0;
      i.price = i.basePrice ?? i.price;
    });
    this.showUPIModal = false;
    this.paymentSuccess = false;
    this.paymentError = false;
    this.showUPIOptions = false;
    this.orderSummaryDetails = null;
    this.orderCreatedAt = null;
    this.selectedPaymentMethod = null;
  }

queuePlaceOrder(): void {
  this.submitCartAndProceed();
}
copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard!');
  }).catch((err) => {
    console.error('Clipboard copy failed:', err);
  });
}

private saveOrderState(): void {
  if (!this.orderID) return;

  const safeCreatedAt =
    this.orderCreatedAt instanceof Date && !isNaN(this.orderCreatedAt.getTime())
      ? this.orderCreatedAt
      : new Date(); 

  const state = {
    orderID: this.orderID,
    orderNumber: this.orderNumber, 
    currentStep: this.currentStep,
    orderCreatedAt: safeCreatedAt.toISOString(),
    restaurantTableID: this.restaurantTableID,
    userID: this.userID,
    confirmedCart: this.confirmedCart,
    newCart: this.newCart
  };
  const key = `orderState_table_${this.restaurantTableID}`;
  localStorage.setItem(key, JSON.stringify(state));
  this.updateUrlWithCurrentStep();
}


private updateUrlWithCurrentStep(): void {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('step', String(this.currentStep));
  if (!currentUrl.searchParams.has('tableNo')) {
    currentUrl.searchParams.set('tableNo', String(this.restaurantTableID));
  }
  if (!currentUrl.searchParams.has('restaurantId')) {
    currentUrl.searchParams.set('restaurantId', String(this.restaurantID));
  }
  window.history.replaceState({}, '', currentUrl.toString());
}

private restoreOrderState(): boolean {
  const key = `orderState_table_${this.restaurantTableID}`;
  const savedState = localStorage.getItem(key);
  
  if (!savedState) return false;

  try {
    const state = JSON.parse(savedState);
    
    if (!state.orderID || !state.currentStep) {
      console.warn('Invalid saved state - missing required fields');
      return false;
    }

    const orderAge = Date.now() - new Date(state.orderCreatedAt).getTime();
    if (orderAge > 60 * 60 * 1000) { 
      console.warn('Order expired - clearing saved state');
      localStorage.removeItem(key);
      return false;
    }
    this.orderID = state.orderID;
    this.orderNumber = state.orderNumber || state.orderID; 
    this.currentStep = state.currentStep;
    this.orderCreatedAt = new Date(state.orderCreatedAt);
    this.userID = state.userID;
    this.confirmedCart = state.confirmedCart || [];
    this.newCart = state.newCart || [];
    console.log(' Successfully restored order state');
    return true;
  } catch (err) {
    console.warn('Error parsing saved state', err);
    localStorage.removeItem(key);
    return false;
  }
}
openUPIPaymentModal(): void {
  this.initiateUPIPayment();
  this.showUPIModal = true;
}

closeUPIPaymentModal(): void {
  this.showUPIModal = false;
}
 private generateUPILinks(upiId: string, upiName: string, amount: number, note: string): any {
    const amountStr = amount.toFixed(2);
    const encodedUpiId = encodeURIComponent(upiId);
    const encodedName = encodeURIComponent(upiName);
    const orderReference = this.orderNumber ? `Order #${this.orderNumber}` : `Order ${this.orderID}`;
    const encodedNote = encodeURIComponent(orderReference);
    
    return {
      universal: `https://upilink.vercel.app/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}&cu=INR`,
      direct: `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}`,
      phonePe: `phonepe://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}`,
      gPay: `tez://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}`,
      upiId: upiId,
      amount: amountStr,
      orderId: this.orderID,
      orderNumber: this.orderNumber
    };
  }

handlePaymentError(error: any): void {
  console.error('Payment error:', error);
  this.paymentError = true;
  this.paymentService.stopPaymentPolling();
 }

private startPaymentPolling(): void {
  if (!this.orderID) {
    console.warn('Cannot start payment polling: orderID is null');
    return;
  }
  this.stopPaymentPolling();
  this.paymentPollTimer = setInterval(async () => {
    try {
      const response = await firstValueFrom(
        this.http.get<PaymentVerificationResponse>(
          `${this.API_BASE}/order/${this.orderID}/payment-status?restaurantId=${this.restaurantID}`
        )
      );
      if (response.paid) {
        this.paymentSuccess = true;
        this.stopPaymentPolling();
        this.currentStep = OrderStep.RATING;
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      this.paymentError = true;
      this.stopPaymentPolling();
    }
  }, 5000); 
}

private stopPaymentPolling(): void {
  if (this.paymentPollTimer) {
    clearInterval(this.paymentPollTimer);
    this.paymentPollTimer = null;
  }
}
async payWithCash(): Promise<void> {
  if (!this.orderID) return;

  try {
    await firstValueFrom(
      this.http.post(
        `${this.API_BASE}/order/${this.orderID}/initiate-payment?restaurantId=${this.restaurantID}`,
        { method: 'Cash' }
      )
    );
    
    this.paymentSuccess = true;
    this.currentStep = OrderStep.RATING;
  } catch (error) {
    console.error('Cash payment failed:', error);
    this.paymentError = true;
  }
}
async processPayment(): Promise<void> {
  if (!this.selectedPaymentMethod || !this.orderID) return;

  try {
    if (this.selectedPaymentMethod === 'cash') {
      await this.payWithCash();
    } else if (this.selectedPaymentMethod === 'upi') {
      await this.initiateUPIPayment();
      this.showUPIModal = true;
    }
  } catch (error) {
    console.error('Payment processing failed:', error);
    this.paymentError = true;
  }
}
 async initiateUPIPayment(): Promise<void> {
    if (!this.orderID || !this.orderSummaryDetails) return;

    try {
      const response = await firstValueFrom(
        this.http.post<any>(
          `${this.API_BASE}/order/${this.orderID}/initiate-payment?restaurantId=${this.restaurantID}`,
          { method: 'UPI' }
        )
      );

      const orderReference = this.orderNumber ? `Order #${this.orderNumber}` : `Order ${this.orderID}`;
      this.paymentLinks = this.generateUPILinks(
        response.upiId,
        response.upiName,
        response.amount,
        orderReference 
      );

      this.paymentQrData = `upi://pay?pa=${encodeURIComponent(response.upiId)}&pn=${encodeURIComponent(response.upiName)}&am=${response.amount.toFixed(2)}&tn=${encodeURIComponent(orderReference)}&cu=INR`;

      this.showUPIOptions = true;
      this.startPaymentPolling();
    } catch (error) {
      console.error('UPI Payment initiation failed:', error);
      this.paymentError = true;
    }
  }


openPaymentApp(app: string): void {
  if (!this.paymentLinks) return;

  const link = this.paymentLinks[app] || this.paymentLinks.universal;
  
  const newWindow = window.open(link, '_blank');

  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    window.location.href = link;
  }
}


  async initiateSecurePayment(): Promise<void> {
    if (!this.orderID) return;
    
    try {
const intent = await firstValueFrom(this.paymentService.initiateUPIPayment(this.orderID!));
      
      this.paymentLinks = {
        upiId: intent.upiId,
        upiName: intent.upiName,
        amount: intent.amount,
        orderId: intent.orderId,
        transactionId: intent.transactionId,
        links: intent.deepLinks
      };
      
      this.showUPIOptions = true;
      
this.paymentService.startPaymentPolling(this.orderID!, (paid) => {
        if (paid) {
          this.paymentSuccess = true;
          this.currentStep = 5;
        }
      });
      
    } catch (error) {
      console.error('Payment initiation failed:', error);
      this.paymentError = true;
    }
  }

  ngOnDestroy(): void {
      window.removeEventListener('beforeunload', this.beforeUnloadListener);
      window.removeEventListener('popstate', this.onPopState);
  
      try { window.removeEventListener('keydown', this.keydownHandler); } catch {}
      document.body.style.overflow = '';

      this.stopPaymentPolling(); 
      this.stopStatusPolling();
  }
goToStep(step: OrderStep): void {
  console.log(`[Navigation] Attempting to go from step ${this.currentStep} to step ${step}`);
  
  this.stopStatusPolling();
  this.stopPaymentPolling(); 

  const validSteps = [
    OrderStep.MENU,
    OrderStep.ORDER_SUMMARY,
    OrderStep.PAYMENT,
    OrderStep.PAYMENT_PROCESSING,
    OrderStep.RATING
  ] as const;

  if (validSteps.includes(step as any)) {
    this.currentStep = step as (typeof validSteps)[number];
    
    const newUrl = `?tableNo=${this.restaurantTableID}&restaurantId=${this.restaurantID}&step=${step}`;
    window.history.pushState({ step }, '', newUrl);
    
    this.saveOrderState();
    
    console.log('[Navigation] Current state after transition:', {
      orderID: this.orderID,
      currentStep: this.currentStep,
      newCartItems: this.newCart.length,
      confirmedItems: this.confirmedCart?.length || 0
    });
  } else {
    console.warn(`[Navigation] Invalid step transition attempted: ${step}`);
  }


  if (step === OrderStep.MENU) {
    this.newCart = [];
    this.syncUIQuantitiesWithConfirmedCart();
    this.quantityMap = {};
  }

  if (step === OrderStep.ORDER_SUMMARY) {
    this.getOrderSummary();
    this.startStatusPolling(); 
    this.startPaymentPolling(); 
    this.fetchMenuItems();
  }
  
  if (step === OrderStep.PAYMENT) {
    this.getOrderSummary();
    this.startPaymentPolling(); 
    this.fetchMenuItems();
  }
}

private syncUIQuantitiesWithConfirmedCart(): void {
  this.cartItems.forEach(ci => {
    ci.quantity = 0;
    ci.price = ci.basePrice ?? ci.price;
  });
  
  this.menuItems.forEach(mi => {
    mi.quantity = 0;
    mi.price = mi.basePrice ?? mi.price;
  });
}

private createPendingPayment(method: 'UPI' | 'Cash'): Observable<any> {
  if (!this.orderID) throw new Error('Order ID is required');
  const payload = { method };
  return this.http.post(`${this.API_BASE}/order/${this.orderID}/pending`, payload);
}

selectCategory(catId: number): void {
  this.selectedCategoryID = catId;
  this.showCategorySelector = false;
  this.searchQuery = '';
  this.selectedFilter = null;

  window.history.pushState({ categorySelected: true }, '', window.location.href);
}


  changeCategory() {
    this.showCategorySelector = true;
    this.searchQuery = '';
    this.selectedFilter = null;
  }
  setRating(stars: number): void {
    this.ratings = stars;
  }

submitRatings(): void {
  if (!this.orderID || this.ratings === 0 || this.submitted) return;

  const reviewPayload: Review = {
    orderID: this.orderID,
    stars:   this.ratings
  };

  this.http.post<{ message: string }>(
    `${this.API_BASE}/order/rate-order`,
    reviewPayload
  ).subscribe({
    next: () => {
      this.submitted = true;
      setTimeout(() => { /* maybe navigate away */ }, 3000);
    },
    error: err => console.error('Rating error:', err)
  });
}

alertWaiter(message: string): void {
  this.showWaiterOptions = false;

  const waiterRequest = {
    message: message,
    restaurantTableID: this.restaurantTableID,
    tableNumber: this.restaurantTableID        
  };

  const url = `${this.API_BASE}/order/call-waiter?restaurantId=${this.restaurantID}`;

  this.http.post(url, waiterRequest)
    .subscribe({
      next: (response: any) => {
        console.log("✅ Waiter request sent successfully:", response);
      },
      error: (error) => {
        console.error(" Error sending waiter request:", error);
        alert("Failed to notify waiter. Please try again.");
      }
    });
}


onPopState = (event: PopStateEvent) => {
  if (this.currentStep === OrderStep.MENU && !this.showCategorySelector && this.selectedCategoryID) {
    console.log('[Back Navigation] Going back to category selector');
    this.changeCategory(); 
    this.updateUrlWithCurrentStep(); 
  }
};

private fetchRestaurantInfo(): void {
  const url = `${this.API_BASE}/RestaurantTable/bynumber?tableNo=${this.restaurantTableID}&restaurantId=${this.restaurantID}`;
  
  this.http.get<any>(url).subscribe({
    next: info => {
      this.restaurantName = info.name;
      this.restaurantDescription = info.description || '';
      this.upiID = info.upiID || '';
      this.upiName = info.upiName || info.name || 'DigiEat';
      this.restaurantID = info.restaurantID;
      
      localStorage.setItem('restaurantId', String(this.restaurantID));

      if (info.logoPath) {
        const cleanPath = info.logoPath.replace(/^\/+/, '');
        this.restaurantLogoUrl = cleanPath.includes('uploads/')
          ? `${environment.baseUrl}/${cleanPath}`
          : `${environment.baseUrl}/uploads/${cleanPath}`;
      } else {
        this.restaurantLogoUrl = 'assets/images/default-logo.png';
      }


      this.fetchOffers();
    },
    error: err => {
      console.error('Could not load restaurant info', err);
      this.fallbackFetchRestaurantInfo();
    }
  });
}

private fallbackFetchRestaurantInfo(): void {
  this.http.get<RestaurantInfo>(`${this.API_BASE}/order/table/${this.restaurantTableID}/payment-details`)
    .subscribe({
      next: info => {
        this.restaurantName = info.name;
        this.restaurantDescription = info.description || '';
        this.upiID = info.upiID || '';
        this.upiName = info.upiName || info.name || 'DigiEat';
        this.restaurantID = info.restaurantID;
        
        localStorage.setItem('restaurantId', String(this.restaurantID));

        if (info.logoPath) {
          const cleanPath = info.logoPath.replace(/^\/+/, '');
          this.restaurantLogoUrl = cleanPath.includes('uploads/')
            ? `${environment.baseUrl}/${cleanPath}`
            : `${environment.baseUrl}/uploads/${cleanPath}`;
        } else {
          this.restaurantLogoUrl = 'assets/images/default-logo.png';
        }

        const updatedURL = `${window.location.pathname}?tableNo=${this.restaurantTableID}&restaurantId=${this.restaurantID}`;
        window.history.replaceState({}, '', updatedURL);

        this.fetchOffers();
      },
      error: err => {
        console.error('Fallback also failed to load restaurant info', err);
      }
    });
}

  toggleFilter(filter: 'veg' | 'nonveg'): void {
    if (this.selectedFilter === filter) {
      this.selectedFilter = null;
      this.fetchMenuItems(); 
    } else {
      this.selectedFilter = filter;
      const isVeg = filter === 'veg';
      this.fetchFilteredMenuItems(isVeg);
    }
  }
 fetchFilteredMenuItems(isVeg: boolean): void {
const url = `${this.API_BASE}/product/filter?isVeg=${isVeg}&restaurantId=${this.restaurantID}`;
  this.http.get<any>(url).subscribe({
    next: (data) => {
      const raw = Array.isArray(data)
                    ? data
                    : (Array.isArray(data.$values) ? data.$values : []);
      this.menuItems = raw.map((item: Product) => ({
        ...item,
        quantity: 0,
        basePrice: item.price
      }));
      this.assignProductsToCategories();
      this.assignProductsToSubCategories();
    },
    error: (error) => {
      this.errorMessage = 'Failed to fetch filtered menu items. Please try again!';
      console.error(error);
    },
  });
}
  toggleSubCategory(subCategoryId: number): void {
    this.subCategoryStates.set(subCategoryId, !this.isSubCategoryOpen(subCategoryId));
  }
  isSubCategoryOpen(subCategoryId: number): boolean {
    return this.subCategoryStates.get(subCategoryId) || false;
  }

  mapStatus(status: number | string): string {
    if (typeof status === 'number') {
      switch (status) {
        case 0: return OrderStatus.Pending;
        case 1: return OrderStatus.Confirmed;
        case 2: return OrderStatus.Served;
        case 3: return OrderStatus.Completed;
        case 4: return OrderStatus.Cancelled;
        default: return OrderStatus.Pending;
      }
    }
    return status;
  }

  hideImage(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
}


getImageUrl(imagePath: string | undefined): string {
  if (!imagePath || imagePath.trim() === '') {
    return ''; 
  }

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  const cleanPath = imagePath.startsWith('/')
    ? imagePath.substring(1)
    : imagePath;

  return `${environment.baseUrl}/${cleanPath}`;
}


  private startStatusPolling(): void {
    this.stopStatusPolling();
    this.statusPollingTimer = setInterval(() => {
 this.http.get<OrderSummary>(`${this.API_BASE}/order/${this.orderID}/summary?restaurantId=${this.restaurantID}&timestamp=${Date.now()}`)

      .subscribe({
        next: (summary) => {
        summary.orderStatus = this.mapStatus(summary.orderStatus);
       this.orderSummaryDetails = summary;
          this.confirmedCart = summary.orderItems.map(i => ({
            orderID: this.orderID!,
            productID: i.productID,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            customizationOptionIds: []
          }));
       },
        error: (error) => {
          console.error('Error fetching order summary:', error);
}
  });
    }, 5000);
  }
  

  private stopStatusPolling(): void {
    if (this.statusPollingTimer) {
      clearInterval(this.statusPollingTimer);
      this.statusPollingTimer = null;
    }
  }

  proceedToPayment(): void {
    this.currentStep = 4;
  }
  orderCompleted(): void {
    if (!this.orderID) {
    
      return;
    }

    this.http.get<PaymentVerificationResponse>(
      `${this.API_BASE}/order/${this.orderID}/verifyPayment?timestamp=${new Date().getTime()}`
    ).subscribe({
      next: (response) => {
        if (response.paid) {
        this.currentStep = OrderStep.RATING;
        } else {
         
        }
      },
      error: (error) => {
        console.error('Payment verification error:', error);
       this.currentStep = OrderStep.PAYMENT;
      }
    });
  }


fetchCategories(): void {
  this.http.get<any>(`${this.API_BASE}/categories?restaurantId=${this.restaurantID}`).subscribe({
    next: (data) => {
      const raw = Array.isArray(data)
        ? data
        : (Array.isArray(data.$values) ? data.$values : []);

      this.categories = raw.map((category: any) => ({
        ...category,
        products: Array.isArray(category.products)
          ? category.products
          : (Array.isArray((category.products as any)?.$values)
              ? (category.products as any).$values
              : []),
        subCategories: Array.isArray(category.subCategories)
          ? category.subCategories
          : (Array.isArray((category.subCategories as any)?.$values)
              ? (category.subCategories as any).$values
              : [])
      }));

          this.categories.forEach(cat =>
        cat.subCategories.forEach(sub =>
          this.subCategoryStates.set(sub.subCategoryID, true)
        )
      );

      this.assignProductsToCategories();
    },
    error: (error) => {
      console.error('Error fetching categories:', error);
    },
  });
}

confirmUPIPayment(): void {
  if (!this.orderID) return;

  this.showUPIModal = false;
  
  this.paymentSuccess = true;
  
  this.currentStep = OrderStep.RATING;
  
  this.http.post(`${this.API_BASE}/order/${this.orderID}/complete-payment`, { 
    method: 'UPI' 
  }).subscribe({
    next: () => console.log('UPI payment confirmed'),
    error: (err) => console.error('Payment confirmation failed', err)
  });
}

async selectPaymentMethod(method: 'cash' | 'upi') {
  this.selectedPaymentMethod = method;

  if (method === 'upi') {
    await this.initiateUPIPayment(); 
  }

  this.showPaymentConfirmModal = true; 
}

async confirmPaymentMethod(): Promise<void> {
  this.showPaymentConfirmModal = false;

  if (!this.orderID || !this.selectedPaymentMethod) return;

  try {
    if (this.selectedPaymentMethod === 'cash') {
      await this.payWithCash();
    } else if (this.selectedPaymentMethod === 'upi') {
      await this.initiateUPIPayment();
      this.showUPIModal = true;
    }
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    this.paymentError = true;
  }
}



fetchSubCategories(): void {
  if (!this.restaurantID || this.restaurantID === 0) return; 

  const url = `${this.API_BASE}/subcategories?restaurantId=${this.restaurantID}`; 

  this.http.get<any>(url).subscribe({
    next: (data) => {
      console.log('/subcategories raw response:', data);

      const raw = Array.isArray(data)
                    ? data
                    : (Array.isArray(data.$values) ? data.$values : []);

      this.subCategories = raw.map((sub: SubCategory) => ({
        ...sub,
        products: []
      }));

      this.assignProductsToSubCategories();
    },
    error: (error) => console.error('Error fetching subcategories:', error),
  });
}


  getFilteredMenuItems(categoryID?: number, subCategoryID?: number): Product[] {
    let filteredItems = this.menuItems;

    // Filter by category if provided.
    if (categoryID) {
      filteredItems = filteredItems.filter(item => item.categoryID === categoryID);
    }

    if (subCategoryID) {
      filteredItems = filteredItems.filter(item => item.subCategoryID === subCategoryID);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        item.productName.toLowerCase().includes(query) ||
        (item.productDescription?.toLowerCase().includes(query) ?? false)
      );
    }

    if (this.selectedFilter === 'veg') {
      filteredItems = filteredItems.filter(item => item.isVeg);
    } else if (this.selectedFilter === 'nonveg') {
      filteredItems = filteredItems.filter(item => !item.isVeg);
    }

    return filteredItems;
  }


  shouldDisplayCategory(category: Category): boolean {
    const categoryItems = this.getFilteredMenuItems(category.categoryID);
    if (categoryItems.length > 0) {
      return true;
    }
    if (category.subCategories && category.subCategories.length) {
      return category.subCategories.some(sub => {
        return this.getFilteredMenuItems(undefined, sub.subCategoryID).length > 0;
      });
    }
    return false;
  }

  shouldDisplaySubCategory(subCategory: SubCategory): boolean {
    return this.getFilteredMenuItems(undefined, subCategory.subCategoryID).length > 0;
  }


fetchMenuItems(): void {
  this.http.get<any>(`${this.API_BASE}/product?restaurantId=${this.restaurantID}`)
    .subscribe({
      next: (data) => {
        const raw = Array.isArray(data)
          ? data
          : (Array.isArray(data.$values) ? data.$values : []);

        this.menuItems = raw.map((item: Product) => ({
          ...item,
          quantity: 0,
          basePrice: item.price, 
          price: item.price, 
          customizationOptionIds: [] 
        }));

        this.cartItems = this.menuItems.map(item => ({ 
          ...item,
          basePrice: item.price,
          customizationOptionIds: []
        }));

        this.assignProductsToCategories();
        this.assignProductsToSubCategories();
      },
      error: (error) => {
        this.errorMessage = 'Failed to fetch menu items. Please try again!';
        console.error(error);
      }
    });
}
 assignProductsToCategories(): void {
    if (!this.menuItems.length || !this.categories.length) return;
    const categoryMap = new Map<number, Category>();
    this.categories.forEach(category => {
      categoryMap.set(category.categoryID, {
        ...category,
        products: [],
        subCategories: category.subCategories || []
      });
    });
    this.menuItems.forEach(product => {
      if (product.subCategoryID) {
        const subCategory = this.subCategories.find(sc => sc.subCategoryID === product.subCategoryID);
        if (subCategory) {
          subCategory.products.push(product);
        }
      } else {
        const category = categoryMap.get(product.categoryID);
        if (category) {
          category.products.push(product);
        }
      }
    });
    this.categories = Array.from(categoryMap.values());
  }

  assignProductsToSubCategories(): void {
    if (!this.menuItems.length || !this.subCategories.length) return;
    this.subCategories.forEach(subCategory => {
      subCategory.products = this.menuItems.filter(product => product.subCategoryID === subCategory.subCategoryID);
    });
  }
loadCategories() {
  this.isLoading = true;
  this.http.get<any[]>(`${environment.apiUrl}/api/categories`).subscribe({
    next: (response) => {
      this.categories = response;

      // Force UI to show them
      this.showCategorySelector = true;

      // Add fallback in case response is valid but empty
      if (this.categories.length === 0) {
        console.warn(" Categories fetched but array is empty");
      }

      this.isLoading = false;
    },
    error: (error) => {
      console.error(' Error loading categories', error);
      this.isLoading = false;
    }
  });
}

private updateNewCart(
  item: Product,
  unitPriceForOrder?: number,
  customizationIds?: number[]
): void {
  const finalUnitPrice = unitPriceForOrder ?? item.price;
  
  const existingItemIndex = this.newCart.findIndex(ci => ci.productID === item.productID);

  if (existingItemIndex > -1) {
    if (item.quantity === 0) {
      this.newCart.splice(existingItemIndex, 1);
    } else {
      const existingItem = this.newCart[existingItemIndex];
      existingItem.quantity = item.quantity;
      existingItem.unitPrice = finalUnitPrice;
      existingItem.customizationOptionIds = customizationIds || item.customizationOptionIds || [];
    }
  } else if (item.quantity > 0) {
    this.newCart.push({
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: finalUnitPrice, 
      customizationOptionIds: customizationIds || item.customizationOptionIds || []
    });
  }

  this.quantityMap[item.productID] = item.quantity;
}


async updateQuantityForNewItems(item: Product, change: number): Promise<void> {
  clearTimeout(this.quantityDebounceTimer);

  if (change < 0) {
    const newQuantity = Math.max(0, (item.quantity || 0) - 1);
    item.quantity = newQuantity;
    this.updateNewCart(item);
    return;
  }

  const basePrice = item.basePrice ?? item.price;
  let finalUnitPrice = basePrice;
  let selectedOption: CustomizationOption | null = null;
  let customizationOptionIds: number[] = [];

  if (item.customizationOptions && item.customizationOptions.length > 0) {
    const modalResult = await this.openCustomizationModal(item);

    if (modalResult === null) {
      return; 
    }

    if (modalResult.customizationOptionID) {
      selectedOption = item.customizationOptions.find(
        opt => opt.customizationOptionID === modalResult.customizationOptionID
      ) ?? null;

      if (selectedOption) {
        finalUnitPrice = basePrice + selectedOption.fixedPrice;
        customizationOptionIds = [selectedOption.customizationOptionID];
        
        item.price = finalUnitPrice;
        item.customizationOptionIds = customizationOptionIds;
        
        const cartItem = this.cartItems.find(ci => ci.productID === item.productID);
        if (cartItem) {
          cartItem.price = finalUnitPrice;
          cartItem.customizationOptionIds = customizationOptionIds;
        }
        
      }
    } else {
      // User selected "None" - reset to base price
      item.price = basePrice;
      item.customizationOptionIds = [];
      
      const cartItem = this.cartItems.find(ci => ci.productID === item.productID);
      if (cartItem) {
        cartItem.price = basePrice;
        cartItem.customizationOptionIds = [];
      }
    }
  }

  item.quantity = (item.quantity || 0) + 1;
  this.updateNewCart(item, finalUnitPrice, customizationOptionIds);
}

private openCustomizationModal(product: Product): Promise<{ customizationOptionID: number | null, price: number } | null> {
    return new Promise((resolve) => {
        const dialogRef = this.dialog.open(CustomizationModalComponent, {
            width: '300px',
            data: { product }
        });
        dialogRef.afterClosed().subscribe((result: { customizationOptionID: number | null, price: number } | null) => {
            resolve(result);
        });
    });
}

  async submitCartAndProceed(): Promise<any> {
    console.log('[Order Flow] Starting submitCartAndProceed');
    this.rebuildNewCart();

    const storedTableID = localStorage.getItem('restaurantTableID');
    if (!storedTableID) {
      console.error('No table ID found');
      return null;
    }

    const tableID = +storedTableID;
    let newOrder: any = null;

    try {
      if (!this.orderID) {
        const url = `${this.API_BASE}/order/generate?tableNo=${tableID}&restaurantId=${this.restaurantID}`;
        const body = { userID: this.userID };

        newOrder = await firstValueFrom(this.http.post<any>(url, body));

        if (newOrder) {
          this.orderID = newOrder.orderID;
          this.orderNumber = newOrder.orderNumber; 
          this.orderStatus = newOrder.orderStatus;
          this.orderCreatedAt = new Date(newOrder.createdAt);
        }
      } else {
        const statusResp = await firstValueFrom(
          this.http.get<any>(`${this.API_BASE}/order/status/${this.orderID}?restaurantId=${this.restaurantID}`)
        );
        this.orderStatus = statusResp.status;
      }

      await this.addNewItemsToOrder();

      if (this.orderStatus !== 'Confirmed') {
        await firstValueFrom(
          this.http.post(`${this.API_BASE}/order/${this.orderID}/confirm?restaurantId=${this.restaurantID}`, {})
        );
        this.orderStatus = 'Confirmed';
      }

      await this.getOrderSummary(); // Wait for this to complete
      this.goToStep(OrderStep.ORDER_SUMMARY);
      this.saveOrderState();

      return newOrder;

    } catch (error) {
      console.error('[Order Flow] Error in submitCartAndProceed:', error);
      return null;
    }
  }
rebuildNewCart() {
  this.newCart = [];

  this.cartItems.forEach(item => {
    const currentUIQuantity = this.quantityMap[item.productID] || item.quantity || 0;
    
    
    if (currentUIQuantity > 0) {

      const mainMenuItem = this.menuItems.find(mi => mi.productID === item.productID);
      const finalPrice = mainMenuItem?.price || item.price;
      const finalCustomizations = mainMenuItem?.customizationOptionIds || item.customizationOptionIds || [];
      
      this.newCart.push({
        productID: item.productID,
        quantity: currentUIQuantity,
        unitPrice: finalPrice, 
        customizationOptionIds: finalCustomizations
      });
    }
  });

}
private getConfirmedQuantity(productID: number): number {
  if (!this.confirmedCart || this.confirmedCart.length === 0) return 0;
  
  const confirmedItem = this.confirmedCart.find(item => item.productID === productID);
  return confirmedItem ? confirmedItem.quantity : 0;
}
addNewItemsToOrder(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.rebuildNewCart();

    if (this.newCart.length === 0) {
      console.log('No new items to add.');
      resolve();
      return;
    }


    const itemsToSend = this.newCart.map(item => ({
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      customizationOptionIds: item.customizationOptionIds || []
    }));


    this.http.post(`${this.API_BASE}/order/${this.orderID}/addItem?restaurantId=${this.restaurantID}`, itemsToSend)
      .subscribe({
        next: (response: any) => {
          console.log('[Order Flow] Successfully added items to existing order');
          
          // Clear newCart
          this.newCart = [];
          
          // Refresh order summary (don't wait for it)
          this.getOrderSummary();
          
          // Reset UI quantities to ZERO for next ordering session
          this.syncUIQuantitiesWithConfirmedCart();
          
          // Clear quantity map for UI
          this.quantityMap = {};

          this.saveOrderState();
          resolve();
        },
        error: (error) => {
          console.error("[Order Flow] Error adding new items:", error);
          reject(error);
        }
      });
  });
}

private async createOrderID(): Promise<void> {
  const url = `${this.API_BASE}/order/generate?tableNo=${this.restaurantTableID}`;
  const body = { userID: this.userID };
  
  try {
    const res = await firstValueFrom(
      this.http.post<{ orderID: number }>(url, body)
    );
    
    this.orderID = res.orderID;
    this.orderCreatedAt = new Date();
    this.isOrderProcessing = false;
    this.saveOrderState();
    
  } catch (err) {
    console.error('Error generating order ID!', err);
    this.isOrderProcessing = false;
    throw err; // Re-throw the error to be caught by the caller
  }
}
private async postCartItems(): Promise<void> {
  if (!this.orderID || this.newCart.length === 0) {
    console.warn('[Order Flow] Cannot post items - missing orderID or empty cart');
    return;
  }

  console.log('[Order Flow] Posting cart items to server...');
  
  try {
    await firstValueFrom(
      this.http.post(`${this.API_BASE}/order/${this.orderID}/addItem`, this.newCart)
      
    );
    
    this.newCart = [];
    this.menuItems.forEach(item => {
      item.quantity = 0;
      item.price = item.basePrice ?? item.price;
    });
    
    await this.sendOrderToKitchen();
    
  } catch (error) {
    console.error('[Order Flow] Error posting cart items:', error);
    throw error; 
  }
}


  async getOrderSummary(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      if (!this.orderID || !this.restaurantID) {
        console.warn(' Missing orderID or restaurantID to fetch summary');
        reject('Missing orderID or restaurantID');
        return;
      }

      this.isLoading = true;

      try {
        const timestamp = new Date().getTime(); 
        const summary = await firstValueFrom(
          this.http.get<OrderSummary>(
            `${this.API_BASE}/order/${this.orderID}/summary?restaurantId=${this.restaurantID}&timestamp=${timestamp}`
          )
        );


        summary.orderStatus = this.mapStatus(summary.orderStatus);

        this.orderSummaryDetails = summary;
        
        this.orderNumber = summary.orderNumber || this.orderID;

        this.confirmedCart = [];
        summary.orderItems.forEach(item => {
          this.confirmedCart.push({
            productID: item.productID,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            customizationOptionIds: item.customizations?.map(c => c.customizationOptionID) || []
          });
        });


        this.evaluateOffers();

        resolve();

      } catch (error) {
        console.error('Error fetching order summary:', error);
        reject(error); 
      } finally {
        this.isLoading = false;
      }
    });
  }
getProductBasePrice(productID: number): number {
  const product = this.menuItems.find(p => p.productID === productID);
  return product?.basePrice || product?.price || 0;
}
private refreshOrderSummary() {
  if (this.currentStep === OrderStep.ORDER_SUMMARY) {
    this.getOrderSummary();
  }
}

  getTotalNewCartQuantity(): number {
    return this.newCart.reduce((total, item) => total + item.quantity, 0);
  }

  getProductPrice(productID: number): number {
    const product = this.menuItems.find(p => p.productID === productID);
    return product ? product.price : 0;
  }

  getProductImage(productID: number): string | null {
    const product = this.menuItems.find(p => p.productID === productID);
    return product && product.imagePath ? product.imagePath : null;
  }

getProductName(productID: number): string {
  const product = this.menuItems.find(p => p.productID === productID);

  if (product) return product.productName;
  const summaryItem = this.orderSummaryDetails?.orderItems.find(i => i.productID === productID);
  if (summaryItem) return `Item #${productID}`;

  return 'Unknown Item';
}
  toggleWaiterOptions(): void {
    this.showWaiterOptions = !this.showWaiterOptions;
  }
private async sendOrderToKitchen(): Promise<void> {
  if (!this.orderID) {
    console.warn('[Order Flow] Cannot send to kitchen - no orderID');
    return;
  }
  
  try {
    await firstValueFrom(
      this.http.post(`${this.API_BASE}/order/${this.orderID}/confirm`, {})
    );
    
    this.orderConfirmationTime = new Date();
    
  } catch (error) {
    console.error('[Order Flow] Error sending order to kitchen:', error);
    throw error;
  }
}
 downloadBill() {
    const fileName = this.orderNumber 
      ? `Bill_Order_${this.orderNumber}.pdf`
      : `Bill_Order_${this.orderID}.pdf`;
    
    this.http.get(`${this.API_BASE}/order/${this.orderID}/bill`, {
      responseType: 'blob',
    }).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName; 
      a.click();
      window.URL.revokeObjectURL(url);
    }, error => {
    });
  }
}         