// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../environments/environment';
import { Observable, tap, BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private tokenKey = 'scanui_token';

  role: string | null = null;
  restaurantId: number | null = null;
  userEmail: string | null = null;

  private restaurantContext = new BehaviorSubject<number | null>(null);
  restaurantContext$ = this.restaurantContext.asObservable();

  private jwtHelper = new JwtHelperService();
  private base = `${environment.apiUrl}/auth`;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadAuthData();
  }


  private getClaim(decoded: any, claim: string): string | null {
    if (!decoded) return null;

    const lc = claim.toLowerCase();

    const direct = Object.keys(decoded)
      .find(k => k.toLowerCase() === lc);
    if (direct) return decoded[direct];

    const long = Object.keys(decoded)
      .find(k => k.toLowerCase().split('/').pop() === lc);
    if (long) return decoded[long];

    return null;
  }


  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.base}/login`, credentials).pipe(
      tap((res: any) => {
        const token = res.token;
        if (!token) return;

        localStorage.setItem(this.tokenKey, token);

        const decoded = this.jwtHelper.decodeToken(token);

        let role = this.getClaim(decoded, 'role');


        if (role?.toLowerCase() === 'manager') {
          role = 'admin';
        }

        this.role = role;
        this.restaurantId = Number(this.getClaim(decoded, 'restaurantId'));
        this.userEmail = this.getClaim(decoded, 'email') || credentials.email;

        localStorage.setItem('role', this.role || '');
        localStorage.setItem('restaurantId', this.restaurantId?.toString() || '');
        localStorage.setItem('userEmail', this.userEmail || '');

        this.setRestaurantContext(this.restaurantId);

        console.log(' Login success:', {
          role: this.role,
          restaurantId: this.restaurantId
        });
      })
    );
  }


  loadAuthData(): void {
    const token = this.getToken();

    if (token && !this.jwtHelper.isTokenExpired(token)) {
      const decoded = this.jwtHelper.decodeToken(token);

      let role = this.getClaim(decoded, 'role');
      if (role?.toLowerCase() === 'manager') {
        role = 'admin';
      }

      this.role = role;
      this.restaurantId = Number(this.getClaim(decoded, 'restaurantId'));
      this.userEmail = this.getClaim(decoded, 'email');

      const ctx = localStorage.getItem('currentRestaurantContext');
      if (ctx) this.restaurantContext.next(+ctx);

      console.log('🔁 Session restored:', {
        role: this.role,
        restaurantId: this.restaurantId
      });
    } else {
      console.warn(' Token missing/expired — waiting for user action');
    }
  }


  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }

  getUserId(): number | null {
    const token = this.getToken();
    if (!token) return null;

    const decoded = this.jwtHelper.decodeToken(token);
    const id = this.getClaim(decoded, 'nameid') || this.getClaim(decoded, 'sub');
    return id ? +id : null;
  }

  setRestaurantContext(id: number | null): void {
    this.restaurantContext.next(id);
    if (id) {
      localStorage.setItem('currentRestaurantContext', id.toString());
    } else {
      localStorage.removeItem('currentRestaurantContext');
    }
  }

  belongsToRestaurant(routeRestaurantId: number): boolean {
    const role = this.role?.toLowerCase();
    if (role === 'admin') return true;
    return this.restaurantId === routeRestaurantId;
  }

  logout(): void {
    localStorage.clear();
    this.role = null;
    this.restaurantId = null;
    this.userEmail = null;
    this.restaurantContext.next(null);
    this.router.navigate(['/login']);
  }
}
