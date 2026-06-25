/**
 * Serviço de SMS — stub configurável.
 * Para produção, substituir o corpo de `enviarSms` pelo provider escolhido
 * (Twilio, Zenvia, AWS SNS, etc.). A interface permanece a mesma.
 */
export async function enviarSms(celular: string, mensagem: string): Promise<void> {
  // Em produção: chamar API do provider aqui
  // Ex Twilio:
  //   const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  //   await client.messages.create({ body: mensagem, from: "+15...", to: celular });

  console.log(`[SMS] → ${celular}: ${mensagem}`);
}

export function gerarOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
