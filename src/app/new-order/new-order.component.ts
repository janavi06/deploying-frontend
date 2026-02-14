import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CustomizationModalComponent } from '../customization-modal/customization-modal.component';
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
// 🔽 ADD THESE
paymentMode: 'FULL' | 'PARTIAL' = 'FULL';

partialUpiAmount = 0;
partialCashAmount = 0;
paidSoFar = 0; // future-proof, keep 0 for now

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

paymentStage: 0 | 1 | 2 | 3 | 4 = 0;
  orderID = 0;
  orderTotal = 0;
  method: '' | 'Cash' | 'UPI' = '';

  upiId = '';
  upiName = '';
  upiAmount = 0;
  upiTxnId = '';
  upiUri = '';
  paymentId: number | null = null;
  quantityMap: { [id: number]: number } = {};
  paymentPreference: 'PayNow' | 'PayLater' = 'PayLater';

  private readonly API = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private cd: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    if (!this.restaurantId) {
      alert('Restaurant ID missing');
      return;
    }
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

  ngOnDestroy(): void { }

  toggleSub(sub: SubCategory) { sub.open = !sub.open; }
  goBack() { this.closed.emit(); }

  placeOrderWithPreference() {
    if (this.showPaymentOptions) {
      this.submitWithPreference();
    } else {
      this.submit();
    }
  }
