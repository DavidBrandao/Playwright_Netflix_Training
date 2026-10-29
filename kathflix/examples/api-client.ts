/**
 * Cliente de API do KathFlix para usar em hooks do Playwright (setup/teardown).
 * Exige Node 18+ (fetch global). Ajuste KATHFLIX_URL se a app não estiver em localhost:3000.
 *
 * Exemplo de uso em um teste:
 *
 *   import { test } from '@playwright/test';
 *   import { KathflixApi } from '../examples/api-client';
 *
 *   const api = new KathflixApi();
 *   test.beforeEach(async () => {
 *     await api.seed({ users: [{ name: 'QA', email: 'qa-ana@teste.com', password: 'abc123' }] });
 *   });
 *   test.afterEach(async () => {
 *     await api.cleanup('qa-');
 *   });
 */
const BASE = process.env.KATHFLIX_URL ?? 'http://localhost:3000';

type Json = Record<string, unknown>;

export class KathflixApi {
  private base: string;

  constructor(base: string = BASE) {
    this.base = base;
  }

  private async request<T = any>(method: string, path: string, opts: { token?: string; json?: Json } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.json) headers['Content-Type'] = 'application/json';
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: opts.json ? JSON.stringify(opts.json) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error ?? 'erro'}`);
    return data as T;
  }

  /** Volta o banco ao estado inicial (usuários e títulos do seed). */
  reset() { return this.request('POST', '/api/test/reset'); }

  /** Cria usuários e títulos em lote, sem autenticação. Atômico: tudo ou nada. */
  seed(data: { users?: Json[]; titles?: Json[] }) { return this.request('POST', '/api/test/seed', { json: data }); }

  /** Gatos da Sorte do usuário logado: { total, found, complete }. */
  cats(token: string) { return this.request('GET', '/api/me/cats', { token }); }

  /** Zera os gatos encontrados pelo usuário do token (teardown). */
  resetCats(token: string) { return this.request('DELETE', '/api/me/cats', { token }); }

  /** Teardown: remove usuários (e-mail) e títulos (nome) que começam com o prefixo (mínimo 3 caracteres, sem contar % e _). */
  cleanup(prefix: string) { return this.request('DELETE', '/api/test/cleanup', { json: { prefix } }); }

  async login(email: string, password: string): Promise<string> {
    const r = await this.request<{ token: string }>('POST', '/api/auth/login', { json: { email, password } });
    return r.token;
  }

  loginAdmin() { return this.login('admin@kathflix.com', 'admin123'); }

  createUser(adminToken: string, user: Json) { return this.request('POST', '/api/admin/users', { token: adminToken, json: user }); }
  deleteUser(adminToken: string, id: number) { return this.request('DELETE', `/api/admin/users/${id}`, { token: adminToken }); }
  createTitle(adminToken: string, title: Json) { return this.request('POST', '/api/admin/titles', { token: adminToken, json: title }); }
  deleteTitle(adminToken: string, id: number) { return this.request('DELETE', `/api/admin/titles/${id}`, { token: adminToken }); }
  favorite(token: string, titleId: number) { return this.request('POST', `/api/favorites/${titleId}`, { token }); }
}
