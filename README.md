# 🚢 Seafarers Status Dashboard

Dashboard para gestão de endorsements da Portugal Flag.

## 🚀 Deploy no Vercel (Recomendado)

### Opção 1: Deploy direto (mais fácil)

1. Vai a [vercel.com](https://vercel.com) e cria conta com o teu GitHub
2. Faz upload desta pasta para um repositório GitHub
3. No Vercel, clica "Import Project" e seleciona o repositório
4. Clica "Deploy" — está feito! 🎉

### Opção 2: Deploy via CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Na pasta do projeto
vercel

# Segue as instruções e terás o URL da tua app
```

## 💻 Correr localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Abrir http://localhost:5173
```

## 📋 Funcionalidades

### Dashboard
- Upload CSV do Zoho
- Upload Excel semanal (carrega dados automaticamente)
- Estatísticas em tempo real
- Alerta do próximo SRA a expirar
- Tabela Outstanding End
- Geração de relatório PDF

### Crewboard
- Edição do Crewboard semanal
- Cálculos automáticos
- Download Excel no formato correto

## 📁 Estrutura do projeto

```
seafarers-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          # Componente principal
│   ├── main.jsx         # Entry point
│   └── index.css        # Estilos Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🔧 Configuração

Para alterar os dados históricos (mensais e semanais), edita as constantes no ficheiro `src/App.jsx`:

```javascript
const MONTHLY_DATA = {
  '2024-10': 1013,
  '2024-11': 1139,
  // ...
};

const WEEKLY_HISTORY = { 
  44: 488, 
  45: 489, 
  // ...
};
```

## 🔒 Segurança

Todos os dados são processados **localmente no browser**. 
Nenhuma informação é enviada para servidores externos.

---

Desenvolvido para Portugal Flag - Endorsements 🇵🇹
