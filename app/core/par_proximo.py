import math

RAIO_TERRA_KM = 6371.0

def _projetar(pontos):
    # cada ponto ganha um id (índice na lista de entrada), assim nomes repetidos não atrapalham
    lat_media = math.radians(sum(p["lat"] for p in pontos) / len(pontos))
    fator_x = RAIO_TERRA_KM * math.cos(lat_media)

    projetados = [
        {
            "id": i, "nome": p["nome"], "lat": p["lat"], "lon": p["lon"],
            "x": fator_x * math.radians(p["lon"]),
            "y": RAIO_TERRA_KM * math.radians(p["lat"]),
        }
        for i, p in enumerate(pontos)
    ]
    return projetados, fator_x


def _haversine(a, b):
    # distância real sobre a esfera, usada só para conferir o par final
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    d_lat = lat2 - lat1
    d_lon = math.radians(b["lon"] - a["lon"])
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * RAIO_TERRA_KM * math.asin(math.sqrt(h))


def _distancia(a, b, ctx):
    # conta cada cálculo de distância, para comparar com a força bruta depois
    ctx["comparacoes"] += 1
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _forca_bruta(pontos, ctx):
    melhor = (float("inf"), None, None)
    for i in range(len(pontos)):
        for j in range(i + 1, len(pontos)):
            d = _distancia(pontos[i], pontos[j], ctx)
            if d < melhor[0]:
                melhor = (d, pontos[i], pontos[j])
    return melhor


def _resolver(px, py, nivel, ctx):
    n = len(px)
    # limites (em longitude) do subproblema atual, para o front sombrear a região
    regiao = [px[0]["lon"], px[-1]["lon"]]

    # CASO BASE: poucos pontos, força bruta
    if n <= 3:
        d, a, b = _forca_bruta(px, ctx)
        ctx["eventos"].append({
            "tipo": "base", "nivel": nivel, "regiao_lon": regiao,
            "pontos": [p["id"] for p in px],
            "par": [a["id"], b["id"]],
            "distancia_km": round(d, 2),
            "mensagem": (
                f"Só {n} pontos: compara todos os pares por força bruta. "
                f"Melhor par: {a['nome']} ↔ {b['nome']} ({d:.2f} km)."
            ),
        })
        return d, a, b

    # DIVIDIR: linha vertical entre as duas metades
    meio = n // 2
    x_linha = (px[meio - 1]["x"] + px[meio]["x"]) / 2
    lon_linha = (px[meio - 1]["lon"] + px[meio]["lon"]) / 2

    esq_x, dir_x = px[:meio], px[meio:]
    ids_esq = {p["id"] for p in esq_x}
    esq_y = [p for p in py if p["id"] in ids_esq]
    dir_y = [p for p in py if p["id"] not in ids_esq]

    ctx["eventos"].append({
        "tipo": "dividir", "nivel": nivel, "regiao_lon": regiao,
        "esquerda": [p["id"] for p in esq_x],
        "direita": [p["id"] for p in dir_x],
        "lon_linha": round(lon_linha, 5),
        "mensagem": (
            f"Divide {n} pontos por uma linha vertical (longitude {lon_linha:.3f}): "
            f"{len(esq_x)} à esquerda e {len(dir_x)} à direita."
        ),
    })

    # CONQUISTAR: resolve cada metade recursivamente
    d_esq, a_esq, b_esq = _resolver(esq_x, esq_y, nivel + 1, ctx)
    d_dir, a_dir, b_dir = _resolver(dir_x, dir_y, nivel + 1, ctx)

    if d_esq <= d_dir:
        delta, melhor_a, melhor_b = d_esq, a_esq, b_esq
    else:
        delta, melhor_a, melhor_b = d_dir, a_dir, b_dir
    delta_antes = delta

    # Aqui mano, os pontos da faixa ficam ordenados por latitude, então cada um só é comparado com os seguintes que estejam a menos de delta de distância vertical.
    faixa = [p for p in py if abs(p["x"] - x_linha) < delta]
    comparacoes = []
    for i in range(len(faixa)):
        j = i + 1
        while j < len(faixa) and faixa[j]["y"] - faixa[i]["y"] < delta:
            d = _distancia(faixa[i], faixa[j], ctx)
            comparacoes.append({
                "a": faixa[i]["id"], "b": faixa[j]["id"],
                "distancia_km": round(d, 2),
            })
            if d < delta:
                delta, melhor_a, melhor_b = d, faixa[i], faixa[j]
            j += 1

    melhorou = delta < delta_antes
    meia_largura = math.degrees(delta_antes / ctx["fator_x"])
    texto = (
        f"Combina: melhor das metades = {delta_antes:.2f} km. "
        f"Faixa com {len(faixa)} ponto(s) e {len(comparacoes)} comparação(ões). "
    )
    texto += (
        f"Achou par melhor atravessando a linha: {melhor_a['nome']} ↔ {melhor_b['nome']} ({delta:.2f} km)."
        if melhorou else "Nenhum par melhor atravessa a linha."
    )

    ctx["eventos"].append({
        "tipo": "faixa", "nivel": nivel, "regiao_lon": regiao,
        "lon_linha": round(lon_linha, 5),
        "faixa_lon": [round(lon_linha - meia_largura, 5), round(lon_linha + meia_largura, 5)],
        "delta_antes_km": round(delta_antes, 2),
        "pontos_faixa": [p["id"] for p in faixa],
        "comparacoes": comparacoes,
        "par": [melhor_a["id"], melhor_b["id"]],
        "distancia_km": round(delta, 2),
        "melhorou": melhorou,
        "mensagem": texto,
    })
    return delta, melhor_a, melhor_b


def par_mais_proximo(pontos):
    if len(pontos) < 2:
        raise ValueError("São necessários pelo menos 2 pontos.")

    projetados, fator_x = _projetar(pontos)
    px = sorted(projetados, key=lambda p: p["x"])
    py = sorted(projetados, key=lambda p: p["y"])

    ctx = {"comparacoes": 0, "eventos": [], "fator_x": fator_x}
    d, a, b = _resolver(px, py, 0, ctx)

    n = len(pontos)
    return {
        "par": [a["nome"], b["nome"]],
        "par_ids": [a["id"], b["id"]],
        "distancia_km": round(d, 2),
        "distancia_real_km": round(_haversine(a, b), 2),
        "comparacoes_dc": ctx["comparacoes"],
        "comparacoes_forca_bruta": n * (n - 1) // 2,
        "eventos": ctx["eventos"],
    }