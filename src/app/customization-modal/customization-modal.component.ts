import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CustomizationOption {
  customizationOptionID: number;
  name: string;
  fixedPrice: number;
}

interface Product {
  productID: number;
  productName: string;
  price: number;
  customizationOptions?: CustomizationOption[];
}

@Component({
  selector: 'app-customization-modal',
  templateUrl: './customization-modal.component.html',
  styleUrls: ['./customization-modal.component.css'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule]
})
export class CustomizationModalComponent {
  product!: Product;
  selectedOption: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<CustomizationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {
    this.product = data.product;

    if (this.product.customizationOptions && this.product.customizationOptions.length > 0) {
       this.selectedOption = null; 
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    this.dialogRef.close({
      customizationOptionID: this.selectedOption,
      price: this.getAddonPrice() 
    });
  }

  getAddonPrice(): number {
    if (this.selectedOption === null || !this.product.customizationOptions) {
      return 0;
    }
    const chosen = this.product.customizationOptions.find(
      o => o.customizationOptionID === this.selectedOption
    );
    return chosen ? chosen.fixedPrice : 0;
  }

  getSelectedPrice(): number {
    return this.product.price + this.getAddonPrice();
  }
}