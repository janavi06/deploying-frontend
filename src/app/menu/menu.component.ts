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

// Add this near the top of your component file (with other interfaces/enums)
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
  // orderID: number;
  productID: number;
  quantity: number;
  customizationOptionIds?: number[]; 
    unitPrice: number;
}

interface OrderSummary {
  orderID: number;
    restaurantTableID: number;

  orderItems: Array<{
    productID: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  serviceCharge: number;
  totalAmount: number;
  orderStatus: string; // mapped to string
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
   upiID?: string;     // ✅ NEW
  upiName?: string;   // ✅ NEW
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
restaurantID: number = +(localStorage.getItem('restaurantId') || '0'); // ✅ Load on init

  OrderStep = OrderStep; // expose to HTML template
cartItems: Product[] = []; // ✅ Stores the full menu items shown to user
quantityMap: { [productID: number]: number } = {}; // ✅ Tracks quantity per product

paymentQrData: string = '';
  selectedFilter: 'veg' | 'nonveg' | null = null;
  // UPI ID for payment
upiID: string = '';
showUPIModal = false;
  isLoading: boolean = false;

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
private statusPollingTimer: any = null;  // ✅ ADDED to fix missing property

selectedPaymentMethod: 'cash' | 'upi' | null = null;
paymentLinks: any = null;
showUPIOptions = false;
paymentSuccess = false;
paymentError = false;
  quantityDebounceTimer: any = null; // ✅ Add this line here
showConfirmationModal: boolean = false;
orderStatus: string = '';
showPaymentConfirmModal: boolean = false;


offers: Offer[] = [];
appliedOffer: Offer | null = null;
discountAmount: number = 0;

private readonly API_BASE = environment.apiUrl;

 constructor(private http: HttpClient, private router: Router,private dialog: MatDialog,private paymentService: PaymentService) { }

private beforeUnloadListener = (event: BeforeUnloadEvent) => {
  this.saveOrderState();
};

async ngOnInit(): Promise<void> {
  this.isLoading = true;

  // 1. Get table number from URL or localStorage
  const queryParams = new URLSearchParams(window.location.search);
  const tableParam = queryParams.get('tableNo');
  const stepFromQuery = queryParams.get('step');

  const localTable = localStorage.getItem('restaurantTableID');
  const tableID = tableParam ? +tableParam : +(localTable || '0');

  this.restaurantTableID = tableID;
  localStorage.setItem('restaurantTableID', String(this.restaurantTableID));

  if (!tableParam) {
    const updatedURL = `${window.location.pathname}?tableNo=${this.restaurantTableID}`;
    window.history.replaceState({}, '', updatedURL);
  }

  this.fetchRestaurantInfo(); // if you use this method elsewhere, it's fine

  // 2. Restore order state if available
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

  // 3. Fetch restaurant info using the table number
  try {
    const restaurantResponse = await firstValueFrom(
      this.http.get<any>(`${this.API_BASE}/restauranttable/info?tableIdentifier=${this.restaurantTableID}`)
    );

    if (!restaurantResponse || !restaurantResponse.restaurantID) {
      throw new Error('Invalid restaurant information.');
    }

    // ✅ Fix: use correct property casing
    this.restaurantID = restaurantResponse.restaurantID;
    localStorage.setItem('restaurantId', this.restaurantID.toString());

    this.restaurantName = restaurantResponse.name || '';
    this.restaurantDescription = restaurantResponse.description || '';
    this.restaurantLogoUrl = restaurantResponse.logoPath
      ? `${environment.baseUrl}/${restaurantResponse.logoPath.replace(/^\/+/, '')}`
      : '';

  } catch (err) {
    console.error('Failed to load restaurant info from table number:', err);
    alert('Invalid table or restaurant information. Please rescan.');
    this.router.navigate(['/']);
    return;
  }

  // 4. Load categories, menu, and subcategories
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


async loadRestaurantInfoFromTableNo(tableIdentifier: string | number): Promise<void> {
  try {
    const url = `${this.API_BASE}/restauranttable/info?tableIdentifier=${tableIdentifier.toString()}`;
    const data: any = await firstValueFrom(this.http.get(url));

    if (!data || !data.restaurantID) {
      throw new Error('Invalid restaurant information.');
    }

    this.restaurantID = data.restaurantID;
    this.restaurantName = data.name || '';
    this.restaurantDescription = data.description || '';
    
    if (data.logoPath) {
      const cleanPath = data.logoPath.replace(/^\/+/, '');
      this.restaurantLogoUrl = `${environment.baseUrl}/${cleanPath}`;
    } else {
      this.restaurantLogoUrl = 'assets/images/default-logo.png';
    }

    localStorage.setItem('restaurantID', this.restaurantID.toString());
  } catch (error) {
    console.error('❌ Failed to load restaurant info:', error);
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
      console.log('🟡 Raw offers from API:', this.offers);
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

  // Pick best discount (highest ₹ value)
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
console.log('🟠 Evaluating offers — Subtotal:', subtotal);
console.log('🟢 Valid offers found:', validOffers);

  console.log('✅ Applied Offer:', this.appliedOffer);

}
// In your component class
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


// Add this helper method to validate steps
private isValidOrderStep(step: number): step is OrderStep {
  return Object.values(OrderStep).includes(step);
}

// ✅ FINAL PATCHED SNIPPET
// Add this new method to MenuComponent:
finalizeOrder(): void {
  // 1) Clear localStorage for this table
  const key = `orderState_table_${this.restaurantTableID}`;
  localStorage.removeItem(key);

  // 2) Reset internal component state
  this.orderID = null;
  this.newCart = [];
  this.confirmedCart = [];
  this.currentStep = OrderStep.MENU;

  // Reset menu quantities
  this.menuItems.forEach(i => {
    i.quantity = 0;
    i.price = i.basePrice ?? i.price;
  });

  // 3) Hide modals or options if any
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
      : new Date(); // fallback

  const state = {
    orderID: this.orderID,
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
  window.history.replaceState({}, '', currentUrl.toString());
}



private restoreOrderState(): boolean {
  const key = `orderState_table_${this.restaurantTableID}`;
  const savedState = localStorage.getItem(key);
  
  if (!savedState) return false;

  try {
    const state = JSON.parse(savedState);
    
    // Validate the stored state
    if (!state.orderID || !state.currentStep) {
      console.warn('Invalid saved state - missing required fields');
      return false;
    }

    // Check if order is expired (older than 1 hour)
    const orderAge = Date.now() - new Date(state.orderCreatedAt).getTime();
    if (orderAge > 60 * 60 * 1000) { // 1 hour
      console.warn('Order expired - clearing saved state');
      localStorage.removeItem(key);
      return false;
    }

    // Restore the state
    this.orderID = state.orderID;
    this.currentStep = state.currentStep;
    this.orderCreatedAt = new Date(state.orderCreatedAt);
    this.userID = state.userID;
    this.confirmedCart = state.confirmedCart || [];
    this.newCart = state.newCart || [];

    console.log('✅ Successfully restored order state');
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

// ✅ Modify confirmUPIPayment():
// confirmUPIPayment(): void {
//   if (!this.orderID || !this.orderSummaryDetails) return;

//   const payload = { method: 'UPI' };

//   this.http.post(`${this.API_BASE}/order/${this.orderID}/pending`, payload)
//     .subscribe({
//       next: () => {
//         this.paymentSuccess = true;
//         this.showUPIModal = false;

//         // ✅ ONLY finalize after pending payment is created
//         this.finalizeOrder();
//       },
//       error: (error) => {
//         console.error('❌ UPI pending payment failed:', error);
//         this.paymentError = true;
//       }
//     });
// }




private generateUPILinks(upiId: string, upiName: string, amount: number, note: string): any {
  const amountStr = amount.toFixed(2);
  const encodedUpiId = encodeURIComponent(upiId);
  const encodedName = encodeURIComponent(upiName);
  const encodedNote = encodeURIComponent(note);
  
  return {
    universal: `https://upilink.vercel.app/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}&cu=INR`,
    direct: `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}`,
    phonePe: `phonepe://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}`,
    gPay: `tez://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}`,
    upiId: upiId,
    amount: amountStr,
    orderId: this.orderID
  };
}

// Add this to your component
handlePaymentError(error: any): void {
  console.error('Payment error:', error);
  this.paymentError = true;
  this.paymentService.stopPaymentPolling();
  
  // Show error to user
//   alert('Payment failed. Please try again or choose another payment method.');
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
  }, 5000); // Check every 5 seconds
}

private stopPaymentPolling(): void {
  if (this.paymentPollTimer) {
    clearInterval(this.paymentPollTimer);
    this.paymentPollTimer = null;
  }
}

// ✅ Modify payWithCash():
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

    // Generate UPI links with the response data
    this.paymentLinks = this.generateUPILinks(
      response.upiId,
      response.upiName,
      response.amount,
      `Payment for Order ${this.orderID}`
    );

    // Generate QR code data
    this.paymentQrData = `upi://pay?pa=${encodeURIComponent(response.upiId)}&pn=${encodeURIComponent(response.upiName)}&am=${response.amount.toFixed(2)}&tn=${encodeURIComponent(`Payment for Order ${this.orderID}`)}&cu=INR`;

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
  
  // Try to open in new tab (best for desktop/mobile browser)
  const newWindow = window.open(link, '_blank');

  // Fallback for strict browsers or blocked pop-ups
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    window.location.href = link;
  }
}


  async initiateSecurePayment(): Promise<void> {
    if (!this.orderID) return;
    
    try {
      // 1. Create payment intent on server
const intent = await firstValueFrom(this.paymentService.initiateUPIPayment(this.orderID!));
      
      // 2. Store payment details
      this.paymentLinks = {
        upiId: intent.upiId,
        upiName: intent.upiName,
        amount: intent.amount,
        orderId: intent.orderId,
        transactionId: intent.transactionId,
        links: intent.deepLinks
      };
      
      // 3. Show UPI options
      this.showUPIOptions = true;
      
      // 4. Start secure polling
this.paymentService.startPaymentPolling(this.orderID!, (paid) => {
        if (paid) {
          this.paymentSuccess = true;
          this.currentStep = 5; // Move to rating page
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
  

    if (this.paymentPollTimer) clearInterval(this.paymentPollTimer);
    if (this.statusPollingTimer) clearInterval(this.statusPollingTimer);
  }

goToStep(step: OrderStep): void {
  console.log(`[Navigation] Attempting to go from step ${this.currentStep} to step ${step}`);
  
  const validSteps = [
    OrderStep.MENU,
    OrderStep.ORDER_SUMMARY,
    OrderStep.PAYMENT,
    OrderStep.PAYMENT_PROCESSING,
    OrderStep.RATING
  ] as const;

  if (validSteps.includes(step as any)) {
    console.log(`[Navigation] Valid step transition to ${step}`);
    this.currentStep = step as (typeof validSteps)[number];
    window.history.pushState({ step }, '', `?step=${step}`);
    this.saveOrderState();
    
    // Additional logging for state
    console.log('[Navigation] Current state after transition:', {
      orderID: this.orderID,
      currentStep: this.currentStep,
      cartItems: this.newCart.length,
      confirmedItems: this.confirmedCart?.length || 0
    });
  } else {
    console.warn(`[Navigation] Invalid step transition attempted: ${step}`);
  }

  if (step === OrderStep.MENU) {
  console.log('[Navigation] Returning to menu. Resetting new cart only.');

  // ✅ Clear only newCart (not confirmedCart)
  this.newCart = [];

  // ✅ Reset menu quantities to 0 so cart shows empty
  this.menuItems.forEach(i => {
    i.quantity = 0;
    i.price = i.basePrice ?? i.price;
  });
}

  if (step === OrderStep.ORDER_SUMMARY) {
    console.log('[Navigation] Loading order summary for step 2');
    this.getOrderSummary();
    this.startStatusPolling();

      this.fetchMenuItems(); // Make sure full menuItems is restored

  }
  
  if (step === OrderStep.PAYMENT) {
    console.log('[Navigation] Preparing payment step');
    this.stopStatusPolling();
    this.getOrderSummary();

      this.fetchMenuItems();

  }
}


private createPendingPayment(method: 'UPI' | 'Cash'): Observable<any> {
  if (!this.orderID) throw new Error('Order ID is required');
  const payload = { method };
  return this.http.post(`${this.API_BASE}/order/${this.orderID}/pending`, payload);
}


// processPayment(): void {
//   if (!this.selectedPaymentMethod || !this.orderID) return;
  
//   if (this.selectedPaymentMethod === 'cash') {
//     this.createPendingPayment('Cash');
//     this.currentStep = 5; // ✅ Show rating page
//   } else if (this.selectedPaymentMethod === 'upi') {
//     this.initiateUPIPayment();
//   }
// }



selectCategory(catId: number): void {
  this.selectedCategoryID = catId;
  this.showCategorySelector = false;
  this.searchQuery = '';
  this.selectedFilter = null;

  // Push to browser history so back button can be detected
  window.history.pushState({ categorySelected: true }, '', window.location.href);
}


  // brings you back to the category chooser
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
    restaurantTableID: this.restaurantTableID, // ✅ Match model exactly
    tableNumber: this.restaurantTableID        // ✅ Optional: if backend uses it
  };

  const url = `${this.API_BASE}/order/call-waiter?restaurantId=${this.restaurantID}`;

  this.http.post(url, waiterRequest)
    .subscribe({
      next: (response: any) => {
        console.log("✅ Waiter request sent successfully:", response);
      },
      error: (error) => {
        console.error("❌ Error sending waiter request:", error);
        alert("Failed to notify waiter. Please try again.");
      }
    });
}


onPopState = (event: PopStateEvent) => {
  if (this.currentStep === OrderStep.MENU && !this.showCategorySelector && this.selectedCategoryID) {
    console.log('[Back Navigation] Going back to category selector');
    this.changeCategory(); // ← reset to show category selector
    this.updateUrlWithCurrentStep(); // ← maintain proper URL
  }
};
private fetchRestaurantInfo(): void {
  this.http.get<RestaurantInfo>(`${this.API_BASE}/order/table/${this.restaurantTableID}/payment-details`)
    .subscribe({
      next: info => {
        this.restaurantName = info.name;
        this.restaurantDescription = info.description || '';
        this.upiID = info.upiID || '';
        this.upiName = info.upiName || info.name || 'DigiEat';
        this.restaurantID = info.restaurantID;
  localStorage.setItem('restaurantId', String(this.restaurantID)); // ✅ THIS LINE

        // Logo setup
        if (info.logoPath) {
          const cleanPath = info.logoPath.replace(/^\/+/, '');
          this.restaurantLogoUrl = cleanPath.includes('uploads/')
            ? `${environment.baseUrl}/${cleanPath}`
            : `${environment.baseUrl}/uploads/${cleanPath}`;
        } else {
          this.restaurantLogoUrl = 'assets/images/default-logo.png';
        }

        console.log('Constructed logo URL:', this.restaurantLogoUrl);

        // ✅ Now that restaurantID is set, fetch offers
        this.fetchOffers();
      },
      error: err => {
        console.error('Could not load restaurant info', err);
      }
    });
}



  // Toggle filter behavior: if the selected filter is already active, disable it.
  toggleFilter(filter: 'veg' | 'nonveg'): void {
    if (this.selectedFilter === filter) {
      // Toggle off the filter; show all items.
      this.selectedFilter = null;
      this.fetchMenuItems(); // Load all products.
    } else {
      // Apply the selected filter.
      this.selectedFilter = filter;
      // Convert to a boolean; 'veg' = true, 'nonveg' = false.
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
    return ''; // prevents image rendering if path is empty
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
          // Populate confirmedCart so step 2 can display items:
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

    

      // ✅ KEEP subcategory toggle states
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

// Add this to your MenuComponent class
confirmUPIPayment(): void {
  if (!this.orderID) return;

  // Close the UPI modal
  this.showUPIModal = false;
  
  // Mark payment as successful
  this.paymentSuccess = true;
  
  // Move to rating step
  this.currentStep = OrderStep.RATING;
  
  // Optionally: Send confirmation to backend
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
    await this.initiateUPIPayment(); // Generate UPI QR data
  }

  this.showPaymentConfirmModal = true; // Show confirmation modal only
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
  if (!this.restaurantID || this.restaurantID === 0) return; // ✅ Guard

  const url = `${this.API_BASE}/subcategories?restaurantId=${this.restaurantID}`; // ✅ FIXED URL

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


  // Update getFilteredMenuItems to handle the filter.
  getFilteredMenuItems(categoryID?: number, subCategoryID?: number): Product[] {
    let filteredItems = this.menuItems;

    // Filter by category if provided.
    if (categoryID) {
      filteredItems = filteredItems.filter(item => item.categoryID === categoryID);
    }

    // Filter by subcategory if provided.
    if (subCategoryID) {
      filteredItems = filteredItems.filter(item => item.subCategoryID === subCategoryID);
    }

    // Filter based on the search query.
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        item.productName.toLowerCase().includes(query) ||
        (item.productDescription?.toLowerCase().includes(query) ?? false)
      );
    }

    // Apply Veg/Non-Veg filter.
    if (this.selectedFilter === 'veg') {
      filteredItems = filteredItems.filter(item => item.isVeg);
    } else if (this.selectedFilter === 'nonveg') {
      filteredItems = filteredItems.filter(item => !item.isVeg);
    }

    return filteredItems;
  }


  // Returns true if the category or any of its subcategories have items after filtering
  shouldDisplayCategory(category: Category): boolean {
    // Check if any products in the category match the filter criteria.
    const categoryItems = this.getFilteredMenuItems(category.categoryID);
    if (categoryItems.length > 0) {
      return true;
    }
    // If the category has subcategories, check if any of them have matching items.
    if (category.subCategories && category.subCategories.length) {
      return category.subCategories.some(sub => {
        return this.getFilteredMenuItems(undefined, sub.subCategoryID).length > 0;
      });
    }
    return false;
  }

  // Returns true if the subcategory has any items after filtering
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
          basePrice: item.price
        }));

        this.cartItems = this.menuItems.map(item => ({ ...item })); // ✅ This is critical!

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
      console.log("✅ Categories loaded from backend:", response);
      this.categories = response;

      // Force UI to show them
      this.showCategorySelector = true;

      // Add fallback in case response is valid but empty
      if (this.categories.length === 0) {
        console.warn("⚠️ Categories fetched but array is empty");
      }

      this.isLoading = false;
    },
    error: (error) => {
      console.error('❌ Error loading categories', error);
      this.isLoading = false;
    }
  });
}


 async updateQuantityForNewItems(item: Product, change: number): Promise<void> {
  // if (!this.orderID) return;
clearTimeout(this.quantityDebounceTimer);
  this.quantityDebounceTimer = setTimeout(() => {
    // perform actual quantity update
  }, 200);
  // DECREMENT
  if (change === -1) {
    item.quantity = Math.max(0, (item.quantity || 0) - 1);
    if (item.quantity === 0 && item.basePrice != null) {
      // Reset the displayed price to base so the menu shows original price
      item.price = item.basePrice;
    }
    this.updateNewCart(item);
    return;
  }

  // INCREMENT
  if (item.customizationOptions && item.customizationOptions.length > 0) {
    // 1) Open customization dialog
    const selectedOptionId: number | null = await this.openCustomizationModal(item);
    if (selectedOptionId == null) {
      // CANCELLED → do nothing
      return;
    }

    // 2) Find the multiplier for the chosen option
    const selectedOption = item.customizationOptions.find(
      opt => opt.customizationOptionID === selectedOptionId
    );
    if (!selectedOption) return;

    // 3) Increase the quantity in memory
    item.quantity = (item.quantity || 0) + 1;

    // 4) Compute *additional* over basePrice, but do NOT overwrite base for display.
    const base = item.basePrice ?? item.price;
    // extra = base * (multiplier – 1)
    const extra = base * (selectedOption.fixedPrice - 1);
    const unitPriceForOrder =parseFloat((base + extra).toFixed(2));


    // 5) Push into newCart with that unitPrice. Menu display remains base.
this.updateNewCart(item, selectedOption, selectedOption.fixedPrice);
  } else {
    // No customization: increment and keep item.price = basePrice
    item.quantity = (item.quantity || 0) + 1;
    item.price = item.basePrice ?? item.price;
 this.updateNewCart(item, undefined, item.price);
  }
}

