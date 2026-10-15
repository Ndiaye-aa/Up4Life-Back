import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAlongamentoDto } from './dto/create-alongamento.dto';
import { UpdateAlongamentoDto } from './dto/update-alongamento.dto';

@Injectable()
export class AlongamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAlongamentoDto) {
    try {
      return await this.prisma.alongamento.create({
        data: {
          nome: dto.nome,
          grupoMuscular: dto.grupoMuscular,
          descricao: dto.descricao,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um alongamento com esse nome.');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateAlongamentoDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const atual = await tx.alongamento.findUnique({ where: { id } });
        if (!atual) {
          throw new NotFoundException('Alongamento não encontrado.');
        }
        const atualizado = await tx.alongamento.update({
          where: { id },
          data: dto,
        });
        // Itens de treino guardam o nome (sem FK): acompanha a renomeação.
        if (dto.nome && dto.nome !== atual.nome) {
          await tx.itemTreino.updateMany({
            where: { exercicio: atual.nome, treino: { tipo: 'ALONGAMENTO' } },
            data: { exercicio: dto.nome },
          });
        }
        return atualizado;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um alongamento com esse nome.');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.alongamento.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Alongamento não encontrado.');
      }
      throw error;
    }
    return { id, removido: true };
  }

  async findAll() {
    return this.prisma.alongamento.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async findByGrupo(grupoMuscular: string) {
    return this.prisma.alongamento.findMany({
      where: { grupoMuscular },
      orderBy: { nome: 'asc' },
    });
  }

  async listFavoritos(personalId: number) {
    const favoritos = await this.prisma.alongamentoFavorito.findMany({
      where: { personalId },
      select: { alongamentoId: true },
    });
    return favoritos.map((f) => f.alongamentoId);
  }

  async favoritar(alongamentoId: number, personalId: number) {
    const alongamento = await this.prisma.alongamento.findUnique({
      where: { id: alongamentoId },
      select: { id: true },
    });
    if (!alongamento) {
      throw new NotFoundException('Alongamento não encontrado.');
    }

    await this.prisma.alongamentoFavorito.upsert({
      where: { personalId_alongamentoId: { personalId, alongamentoId } },
      create: { personalId, alongamentoId },
      update: {},
    });
    return { alongamentoId, favorito: true };
  }

  async desfavoritar(alongamentoId: number, personalId: number) {
    await this.prisma.alongamentoFavorito.deleteMany({
      where: { personalId, alongamentoId },
    });
    return { alongamentoId, favorito: false };
  }
}
