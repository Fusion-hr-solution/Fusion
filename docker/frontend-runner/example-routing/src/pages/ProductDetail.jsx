import { useParams, Link } from "react-router-dom";
import { PRODUCTS } from "../data.js";

export default function ProductDetail() {
  const { id } = useParams();
  const product = PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return <h1 data-testid="page-title">Not found</h1>;
  }

  return (
    <section>
      <h1 data-testid="page-title">{product.name}</h1>
      <p data-testid="price">{product.price.toFixed(2)}</p>
      <Link to="/products" data-testid="back">Back</Link>
    </section>
  );
}
