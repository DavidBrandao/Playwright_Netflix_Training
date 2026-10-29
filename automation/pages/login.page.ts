import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {

    readonly page: Page
    readonly email: Locator
    readonly password: Locator
    readonly submit: Locator
    readonly error: Locator
    readonly forgotLink: Locator
    readonly info: Locator

    constructor(page: Page) {
        this.page = page
        this.email = page.getByTestId('login-email')
        this.password = page.getByTestId('login-password')
        this.submit = page.getByTestId('login-submit')
        this.error = page.getByTestId('login-error')
        this.forgotLink = page.getByTestId('login-forgot')
        this.info = page.getByTestId('login-info')
    }

    async acessarSite() {
        // alerts=off: o alert nativo de boas-vindas não é o foco dos testes de login
        await this.page.goto('/login.html?alerts=off')
        // checkpoint
        await expect(this.page).toHaveTitle('KathFlix - Entrar')
    }

    async login(email: string, password: string) {
        // digitar o email
        await this.email.fill(email)
        // digitar a senha
        await this.password.fill(password)
        // clicar no botão de login
        await this.submit.click()
    }

    async esqueciASenha() {
        await this.forgotLink.click()
    }

}
