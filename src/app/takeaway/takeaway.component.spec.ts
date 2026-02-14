import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TakeawayComponent } from './takeaway.component';

describe('TakeawayComponent', () => {
  let component: TakeawayComponent;
  let fixture: ComponentFixture<TakeawayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TakeawayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TakeawayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
