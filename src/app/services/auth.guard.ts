// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const expectedRoles =
      (route.data['roles'] as string[] || []).map(r => r.toLowerCase());

    let userRole = this.auth.role?.toLowerCase();

    if (userRole === 'manager') {
      userRole = 'admin';
    }

    if (expectedRoles.length && !expectedRoles.includes(userRole || '')) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    const restaurantId = route.params['restaurantId'];

    if (restaurantId && !this.auth.belongsToRestaurant(+restaurantId)) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    if (restaurantId) {
      this.auth.setRestaurantContext(+restaurantId);
    }

    return true;
  }
}
