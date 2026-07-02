# chat-rpg

## Estrutura

- `src/config`: variáveis de ambiente e configuração
- `src/shared`: utilitários reutilizáveis, como JWT e guards
- `src/database`: client, schema, setup e repositórios
- `src/modules/auth`: login e emissão do token master
- `src/modules/players`: rotas de ações executadas em nome dos players
- `src/routes`: rotas gerais, como healthcheck
- `src/server`: bootstrap da aplicação

## Auth do master

O backend expõe `POST /auth/login` para autenticar usuários do banco. O master inicial é `kozz-bot`.

Env vars necessárias:

```bash
LOG_LEVEL=info
PORT=3000
DATABASE_PATH=./data/chat-rpg.sqlite
JWT_SECRET=change-this-to-a-long-random-secret
MASTER_PASSWORD=change-this-password
```

Na primeira inicialização, o banco cria o usuário master `kozz-bot` com a senha definida em `MASTER_PASSWORD`.
O token retornado não expira. Ele deve ser enviado como `Authorization: Bearer <token>` nas rotas protegidas.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

This project was created using `bun init` in bun v1.2.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