startPartialPayment() {
  this.paymentMode = 'PARTIAL';
  this.partialUpiAmount = 0;
  this.partialCashAmount = 0;
  this.paymentStage = 4;
}
async confirmPartialPayment() {
  const upi = this.partialUpiAmount || 0;
  const cash = this.partialCashAmount || 0;
  const total = upi + cash;

  if (total <= 0 || total > this.orderTotal) {
    alert('Invalid payment amount');
    return;
  }

  this.busyPay = true;

  try {
    // 🔹 UPI PART
    if (upi > 0) {
      const u: any = await this.http.post(
        `${this.API}/order/${this.orderID}/initiate-payment?method=UPI&amount=${upi}&restaurantId=${this.restaurantId}&channel=Waiter`,
        {}
      ).toPromise();

      if (u?.paymentId) {
        await this.http.put(
          `${this.API}/order/pending-payments/${u.paymentId}/clear?restaurantId=${this.restaurantId}`,
          {}
        ).toPromise();
      }
    }

    // 🔹 CASH PART
    if (cash > 0) {
      const c: any = await this.http.post(
        `${this.API}/order/${this.orderID}/initiate-payment?method=Cash&amount=${cash}&restaurantId=${this.restaurantId}&channel=Waiter`,
        {}
      ).toPromise();

      if (c?.paymentId) {
        await this.http.put(
          `${this.API}/order/pending-payments/${c.paymentId}/clear?restaurantId=${this.restaurantId}`,
          {}
        ).toPromise();
      }
    }

    await this.printOrderBill(this.orderID);

    this.orderPlaced.emit({
      orderID: this.orderID,
      paymentStatus: 'paid',
      paymentMethod: 'Partial',
      paymentPreference: 'PayNow'
    });

    alert(`Order #${this.orderID} paid partially (UPI + Cash)`);

    this.resetAndClose();

  } catch (e) {
    console.error('Partial payment failed', e);
    alert('Partial payment failed');
  } finally {
    this.busyPay = false;
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
        customizationOptionIds: c.customizationOptionIds || []
      }))
    };

    // 1. Generate the order
    const gen: any = await this.http.post(
      `${this.API}/order/generate?tableNo=${this.selectedTable}&restaurantId=${this.restaurantId}&source=waiter&paymentPreference=${this.paymentPreference}`,
      orderPayload
    ).toPromise();

    this.orderID = gen.orderID;
    
    // 🔥 FIX: Use the discounted total returned by the server, NOT the preview total
    this.orderTotal = gen.totalAmount; 

    // 2. Confirm for KOT
    await this.http.post(
      `${this.API}/order/${this.orderID}/confirm?restaurantId=${this.restaurantId}`,
      {}
    ).toPromise();

    if (this.paymentPreference === 'PayNow') {
      this.paymentStage = 1; // Open select payment method screen
      this.busy = false;
    } else {
      this.resetAndClose();
    }

  } catch (e: any) {
    console.error('Error placing waiter order:', e);
    this.busy = false;
  }
}
  

  private buildUpiUri(pa: string, pn: string, am: number, tr: string, tn: string = 'ScanUI Order'): string {
    const enc = encodeURIComponent;
    const amt = (am ?? 0).toFixed(2);
    return `upi://pay?pa=${enc(pa)}&pn=${enc(pn)}&am=${enc(amt)}&tr=${enc(tr)}&tn=${enc(tn)}&cu=INR`;
  }
  private async printOrderBill(orderId: number): Promise<void> {
    try {
      console.log(' Requesting backend to print bill for order:', orderId);

      await this.http.post(
        `${this.API}/order/${orderId}/print-bill?restaurantId=${this.restaurantId}`,
        {}
      ).toPromise();

      console.log(' Backend accepted print request');
    } catch (error) {
      console.error(' Backend print failed:', error);
    }
  }

   updateQuantity(item: Product, delta: number) {
    item.quantity = Math.max(0, (item.quantity || 0) + delta);
    this.quantityMap[item.productID] = item.quantity;

const existing = this.cart.find(ci =>
  ci.productID === item.productID &&
  ci.customizationOptionIds.length === 0
);

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
        customizationOptionIds: [],
        customisations: [],

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

    if (this.selectedCategoryID) list = list.filter(p => p.categoryID === this.selectedCategoryID);
    if (this.selectedSubCategoryID) list = list.filter(p => p.subCategoryID === this.selectedSubCategoryID);

    if (this.selectedFilter === 'veg') list = list.filter(p => p.isVeg);
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
          return;
        }

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
          }

          return product;
        });

        this.assignProductsToCategories();
        this.assignProductsToSubCategories();
        this.debugCustomizationOptions();

      }).catch(error => {
        console.error(' Error fetching menu items:', error);
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
    if (this.selectedFilter === 'veg') list = list.filter(p => p.isVeg);
    if (this.selectedFilter === 'nonveg') list = list.filter(p => !p.isVeg);
    const q = this.searchTerm.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase().includes(q)));
    return list;
  }

 
  debugCustomizationOptions() {
    console.log('=== 🔧 Customization Options Detailed Debug ===');

    this.products.forEach((product, index) => {
      const options = product.customizationOptions || [];
      console.log(`[${index + 1}] Product: "${product.productName}"`, {
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
      const customizationOptionID = result.customizationOptionID;
      const customizationPrice = result.price || 0;

     

      const chosen = (options || []).find((o: any) => o.customizationOptionID === customizationOptionID);

      const cartItem: CartItem = {
        productID: p.productID,
        productName: p.productName,
        quantity: 1,
        customizationOptionIds: chosen ? [chosen.customizationOptionID] : [],
        customisations: chosen ? [chosen.name] : [],

      };

      const key = JSON.stringify([cartItem.productID, cartItem.customizationOptionIds.slice().sort()]);
      const existing = this.cart.find(c => JSON.stringify([c.productID, c.customizationOptionIds.slice().sort()]) === key);

      if (existing) {
        existing.quantity += cartItem.quantity;
      } else {
        this.cart.push(cartItem);
      }

      this.cd.detectChanges();

    } catch (err) {
      console.error('Error handling customization dialog result:', err);
    } finally {
      console.groupEnd();
    }
  }

get cartPreviewTotal(): number {
  return this.cart.reduce((sum, c) => {
    const product = this.products.find(p => p.productID === c.productID);
    return sum + ((product?.price ?? 0) * c.quantity);
  }, 0);
}



  private async fetchCustomizationFromServer(p: Product): Promise<CustomisationOption[]> {
    if (!p || !p.productID) return [];
    const url = `${this.API}/product/${p.productID}/customizations?restaurantId=${this.restaurantId}`;
    try {
      const resp: any = await this.http.get<any[]>(url).toPromise();
      if (!resp || !Array.isArray(resp) || resp.length === 0) {
        console.log('No customization options returned from server for', p.productID);
        return [];
      }
      const mapped = resp.map((opt: any, i: number) => ({
        customizationOptionID: opt.customizationOptionID ?? opt.id ?? i,
        name: opt.name ?? opt.optionName ?? `Option ${i + 1}`,
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
    const overlay = document.querySelector('.overlay');

    if (overlay) {


      const modal = overlay.querySelector('.modal');

      if (modal) {
      }
    } else {
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

 

  closeModal() { this.showModal = false; }

  addToCart() {
  if (!this.modalProduct) return;

  const selected = this.modalOptions.filter(o => o.selected);
  const optionPrice = selected.reduce((s, o) => s + (o.fixedPrice || 0), 0);

  const item: CartItem = {
    productID: this.modalProduct.productID,
    productName: this.modalProduct.productName,
    quantity: this.modalQty,
    customizationOptionIds: selected.map(o => o.customizationOptionID),
    customisations: selected.map(o => o.name),
  };

  const key = JSON.stringify([item.productID, item.customizationOptionIds.slice().sort()]);
  const existing = this.cart.find(c =>
    JSON.stringify([c.productID, c.customizationOptionIds.slice().sort()]) === key
  );

  existing ? (existing.quantity += item.quantity) : this.cart.push(item);
  this.closeModal();
}


  inc(c: CartItem) { c.quantity++; }
  dec(c: CartItem) { if (--c.quantity === 0) this.cart = this.cart.filter(x => x !== c); }
  remove(i: number) { this.cart.splice(i, 1); }
  clearCart() { this.cart = []; }

async submit() {
  if (!this.selectedTable || !this.cart.length) return;
  this.busy = true;

  try {
    const orderPayload = {
      OrderItems: this.cart.map(c => ({
        productID: c.productID,
        quantity: c.quantity,
        customizationOptionIds: c.customizationOptionIds || []
      }))
    };

    const gen: any = await this.http.post(
      `${this.API}/order/generate?tableNo=${this.selectedTable}&restaurantId=${this.restaurantId}&source=Customer`,
      orderPayload
    ).toPromise();

    this.orderID = gen.orderID;
    this.orderTotal = gen.totalAmount ?? 0;

    await this.http.post(
      `${this.API}/order/${this.orderID}/confirm?restaurantId=${this.restaurantId}`,
      {}
    ).toPromise();

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
getItemApproxTotal(c: CartItem): number {
  const product = this.products.find(p => p.productID === c.productID);
  return (product?.price ?? 0) * (c.quantity ?? 0);
}

async initiateUPIPayment() {
  this.busyPay = true;

  try {
    const details: any = await this.http.get(
      `${this.API}/order/${this.restaurantId}/payment-details`
    ).toPromise();

    const resp: any = await this.http.post(
      `${this.API}/order/${this.orderID}/initiate-payment?method=UPI&restaurantId=${this.restaurantId}&channel=Waiter`,
      {}
    ).toPromise();

    this.paymentId = resp?.paymentId ?? null;
    this.upiAmount = +resp?.amount || this.orderTotal || 0;

    this.upiId = details?.upiID || '';
    this.upiName = details?.upiName || '';

    this.upiTxnId = `ORDER-${this.orderID}`;

    this.upiUri = this.buildUpiUri(
      this.upiId,
      this.upiName,
      this.upiAmount,
      this.upiTxnId,
      `Order #${this.orderID}`
    );

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

  async markUPIPaid() {
    if (!this.paymentId) {
      return;
    }

    this.busyPay = true;
    try {
      await this.http.put(
        `${this.API}/order/pending-payments/${this.paymentId}/clear?restaurantId=${this.restaurantId}`,
        {}
      ).toPromise();

      await this.printOrderBill(this.orderID);

      this.orderPlaced.emit({
        orderID: this.orderID,
        paymentStatus: 'paid',
        paymentMethod: 'UPI',
        paymentPreference: 'PayNow'
      });

      this.pushSuccessAlert(`Order #${this.orderID} placed and paid via UPI! Bill printed.`);

      this.resetAndClose();
    } catch (e) {
      console.error('Failed to mark UPI as paid:', e);
    } finally {
      this.busyPay = false;
    }
  }
  async copyUpiUri(): Promise<void> {
    const text = this.upiUri || '';
    if (!text) {
      this.pushSuccessAlert('No UPI link available to copy.');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
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

  async markCashPaid() {
    this.busyPay = true;
    try {
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

      await this.printOrderBill(this.orderID);

      this.orderPlaced.emit({
        orderID: this.orderID,
        paymentStatus: 'paid',
        paymentMethod: 'Cash',
        paymentPreference: 'PayNow'
      });

      this.pushSuccessAlert(` Order #${this.orderID} placed and paid via Cash! Bill printed.`);

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