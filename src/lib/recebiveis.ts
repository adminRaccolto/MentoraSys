// Saldo ainda em aberto de um lançamento financeiro (Recebivel ou ContaPagar)
// — relevante para status PARCIAL, onde `valor` continua sendo o valor cheio
// e o que falta é `valor - valor_pago`.
function saldoEmAberto(r: { valor: unknown; valor_pago: unknown }): number {
  return Number(r.valor) - Number(r.valor_pago ?? 0);
}

export const saldoRecebivel = saldoEmAberto;
export const saldoContaPagar = saldoEmAberto;
