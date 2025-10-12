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
  fixedPrice: number;
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
  customizationOptions?: CustomisationOption[];
  CustomizationOptions?: CustomisationOption[];
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
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, FormsModule, QRCodeComponent, MatDialogModule, CustomizationModalComponent],
  templateUrl: './new-order.component.html',
  styleUrls: ['./new-order.component.css']
})
export class NewOrderComponent implements OnInit, OnDestroy {
  @Input() restaurantId!: number;
  @Input() showPaymentOptions: boolean = false;
  @Output() closed = new EventEmitter<void>();
  @Output() orderPlaced = new EventEmitter<{ 
    orderID: number; 
    paymentStatus?: string; 
    paymentMethod?: string;
    paymentPreference?: string 
  }>(); 

  tables: any[] = [];
  products: Product[] = [];
  categories: Category[] = [];
  subCategories: SubCategory[] = [];
  selectedSubCategoryID: number | null = null;

  searchTerm = '';
  selectedFilter: 'veg' | 'nonveg' | null = null;
  selectedTable: number | '' = '';
  selectedCategoryID: number | null = null;
  showCategorySelector = true;
  cartOpen = false;

  cart: CartItem[] = [];
  busy = false;
  busyPay = false;
  Math = Math;

  showModal = false;
  modalProduct: Product | null = null;
  modalOptions: CustomisationOption[] = [];
  modalQty = 1;
  modalLineTotal = 0;

  paymentStage: 0|1|2|3 = 0;  
  orderID = 0;
  orderTotal = 0;
  method: '' | 'Cash' | 'UPI' = '';

  upiId = '';
  upiName = '';
  upiAmount = 0;
  upiTxnId = '';
  upiUri = '';
  paymentId: number | null = null;
// In your NewOrderComponent class
restaurantDetails: any = {};
  quantityMap: { [id: number]: number } = {};
  paymentPreference: 'PayNow' | 'PayLater' = 'PayLater';

  private readonly API = environment.apiUrl;
  private readonly PRINT_API = 'http://localhost:9000/api/print'; // ✅ ADD PRINT API

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef
  ) {}

async ngOnInit(): Promise<void> {
  if (!this.restaurantId) { 
    alert('Restaurant ID missing'); 
    return; 
  }

  // Fetch restaurant details first
  await this.fetchRestaurantDetails();

  this.http.get<any[]>(`${this.API}/restauranttables?restaurantId=${this.restaurantId}`)
           .subscribe(t => this.tables = t);

  await Promise.all([
    this.fetchCategories(),
    this.fetchSubCategories(),
    this.fetchMenuItems()
  ]);
  
  setTimeout(() => {
    this.debugCustomizationOptions();
  }, 1000);
}


  ngOnDestroy(): void {}

  toggleSub(sub: SubCategory) { sub.open = !sub.open; }
  goBack() { this.closed.emit(); }

  placeOrderWithPreference() {
    if (this.showPaymentOptions) {
      this.submitWithPreference();
    } else {
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
        this.orderTotal = this.total;
        this.paymentStage = 1;
        this.busy = false;
        
        this.orderPlaced.emit({ 
          orderID: this.orderID,
          paymentStatus: 'created',
          paymentPreference: 'PayNow'
        });
        
      } else {
        this.orderPlaced.emit({ 
          orderID: this.orderID,
          paymentStatus: 'pending',
          paymentPreference: 'PayLater'
        });
        
        this.resetAndClose();
      }

    } catch (e: any) {
      console.error('❌ Error placing waiter order:', e);
      this.busy = false;
    }
  }
private async fetchRestaurantDetails(): Promise<void> {
  try {
    this.restaurantDetails = await this.http.get<any>(
      `${this.API}/restaurant/${this.restaurantId}/details`
    ).toPromise();
    
    console.log('🏪 Restaurant details loaded:', this.restaurantDetails);
  } catch (error) {
    console.error('❌ Error fetching restaurant details:', error);
    // Set default values if fetch fails
    this.restaurantDetails = {
      name: 'Restaurant',
      address: 'Address not available'
    };
  }
}

  private buildUpiUri(pa: string, pn: string, am: number, tr: string, tn: string = 'ScanUI Order'): string {
    const enc = encodeURIComponent;
    const amt = (am ?? 0).toFixed(2);
    return `upi://pay?pa=${enc(pa)}&pn=${enc(pn)}&am=${enc(amt)}&tr=${enc(tr)}&tn=${enc(tn)}&cu=INR`;
  }

  // ✅ ADD: Print bill method
