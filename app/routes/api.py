from flask import Blueprint, jsonify, request

from app.core.pontos import PONTOS
from app.core.par_proximo import par_mais_proximo

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _validar(pontos):
    # confere o que veio do front antes de rodar o algoritmo
    if not isinstance(pontos, list):
        raise ValueError("'pontos' deve ser uma lista.")
    validos = []
    for i, p in enumerate(pontos):
        if not isinstance(p, dict):
            raise ValueError(f"Ponto {i + 1} inválido.")
        nome = str(p.get("nome", "")).strip()
        if not nome:
            raise ValueError(f"Ponto {i + 1} sem nome.")
        try:
            lat, lon = float(p["lat"]), float(p["lon"])
        except (KeyError, TypeError, ValueError):
            raise ValueError(f"Ponto '{nome}' com coordenadas inválidas.")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f"Ponto '{nome}' fora dos limites de latitude/longitude.")
        validos.append({"nome": nome, "lat": lat, "lon": lon})
    return validos


@api_bp.route("/pontos")
def pontos():
    # Aqui, os pontos para ir no front
    return jsonify(PONTOS)


@api_bp.route("/resolver", methods=["POST"])
def resolver():
    # roda o dividir e conquistar e devolve o par, as contagens e o passo a passo
    corpo = request.get_json(silent=True) or {}
    try:
        pontos = _validar(corpo["pontos"]) if "pontos" in corpo else PONTOS
        resultado = par_mais_proximo(pontos)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    return jsonify(resultado)