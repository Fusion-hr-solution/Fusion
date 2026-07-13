// AUTHOR'S HIDDEN GRADING TESTS for a routed React app.
//
// The test supplies the Router (MemoryRouter) so it can drive the initial URL. That only works
// because App owns the <Routes> and main.jsx owns the <BrowserRouter> — if App had its own Router,
// this would nest two routers and throw.
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App.jsx";

// Render the app at a given URL.
const at = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const title = () => screen.getByTestId("page-title").textContent.trim();

describe("routing", () => {
  it("renders the home route at /", () => {
    at("/");
    expect(title()).toBe("Home");
  });

  it("renders the products route at /products", () => {
    at("/products");
    expect(title()).toBe("Products");
    expect(screen.getByTestId("product-list").children).toHaveLength(3);
  });

  it("resolves a dynamic route param at /products/:id", () => {
    at("/products/p3");
    expect(title()).toBe("Monitor");
    expect(screen.getByTestId("price").textContent.trim()).toBe("199.00");
  });

  it("falls back to a not-found route for an unknown path", () => {
    at("/nope");
    expect(title()).toBe("Not found");
  });

  it("navigates from the list to a detail page by clicking a link", () => {
    at("/products");
    fireEvent.click(screen.getByTestId("link-p1")); // Keyboard
    expect(title()).toBe("Keyboard");
    expect(screen.getByTestId("price").textContent.trim()).toBe("49.99");
  });

  it("navigates back to the list from a detail page", () => {
    at("/products/p2");
    expect(title()).toBe("Mouse");
    fireEvent.click(screen.getByTestId("back"));
    expect(title()).toBe("Products");
  });
});
