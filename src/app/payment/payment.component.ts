import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';
@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css'],
  imports: [CommonModule]
})
export class PaymentComponent implements OnInit {
  orderID!: number;
  orderSummary: any;

private readonly API_BASE = environment.apiUrl;


  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // Retrieve the orderID from the route parameters.
    this.orderID = Number(this.route.snapshot.paramMap.get('id'));
    this.fetchOrderSummary();
  }

  fetchOrderSummary(): void {
    this.http.get(`${this.API_BASE}/order/${this.orderID}/summary`).subscribe({
      next: (summary) => {
        this.orderSummary = summary;
      },
      error: (error) => {
        console.error('Error fetching order summary', error);
      }
    });
  }

  orderCompleted(): void {
    // Use the complete endpoint to update the order status to "Completed".
    this.http.put(`${this.API_BASE}/order/${this.orderID}/complete`, {}, { headers: { 'Content-Type': 'application/json' } })
      .subscribe({
        next: (response: any) => {
          alert(response.message || 'Thank you for your payment!');
          // Redirect to a confirmation page or home page.
          this.router.navigate(['/order-confirmation']);
        },
        error: (error) => {
          console.error('Payment confirmation failed', error);
          alert('Payment confirmation failed. Please try again.');
        }
      });
  }
}
