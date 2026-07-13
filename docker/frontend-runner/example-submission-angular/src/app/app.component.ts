// Stands in for the CANDIDATE's source (Angular standalone component).
import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  standalone: true,
  template: `
    <h1>Counter</h1>
    <p data-testid="count">{{ count }}</p>
    <button (click)="dec()" [disabled]="count === 0">-</button>
    <button (click)="reset()">Reset</button>
    <button (click)="inc()">+</button>
  `,
})
export class AppComponent {
  count = 0;

  inc(): void {
    this.count += 1;
  }

  dec(): void {
    this.count = Math.max(0, this.count - 1);
  }

  reset(): void {
    this.count = 0;
  }
}
