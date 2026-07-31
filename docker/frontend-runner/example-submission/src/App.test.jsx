// Stands in for the AUTHOR's hidden test suite (the grader overlays these on top of the
// candidate's files before handing the tree to the runner). The filename must match the image's
// Vitest include glob: **/*.{test,spec}.{js,jsx,ts,tsx}
//
// `describe`/`it`/`expect` are global (the image config sets globals: true).
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

describe("counter", () => {
  it("starts at 0 and cannot go below 0", () => {
    render(<App />);
    expect(screen.getByTestId("count").textContent).toBe("0");
    fireEvent.click(screen.getByText("-")); // disabled at 0 → no change
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("increments then resets", () => {
    render(<App />);
    fireEvent.click(screen.getByText("+"));
    fireEvent.click(screen.getByText("+"));
    expect(screen.getByTestId("count").textContent).toBe("2");
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
