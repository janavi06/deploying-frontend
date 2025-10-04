import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WaiterChatService {

  constructor(private http: HttpClient) { }

askQuestion(question: string, restaurantId: number): Observable<{ answer: string }> {
  return this.http.post<{ answer: string }>(
    `/api/chatbot/ask?restaurantId=${restaurantId}`,
    { question } // wrap it in an object
  );
}

}
