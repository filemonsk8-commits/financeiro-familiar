# Captura Android — Financeiro Familiar

Projeto Android nativo auxiliar para o Financeiro Familiar.

## Primeira etapa: validar as notificações da Caixa

Esta versão é um protótipo de captura local. Ela:
- solicita a permissão especial de acesso às notificações do Android;
- permite escolher qual aplicativo instalado será monitorado;
- depois da escolha, guarda somente as notificações daquele pacote;
- não envia notificações para a internet e não acessa a conta bancária;
- permite apagar as mensagens armazenadas.

Antes de escolher a Caixa, o aplicativo registra localmente apenas o nome e o identificador dos aplicativos que emitiram notificações, para que o usuário selecione a origem correta. O texto das notificações de outros aplicativos não é armazenado.

## Abrir no Android Studio

1. Baixe ou clone este repositório.
2. No Android Studio, escolha **Open** e selecione a pasta `android-notifier`.
3. Aguarde a sincronização do Gradle.
4. Conecte o tablet Android por USB com a depuração USB habilitada, ou use um emulador.
5. Pressione **Run** para instalar o protótipo.

Identificador do aplicativo: `com.filemon.financeirocaptura`.

## Teste no tablet

1. Abra o app **Financeiro Familiar - Captura**.
2. Toque em **Autorizar acesso às notificações** e habilite a permissão nas configurações do Android.
3. Abra o aplicativo da Caixa e aguarde uma notificação legítima de movimentação.
4. Volte ao app de captura e toque em **Escolher aplicativo da Caixa**.
5. Selecione o aplicativo correto pelo nome e identificador exibidos.
6. Aguarde uma nova notificação da Caixa e confira se o texto aparece na tela.

## Próxima etapa

Depois de confirmar como a Caixa apresenta valor, tipo e descrição nas notificações reais, implementar a leitura estruturada, revisão de lançamentos e sincronização autenticada com o Supabase. Não ativar lançamento automático antes de validar a interpretação e a deduplicação.

## Segurança

- Não pedir senha bancária, token, PIN ou código de autenticação.
- Não enviar notificações para servidor nesta primeira versão.
- Não armazenar texto de notificações de outros aplicativos.
- A permissão de acesso às notificações pode ser revogada a qualquer momento nas configurações do Android.
