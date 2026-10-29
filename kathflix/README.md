# KathFlix

App estilo Netflix para treinos de automação. Tudo que a tela faz também é possível via API (setup/teardown com hooks).

## Como subir
    cd kathflix
    npm install
    npm start

- App: http://localhost:3000
- Swagger (API): http://localhost:3000/api-docs
- Requer Node 22.13+ (usa `node:sqlite`; desenvolvido com Node 24). O aviso "ExperimentalWarning: SQLite" é esperado.

Variáveis: `PORT` (3000), `KATHFLIX_DB` (arquivo SQLite; `:memory:` para base descartável), `KATHFLIX_TEST_API=off` (desliga `/api/test/*`), `KATHFLIX_URL` (usada só pelo exemplo `examples/api-client.ts`, padrão `http://localhost:3000`).

## Usuários do seed
| Papel | E-mail | Senha |
|---|---|---|
| admin | admin@kathflix.com | admin123 |
| user | user@kathflix.com | user123 |

## Telas
`/login.html`, `/register.html`, `/home.html`, `/watch.html?id=`, `/profile.html`, `/cats.html` (Gatos da Sorte), `/admin.html` (só admin).

Dica: `/login.html?alerts=off` desliga o alert nativo e o banner pós-login (`?alerts=on` religa).

## Para a turma
- Elementos têm `data-testid` e `id` estáveis (`getByTestId`, `getByRole`, `getByLabel`).
- Desafios propositais: `id="remove-btn"` repetido nas tabelas do admin, `id="fav-toggle"` repetido nos cards (só CSS/XPath), banner de destaque e rodapé sem `data-testid`, skeleton de carregamento, modal de confirmação, iframe do YouTube, dropdowns, alert nativo e banner pós-login.

## Gatos da Sorte
Há 5 bugs escondidos na aplicação. Cada um mostra um gato na frente de tudo (com X para fechar); cada papel tem os seus gatos (usuário: `0/3`; admin: `0/2`), o progresso aparece no menu, fica salvo por usuário e a tela **Gatos da Sorte** mostra quadrados pretos até o gato ser encontrado. Ao achar todos os gatos do seu papel, aparece a comemoração com confete. O gabarito para o professor está em `../docs/gabarito-gatos-da-sorte.md`.
- `?bugs=off` na URL desliga os gatos (`?bugs=on` religa).
- API: `GET/DELETE /api/me/cats` e `POST /api/me/cats/{n}` (veja o Swagger). `DELETE` zera a coleção do usuário logado, útil no teardown.

## Regras de validação
- Capa por upload: apenas `.png`, `.jpg`, `.jpeg`, `.gif` ou `.webp`, até 2 MB.
- `year` entre 1888 e 2100.
- Links de vídeo precisam ser links válidos do YouTube.

## API para setup e teardown
- Documentação: Swagger em `/api-docs` e coleção Postman em `postman/`.
- Exemplo em TypeScript: `examples/api-client.ts` (`seed`, `cleanup`, `reset`, login, criação de títulos e usuários).
- Rotas `/api/test/*` não exigem token:
  - `reset`: volta o banco ao estado inicial.
  - `seed`: cria usuários e títulos em lote; é atômico (tudo ou nada).
  - `cleanup`: remove por prefixo; o prefixo precisa ter pelo menos 3 caracteres (sem contar `%` e `_`).

## Testes da API
    npm test

## Aviso
App de treino: senhas com hash, mas sem HTTPS, sem rate limit e com rotas de teste abertas. Não use em produção.
