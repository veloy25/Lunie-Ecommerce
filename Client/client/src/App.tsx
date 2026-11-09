import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AdminPanel } from "./components/AdminPanel.tsx";
import { CartDrawer } from "./components/CartDrawer.tsx";
import { CheckoutDialog } from "./components/CheckoutDialog.tsx";
import { ProductCard } from "./components/ProductCard.tsx";
import { ProductDialog } from "./components/ProductDialog.tsx";
import { apiBaseUrl, apiRequest, loadProducts } from "./lib/api";
import { cartCount, cartSubtotalCents, formatBRL, isPurchasable } from "./lib/commerce";
import type { AuthUser, CartLine, Product } from "./types";

type PolicyKey = "contact" | "privacy" | "returns" | "about";
type StoredLine = { productId: string; quantity: number };

const policyCopy: Record<PolicyKey, { title: string; body: string }> = {
  contact: {
    title: "Atendimento",
    body: "O canal de atendimento da Luniê será informado aqui antes da abertura da loja. Este conteúdo está pendente de revisão.",
  },
  privacy: {
    title: "Privacidade",
    body: "A política de privacidade está em preparação e será publicada após revisão dos canais, prazos de retenção e operadores de dados usados pela loja.",
  },
  returns: {
    title: "Trocas e devoluções",
    body: "As condições de troca e devolução ainda estão em revisão. Nenhum prazo ou condição foi presumido nesta versão.",
  },
  about: {
    title: "Sobre a Luniê",
    body: "A Luniê reúne cosméticos artesanais, autocuidado e perfumaria. Em breve, compartilharemos mais sobre a marca e seus processos.",
  },
};

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function readStoredCart(): StoredLine[] {
  try {
    const value = JSON.parse(localStorage.getItem("lunie-cart") ?? "[]") as StoredLine[];
    if (!Array.isArray(value)) return [];
    return value.filter((line) => typeof line.productId === "string" && Number.isInteger(line.quantity) && line.quantity > 0);
  } catch {
    return [];
  }
}

function PolicyDialog({ policy, onClose }: { policy: PolicyKey; onClose: () => void }) {
  const copy = policyCopy[policy];
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="policy-dialog" role="dialog" aria-modal="true" aria-labelledby="policy-title">
        <button className="dialog-close" onClick={onClose} aria-label="Fechar">×</button>
        <p className="eyebrow">Luniê</p>
        <h2 id="policy-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <span className="review-label">Conteúdo em revisão</span>
      </section>
    </div>
  );
}

