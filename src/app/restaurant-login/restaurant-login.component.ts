// restaurant-login.component.ts - Fixed
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-restaurant-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Restaurant Staff Login</h2>

        <form (ngSubmit)="login()" #loginForm="ngForm">
          <div class="form-group">
            <label>Email:</label>
            <input 
              type="email" 
              [(ngModel)]="email" 
              name="email" 
              required 
              placeholder="Enter your email"
            >
          </div>
          
          <div class="form-group">
            <label>Password:</label>
            <input 
              type="password" 
              [(ngModel)]="password" 
              name="password" 
              required 
              placeholder="Enter your password"
            >
          </div>

          <button 
            type="submit" 
            [disabled]="!loginForm.valid || isLoading"
            class="login-btn"
          >
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>

          <div *ngIf="error" class="error-message">
            {{ error }}
          </div>
        </form>

        <div class="login-links">
          <a (click)="goToCustomerMenu()">Customer Menu</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .login-card {
      background: white;
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }
    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 5px;
      box-sizing: border-box;
    }
    .login-btn {
      width: 100%;
      padding: 0.75rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
    }
    .login-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }
    .error-message {
      color: #dc3545;
      margin-top: 1rem;
      text-align: center;
    }
    .login-links {
      margin-top: 1rem;
      text-align: center;
    }
    .login-links a {
      color: #007bff;
      cursor: pointer;
      text-decoration: underline;
    }
  `]
})
export class RestaurantLoginComponent {
  email = '';
  password = '';
  error = '';
  isLoading = false;

  constructor(private auth: AuthService, private router: Router) {}

  login(): void {
    this.isLoading = true;
    this.error = '';

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        this.isLoading = false;
        const userRestaurantId = this.auth.restaurantId;
        
        if (!userRestaurantId) {
          this.error = 'No restaurant assigned to this user.';
          return;
        }

        this.navigateToRoleDashboard(userRestaurantId);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'Login failed. Please check your credentials.';
      }
    });
  }

  private navigateToRoleDashboard(restaurantId: number): void {
    const userRole = this.auth.role ? this.auth.role.toLowerCase() : null;

    console.log(' RestaurantLogin: Navigating based on role:', userRole, 'Restaurant ID:', restaurantId);

    let targetRole = userRole;
    
    if (userRole === 'manager') {
      targetRole = 'admin';
    }

    switch (targetRole) {
      case 'waiter':
        this.router.navigate(['/waiter', restaurantId]);
        break;
      case 'admin': 
      case 'manager':
        this.router.navigate(['/manager', restaurantId]);
        break;
      case 'kitchen':
        this.router.navigate(['/kitchen', restaurantId]);
        break;
      default:
        this.router.navigate(['/menu']);
    }
  }

  goToCustomerMenu(): void {
    this.router.navigate(['/menu']);
  }
}