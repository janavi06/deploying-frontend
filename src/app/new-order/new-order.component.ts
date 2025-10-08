// Angular / existing
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

// Material dialog + your modal component
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomizationModalComponent } from '../customization-modal/customization-modal.component';

// other existing imports
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from '../../environments/environment';

export interface CustomisationOption {
  customizationOptionID: number;
  name: string;
   fixedPrice: number; // 👈 CHANGE 'priceDelta' TO 'fixedPrice'

  selected?: boolean;
}
export interface Product {
  productID: number;
  productName: string;
  basePrice: number;
  price: number;
  productDescription?: string;
  imagePath?: string;
  categoryID: number;
  subCategoryID?: number;
  isVeg: boolean;
  isAvailable?: boolean;
  quantity?: number;
  
  // ✅ FIX: Add both property names to handle API response
  customizationOptions?: CustomisationOption[];
  CustomizationOptions?: CustomisationOption[]; // API response uses this
}
export interface CartItem {
  productID: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  customizationOptionIds: number[];
  customisations: string[];

}
export interface Category {
  categoryID: number;
  categoryName: string;
  products: Product[];
  subCategories: SubCategory[];
}
export interface SubCategory {
  subCategoryID: number;
  subCategoryName: string;
  categoryID: number;
  products: Product[];
  open?: boolean;
}

@Component({
  selector   : 'app-new-order',
  standalone : true,
  imports    : [CommonModule, FormsModule, QRCodeComponent, MatDialogModule, CustomizationModalComponent],
  templateUrl: './new-order.component.html',
  styleUrls  : ['./new-order.component.css']
})
export class NewOrderComponent implements OnInit, OnDestroy {
  /* 🔹 NEW: parent-provided restaurantId */
  @Input() restaurantId!: number;
  @Input() showPaymentOptions: boolean = false; // ✅ For waiter flow
/* 🔹 NEW: events back to Waiter - UPDATED TYPE */
  @Output() closed = new EventEmitter<void>();
  @Output() orderPlaced = new EventEmitter<{ 
    orderID: number; 
    paymentStatus?: string; 
    paymentMethod?: string;
    paymentPreference?: string 
  }>(); 

  /* ─ external data ─ */
  tables: any[] = [];
  products: Product[] = [];
  categories: Category[] = [];
  subCategories: SubCategory[] = [];
  selectedSubCategoryID: number | null = null;

  /* ─ UI state ─ */
  searchTerm = '';
  selectedFilter: 'veg' | 'nonveg' | null = null;
  selectedTable: number | '' = '';
  selectedCategoryID: number | null = null;
  showCategorySelector  = true;
  cartOpen = false; // start collapsed

  cart: CartItem[] = [];
  busy  = false;
  busyPay = false;
  Math = Math;

  /* modal (add-to-cart) */
  showModal      = false;
  modalProduct   : Product | null = null;
  modalOptions   : CustomisationOption[] = [];
  modalQty       = 1;
  modalLineTotal = 0;

  /* payment modal */
  paymentStage: 0|1|2|3 = 0;  
  orderID     = 0;
  orderTotal  = 0;
  method      : '' | 'Cash' | 'UPI' = '';

  // UPI state
  upiId = '';
  upiName = '';
  upiAmount = 0;
  upiTxnId = '';
  upiUri = '';
  paymentId: number | null = null;

  /* helpers */
  quantityMap: { [id: number]: number } = {};
  paymentPreference: 'PayNow' | 'PayLater' = 'PayLater'; // ✅ For waiter flow

  private readonly API = environment.apiUrl;

constructor(
  private http: HttpClient,
  private dialog: MatDialog,
  private cd: ChangeDetectorRef
) {}

  async ngOnInit(): Promise<void> {
    if (!this.restaurantId) { alert('Restaurant ID missing'); return; }

    /* tables */
    this.http.get<any[]>(`${this.API}/restauranttables?restaurantId=${this.restaurantId}`)
             .subscribe(t => this.tables = t);

    /* categories + subs + menu */
    await Promise.all([
      this.fetchCategories(),
      this.fetchSubCategories(),
      this.fetchMenuItems()
    ]);
 setTimeout(() => {
    this.debugCustomizationOptions();
    console.log('🔄 Checking if modal opens when clicking + button...');
  }, 1000);
  }

