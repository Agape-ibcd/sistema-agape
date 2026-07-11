# Relatório de Migração — Etapa 2

- **Modo:** GRAVAÇÃO REAL
- **Data:** 2026-07-11T01:01:40.338Z
- **Fonte:** `Presença_Ágape.xlsx`

## 1. Equipes
- reutilizada: Clayton & Janaína (Manhã)
- reutilizada: José Maria & Neusa | Guilherme & Thaís (Manhã)
- reutilizada: Geisa e Bell | Ednei & Darcilene (Noite)
- reutilizada: Fernando & Evânia (Noite)

## 2. Membros
- planilha: 43 membros
- criados: 0 | atualizados (casados por nome): 43
- e-mails: 0 reais (únicos na planilha) + 0 sintéticos @membros.agape.local

## 3. Líderes
- Clayton & Janaína (Manhã) ← Clayton de Moraes Alves Silva
- Clayton & Janaína (Manhã) ← Janaina Alves da Silva
- José Maria & Neusa | Guilherme & Thaís (Manhã) ← José Maria Correa
- José Maria & Neusa | Guilherme & Thaís (Manhã) ← Neusa Correa
- José Maria & Neusa | Guilherme & Thaís (Manhã) ← Guilherme Arantes da Silva
- José Maria & Neusa | Guilherme & Thaís (Manhã) ← Thaís Pavan Arantes
- Geisa e Bell | Ednei & Darcilene (Noite) ← Geisa Rirley de Oliveira
- Geisa e Bell | Ednei & Darcilene (Noite) ← Maria Izabel Oliveira da Silva
- Geisa e Bell | Ednei & Darcilene (Noite) ← Ednei Barros Felix
- Geisa e Bell | Ednei & Darcilene (Noite) ← Darcilene Ap.Souza Felix
- Fernando & Evânia (Noite) ← Fernando Barbosa
- Fernando & Evânia (Noite) ← Evânia Santiago Barbosa
- vínculos EQUIPE_LIDERES criados: 0 | elevados a "lider": 0

## 4. Membros órfãos (presentes na planilha PRESENÇA, ausentes em EQUIPES)
- nenhum novo órfão a criar.

## 5. Tipos de evento
- Domingo Manhã: início 10:00 / chegada 08:45 (semanal)
- Quarta-feira: início 20:00 / chegada 18:45 (semanal)
- Domingo Noite: início 18:00 / chegada 16:45 (semanal)
- Evento Extra: início 20:00 / chegada 18:45 (avulso)
- ⚠ horários provisórios, a confirmar na Etapa 3.

## 6. Eventos
- eventos reconstruídos: 15 (esperado: 15)

## 7. Deduplicação de presenças
- linhas lidas: 360
- registros únicos (evento, equipe, membro): 237 (esperado: 237)
- chaves com duplicata: 105 | linhas descartadas: 123

## 8. Escalas (derivadas da presença)
- escalas (evento×equipe) garantidas: 21

## 9. Presenças
- inseridas: 0 | atualizadas: 237 | ignoradas: 0

## Anexo — Duplicatas removidas (123 linhas)

Regra: manteve-se o registro de maior `Data Registro` por (evento, equipe, membro).

