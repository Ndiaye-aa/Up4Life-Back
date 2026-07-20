import { CreateTreinoDto } from './create-treino.dto';

// O update substitui o treino por completo (mesmo payload da criação).
export class UpdateTreinoDto extends CreateTreinoDto {}