  ngOnDestroy(): void {}

  /* ===== helper for accordion ===== */
  toggleSub(sub: SubCategory) { sub.open = !sub.open; }

  /* ===== back button ===== */
  goBack() { this.closed.emit(); }

  // ✅ This function now correctly routes to the appropriate submission method
  placeOrderWithPreference() {
    if (this.showPaymentOptions) {
      // Waiter flow - use the corrected submitWithPreference
      this.submitWithPreference();
    } else {
      // Customer flow - use normal submit
      this.submit();
    }
  }

async submitWithPreference() {
  if (!this.selectedTable || !this.cart.length) return;
  this.busy = true;

  try {
    const orderPayload = {
      OrderItems: this.cart.map(c => ({
        productID: c.productID,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        customizationOptionIds: c.customizationOptionIds || []
      }))
    };

    console.log('🔄 Submitting waiter order with payment preference:', this.paymentPreference);

    // Generate the order with payment preference
    const gen: any = await this.http.post(
      `${this.API}/order/generate?tableNo=${this.selectedTable}&restaurantId=${this.restaurantId}&source=waiter&paymentPreference=${this.paymentPreference}`,
      orderPayload
    ).toPromise();

    this.orderID = gen.orderID;
    
    console.log('✅ Order created with details:', {
      orderID: this.orderID,
      paymentPreference: this.paymentPreference,
      orderStatus: gen.orderStatus,
      paymentStatus: gen.paymentStatus
    });

    if (this.paymentPreference === 'PayNow') {
      // For PayNow orders: Show payment options immediately
      this.orderTotal = this.total;
      this.paymentStage = 1;
      this.busy = false;
      
      // Emit event with extended properties
      this.orderPlaced.emit({ 
        orderID: this.orderID,
        paymentStatus: 'created', // Order created but payment not completed
        paymentPreference: 'PayNow'
      });
      
    } else {
      // For PayLater orders: These should go to Pending Payments
      this.orderPlaced.emit({ 
        orderID: this.orderID,
        paymentStatus: 'pending',
        paymentPreference: 'PayLater'
      });
      
      alert(`✅ Order #${this.orderID} placed successfully! Payment is pending in the "Collect" tab.`);
      this.resetAndClose();
    }

  } catch (e: any) {
    console.error('❌ Error placing waiter order:', e);
    alert(`Failed to place order: ${e.error?.message || 'Please try again'}`);
    this.busy = false;
  }
}
  /** Build UPI URI (BHIM standard) */
  private buildUpiUri(pa: string, pn: string, am: number, tr: string, tn: string = 'ScanUI Order'): string {
    const enc = encodeURIComponent;
    // Ensure 2 decimals for amount
    const amt = (am ?? 0).toFixed(2);
    return `upi://pay?pa=${enc(pa)}&pn=${enc(pn)}&am=${enc(amt)}&tr=${enc(tr)}&tn=${enc(tn)}&cu=INR`;
  }

  /** Start payment based on selected method */
  async beginPayment() {
    if (!this.method) return;
    this.busyPay = true;

    try {
      if (this.method === 'UPI') {
        // 1) Create a pending UPI payment and get UPI details back
        const resp: any = await this.http.post(
          `${this.API}/order/${this.orderID}/initiate-payment?method=UPI&restaurantId=${this.restaurantId}`, {}
        ).toPromise();

        // Expecting upiId, upiName, amount, transactionId, paymentId
        this.upiId = resp?.upiId || '';
        this.upiName = resp?.upiName || '';
        this.upiAmount = +resp?.amount || this.orderTotal || 0;
        this.upiTxnId = resp?.transactionId || '';
        this.paymentId = resp?.paymentId ?? null;

        this.upiUri = this.buildUpiUri(this.upiId, this.upiName, this.upiAmount, this.upiTxnId, `Order #${this.orderID}`);

        // 2) Show QR step
        this.paymentStage = 3;
      } else {
        // Cash: create & immediately complete payment, then open bill
        const started: any = await this.http.post(
          `${this.API}/order/${this.orderID}/initiate-payment?method=Cash&restaurantId=${this.restaurantId}`, {}
        ).toPromise();

        const pid = started?.paymentId;
        if (pid) {
          await this.http.put(
            `${this.API}/order/pending-payments/${pid}/clear?restaurantId=${this.restaurantId}`, {}
          ).toPromise();
        }

        // Download bill then reset
        window.open(`${this.API}/order/${this.orderID}/bill`, '_blank');
        this.resetAndClose();
      }
    } catch (e) {
      console.error(e);
      alert('Payment initiation failed');
    } finally {
      this.busyPay = false;
    }
  }
// Add these methods to your NewOrderComponent class



