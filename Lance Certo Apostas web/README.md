# Lance Certo — plataforma de apostas esportivas e cassino (saldo virtual)

Backend e frontend completos, sem dependências (Node 20+). **Todo o saldo é virtual**: não há dinheiro real, gateway de pagamento nem saque real.

- Contas: cadastro com validação de CPF (dígitos verificadores, guardado como hash), maioridade, senha com scrypt, sessão por cookie HttpOnly.
- Carteira com livro-razão (ledger) auditável, depósito/saque (aprovação no backoffice), limites diários, autoexclusão.
- Esportes: liga simulada em tempo acelerado (partida = 3 min), odds por modelo de Poisson (pré-jogo e ao vivo), 4 mercados, apostas simples/múltiplas, cash-out, liquidação automática.
- Cassino: Crash multiplayer, Roleta europeia, Dados e Slots — resultados **provably fair** (HMAC-SHA256, seed revelável, verificador na página).
- Backoffice `/admin`: GGR, RTP, exposição, usuários, apostas, saques.

```bash
cd apostas
node server.js      # http://localhost:3203
npm test            # 41 verificações end-to-end contra o servidor real
```
Credenciais do admin: `data/admin-credentials.txt` (geradas no 1º start).

Aviso: operar apostas com dinheiro real no Brasil exige autorização do Ministério da Fazenda (Lei 14.790/2023), KYC, meios de pagamento licenciados e demais controles — fora do escopo deste projeto.
