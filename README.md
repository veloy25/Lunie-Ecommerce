# Luniê

Loja virtual da Luniê, com catálogo criado a partir das fotos fornecidas, carrinho persistente, conta Google, painel de catálogo, checkout Mercado Pago, cálculo de frete Melhor Envio e acompanhamento por webhooks.

Os arquivos recebidos não informavam preços, estoque, peso, dimensões ou descrições aprovadas. Esses campos ficam vazios e os produtos não podem ser comprados até que uma pessoa administradora cadastre dados reais. A loja não inventa preço, disponibilidade ou informação técnica.

## Ambientes e promoção

O fluxo do repositório é `dev → homolog → main`:

| Branch | Ambiente | Uso |
| --- | --- | --- |
| `dev` | Desenvolvimento | Trabalho diário; simulação de frete local opcional. |
| `homolog` | Homologação | Testes integrados; Mercado Pago de teste e Melhor Envio sandbox. |
| `main` | Produção | Loja real; provedores ao vivo e credenciais de produção. |

Promova mudanças por pull request de `dev` para `homolog` e depois de `homolog` para `main`. O GitHub Actions roda build e testes nas três branches. Não coloque credenciais nesses arquivos: `environments/*.env.example` contém somente nomes e valores de referência; configure segredos no ambiente correspondente do provedor de hospedagem/GitHub.

## Executar localmente

Requisitos: Node.js 22 LTS, Python 3.12 e Docker Compose.

```sh
cp environments/dev.env.example .env
docker compose up --build
```

Abra `http://localhost:5173`; a API fica em `http://localhost:8000` e a documentação técnica em `/docs`. Para executar sem Docker, instale os pacotes com `npm install --prefix Client/client --legacy-peer-deps`, crie `Server/.venv` com Python 3.12 e instale `Server/requirements.txt`; então use `npm run dev` e `npm run api` em terminais separados.

Comandos de qualidade:

```sh
npm run build
npm run test:frontend
npm run test:backend
```

O backend aplica as migrações Alembic ao iniciar o container. Localmente, `npm run migrate` aplica as migrações manualmente. Para dados pessoais fora de desenvolvimento, gere uma chave Fernet com `Server/.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'` e forneça-a por `PII_ENCRYPTION_KEY`; use um `SESSION_SECRET` aleatório e mantenha ambos fora do Git.

## Configuração para abrir a loja

1. Cadastre no painel administrativo os preços e estoques confirmados. Preencha peso e dimensões reais para cotar o Melhor Envio.
2. Configure Google OAuth, Mercado Pago, Melhor Envio, URLs de callback/webhook, `ADMIN_EMAILS`, banco PostgreSQL e chaves de sessão/criptografia para cada ambiente.
3. Em homologação, use credenciais de teste e o ambiente sandbox; valide login, cotação, pagamento, webhooks e etiqueta antes de promover para `main`.
4. Preencha e revise as políticas, os contatos e as informações comerciais antes de atender pedidos reais.

## Estrutura

```text
Client/client/       React + TypeScript + Vite + Tailwind
Server/app/          FastAPI, domínio, casos de uso e adaptadores externos
Server/migrations/   Migrações Alembic
Server/tests/        Testes de domínio e catálogo
catalog/             Manifesto de produtos recebidos
environments/        Modelos de variáveis por ambiente (sem segredos)
```

O frontend está hospedado como Site privado para revisão. O serviço Sites serve arquivos estáticos; para operar pagamentos, login e frete, hospede a API e o PostgreSQL separadamente e configure `VITE_API_URL` com o endereço público da API.
