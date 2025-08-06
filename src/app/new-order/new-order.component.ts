/*  ───────────────────────────────────────────────────────────────
    NEW‑ORDER COMPONENT  •  waiter places orders from a tablet/PC
    ─────────────────────────────────────────────────────────────── */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule   } from '@angular/forms';
import { HttpClient    } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';

import { environment } from '../../environments/environment';

/* ────────── models ────────── */

export interface CustomisationOption {
  customizationOptionID: number;
  name: string;
  priceDelta: number;
  selected?: boolean;          // UI helper
}

export interface Product {
  productID: number;
  productName: string;
  basePrice: number;           // immutable
  price: number;               // mutable display price
  productDescription?: string;
  imagePath?: string;

  categoryID: number;
  subCategoryID?: number;
  isVeg: boolean;
  isAvailable?: boolean;

CustomizationOptions?: CustomisationOption[];

  /* UI helpers */
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
    open?: boolean;              // accordion state (UI-only)

}

/* ────────── component ────────── */

@Component({
  selector   : 'app-new-order',
  standalone : true,
  imports    : [CommonModule, FormsModule, RouterModule],
  templateUrl: './new-order.component.html',
  styleUrls  : ['./new-order.component.css']
})
export class NewOrderComponent implements OnInit, OnDestroy {

  /* ─── external data ─── */
  tables: any[] = [];
  products: Product[] = [];
  categories: Category[] = [];
  subCategories: SubCategory[] = [];

  /* ─── UI state ─── */
  searchTerm            = '';
  selectedFilter: 'veg' | 'nonveg' | null = null;

  selectedTable: number | '' = '';
  selectedCategoryID: number | null = null;
  showCategorySelector  = true;

  cart: CartItem[] = [];
  busy  = false;               // order POSTing
  busyPay = false;             // payment POSTing
  Math = Math;                 // template helper

  /* ─── modal (add‑to‑cart) ─── */
  showModal      = false;
  modalProduct   : Product | null = null;
  modalOptions   : CustomisationOption[] = [];
  modalQty       = 1;
  modalLineTotal = 0;

  /* ─── payment modal ─── */
  paymentStage: 0|1|2 = 0;     // 0 hidden • 1 choose timing • 2 collect money
  orderID     = 0;
  orderTotal  = 0;
  method      : '' | 'Cash' | 'UPI' = '';

  /* ─── helpers ─── */
  quantityMap: { [id: number]: number } = {};   // track qty per product

  private readonly API    = environment.apiUrl;
  private readonly restId = +(localStorage.getItem('restaurantId') || 0);

  constructor(private http: HttpClient,
              private router: Router) {}

/* ════════════════════════════════════════════════════════════════
   LIFECYCLE
   ════════════════════════════════════════════════════════════════ */

  async ngOnInit(): Promise<void> {
    if (!this.restId) { alert('Restaurant ID missing'); return; }

    /* tables */
    this.http.get<any[]>(`${this.API}/restauranttables?restaurantId=${this.restId}`)
             .subscribe(t => this.tables = t);

    /* categories + subs + menu */
    await Promise.all([
      this.fetchCategories(),
      this.fetchSubCategories(),
      this.fetchMenuItems()
    ]);
  }

  ngOnDestroy(): void {
    /* nothing to clear yet */
  }
/* ===== helper for accordion ===== */
toggleSub(sub: SubCategory) {
  sub.open = !sub.open;
}

/* ===== back button ===== */
goBack() {
  this.router.navigate(['/waiter']);
}
updateQuantity(item: Product, delta: number) {
  item.quantity = Math.max(0, (item.quantity || 0) + delta);
  this.quantityMap[item.productID] = item.quantity;

  /* build / update CartItem */
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
      unitPrice: item.price,         // base price
      customizationOptionIds: [],
      customisations: []
    });
  }
}



/* ════════════════════════════════════════════════════════════════
   DATA LOADERS
   ════════════════════════════════════════════════════════════════ */

  private fetchCategories() {
    return this.http.get<Category[]>(
      `${this.API}/categories?restaurantId=${this.restId}`)
      .toPromise()
      .then(c => this.categories = c ?? []);
  }

  private fetchSubCategories() {
    return this.http.get<SubCategory[]>(
      `${this.API}/subcategories?restaurantId=${this.restId}`)
      .toPromise()
      .then(sc => this.subCategories = sc ?? []);
  }

