// auth.guard.ts - ENHANCED WITH ROLE MAPPING
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    console.log('🔐 AuthGuard: Checking access for route:', route.routeConfig?.path);
    
    if (!this.auth.isLoggedIn()) {
      console.log('❌ AuthGuard: User not logged in, redirecting to login');
      this.router.navigate(['/login']);
      return false;
    }

    // Get expected roles and convert to lowercase for case-insensitive comparison
    const expectedRoles = (route.data['roles'] as string[] || []).map(role => role.toLowerCase());
    const requiresRestaurantContext = route.data['requiresRestaurantContext'] as boolean;
    const routeRestaurantId = route.params['restaurantId'];

    console.log('🔐 AuthGuard: User role:', this.auth.role, 'Expected roles:', expectedRoles);

    // Check role permissions (case-insensitive) with role mapping
    if (expectedRoles.length > 0) {
      let userRoleLower = this.auth.role?.toLowerCase();
      
      // ✅ FIX: Map 'manager' to 'admin' for access checking
      if (userRoleLower === 'manager') {
        userRoleLower = 'admin';
        console.log('🔄 AuthGuard: Mapped manager role to admin for access check');
      }
      
      const hasRole = expectedRoles.some(role => role === userRoleLower);
      
      if (!hasRole) {
        console.log('❌ AuthGuard: User role not authorized. User role:', this.auth.role, 'Expected:', expectedRoles);
        this.router.navigate(['/unauthorized']);
        return false;
      }
      console.log('✅ AuthGuard: Role check passed');
    }

    // Check restaurant context if required
    if (requiresRestaurantContext) {
      if (routeRestaurantId) {
        const restaurantId = +routeRestaurantId;
        console.log('🔐 AuthGuard: Checking restaurant access for ID:', restaurantId);
        
        if (!this.auth.belongsToRestaurant(restaurantId)) {
          console.log('❌ AuthGuard: User does not belong to restaurant', restaurantId);
          this.router.navigate(['/unauthorized']);
          return false;
        }
        // Set restaurant context for this session
        this.auth.setRestaurantContext(restaurantId);
        console.log('✅ AuthGuard: Restaurant context set to:', restaurantId);
      } else {
        // No restaurant ID in route - use user's default restaurant
        const userRestaurantId = this.auth.restaurantId;
        console.log('🔐 AuthGuard: No restaurant ID in route, using user default:', userRestaurantId);
        
        if (userRestaurantId) {
          // ✅ FIXED: Redirect to the same route but with restaurant ID
          const currentPath = route.routeConfig?.path || '';
          const newPath = `/${currentPath}/${userRestaurantId}`;
          console.log('🔄 AuthGuard: Redirecting to:', newPath);
          this.router.navigate([currentPath, userRestaurantId]);
          return false;
        } else {
          console.log('❌ AuthGuard: No restaurant ID available');
          this.router.navigate(['/unauthorized']);
          return false;
        }
      }
    }

    console.log('✅ AuthGuard: Access granted');
    return true;
  }
}