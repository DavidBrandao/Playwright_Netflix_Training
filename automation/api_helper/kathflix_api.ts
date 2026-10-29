import { ApiBase, Json } from "./common_api";

export const BASE_URL = process.env.KATHFLIX_URL ?? 'http://localhost:3000'

export const ADMIN = { email: 'admin@kathflix.com', password: 'admin123' }

// Chamadas da API do KathFlix, usadas nos hooks (beforeAll/afterAll...) de setup e teardown dos testes.
export class KathflixApi extends ApiBase {

    constructor(baseUrl: string = BASE_URL) {
        super(baseUrl)
    }

    // ---- autenticação ----
    async login(email: string, password: string): Promise<string> {
        const r = await this.post<{ token: string }>('/api/auth/login', { email, password })
        this.token = r.token
        return r.token
    }

    loginAdmin() { return this.login(ADMIN.email, ADMIN.password) }

    // ---- setup / teardown (rotas /api/test, sem token) ----
    resetarBanco() { return this.post('/api/test/reset') }

    /** Cria um usuário comum e devolve o e-mail. O e-mail começa com o prefixo, para o cleanup achar depois. */
    async criarUsuario(prefixo: string, password: string, extra: Json = {}): Promise<string> {
        const email = `${prefixo}user@kathflix.com`
        await this.post('/api/test/seed', { users: [{ name: 'Usuario Automacao', email, password, role: 'user', ...extra }] })
        return email
    }

    /** Remove usuários (e-mail) e títulos (nome) que começam com o prefixo. */
    limparPorPrefixo(prefixo: string) { return this.delete('/api/test/cleanup', { prefix: prefixo }) }

    // ---- gatos da sorte (usuário logado) ----
    buscarGatos() { return this.get<{ total: number, cats: number[], found: number[], complete: boolean }>('/api/me/cats') }
    registrarGato(n: number) { return this.post(`/api/me/cats/${n}`) }
    resetarGatos() { return this.delete('/api/me/cats') }

    // ---- admin (precisa de token de admin) ----
    criarTitulo(titulo: Json) { return this.post<{ id: number }>('/api/admin/titles', titulo) }
    removerTitulo(id: number) { return this.delete(`/api/admin/titles/${id}`) }
    removerUsuario(id: number) { return this.delete(`/api/admin/users/${id}`) }
}
