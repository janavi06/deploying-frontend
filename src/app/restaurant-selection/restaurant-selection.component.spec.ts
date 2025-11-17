import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestaurantSelectionComponent } from './restaurant-selection.component';

describe('RestaurantSelectionComponent', () => {
  let component: RestaurantSelectionComponent;
  let fixture: ComponentFixture<RestaurantSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestaurantSelectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestaurantSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
