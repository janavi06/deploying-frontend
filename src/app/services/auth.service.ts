// auth.service.ts - ✅ FINAL CORRECTED VERSION
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../environments/environment';
import { Observable, tap, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'scanui_token';
  role: string | null = null;
  restaurantId: number | null = null;
  userEmail: string | null = null;
  
  private restaurantContext = new BehaviorSubject<number | null>(null);
  public restaurantContext$ = this.restaurantContext.asObservable();

  private jwtHelper = new JwtHelperService();
  private base = `${environment.apiUrl}/auth`;

  /**
   * ✅ REPLACED: Robust, Case-Insensitive JWT Claim Getter
   * This function now checks for all common variations.
   */
  private getClaim(decodedToken: any, claimType: string): string | null {
    if (!decodedToken) {
      return null;
    }

    const lowerCaseClaimType = claimType.toLowerCase();
    
    // 1. Find the key in the token, ignoring case
    // (e.g., finds "RestaurantId" or "restaurantId" when looking for "restaurantId")
    const matchingKey = Object.keys(decodedToken)
      .find(key => key.toLowerCase() === lowerCaseClaimType);
    
    if (matchingKey) {
      return decodedToken[matchingKey];
    }

    // 2. If not found, check for .NET long-form claims (e.g., "http://.../role")
    // This also ignores case for the *last part* of the claim name
    const longClaimKey = Object.keys(decodedToken)
      .find(key => {
        const keyParts = key.toLowerCase().split('/');
        const lastPart = keyParts[keyParts.length - 1];
        return lastPart === lowerCaseClaimType;
      });
    
    if (longClaimKey) {
      return decodedToken[longClaimKey];
    }

    return null; // Not found
  }

  constructor(private http: HttpClient, private router: Router) {
    this.loadAuthData();
  }

  setRestaurantContext(restaurantId: number | null): void {
    this.restaurantContext.next(restaurantId);
    if (restaurantId) {
      localStorage.setItem('currentRestaurantContext', restaurantId.toString());
    } else {
      localStorage.removeItem('currentRestaurantContext');
    }
  }
  
  getCurrentRestaurantContext(): number | null {
    const context = localStorage.getItem('currentRestaurantContext');
    return context ? parseInt(context) : this.restaurantId;
  }

  canAccessMultipleRestaurants(): boolean {
    return this.role === 'Admin' || this.role === 'SuperManager';
  }

  /**
   * ✅ FIXED: login() uses the new robust getClaim()
   */
 login(credentials: { email: string; password: string }): Observable<any> {
  const url = `${this.base}/login`;
  
  return this.http.post(url, credentials).pipe(
    tap((response: any) => {
      const token = response.token;
      if (token) {
        localStorage.setItem(this.tokenKey, token);
        const decoded = this.jwtHelper.decodeToken(token);
        
        // Use the new helper to find the role
        let role = this.getClaim(decoded, 'role'); 
        
        // ✅ CRITICAL FIX: Map 'manager' to 'admin' for database compatibility
        // Since database only allows: customer, waiter, kitchen, admin
        if (role?.toLowerCase() === 'manager') {
          role = 'admin';
          console.log('🔄 AuthService: Mapped manager role to admin for database compatibility');
        }
        
        this.role = role;
        
        // Use the new helper for restaurantId and email
        const restaurantIdStr = this.getClaim(decoded, 'restaurantId');
        this.restaurantId = restaurantIdStr ? parseInt(restaurantIdStr) : null;
        this.userEmail = this.getClaim(decoded, 'email') || credentials.email;

        console.log('AuthService: Login success. Role:', this.role, 'RestaurantID:', this.restaurantId);

        this.setRestaurantContext(this.restaurantId);

        // Save the *correct* data to localStorage
        localStorage.setItem('role', this.role || '');
        localStorage.setItem('restaurantId', this.restaurantId?.toString() || '');
        localStorage.setItem('userEmail', this.userEmail || '');
      }
    })
  );
}

// In your auth.service.ts - UPDATE THE belongsToRestaurant METHOD
belongsToRestaurant(restaurantId: number): boolean {
  console.log('🔐 AuthService: Checking restaurant access');
  console.log('   - JWT RestaurantID:', this.restaurantId);
  console.log('   - Route RestaurantID:', restaurantId);
  console.log('   - User Role:', this.role);
  
  // Allow access if:
  // 1. User's restaurantId matches the route restaurantId
  // 2. OR user is Admin/Manager (can access all restaurants)
  const userRoleLower = this.role?.toLowerCase();
  
  if (userRoleLower === 'admin' || userRoleLower === 'manager') {
    console.log('✅ AuthService: Admin/Manager - access granted to all restaurants');
    return true;
  }
  
  const hasAccess = this.restaurantId === restaurantId;
  console.log('✅ AuthService: Restaurant access check:', hasAccess);
  return hasAccess;
}

  /**
   * ✅ FIXED: loadAuthData() also decodes the token
   */
  loadAuthData() {
    const token = this.getToken();
    if (token && !this.jwtHelper.isTokenExpired(token)) {
      const decoded = this.jwtHelper.decodeToken(token);
      this.role = this.getClaim(decoded, 'role');
      const restaurantIdStr = this.getClaim(decoded, 'restaurantId');
      this.restaurantId = restaurantIdStr ? parseInt(restaurantIdStr) : null;
      this.userEmail = this.getClaim(decoded, 'email');
      
      const context = localStorage.getItem('currentRestaurantContext');
      if (context) {
        this.restaurantContext.next(parseInt(context));
      }
      console.log('AuthService: Loaded from token. Role:', this.role, 'RestaurantID:', this.restaurantId);
    } else {
      // Don't logout immediately, just clear local data
      this.clearLocalAuthData();
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Renamed from logout() to avoid redirect loop
  private clearLocalAuthData() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('role');
    localStorage.removeItem('restaurantId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('currentRestaurantContext');
    this.role = null;
    this.restaurantId = null;
    this.userEmail = null;
    this.restaurantContext.next(null);
 }

  // This is the one components should call
  logout() {
    this.clearLocalAuthData();
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }

  /**
   * ✅ FIXED: getUserId() now uses the robust getClaim()
   */
  getUserId(): number | null {
    const token = this.getToken();
    if (token) {
      const decoded = this.jwtHelper.decodeToken(token);
      // 'nameid' or 'sub' are typical .NET claims for User ID
      const userIdStr = this.getClaim(decoded, 'nameid') || this.getClaim(decoded, 'sub'); 
      return userIdStr ? parseInt(userIdStr) : null;
    }
    return null;
  }
}