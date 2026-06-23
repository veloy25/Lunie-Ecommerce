// src/components/ProductCard.jsx
import { useState } from 'react'; // Reimportando o hook que faltava!
import './ProductCard.css'; 
import { formatBRL } from '../utils/formatters';

export function ProductCard({product, onAdd}) {
  // O estado que estava faltando para controlar o efeito do mouse
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="product-card"
      style={{
        // Mantemos esse estilo em linha porque ele depende dinamicamente do estado do JS
        borderColor: hovered ? "#5C6B4D" : "#E8E0D3",
      }}
    >
      <div
        className="product-image-box"
        style={{ background: `linear-gradient(160deg, ${product.colorway}22, #FAF7F2)` }}
      >
        {product.tag && (
          <span className="product-tag">{product.tag}</span>
        )}
        
        {/* O frasco do perfume que se move no hover */}
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

      <div className="product-info">
        {/* Aqui usamos a tag h3 estilizada no seu CSS */}
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "16.5px", margin: 0 }}>
          {product.name}
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#8A8475", margin: "3px 0 0" }}>
          Ingrediente-chave: {product.ingredient}
        </p>
        
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10 }}>
          <div>
            {product.oldPrice && (
              <span style={{ fontSize: 12.5, color: "#B0AA9B", textDecoration: "line-through", marginRight: 6 }}>
                {formatBRL(product.oldPrice)}
              </span>
            )}
            <span style={{ fontSize: 16, fontWeight: 600, color: "#2B2A26" }}>
              {formatBRL(product.price)}
            </span>
          </div>
          <button 
            className="add-button"
            onClick={() => onAdd(product)}
            aria-label={`Adicionar ${product.name} ao carrinho`}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}