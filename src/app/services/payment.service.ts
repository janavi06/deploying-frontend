// src/app/services/payment.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

export interface PendingPaymentDto {
  paymentID: number;
  orderID: number;
  tableID: number;
  paymentMethod: string;
  amount: number;
  upiId?: string;       // Added for UPI payments
  upiName?: string;     // Added for UPI payments
  transactionId?: string; // Added for UPI payments
}

export interface PaymentVerificationResponse {
  paid: boolean;
}


interface UPIPaymentResponse {
  upiId: string;
  upiName: string;
  amount: number;
  orderId: number;
  transactionId: string;
  deepLinks: any; // Add this line
}
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private base = `${environment.apiUrl}/order`;
  private paymentStatusSub: Subscription | null = null;

  constructor(private http: HttpClient) {}



  // Add this new method to your PaymentService
initiatePayment(orderId: number, method: 'Cash' | 'UPI') {
  if (method === 'UPI') {
    return this.initiateUPIPayment(orderId);
  } else {
    return this.generateBill(orderId, method);
  }
}

initiateUPIPayment(orderId: number) {
  return this.http.post<UPIPaymentResponse>(
    `${this.base}/${orderId}/initiate-payment?method=UPI`,
    {}
  );
}

generateBill(orderId: number, method: 'Cash' | 'UPI') {
  return this.http.post(
    `${this.base}/${orderId}/generate-bill`,
    { method },
    { headers: { 'Content-Type': 'application/json' } }
  );
}


  /** 3) Generate UPI Links (New) */
  generateUPILinks(upiId: string, upiName: string, amount: number, transactionId: string, orderId: number) {
    const amountStr = amount.toFixed(2);
    const note = `Payment for Order ${orderId}`;
    
    // URL encode all parameters
    const encodedUpiId = encodeURIComponent(upiId);
    const encodedName = encodeURIComponent(upiName);
    const encodedNote = encodeURIComponent(note);
    
    // Return multiple link formats
    return {
      universal: `https://upilink.vercel.app/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}&tr=${transactionId}&cu=INR`,
      direct: `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}&tr=${transactionId}`,
      phonePe: `phonepe://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}&tr=${transactionId}`,
      gPay: `tez://upi/pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amountStr}&tn=${encodedNote}&tr=${transactionId}`
    };
  }

  /** 4) Waiter → List all pending payments */
  getAllPending() {
    return this.http.get<PendingPaymentDto[]>(`${this.base}/pending-payments`);
  }

  /** 5) Waiter → Mark a specific pending payment as completed */
  complete(orderId: number, paymentId: number) {
    return this.http.put(
      `${this.base}/${orderId}/payments/${paymentId}/complete`,
      {}
    );
  }

  /** 6) Customer → Poll to see if the UPI payment actually went through */
  verify(orderId: number) {
    // add timestamp to bust cache
    return this.http.get<PaymentVerificationResponse>(
      `${this.base}/${orderId}/verify-payment?ts=${Date.now()}`
    );
  }

  /** 7) Start payment status polling (New) */
  startPaymentPolling(orderId: number, callback: (paid: boolean) => void) {
    this.stopPaymentPolling();
    
    this.paymentStatusSub = interval(5000).pipe(
      switchMap(() => this.verify(orderId)),
      takeWhile(response => !response.paid, true)
    ).subscribe({
      next: (response) => callback(response.paid),
      error: (err) => {
        console.error('Payment poll error:', err);
        callback(false);
      }
    });
  }

  /** 8) Stop payment polling (New) */
  stopPaymentPolling() {
    if (this.paymentStatusSub) {
      this.paymentStatusSub.unsubscribe();
      this.paymentStatusSub = null;
    }
  }
}