private updateNewCart(
  item: Product,
  selectedOption?: CustomizationOption,
  unitPriceForOrder?: number
): void {
  // ✅ CRITICAL: update quantityMap
  this.quantityMap[item.productID] = item.quantity;

  const existingItem = this.newCart.find(ci => ci.productID === item.productID);

  const finalUnitPrice = unitPriceForOrder != null
    ? unitPriceForOrder
    : (item.basePrice ?? item.price);

  if (existingItem) {
    existingItem.quantity = item.quantity;

    if (selectedOption) {
      existingItem.customizationOptionIds = [selectedOption.customizationOptionID];
      existingItem.unitPrice = finalUnitPrice;
    } else {
      existingItem.unitPrice = finalUnitPrice;
    }

    if (existingItem.quantity === 0) {
      this.newCart = this.newCart.filter(ci => ci.productID !== item.productID);
    }
  } else if (item.quantity > 0) {
    const newItem: OrderItem = {
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: finalUnitPrice,
      customizationOptionIds: selectedOption
        ? [selectedOption.customizationOptionID]
        : []
    };
    this.newCart.push(newItem);
  }

  this.newCart = [...this.newCart];
}


  private openCustomizationModal(product: Product): Promise<number | null> {
    return new Promise((resolve) => {
      const dialogRef = this.dialog.open(CustomizationModalComponent, {
        width: '300px',
        data: { product }
      });
      dialogRef.afterClosed().subscribe((result: number | null) => {
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
    // ✅ STEP 1: CREATE ORDER IF NEEDED
    if (!this.orderID) {
      console.log('[Order Flow] No existing order, creating new one...');
      const url = `${this.API_BASE}/order/generate?tableNo=${tableID}&restaurantId=${this.restaurantID}`;
      const body = { userID: this.userID };

      newOrder = await firstValueFrom(this.http.post<any>(url, body));

      if (newOrder) {
        this.orderID = newOrder.orderID;
        this.orderStatus = newOrder.orderStatus;
        this.orderCreatedAt = new Date(newOrder.createdAt);
      }

      console.log('[Order Flow] New order created with ID:', this.orderID);
    } else {
      console.log('[Order Flow] Existing order found, checking status...');
      const statusResp = await firstValueFrom(
        this.http.get<any>(`${this.API_BASE}/order/status/${this.orderID}`)
      );
      this.orderStatus = statusResp.status;
      console.log('[Order Flow] Current order status:', this.orderStatus);
    }

    // ✅ STEP 2: ADD CART ITEMS
    console.log('[Order Flow] Posting cart items to server...');
    const itemsToSend = this.newCart.map(item => ({
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      customizationOptionIds: item.customizationOptionIds || []
    }));

    if (itemsToSend.length === 0) {
      console.warn('🚫 No items to send. Aborting order placement.');
      return null;
    }

    await firstValueFrom(
      this.http.post(`${this.API_BASE}/order/${this.orderID}/addItem?restaurantId=${this.restaurantID}`, itemsToSend)
    );

    // ✅ STEP 3: CONFIRM ORDER IF NOT ALREADY
// ✅ STEP 3: CONFIRM ORDER IF NOT ALREADY
if (this.orderStatus !== 'Confirmed') {
  await firstValueFrom(
    this.http.post(`${this.API_BASE}/order/${this.orderID}/confirm?restaurantId=${this.restaurantID}`, {})
  );
  this.orderStatus = 'Confirmed';
}


    // ✅ STEP 4: Move to summary
    this.goToStep(OrderStep.ORDER_SUMMARY);
    this.saveOrderState();

    return newOrder;

  } catch (error) {
    console.error('[Order Flow] Error in submitCartAndProceed:', error);
    return null;
  }
}

rebuildNewCart() {
  console.log('🧩 cartItems:', this.cartItems);
  console.log('📦 quantityMap:', this.quantityMap);

  this.newCart = [];

  this.cartItems.forEach(item => {
    const quantity = this.quantityMap[item.productID];
    if (quantity && quantity > 0) {
      this.newCart.push({
        productID: item.productID,
        quantity: quantity,
        unitPrice: item.price
      });
    }
  });

  console.log('🧾 Rebuilt newCart:', this.newCart);
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
    
    console.log('[Order Flow] Successfully created order ID:', this.orderID);
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
    console.log('Items sent to backend:', this.newCart);
    
    console.log('[Order Flow] Items successfully added to order');
    
    // Clear local cart
    this.newCart = [];
    this.menuItems.forEach(item => {
      item.quantity = 0;
      item.price = item.basePrice ?? item.price;
    });
    
    // Confirm the order
    await this.sendOrderToKitchen();
    
  } catch (error) {
    console.error('[Order Flow] Error posting cart items:', error);
    throw error; // Re-throw to be caught by calling function
  }
}


async getOrderSummary(): Promise<void> {
  if (!this.orderID || !this.restaurantID) {
    console.warn('⚠️ Missing orderID or restaurantID to fetch summary');
    return;
  }

  this.isLoading = true;

  try {
    const timestamp = new Date().getTime(); // Prevents cache
    const summary = await firstValueFrom(
      this.http.get<OrderSummary>(
        `${this.API_BASE}/order/${this.orderID}/summary?restaurantId=${this.restaurantID}&timestamp=${timestamp}`
      )
    );

    // ✅ Optional: log the response to debug
    console.log("✅ Summary fetched:", summary);

    // Optional status mapping (if you use internal UI mappings)
    summary.orderStatus = this.mapStatus(summary.orderStatus);

    this.orderSummaryDetails = summary;

    // ✅ Fill confirmedCart (used for UI display and final confirmation)
    this.confirmedCart = summary.orderItems.map(item => ({
      productID: item.productID,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      customizationOptionIds: item.customizations?.map(c => c.customizationOptionID) || []
    }));

    // ✅ Evaluate offers (if your system supports them)
    this.evaluateOffers();

  } catch (error) {
    console.error('❌ Error fetching order summary:', error);
  } finally {
    this.isLoading = false;
  }
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

  // 🔁 Fallback: try to find it from order summary if menuItems doesn't have it
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

  console.log('[Order Flow] Sending order to kitchen...');
  
  try {
    await firstValueFrom(
      this.http.post(`${this.API_BASE}/order/${this.orderID}/confirm`, {})
    );
    
    this.orderConfirmationTime = new Date();
    console.log('[Order Flow] Order successfully confirmed and sent to kitchen');
    
  } catch (error) {
    console.error('[Order Flow] Error sending order to kitchen:', error);
    throw error;
  }
}


downloadBill() {
  this.http.get(`${this.API_BASE}/order/${this.orderID}/bill`, {
    responseType: 'blob',
  }).subscribe(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bill_Order_${this.orderID}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, error => {
    alert('Failed to generate bill. Please try again or ask staff for help.');
  });
}


addNewItemsToOrder(): void {
  if (this.newCart.length === 0) return;

this.http.post(`${this.API_BASE}/order/${this.orderID}/addItem?restaurantId=${this.restaurantID}`, this.newCart)
    .subscribe({
      next: (response: any) => {
        // Merge new items into confirmedCart (local copy)
        this.newCart.forEach(newItem => {
          const existing = this.confirmedCart.find(item => item.productID === newItem.productID);
          if (existing) {
            existing.quantity += newItem.quantity;
          } else {
            this.confirmedCart.push({ ...newItem });
          }
        });

        // Clear newCart and reset UI
        this.newCart = [];
        this.menuItems.forEach(item => {
          item.quantity = 0;
          item.price = item.basePrice ?? item.price;
        });

       // ✅ Update order summary from backend
this.getOrderSummary().then(() => {
  this.evaluateOffers(); // ✅ Re-check offers after new items added
});
this.sendOrderToKitchen();


        // ✅ Save latest state to localStorage
        this.saveOrderState(); // ← add this
      },
      error: (error) => {
        console.error("Error adding new items:", error);
      }
    });
}

}       