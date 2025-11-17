import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewChild, ElementRef } from '@angular/core';
import { environment } from '../../environments/environment';
import { SignalRService } from '../services/signalr.service';
import { MatSnackBar } from '@angular/material/snack-bar';
type KitchenStatus = 'Pending' | 'Preparing' | 'Ready';


@Component({
  selector: 'app-kitchen',
  templateUrl: './kitchen.component.html',
  styleUrls: ['./kitchen.component.css'],
  imports: [CommonModule, FormsModule],
})
export class KitchenComponent implements OnInit, OnDestroy {
  pendingOrders: any[] = [];
  orderHistory: any[] = [];
  filteredHistoryOrders: any[] = [];
 apiUrl = `${environment.apiUrl}/order`;

  private debounceTimer: any; // ✅ debounce for SignalR-triggered refresh
private speechQueue: SpeechSynthesisUtterance[] = [];
private isSpeaking = false;
  orderNumberMap: { [orderID: number]: number } = {}; // ✅ ADD THIS PROPERTY

  // Variable to track which section is selected from the sidebar
  selectedSection: string = 'overview';
  isSidebarOpen: boolean = true; // Sidebar starts open

  pendingOrderBatches: any[] = []; // New property for grouped data

batchStatusMap: { [orderId: number]: { [batchId: number]: number } } = {};
spokenBatches = new Set<string>();  // ✅ Tracks orderID + batchID
restaurantId: number = 0; // ✅ Set from localStorage

lastPendingOrderIds: number[] = [];
batchStartTimes: { [orderId: number]: { [batchId: number]: number } } = {};
batchTimerIntervals: { [key: string]: any } = {}; // interval ids by "order-batch" key

    // For play-once logic
  lastPendingOrders: { orderID: number; playSound: boolean }[] = [];
  hasLoadedOnce = false;
tableMap: { [key: number]: string } = {};

  // Settings object for managing dashboard preferences
  settings = {
    darkMode: false,
    enableSound: true,
     enableSpeech: true,
    refreshInterval: 10, // seconds
    language: 'en',
    autoLogout: 15, // minutes
  };

  refreshIntervalId: any;

  constructor(private http: HttpClient,
      private signalRService: SignalRService,
        private snackbar: MatSnackBar // 👈 inject snackbar

  ) {}


ngOnInit(): void {
  const savedLang = localStorage.getItem('kitchen_lang');
  if (savedLang) this.settings.language = savedLang;

  setTimeout(() => {
    speechSynthesis.getVoices();
    console.log("✅ Voices initialized on load");
  }, 100);

  // 🔓 Resume audio on first tap (mobile-safe)
  document.body.addEventListener('click', () => {
    try {
      if (this.settings.enableSpeech) {
        speechSynthesis.resume();
        console.log("🔊 Speech synthesis resumed");
      }
    } catch (e) {
      console.warn("⚠️ Failed to resume speech:", e);
    }
  }, { once: true });

  // Optional but safe
  speechSynthesis.onvoiceschanged = () => {
    speechSynthesis.getVoices();
  };
const storedId = localStorage.getItem('restaurantId');
if (storedId) this.restaurantId = +storedId;

  this.fetchTables();
  this.signalRService.startConnection();
  this.signalRService.onNewOrder((orderId: number) => {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.getOrders(), 300);
  });

