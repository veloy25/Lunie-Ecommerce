// src/pages/Home.jsx
import { useState, useMemo, useRef, useEffect } from "react";
import { PRODUCTS, CATEGORIES } from "../data/mock-products";
import { ProductCard } from "../components/ProductCard";
// import { CartDrawer } from "../components/CartDrawer"; // (Após você criar esse componente)

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cartItems, setCartItems] = useState([]);

  // Lógica de filtro separada e limpa
  const filtered = useMemo(
    () => (activeCategory === "Todos" ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCategory)),
    [activeCategory]
  );

  // Função que será passada como Prop para o ProductCard
  function addToCart(product) {
    // ... sua lógica de adicionar ao carrinho ...
    console.log("Adicionado: ", product.name);
  }

  return (
    <div style={{ background: "#FAF7F2", minHeight: "100vh" }}>
      <div style = {{paddingBottom: 15}}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: "#2B2A26"}}>
          Luniê
        </span>
      </div>
      
      <section style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 400, margin: 0, color: "#2B2A26" }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          marginBottom: 36, 
          flexWrap: "wrap", 
          gap: 16 
        }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 500, margin: 0, color: "#2B2A26" }}>
            Produtos por categoria
          </h2>
        <div style={{ display: "flex", gap: 8 }}>
            {CATEGORIES.map((categoria) => (
              <button
                key={categoria}
                onClick={() => setActiveCategory(categoria)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12.5,
                  color: activeCategory === categoria ? "#FAF7F2" : "#5C5648",
                  background: activeCategory === categoria ? "#5C6B4D" : "transparent",
                  border: "1px solid",
                  borderRadius:"7px",
                  borderColor: activeCategory === categoria ? "#5C6B4D" : "#D8D1C2",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {categoria}
              </button>
            ))}
          </div>
        </div>
        
        
        {/* Grid de Produtos muito mais limpo de se ler! */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 24 }}>
          {filtered.map((p) => (
            <ProductCard 
               key={p.id} 
               product={p}     /* Passando o dado via Prop */
               onAdd={addToCart} /* Passando a função via Prop */
            />
          ))}
        </div>
      </section>

      {/* <CartDrawer items={cartItems} /> */}
    </div>
  );
}