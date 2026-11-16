# Financeiro Familiar

Aplicativo web responsivo para organizar receitas, despesas, contas a pagar e relatórios da família.

## O que já está implementado
- Autenticação por e-mail e senha (Supabase Auth).
- Criação do espaço familiar com conta corrente Caixa e categorias iniciais.
- Convite para a segunda pessoa por código UUID de uso único, válido por 7 dias.
- Lançamentos manuais de receitas e despesas, com conta, categoria, data e forma de pagamento.
- Cadastro de contas a pagar e marcação como pagas.
- Painel com saldo calculado, receitas e despesas do mês e contas pendentes.
- Relatórios mensais e exportação de lançamentos em CSV.
- Estrutura PWA para instalação no celular e no computador.

## Serviços
- Hospedagem: GitHub Pages.
- Banco, autenticação e sincronização: Supabase.
- Projeto Supabase independente: `financeiro-familiar`.

## Segurança
O arquivo `config.js` contém apenas a URL do projeto e a chave **publishable** do Supabase, própria para uso no navegador. Nunca coloque neste repositório chaves `service_role`, secret keys, senhas ou credenciais bancárias. O acesso aos registros é controlado por RLS no banco. As nove tabelas originais mantêm RLS ativo; o papel `anon` não possui acesso direto às tabelas financeiras.

## Publicação no GitHub Pages
No GitHub, abra **Settings → Pages**, escolha **Deploy from a branch**, selecione a branch `main` e a pasta `/(root)`. Salve. O endereço esperado será:

`https://filemonsk8-commits.github.io/financeiro-familiar/`

## Configuração de autenticação
No Supabase, em **Authentication → URL Configuration**, cadastre o endereço do GitHub Pages como Site URL e inclua também na lista de Redirect URLs:

`https://filemonsk8-commits.github.io/financeiro-familiar/**`

O cadastro pode exigir confirmação por e-mail, conforme a configuração do projeto. Após confirmar, entre com seu e-mail e senha.

## Convite da segunda pessoa
1. A primeira pessoa cria o espaço familiar.
2. Em **Configurações**, gera um código de convite.
3. A segunda pessoa cria sua própria conta, entra no aplicativo e informa o código na tela inicial.
4. O código é de uso único e expira em 7 dias. Nunca compartilhe senha.

## Limitações desta primeira versão
- A Caixa ainda não está conectada via Open Finance; os lançamentos são manuais.
- Não há módulo de cartão de crédito, conforme a configuração inicial.
- O uso offline é limitado ao carregamento da estrutura do aplicativo; para consultar e registrar dados é necessária conexão com a internet.
- A instalação PWA e os fluxos de autenticação ainda precisam de validação em dispositivos reais.
