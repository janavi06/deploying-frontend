import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-pending-payments',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './pending-payments.component.html',
  styleUrls: ['./pending-payments.component.css']
})
export class PendingPaymentsComponent {
  @Input() payments: any[] = [];
  @Output() paymentCleared = new EventEmitter<number>();

  error = '';
  private readonly API_BASE = `${environment.apiUrl}`;
  private httpOptions = { headers: new HttpHeaders() };

  private restaurantId: string = ''; 
  constructor(private http: HttpClient) {
    const token = localStorage.getItem('jwt');
    this.restaurantId = localStorage.getItem('restaurantId') || ''; 
    if (token) {
      this.httpOptions.headers = this.httpOptions.headers.set('Authorization', `Bearer ${token}`);
    }
  }

  markAsPaid(paymentId: number): void {
  
  if (!this.restaurantId) {
    this.error = 'Restaurant ID missing.';
    return;
  }

  if (!paymentId || paymentId <= 0) {
    this.error = 'Invalid payment ID.';
    console.error('Invalid paymentId:', paymentId);
    return;
  }

  this.http.put(
    `${this.API_BASE}/order/pending-payments/${paymentId}/clear?restaurantId=${this.restaurantId}`,
    null,
    this.httpOptions
  ).subscribe({
    next: () => {
      this.payments = this.payments.filter(p => p.paymentId !== paymentId);
      this.paymentCleared.emit(paymentId);
    },
    error: err => {
      console.error('❌Error marking payment:', err);
      this.error = 'Error clearing payment: ' + (err.error?.message || 'Unknown error');
    }
  });
}
}
