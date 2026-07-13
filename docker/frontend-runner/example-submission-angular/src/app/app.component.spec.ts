// Stands in for the AUTHOR's hidden tests. Angular's image glob is **/*.spec.ts (NOT *.test.tsx),
// and it must not reuse a starter file's path.
import { TestBed } from "@angular/core/testing";
import { AppComponent } from "./app.component";

function countText(fixture: { nativeElement: HTMLElement }): string {
  return fixture.nativeElement.querySelector('[data-testid="count"]')?.textContent?.trim() ?? "";
}

describe("AppComponent counter", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppComponent] }).compileComponents();
  });

  it("starts at 0 and cannot go below 0", () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(countText(fixture)).toBe("0");

    fixture.componentInstance.dec(); // clamped at 0
    fixture.detectChanges();
    expect(countText(fixture)).toBe("0");
  });

  it("increments then resets", () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.inc();
    fixture.componentInstance.inc();
    fixture.detectChanges();
    expect(countText(fixture)).toBe("2");

    fixture.componentInstance.reset();
    fixture.detectChanges();
    expect(countText(fixture)).toBe("0");
  });
});
