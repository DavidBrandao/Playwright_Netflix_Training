import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';
import { LuckyCatPopup } from '../pages/lucky-cat.page';
import { KathflixApi } from '../api_helper/kathflix_api';

// Prefixo único por worker: o cleanup do afterAll só apaga o que este arquivo criou.
const PREFIXO = `autologin-${Date.now()}-`
const SENHA = 'Senha123'

let loginPage: LoginPage
let homePage: HomePage
let gato: LuckyCatPopup
let api: KathflixApi
let emailUsuario: string

test.beforeAll(async () => {
    // Arrange (via API): cria o usuário usado nos testes
    api = new KathflixApi()
    emailUsuario = await api.criarUsuario(PREFIXO, SENHA)
})

test.afterAll(async () => {
    // Teardown (via API): remove o que foi criado
    await api.limparPorPrefixo(PREFIXO)
})

test.beforeEach(async ({page}) => {
    loginPage = new LoginPage(page)
    homePage = new HomePage(page)
    gato = new LuckyCatPopup(page)
    // Arrange
    await loginPage.acessarSite()
})

test('login com sucesso', async({page}) => {
    // Act
    await loginPage.login(emailUsuario, SENHA)
    // Assert
    await expect(page).toHaveURL(/home.html/)
    await expect(homePage.username).toHaveText('Usuario Automacao')
})

test('tentativa de login com senha errada', async() => {
    // Act
    await loginPage.login(emailUsuario, 'SenhaErrada')
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
    await loginPage.login(emailUsuario, '')
    await expect(loginPage.error).toHaveText('Informe e-mail e senha')
})

test('bug 1: "Esqueci a senha" sem e-mail mostra o gato da sorte', async({}, testInfo) => {
    // Act
    await loginPage.esqueciASenha()
    // Assert
    await expect(gato.popup).toBeVisible()
    expect(await gato.imagemCarregada()).toBe(true)
    await expect(gato.text).toHaveText('Você encontrou um bug gato da sorte.')
    await expect(gato.strikethrough).toHaveText('bug')
    await expect(gato.remaining).toHaveText('Você achou o gato 1, faltam 2')
    // guarda a imagem do gato no relatório
    await testInfo.attach('gato-da-sorte-1', { body: await gato.image.screenshot(), contentType: 'image/png' })
})
