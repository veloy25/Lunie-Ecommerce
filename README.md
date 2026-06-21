# 🛍️ E-Commerce de Beleza

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white" alt="CI/CD" />
</div>

<br />

Plataforma completa de e-commerce fullstack focada na venda de produtos de beleza e perfumes. Este projeto foi concebido sob conceitos modernos de engenharia de software, priorizando a **segurança de dados**, **escalabilidade de código** e **automação de processos (CI/CD)**.

Projetado como uma solução real para um negócio solo, o sistema opera com **custo zero de infraestrutura**, utilizando as melhores ferramentas de *Free Tier* do mercado.

---

## ✨ Funcionalidades Principais

- **Catálogo Dinâmico:** Exibição de produtos com carregamento otimizado de imagens.
- **Carrinho de Compras Persistente:** Gerenciamento de estado robusto no lado do cliente.
- **Checkout Transparente:** Integração segura com a API do Mercado Pago.
- **Webhooks de Pagamento:** Atualização instantânea do status do pedido de forma assíncrona.
- **Otimização de Mídia:** Armazenamento em nuvem com redimensionamento automático de imagens.

---

## 🛡️ Segurança & Conformidade (LGPD)

Para garantir total conformidade com a **Lei Geral de Proteção de Dados (LGPD)** e mitigar riscos de segurança:
- **Zero armazenamento de dados sensíveis:** Dados de cartões de crédito e informações de pagamento são processados diretamente nos servidores seguros do gateway de pagamento.
- **Isolamento de Variáveis:** Todas as chaves privadas (`Access Tokens`) são criptografadas em ambiente de produção e nunca são expostas no código-fonte.

---

## 📐 Arquitetura do Sistema

O projeto adota a estratégia de **Monorepo**, facilitando o desenvolvimento solo e o versionamento sincronizado entre a interface e a API.

```text
ecommerce-beleza/
├── client/                 # Camada de Visão (React + Vite)
│   ├── src/
│   │   ├── components/     # Componentes de interface reutilizáveis
│   │   ├── pages/          # Páginas da aplicação (Home, Checkout, etc)
│   │   └── services/       # Módulo de integração com a API (Axios)
│   └── package.json
│
└── server/                 # API RESTful (Node.js + Express)
    ├── src/
    │   ├── modules/        # Domínios isolados de negócio (Produtos, Pedidos)
    │   └── shared/         # Recursos globais (Conexão do Banco, Middlewares)
    └── package.json
