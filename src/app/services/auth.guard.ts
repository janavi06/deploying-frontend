import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    // MODIFICATION:
    // The original logic that checked for login is removed.
    // By always returning 'true', this guard will now allow
    // anyone to access the route it protects.
    return true;
  }
}