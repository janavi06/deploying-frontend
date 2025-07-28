import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  private base = `${environment.apiUrl}/auth`;

  private jwtHelper = new JwtHelperService();  // ← initialize

  constructor(private http: HttpClient, private router: Router) {}

  login() {
    this.http
      .post<{ token: string }>(
        `${this.base}/login`,
        { email: this.email, password: this.password }
      )
      .subscribe({
        next: ({ token }) => {
          localStorage.setItem('jwt', token);

          const decoded = this.jwtHelper.decodeToken(token);
          const role = decoded['role'];
          const restaurantId = decoded['restaurantId']; // ✅ Extract restaurantId from token

          // ✅ Store restaurantId in localStorage
          if (restaurantId) {
            localStorage.setItem('restaurantId', restaurantId);
          }

          console.log('Logged in user role:', role);
          console.log('Restaurant ID:', restaurantId);

          // Redirect based on role
          if (role === 'Waiter') {
            this.router.navigate(['/waiter']);
          } else if (role === 'Customer') {
            this.router.navigate(['/menu']);
          } else if (role === 'Kitchen') {
            this.router.navigate(['/kitchen']);
          } else {
            this.router.navigate(['/menu']); // fallback
          }
        },
        error: err => {
          console.error('Login error payload:', err.error);
        }
      });
  }
}
