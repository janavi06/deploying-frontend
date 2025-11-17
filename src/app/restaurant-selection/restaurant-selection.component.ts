// restaurant-selection.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-restaurant-selection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="selection-container">
      <div class="selection-card">
        <h2>Select Restaurant</h2>
        <p class="subtitle">Choose which restaurant you want to access</p>
        
        <div class="user-info" *ngIf="userEmail">
          <p>Logged in as: <strong>{{userEmail}}</strong></p>
          <p>Your restaurant: <strong>Restaurant {{userRestaurantId}}</strong></p>
        </div>

        <div class="restaurant-options">
          <div class="restaurant-option" [class.disabled]="!canAccessRestaurant(1)">
            <div class="restaurant-info">
              <h3>Restaurant 1</h3>
              <p>Main Location</p>
            </div>
            <button 
              class="btn btn-primary" 
              (click)="selectRestaurant(1)"
              [disabled]="!canAccessRestaurant(1)">
              {{ canAccessRestaurant(1) ? 'Select' : 'Not Authorized' }}
            </button>
          </div>

          <div class="restaurant-option" [class.disabled]="!canAccessRestaurant(2)">
            <div class="restaurant-info">
              <h3>Restaurant 2</h3>
              <p>Second Location</p>
            </div>
            <button 
              class="btn btn-primary" 
              (click)="selectRestaurant(2)"
              [disabled]="!canAccessRestaurant(2)">
              {{ canAccessRestaurant(2) ? 'Select' : 'Not Authorized' }}
            </button>
          </div>

          <!-- Add more restaurants as needed -->
        </div>

        <div class="action-buttons">
          <button class="btn btn-secondary" (click)="logout()">
            Logout
          </button>
          <button class="btn btn-outline" (click)="goBack()">
            Back
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .selection-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .selection-card {
      background: white;
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 500px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 2rem;
    }
    .user-info {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    .restaurant-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .restaurant-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      transition: all 0.3s ease;
    }
    .restaurant-option:not(.disabled):hover {
      border-color: #667eea;
      transform: translateY(-2px);
    }
    .restaurant-option.disabled {
      opacity: 0.6;
      background: #f8f9fa;
    }
    .restaurant-info {
      flex: 1;
    }
    .restaurant-info h3 {
      margin: 0 0 0.25rem 0;
    }
    .restaurant-info p {
      margin: 0;
      color: #666;
    }
    .action-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    .btn-outline {
      background: transparent;
      border: 1px solid #007bff;
      color: #007bff;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class RestaurantSelectionComponent {
  userEmail: string | null = null;
  userRestaurantId: number | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.userEmail = this.auth.userEmail;
    this.userRestaurantId = this.auth.restaurantId;
  }

  canAccessRestaurant(restaurantId: number): boolean {
    // Users can only access their own restaurant
    return this.auth.belongsToRestaurant(restaurantId);
  }

  selectRestaurant(restaurantId: number): void {
    if (!this.canAccessRestaurant(restaurantId)) {
      alert('You are not authorized to access this restaurant.');
      return;
    }

    // Set restaurant context - FIXED: This method now exists in AuthService
    this.auth.setRestaurantContext(restaurantId);

    // Navigate based on role with restaurant context
    const role = this.auth.role;
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];

    if (returnUrl) {
      this.router.navigate([returnUrl], { 
        queryParams: { restaurantId } 
      });
    } else {
      switch (role) {
        case 'Waiter':
          this.router.navigate(['/waiter'], { 
            queryParams: { restaurantId } 
          });
          break;
        case 'Manager':
          this.router.navigate(['/manager'], { 
            queryParams: { restaurantId } 
          });
          break;
        case 'Kitchen':
          this.router.navigate(['/kitchen'], { 
            queryParams: { restaurantId } 
          });
          break;
        default:
          this.router.navigate(['/menu']);
      }
    }
  }

  logout(): void {
    this.auth.logout();
  }

  goBack(): void {
    this.router.navigate(['/restaurant-login']);
  }
}