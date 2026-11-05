import { test, expect, TestInfo } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';
import { ADMIN, KathflixApi } from '../api_helper/kathflix_api';

const SENHA = 'Senha123'

// Só os cenários listados aqui (pelo nome do teste) precisam de um usuário criado pela API.
// Os outros (senha errada, e-mail vazio, esqueci a senha...) não fazem login com sucesso, então não criam nada.
const CENARIOS_COM_USUARIO = ['login com sucesso']

let loginPage: LoginPage
let homePage: HomePage
const api = new KathflixApi()
let prefixo: string
let emailUsuario: string

function precisaDeUsuario(testInfo: TestInfo): boolean {
    return CENARIOS_COM_USUARIO.some((nome) => testInfo.title.includes(nome))
}

test.beforeEach(async ({page}, testInfo) => {
    loginPage = new LoginPage(page)
    homePage = new HomePage(page)

    // Arrange (via API), condicional: cada teste é independente e cria só o que usa.
    // O prefixo é único por teste, então testes em paralelo não apagam os dados uns dos outros.
    if (precisaDeUsuario(testInfo)) {
        prefixo = `autologin-${Date.now()}-${testInfo.workerIndex}-`
        emailUsuario = await api.criarUsuario(prefixo, SENHA)
    }

    // Arrange (tela)
    await loginPage.acessarSite()
})

test.afterEach(async ({}, testInfo) => {
    // Teardown (via API): remove o usuário, só nos cenários que o criaram (mesmo IF do beforeEach)
    if (precisaDeUsuario(testInfo)) {
        await api.limparPorPrefixo(prefixo)
    }
})

test('login com sucesso', async({page}) => {
    // Act
    await loginPage.login(emailUsuario, SENHA)
    // Assert
    await expect(page).toHaveURL(/home.html/)
    await expect(homePage.username).toHaveText('Usuario Automacao')
})

test('tentativa de login com senha errada', async() => {
    // Act (o admin do seed sempre existe, então não precisa criar usuário)
    await loginPage.login(ADMIN.email, 'SenhaErrada')
    // Assert
    await expect(loginPage.error).toHaveText('E-mail ou senha inválidos')
})

test('tentativa de login com user errado', async() => {
    await loginPage.login('naoexiste@kathflix.com', SENHA)
    await expect(loginPage.error).toHaveText('E-mail ou senha inválidos')
})

test('tentativa de login sem e-mail', async() => {
    await loginPage.login('', SENHA)
    await expect(loginPage.error).toHaveText('Informe e-mail e senha')
})

test('tentativa de login sem password', async() => {
    await loginPage.login(ADMIN.email, '')
    await expect(loginPage.error).toHaveText('Informe e-mail e senha')
})

test('esqueci a senha sem e-mail deve pedir o e-mail', async() => {
    // Act
    await loginPage.esqueciASenha()
    // Assert
    await expect(loginPage.error).toBeVisible()
    await expect(loginPage.error).toHaveText('Informe seu e-mail para recuperar a senha')
})
