// Candidate's App: owns the ROUTES but NOT the Router (main.jsx provides BrowserRouter in the live
// preview; grading tests provide MemoryRouter). Multi-file + nested + dynamic route params.
import { Routes, Route, Link, NavLink } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Products from "./pages/Products.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <div>
      <nav data-testid="nav">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/products">Products</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <footer>
        <Link to="/products">All products</Link>
      </footer>
    </div>
  );
}
