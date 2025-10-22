# Configuração GitHub Device Flow para o Documental

## 🚀 O que mudou?

O Documental agora usa **GitHub Device Flow** em vez de OAuth tradicional. Isso significa:

- ✅ **Sem mais erros 404** - Não depende de redirect URI
- ✅ **2FA funciona perfeitamente** - Usuário autoriza no browser
- ✅ **Mais seguro** - Não precisa de Client Secret
- ✅ **Mais simples** - Apenas Client ID necessário

## 📋 Passos para Configuração

### 1. Criar GitHub OAuth App

1. Vá para: https://github.com/settings/applications/new
2. Preencha os seguintes campos:
   - **Application name**: Documental App
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: (deixe em branco - não é necessário para Device Flow)
3. Clique em "Register application"
4. **Apenas anote o Client ID** (não precisa do Client Secret)

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
GITHUB_CLIENT_ID=seu_client_id_aqui
```

**Nota**: Não precisa mais de `GITHUB_CLIENT_SECRET`!

### 3. Atualizar Arquivo de Configuração

Edite o arquivo `github-config.js` e substitua o Client ID:

```javascript
const GITHUB_CONFIG = {
  CLIENT_ID: 'seu_client_id_real',
  // ... resto da configuração (já está atualizado)
};
```

## 🔐 Como Funciona o Device Flow

1. **Usuário clica** em "Conectar com GitHub"
2. **App gera** um código de 8 caracteres (ex: "WDJB-MJHT")
3. **Janela modal** mostra instruções claras
4. **Usuário visita** github.com/login/device
5. **Usuário digita** o código e autoriza
6. **App recebe** token automaticamente via polling
7. **Token é armazenado** de forma segura com keytar

## 🛡️ Segurança

- **Apenas Client ID** é necessário (pode ser público)
- **Tokens de acesso** são armazenados com `keytar`
- **Sem segredos expostos** no frontend
- **Polling seguro** com validação de estado

## 📝 Escopos Necessários

O aplicativo solicita os seguintes escopos:
- `user:email`: Para obter o email do usuário
- `repo`: Para operações em repositórios

## ⏱️ Fluxo de Autenticação Detalhado

### Passo 1: Solicitar Device Code
```
POST https://github.com/login/device/code
{
  "client_id": "seu_client_id",
  "scope": "user:email repo"
}
```

### Passo 2: Mostrar Instruções
- Código: `WDJB-MJHT`
- URL: `https://github.com/login/device`
- Tempo: 15 minutos

### Passo 3: Polling Automático
```
POST https://github.com/login/oauth/access_token
{
  "client_id": "seu_client_id",
  "device_code": "...",
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
}
```

## 🔧 Armazenamento Seguro

- **Tokens**: Armazenados usando `keytar` (secure system storage)
- **Informações do usuário**: Salvas no banco de dados SQLite local
- **Nenhuma credencial**: Exposta no frontend

## 🐛 Solução de Problemas

### Erro: "GitHub Client ID not configured"
- Configure a variável de ambiente `GITHUB_CLIENT_ID`
- Verifique se o Client ID está correto

### Erro: "Código expirado"
- O código tem validade de 15 minutos
- Feche a janela e tente novamente

### Erro: "Autorização negada"
- O usuário cancelou a autorização
- Tente novamente

### Erro: "Tempo esgotado"
- Nenhuma autorização em 15 minutos
- Tente novamente

## 🚀 Vantagens do Device Flow

| Característica | OAuth Tradicional | Device Flow |
|----------------|-------------------|-------------|
| Client Secret | ❌ Necessário | ✅ Não precisa |
| 2FA Suporte | ❌ Problemas | ✅ Perfeito |
| Redirect URI | ❌ Obrigatório | ✅ Não precisa |
| Erros 404 | ❌ Comuns | ✅ Inexistentes |
| Complexidade | 🔴 Alta | 🟢 Baixa |

## 📱 Experiência do Usuário

1. **Interface clara** com instruções passo a passo
2. **Timer regressivo** mostrando tempo restante
3. **Botão de copiar** para facilitar o uso do código
4. **Feedback visual** durante o polling
5. **Mensagens de erro** amigáveis

## 🛠️ Desenvolvimento

Para desenvolvimento local:
- Use um GitHub OAuth App de teste
- Configure apenas o `GITHUB_CLIENT_ID`
- Teste com e sem 2FA
- Verifique o console para logs detalhados

## 📚 Referências

- [GitHub Device Flow Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [OAuth 2.0 Device Authorization Grant (RFC 8628)](https://tools.ietf.org/html/rfc8628)

---

## English Version

### GitHub Device Flow Setup for Documental

#### What Changed?

Documental now uses **GitHub Device Flow** instead of traditional OAuth:

- ✅ **No more 404 errors** - No redirect URI dependency
- ✅ **2FA works perfectly** - User authorizes in browser
- ✅ **More secure** - No Client Secret needed
- ✅ **Simpler** - Only Client ID required

#### Setup Steps

1. **Create GitHub OAuth App**:
   - Go to: https://github.com/settings/applications/new
   - Application name: Documental App
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: (leave blank)
   - Copy only the Client ID

2. **Configure Environment**:
   ```env
   GITHUB_CLIENT_ID=your_client_id_here
   ```

3. **How It Works**:
   - Click "Connect with GitHub"
   - App shows 8-character code
   - Visit github.com/login/device
   - Enter code and authorize
   - App receives token automatically

#### Troubleshooting

- **"GitHub Client ID not configured"**: Set `GITHUB_CLIENT_ID` environment variable
- **"Code expired"**: Code expires in 15 minutes, try again
- **"Access denied"**: User cancelled authorization, try again
- **"Timeout"**: No authorization within 15 minutes, try again

#### Benefits

| Feature | Traditional OAuth | Device Flow |
|---------|-------------------|-------------|
| Client Secret | ❌ Required | ✅ Not needed |
| 2FA Support | ❌ Issues | ✅ Perfect |
| Redirect URI | ❌ Required | ✅ Not needed |
| 404 Errors | ❌ Common | ✅ None |
| Complexity | 🔴 High | 🟢 Low |