  /** Utility: copy UPI URI so they can pay from another device if needed */
  async copyUpiUri() {
    try {
      await navigator.clipboard.writeText(this.upiUri);
      alert('UPI link copied!');
    } catch {
      alert('Copy failed');
    }
  }

  updateQuantity(item: Product, delta: number) {
    item.quantity = Math.max(0, (item.quantity || 0) + delta);
    this.quantityMap[item.productID] = item.quantity;

    const existing = this.cart.find(ci =>
      ci.productID === item.productID && ci.customizationOptionIds.length === 0);

    if (item.quantity === 0) {
      if (existing) this.cart = this.cart.filter(c => c !== existing);
      return;
    }
    if (existing) {
      existing.quantity = item.quantity;
    } else {
      this.cart.push({
        productID: item.productID,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        customizationOptionIds: [],
        customisations: []
      });
    }
  }

  // Derived getters
  get currentSubCategories() {
    const cat = this.categories.find(c => c.categoryID === this.selectedCategoryID);
    return cat?.subCategories?.length ? cat.subCategories : [];
  }

  get currentCategoryName(): string {
    return this.categories.find(c => c.categoryID === this.selectedCategoryID)?.categoryName || 'All';
  }

  // NEW: selection handlers
  selectCategory(id: number | null) {
    this.selectedCategoryID = id;
    this.selectedSubCategoryID = null;
  }

  selectSubCategory(id: number | null) {
    this.selectedSubCategoryID = id;
  }

  // NEW: products for chips selection (replaces accordion filtering)
  getProductsForSelection() {
    let list = this.products;

    if (this.selectedCategoryID)   list = list.filter(p => p.categoryID === this.selectedCategoryID);
    if (this.selectedSubCategoryID) list = list.filter(p => p.subCategoryID === this.selectedSubCategoryID);

    // veg / non-veg
    if (this.selectedFilter === 'veg')    list = list.filter(p => p.isVeg);
    if (this.selectedFilter === 'nonveg') list = list.filter(p => !p.isVeg);

    // search
    const q = this.searchTerm.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase().includes(q))
    );

    return list;
  }

  /* ─ data loaders ─ */
  private fetchCategories() {
    return this.http.get<Category[]>(`${this.API}/categories?restaurantId=${this.restaurantId}`)
      .toPromise().then(c => this.categories = c ?? []);
  }

  private fetchSubCategories() {
    return this.http.get<SubCategory[]>(`${this.API}/subcategories?restaurantId=${this.restaurantId}`)
      .toPromise().then(sc => this.subCategories = sc ?? []);
  }

