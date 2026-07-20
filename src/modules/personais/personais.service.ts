import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizarTelefone } from '../../common/utils/telefone';
import { UpdatePersonalDto } from './dto/update-personal.dto';

@Injectable()
export class PersonaisService {
  constructor(private readonly prisma: PrismaService) {}

  async findSelf(id: number) {
    const personal = await this.prisma.personal.findUnique({ where: { id } });

    if (!personal) {
      throw new NotFoundException('Personal não encontrado.');
    }

    const { senha: _senha, ...result } = personal;
    return result;
  }

  async updateSelf(id: number, dto: UpdatePersonalDto) {
    const personal = await this.prisma.personal.findUnique({ where: { id } });

    if (!personal) {
      throw new NotFoundException('Personal não encontrado.');
    }

    // Telefone e senha são as credenciais de login: exigir a senha atual impede
    // que um token vazado seja convertido em tomada definitiva da conta.
    if (dto.senha || dto.telefone) {
      if (!dto.senhaAtual) {
        throw new BadRequestException(
          'Informe a senha atual para alterar telefone ou senha.',
        );
      }

      const senhaConfere = await bcrypt.compare(dto.senhaAtual, personal.senha);
      if (!senhaConfere) {
        throw new UnauthorizedException('Senha atual incorreta.');
      }
    }

    let hashedPassword: string | undefined = undefined;
    if (dto.senha) {
      const salt = await bcrypt.genSalt();
      hashedPassword = await bcrypt.hash(dto.senha, salt);
    }

    const telefone = dto.telefone
      ? normalizarTelefone(dto.telefone)
      : undefined;
    if (telefone) {
      const existingPersonal = await this.prisma.personal.findUnique({
        where: { telefone },
      });

      if (existingPersonal && existingPersonal.id !== id) {
        throw new ConflictException('Telefone já cadastrado.');
      }
    }

    const updatedPersonal = await this.prisma.personal.update({
      where: { id },
      data: {
        nome: dto.nome,
        telefone,
        senha: hashedPassword,
      },
    });

    const { senha: _senha, ...result } = updatedPersonal;
    return result;
  }
}
