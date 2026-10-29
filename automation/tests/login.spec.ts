import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { Navbar } from '../pages/components/navbar';

let loginPage: LoginPage
let navbar: Navbar

test.beforeEach(async ({page}) => {
    loginPage = new LoginPage(page)
    navbar = new Navbar(page)
    // Arrange
    loginPage.acessarSite()
})

test('login com sucesso', async({page}) => {
    // Act
    loginPage.login("standard_user", "secret_sauce")
    // Assert
    await expect(navbar.cartButton).toBeVisible()
})

test('tentativa de login com senha errada', async({page}) => {
    // Act
    loginPage.login("standard_user", "secret_sauces")
    // Assert
    await expect(loginPage.alert).toHaveText('Epic sadface: Username and password do not match any user in this service')
})

test('tentativa de login com user errado', async({page}) => {
    // Act
    loginPage.login("standard_userss", "secret_sauce")
    // Assert
    await expect(loginPage.alert).toHaveText('Epic sadface: Username and password do not match any user in this service')
})

test('tentativa de login sem username', async({page}) => {
    loginPage.login('', 'secret_sauce')
    await expect(loginPage.alert).toHaveText('Epic sadface: Username is required')
})

test('tentativa de login sem password', async({page}) => {
    loginPage.login('standard_user', '')
    await expect(loginPage.alert).toHaveText('Epic sadface: Password is required')
})