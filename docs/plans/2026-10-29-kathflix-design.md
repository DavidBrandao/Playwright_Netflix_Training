# KathFlix: design

Data: 2026-10-29

## Objetivo

Criar o **KathFlix**, uma app estilo Netflix (frontend + API) para a professora Kath usar em treinamentos de automação com Playwright. Tudo que a tela faz também pode ser feito via API, permitindo setup e teardown por hooks. O código de automação atual (saucedemo) fica como **exemplo** de estilo.

## Decisões

| Tema | Decisão |
|---|---|
| Stack | Node + Express, frontend em HTML/CSS/JS puro (sem build) |
| Persistência | SQLite em arquivo (`better-sqlite3`) |
| Acesso | Login + cadastro público; papéis `user` e `admin` |
| Autenticação | Token Bearer (tabela `sessions`), guardado no `localStorage` no frontend |
| Repositório | Raiz = `Modulo2/scripts`; remoto `https://github.com/DavidBrandao/Playwright_Netflix_Training.git` |
| Documentação da API | Swagger UI + OpenAPI 3 em `/api-docs` |

## 1. Estrutura do repositório

```
scripts/                         <- raiz do git
├── README.md
├── docs/plans/                  <- este documento
├── automation/                  <- código atual movido, sem alterações (EXEMPLO)
│   ├── api_helper/ pages/ tests/ playwright.config.ts package.json ...
└── kathflix/
    ├── package.json             (express, better-sqlite3, multer, bcryptjs, swagger-ui-express, yaml)
    ├── server.js                <- sobe API + serve o frontend
    ├── openapi.yaml             <- especificação da API (fonte do Swagger)
    ├── src/
    │   ├── db.js                <- SQLite + schema + seed
    │   ├── routes/              <- auth, users, titles, favorites, admin, test
    │   └── middleware/          <- auth (token), requireAdmin, erros
    ├── public/                  <- frontend
    │   ├── login.html register.html home.html
    │   ├── watch.html profile.html admin.html
    │   └── js/ css/ uploads/
    ├── postman/KathFlix.postman_collection.json
    ├── examples/api-client.ts   <- hooks de setup/teardown para Playwright
    ├── test/                    <- testes da API (node:test)
    └── data/kathflix.db         <- ignorado no git
```

- Um único processo (`npm start`) serve a API em `/api/*`, as telas em `/` e o Swagger em `/api-docs` (porta 3000).
- `automation/` continua apontando para o saucedemo; adaptá-lo ao KathFlix fica como exercício para a turma.

## 2. Modelo de dados

| Tabela | Campos principais |
|---|---|
| `users` | id, name, email (único), password_hash, role (`user`/`admin`), bio, avatar_url, created_at |
| `titles` | id, type (`movie`/`series`), title, description, year, genre, cover_url, video_url (filme), is_new, created_at |
| `episodes` | id, title_id, season, number, name, video_url |
| `favorites` | user_id, title_id |
| `sessions` | token, user_id, last_seen_at |

Filme tem um `video_url` do YouTube. Série tem N episódios, cada um com seu link. A tela de assistir converte o link em embed (`youtube.com/embed/ID`).

**Usuário ativo:** quem tem sessão com atividade nos últimos 30 minutos.

**Seed (primeira subida):** 1 admin, 1 usuário comum e alguns títulos de exemplo. Credenciais documentadas no README.

## 3. API

Erros sempre no formato `{ "error": "mensagem" }`, com status HTTP corretos (400, 401, 403, 404, 409). Auth por header `Authorization: Bearer <token>`.

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- **Catálogo:** `GET /api/titles` (filtros `q`, `genre`, `new`, `sort`), `GET /api/titles/:id` (série com episódios)
- **Favoritos:** `GET /api/favorites`, `POST /api/favorites/:titleId`, `DELETE /api/favorites/:titleId`
- **Perfil:** `GET /api/me`, `PUT /api/me` (nome, e-mail, bio, senha, avatar), `DELETE /api/me`
- **Admin** (`role=admin`):
  - `POST /api/admin/titles`: aceita `multipart/form-data` (arquivo `cover`) **ou** JSON com `cover_url`. Filme: `type=movie` + `video_url`. Série: `type=series` + `episodes` (lista de `{season, number, name, video_url}`).
  - `DELETE /api/admin/titles/:id`
  - `GET /api/admin/users` (usuários ativos), `POST /api/admin/users` (define o papel), `DELETE /api/admin/users/:id`
