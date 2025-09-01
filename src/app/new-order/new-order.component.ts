/*  NEW-ORDER COMPONENT  • embed-friendly version */
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule   } from '@angular/forms';
import { HttpClient    } from '@angular/common/http';
import { QRCodeComponent } from 'angularx-qrcode';

import { environment } from '../../environments/environment';

export interface CustomisationOption {
  customizationOptionID: number;
  name: string;
  priceDelta: number;
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
  CustomizationOptions?: CustomisationOption[];
  quantity?: number;
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
  selector   : 'app-new-order',
  standalone : true,
  imports    : [CommonModule, FormsModule, QRCodeComponent],
  templateUrl: './new-order.component.html',
  styleUrls  : ['./new-order.component.css']
})
export class NewOrderComponent implements OnInit, OnDestroy {
  /* 🔹 NEW: parent-provided restaurantId */
  @Input() restaurantId!: number;

  /* 🔹 NEW: events back to Waiter */
  @Output() closed = new EventEmitter<void>();
  @Output() orderPlaced = new EventEmitter<{ orderID: number }>();

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
  showCategorySelector  = true;
cartOpen = false; // start collapsed

  cart: CartItem[] = [];
  busy  = false;
  busyPay = false;
  Math = Math;

  /* modal (add-to-cart) */
  showModal      = false;
  modalProduct   : Product | null = null;
  modalOptions   : CustomisationOption[] = [];
  modalQty       = 1;
  modalLineTotal = 0;

  /* payment modal */
paymentStage: 0|1|2|3 = 0;  
  orderID     = 0;
  orderTotal  = 0;
  method      : '' | 'Cash' | 'UPI' = '';


  // UPI state
upiId = '';
upiName = '';
upiAmount = 0;
upiTxnId = '';
upiUri = '';
paymentId: number | null = null;


  /* helpers */
  quantityMap: { [id: number]: number } = {};

  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) {}

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
  }

  ngOnDestroy(): void {}

  /* ===== helper for accordion ===== */
  toggleSub(sub: SubCategory) { sub.open = !sub.open; }

  /* ===== back button ===== */
  goBack() { this.closed.emit(); }


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

/** After customer scans & pays UPI, tap this to close the loop */
async markPaidAndDownload() {
  if (!this.paymentId) { alert('Payment not created'); return; }
  this.busyPay = true;

  try {
    // Mark payment complete
await this.http.put(
  `${this.API}/order/pending-payments/${this.paymentId}/clear?restaurantId=${this.restaurantId}`, {}
).toPromise();

    // Download bill
    window.open(`${this.API}/order/${this.orderID}/bill`, '_blank');

    // Done
    this.resetAndClose();
  } catch (e) {
    console.error(e);
    alert('Could not complete payment');
  } finally {
    this.busyPay = false;
  }
}

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

  if (this.selectedCategoryID)   list = list.filter(p => p.categoryID === this.selectedCategoryID);
  if (this.selectedSubCategoryID) list = list.filter(p => p.subCategoryID === this.selectedSubCategoryID);

  // veg / non-veg
  if (this.selectedFilter === 'veg')    list = list.filter(p => p.isVeg);
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
    return this.http.get<Product[]>(`${this.API}/product?restaurantId=${this.restaurantId}`)
      .toPromise().then(p => {
        if (!p) return;
        this.products = p.map(m => ({
          ...m,
          basePrice: m.price,
          quantity: 0,
          CustomizationOptions: (m.CustomizationOptions || []).map(opt => ({
            customizationOptionID: opt.customizationOptionID,
            name: opt.name,
            priceDelta: opt.priceDelta || 0,
            selected: false
          }))
        }));
        this.assignProductsToCategories();
        this.assignProductsToSubCategories();
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
    if (this.selectedFilter === 'veg')    list = list.filter(p => p.isVeg);
    if (this.selectedFilter === 'nonveg') list = list.filter(p => !p.isVeg);
    const q = this.searchTerm.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase().includes(q)));
    return list;
  }

  /* ─ customisation modal ─ */
  openCustomisation(p: Product) {
    const customizations = p.CustomizationOptions || [];
    if (!customizations.length) { this.updateQuantity(p, 1); return; }
    this.modalProduct = p;
    this.modalQty = 1;
    this.modalOptions = customizations.map(o => ({
      customizationOptionID: o.customizationOptionID,
      name: o.name,
      priceDelta: o.priceDelta,
      selected: false
    }));
    this.recalcModalPrice();
    this.showModal = true;
  }
  recalcModalPrice() {
    const addOn = this.modalOptions.filter(o => o.selected).reduce((s, o) => s + o.priceDelta, 0);
    this.modalLineTotal = (this.modalProduct?.price || 0) + addOn;
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
        `${this.API}/order/generate?tableNo=${this.selectedTable}&restaurantId=${this.restaurantId}&source=waiter`,
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

      /* 3) show Pay NOW / LATER */
      this.orderTotal   = this.total;
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

  private resetAndClose() {
    this.paymentStage = 0;
    this.cart = [];
    this.closed.emit();       // 🔹 tell Waiter to close this tab
  }
}
