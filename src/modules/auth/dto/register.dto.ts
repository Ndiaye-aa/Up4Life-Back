import { IsNotEmpty, IsString, IsPhoneNumber, IsOptional, IsNumber } from 'class-validator';

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
  senha: string;
}

export class RegisterAlunoDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsPhoneNumber('BR')
  @IsString()
  telefone: string;

  @IsNotEmpty()
  @IsString()
  senha: string;

  @IsNotEmpty()
  @IsNumber()
  personalId: number;
}
