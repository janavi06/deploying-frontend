import { Routes } from '@angular/router';

import { MenuComponent    } from './menu/menu.component';
import { WaiterComponent  } from './waiter/waiter.component';
import { KitchenComponent } from './kitchen/kitchen.component';
import { ManagerComponent } from './manager/manager.component';
import { PaymentComponent } from './payment/payment.component';
import { PendingPaymentsComponent } from './pending-payments/pending-payments.component';

import { LoginComponent    } from './login/login.component';
import { RegisterComponent } from './register/register.component';

// ← import your guard here:
import { AuthGuard        } from './services/auth.guard';
import { NewOrderComponent } from './new-order/new-order.component';



export const routes: Routes = [
  // public
  { path: '',         redirectTo: '/menu',      pathMatch: 'full' },
  { path: 'menu',     component: MenuComponent   },
  { path: 'kitchen',  component: KitchenComponent},
  { path: 'manager',  component: ManagerComponent},
    { path: 'pending-payments',  component: PendingPaymentsComponent},
  { path: 'payment/:id', component: PaymentComponent },
  { path: 'new-order', component: NewOrderComponent },



  // auth-free
  // { path: 'login',    component: LoginComponent    },
  // { path: 'register', component: RegisterComponent },

  // guarded — if not logged in, AuthGuard will redirect to '/login'
{
  path: 'waiter',
  component: WaiterComponent
},

  // catch‐all
  { path: '**', redirectTo: '/menu' }
];
