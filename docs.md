# Projeto: Backend de um MMORPG por Chat para WhatsApp

Você será o arquiteto de software deste projeto.

Seu objetivo é me ajudar a projetar e implementar um backend para um jogo de RPG/MMORPG jogado inteiramente através de comandos enviados em um chatbot do WhatsApp.

## Visão geral

O jogo é um MMORPG assíncrono inspirado em RuneScape, Tibia e outros MMORPGs clássicos, mas adaptado para uma interface de chat.

Os jogadores executam ações através de comandos como:

- /pesca
- /minerar
- /lenha
- /plantar
- /cozinhar
- /combater
- /craft
- /forjar
- /explorar

Cada comando executa uma ação no servidor.

O servidor calcula completamente o resultado da ação.

O chatbot é apenas um cliente que envia comandos e exibe respostas.

Toda a lógica do jogo deve existir exclusivamente no backend.

---

# Objetivos

O projeto deve ser modular, escalável e permitir adicionar novas profissões, itens, eventos e mecânicas sem necessidade de grandes refatorações.

Toda a arquitetura deve seguir princípios de Clean Architecture, SOLID e separação de responsabilidades.

Evite soluções acopladas.

Sempre prefira sistemas genéricos e extensíveis.

---

# Stack

Linguagem:

- Node.js
- TypeScript

Banco:

- SQLite inicialmente
- Estrutura preparada para futura migração para PostgreSQL

ORM:

- Drizzle ORM

Servidor:

- Fastify

Comunicação:

- REST API

---

# O chatbot

O chatbot nunca toma decisões.

Ele apenas chama endpoints da API.

Exemplo:

POST /players/{playerId}/actions/fish

Resposta:

- itens obtidos
- experiência recebida
- ouro recebido
- eventos aleatórios
- mensagens de retorno
- alterações no inventário

Toda a lógica deve ficar na API.

---

# Estrutura geral esperada

A arquitetura deve ser organizada aproximadamente assim:

src/

app/

controllers/

services/

repositories/

domain/

entities/

value-objects/

rules/

database/

routes/

jobs/

utils/

config/

Não colocar regras de negócio dentro dos controllers.

Controllers apenas recebem requisições e chamam services.

Repositories apenas persistem dados.

Services concentram toda a lógica do jogo.

---

# Mundo persistente

O jogo representa um mundo compartilhado.

Todos os jogadores coexistem.

O mundo possui:

- eventos globais
- economia
- marketplace (futuro)
- rankings
- chefes mundiais (futuro)
- clima
- estações
- NPCs (futuro)

---

# Skills

Cada ação concede experiência para uma ou mais skills.

Exemplos:

Fishing

Mining

Woodcutting

Farming

Cooking

Smithing

Crafting

Magic

Strength

Dexterity

Resistance

Trading

Alchemy

Hunting

Construction

Archaeology

As skills devem influenciar outras.

Exemplo:

Dexterity melhora pesca.

Strength melhora mineração.

Magic aumenta chances de eventos raros.

Nenhuma skill deve existir isoladamente.

---

# Sistema de itens

Todos os itens pertencem a uma categoria.

Categorias:

Equipment

Consumable

Material

Treasure

Cada categoria possui subclasses.

Exemplos:

Equipment

- ferramentas
- armas
- armaduras
- acessórios

Consumable

- comida
- poções
- sementes
- iscas
- pergaminhos

Material

- minério
- barras
- madeira
- couro
- ervas
- peixes
- gemas

Treasure

- sucata
- relíquias
- troféus
- artefatos
- objetos valiosos

Os equipamentos concedem bônus.

Consumíveis fornecem efeitos temporários.

Materiais são utilizados em crafting.

Treasures normalmente apenas podem ser vendidos ou usados em missões.

---

# Crafting

Todo item deve poder ser produzido por receitas.

Receitas podem utilizar:

materiais

ouro

tempo

nível mínimo

ferramentas

eventos especiais

---

# Sistema de ações

Cada comando do jogador executa um fluxo semelhante:

Verificar cooldown

Verificar energia

Verificar ferramentas

Verificar equipamentos

Calcular bônus

Calcular chances

Sortear eventos

Gerar drops

Conceder experiência

Atualizar inventário

Registrar log

Retornar resposta

As probabilidades nunca devem ficar hardcoded.

Devem ser parametrizadas.

---

# Eventos aleatórios

Cada ação pode disparar eventos.

Exemplos:

Pesca

- peixe gigante
- perder isca
- baú
- mapa
- peixe dourado
- garrafa misteriosa

Mineração

- diamante
- veio raro
- ferramenta quebrada
- desmoronamento

Plantação

- chuva
- praga
- colheita excelente

Cooking

- comida perfeita
- comida queimada

Combate

- crítico
- emboscada
- boss

Esses eventos devem ser configuráveis.

---

# Eventos globais

O mundo inteiro pode possuir eventos ativos.

Exemplos:

Temporada de chuvas

Festival da colheita

Feira da cidade

Migração dos peixes

Lua Arcana

Invasão de monstros

Os eventos modificam probabilidades e recompensas.

---

# Economia

Todos os itens possuem:

valor base

raridade

peso (opcional)

categoria

tags

Os preços podem variar futuramente.

Preparar arquitetura para economia dinâmica.

---

# Equipamentos

Equipamentos fornecem bônus para ações.

Exemplo:

Vara de pesca

+5% chance de peixe raro

+10 Fishing

+2 Luck

Os bônus devem ser configuráveis.

Evite código específico para cada equipamento.

---

# Banco de dados

Modelar entidades normalizadas.

Evitar armazenar grandes estruturas JSON quando houver relacionamento.

Espera-se algo próximo de:

Players

Skills

PlayerSkills

Items

PlayerInventory

EquipmentSlots

Recipes

Drops

Cooldowns

GlobalEvents

PlayerBuffs

CraftQueue

ActionLogs

Market

Guilds (futuro)

---

# Escalabilidade

O projeto deve ser preparado para receber futuramente:

Guildas

PvP

Casas

Pets

Montarias

Dungeons

Raids

NPCs

Missões

Sistema de clima

Marketplace entre jogadores

Leilão

Conquistas

Achievements

Títulos

Eventos sazonais

---

# Forma de resposta esperada

Sempre que sugerir código:

- explique a motivação da arquitetura;
- priorize reutilização;
- evite duplicação;
- proponha abstrações quando fizer sentido;
- pense como um arquiteto de MMORPG, não apenas como um desenvolvedor de CRUD.

Sempre que possível, questione decisões que possam limitar a escalabilidade e proponha alternativas mais robustas.
