import { Page, Locator } from "@playwright/test";

export class HomePage {

    readonly page: Page
    readonly username: Locator
    readonly logoutButton: Locator
    readonly catsCount: Locator

    constructor(page: Page) {
        this.page = page
        this.username = page.getByTestId('nav-username')
        this.logoutButton = page.getByTestId('nav-logout')
        this.catsCount = page.getByTestId('nav-cats-count')
    }

}
