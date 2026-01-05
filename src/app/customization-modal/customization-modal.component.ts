  import { Component, Inject,ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
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
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule
  ]
})
export class CustomizationModalComponent {
  product!: Product;
  selectedOption: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<CustomizationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {
    this.product = data.product;
      this.selectedOption = null; 

    if (
      this.product.customizationOptions &&
      this.product.customizationOptions.length > 0
    ) {
      this.selectedOption =
        this.product.customizationOptions[0].customizationOptionID;
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
confirm(): void {
  this.dialogRef.close({
    customizationOptionID: this.selectedOption, 
    price: this.getSelectedPrice()
  });
}

getSelectedPrice(): number {
  if (this.selectedOption === null) {
    return this.product.price;
  }

  if (!this.product.customizationOptions) {
    return this.product.price;
  }

  const chosen = this.product.customizationOptions.find(
    o => o.customizationOptionID === this.selectedOption
  );
  return chosen ? chosen.fixedPrice : this.product.price;
}

}    


