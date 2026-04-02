import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offers.component.html',
  styleUrls: ['./offers.component.css']
})
export class OffersComponent implements OnInit {

  @Input() restaurantId!: number;

  readonly OFFER_API = `${environment.apiUrl}/offer`;
  readonly PRODUCT_API = `${environment.apiUrl}/product`;

  offers: any[] = [];
  products: any[] = [];
  showModal = false;

  newOffer = {
    name: '',
    description: '',
    scope: 'GLOBAL',
    discountType: 'PERCENT',
    discountPercent: null as number | null,
    discountAmount: null as number | null,
    minBillAmount: 0,
    productIds: [] as number[],
    priority: 0,
    autoApply: false,
    validFrom: '',
    validTo: ''
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (!this.restaurantId) return;
    this.loadOffers();
    this.loadProducts();
  }

  loadOffers(): void {
    this.http
      .get<any[]>(`${this.OFFER_API}/restaurant/${this.restaurantId}`)
      .subscribe(res => this.offers = res);
  }

  loadProducts(): void {
    this.http
      .get<any[]>(`${this.PRODUCT_API}?restaurantId=${this.restaurantId}`)
      .subscribe(res => this.products = res);
  }

isFormValid(): boolean {

  if (!this.newOffer.name?.trim()) return false;
  if (!this.newOffer.validFrom || !this.newOffer.validTo) return false;

  const from = new Date(this.newOffer.validFrom);
  const to = new Date(this.newOffer.validTo);

  if (from >= to) return false;

  if (this.newOffer.discountType === 'PERCENT') {
    if (!this.newOffer.discountPercent || this.newOffer.discountPercent <= 0 || this.newOffer.discountPercent > 100)
      return false;
  }

  if (this.newOffer.discountType === 'AMOUNT') {
    if (!this.newOffer.discountAmount || this.newOffer.discountAmount <= 0)
      return false;
  }

  if (this.newOffer.scope === 'MIN_BILL' && this.newOffer.minBillAmount <= 0)
    return false;

  if (this.newOffer.scope === 'PRODUCT_BASED' && !this.newOffer.productIds.length)
    return false;

  return true;
}


  createOffer(): void {

    if (!this.isFormValid()) return;

    const payload: any = {
      name: this.newOffer.name,
      description: this.newOffer.description,
      scope: this.newOffer.scope,
      discountType: this.newOffer.discountType,
      minBillAmount:
        this.newOffer.scope === 'MIN_BILL'
          ? Number(this.newOffer.minBillAmount)
          : 0,
      priority: Number(this.newOffer.priority),
      autoApply: this.newOffer.autoApply,
      validFrom: new Date(this.newOffer.validFrom).toISOString(),
      validTo: new Date(this.newOffer.validTo).toISOString()
    };

    if (this.newOffer.discountType === 'PERCENT') {
      payload.discountPercent = Number(this.newOffer.discountPercent);
    }

    if (this.newOffer.discountType === 'AMOUNT') {
      payload.discountAmount = Number(this.newOffer.discountAmount);
    }

    const productQuery =
      this.newOffer.scope === 'PRODUCT_BASED' &&
      this.newOffer.productIds.length
        ? `&productIds=${this.newOffer.productIds.join('&productIds=')}`
        : '';

    this.http.post(
      `${this.OFFER_API}?restaurantId=${this.restaurantId}${productQuery}`,
      payload
    )
    .subscribe({
      next: () => {
        this.loadOffers();
        this.closeModal();
      },
      error: err => {
        console.error("SERVER ERROR:", err.error);
      }
    });
  }

  deleteOffer(id: number): void {
    if (!confirm('Delete this offer?')) return;

    this.http
      .delete(`${this.OFFER_API}/${id}?restaurantId=${this.restaurantId}`)
      .subscribe(() => this.loadOffers());
  }

  openModal(): void {
    this.resetForm();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  toggleProductSelection(productId: number): void {
    const i = this.newOffer.productIds.indexOf(productId);
    i >= 0
      ? this.newOffer.productIds.splice(i, 1)
      : this.newOffer.productIds.push(productId);
  }

  resetForm(): void {
    this.newOffer = {
      name: '',
      description: '',
      scope: 'GLOBAL',
      discountType: 'PERCENT',
      discountPercent: null,
      discountAmount: null,
      minBillAmount: 0,
      productIds: [],
      priority: 0,
      autoApply: true,
      validFrom: '',
      validTo: ''
    };
  }

  getScopeLabel(scope: string): string {
    switch (scope) {
      case 'GLOBAL': return 'Global';
      case 'MIN_BILL': return 'Min Bill';
      case 'PRODUCT_BASED': return 'Product Based';
      default: return '';
    }
  }
}