private fetchMenuItems() {
  return this.http.get<any[]>(`${this.API}/product?restaurantId=${this.restaurantId}`)
    .toPromise().then(apiProducts => {
      if (!apiProducts) {
        console.log('❌ No products returned from API');
        return;
      }

      console.log(`✅ Loaded ${apiProducts.length} products from API`);

      // Map the raw API data to our internal Product model
      this.products = apiProducts.map(m => {
        // ✅ FIX: Handle both property names from API
        const customizationOptions = m.customizationOptions || m.CustomizationOptions || [];
        
        const product: Product = {
          productID: m.productID,
          productName: m.productName,
          price: m.price,
          productDescription: m.productDescription,
          imagePath: m.imagePath,
          categoryID: m.categoryID,
          subCategoryID: m.subCategoryID,
          isVeg: m.isVeg,
          isAvailable: m.isAvailable,
          basePrice: m.price,
          quantity: 0,
          
          // ✅ FIX: Use the correct property name
          customizationOptions: customizationOptions.map((opt: any) => ({
            customizationOptionID: opt.customizationOptionID,
            name: opt.name,
            fixedPrice: opt.fixedPrice || 0,
            selected: false
          }))
        };

        // Enhanced logging
        if (customizationOptions.length > 0) {
          console.log(`🎯 Product "${product.productName}" has ${customizationOptions.length} customization options:`, customizationOptions);
        }

        return product;
      });

      this.assignProductsToCategories();
      this.assignProductsToSubCategories();

      // Enhanced debug
      this.debugCustomizationOptions();
      
    }).catch(error => {
      console.error('❌ Error fetching menu items:', error);
    });
}
  /* ─ mapping ─ */
  private assignProductsToCategories() {
    if (!this.products.length || !this.categories.length) return;
    const map = new Map<number, Category>();
    this.categories.forEach(c => map.set(c.categoryID, { ...c, products: [], subCategories: c.subCategories || [] }));
    this.products.forEach(p => {
      if (p.subCategoryID) return;
      const cat = map.get(p.categoryID);
      if (cat) cat.products.push(p);
    });
    this.categories = Array.from(map.values());
  }

  private assignProductsToSubCategories() {
    if (!this.products.length || !this.subCategories.length) return;
    this.subCategories.forEach(sc => {
      sc.products = this.products.filter(p => p.subCategoryID === sc.subCategoryID);
    });
  }

  /* ─ filtering & search ─ */
  toggleFilter(kind: 'veg' | 'nonveg') {
    this.selectedFilter = this.selectedFilter === kind ? null : kind;
  }

  filteredProducts(catId?: number, subId?: number) {
    let list = this.products;
    if (catId) list = list.filter(p => p.categoryID === catId);
    if (subId) list = list.filter(p => p.subCategoryID === subId);
    if (this.selectedFilter === 'veg')    list = list.filter(p => p.isVeg);
    if (this.selectedFilter === 'nonveg') list = list.filter(p => !p.isVeg);
    const q = this.searchTerm.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase().includes(q)));
    return list;
  }
getSelectedOptionsTotal(): number {
  if (!this.modalOptions) return 0;
  return this.modalOptions
    .filter(o => o.selected)
    .reduce((sum, opt) => sum + opt.fixedPrice, 0);
}
// Enhanced debug method

