
# Qualifica Vix

Aplicação React/Vite com API local em SQLite e API de produção serverless para Vercel usando PostgreSQL (Neon).

## Arquitetura MVC

```text
api/                         Rotas serverless da Vercel
server/
  config/                    Conexões e configuração de infraestrutura
  controllers/               Fluxo HTTP e coordenação das regras
  models/                    Acesso a dados e validações do domínio
  server.mjs                 Entrada da API local
src/app/
  models/                    Tipos e entidades do frontend
  controllers/               Estado, navegação e ações da aplicação
  views/                     Telas e composição visual
  services/                  Comunicação com as APIs
  components/                Componentes visuais reutilizáveis
```

O fluxo segue `View → Controller → Service/Route → Controller → Model → Banco`. Os arquivos em `api/` são entradas finas exigidas pela Vercel e delegam imediatamente aos controllers.

## Desenvolvimento local

```bash
npm install
npm run server
npm run dev
```

O frontend encaminha `/api/*` para a API SQLite na porta 3001.

## Testes e build

```bash
npm run test:validation
npm run test:db
npm run build
```

Para validar diretamente o PostgreSQL de produção, configure `DATABASE_URL` e execute `npm run test:postgres`.

## Implantação na Vercel

1. Envie o repositório ao seu provedor Git e importe o projeto na Vercel.
2. No Marketplace da Vercel, adicione um banco Neon ao projeto.
3. Confirme que `DATABASE_URL` existe nos ambientes Production, Preview e Development.
4. Execute `npm run db:migrate` com essa variável para preparar as tabelas. As APIs também verificam o schema automaticamente.
5. Faça o deploy. O `vercel.json` define Vite, pasta `dist`, rotas SPA e cabeçalhos de segurança.
6. Valide `https://SEU-DOMINIO/api/health`; a resposta esperada contém `database: "connected"`.

Nunca salve a URL real do banco no Git. Use `.env.example` apenas como referência e configure segredos na Vercel.

## APIs

- `GET /api/health`: saúde da aplicação e conexão do banco.
- `GET /api/testimonials`: lista depoimentos.
- `POST /api/testimonials`: cria um depoimento validado.
- `POST /api/registrations`: cria cadastro e exige responsável legal para menores de 18 anos.
  
