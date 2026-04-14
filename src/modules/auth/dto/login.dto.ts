import { IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsPhoneNumber('BR') // Assumindo registro BR - ou pode ser retirado countryCode
  @IsString()
  telefone: string;

  @IsNotEmpty()
  @IsString()
  senha: string;
}
