import { Page, Locator } from "@playwright/test";

export class Navbar{

    readonly page: Page
    readonly cartButton: Locator

    constructor(page: Page) {
        this.page = page
        this.cartButton = page.locator('a[class="shopping_cart_link"]')
    }

}