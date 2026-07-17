// Stands in for the AUTHOR's hidden tests. Must match the image's glob:
// **/*.{test,spec}.{js,jsx,ts,tsx}   — and must NOT reuse a starter file's path.
import { render, screen, fireEvent } from "@testing-library/react";
import Page from "./page";

describe("counter", () => {
  it("starts at 0 and cannot go below 0", () => {
    render(<Page />);
    expect(screen.getByTestId("count").textContent).toBe("0");
    fireEvent.click(screen.getByText("-")); // disabled at 0 → no change
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("increments then resets", () => {
    render(<Page />);
    fireEvent.click(screen.getByText("+"));
    fireEvent.click(screen.getByText("+"));
    expect(screen.getByTestId("count").textContent).toBe("2");
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