  this.getOrders();
  this.getHistoryOrders();
  this.setupAutoRefresh();
}



  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  ngOnDestroy(): void {
    // Clear the interval when the component is destroyed to prevent memory leaks.
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }
  }

  setupAutoRefresh(): void {
    if (this.refreshIntervalId) clearInterval(this.refreshIntervalId);
    this.refreshIntervalId = setInterval(
      () => this.getOrders(),
      this.settings.refreshInterval * 1000
    );
  }

  checkNewOrdersForSpeech(): void {
  this.http.get<{ orders: any[] }>(`${this.apiUrl}/kitchen/pending-orders`)
    .subscribe(response => {
      const newOrders = response.orders.filter(o => o.playSound);

      if (newOrders.length > 0 && this.settings.enableSpeech) {
        newOrders.forEach((order, idx) => {
          setTimeout(() => {
            this.readOrderAloud(order);
            this.markSoundPlayed(order.orderID);
            this.getOrders(); // optional full refresh after new order
          }, idx * 1000);
        });
      }
    });
}
getHistoryOrders(): void {
    this.http.get<{ orders: any[] }>(`${this.apiUrl}/kitchen/history-orders?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (res) => {
          this.orderHistory = res.orders.map(order => ({
            ...order,
            orderNumber: order.orderNumber || order.orderID, // ✅ ADD ORDER NUMBER (fallback to orderID)
            orderDate: new Date(order.createdAt)
          }));
          this.filterHistoryOrders();
        },
        error: (err) => console.error('❌ Failed to fetch order history:', err)
      });
  }


  getOrders(): void {
    this.http.get<{ message: string; orders: any[] }>(`${this.apiUrl}/kitchen/pending-orders?restaurantId=${this.restaurantId}`)
      .subscribe({
        next: (response) => {
          // reset current pending list (we will re-build)
          this.pendingOrders = [];

          if (!response?.orders) {
            console.warn('No orders in response');
            return;
          }

          const statusMap: Record<KitchenStatus, number> = {
            'Pending': 0,
            'Preparing': 1,
            'Ready': 2
          };

          response.orders.forEach(batch => {
            // only include items that are not prepared
            const unpreparedItems = (batch.items || []).filter((item: any) => !item.isPrepared);
            if (unpreparedItems.length === 0) return;

            // ✅ STORE ORDER NUMBER MAPPING
            if (batch.orderNumber) {
              this.orderNumberMap[batch.orderID] = batch.orderNumber;
            }

            // push normalized batch item to pendingOrders
            this.pendingOrders.push({
              orderID: batch.orderID,
              orderNumber: batch.orderNumber || batch.orderID, // ✅ ADD ORDER NUMBER (fallback to orderID)
              batchID: batch.batchID,
              restaurantTableID: batch.restaurantTableID,
              kitchenStatus: batch.kitchenStatus,
              playSound: batch.playSound,
              orderDate: new Date(batch.createdAt),
              items: unpreparedItems,
              createdAt: new Date(batch.createdAt),
            });

            // ensure batchStatusMap exists for this order
            if (!this.batchStatusMap[batch.orderID]) {
              this.batchStatusMap[batch.orderID] = {};
            }

            // initialize status mapping if undefined
            if (this.batchStatusMap[batch.orderID][batch.batchID] === undefined) {
              this.batchStatusMap[batch.orderID][batch.batchID] =
                statusMap[batch.kitchenStatus as KitchenStatus] ?? 0;
            }

            // --- TIMER: start per-batch timer if not already started ---
            if (!this.batchStartTimes[batch.orderID]) {
              this.batchStartTimes[batch.orderID] = {};
            }

            if (this.batchStartTimes[batch.orderID][batch.batchID] === undefined) {
              // prefer server-provided start timestamp if available
              const startTs = batch.kitchenStartedAt ? new Date(batch.kitchenStartedAt).getTime() : Date.now();
              this.batchStartTimes[batch.orderID][batch.batchID] = startTs;
              this.startBatchInterval(batch.orderID, batch.batchID);
            }

            // --- SPEECH: speak per-batch once (and mark as played server-side) ---
            const batchKey = `${batch.orderID}-${batch.batchID}`;
            if (batch.playSound && this.settings.enableSpeech && !this.spokenBatches.has(batchKey)) {
              this.readOrderAloud({
                orderID: batch.orderID,
                orderNumber: batch.orderNumber || batch.orderID, // ✅ INCLUDE ORDER NUMBER IN SPEECH
                restaurantTableID: batch.restaurantTableID,
                items: unpreparedItems
              });

              // Mark played and avoid double-speaking across polls
              this.markSoundPlayed(batch.orderID)
                .then(() => {
                  this.spokenBatches.add(batchKey);
                })
                .catch(err => {
                  console.error('Failed to mark sound played for order', batch.orderID, err);
                });
            }
          });

          // play initial sounds for the first load (if you keep that flow)
          if (!this.hasLoadedOnce) {
            // playNewOrderSounds may be async; call it and log errors if any
            try {
              // If playNewOrderSounds returns a Promise:
              const p = (this as any).playNewOrderSounds?.();
              if (p && typeof p.then === 'function') p.catch((e: any) => console.error('playNewOrderSounds error', e));
            } catch (e) {
              console.warn('playNewOrderSounds invocation failed or is not present', e);
            }
          }

          console.log('Updated pendingOrders:', this.pendingOrders);
          console.log('Updated batchStatusMap:', this.batchStatusMap);
        },
        error: (err) => {
          console.error('Error fetching orders:', err);
          this.snackbar.open('Error fetching orders', 'Dismiss', { duration: 1000 });
        }
      });
  }


fetchTables(): void {
  this.http.get<any[]>(`${environment.apiUrl}/restauranttables?restaurantId=${this.restaurantId}`).subscribe({
    next: (tables) => {
      this.tableMap = {};
      tables.forEach(t => {
        this.tableMap[t.restaurantTableID] = t.tableName;
      });
    },
    error: err => {
      console.error('Failed to fetch table names:', err);
    }
  });
}



private groupItemsByBatch(items: any[]): any[] {
  const batchMap = new Map<string, any>();

  items.forEach((item: any) => {
    const batchKey = item.batchID || 'default';
    if (!batchMap.has(batchKey)) {
      batchMap.set(batchKey, {
        batchId: batchKey,
        addedTime: item.addedToKitchenAt,
        isNew: new Date(item.addedToKitchenAt) > new Date(Date.now() - 30000),
        items: []
      });
    }
    batchMap.get(batchKey).items.push(item);
  });

  return Array.from(batchMap.values());
}


private async playNewOrderSounds(): Promise<void> {
  if (!this.hasLoadedOnce && this.settings.enableSound) {
    const ordersToPlay = this.pendingOrders.filter(order => order.playSound);

    for (let idx = 0; idx < ordersToPlay.length; idx++) {
      const order = ordersToPlay[idx];

      if (this.settings.enableSpeech) {
        this.readOrderAloud(order);
      }

      // ✅ Mark sound as played in backend
      await this.markSoundPlayed(order.orderID);
    }
  }

  this.hasLoadedOnce = true;
}


  advanceOrder(order: any, newStatus: number): void {
    let statusString: string;
    switch (newStatus) {
      case 1: // Preparing
        statusString = "Preparing";
        break;
      case 2: // Ready
        statusString = "Ready";
        break;
      default:
        statusString = "Pending";
    }

    this.http
      .put(
        `${this.apiUrl}/kitchen/update-status/${order.orderID}?restaurantId=${this.restaurantId}`,
        JSON.stringify(statusString),
        { headers: { 'Content-Type': 'application/json' } }
      )
      .subscribe({
        next: () => {
          this.getOrders(); // Refresh orders
          if (newStatus === 2) { // If marked as ready
            this.notifyWaiter(order.orderID, order.restaurantTableID);
          }
        },
        error: (err) => console.error('Error updating status:', err)
      });
  }

// Update this method to handle status changes properly
advanceBatch(orderID: number, batchID: number, newStatus: 'Preparing' | 'Ready'): void {
  const body = { 
    status: newStatus, 
    batchID: batchID 
  };

  this.http.put(`${this.apiUrl}/kitchen/update-batch-status/${orderID}`, body)
    .subscribe({
      next: () => {
        // Update local state immediately
        if (!this.batchStatusMap[orderID]) {
          this.batchStatusMap[orderID] = {};
        }
        
        // Map status to numeric value
        const statusMap = {
          'Preparing': 1,
          'Ready': 2
        };
        
        this.batchStatusMap[orderID][batchID] = statusMap[newStatus];
        
        // If marking as ready, notify waiter
        if (newStatus === 'Ready') {
          const order = this.pendingOrders.find(o => 
            o.orderID === orderID && o.batchID === batchID
          );
          if (order) {
            this.notifyWaiter(orderID, order.restaurantTableID);
          }
        }
        
        // Optional: refresh orders from server
        this.getOrders();
      },
      error: err => {
        console.error('Failed to update batch:', err);
        this.snackbar.open('Failed to update order status', 'Dismiss', { duration: 3000 });
      }
    });
}
  notifyWaiter(orderId: number, tableNo: number): void {
    const orderNumber = this.orderNumberMap[orderId] || orderId;
    
    this.http.post(`${this.apiUrl}/waiter/notifications?restaurantId=${this.restaurantId}`, {
      orderId,
      tableNo,
      message: `Order #${orderNumber} for Table ${tableNo} is ready to serve` // ✅ USE ORDER NUMBER
    }).subscribe({
      next: () => console.log('Waiter notified'),
      error: err => console.error('Error notifying waiter:', err)
    });
  }

