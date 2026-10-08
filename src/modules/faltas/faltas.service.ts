import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  faltasAutomaticasHabilitado,
  faltasNotificacaoHabilitado,
} from '../../common/config/env';
import {
  dataLocal,
  deDbDate,
  FUSO_PADRAO,
  nomeDoDia,
  paraDbDate,
  somarDias,
} from '../../common/datas/fuso';
import { JobLockService } from '../../common/jobs/job-lock.service';
import {
  escolherMensagem,
  interpolar,
} from '../../common/messages/mensagens-falta';
import { PrismaService } from '../../common/prisma/prisma.service';
import { contarFaltasConsecutivas } from '../../common/sessoes/frequencia';
import { ehDiaDaAgenda, horarioDoDia } from '../../common/sessoes/regras';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

export type ResultadoJob =
  | { ignorado: 'flag-desligada' | 'em-execucao' }
  | {
      criadas: number;
      notificadasAluno: number;
      notificadasPersonal: number;
      erros: number;
    };

const CATCH_UP_DIAS = 3;
const JANELA_NOTIFICACAO_DIAS = 2;

@Injectable()
export class FaltasService {
  private readonly logger = new Logger(FaltasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly lock: JobLockService,
  ) {}

  async executar(agora = new Date()): Promise<ResultadoJob> {
    if (!faltasAutomaticasHabilitado()) return { ignorado: 'flag-desligada' };
    if (!(await this.lock.adquirir('fechamento-faltas'))) {
      return { ignorado: 'em-execucao' };
    }

    const r = {
      criadas: 0,
      notificadasAluno: 0,
      notificadasPersonal: 0,
      erros: 0,
    };
    try {
      r.criadas = await this.materializarFaltas(agora);
      if (faltasNotificacaoHabilitado()) {
        Object.assign(r, await this.notificarPendentes(agora));
      }
      return r;
    } finally {
      await this.lock.liberar('fechamento-faltas', r);
    }
  }

  /** Catch-up de 3 dias, idempotente (unique alunoId+data + skipDuplicates). */
  async materializarFaltas(agora: Date): Promise<number> {
    const agendas = await this.prisma.agendaTreino.findMany({
      where: { aluno: { ativo: true } },
      select: {
        alunoId: true,
        dias: true,
        horarios: true,
        acompanhamentoDesde: true,
        diasDesde: true,
        aluno: { select: { personal: { select: { fusoHorario: true } } } },
      },
    });

    const linhas: Prisma.SessaoTreinoCreateManyInput[] = [];
    for (const a of agendas) {
      const tz = a.aluno.personal?.fusoHorario ?? FUSO_PADRAO;
      const hoje = dataLocal(agora, tz);
      const desde = deDbDate(a.acompanhamentoDesde);
      const diasDesde = (a.diasDesde ?? {}) as Record<string, string>;

      for (let n = 1; n <= CATCH_UP_DIAS; n++) {
        const d = somarDias(hoje, -n);
        if (d < desde || !ehDiaDaAgenda(d, a.dias)) continue;

        const dia = new Date(`${d}T12:00:00Z`).getUTCDay();
        // Dia da semana adicionado depois não gera falta retroativa.
        const desdeDoDia = diasDesde[String(dia)];
        if (desdeDoDia && d < desdeDoDia) continue;
        linhas.push({
          alunoId: a.alunoId,
          data: paraDbDate(d),
          prevista: true,
          status: 'FALTA',
          origem: 'AUTOMATICA',
          modalidade: horarioDoDia(a.horarios, dia)?.modalidade ?? null,
        });
      }
    }

    if (linhas.length === 0) return 0;
    const { count } = await this.prisma.sessaoTreino.createMany({
      data: linhas,
      skipDuplicates: true,
    });
    return count;
  }

  async notificarPendentes(agora: Date) {
    const resultado = { notificadasAluno: 0, notificadasPersonal: 0, erros: 0 };
    const limite = paraDbDate(
      somarDias(dataLocal(agora, FUSO_PADRAO), -JANELA_NOTIFICACAO_DIAS),
    );

    const paraAluno = await this.prisma.sessaoTreino.findMany({
      where: {
        status: 'FALTA',
        notificadoAlunoEm: null,
        data: { gte: limite },
        aluno: { ativo: true },
      },
      select: { id: true },
    });

    for (const { id } of paraAluno) {
      try {
        if (await this.notificarAluno(id)) resultado.notificadasAluno++;
      } catch (e) {
        resultado.erros++;
        this.logger.error(`Falha ao notificar falta ${id}: ${String(e)}`);
      }
    }

    try {
      resultado.notificadasPersonal = await this.notificarPersonais(limite);
    } catch (e) {
      resultado.erros++;
      this.logger.error(`Falha ao notificar personais: ${String(e)}`);
    }

    return resultado;
  }

