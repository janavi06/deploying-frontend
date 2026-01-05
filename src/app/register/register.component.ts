import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, HttpClientModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  userRole: 'Waiter' = 'Waiter';

  userName    = '';
  email       = '';
  password    = '';
  phoneNumber = '';

  private readonly base = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient, private router: Router) {}

  register(): void {
    const restaurantId = localStorage.getItem('restaurantId'); 

    if (!restaurantId) {
      alert('Restaurant ID not found. Please log in again.');
      return;
    }

    this.http
      .post<{ userID: number }>(
        `${this.base}/register`,
        {
          userRole:    this.userRole,
          userName:    this.userName,
          email:       this.email,
          passwordHash:this.password,
          phoneNumber: this.phoneNumber || undefined,
          restaurantId: restaurantId          
        }
      )
      .subscribe({
        next: () => this.router.navigate(['/login']),
        error: err => {
          console.error('Register error payload:', err.error);
        }
      });
  }
}
