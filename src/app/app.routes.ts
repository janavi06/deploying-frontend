// app.routes.ts - UPDATED VERSION
import { Routes } from '@angular/router';

import { MenuComponent } from './menu/menu.component';
import { WaiterComponent } from './waiter/waiter.component';
import { KitchenComponent } from './kitchen/kitchen.component';
import { ManagerComponent } from './manager/manager.component';
import { PaymentComponent } from './payment/payment.component';
import { PendingPaymentsComponent } from './pending-payments/pending-payments.component';
import { RegisterComponent } from './register/register.component';
import { AuthGuard } from './services/auth.guard';
import { NewOrderComponent } from './new-order/new-order.component';
import { LoginComponent } from './login/login.component';
import { InventoryManagementComponent } from './inventory-management/inventory-management.component';
import { RestaurantLoginComponent } from './restaurant-login/restaurant-login.component';
import { RestaurantSelectionComponent } from './restaurant-selection/restaurant-selection.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';

export const routes: Routes = [
  // Public routes
  { path: '', redirectTo: '/menu', pathMatch: 'full' },
  { path: 'menu', component: MenuComponent },
  
  // Authentication routes
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'restaurant-login', component: RestaurantLoginComponent },
  { path: 'restaurant-selection', component: RestaurantSelectionComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },
  
  // Restaurant-specific protected routes
  {
    path: 'waiter/:restaurantId',
    component: WaiterComponent,
    canActivate: [AuthGuard],
    data: { 
      roles: ['waiter', 'manager', 'admin'], // ✅ ADDED manager and admin
      requiresRestaurantContext: true
    }
  },
  {
    path: 'waiter',
    redirectTo: '/login', 
    pathMatch: 'full'
  },
  
  // Kitchen routes
  {
    path: 'kitchen/:restaurantId',
    component: KitchenComponent,
    canActivate: [AuthGuard],
    data: { 
      roles: ['kitchen', 'manager', 'admin'], // ✅ FIX: Changed to lowercase
      requiresRestaurantContext: true
    }
  },
  {
    path: 'kitchen',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  
  // Manager routes
  {
    path: 'manager/:restaurantId',
    component: ManagerComponent,
    canActivate: [AuthGuard],
    data: { 
      roles: ['manager', 'admin'], // ✅ FIX: Changed to lowercase
      requiresRestaurantContext: true
    }
  },
  {
    path: 'manager',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  
  // Other routes
  { path: 'payment', component: PaymentComponent },
  { path: 'pending-payments', component: PendingPaymentsComponent },
  { path: 'new-order', component: NewOrderComponent },
  { path: 'inventory', component: InventoryManagementComponent },
  
  // Fallback route
  { path: '**', redirectTo: '/menu' }
];