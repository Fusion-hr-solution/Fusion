import { Link } from "react-router-dom";
import { PRODUCTS } from "../data.js";

export default function Products() {
  return (
    <section>
      <h1 data-testid="page-title">Products</h1>
      <ul data-testid="product-list">
        {PRODUCTS.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`} data-testid={`link-${p.id}`}>
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
