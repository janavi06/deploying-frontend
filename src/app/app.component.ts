import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';  // ✅ Import RouterModule
import { CommonModule } from '@angular/common'; 

@Component({
  selector: 'app-root',
  standalone: true, // ✅ Keep it standalone
  imports: [CommonModule, RouterModule, RouterOutlet], // ✅ Import RouterModule
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] 
})
export class AppComponent {
  title = 'digital-menu';
}