// Helper: generate key
private getBatchKey(orderID: number, batchID: number) {
  return `${orderID}-${batchID}`;
}

// Start interval to update UI (no need to update a value; Angular will evaluate getter)
private startBatchInterval(orderID: number, batchID: number) {
  const key = this.getBatchKey(orderID, batchID);
  if (this.batchTimerIntervals[key]) return;
  // keep interval only to trigger Angular change detection periodically
  this.batchTimerIntervals[key] = setInterval(() => {
    // noop — timer displayed by getter; interval keeps UI ticking every second
    // If you want to trigger change detection manually, inject ChangeDetectorRef and call markForCheck()
  }, 1000);
}

// Stop interval and return elapsed seconds
private stopBatchIntervalAndGetElapsed(orderID: number, batchID: number): number {
  const key = this.getBatchKey(orderID, batchID);
  const start = this.batchStartTimes?.[orderID]?.[batchID];
  const elapsedSec = start ? Math.floor((Date.now() - start) / 1000) : 0;

  // clear interval
  if (this.batchTimerIntervals[key]) {
    clearInterval(this.batchTimerIntervals[key]);
    delete this.batchTimerIntervals[key];
  }

  // remove start time
  if (this.batchStartTimes?.[orderID]) {
    delete this.batchStartTimes[orderID][batchID];
    if (Object.keys(this.batchStartTimes[orderID]).length === 0) {
      delete this.batchStartTimes[orderID];
    }
  }

  return elapsedSec;
}

