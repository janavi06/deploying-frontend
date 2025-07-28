import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
@Injectable({ providedIn: 'root' })
export class AuthService {
 private base = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'jwt';

  constructor(private http: HttpClient) {}

  register(user: any) {
    return this.http.post(`${this.base}/register`, user);
  }

  login(creds: { email: string; password: string }) {
    return this.http.post<{ token: string }>(`${this.base}/login`, creds)
      .pipe(tap(res => localStorage.setItem(this.TOKEN_KEY, res.token)));
  }

  get token() { return localStorage.getItem(this.TOKEN_KEY); }
  get isLoggedIn() { return !!this.token; }
  logout() { localStorage.removeItem(this.TOKEN_KEY); }
}
