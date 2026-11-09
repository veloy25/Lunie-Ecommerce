import React, { useState, useMemo, useRef, useEffect } from "react";

const PRODUCTS = [
  { id: 1, name: "Óleo Corporal Karité", category: "Corpo", ingredient: "Karité", price: 89.9, oldPrice: 109.9, tag: "Mais vendido", colorway: "#C99B5E" },
  { id: 2, name: "Bruma Capilar Lavanda", category: "Cabelo", ingredient: "Lavanda", price: 64.9, oldPrice: null, tag: null, colorway: "#9A8FB0" },
  { id: 3, name: "Sérum Facial Camélia", category: "Rosto", ingredient: "Camélia", price: 124.9, oldPrice: 149.9, tag: "Novo", colorway: "#D9B4A8" },
  { id: 4, name: "Água de Perfume Âmbar", category: "Perfumaria", ingredient: "Âmbar", price: 198.0, oldPrice: null, tag: null, colorway: "#A8763E" },
  { id: 5, name: "Esfoliante Corporal Café", category: "Corpo", ingredient: "Café verde", price: 72.9, oldPrice: null, tag: null, colorway: "#7A5C45" },
  { id: 6, name: "Máscara Capilar Argan", category: "Cabelo", ingredient: "Argan", price: 79.9, oldPrice: 94.9, tag: "Mais vendido", colorway: "#B68A4E" },
  { id: 7, name: "Hidratante Facial Aloe", category: "Rosto", ingredient: "Aloe vera", price: 98.5, oldPrice: null, tag: "Novo", colorway: "#A9BD8C" },
  { id: 8, name: "Eau de Toilette Flor de Laranjeira", category: "Perfumaria", ingredient: "Flor de laranjeira", price: 215.0, oldPrice: null, tag: null, colorway: "#E2C58A" },
];

const CATEGORIES = ["Todos", "Corpo", "Rosto", "Cabelo", "Perfumaria"];

function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function IngredientSeal({ ingredient, colorway, size = 56 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${colorway}1A`,
        border: `1px solid ${colorway}55`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: size - 14,
          height: size - 14,
          borderRadius: "50%",
          background: colorway,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E0D3",
        borderRadius: "2px",
        padding: "0",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.25s ease, transform 0.25s ease",
        borderColor: hovered ? "#5C6B4D" : "#E8E0D3",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          background: `linear-gradient(160deg, ${product.colorway}22, #FAF7F2)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {product.tag && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              fontFamily: "'Inter', sans-serif",
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#FAF7F2",
              background: "#2B2A26",
              padding: "5px 10px",
            }}
          >
            {product.tag}
          </span>
        )}
        <div
          style={{
            width: 86,
            height: 130,
            borderRadius: "4px 4px 14px 14px",
            background: product.colorway,
            opacity: 0.92,
            transform: hovered ? "translateY(-4px)" : "translateY(0)",
            transition: "transform 0.3s ease",
            boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
          }}
        />
      </div>

      <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IngredientSeal ingredient={product.ingredient} colorway={product.colorway} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 16.5,
                fontWeight: 500,
                color: "#2B2A26",
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {product.name}
            </p>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: "#8A8475",
                margin: "3px 0 0",
                letterSpacing: "0.02em",
              }}
            >
              Ingrediente-chave: {product.ingredient}
            </p>
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10 }}>
          <div>
            {product.oldPrice && (
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12.5,
                  color: "#B0AA9B",
                  textDecoration: "line-through",
                  marginRight: 6,
                }}
              >
                {formatBRL(product.oldPrice)}
              </span>
            )}
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, color: "#2B2A26" }}>
              {formatBRL(product.price)}
            </span>
          </div>
          <button
            onClick={() => onAdd(product)}
            aria-label={`Adicionar ${product.name} ao carrinho`}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: "0.03em",
              color: "#FAF7F2",
              background: "#5C6B4D",
              border: "none",
              padding: "9px 14px",
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#475038")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#5C6B4D")}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, items, onRemove, onQty }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(43,42,38,0.35)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transition: "opacity 0.3s ease",
          zIndex: 40,
        }}
      />
      <aside
        role="dialog"
        aria-label="Carrinho de compras"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(420px, 92vw)",
          background: "#FAF7F2",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-2px 0 24px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px", borderBottom: "1px solid #E8E0D3" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, margin: 0, color: "#2B2A26" }}>
            Sua sacola
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#8A8475", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px" }}>
          {items.length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", color: "#8A8475", fontSize: 14, marginTop: 40, textAlign: "center" }}>
              Sua sacola está vazia.
              <br />
              Que tal adicionar algo especial?
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "16px 0",
                  borderBottom: "1px solid #E8E0D3",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 64,
                    borderRadius: "4px 4px 10px 10px",
                    background: item.colorway,
                    opacity: 0.9,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Fraunces', serif", fontSize: 14.5, fontWeight: 500, margin: 0, color: "#2B2A26" }}>
                    {item.name}
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#8A8475", margin: "2px 0 8px" }}>
                    {formatBRL(item.price)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => onQty(item.id, -1)}
                      aria-label="Diminuir quantidade"
                      style={qtyBtnStyle}
                    >
                      −
                    </button>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, minWidth: 14, textAlign: "center" }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => onQty(item.id, 1)}
                      aria-label="Aumentar quantidade"
                      style={qtyBtnStyle}
                    >
                      +
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      style={{
                        marginLeft: "auto",
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                        color: "#A8763E",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      remover
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div style={{ padding: "20px 24px 24px", borderTop: "1px solid #E8E0D3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#2B2A26" }}>Total</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: "#2B2A26" }}>
                {formatBRL(total)}
              </span>
            </div>
            <button
              style={{
                width: "100%",
                padding: "14px",
                background: "#5C6B4D",
                color: "#FAF7F2",
                border: "none",
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.03em",
                cursor: "pointer",
              }}
            >
              Finalizar compra
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

