import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, appConfig)
  .then(async () => {
    // Only attempt registration in production and supported browsers
    if (!environment.production || !('serviceWorker' in navigator)) return;

    // Ensure secure context (https) or localhost
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    if (!isSecure) {
      console.log('Not a secure context — skipping service worker registration.');
      return;
    }

    // Check whether ngsw-worker.js actually exists before trying to register it
    try {
      const resp = await fetch('/ngsw-worker.js', { method: 'HEAD' });
      if (resp.ok) {
        navigator.serviceWorker
          .register('/ngsw-worker.js')
          .then((reg) => console.log('Service worker registered:', reg))
          .catch((err) => console.error('Service worker registration failed:', err));
      } else {
        console.log('ngsw-worker.js not found — skipping service worker registration.');
      }
    } catch (err) {
      console.log('Failed to check for ngsw-worker.js — skipping registration.', err);
    }
  })
  .catch((err) => console.error(err));
