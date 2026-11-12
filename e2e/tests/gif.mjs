// GIF do teste realizado (aba Execução), além da captura final do Playwright.
// O ffmpeg que vem com o Playwright não gera GIF, então os quadros saem do screencast do Chromium (CDP)
// e o GIF é montado aqui em JS puro (jpeg-js + gifenc). Falha ao gerar o GIF nunca derruba o teste.
import { test as base } from '@playwright/test';
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

/** Desliga com E2E_GIF=0. */
const LIGADO = process.env.E2E_GIF !== '0';
const MAX_QUADROS = 120;
const ATRASO_MIN = 40; // ms (o GIF arredonda para centésimos)
const ATRASO_MAX = 2500;
const SEGURA_FIM = 2000; // última tela fica mais tempo antes de repetir

export const test = base.extend({
  gravarGif: [async ({ page, browserName }, use, info) => {
    if (!LIGADO || browserName !== 'chromium') return use();

    const quadros = [];
    let cdp;
    try {
      cdp = await page.context().newCDPSession(page);
      cdp.on('Page.screencastFrame', f => {
        quadros.push({ dados: f.data, t: f.metadata.timestamp * 1000 });
        cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 800, maxHeight: 800 });
    } catch {
      cdp = undefined;
    }

    await use();

    if (!cdp) return;
    try {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
      if (!quadros.length) return;
      const arquivo = info.outputPath('execucao.gif');
      fs.writeFileSync(arquivo, montarGif(quadros));
      info.attachments.push({ name: 'gif', path: arquivo, contentType: 'image/gif' });
    } catch {
      // Sem GIF; a captura e o trace continuam.
    }
  }, { auto: true }],
});

export { expect } from '@playwright/test';

/** Quadros do screencast ({dados: jpeg base64, t: ms}) → GIF animado em loop. */
export function montarGif(quadros) {
  // Atraso de cada quadro = tempo até o próximo (o screencast só manda quadro quando a tela muda).
  let lista = quadros.map((q, i) => ({ ...q, atraso: i + 1 < quadros.length ? quadros[i + 1].t - q.t : SEGURA_FIM }));
  // Muitos quadros: junta os vizinhos somando o tempo, para o arquivo não crescer demais.
  if (lista.length > MAX_QUADROS) {
    const passo = Math.ceil(lista.length / MAX_QUADROS);
    const juntos = [];
    for (let i = 0; i < lista.length; i += passo) {
      const grupo = lista.slice(i, i + passo);
      juntos.push({ ...grupo[0], atraso: grupo.reduce((s, q) => s + q.atraso, 0) });
    }
    juntos[juntos.length - 1] = { ...lista[lista.length - 1], atraso: SEGURA_FIM };
    lista = juntos;
  }

  const gif = GIFEncoder();
  let largura, altura;
  for (const q of lista) {
    const img = jpeg.decode(Buffer.from(q.dados, 'base64'), { useTArray: true, formatAsRGBA: true });
    // A tela pode mudar de tamanho no meio (raro): o GIF fica no tamanho do primeiro quadro.
    largura ??= img.width;
    altura ??= img.height;
    const rgba = img.width === largura && img.height === altura ? img.data : ajustar(img, largura, altura);
    const paleta = quantize(rgba, 256);
    const indices = applyPalette(rgba, paleta);
    const atraso = Math.min(ATRASO_MAX, Math.max(ATRASO_MIN, Math.round(q.atraso)));
    gif.writeFrame(indices, largura, altura, { palette: paleta, delay: atraso, repeat: 0 });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

/** Recorta/completa (com branco) um quadro para largura × altura. */
function ajustar(img, largura, altura) {
  const saida = new Uint8Array(largura * altura * 4).fill(255);
  const w = Math.min(largura, img.width);
  for (let y = 0; y < Math.min(altura, img.height); y++) {
    saida.set(img.data.subarray(y * img.width * 4, (y * img.width + w) * 4), y * largura * 4);
  }
  return saida;
}