const qtyBtnStyle = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "1px solid #D8D1C2",
  background: "#FFFFFF",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
  color: "#2B2A26",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function EssenciaStore() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const filtered = useMemo(
    () => (activeCategory === "Todos" ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCategory)),
    [activeCategory]
  );

  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  function addToCart(product) {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setToast(`${product.name} adicionado à sacola`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function changeQty(id, delta) {
    setCartItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  }

  function removeItem(id) {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div style={{ background: "#FAF7F2", minHeight: "100vh", color: "#2B2A26" }}>
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#FAF7F2",
          borderBottom: "1px solid #E8E0D3",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 76,
          }}
        >
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "0.01em",
              color: "#2B2A26",
            }}
          >
            Essência
          </span>

          <nav style={{ display: "flex", gap: 32 }}>
            {CATEGORIES.filter((c) => c !== "Todos").map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13.5,
                  letterSpacing: "0.02em",
                  color: activeCategory === c ? "#5C6B4D" : "#2B2A26",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  borderBottom: activeCategory === c ? "1.5px solid #5C6B4D" : "1.5px solid transparent",
                }}
              >
                {c}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button aria-label="Buscar" style={iconBtnStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2A26" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.4" y2="16.4" />
              </svg>
            </button>
            <button aria-label="Minha conta" style={iconBtnStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B2A26" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
              </svg>
            </button>
            <button
              onClick={() => setCartOpen(true)}
              aria-label={`Carrinho com ${cartCount} itens`}
              style={{ ...iconBtnStyle, position: "relative" }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#2B2A26" strokeWidth="1.6">
                <path d="M6 8h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    background: "#A8763E",
                    color: "#FAF7F2",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10.5,
                    fontWeight: 600,
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 32px 88px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center" }}>
          <div>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#A8763E",
                margin: "0 0 18px",
              }}
            >
              Coleção karité &amp; lavanda
            </p>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(38px, 5vw, 56px)",
                fontWeight: 500,
                lineHeight: 1.08,
                margin: "0 0 24px",
                color: "#2B2A26",
                letterSpacing: "-0.01em",
              }}
            >
              Cuidado que vem da terra, não do rótulo.
            </h1>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 16.5,
                lineHeight: 1.65,
                color: "#5C5648",
                maxWidth: 420,
                margin: "0 0 36px",
              }}
            >
              Ingredientes rastreáveis, fórmulas concentradas e embalagens recicláveis.
              Cada produto leva o nome do ingrediente que o define.
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  color: "#FAF7F2",
                  background: "#5C6B4D",
                  border: "none",
                  padding: "15px 28px",
                  cursor: "pointer",
                }}
              >
                Explorar coleção
              </button>
              <button
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  color: "#2B2A26",
                  background: "transparent",
                  border: "1px solid #2B2A26",
                  padding: "15px 28px",
                  cursor: "pointer",
                }}
              >
                Nossa origem
              </button>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 5",
              background: "linear-gradient(150deg, #E8E0D3, #F3EEE3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 150,
                height: 230,
                borderRadius: "6px 6px 26px 26px",
                background: "#C99B5E",
                opacity: 0.92,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 28,
                left: 28,
                background: "#FAF7F2",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid #E8E0D3",
              }}
            >
              <IngredientSeal ingredient="Karité" colorway="#C99B5E" size={30} />
              <div>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 13, margin: 0, fontWeight: 500 }}>Karité puro</p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, margin: 0, color: "#8A8475" }}>
                  Origem: Burkina Faso
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category strip */}
      <section style={{ borderTop: "1px solid #E8E0D3", borderBottom: "1px solid #E8E0D3", background: "#F3EEE3" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "28px 32px",
            display: "flex",
            gap: 40,
            justifyContent: "center",
          }}
        >
          {[
            { label: "Frete grátis acima de R$150", icon: "🜂" },
            { label: "Trocas em até 30 dias", icon: "↻" },
            { label: "Fórmulas veganas", icon: "✿" },
            { label: "Embalagens recicláveis", icon: "♺" },
          ].map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, color: "#A8763E" }}>{b.icon}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#5C5648" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Product grid */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 32px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 16 }}>
          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 30,
              fontWeight: 500,
              margin: 0,
              color: "#2B2A26",
            }}
          >
            Produtos por ingrediente
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12.5,
                  letterSpacing: "0.02em",
                  color: activeCategory === c ? "#FAF7F2" : "#5C5648",
                  background: activeCategory === c ? "#5C6B4D" : "transparent",
                  border: "1px solid",
                  borderColor: activeCategory === c ? "#5C6B4D" : "#D8D1C2",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 24,
          }}
        >
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={addToCart} />
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ background: "#5C6B4D", padding: "64px 32px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <h3
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 26,
              fontWeight: 500,
              color: "#FAF7F2",
              margin: "0 0 12px",
            }}
          >
            Receba o catálogo de ingredientes
          </h3>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: "#D9E0CF", margin: "0 0 28px" }}>
            Histórias de origem, lançamentos e 10% na primeira compra.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="seu@email.com"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                padding: "13px 18px",
                border: "none",
                width: 260,
                background: "#FAF7F2",
                color: "#2B2A26",
              }}
            />
            <button
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: "#5C6B4D",
                background: "#FAF7F2",
                border: "none",
                padding: "13px 24px",
                cursor: "pointer",
              }}
            >
              Inscrever
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "56px 32px 40px", borderTop: "1px solid #E8E0D3" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            gap: 32,
          }}
        >
          <div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: "#2B2A26" }}>
              Essência
            </span>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#8A8475", marginTop: 12, maxWidth: 240, lineHeight: 1.6 }}>
              Cosmética natural brasileira com origem rastreável e fórmulas concentradas.
            </p>
          </div>
          {[
            { title: "Produtos", links: ["Corpo", "Rosto", "Cabelo", "Perfumaria"] },
            { title: "Empresa", links: ["Sobre nós", "Origem dos ingredientes", "Sustentabilidade", "Trabalhe conosco"] },
            { title: "Atendimento", links: ["Trocas e devoluções", "Frete e entrega", "Fale conosco", "Perguntas frequentes"] },
          ].map((col) => (
            <div key={col.title}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#2B2A26", margin: "0 0 14px" }}>
                {col.title}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {col.links.map((l) => (
                  <a key={l} href="#" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#8A8475", textDecoration: "none" }}>
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#B0AA9B", textAlign: "center", marginTop: 48 }}>
          © 2026 Essência Cosmética Natural. Todos os direitos reservados.
        </p>
      </footer>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onRemove={removeItem}
        onQty={changeQty}
      />

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#2B2A26",
            color: "#FAF7F2",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13.5,
            padding: "12px 22px",
            zIndex: 60,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
};
