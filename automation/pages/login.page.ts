import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {

    readonly page: Page
    readonly alert: Locator
    readonly userName = '#user-name'

    constructor(page: Page) {
        this.page = page
        this.alert = page.getByRole('alert')
    }


    async acessarSite() {
        await this.page.goto('https://www.saucedemo.com/');
        // checkpoint
        await expect(this.page).toHaveTitle("Swag Labs");
    }

    async login(email: string, password: string) {
        // digitar o email
        await this.page.locator(this.userName).fill(email)
        // digitar a senha
        await this.page.getByLabel('Password').fill(password)
        // clicar no botão de login
        await this.page.getByRole('button', { name: 'Login' }).click()
    }


}