| Membro | Evento | Equipe | ×linhas | Data Registro mantida |
|---|---|---|---|---|
| Adriana Aparecida da Silva Oliveira | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Adriana Aparecida da Silva Oliveira | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Catarina de Assis Liba | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Catarina de Assis Liba | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Catarina de Assis Liba | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Clayton de Moraes Alves Silva | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Clayton de Moraes Alves Silva | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Darcilene Ap.Souza Felix | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Darcilene Ap.Souza Felix | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Darcilene Ap.Souza Felix | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Darcilene Ap.Souza Felix | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Darcilene Ap.Souza Felix | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Davi José Machado | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Davi José Machado | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Douglas Franco | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Douglas Franco | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Ednei Barros Felix | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Ednei Barros Felix | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Ednei Barros Felix | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Ednei Barros Felix | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Ednei Barros Felix | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Eduardo de Oliveira Santos | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Eduardo de Oliveira Santos | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Evânia Santiago Barbosa | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Evânia Santiago Barbosa | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Evânia Santiago Barbosa | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Fernando Barbosa | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Fernando Barbosa | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Fernando Barbosa | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Fernando Rosa dos Santos | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Fernando Rosa dos Santos | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Fernando Rosa dos Santos | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Gabriela Cristina Bento de Oliveira Santos | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Gabriela Cristina Bento de Oliveira Santos | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Geisa Rirley de Oliveira | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Geisa Rirley de Oliveira | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Geisa Rirley de Oliveira | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Geisa Rirley de Oliveira | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Geisa Rirley de Oliveira | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Gilmara Rocha Rodrigues | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Gilmara Rocha Rodrigues | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Gilmara Rocha Rodrigues | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Gisele de Angelis Marchi | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Gisele de Angelis Marchi | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Gisele de Angelis Marchi | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Hioana de Goes | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Hioana de Goes | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Janaina Alves da Silva | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Janaina Alves da Silva | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Leandro Copette | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Leandro Copette | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Lucas Mizael Miranda Rodrigues | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Lucas Mizael Miranda Rodrigues | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Lucas Mizael Miranda Rodrigues | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Maria Batista de Melo Barbosa | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Maria Batista de Melo Barbosa | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Maria Batista de Melo Barbosa | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Maria Batista de Melo Barbosa | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Maria Batista de Melo Barbosa | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Maria Izabel Oliveira da Silva | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Maria Izabel Oliveira da Silva | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Maria Izabel Oliveira da Silva | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Maria Izabel Oliveira da Silva | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Maria Izabel Oliveira da Silva | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Maria Lourenço | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Maria Lourenço | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Maria Lourenço | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Maria Lourenço | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Maria Lourenço | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Maricelia da Silva Oliveira Souza | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Maricelia da Silva Oliveira Souza | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Maricelia da Silva Oliveira Souza | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Maricelia da Silva Oliveira Souza | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Maricelia da Silva Oliveira Souza | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Marli Fonseca | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Marli Fonseca | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Michely Lopes Nogueira dos Santos | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Michely Lopes Nogueira dos Santos | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Michely Lopes Nogueira dos Santos | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Rosemary Petrauskaite Gil | 2026-05-24 Domingo Noite | Fernando & Evânia (Noite) | 4 | 2026-05-24T19:06:27.000Z |
| Rosemary Petrauskaite Gil | 2026-05-27 Quarta-feira | Fernando & Evânia (Noite) | 2 | 2026-05-27T22:29:43.000Z |
| Rosemary Petrauskaite Gil | 2026-06-07 Domingo Noite | Fernando & Evânia (Noite) | 2 | 2026-06-07T19:56:50.000Z |
| Sandra Regina Basto dos Santos | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Sandra Regina Basto dos Santos | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Sandra Regina Basto dos Santos | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Sandra Regina Basto dos Santos | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Sandra Regina Basto dos Santos | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Sidclaide Carneiro de França Bonanome | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Sidclaide Carneiro de França Bonanome | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| VALDEREZ CAVALLI | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| VALDEREZ CAVALLI | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Valdirene de Oliveira | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Valdirene de Oliveira | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Valdirene de Oliveira | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Valdirene de Oliveira | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Valdirene de Oliveira | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Vanessa Cristina I. Franco | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Vanessa Cristina I. Franco | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |
| Veridiana luccarelli Barbosa Fiorini | 2026-05-17 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:42:44.000Z |
| Veridiana luccarelli Barbosa Fiorini | 2026-05-20 Quarta-feira | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-23T09:45:36.000Z |
| Veridiana luccarelli Barbosa Fiorini | 2026-05-22 Evento Extra | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-05-26T08:19:35.000Z |
| Veridiana luccarelli Barbosa Fiorini | 2026-05-31 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-01T20:41:05.000Z |
| Veridiana luccarelli Barbosa Fiorini | 2026-06-14 Domingo Noite | Geisa e Bell | Ednei & Darcilene (Noite) | 2 | 2026-06-14T17:27:40.000Z |
| Viviane Alves Machado | 2026-05-24 Domingo Manhã | Clayton & Janaína (Manhã) | 2 | 2026-05-24T09:32:53.000Z |
| Viviane Alves Machado | 2026-05-31 Domingo Noite | Clayton & Janaína (Manhã) | 2 | 2026-06-07T21:26:37.000Z |

## Premissas e avisos
- "Bell" → **Maria Izabel Oliveira da Silva** (apelido; não há membro chamado "Bell"). Confirmar.
- "Fernando" (título "Fernando & Evânia") → **Fernando Barbosa** entre os dois Fernandos, por compartilhar o sobrenome Barbosa com Evânia Santiago Barbosa. Confirmar.
- E-mails repetidos na planilha são de quem preencheu o formulário; membros sem e-mail próprio único receberam `slug@membros.agape.local` (ajustável no cadastro).
- 3 pessoas presentes na aba PRESENÇA não constam em EQUIPES → criadas como **inativas** para preservar os 237 registros (KPI "convocações").
- Horários dos tipos de evento são provisórios (Etapa 3).
- Escalas foram derivadas da presença real (quais equipes atuaram em cada evento).