// Enhanced debug method
debugCustomizationOptions() {
  console.log('=== 🔧 Customization Options Detailed Debug ===');
  
  this.products.forEach((product, index) => {
    const options = product.customizationOptions || [];
    console.log(`🍽️ [${index + 1}] Product: "${product.productName}"`, {
      productID: product.productID,
      hasCustomizationOptions: !!product.customizationOptions,
      optionsCount: options.length,
      options: options.map(opt => ({
        id: opt.customizationOptionID,
        name: opt.name,
        price: opt.fixedPrice
      }))
    });
  });

  const productsWithCustomizations = this.products.filter(p => 
    p.customizationOptions && p.customizationOptions.length > 0
  );
  
  console.log(`📊 Summary: ${productsWithCustomizations.length} products have customization options`);
  console.log('=== End Debug ===');
}
/** Open customization dialog (Material) with server-fallback and add-to-cart merge logic */
async openCustomisation(p: Product) {
  console.group(`openCustomisation (MatDialog) productID=${p?.productID} name="${p?.productName}"`);
  if (!p) { console.warn('openCustomisation called with falsy product'); console.groupEnd(); return; }

  // 1) Try to get in-memory options
  let options = this.getCustomizationOptions(p) 
                || (p as any).CustomizationOptions 
                || (p as any).customizationOptions 
                || [];

  // 2) If none, try server fallback (keeps UX working if list endpoint omitted details)
  if (!options || !options.length) {
    console.warn('No in-memory customization options - fetching from server as fallback');
    try {
      const fetched = await this.fetchCustomizationFromServer(p);
      if (Array.isArray(fetched) && fetched.length) {
        options = fetched;
        // attach for later to avoid repeated network calls
        (p as any).customizationOptions = fetched;
        (p as any).CustomizationOptions = fetched;
      } else {
        console.warn('Server returned no customization options for product', p.productID);
      }
    } catch (err) {
      console.error('fetchCustomizationFromServer failed:', err);
    }
  }

  // 3) Open the Material dialog and pass product + options
  const dialogRef = this.dialog.open(CustomizationModalComponent, {
    width: '460px',
    maxWidth: 'calc(100vw - 32px)',
    panelClass: 'my-customization-dialog', // useful for custom z-index if needed
    data: {
      product: { ...p, customizationOptions: options }
    }
  });

  // 4) Wait for result (selected option id or null)
  try {
    const selectedOptionId = await dialogRef.afterClosed().toPromise();
    console.log('customization dialog closed, result:', selectedOptionId);

    if (selectedOptionId == null) { console.groupEnd(); return; } // user cancelled

    // 5) Find chosen option details (if any)
    const chosen = (options || []).find((o: any) => o.customizationOptionID === selectedOptionId);

    // compute unit price = base + addon (if chosen)
    const unitPrice = (p.price || 0) + (chosen?.fixedPrice || 0);

    // Build cart item
    const cartItem: CartItem = {
      productID: p.productID,
      productName: p.productName,
      quantity: 1,
      unitPrice,
      customizationOptionIds: chosen ? [chosen.customizationOptionID] : [],
      customisations: chosen ? [chosen.name] : []
    };

    // 6) Merge with existing cart (same product + same options)
    const key = JSON.stringify([cartItem.productID, cartItem.customizationOptionIds.slice().sort()]);
    const existing = this.cart.find(c => JSON.stringify([c.productID, c.customizationOptionIds.slice().sort()]) === key);
    if (existing) {
      existing.quantity += cartItem.quantity;
    } else {
      this.cart.push(cartItem);
    }

    // update UI
    this.cd.detectChanges();
    console.log('Added customized item to cart:', cartItem);
  } catch (err) {
    console.error('Error handling customization dialog result:', err);
  } finally {
    console.groupEnd();
  }
}

private async fetchCustomizationFromServer(p: Product): Promise<CustomisationOption[]> {
  if (!p || !p.productID) return [];
  const url = `${this.API}/product/${p.productID}/customizations?restaurantId=${this.restaurantId}`;
  console.log('fetchCustomizationFromServer ->', url);
  try {
    const resp: any = await this.http.get<any[]>(url).toPromise();
    if (!resp || !Array.isArray(resp) || resp.length === 0) {
      console.log('No customization options returned from server for', p.productID);
      return [];
    }
    const mapped = resp.map((opt: any, i: number) => ({
      customizationOptionID: opt.customizationOptionID ?? opt.id ?? i,
      name: opt.name ?? opt.optionName ?? `Option ${i+1}`,
      fixedPrice: Number(opt.fixedPrice ?? opt.price ?? 0) || 0,
      selected: false
    })) as CustomisationOption[];
    // attach locally
    (p as any).customizationOptions = mapped;
    (p as any).CustomizationOptions = mapped;
    return mapped;
  } catch (e) {
    console.error('fetchCustomizationFromServer error', e);
    return [];
  }
}


// Add this method to check DOM state
checkModalDOM() {
  console.log('🔍 CHECKING MODAL DOM STATE');
  
  // Check if overlay element exists
  const overlay = document.querySelector('.overlay');
  console.log('Overlay element:', overlay);
  
  if (overlay) {
    console.log('Overlay found in DOM!');
    console.log('Overlay styles:', window.getComputedStyle(overlay));
    console.log('Overlay parent:', overlay.parentElement);
    console.log('Overlay children:', overlay.children);
    
    // Check if modal exists inside overlay
    const modal = overlay.querySelector('.modal');
    console.log('Modal inside overlay:', modal);
    
    if (modal) {
      console.log('Modal styles:', window.getComputedStyle(modal));
    }
  } else {
    console.log('❌ Overlay NOT found in DOM - *ngIf is false');
  }
  
  // Check for any elements that might be covering the modal
  const highZIndexElements = Array.from(document.querySelectorAll('*'))
    .filter(el => {
      const zIndex = window.getComputedStyle(el).zIndex;
      return zIndex !== 'auto' && parseInt(zIndex) >= 2000;
    })
    .map(el => ({
      tag: el.tagName,
      class: el.className,
      zIndex: window.getComputedStyle(el).zIndex,
      element: el
    }));
  
  console.log('High z-index elements:', highZIndexElements);
}
// Add this helper method to safely get customization options
private getCustomizationOptions(p: Product): CustomisationOption[] {
  // Try both property names and ensure we return an array
  const options = p.customizationOptions || (p as any).CustomizationOptions || [];
  return Array.isArray(options) ? options : [];
}

