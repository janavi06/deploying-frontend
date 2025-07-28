import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;

  constructor() {}

  startConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.baseUrl}/hubs/order`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
        withCredentials: true
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('✅ SignalR Connected to', `${environment.baseUrl}/hubs/order`))
      .catch(err => console.error('❌ SignalR Error:', err));
  }

  onNewOrder(callback: (orderId: number) => void): void {
    if (this.hubConnection) {
      this.hubConnection.on('NewOrder', callback);
    }
  }
}
