/** Erro com o status HTTP que a API deve devolver. */
export class Erro extends Error { constructor(public status: number, msg: string) { super(msg); } }
