from flask import Blueprint, jsonify

from app.core.pontos import PONTOS
from app.core.par_proximo import par_mais_proximo

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/pontos")
def pontos():
    # Aqui, os pontos para ir no front
    return jsonify(PONTOS)


@api_bp.route("/resolver", methods=["POST"])
def resolver():
    # roda o dividir e conquistar e devolve o par, as contagens e o passo a passo
    try:
        resultado = par_mais_proximo(PONTOS)
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400
    return jsonify(resultado)