// Helper method for template
hasCustomizationOptions(p: Product): boolean {
  const options = this.getCustomizationOptions(p);
  return options.length > 0;
}
recalcModalPrice() {
  const basePrice = this.modalProduct?.price || 0;
  const addOn = this.getSelectedOptionsTotal();
  this.modalLineTotal = (basePrice + addOn) * this.modalQty;
}
  closeModal() { this.showModal = false; }

addToCart() {
  if (!this.modalProduct) return;
  const selected  = this.modalOptions.filter(o => o.selected);
  const optionIds = selected.map(o => o.customizationOptionID);
  const optionTxt = selected.map(o => o.name);
  
  const item: CartItem = {
    productID: this.modalProduct.productID,
    productName: this.modalProduct.productName,
    quantity: this.modalQty,
    unitPrice: this.modalLineTotal,
    customizationOptionIds: optionIds,     // ✅ For backend processing
    customisations: optionTxt              // ✅ For UI display
  };
  
  const key = JSON.stringify([item.productID, optionIds.slice().sort()]);
  const existing = this.cart.find(c =>
    JSON.stringify([c.productID, c.customizationOptionIds.slice().sort()]) === key);
    
  existing ? (existing.quantity += item.quantity) : this.cart.push(item);
  this.closeModal();
}


  /* ─ cart helpers ─ */
  inc(c: CartItem) { c.quantity++; }
  dec(c: CartItem) { if (--c.quantity === 0) this.cart = this.cart.filter(x => x !== c); }
  remove(i: number) { this.cart.splice(i, 1); }
  clearCart() { this.cart = []; }
  get total() { return this.cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0); }

  /* ─ place order → payment ─ */
  async submit() {
    if (!this.selectedTable || !this.cart.length) return;
    this.busy = true;
    try {
      /* 1) generate order */
      const gen: any = await this.http.post(
        `${this.API}/order/generate?tableNo=${this.selectedTable}&restaurantId=${this.restaurantId}&source=Customer`,
        {}
      ).toPromise();
      this.orderID = gen.orderID;
      this.orderPlaced.emit({ orderID: this.orderID });

      /* 2) add items */
      await this.http.post(
        `${this.API}/order/${this.orderID}/addItem?restaurantId=${this.restaurantId}`,
        this.cart.map(c => ({
          productID: c.productID,
          quantity : c.quantity,
          unitPrice: c.unitPrice,
          customizationOptionIds: c.customizationOptionIds
        }))
      ).toPromise();

      /* 3) For regular customer flow, show Pay NOW / LATER options */
      this.orderTotal   = this.total;
      this.paymentStage = 1;

    } catch (e) {
      console.error(e);
      alert('Failed to place order');
    } finally {
      this.busy = false;
    }
  }

  payLater() {
    this.http.post(
      `${this.API}/order/${this.orderID}/pending?restaurantId=${this.restaurantId}`,
      { method: 'Deferred' }
    ).subscribe(() => this.resetAndClose());
  }

  async collectPayment() {
    if (!this.method) return;
    this.busyPay = true;
    try {
      if (this.method === 'UPI') {
        await this.http.post(
          `${this.API}/order/${this.orderID}/initiate-payment?method=UPI&restaurantId=${this.restaurantId}`, {}
        ).toPromise();
      }
      await this.http.put(
        `${this.API}/order/pending-payments/${this.orderID}/clear?restaurantId=${this.restaurantId}`, {}
      ).toPromise();

      window.open(`${this.API}/order/${this.orderID}/bill`, '_blank');
      this.resetAndClose();

    } catch (e) {
      console.error(e);
      alert('Payment error');
    } finally {
      this.busyPay = false;
    }
  }


