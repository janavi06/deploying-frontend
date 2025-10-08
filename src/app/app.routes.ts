import { Routes } from '@angular/router';  // ✅ Add this line

import { MenuComponent    } from './menu/menu.component';
import { WaiterComponent  } from './waiter/waiter.component';
import { KitchenComponent } from './kitchen/kitchen.component';
import { ManagerComponent } from './manager/manager.component';
import { PaymentComponent } from './payment/payment.component';
import { PendingPaymentsComponent } from './pending-payments/pending-payments.component';
import { RegisterComponent } from './register/register.component';
import { AuthGuard        } from './services/auth.guard';
import { NewOrderComponent } from './new-order/new-order.component';

export const routes: Routes = [
  // public
  { path: '', redirectTo: '/menu', pathMatch: 'full' },
  { path: 'menu', component: MenuComponent },
  { path: 'kitchen', component: KitchenComponent },
  { path: 'manager', component: ManagerComponent },
  { path: 'pending-payments', component: PendingPaymentsComponent },
  { path: 'payment/:id', component: PaymentComponent },
  { path: 'new-order', component: NewOrderComponent },

  // guarded (optional if you want to protect waiter route)
  {
    path: 'waiter',
    component: WaiterComponent,
    // canActivate: [AuthGuard], // uncomment if you want guard protection
  },

  // catch‐all
  { path: '**', redirectTo: '/menu' }
];
