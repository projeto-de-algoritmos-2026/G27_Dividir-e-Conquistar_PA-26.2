# G27_Dividir-e-Conquistar_PA-26.2

Roteiro turístico pela Grécia que encontra os **dois pontos mais próximos** entre os lugares escolhidos pelo usuário, usando o algoritmo de **Dividir e Conquistar** para o problema do *par de pontos mais próximo*, com visualização passo a passo no mapa.

Vídeo apresentação: https://youtu.be/0H11iVSAx0Y

## Alunos

| Matrícula | Aluno |
| --- | --- |
| 24/2015960 | Thiago Henrique Machado de Souza |
| 24/2015915 | Luiz Gustavo da Conceição Souza |

## O problema

Dados `n` pontos, encontrar o par com a menor distância entre si.

- **Força bruta:** compara todos os pares → `n(n−1)/2` comparações, **O(n²)**.
- **Dividir e Conquistar:** **O(n log n)**.

## Como o algoritmo funciona (`app/core/par_proximo.py`)

1. **Projeção:** latitude/longitude são convertidas para um plano em km (projeção equiretangular centrada na latitude média), pois o algoritmo exige distância euclidiana.
2. **Pré-ordenação:** os pontos são ordenados uma vez por `x` (`px`) e uma vez por `y` (`py`).
3. **Dividir:** uma linha vertical na mediana de `x` separa os pontos em duas metades.
4. **Conquistar:** cada metade é resolvida recursivamente; com ≤ 3 pontos usa força bruta (caso base).
5. **Combinar:** com `δ` = menor distância das metades, só os pontos a menos de `δ` da linha (a *faixa*) podem formar um par melhor. Percorrendo a faixa ordenada por `y`, cada ponto só é comparado com os seguintes enquanto a diferença vertical for `< δ` (no máximo ~7 vizinhos), o que mantém a etapa em O(n).

Recorrência: `T(n) = 2T(n/2) + O(n)` → **O(n log n)**.

Cada etapa gera um *evento* (`dividir`, `base`, `faixa`) que o frontend usa para animar a execução.

## Como rodar

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python run.py
```

Acesse <http://127.0.0.1:5000>.

## Usando a aplicação

- Marque/desmarque os pontos turísticos que deseja visitar, ou clique em **+ Adicionar ponto no mapa** para incluir um local próprio em uma região válida na Grécia.
- Clique em **Executar algoritmo** e acompanhe (play, passo a passo, velocidade):
  - **Dividir:** linha vertical separando a metade esquerda (azul) e direita (laranja).
  - **Caso base:** comparação por força bruta entre ≤ 3 pontos.
  - **Combinar:** faixa central (roxo) e as comparações feitas nela.
- No final é exibido o par a **visitar juntos**, a distância e o número de comparações do D&C vs força bruta.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/pontos` | Lista os pontos turísticos padrão |
| POST | `/api/resolver` | Corpo `{"pontos": [{"nome", "lat", "lon"}, ...]}` (sem corpo usa os pontos padrão). Retorna o par, distâncias, contagens e eventos |

## Limitação

A projeção plana introduz um pequeno erro nas distâncias leste-oeste (alguns % numa região do tamanho da Grécia). Em casos de quase empate, o par escolhido pode diferir do par mais próximo pela distância real sobre a esfera. Por isso a resposta traz `distancia_km` (no plano, usada pelo algoritmo) e `distancia_real_km` (haversine).

## Estrutura

```
app/
  __init__.py          create_app()
  core/
    par_proximo.py     algoritmo D&C + eventos para visualização
    pontos.py          pontos turísticos da Grécia
  routes/
    api.py             /api/pontos e /api/resolver
    main.py            página principal
  templates/index.html
  static/css/style.css
  static/js/app.js     mapa (Leaflet) e animação
run.py
```