type AddressDraft = {
  name: string;
  email: string;
  phone: string;
  document: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

function AccountDialog({ user, csrfToken, onClose }: { user: AuthUser; csrfToken: string; onClose: () => void }) {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [addresses, setAddresses] = useState<Record<string, unknown>[]>([]);
  const [notice, setNotice] = useState("Carregando seus pedidos…");
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>({
    name: user.name ?? "", email: user.email, phone: "", document: "", postal_code: "", street: "",
    number: "", complement: "", district: "", city: "", state: "",
  });

  useEffect(() => {
    apiRequest<Record<string, unknown>[]>("/account/orders")
      .then((rows) => {
        setOrders(rows);
        setNotice(rows.length ? "" : "Você ainda não tem pedidos.");
      })
      .catch(() => setNotice("Não foi possível carregar o histórico agora."));
    apiRequest<Record<string, unknown>[]>("/account/addresses")
      .then(setAddresses)
      .catch(() => undefined);
  }, []);

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    setNotice("");
    try {
      const saved = await apiRequest<Record<string, unknown>>("/account/addresses", {
        method: "POST",
        body: JSON.stringify(addressDraft),
      }, csrfToken);
      setAddresses((current) => [saved, ...current]);
      setAddressFormOpen(false);
      setNotice("Endereço salvo.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar o endereço.");
    } finally {
      setSavingAddress(false);
    }
  }

  function updateAddress(field: keyof AddressDraft, value: string) {
    setAddressDraft((current) => ({ ...current, [field]: value }));
  }

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" }, csrfToken);
      window.location.reload();
    } catch {
      setNotice("Não foi possível encerrar a sessão. Tente novamente.");
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="dialog-close" onClick={onClose} aria-label="Fechar conta">×</button>
        <p className="eyebrow">Sua conta</p>
        <h2 id="account-title">Olá, {user.name?.split(" ")[0] ?? "bem-vinda"}</h2>
        <p className="account-email">{user.email}</p>
        <h3>Seus pedidos</h3>
        {notice && <p className="status-note">{notice}</p>}
        {orders.map((order) => <div className="order-row" key={String(order.id)}><span>Pedido {String(order.id).slice(0, 8)}</span><span>{String(order.status)}</span></div>)}
        <div className="account-address-heading"><h3>Seus endereços</h3><button className="text-link" onClick={() => setAddressFormOpen((open) => !open)}>{addressFormOpen ? "Fechar" : "Adicionar endereço"}</button></div>
        {addresses.map((address) => <div className="saved-address" key={String(address.id)}><strong>{String(address.name)}</strong><span>{String(address.street)}, {String(address.number)} · {String(address.district)}</span><span>{String(address.city)} / {String(address.state)} · CEP {String(address.postal_code)}</span></div>)}
        {addressFormOpen && <form className="account-address-form" onSubmit={saveAddress}>
          <label>Nome completo<input required value={addressDraft.name} onChange={(event) => updateAddress("name", event.target.value)} /></label>
          <label>E-mail<input required type="email" value={addressDraft.email} onChange={(event) => updateAddress("email", event.target.value)} /></label>
          <label>Telefone com DDD<input required type="tel" value={addressDraft.phone} onChange={(event) => updateAddress("phone", event.target.value)} /></label>
          <label>CPF<input required inputMode="numeric" maxLength={14} value={addressDraft.document} onChange={(event) => updateAddress("document", event.target.value)} /></label>
          <label>CEP<input required inputMode="numeric" maxLength={9} value={addressDraft.postal_code} onChange={(event) => updateAddress("postal_code", event.target.value)} /></label>
          <label>Endereço<input required value={addressDraft.street} onChange={(event) => updateAddress("street", event.target.value)} /></label>
          <label>Número<input required value={addressDraft.number} onChange={(event) => updateAddress("number", event.target.value)} /></label>
          <label>Complemento<input value={addressDraft.complement} onChange={(event) => updateAddress("complement", event.target.value)} /></label>
          <label>Bairro<input required value={addressDraft.district} onChange={(event) => updateAddress("district", event.target.value)} /></label>
          <label>Cidade<input required value={addressDraft.city} onChange={(event) => updateAddress("city", event.target.value)} /></label>
          <label>UF<input required minLength={2} maxLength={2} value={addressDraft.state} onChange={(event) => updateAddress("state", event.target.value.toUpperCase())} /></label>
          <button className="button button-dark" disabled={savingAddress}>{savingAddress ? "Salvando…" : "Salvar endereço"}</button>
        </form>}
        <button className="text-link" onClick={logout}>Sair da conta</button>
      </section>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [sortBy, setSortBy] = useState("name-asc");
  const [search, setSearch] = useState("");
  const [storedLines, setStoredLines] = useState<StoredLine[]>(readStoredCart);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [policy, setPolicy] = useState<PolicyKey | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [toast, setToast] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    loadProducts()
      .then(setProducts)
      .catch(() => setCatalogNotice("O catálogo não pôde ser carregado. Atualize a página para tentar novamente."));
    apiRequest<{ status: string; google_login_configured: boolean }>("/health")
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
    apiRequest<{ user: AuthUser | null; csrf_token: string | null }>("/auth/me")
      .then((result) => {
        setUser(result.user);
        setCsrfToken(result.csrf_token ?? "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem("lunie-cart", JSON.stringify(storedLines));
  }, [storedLines]);

  useEffect(() => {
    if (products.length === 0) return;
    setStoredLines((current) => current.filter((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? isPurchasable(product) : false;
    }));
  }, [products]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProduct(null);
        setCartOpen(false);
        setCheckoutOpen(false);
        setPolicy(null);
        setAdminOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))], [products]);
  const cartLines = useMemo<CartLine[]>(() => storedLines.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  }), [products, storedLines]);
  const filteredProducts = useMemo(() => {
    const term = normalizeText(search.trim());
    const rows = products.filter((product) => {
      const categoryMatch = selectedCategory === "Todos" || product.category === selectedCategory;
      const textMatch = !term || normalizeText(`${product.name} ${product.category}`).includes(term);
      return categoryMatch && textMatch;
    });
    return rows.sort((left, right) => {
      if (sortBy === "name-desc") return right.name.localeCompare(left.name, "pt-BR");
      if (sortBy === "category") return left.category.localeCompare(right.category, "pt-BR") || left.name.localeCompare(right.name, "pt-BR");
      return left.name.localeCompare(right.name, "pt-BR");
    });
  }, [products, search, selectedCategory, sortBy]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }

  function addToCart(product: Product, quantity = 1) {
    if (!isPurchasable(product)) {
      showToast("Este produto só poderá ser comprado após o cadastro de preço e estoque.");
      return;
    }
    setStoredLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      const nextQuantity = Math.min(product.stock ?? 1, (existing?.quantity ?? 0) + quantity);
      if (existing) return current.map((line) => line.productId === product.id ? { ...line, quantity: nextQuantity } : line);
      return [...current, { productId: product.id, quantity: Math.min(quantity, product.stock ?? 1) }];
    });
    setSelectedProduct(null);
    setCartOpen(true);
    showToast(`${product.name} adicionado à sacola.`);
  }

  function changeQuantity(productId: string, delta: number) {
    const product = products.find((item) => item.id === productId);
    setStoredLines((current) => current.flatMap((line) => {
      if (line.productId !== productId) return [line];
      const quantity = line.quantity + delta;
      if (quantity < 1) return [];
      return [{ ...line, quantity: Math.min(quantity, product?.stock ?? quantity) }];
    }));
  }

  function refreshCatalog() {
    loadProducts().then(setProducts).catch(() => showToast("Não foi possível atualizar o catálogo."));
  }

  async function startGoogleLogin() {
    try {
      const health = await apiRequest<{ google_login_configured: boolean }>("/health");
      if (!health.google_login_configured) {
        showToast("O login Google ficará disponível após configurar as credenciais da loja.");
        return;
      }
      window.location.assign(`${apiBaseUrl()}/api/auth/google`);
    } catch {
      showToast("A conta será habilitada quando a API da loja estiver conectada.");
    }
  }

  function chooseCategory(category: string) {
    setSelectedCategory(category);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const heroProduct = products.find((product) => product.id.includes("sabonete-lavanda")) ?? products[0];
  const featuredCategories = categories.slice(0, 4);
  const subtotal = cartSubtotalCents(cartLines);

  return (
    <div className="min-h-screen bg-ivory text-graphite">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <div className="announcement-bar"><span>Um convite para desacelerar</span><span className="announcement-dot" aria-hidden="true">✳</span><span>Cosméticos artesanais · Luniê</span></div>
      <header className="site-header">
        <div className="header-inner mx-auto flex max-w-7xl items-center justify-between px-5">
          <button className="menu-toggle" aria-label="Ir para início" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src="/brand/logo-original-small.jpg" alt="Luniê" />
          </button>
          <nav className="main-nav" aria-label="Navegação principal">
            <a href="#categorias">Coleções</a><a href="#catalogo">Produtos</a><a href="#sobre">Nossa essência</a>
          </nav>
          <div className="header-actions">
            <label className="header-search"><span className="sr-only">Buscar produtos</span><input type="search" placeholder="O que você procura?" value={search} onChange={(event) => setSearch(event.target.value)} /><span aria-hidden="true">⌕</span></label>
            <button className="header-icon" onClick={() => user ? setAccountOpen(true) : startGoogleLogin()} aria-label={user ? "Abrir minha conta" : "Entrar na conta"}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c.5-3.4 3-5.2 7-5.2s6.5 1.8 7 5.2" /></svg>
            </button>
            <button className="header-icon cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Abrir sacola com ${cartCount(cartLines)} itens`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>
              <span className="cart-count">{cartCount(cartLines)}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className="hero-section mx-auto grid max-w-7xl items-center gap-12 px-5">
          <div className="hero-copy">
            <p className="eyebrow">Autocuidado com intenção</p>
            <h1>Volte para si.<br /><em>Um ritual de cada vez.</em></h1>
            <p className="hero-lede">Cosméticos artesanais, aromas e pequenos gestos para criar espaço para você na rotina.</p>
            <a className="button button-dark" href="#catalogo">Descobrir a coleção <span aria-hidden="true">↗</span></a>
            <div className="hero-signature"><span className="signature-line" /><span>Feito para o seu cotidiano</span></div>
          </div>
          <div className="hero-art" aria-label="Fotografia de produto Luniê">
            {heroProduct ? <img src={heroProduct.image} alt={`${heroProduct.name}, fotografia original do catálogo Luniê`} /> : <img src="/brand/logo-original.jpg" alt="Logo Luniê" />}
            <div className="hero-caption"><span className="hero-caption-mark" aria-hidden="true">✳</span><span>O cuidado mora<br />nos detalhes.</span></div>
            <span className="hero-art-index">01 / LUNIÊ</span>
          </div>
          <div className="hero-side-note" aria-hidden="true">CUIDAR · SENTIR · RESPIRAR</div>
        </section>

        <section className="category-section" id="categorias">
          <div className="section-heading mx-auto max-w-7xl px-5">
            <div><p className="eyebrow">Encontre seu momento</p><h2>Pequenas pausas,<br /><em>grandes presenças.</em></h2></div>
            <p className="section-aside">Explore as criações Luniê<br />e encontre seu próximo ritual.</p>
          </div>
          <div className="category-grid mx-auto max-w-7xl px-5">
            {featuredCategories.map((category, index) => {
              const product = products.find((item) => item.category === category);
              return <button className={`category-tile category-tile-${index + 1}`} key={category} onClick={() => chooseCategory(category)}>
                {product && <img src={product.image} alt="" loading="lazy" />}
                <span className="category-shade" />
                <span className="category-copy"><small>0{index + 1} / LUNIÊ</small><strong>{category}</strong><span>Explorar <b aria-hidden="true">↗</b></span></span>
              </button>;
            })}
          </div>
        </section>

        <section className="catalog-section mx-auto max-w-7xl px-5" id="catalogo">
          <div className="catalog-topline"><div><p className="eyebrow">A coleção</p><h2>Feito para <em>sentir.</em></h2></div><span className="catalog-count">{filteredProducts.length.toString().padStart(2, "0")} produtos</span></div>
          <div className="catalog-toolbar">
            <div className="category-filters" aria-label="Filtrar por categoria">
              <button className={selectedCategory === "Todos" ? "filter-pill active" : "filter-pill"} onClick={() => setSelectedCategory("Todos")}>Todos</button>
              {categories.map((category) => <button className={selectedCategory === category ? "filter-pill active" : "filter-pill"} key={category} onClick={() => setSelectedCategory(category)}>{category}</button>)}
            </div>
            <label className="sort-control"><span>Ordenar por</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name-asc">Nome: A–Z</option><option value="name-desc">Nome: Z–A</option><option value="category">Categoria</option></select></label>
          </div>
          {catalogNotice && <p className="form-notice" role="alert">{catalogNotice}</p>}
          {filteredProducts.length ? <div className="product-grid">{filteredProducts.map((product) => <ProductCard product={product} onOpen={setSelectedProduct} key={product.id} />)}</div> : <div className="empty-catalog"><span aria-hidden="true">✳</span><h3>{search ? "Nenhum produto encontrado" : "A coleção está sendo preparada."}</h3><p>{search ? "Tente buscar por outro nome ou categoria." : "Os produtos aparecerão aqui assim que o catálogo for carregado."}</p></div>}
          <p className="catalog-note">Preços, estoque e informações técnicas serão exibidos após o cadastro e a revisão de cada produto.</p>
        </section>

        <section className="brand-story" id="sobre">
          <div className="story-image"><img src="/brand/logo-original.jpg" alt="Logo original da marca Luniê" loading="lazy" /></div>
          <div className="story-copy"><p className="eyebrow">Nossa essência</p><h2>Seu tempo.<br /><em>Seu jeito de cuidar.</em></h2><p>A Luniê nasceu do desejo de tornar o autocuidado mais presente, leve e cheio de significado. Cada criação abre espaço para uma pausa no meio do dia.</p><button className="text-link" onClick={() => setPolicy("about")}>Conheça a Luniê <span aria-hidden="true">↗</span></button><span className="story-flower" aria-hidden="true">✳</span></div>
        </section>

        <section className="values-strip"><div><span className="value-mark">✳</span><p>Tempo para você</p></div><div><span className="value-mark">✳</span><p>Feito à mão</p></div><div><span className="value-mark">✳</span><p>Pequenos rituais</p></div></section>
      </main>

      <footer className="site-footer">
        <div className="footer-main mx-auto max-w-7xl px-5">
          <div className="footer-brand"><img src="/brand/logo-original-small.jpg" alt="Luniê" /><p>Um convite para voltar<br />para si.</p></div>
          <div className="footer-column"><h2>Explore</h2><a href="#categorias">Coleções</a><a href="#catalogo">Produtos</a><button onClick={() => setPolicy("about")}>Nossa essência</button></div>
          <div className="footer-column"><h2>Ajuda</h2><button onClick={() => setPolicy("contact")}>Atendimento</button><button onClick={() => setPolicy("returns")}>Trocas e devoluções</button><button onClick={() => setPolicy("privacy")}>Privacidade</button></div>
          <div className="footer-note"><p className="eyebrow">Um espaço para respirar.</p><span>Autocuidado, no seu tempo.</span></div>
        </div>
        <div className="footer-bottom mx-auto max-w-7xl px-5"><span>© {new Date().getFullYear()} Luniê</span><button onClick={() => setAdminOpen(true)}>Área administrativa</button><span>Conteúdo institucional em revisão</span></div>
      </footer>

      {selectedProduct && <ProductDialog product={selectedProduct} csrfToken={csrfToken} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />}
      {cartOpen && <CartDrawer lines={cartLines} csrfToken={csrfToken} onClose={() => setCartOpen(false)} onRemove={(id) => setStoredLines((current) => current.filter((line) => line.productId !== id))} onQuantity={changeQuantity} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
      {checkoutOpen && <CheckoutDialog lines={cartLines} csrfToken={csrfToken} onClose={() => setCheckoutOpen(false)} />}
      {policy && <PolicyDialog policy={policy} onClose={() => setPolicy(null)} />}
      {adminOpen && <AdminPanel csrfToken={csrfToken} onClose={() => setAdminOpen(false)} onSaved={refreshCatalog} />}
      {accountOpen && user && <AccountDialog user={user} csrfToken={csrfToken} onClose={() => setAccountOpen(false)} />}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      {apiOnline && subtotal > 0 && <span className="sr-only">Subtotal atual: {formatBRL(subtotal)}</span>}
    </div>
  );
}
