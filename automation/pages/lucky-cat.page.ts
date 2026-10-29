import { Page, Locator, expect } from "@playwright/test";

// Popup do "gato da sorte" que aparece quando um bug escondido é encontrado.
export class LuckyCatPopup {

    readonly page: Page
    readonly popup: Locator
    readonly image: Locator
    readonly text: Locator
    readonly strikethrough: Locator
    readonly remaining: Locator
    readonly closeButton: Locator

    constructor(page: Page) {
        this.page = page
        this.popup = page.getByTestId('lucky-cat-popup')
        this.image = page.getByTestId('lucky-cat-img')
        this.text = page.getByTestId('lucky-cat-text')
        this.strikethrough = this.text.locator('s')
        this.remaining = page.getByTestId('lucky-cat-remaining')
        this.closeButton = page.getByTestId('lucky-cat-close')
    }

    /** A imagem existe e foi realmente carregada (não é um ícone quebrado). */
    async imagemCarregada(): Promise<boolean> {
        await expect(this.image).toBeVisible()
        return this.image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    }

}