- **Apoio a testes** (`/api/test/*`, desligável com `KATHFLIX_TEST_API=off`; `seed` e `cleanup` aceitam JSON sem token de admin):
  - `POST /api/test/reset` (volta ao seed)
  - `POST /api/test/seed` (cria usuários e títulos em lote)
  - `DELETE /api/test/cleanup` (remove tudo criado por um prefixo)

### Documentação Swagger

- A especificação OpenAPI 3 fica em `kathflix/openapi.yaml`; `swagger-ui-express` serve a interface em `http://localhost:3000/api-docs` e o YAML cru em `/api-docs/openapi.yaml`.
- Cobre: como subir a app, como autenticar (esquema `bearerAuth` com botão **Authorize** na UI), todos os endpoints, body de entrada com exemplos, respostas esperadas por status (inclusive erros) e exemplo de `multipart` para criar filme/série.
- Há um passo a passo curto no topo (`info.description`): subir a app, chamar `POST /api/auth/login`, copiar o `token`, clicar em **Authorize**, testar um endpoint.
- Uma verificação nos testes da API garante que todo endpoint real existe no `openapi.yaml`, para a doc não ficar defasada.

### Postman

`kathflix/postman/KathFlix.postman_collection.json` traz as chamadas prontas, com `{{baseUrl}}` e `{{token}}` preenchido automaticamente por script de teste após o login.

## 4. Telas

| Tela | Conteúdo |
|---|---|
| `login.html` | e-mail, senha, entrar, link de cadastro, mensagem de erro inline (`role="alert"`) |
| `register.html` | nome, e-mail, senha, confirmar senha, validações inline |
| `home.html` | navbar, banner de destaque, carrosséis **Novidades**, **Catálogo**, **Meus Favoritos**; busca, dropdown de categoria e de ordenação |
| `watch.html` | player do YouTube (iframe), detalhes, favoritar; em série, lista de episódios que troca o vídeo |
| `profile.html` | editar nome, e-mail, bio, senha e avatar, botão **Salvar** com mensagem de sucesso |
| `admin.html` | abas **Filmes** (adicionar/remover) e **Usuários** (listar ativos/remover) |

**Dropdowns (`<select>`):** categoria (Todas, Ação, Comédia, Drama, Terror, Ficção, Animação, Documentário) na home e no admin; tipo (Filme/Série) no cadastro de título, que alterna entre link único e lista de episódios; ordenação (Mais recentes, A-Z, Ano).

**Alerts (somente pós-login):**
1. `window.alert` nativo: "Bem-vindo ao KathFlix, {nome}!" (treina `page.on('dialog')`).
2. Banner customizado na home: "Novo episódio disponível! Deseja ver agora?" com **Ver agora**, **Dispensar** e **X**.
- `?alerts=off` ou `localStorage` `kathflix.alerts=off` desliga ambos.

## 5. Design automation friendly

Padrão geral limpo: `data-testid` e `id` estáveis (`login-email`, `login-submit`, `title-card-{id}`, `admin-add-title`), `label` associado aos campos, botões com texto acessível, `role="alert"` em mensagens.

**Dificuldades pontuais (só estas):**
- IDs duplicados: `id="remove-btn"` em cada linha das tabelas do admin e `id="fav-toggle"` nos cards. Só CSS/XPath resolve.
- Sem `data-testid`: banner de destaque e rodapé.
- Skeleton de carregamento nos carrosséis da home.
- Modal customizado de confirmação na remoção de filme/usuário.
- iframe do YouTube (`frameLocator`).

**Visual:** tema escuro vermelho/preto, CSS puro, responsivo, logo "KATHFLIX" em texto.

## 6. Testes, erros e entrega

- **Testes da API:** `node:test` + `fetch`, sem dependências extras (auth, permissões, CRUD de títulos, favoritos, reset, cobertura do OpenAPI).
- **Hooks de exemplo:** `kathflix/examples/api-client.ts` mostra setup e teardown via API para `beforeEach`/`afterEach` do Playwright.
- **Erros:** middleware central devolve `{ error }`; a tela exibe em `role="alert"`. Upload de até 2 MB, somente imagens.
- **Segurança:** app de treino. Senhas com hash (bcrypt), sem HTTPS nem rate limit; o README deixa isso claro.
- **README:** como subir, credenciais do seed, endpoints, link do Swagger e do Postman.
- **Commits:** (1) mover código para `automation/`, (2) backend + Swagger, (3) frontend, (4) testes, Postman, exemplos e docs; depois push ao remoto.
