import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'scanui_token';
  role: string | null = null;
  restaurantId: string | null = null;

  private jwtHelper = new JwtHelperService();
  private base = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient, private router: Router) {
    this.loadAuthData();
  }

  /** 🔹 Login API call */
  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.base}/login`, credentials).pipe(
      tap((response: any) => {
        const token = response.token;
        if (token) {
          localStorage.setItem(this.tokenKey, token);

          // Decode JWT to extract user info
          const decoded = this.jwtHelper.decodeToken(token);
          this.role = decoded?.role || null;
          this.restaurantId = decoded?.restaurantId || null;

          // Save locally for persistence
          if (this.role) localStorage.setItem('role', this.role);
          if (this.restaurantId) localStorage.setItem('restaurantId', this.restaurantId);
        }
      })
    );
  }

  /** 🔹 Load stored data on refresh */
  loadAuthData() {
    this.role = localStorage.getItem('role');
    this.restaurantId = localStorage.getItem('restaurantId');
  }

  /** 🔹 Get JWT token */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /** 🔹 Logout user */
  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('role');
    localStorage.removeItem('restaurantId');
    this.role = null;
    this.restaurantId = null;
    this.router.navigate(['/login']);
  }

  /** 🔹 Check if token exists and is valid */
  isLoggedIn(): boolean {
    const token = this.getToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }
}
