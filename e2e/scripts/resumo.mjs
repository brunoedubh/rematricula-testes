// Reporter do Playwright: resumo de cada execução em resultados/<id>.json (PLANO.md 5).
// Atualiza o arquivo a cada teste, então a tela acompanha o progresso só lendo o arquivo.
// Sem dependência do Nuxt: o mesmo arquivo sai no terminal e no pipeline.
import fs from 'node:fs';
import path from 'node:path';

/** Execuções guardadas (json + capturas/traces). As mais antigas saem no fim de cada execução. */
const MANTER = Number(process.env.E2E_MANTER_EXECUCOES) || 30;

const SITUACAO_TESTE = { expected: 'passou', unexpected: 'falhou', flaky: 'instavel', skipped: 'pulado' };
const SITUACAO_FIM = { passed: 'concluida', failed: 'concluida', timedout: 'interrompida', interrupted: 'interrompida' };

const semCores = s => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

export default class ResumoReporter {
  constructor(opcoes = {}) {
    this.pasta = opcoes.pasta || 'resultados';
  }

  printsToStdio() {
    return false;
  }

  onBegin(config, suite) {
    this.raiz = path.dirname(config.configFile || path.join(process.cwd(), 'x'));
    this.id = process.env.E2E_EXECUCAO;
    this.arquivo = path.join(this.raiz, this.pasta, `${this.id}.json`);
    this.resumo = {
      id: this.id,
      alvo: config.projects[0]?.use?.baseURL ?? '',
      origem: process.env.E2E_ORIGEM || 'linha-de-comando',
      iniciadoPor: process.env.E2E_INICIADO_POR || undefined,
      inicio: new Date().toISOString(),
      fim: undefined,
      situacao: 'rodando',
      dispositivos: [...new Set(suite.allTests().map(t => t.parent.project()?.name).filter(Boolean))],
      cenarios: process.env.E2E_CENARIOS ? process.env.E2E_CENARIOS.split(',') : undefined,
      total: suite.allTests().length,
      totais: { passou: 0, falhou: 0, instavel: 0, pulado: 0 },
      testes: [],
      erros: [],
    };
    this.salvar();
  }

  onTestEnd(test, result) {
    // Com retries, só o último resultado conta.
    if (result.status !== 'passed' && result.status !== 'skipped' && result.retry < test.retries) return;

    const situacao = SITUACAO_TESTE[test.outcome()] ?? 'falhou';
    const anotacao = tipo => test.annotations.filter(a => a.type === tipo).map(a => a.description);
    const anexo = nome => {
      const a = result.attachments.find(x => x.name === nome && x.path);
      return a ? path.relative(this.raiz, a.path).split(path.sep).join('/') : undefined;
    };

    this.resumo.testes.push({
      cenario: test.title.match(/\[([a-z0-9-]+)\]\s*$/)?.[1] ?? test.title,
      titulo: test.title.replace(/\s*\[[a-z0-9-]+\]\s*$/, ''),
      dispositivo: test.parent.project()?.name ?? '',
      situacao,
      duracaoMs: Math.round(result.duration),
      rotaEsperada: anotacao('rota-esperada')[0],
      rotaObtida: anotacao('rota-obtida')[0],
      semGravacao: anotacao('sem-gravacao'),
      motivo: situacao === 'pulado' ? anotacao('skip')[0] : undefined,
      erro: result.error ? semCores(result.error.message).split('\n').slice(0, 12).join('\n') : undefined,
      captura: anexo('screenshot'),
      trace: anexo('trace'),
    });
    this.resumo.totais[situacao]++;
    this.salvar();
  }

  onError(error) {
    this.resumo?.erros.push(semCores(error.message ?? error.value ?? String(error)).slice(0, 2000));
  }

  onEnd(result) {
    if (!this.resumo) return;
    this.resumo.fim = new Date().toISOString();
    this.resumo.situacao = this.resumo.erros.length && !this.resumo.testes.length ? 'falhou' : (SITUACAO_FIM[result.status] ?? 'concluida');
    this.salvar();
    this.limpar();
  }

  salvar() {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(this.resumo, null, 2));
  }

  /** Mantém só as MANTER execuções mais recentes (o id começa pela data, então ordena por nome). */
  limpar() {
    const pasta = path.dirname(this.arquivo);
    const ids = fs.readdirSync(pasta).filter(f => /^\d{8}-\d{6}-.+\.json$/.test(f)).map(f => f.slice(0, -5)).sort();
    for (const id of ids.slice(0, Math.max(0, ids.length - MANTER))) {
      fs.rmSync(path.join(pasta, `${id}.json`), { force: true });
      fs.rmSync(path.join(pasta, id), { recursive: true, force: true });
    }
  }
}