// Returns elapsed seconds (used by UI getter)
getElapsedSeconds(orderID: number, batchID: number): number {
  const start = this.batchStartTimes?.[orderID]?.[batchID];
  if (!start) return 0;
  return Math.floor((Date.now() - start) / 1000);
}

// Nice formatting: Hh Mm Ss or Mm Ss
/**
 * Shows elapsed time dynamically for a running batch.
 */
getFormattedElapsed(orderID: number, batchID: number): string {
  if (!this.batchStartTimes[orderID] || this.batchStartTimes[orderID][batchID] === undefined) {
    return '0 sec';
  }
  const elapsedMs = Date.now() - this.batchStartTimes[orderID][batchID];
  const sec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h} hr ${m} min ${s} sec`;
  } else if (m > 0) {
    return `${m} min ${s} sec`;
  }
  return `${s} sec`;
}

/**
 * Format seconds for history table (same pattern).
 */
formatSecondsToPresent(sec?: number | null): string {
  if (sec === undefined || sec === null) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) return `${h} hr ${m} min ${s} sec`;
  if (m > 0) return `${m} min ${s} sec`;
  return `${s} sec`;
}

  updateBatchStatus(orderID: number, batchID: number, newStatus: number): void {
    console.log('Updating status:', { orderID, batchID, newStatus });

    const statusMap = ['Pending', 'Preparing', 'Ready'];
    const statusString = statusMap[newStatus];

    this.http.put(
      `${this.apiUrl}/kitchen/update-batch-status/${orderID}?restaurantId=${this.restaurantId}`,
      { status: statusString, batchID },
      { headers: { 'Content-Type': 'application/json' } }
    ).subscribe({
      next: () => {
        // ✅ Update local batch status
        if (!this.batchStatusMap[orderID]) {
          this.batchStatusMap[orderID] = {};
        }
        this.batchStatusMap[orderID][batchID] = newStatus;

        console.log('✅ Local batchStatusMap updated:', this.batchStatusMap);

        // ✅ Optional: Update kitchenStatus text in UI
        const batchIndex = this.pendingOrders.findIndex(b =>
          b.orderID === orderID && b.batchID === batchID
        );
        if (batchIndex !== -1) {
          this.pendingOrders[batchIndex].kitchenStatus = statusString;
        }

        // ✅ If marked as Ready
        if (newStatus === 2) {
          const order = this.pendingOrders.find(b =>
            b.orderID === orderID && b.batchID === batchID
          );
          if (order) {
            this.notifyWaiter(orderID, order.restaurantTableID);
          }

          // ✅ Remove batch from pendingOrders
          this.pendingOrders = this.pendingOrders.filter(b =>
            !(b.orderID === orderID && b.batchID === batchID)
          );

          // ✅ Refresh history orders to include this batch
          this.getHistoryOrders();
        }

        // ✅ Refresh pending orders (good for UI sync)
        this.getOrders();
      },
      error: err => {
        console.error('❌ Failed to update status:', err);
        this.snackbar.open('Failed to update order status', 'Dismiss', { duration: 3000 });
      }
    });
  }

 getDisplayOrderNumber(orderID: number): number {
    return this.orderNumberMap[orderID] || orderID;
  }

getCustomizationText(customizations: any[]): string {
  return customizations.map(c => {
    const val = c.optionName?.toLowerCase();

    if (this.settings.language === 'hi') {
      switch (val) {
        case 'half': return 'हाफ़';
        case 'full': return 'फुल';
        case 'no onion': return 'बिना प्याज़';
        case 'extra cheese': return 'अधिक चीज़';
        case 'less spicy': return 'कम मसाले';
        case 'spicy': return 'तेज मसाले';
        case 'jain': return 'जैन';
        default: return c.optionName;
      }
    }

    return c.optionName;
  }).join(', ');
}


  readOrderAloud(order: any): void {
    const items = order.items || [];
    
    // ✅ USE ORDER NUMBER IN SPEECH
    const orderReference = order.orderNumber ? `order number ${order.orderNumber}` : `order ${order.orderID}`;

    const itemList = items.map((i: any) => {
      const customizationText = i.customizations?.length
        ? ` (${this.getCustomizationText(i.customizations)})`
        : '';
      return this.settings.language === 'hi'
        ? `${i.name}${customizationText} की मात्रा ${i.quantity}`
        : `${i.name}${customizationText}, quantity ${i.quantity}`;
    }).join(', ');

    const message = this.settings.language === 'hi'
      ? `नया ऑर्डर ${orderReference}, टेबल नंबर ${order.restaurantTableID} पर आया है। आइटम्स हैं: ${itemList}। कृपया तैयारी शुरू करें।`
      : `New ${orderReference} at table ${order.restaurantTableID}. Items are: ${itemList}. Please start preparing.`;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = this.settings.language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.7;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Get voice
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.lang === utterance.lang)
      || voices.find(v => v.lang.startsWith('en'));
    if (selectedVoice) utterance.voice = selectedVoice;

    // Add to queue
    this.speechQueue.push(utterance);

    // Start if not already speaking
    if (!this.isSpeaking) {
      this.playNextSpeech();
    }
  }


private playNextSpeech(): void {
  if (this.speechQueue.length === 0) {
    this.isSpeaking = false;
    return;
  }

  this.isSpeaking = true;

  const nextUtterance = this.speechQueue.shift();
  if (!nextUtterance) {
    this.isSpeaking = false;
    return;
  }



  nextUtterance.onend = () => {
    setTimeout(() => {
      this.isSpeaking = false;
      this.playNextSpeech();
    }, 300); // Small gap between announcements
  };

  nextUtterance.onerror = (e) => {
    console.warn('❌ Speech error:', e);
    this.isSpeaking = false;
    this.playNextSpeech(); // Continue even on error
  };

  speechSynthesis.speak(nextUtterance);
}

  // Flip PlaySound flag in backend
markSoundPlayed(orderID: number): Promise<void> {
  return this.http
.put(`${this.apiUrl}/kitchen/mark-sound-played/${orderID}?restaurantId=${this.restaurantId}`, null)
    .toPromise()
    .then(() => console.log(`🔕 Marked sound played for order ${orderID}`))
    .catch(err => console.error(`❌ Failed to mark sound played:`, err));
}


// In your component, modify the status mapping:
getKitchenStatusText(status: number): string {
  switch (status) {
    case 0: return 'Pending';
    case 1: return 'Preparing';
    case 2: return 'Ready';
    default: return 'Unknown';
  }
}

  filterHistoryOrders(): void {
const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
this.filteredHistoryOrders = this.orderHistory.filter(
  o => new Date(o.orderDate) >= last24Hours
);

  }

  // Sample performance metric: Average preparation time (dummy calculation)
  calculateAveragePrepTime(): number {
    if (!this.pendingOrders.length) return 0;
    return Math.round((Math.random() * 15 + 10) * 10) / 10; // dummy value between 10 and 25 minutes
  }

  // Sample metric: Orders completed today from orderHistory
  getOrdersCompletedToday(): number {
    const today = new Date().toDateString();
    return this.orderHistory.filter(order => new Date(order.orderDate).toDateString() === today).length;
  }

  // Sample metric: Determine peak hour (dummy value)
  getPeakHour(): string {
    return '12:00 PM - 1:00 PM';
  }

  // Existing methods remain the same:
  toggleDarkMode(): void {
    this.settings.darkMode = !this.settings.darkMode;
    document.body.classList.toggle('dark-mode', this.settings.darkMode);
  }

  toggleSound(): void {
    this.settings.enableSound = !this.settings.enableSound;
    console.log(`Sound notifications ${this.settings.enableSound ? 'enabled' : 'disabled'}.`);
  }

  updateRefreshInterval(): void {
    console.log(`Refresh interval set to ${this.settings.refreshInterval} seconds.`);
    this.setupAutoRefresh();
  }

  onLanguageChange(): void {
  localStorage.setItem('kitchen_lang', this.settings.language);
  console.log(`✅ Language changed to: ${this.settings.language}`);
}


}