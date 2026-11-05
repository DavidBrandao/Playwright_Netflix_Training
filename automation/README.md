# Automação (Playwright) do KathFlix

Testes de interface do KathFlix com Playwright + TypeScript, usando Page Objects e uma camada de API para setup e teardown.

## Como rodar
O KathFlix precisa estar no ar em `http://localhost:3000`. Se não estiver, o Playwright sobe sozinho (`npm start` dentro de `../kathflix`) e reaproveita o que já estiver rodando.

    cd automation
    npm install
    npx playwright install chromium
    npm test

Outros comandos:

    npx playwright test tests/login.spec.ts
    npx playwright test --headed
    npm run report

Para apontar para outra URL, use a variável `KATHFLIX_URL` (padrão `http://localhost:3000`). No PowerShell:

    $env:KATHFLIX_URL = "http://localhost:3100"
    npm test

## Estrutura
| Pasta / arquivo | O que tem |
|---|---|
| `tests/login.spec.ts` | Testes de login, incluindo o do "esqueci a senha", que falha de propósito (a tela tem um bug escondido). Serve de modelo de estilo. |
| `pages/` | Page Objects: `login.page.ts` e `home.page.ts`. |
| `api_helper/common_api.ts` | `ApiBase`: métodos base `get`, `post`, `put` e `delete` (URL, token, JSON e erro `ApiError`). |
| `api_helper/kathflix_api.ts` | `KathflixApi`: chamadas da API do KathFlix em cima do `ApiBase` (login, criar usuário, limpar por prefixo, títulos). |
| `playwright.config.ts` | `baseURL`, screenshot em falha, servidor web e projetos. |
| `testasync.ts` | Exemplo solto de `async/await`. |

## Estilo dos testes
- Os Page Objects são variáveis no topo do arquivo (`let loginPage: LoginPage`) e criados no `beforeEach`.
- Os testes só chamam métodos e locators da page (`loginPage.login(...)`, `loginPage.error`).
- Setup e teardown de dados vão em `beforeEach`/`afterEach` pela API, sem passar pela tela, e **só nos cenários que precisam** (cada teste é independente).
- Os testes seguem Arrange, Act, Assert (comentários no código).

Exemplo do `login.spec.ts`: só o teste `login com sucesso` precisa de usuário, então o nome do teste é checado com um `if`:

    const CENARIOS_COM_USUARIO = ['login com sucesso']
    const precisaDeUsuario = (testInfo) => CENARIOS_COM_USUARIO.some((nome) => testInfo.title.includes(nome))

    test.beforeEach(async ({page}, testInfo) => {
        if (precisaDeUsuario(testInfo)) {
            prefixo = `autologin-${Date.now()}-${testInfo.workerIndex}-`
            emailUsuario = await api.criarUsuario(prefixo, SENHA)   // cria pela API
        }
        await loginPage.acessarSite()
    })
    test.afterEach(async ({}, testInfo) => {
        if (precisaDeUsuario(testInfo)) await api.limparPorPrefixo(prefixo)   // remove pela API
    })

O prefixo é único por teste, então testes em paralelo não apagam os dados uns dos outros. Para um novo cenário que precise de usuário, é só incluir parte do nome dele em `CENARIOS_COM_USUARIO`.

## Screenshot em falha
O `playwright.config.ts` tem `screenshot: 'only-on-failure'`. Quando um teste falha, a imagem vai para o relatório HTML (`npm run report`) e para a pasta `test-results/`.

## Como criar um teste novo
1. Crie ou reaproveite um Page Object em `pages/` (prefira `getByTestId`, `getByRole`, `getByLabel`).
2. Se precisar de dados, adicione um método em `api_helper/kathflix_api.ts` (e, se for uma chamada nova de HTTP, use `this.get/post/put/delete`).
3. Crie `tests/<nome>.spec.ts` no mesmo formato do `login.spec.ts`.

Alguns elementos do KathFlix são difíceis de propósito (ids repetidos, modal, iframe...). A lista está em `../kathflix/README.md`.