// Add these methods to your NewOrderComponent class

async initiateUPIPayment() {
  this.busyPay = true;
  try {
    // Create UPI payment
    const resp: any = await this.http.post(
      `${this.API}/order/${this.orderID}/initiate-payment?method=UPI&restaurantId=${this.restaurantId}&channel=Waiter`,
      {}
    ).toPromise();

    this.upiId = resp?.upiId || '';
    this.upiName = resp?.upiName || '';
    this.upiAmount = +resp?.amount || this.orderTotal || 0;
    this.upiTxnId = resp?.transactionId || '';
    this.paymentId = resp?.paymentId ?? null;

    this.upiUri = this.buildUpiUri(this.upiId, this.upiName, this.upiAmount, this.upiTxnId, `Order #${this.orderID}`);
    
    // Move to UPI QR stage
    this.paymentStage = 2;
  } catch (e) {
    console.error('UPI initiation failed:', e);
    alert('Failed to initialize UPI payment');
  } finally {
    this.busyPay = false;
  }
}

async initiateCashPayment() {
  // Move directly to cash confirmation
  this.paymentStage = 3;
}





cancelPayment() {
  this.paymentStage = 0;
  this.busy = false;
}

private pushSuccessAlert(message: string) {
  // This would integrate with your alert system
  alert(message);
}





async markUPIPaid() {
  if (!this.paymentId) {
    alert('Payment not initialized');
    return;
  }

  this.busyPay = true;
  try {
    // Mark UPI payment as completed
    await this.http.put(
      `${this.API}/order/pending-payments/${this.paymentId}/clear?restaurantId=${this.restaurantId}`,
      {}
    ).toPromise();

    // Download bill
    window.open(`${this.API}/order/${this.orderID}/bill?restaurantId=${this.restaurantId}`, '_blank');
    
    // ✅ For PayNow orders: Order stays in Orders section
    this.orderPlaced.emit({ 
      orderID: this.orderID,
      paymentStatus: 'paid',
      paymentMethod: 'UPI',
      paymentPreference: 'PayNow'
    });
    
    this.pushSuccessAlert(`✅ Order #${this.orderID} placed and paid via UPI! Order is in Orders section.`);
    
    this.resetAndClose();
  } catch (e) {
    console.error('Failed to mark UPI as paid:', e);
    alert('Error completing UPI payment');
  } finally {
    this.busyPay = false;
  }
}

async markCashPaid() {
  this.busyPay = true;
  try {
    // Create cash payment and mark as completed immediately
    const started: any = await this.http.post(
      `${this.API}/order/${this.orderID}/initiate-payment?method=Cash&restaurantId=${this.restaurantId}&channel=Waiter`,
      {}
    ).toPromise();

    const pid = started?.paymentId;
    if (pid) {
      await this.http.put(
        `${this.API}/order/pending-payments/${pid}/clear?restaurantId=${this.restaurantId}`,
        {}
      ).toPromise();
    }

    // Download bill
    window.open(`${this.API}/order/${this.orderID}/bill?restaurantId=${this.restaurantId}`, '_blank');
    
    // ✅ For PayNow orders: Order stays in Orders section
    this.orderPlaced.emit({ 
      orderID: this.orderID,
      paymentStatus: 'paid',
      paymentMethod: 'Cash',
      paymentPreference: 'PayNow'
    });
    
    this.pushSuccessAlert(`✅ Order #${this.orderID} placed and paid via Cash! Order is in Orders section.`);
    
    this.resetAndClose();
  } catch (e) {
    console.error('Cash payment failed:', e);
    alert('Error processing cash payment');
  } finally {
    this.busyPay = false;
  }
}


  private resetAndClose() {
    this.paymentStage = 0;
    this.cart = [];
    this.closed.emit();       // 🔹 tell Waiter to close this tab
  }
} 