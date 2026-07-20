import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterPersonalDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsPhoneNumber('BR')
  @IsString()
  telefone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  senha: string;
}
