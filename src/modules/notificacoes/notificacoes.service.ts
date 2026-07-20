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

  async enviarParaAluno(alunoId: number, payload: PushPayload) {
    await this.enviarPara({ alunoId }, payload, `aluno ${alunoId}`);
  }

  async enviarParaPersonal(personalId: number, payload: PushPayload) {
    await this.enviarPara({ personalId }, payload, `personal ${personalId}`);
  }

  private async enviarPara(
    where: { alunoId: number } | { personalId: number },
    payload: PushPayload,
    destino: string,
  ) {
    if (!this.pushHabilitado) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where,
    });

    const json = JSON.stringify(payload);

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
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;

          // 404/410: o aparelho revogou a permissão — a subscription está morta.
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => undefined);
          } else {
            this.logger.error(
              `Falha ao enviar push para ${destino}: ${String(error)}`,
            );
          }
        }
      }),
    );
  }

  async enviarLembreteAvaliacao(
    agendamento: AgendamentoLembrete,
    tipo: TipoLembrete,
  ) {
    const hora = formatarHoraSp(agendamento.dataAgendada);
    const quando = tipo === 'VESPERA' ? 'amanhã' : 'hoje';

    await this.enviarParaAluno(agendamento.alunoId, {
      title: 'Up4Life — Avaliação física',
      body: `Sua avaliação física é ${quando} às ${hora}. 💪`,
      url: '/dashboard/aluno/avaliacoes',
    });

    if (agendamento.personalId != null) {
      const nomeAluno = agendamento.aluno?.nome ?? 'seu aluno';
      await this.enviarParaPersonal(agendamento.personalId, {
        title: 'Up4Life — Avaliação agendada',
        body: `Avaliação de ${nomeAluno} é ${quando} às ${hora}. 📋`,
        url: '/dashboard/admin/avaliacoes',
      });
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
