const CORES = {
  neutro: "#7d8796",
  esq: "#1e5aa8",
  dir: "#e07a1f",
  faixa: "#8b3fb8",
  par: "#d62828",
  apagado: "#c4c9d1",
};

const NOMES_TIPO = { dividir: "Dividir", base: "Caso base", faixa: "Combinar" };

// estado da aplicação
let pontos = [];          // {nome, lat, lon, descricao, ativo, proprio}
let marcadores = [];      // um circleMarker por ponto da lista
let execucao = null;      // {pontos, resultado, passo}
let timerPlay = null;
let modoAdicionar = false;

const mapa = L.map("mapa").setView([38.2, 23.8], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap",
}).addTo(mapa);

const camadaPassos = L.layerGroup().addTo(mapa);
const camadaMarcadores = L.layerGroup().addTo(mapa);

const $ = (id) => document.getElementById(id);

// ---------- lista de pontos ----------

function desenharLista() {
  const ul = $("lista-pontos");
  ul.innerHTML = "";
  pontos.forEach((p, i) => {
    const li = document.createElement("li");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = p.ativo;
    check.addEventListener("change", () => {
      p.ativo = check.checked;
      descartarExecucao();
      desenharMarcadores();
      atualizarContador();
    });

    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `<div class="nome"></div><div class="desc"></div>`;
    info.querySelector(".nome").textContent = p.nome;
    info.querySelector(".desc").textContent = p.descricao || "Ponto adicionado por você";
    info.addEventListener("click", () => mapa.flyTo([p.lat, p.lon], 12));

    li.append(check, info);

    if (p.proprio) {
      const remover = document.createElement("button");
      remover.className = "remover";
      remover.title = "Remover";
      remover.textContent = "×";
      remover.addEventListener("click", () => {
        pontos.splice(i, 1);
        descartarExecucao();
        desenharTudo();
      });
      li.append(remover);
    }
    ul.append(li);
  });
  atualizarContador();
}

function atualizarContador() {
  const ativos = pontos.filter((p) => p.ativo).length;
  $("contador-pontos").textContent = `${ativos}/${pontos.length}`;
}

function desenharMarcadores() {
  camadaMarcadores.clearLayers();
  marcadores = pontos.map((p) => {
    const m = L.circleMarker([p.lat, p.lon], estiloMarcador(p.ativo ? CORES.neutro : CORES.apagado, p.ativo ? 7 : 5));
    m.bindTooltip(p.nome);
    m.bindPopup(`<strong>${escapar(p.nome)}</strong><br>${escapar(p.descricao || "")}`);
    m.addTo(camadaMarcadores);
    return m;
  });
}

function desenharTudo() {
  desenharLista();
  desenharMarcadores();
}

function estiloMarcador(cor, raio = 7) {
  return { radius: raio, color: "#fff", weight: 2, fillColor: cor, fillOpacity: 1 };
}

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ---------- adicionar ponto clicando no mapa ----------

$("btn-adicionar").addEventListener("click", () => {
  modoAdicionar = !modoAdicionar;
  $("btn-adicionar").classList.toggle("ativo", modoAdicionar);
  $("btn-adicionar").textContent = modoAdicionar ? "Clique no mapa para posicionar…" : "+ Adicionar ponto no mapa";
  document.body.classList.toggle("modo-adicionar", modoAdicionar);
});

mapa.on("click", (e) => {
  if (!modoAdicionar) return;
  const nome = prompt("Nome do ponto:");
  if (nome && nome.trim()) {
    pontos.push({ nome: nome.trim(), lat: e.latlng.lat, lon: e.latlng.lng, descricao: "", ativo: true, proprio: true });
    descartarExecucao();
    desenharTudo();
  }
  $("btn-adicionar").click();
});

$("btn-todos").addEventListener("click", () => marcarTodos(true));
$("btn-nenhum").addEventListener("click", () => marcarTodos(false));

function marcarTodos(valor) {
  pontos.forEach((p) => (p.ativo = valor));
  descartarExecucao();
  desenharTudo();
}

// ---------- execução do algoritmo ----------

$("btn-executar").addEventListener("click", executar);

