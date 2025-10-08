import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'scanui_token';

  role: string | null = null;
  restaurantId: string | null = null;

  constructor(private router: Router) {
    this.loadAuthData();
  }

  // Save token + data to localStorage
  setAuthData(token: string, role: string, restaurantId: string) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem('role', role);
    localStorage.setItem('restaurantId', restaurantId);
    this.role = role;
    this.restaurantId = restaurantId;
  }

  // Load from localStorage on app start
  loadAuthData() {
    this.role = localStorage.getItem('role');
    this.restaurantId = localStorage.getItem('restaurantId');
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('role');
    localStorage.removeItem('restaurantId');
    this.role = null;
    this.restaurantId = null;
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