private async printOrderBill(orderId: number): Promise<void> {
  try {
    console.log('🖨️ Printing bill for order:', orderId);
    console.log('🏪 Using restaurant details:', this.restaurantDetails);
    
    const printData = {
      "Type": "BILL",
      "PrinterName": "RP327 Printer",
      "RestaurantName": this.restaurantDetails.name || "Restaurant",
      "RestaurantAddress": this.restaurantDetails.address || "Address not available",
      "Order": {
        "Items": this.cart.map(item => ({
          "Name": item.productName,
          "Qty": item.quantity,
          "Price": item.unitPrice
        })),
        "Total": this.total
      }
    };

    const response = await this.http.post(this.PRINT_API, printData).toPromise();
    console.log('✅ Print successful:', response);
    
  } catch (error) {
    console.error('❌ Print failed:', error);
    // Don't throw error - continue with payment completion
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

  get currentSubCategories() {
    const cat = this.categories.find(c => c.categoryID === this.selectedCategoryID);
    return cat?.subCategories?.length ? cat.subCategories : [];
  }

  get currentCategoryName(): string {
    return this.categories.find(c => c.categoryID === this.selectedCategoryID)?.categoryName || 'All';
  }

  selectCategory(id: number | null) {
    this.selectedCategoryID = id;
    this.selectedSubCategoryID = null;
  }

  selectSubCategory(id: number | null) {
    this.selectedSubCategoryID = id;
  }

  getProductsForSelection() {
    let list = this.products;

    if (this.selectedCategoryID)   list = list.filter(p => p.categoryID === this.selectedCategoryID);
    if (this.selectedSubCategoryID) list = list.filter(p => p.subCategoryID === this.selectedSubCategoryID);

    if (this.selectedFilter === 'veg')    list = list.filter(p => p.isVeg);
    if (this.selectedFilter === 'nonveg') list = list.filter(p => !p.isVeg);

    const q = this.searchTerm.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase().includes(q))
    );

    return list;
  }

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

        this.products = apiProducts.map(m => {
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
            customizationOptions: customizationOptions.map((opt: any) => ({
              customizationOptionID: opt.customizationOptionID,
              name: opt.name,
              fixedPrice: opt.fixedPrice || 0,
              selected: false
            }))
          };

          if (customizationOptions.length > 0) {
            console.log(`🎯 Product "${product.productName}" has ${customizationOptions.length} customization options:`, customizationOptions);
          }

          return product;
        });

        this.assignProductsToCategories();
        this.assignProductsToSubCategories();
        this.debugCustomizationOptions();
        
      }).catch(error => {
        console.error('❌ Error fetching menu items:', error);
      });
  }

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

  toggleFilter(kind: 'veg' | 'nonveg') {
    this.selectedFilter = this.selectedFilter === kind ? null : kind;
  }

  filteredProducts(catId?: number, subId?: number) {
    let list = this.products;
    if (catId) list = list.filter(p => p.categoryID === catId);
    if (subId) list = list.filter(p => p.subCategoryID === subId);
    if (this.selectedFilter === 'veg')    list = list.filter(p => p.isVeg);
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

 async openCustomisation(p: Product) {
  console.group(`openCustomisation (MatDialog) productID=${p?.productID} name="${p?.productName}"`);
  if (!p) { console.warn('openCustomisation called with falsy product'); console.groupEnd(); return; }

  let options = this.getCustomizationOptions(p) 
                || (p as any).CustomizationOptions 
                || (p as any).customizationOptions 
                || [];

  if (!options || !options.length) {
    console.warn('No in-memory customization options - fetching from server as fallback');
    try {
      const fetched = await this.fetchCustomizationFromServer(p);
      if (Array.isArray(fetched) && fetched.length) {
        options = fetched;
        (p as any).customizationOptions = fetched;
        (p as any).CustomizationOptions = fetched;
      } else {
        console.warn('Server returned no customization options for product', p.productID);
      }
    } catch (err) {
      console.error('fetchCustomizationFromServer failed:', err);
    }
  }

  const dialogRef = this.dialog.open(CustomizationModalComponent, {
    width: '460px',
    maxWidth: 'calc(100vw - 32px)',
    panelClass: 'my-customization-dialog',
    data: {
      product: { ...p, customizationOptions: options }
    }
  });

  try {
    const result = await dialogRef.afterClosed().toPromise();
    console.log('customization dialog closed, result:', result);

    if (result == null) { 
      console.groupEnd(); 
      return; 
    }

    // ✅ FIX: The dialog returns an object with customizationOptionID AND price
    const customizationOptionID = result.customizationOptionID;
    const customizationPrice = result.price || 0;
    
    console.log('💰 Price breakdown:', {
      basePrice: p.price,
      customizationPrice: customizationPrice,
      totalUnitPrice: p.price + customizationPrice
    });

    // ✅ FIX: Calculate the correct unit price (base + customization)
    const unitPrice = p.price + customizationPrice;

    const chosen = (options || []).find((o: any) => o.customizationOptionID === customizationOptionID);
    
    const cartItem: CartItem = {
      productID: p.productID,
      productName: p.productName,
      quantity: 1,
      unitPrice: unitPrice, // ✅ This now includes base price + customization price
      customizationOptionIds: chosen ? [chosen.customizationOptionID] : [],
      customisations: chosen ? [chosen.name] : []
    };

    const key = JSON.stringify([cartItem.productID, cartItem.customizationOptionIds.slice().sort()]);
    const existing = this.cart.find(c => JSON.stringify([c.productID, c.customizationOptionIds.slice().sort()]) === key);
    
    if (existing) {
      existing.quantity += cartItem.quantity;
      console.log('📈 Increased quantity for existing customized item');
    } else {
      this.cart.push(cartItem);
      console.log('🆕 Added new customized item to cart');
    }

    // ✅ Debug: Show final cart item pricing
    console.log('🎯 Final cart item:', {
      productName: cartItem.productName,
      basePrice: p.price,
      customizationPrice: customizationPrice,
      totalUnitPrice: cartItem.unitPrice,
      quantity: cartItem.quantity,
      lineTotal: cartItem.unitPrice * cartItem.quantity
    });

    this.cd.detectChanges();
    console.log('Added customized item to cart:', cartItem);
    
  } catch (err) {
    console.error('Error handling customization dialog result:', err);
  } finally {
    console.groupEnd();
  }
}
// Add these helper methods to your NewOrderComponent

// Get the base price of a product (without customizations)
getProductBasePrice(productID: number): number {
  const product = this.products.find(p => p.productID === productID);
  return product?.price || 0;
}

// Calculate the customization price for a cart item
getCustomizationPrice(cartItem: CartItem): number {
  const basePrice = this.getProductBasePrice(cartItem.productID);
  return cartItem.unitPrice - basePrice;
}

// Debug method to check cart pricing
debugCartPricing(): void {
  console.log('🛒 Cart Pricing Debug:');
  this.cart.forEach((item, index) => {
    const basePrice = this.getProductBasePrice(item.productID);
    const customizationPrice = this.getCustomizationPrice(item);
    
    console.log(`Item ${index + 1}:`, {
      productName: item.productName,
      basePrice: basePrice,
      customizationPrice: customizationPrice,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.unitPrice * item.quantity,
      customizations: item.customisations
    });
  });
  
  console.log('🎯 Cart Total:', this.total);
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
      (p as any).customizationOptions = mapped;
      (p as any).CustomizationOptions = mapped;
      return mapped;
    } catch (e) {
      console.error('fetchCustomizationFromServer error', e);
      return [];
    }
  }

  checkModalDOM() {
    console.log('🔍 CHECKING MODAL DOM STATE');
    const overlay = document.querySelector('.overlay');
    console.log('Overlay element:', overlay);
    
    if (overlay) {
      console.log('Overlay found in DOM!');
      console.log('Overlay styles:', window.getComputedStyle(overlay));
      console.log('Overlay parent:', overlay.parentElement);
      console.log('Overlay children:', overlay.children);
      
      const modal = overlay.querySelector('.modal');
      console.log('Modal inside overlay:', modal);
      
      if (modal) {
        console.log('Modal styles:', window.getComputedStyle(modal));
      }
    } else {
      console.log('❌ Overlay NOT found in DOM - *ngIf is false');
    }
  }

  private getCustomizationOptions(p: Product): CustomisationOption[] {
    const options = p.customizationOptions || (p as any).CustomizationOptions || [];
    return Array.isArray(options) ? options : [];
  }

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
      customizationOptionIds: optionIds,
      customisations: optionTxt
    };
    
    const key = JSON.stringify([item.productID, optionIds.slice().sort()]);
    const existing = this.cart.find(c =>
      JSON.stringify([c.productID, c.customizationOptionIds.slice().sort()]) === key);
      
    existing ? (existing.quantity += item.quantity) : this.cart.push(item);
    this.closeModal();
  }

  inc(c: CartItem) { c.quantity++; }
  dec(c: CartItem) { if (--c.quantity === 0) this.cart = this.cart.filter(x => x !== c); }
  remove(i: number) { this.cart.splice(i, 1); }
  clearCart() { this.cart = []; }
  get total() { return this.cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0); }

  async submit() {
    if (!this.selectedTable || !this.cart.length) return;
    this.busy = true;
    try {
      const gen: any = await this.http.post(
        `${this.API}/order/generate?tableNo=${this.selectedTable}&restaurantId=${this.restaurantId}&source=Customer`,
        {}
      ).toPromise();
      this.orderID = gen.orderID;
      this.orderPlaced.emit({ orderID: this.orderID });

      await this.http.post(
        `${this.API}/order/${this.orderID}/addItem?restaurantId=${this.restaurantId}`,
        this.cart.map(c => ({
          productID: c.productID,
          quantity : c.quantity,
          unitPrice: c.unitPrice,
          customizationOptionIds: c.customizationOptionIds
        }))
      ).toPromise();

      this.orderTotal = this.total;
      this.paymentStage = 1;

    } catch (e) {
      console.error(e);
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

      this.resetAndClose();

    } catch (e) {
      console.error(e);
    } finally {
      this.busyPay = false;
    }
  }

  async initiateUPIPayment() {
    this.busyPay = true;
    try {
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
      
      this.paymentStage = 2;
    } catch (e) {
      console.error('UPI initiation failed:', e);
    } finally {
      this.busyPay = false;
    }
  }

  async initiateCashPayment() {
    this.paymentStage = 3;
  }

  cancelPayment() {
    this.paymentStage = 0;
    this.busy = false;
  }

  private pushSuccessAlert(message: string) {
    alert(message);
  }

  // ✅ UPDATED: Print bill after UPI payment
  async markUPIPaid() {
    if (!this.paymentId) {
      return;
    }

    this.busyPay = true;
    try {
      // Mark UPI payment as completed
      await this.http.put(
        `${this.API}/order/pending-payments/${this.paymentId}/clear?restaurantId=${this.restaurantId}`,
        {}
      ).toPromise();

      // ✅ ADD: Print bill after successful payment
      await this.printOrderBill(this.orderID);

      this.orderPlaced.emit({ 
        orderID: this.orderID,
        paymentStatus: 'paid',
        paymentMethod: 'UPI',
        paymentPreference: 'PayNow'
      });
      
      this.pushSuccessAlert(`✅ Order #${this.orderID} placed and paid via UPI! Bill printed.`);
      
      this.resetAndClose();
    } catch (e) {
      console.error('Failed to mark UPI as paid:', e);
    } finally {
      this.busyPay = false;
    }
  }
  /** Copy the generated UPI URI to clipboard (with fallback). */
  async copyUpiUri(): Promise<void> {
    const text = this.upiUri || '';
    if (!text) {
      this.pushSuccessAlert('No UPI link available to copy.');
      return;
    }

    try {
      // Preferred modern API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        // Avoid scrolling to bottom
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      this.pushSuccessAlert('UPI link copied to clipboard.');
    } catch (err) {
      console.error('Failed to copy UPI link:', err);
      this.pushSuccessAlert('Failed to copy UPI link. Please copy manually.');
    }
  }

  // ✅ UPDATED: Print bill after cash payment
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

      // ✅ ADD: Print bill after successful payment
      await this.printOrderBill(this.orderID);

      this.orderPlaced.emit({ 
        orderID: this.orderID,
        paymentStatus: 'paid',
        paymentMethod: 'Cash',
        paymentPreference: 'PayNow'
      });
      
      this.pushSuccessAlert(`✅ Order #${this.orderID} placed and paid via Cash! Bill printed.`);
      
      this.resetAndClose();
    } catch (e) {
      console.error('Cash payment failed:', e);
    } finally {
      this.busyPay = false;
    }
  }

  private resetAndClose() {
    this.paymentStage = 0;
    this.cart = [];
    this.closed.emit();
  }
}