async function executar() {
  pausar();
  mostrarErro(null);
  const ativos = pontos.filter((p) => p.ativo);
  try {
    const resp = await fetch("/api/resolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pontos: ativos.map(({ nome, lat, lon }) => ({ nome, lat, lon })) }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || "Erro ao executar.");

    // os ids devolvidos pela API são os índices em "ativos"
    const indiceLista = ativos.map((p) => pontos.indexOf(p));
    execucao = { pontos: ativos, indiceLista, resultado: dados, passo: -1, limitesLat: limitesLatitude(ativos) };
    habilitarControles(true);
    mapa.fitBounds(L.latLngBounds(ativos.map((p) => [p.lat, p.lon])).pad(0.1));
    irPara(0);
    tocar();
  } catch (erro) {
    descartarExecucao();
    mostrarErro(erro.message);
  }
}

function limitesLatitude(lista) {
  const lats = lista.map((p) => p.lat);
  const min = Math.min(...lats), max = Math.max(...lats);
  const folga = Math.max((max - min) * 0.15, 0.05);
  return [min - folga, max + folga];
}

function descartarExecucao() {
  pausar();
  execucao = null;
  camadaPassos.clearLayers();
  habilitarControles(false);
  $("resultado").hidden = true;
  $("passo-num").textContent = "—";
  $("passo-tipo").textContent = "";
  $("passo-msg").innerHTML = "Clique em <strong>Executar</strong> para ver o algoritmo rodando passo a passo.";
  $("m-dc").textContent = "—";
  $("m-fb").textContent = "—";
}

function mostrarErro(msg) {
  $("erro").hidden = !msg;
  $("erro").textContent = msg || "";
}

function habilitarControles(on) {
  ["btn-inicio", "btn-anterior", "btn-play", "btn-proximo", "btn-fim"].forEach((id) => ($(id).disabled = !on));
}

// ---------- navegação pelos passos ----------

$("btn-inicio").addEventListener("click", () => { pausar(); irPara(0); });
$("btn-anterior").addEventListener("click", () => { pausar(); irPara(execucao.passo - 1); });
$("btn-proximo").addEventListener("click", () => { pausar(); irPara(execucao.passo + 1); });
$("btn-fim").addEventListener("click", () => { pausar(); irPara(execucao.resultado.eventos.length); });
$("btn-play").addEventListener("click", () => (timerPlay ? pausar() : tocar()));
$("velocidade").addEventListener("input", () => { if (timerPlay) { pausar(); tocar(); } });

function tocar() {
  if (!execucao) return;
  if (execucao.passo >= execucao.resultado.eventos.length) irPara(0);
  $("btn-play").textContent = "⏸";
  // o slider vai de lento (esquerda) a rápido (direita)
  const atraso = 3200 - Number($("velocidade").value);
  timerPlay = setInterval(() => {
    if (execucao.passo >= execucao.resultado.eventos.length) return pausar();
    irPara(execucao.passo + 1);
  }, atraso);
}

function pausar() {
  clearInterval(timerPlay);
  timerPlay = null;
  $("btn-play").textContent = "▶";
}

function irPara(passo) {
  const total = execucao.resultado.eventos.length;
  execucao.passo = Math.max(0, Math.min(passo, total));
  desenharPasso();
}

// ---------- desenho de cada passo no mapa ----------

function marcadorDe(id) {
  return marcadores[execucao.indiceLista[id]];
}

function pintar(ids, cor, raio = 8) {
  ids.forEach((id) => marcadorDe(id).setStyle(estiloMarcador(cor, raio)).setRadius(raio));
}

function latlngDe(id) {
  const p = execucao.pontos[id];
  return [p.lat, p.lon];
}

function linhaVertical(lon, estilo) {
  const [latMin, latMax] = execucao.limitesLat;
  return L.polyline([[latMin, lon], [latMax, lon]], estilo);
}

function retangulo(lonMin, lonMax, estilo) {
  const [latMin, latMax] = execucao.limitesLat;
  return L.rectangle([[latMin, lonMin], [latMax, lonMax]], estilo);
}

function linhaPar(par, estilo) {
  return L.polyline([latlngDe(par[0]), latlngDe(par[1])], estilo);
}

function contarComparacoes(eventos) {
  // mesma contagem que o backend: pares do caso base + comparações na faixa
  return eventos.reduce((soma, ev) => {
    if (ev.tipo === "base") return soma + (ev.pontos.length * (ev.pontos.length - 1)) / 2;
    if (ev.tipo === "faixa") return soma + ev.comparacoes.length;
    return soma;
  }, 0);
}

function desenharPasso() {
  const { resultado, passo } = execucao;
  const eventos = resultado.eventos;
  const fim = passo >= eventos.length;

  camadaPassos.clearLayers();
  desenharMarcadores();
  // pontos fora da execução ficam apagados; os da execução começam neutros
  execucao.pontos.forEach((_, id) => pintar([id], CORES.neutro, 7));

  // linhas de divisão já feitas ficam ao fundo, como contexto da recursão
  eventos.slice(0, fim ? eventos.length : passo).forEach((ev) => {
    if (ev.tipo === "dividir") {
      linhaVertical(ev.lon_linha, { color: "#555", weight: 1, opacity: 0.35, dashArray: "4 6" }).addTo(camadaPassos);
    }
  });

  $("m-fb").textContent = resultado.comparacoes_forca_bruta;

  if (fim) {
    desenharResultado();
    return;
  }

  const ev = eventos[passo];
  $("passo-num").textContent = `Passo ${passo + 1}/${eventos.length}`;
  $("passo-tipo").textContent = `${NOMES_TIPO[ev.tipo]} · nível ${ev.nivel}`;
  $("passo-msg").textContent = ev.mensagem;
  $("m-dc").textContent = contarComparacoes(eventos.slice(0, passo + 1));
  $("resultado").hidden = true;

  // sombreia o subproblema atual
  retangulo(ev.regiao_lon[0] - 0.02, ev.regiao_lon[1] + 0.02, {
    color: "#1d2433", weight: 0, fillOpacity: 0.06,
  }).addTo(camadaPassos);

  if (ev.tipo === "dividir") {
    pintar(ev.esquerda, CORES.esq, 8);
    pintar(ev.direita, CORES.dir, 8);
    linhaVertical(ev.lon_linha, { color: "#1d2433", weight: 2.5 }).addTo(camadaPassos);
  } else if (ev.tipo === "base") {
    pintar(ev.pontos, CORES.esq, 8);
    for (let i = 0; i < ev.pontos.length; i++) {
      for (let j = i + 1; j < ev.pontos.length; j++) {
        linhaPar([ev.pontos[i], ev.pontos[j]], { color: CORES.esq, weight: 1.5, dashArray: "4 4" }).addTo(camadaPassos);
      }
    }
    pintar(ev.par, CORES.par, 9);
    linhaPar(ev.par, { color: CORES.par, weight: 3.5 }).addTo(camadaPassos);
  } else if (ev.tipo === "faixa") {
    const lonMin = Math.max(ev.faixa_lon[0], ev.regiao_lon[0] - 0.02);
    const lonMax = Math.min(ev.faixa_lon[1], ev.regiao_lon[1] + 0.02);
    retangulo(lonMin, lonMax, { color: CORES.faixa, weight: 1, fillColor: CORES.faixa, fillOpacity: 0.15 }).addTo(camadaPassos);
    linhaVertical(ev.lon_linha, { color: "#1d2433", weight: 2.5 }).addTo(camadaPassos);
    pintar(ev.pontos_faixa, CORES.faixa, 8);
    ev.comparacoes.forEach((c) => {
      linhaPar([c.a, c.b], { color: CORES.faixa, weight: 1.5, dashArray: "4 4" })
        .bindTooltip(`${c.distancia_km} km`).addTo(camadaPassos);
    });
    pintar(ev.par, CORES.par, 9);
    linhaPar(ev.par, { color: CORES.par, weight: 3.5 }).addTo(camadaPassos);
  }
}

function desenharResultado() {
  const r = execucao.resultado;
  const [a, b] = r.par_ids;
  const pa = execucao.pontos[a], pb = execucao.pontos[b];

  $("passo-num").textContent = "Resultado";
  $("passo-tipo").textContent = "";
  $("passo-msg").textContent =
    `O dividir e conquistar fez ${r.comparacoes_dc} comparações, contra ${r.comparacoes_forca_bruta} da força bruta.`;
  $("m-dc").textContent = r.comparacoes_dc;

  pintar([a, b], CORES.par, 10);
  linhaPar([a, b], { color: CORES.par, weight: 5 }).addTo(camadaPassos);
  mapa.flyToBounds(L.latLngBounds([pa.lat, pa.lon], [pb.lat, pb.lon]).pad(1.5), { maxZoom: 14 });

  $("resultado").hidden = false;
  $("res-par").textContent = `${pa.nome} ↔ ${pb.nome}`;
  $("res-dist").textContent =
    `${r.distancia_real_km} km de distância real (${r.distancia_km} km no plano projetado usado pelo algoritmo).`;
}

// ---------- início ----------

fetch("/api/pontos")
  .then((r) => r.json())
  .then((lista) => {
    pontos = lista.map((p) => ({ ...p, ativo: true, proprio: false }));
    desenharTudo();
    mapa.fitBounds(L.latLngBounds(pontos.map((p) => [p.lat, p.lon])).pad(0.1));
  })
  .catch(() => mostrarErro("Não foi possível carregar os pontos."));
