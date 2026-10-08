import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { formatarHoraSp } from './data-sp.util';

export type TipoLembrete = 'VESPERA' | 'DIA';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Notificações com a mesma tag substituem a anterior no sistema operacional. */
  tag?: string;
}

export type Destino = { alunoId: number } | { personalId: number };

export interface ResultadoEnvio {
  inscricoes: number;
  enviados: number;
  falhasTransitorias: number;
}

interface AgendamentoLembrete {
  id: number;
  alunoId: number;
  personalId: number | null;
  dataAgendada: Date;
  aluno?: { nome: string } | null;
}

export interface UsuarioPush {
  id: number;
  role: string;
}

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  private readonly pushHabilitado: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    this.pushHabilitado = Boolean(publicKey && privateKey);

    if (this.pushHabilitado) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? 'mailto:contato@up4life.app',
        publicKey as string,
        privateKey as string,
      );
    } else {
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — envio de push desabilitado.',
      );
    }
  }

  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
  }

  async status(usuario: UsuarioPush) {
    const total = await this.prisma.pushSubscription.count({
      where:
        usuario.role === 'PERSONAL'
          ? { personalId: usuario.id }
          : { alunoId: usuario.id },
    });

    return { subscribed: total > 0 };
  }

  async subscribe(usuario: UsuarioPush, dto: SubscribePushDto) {
    const dono =
      usuario.role === 'PERSONAL'
        ? { alunoId: null, personalId: usuario.id }
        : { alunoId: usuario.id, personalId: null };

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        ...dono,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        ...dono,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });

    return { message: 'Notificações ativadas com sucesso.' };
  }

  async unsubscribe(usuario: UsuarioPush, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        ...(usuario.role === 'PERSONAL'
          ? { personalId: usuario.id }
          : { alunoId: usuario.id }),
      },
    });

    return { message: 'Notificações desativadas com sucesso.' };
  }

  /**
   * Envia o push a todas as inscrições do destino. Inscrições mortas (404/410)
   * são removidas; erros 5xx/rede contam como falhas transitórias para que o
   * chamador possa tentar de novo.
   */
  async enviarParaUsuario(
    destino: Destino,
    payload: PushPayload,
  ): Promise<ResultadoEnvio> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: destino,
    });
    const resultado: ResultadoEnvio = {
      inscricoes: subscriptions.length,
      enviados: 0,
      falhasTransitorias: 0,
    };

    if (!this.pushHabilitado) {
      // Sem chaves VAPID nada é entregue; conta como transitório para que a
      // reserva seja desfeita e o envio ocorra quando a configuração existir.
      resultado.falhasTransitorias = subscriptions.length;
      return resultado;
    }

    const json = JSON.stringify(payload);
    const rotulo =
      'alunoId' in destino
        ? `aluno ${destino.alunoId}`
        : `personal ${destino.personalId}`;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            json,
          );
          resultado.enviados++;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;

          // 404/410: o aparelho revogou a permissão — a subscription está morta.
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch((deleteError) =>
                this.logger.error(
                  `Falha ao remover subscription morta ${sub.id}: ${String(deleteError)}`,
                ),
              );
          } else {
            resultado.falhasTransitorias++;
            this.logger.error(
              `Falha ao enviar push para ${rotulo}: ${String(error)}`,
            );
          }
        }
      }),
    );

    return resultado;
  }

  async enviarLembreteAvaliacao(
    agendamento: AgendamentoLembrete,
    tipo: TipoLembrete,
  ) {
    const hora = formatarHoraSp(agendamento.dataAgendada);
    const quando = tipo === 'VESPERA' ? 'amanhã' : 'hoje';

    const resultados: ResultadoEnvio[] = [];

    resultados.push(
      await this.enviarParaUsuario(
        { alunoId: agendamento.alunoId },
        {
          title: 'Up4Life — Avaliação física',
          body: `Sua avaliação física é ${quando} às ${hora}. 💪`,
          url: '/dashboard/aluno/avaliacoes',
        },
      ),
    );

    if (agendamento.personalId != null) {
      const nomeAluno = agendamento.aluno?.nome ?? 'seu aluno';
      resultados.push(
        await this.enviarParaUsuario(
          { personalId: agendamento.personalId },
          {
            title: 'Up4Life — Avaliação agendada',
            body: `Avaliação de ${nomeAluno} é ${quando} às ${hora}. 📋`,
            url: '/dashboard/admin/avaliacoes',
          },
        ),
      );
    }

    // Falha transitória em todos os destinos com inscrição: não marca o
    // lembrete como enviado, para os gatilhos seguintes (ex.: backup das
    // 09:15) tentarem de novo. Sem inscrições não há o que reenviar.
    const comInscricao = resultados.filter((r) => r.inscricoes > 0);
    const todosFalharam =
      comInscricao.length > 0 &&
      comInscricao.every((r) => r.enviados === 0 && r.falhasTransitorias > 0);
    if (todosFalharam) {
      this.logger.warn(
        `Lembrete ${tipo} do agendamento ${agendamento.id} não enviado (falha transitória); será tentado novamente.`,
      );
      return;
    }

    await this.prisma.agendamentoAvaliacao.update({
      where: { id: agendamento.id },
      data:
        tipo === 'VESPERA'
          ? { lembreteVesperaEm: new Date() }
          : { lembreteDiaEm: new Date() },
    });
  }
}