private fetchMenuItems() {
  return this.http.get<Product[]>(`${this.API}/product?restaurantId=${this.restId}`)
    .toPromise()
 .then(p => {
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



/* ════════════════════════════════════════════════════════════════
   CATEGORY / SUB‑CATEGORY MAPPING
   ════════════════════════════════════════════════════════════════ */

  private assignProductsToCategories() {
    if (!this.products.length || !this.categories.length) return;
    const map = new Map<number, Category>();
    this.categories.forEach(c => map.set(c.categoryID, { ...c, products: [], subCategories: c.subCategories || [] }));
    this.products.forEach(p => {
      if (p.subCategoryID) return; // will be handled by sub‑cat map
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

/* ════════════════════════════════════════════════════════════════
   FILTERING & SEARCH
   ════════════════════════════════════════════════════════════════ */

  toggleFilter(kind: 'veg' | 'nonveg') {
    this.selectedFilter = this.selectedFilter === kind ? null : kind;
  }

  filteredProducts(catId?: number, subId?: number) {
    let list = this.products;

    /* category scope */
    if (catId) list = list.filter(p => p.categoryID === catId);
    if (subId) list = list.filter(p => p.subCategoryID === subId);

    /* veg / non‑veg */
    if (this.selectedFilter === 'veg')     list = list.filter(p => p.isVeg);
    if (this.selectedFilter === 'nonveg')  list = list.filter(p => !p.isVeg);

    /* search */
    const q = this.searchTerm.trim().toLowerCase();
    if (q) list = list.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      (p.productDescription?.toLowerCase().includes(q)));

    return list;
  }

/* ════════════════════════════════════════════════════════════════
   CUSTOMISATION MODAL  (copied from MenuComponent)
   ════════════════════════════════════════════════════════════════ */

openCustomisation(p: Product) {
  // Check for customization options in both possible property names
  const customizations = p.CustomizationOptions || [];
  
  if (!customizations.length) {
    console.log('No customizations, adding directly to cart');
    this.updateQuantity(p, 1);
    return;
  }

  console.log('Customizations found:', customizations);
  
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
    const addOn = this.modalOptions
      .filter(o => o.selected)
      .reduce((sum, o) => sum + o.priceDelta, 0);
    this.modalLineTotal = (this.modalProduct?.price || 0) + addOn;
  }

  closeModal() { this.showModal = false; }

  addToCart() {
    if (!this.modalProduct) return;

    const selected   = this.modalOptions.filter(o => o.selected);
    const optionIds  = selected.map(o => o.customizationOptionID);
    const optionName = selected.map(o => o.name);

    const item: CartItem = {
      productID:   this.modalProduct.productID,
      productName: this.modalProduct.productName,
      quantity:    this.modalQty,
      unitPrice:   this.modalLineTotal,
      customizationOptionIds: optionIds,
      customisations: optionName
    };

    /* merge if identical */
    const key = JSON.stringify([item.productID, optionIds.sort()]);
    const existing = this.cart.find(c =>
      JSON.stringify([c.productID, [...c.customizationOptionIds].sort()]) === key);

    existing ? existing.quantity += item.quantity
             : this.cart.push(item);

    this.closeModal();
  }

/* ════════════════════════════════════════════════════════════════
   CART HELPERS
   ════════════════════════════════════════════════════════════════ */

  inc(c: CartItem) { c.quantity++; }
  dec(c: CartItem) { if (--c.quantity === 0) this.cart = this.cart.filter(x => x !== c); }
  remove(i: number) { this.cart.splice(i, 1); }
  clearCart() { this.cart = []; }
  get total() { return this.cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0); }

/* ════════════════════════════════════════════════════════════════
   PLACE ORDER  →  PAYMENT
   ════════════════════════════════════════════════════════════════ */
async submit() {
  if (!this.selectedTable || !this.cart.length) return;
  this.busy = true;

  try {
    /* 1️⃣ generate the empty order — tell the API this came from the waiter */
    const gen: any = await this.http.post(
      `${this.API}/order/generate`
      + `?tableNo=${this.selectedTable}`
      + `&restaurantId=${this.restId}`
      + `&source=waiter`,          // ← NEW query-param
      {}
    ).toPromise();

    this.orderID = gen.orderID;

    /* 2️⃣ add the items */
    await this.http.post(
      `${this.API}/order/${this.orderID}/addItem?restaurantId=${this.restId}`,
      this.cart.map(c => ({
        productID: c.productID,
        quantity : c.quantity,
        unitPrice: c.unitPrice,
        customizationOptionIds: c.customizationOptionIds
      }))
    ).toPromise();

    /* 3️⃣ show Pay NOW / Pay LATER dialog */
    this.orderTotal   = this.total;
    this.paymentStage = 1;

  } catch (e) {
    console.error(e);
    alert('Failed to place order');
  } finally {
    this.busy = false;
  }
}


  /* --- LATER --- */
  payLater() {
    this.http.post(`${this.API}/order/${this.orderID}/pending?restaurantId=${this.restId}`,
                   { method: 'Deferred' })
      .subscribe(() => this.resetAndReturn());
  }

  /* --- NOW --- */
  async collectPayment() {
    if (!this.method) return;
    this.busyPay = true;

    try {
      if (this.method === 'UPI') {
        /* create transaction */
        await this.http.post(
          `${this.API}/order/${this.orderID}/initiate-payment?method=UPI&restaurantId=${this.restId}`, {}
        ).toPromise();
      }

      /* mark paid */
      await this.http.put(
        `${this.API}/order/pending-payments/${this.orderID}/clear?restaurantId=${this.restId}`, {}
      ).toPromise();

      /* show bill */
      window.open(`${this.API}/order/${this.orderID}/bill`, '_blank');

      this.resetAndReturn();

    } catch (e) {
      console.error(e);
      alert('Payment error');
    } finally {
      this.busyPay = false;
    }
  }

  /* --- helper --- */
  private resetAndReturn() {
    this.paymentStage = 0;
    this.cart = [];
    this.router.navigate(['/waiter'], { queryParams: { refresh: 1 }});
  }
}