  /** Notifica o aluno de uma falta. Retorna true se um push foi enviado. */
  async notificarAluno(sessaoId: number): Promise<boolean> {
    // Reserva: se outra execução já cuidou, count !== 1 e encerra.
    const reserva = await this.prisma.sessaoTreino.updateMany({
      where: { id: sessaoId, status: 'FALTA', notificadoAlunoEm: null },
      data: { notificadoAlunoEm: new Date() },
    });
    if (reserva.count !== 1) return false;

    const sessao = await this.prisma.sessaoTreino.findUnique({
      where: { id: sessaoId },
      select: {
        alunoId: true,
        data: true,
        aluno: { select: { nome: true } },
      },
    });
    if (!sessao) return false;

    const dataStr = deDbDate(sessao.data);
    const previstas = await this.prisma.sessaoTreino.findMany({
      where: {
        alunoId: sessao.alunoId,
        prevista: true,
        data: { lte: sessao.data },
      },
      orderBy: { data: 'desc' },
      take: 10,
      select: {
        id: true,
        data: true,
        prevista: true,
        status: true,
        repostaPor: { select: { id: true } },
      },
    });
    const consecutivas = contarFaltasConsecutivas(
      previstas.map((p) => ({ ...p, data: deDbDate(p.data) })),
    );

    const recentes = (
      await this.prisma.sessaoTreino.findMany({
        where: {
          alunoId: sessao.alunoId,
          mensagemChave: { not: null },
          id: { not: sessaoId },
        },
        orderBy: { data: 'desc' },
        take: 3,
        select: { mensagemChave: true },
      })
    ).map((r) => r.mensagemChave as string);

    const mensagem = escolherMensagem(
      consecutivas >= 2 ? 'consecutiva' : 'avulsa',
      recentes,
    );
    const vars = {
      nome: sessao.aluno.nome.split(' ')[0],
      dia: nomeDoDia(dataStr),
      n: consecutivas,
    };

    const envio = await this.notificacoes.enviarParaUsuario(
      { alunoId: sessao.alunoId },
      {
        title: interpolar(mensagem.titulo, vars),
        body: interpolar(mensagem.corpo, vars),
        url: `/dashboard/aluno/progresso?sessao=${sessaoId}&acao=justificar`,
        tag: `falta-${sessaoId}`,
      },
    );

    // Havia inscrições, nada saiu e houve falha transitória: desfaz a reserva
    // para a execução de backup (09:15) tentar de novo.
    if (
      envio.inscricoes > 0 &&
      envio.enviados === 0 &&
      envio.falhasTransitorias > 0
    ) {
      await this.prisma.sessaoTreino.update({
        where: { id: sessaoId },
        data: { notificadoAlunoEm: null },
      });
      return false;
    }

    await this.prisma.sessaoTreino.update({
      where: { id: sessaoId },
      data: { mensagemChave: mensagem.chave },
    });
    return envio.enviados > 0;
  }

  /** Uma mensagem por personal e por data (individual ou consolidada). */
  private async notificarPersonais(limite: Date): Promise<number> {
    const faltas = await this.prisma.sessaoTreino.findMany({
      where: {
        status: 'FALTA',
        origem: 'AUTOMATICA',
        notificadoPersonalEm: null,
        data: { gte: limite },
        aluno: { ativo: true, personalId: { not: null } },
      },
      select: {
        id: true,
        alunoId: true,
        data: true,
        aluno: { select: { nome: true, personalId: true } },
      },
      orderBy: { data: 'asc' },
    });

    const grupos = new Map<string, typeof faltas>();
    for (const f of faltas) {
      const chave = `${f.aluno.personalId}|${deDbDate(f.data)}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), f]);
    }

    let enviadas = 0;
    for (const [chave, itens] of grupos) {
      const [personalIdStr, data] = chave.split('|');
      const personalId = Number(personalIdStr);
      const ids = itens.map((i) => i.id);

      const reserva = await this.prisma.sessaoTreino.updateMany({
        where: { id: { in: ids }, notificadoPersonalEm: null },
        data: { notificadoPersonalEm: new Date() },
      });
      if (reserva.count === 0) continue;

      const [, mes, dia] = data.split('-');
      const dataCurta = `${dia}/${mes}`;
      const nomes = itens.map((i) => i.aluno.nome.split(' ')[0]);

      let payload;
      if (itens.length === 1) {
        const seguidas = await this.faltasConsecutivasDoAluno(itens[0].alunoId);
        payload = {
          title: 'Ausência registrada',
          body: `${itens[0].aluno.nome} faltou ao treino de ${nomeDoDia(data)} (${dataCurta})${
            seguidas >= 2 ? ` — ${seguidas}ª seguida.` : '.'
          }`,
          url: `/dashboard/admin/alunos/${itens[0].alunoId}`,
          tag: `ausencias-${data}`,
        };
      } else {
        const resto = nomes.length - 2;
        payload = {
          title: 'Ausências de ontem',
          body: `${nomes.length} alunos faltaram ontem: ${nomes[0]}, ${nomes[1]}${
            resto > 0 ? ` e mais ${resto}` : ''
          }.`,
          url: '/dashboard/admin/alunos?filtro=alertas',
          tag: `ausencias-${data}`,
        };
      }

      const envio = await this.notificacoes.enviarParaUsuario(
        { personalId },
        payload,
      );
      if (
        envio.inscricoes > 0 &&
        envio.enviados === 0 &&
        envio.falhasTransitorias > 0
      ) {
        await this.prisma.sessaoTreino.updateMany({
          where: { id: { in: ids } },
          data: { notificadoPersonalEm: null },
        });
      } else if (envio.enviados > 0) {
        enviadas++;
      }
    }
    return enviadas;
  }

  private async faltasConsecutivasDoAluno(alunoId: number): Promise<number> {
    const previstas = await this.prisma.sessaoTreino.findMany({
      where: { alunoId, prevista: true },
      orderBy: { data: 'desc' },
      take: 10,
      select: {
        data: true,
        prevista: true,
        status: true,
        repostaPor: { select: { id: true } },
      },
    });
    return contarFaltasConsecutivas(
      previstas.map((p) => ({ ...p, data: deDbDate(p.data) })),
    );
  }
}
