import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { SaveAgendaDto } from './dto/save-agenda.dto';

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async findAllByPersonal(personalId: number) {
    const agendas = await this.prisma.agendaTreino.findMany({
      where: { personalId },
      orderBy: { alunoId: 'asc' },
    });

    return agendas.map((agenda) => ({
      alunoId: agenda.alunoId,
      dias: agenda.dias,
      horarios: agenda.horarios ?? {},
    }));
  }

  async save(personalId: number, alunoId: number, dto: SaveAgendaDto) {
    await this.ownership.assertAlunoPertenceAoPersonal(alunoId, personalId);

    await this.prisma.agendaTreino.upsert({
      where: { alunoId },
      create: {
        personalId,
        alunoId,
        dias: dto.dias,
        horarios: dto.horarios ?? {},
      },
      update: {
        personalId,
        dias: dto.dias,
        horarios: dto.horarios ?? {},
      },
    });

    return this.findAllByPersonal(personalId);
  }

  async remove(personalId: number, alunoId: number) {
    await this.ownership.assertAlunoPertenceAoPersonal(alunoId, personalId);

    await this.prisma.agendaTreino.deleteMany({
      where: { alunoId, personalId },
    });

    return this.findAllByPersonal(personalId);
  }
}
