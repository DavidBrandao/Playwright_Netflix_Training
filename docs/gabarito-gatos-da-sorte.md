# Gabarito: Gatos da Sorte (só para o professor)

São 5 bugs escondidos, divididos por papel: o **usuário comum** acha os gatos 1, 2 e 3 (0/3) e o **admin** acha os gatos 4 e 5 (0/2). Os bugs 2 e 3 também disparam no perfil do admin, mas não contam para ele. Cada um mostra o gato do mesmo número (`public/img/gato_da_sorte/N.jpeg`) com a frase
"Você encontrou um ~~bug~~ gato da sorte." e, abaixo, "Você achou o gato N, faltam X" (X diminui a cada gato: 4, 3, 2, falta 1, não falta nenhum). O gato só aparece na primeira vez; o progresso fica salvo por usuário.

| # | Tela | Como acionar |
|---|------|--------------|
| 1 | Login | Clicar em **Esqueci a senha** com o campo e-mail vazio. Como ainda não há usuário, o gato fica guardado no navegador e é enviado à conta no próximo login. |
| 2 | Perfil | Selecionar um avatar com mais de 2 MB e clicar em Salvar (o gato aparece junto com o erro "Imagem acima de 2 MB"). |
| 3 | Perfil | Salvar uma bio com mais de 280 caracteres (acima do limite), ou com emoji. |
| 4 | Admin → Usuários | Marcar/desmarcar "Mostrar todos os cadastrados" 10 vezes seguidas (qualquer outro clique zera a contagem). |
| 5 | Admin → Títulos | Salvar uma série com mais de 3 episódios, ou escrever o ano em texto (ex.: "dois mil"). |

Ao achar todos os gatos do seu papel (3 para o usuário, 2 para o admin), aparece a comemoração com confete, e a foto "parabéns" fica na tela **Gatos da Sorte**, nos dois perfis.

## Para a aula
- `?bugs=off` na URL desliga os gatos (`?bugs=on` religa).
- Zerar a coleção de um usuário: `DELETE /api/me/cats` (com o token dele). `POST /api/test/reset` zera tudo.
- Os campos do formulário de ano e o link "Esqueci a senha" existem de propósito para esses bugs; o ano é um campo de texto, não numérico.
