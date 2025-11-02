const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const RESERVAS_FILE = path.join(__dirname, 'reservas.json');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

function carregarReservas() {
  try {
    if (fs.existsSync(RESERVAS_FILE)) {
      const data = fs.readFileSync(RESERVAS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erro ao carregar reservas:', error);
  }
  return {};
}

function salvarReservas(reservas) {
  try {
    fs.writeFileSync(RESERVAS_FILE, JSON.stringify(reservas, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar reservas:', error);
    return false;
  }
}

function gerarIdReserva() {
  return 'RES' + Date.now() + Math.random().toString(36).substr(2, 5);
}

function formatarMenu() {
  return `🏨 *SISTEMA DE RESERVAS* 🏨

Por favor, escolha uma opção:

1️⃣ *Fazer reserva* - Reserve seu quarto ou espaço
2️⃣ *Consultar reservas* - Veja suas reservas ativas  
3️⃣ *Cancelar reserva* - Cancele uma reserva existente
4️⃣ *Falar com suporte* - Fale com nosso atendimento

*Digite o número da opção desejada:*`;
}

client.on('qr', (qr) => {
  console.log('📱 Escaneie o QR Code abaixo para conectar no WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Bot conectado e pronto!');
});

client.on('message', async (message) => {
  try {
    const contato = message.from;
    const texto = message.body.trim();

    if (texto === '1') {
      const reservas = carregarReservas();
      const idReserva = gerarIdReserva();
      
      reservas[idReserva] = {
        id: idReserva,
        contato: contato,
        dataCriacao: new Date().toISOString(),
        status: 'pendente',
        detalhes: 'Reserva criada - aguardando informações'
      };
      
      if (salvarReservas(reservas)) {
        await message.reply(`✅ *Reserva criada com sucesso!*

📋 *ID da Reserva:* ${idReserva}
📅 *Data:* ${new Date().toLocaleString('pt-BR')}
🔄 *Status:* Pendente

Por favor, nos envie as seguintes informações:
• Nome completo
• Data desejada
• Quantidade de pessoas
• Tipo de quarto/espaço

*Responda nesta mesma conversa.*`);
      } else {
        await message.reply('❌ Erro ao criar reserva. Tente novamente.');
      }
      
    } else if (texto === '2') {
      const reservas = carregarReservas();
      const reservasUsuario = Object.values(reservas).filter(
        reserva => reserva.contato === contato
      );
      
      if (reservasUsuario.length === 0) {
        await message.reply('📭 Você não possui reservas ativas.');
      } else {
        let mensagemReservas = '📋 *SUAS RESERVAS*\n\n';
        
        reservasUsuario.forEach((reserva, index) => {
          mensagemReservas += `*Reserva ${index + 1}:*
🆔 ID: ${reserva.id}
📅 Data: ${new Date(reserva.dataCriacao).toLocaleString('pt-BR')}
🔄 Status: ${reserva.status}
📝 Detalhes: ${reserva.detalhes}

`;
        });
        
        await message.reply(mensagemReservas);
      }
      
    } else if (texto === '3') {
      const reservas = carregarReservas();
      const reservasUsuario = Object.values(reservas).filter(
        reserva => reserva.contato === contato
      );
      
      if (reservasUsuario.length === 0) {
        await message.reply('📭 Você não possui reservas para cancelar.');
      } else {
        let mensagemCancelar = '❌ *CANCELAR RESERVA*\n\nSelecione a reserva para cancelar:\n\n';
        
        reservasUsuario.forEach((reserva, index) => {
          mensagemCancelar += `${index + 1}. ${reserva.id} - ${reserva.detalhes}\n`;
        });
        
        mensagemCancelar += '\n*Digite o número da reserva que deseja cancelar:*';
        await message.reply(mensagemCancelar);
      }
      
    } else if (texto === '4') {
      await message.reply(`👨‍💼 *SUPORTE AO CLIENTE*

Nossa equipe de suporte entrará em contato em breve.

📞 *Contato do suporte:* +55 (11) 99999-9999
📧 *E-mail:* suporte@empresa.com
⏰ *Horário:* Segunda a Sexta, 9h às 18h

Enquanto isso, você pode continuar usando nosso menu de opções.`);
      
    } else if (/^[1-4]$/.test(texto)) {
      await message.reply(formatarMenu());
      
    } else if (/^[1-9][0-9]*$/.test(texto) && texto.length > 1) {
      const reservas = carregarReservas();
      const reservasUsuario = Object.values(reservas).filter(
        reserva => reserva.contato === contato
      );
      
      const numero = parseInt(texto);
      if (numero >= 1 && numero <= reservasUsuario.length) {
        const reservaCancelar = reservasUsuario[numero - 1];
        delete reservas[reservaCancelar.id];
        
        if (salvarReservas(reservas)) {
          await message.reply(`✅ Reserva *${reservaCancelar.id}* cancelada com sucesso!`);
        } else {
          await message.reply('❌ Erro ao cancelar reserva. Tente novamente.');
        }
      } else {
        await message.reply('❌ Número de reserva inválido. Use o menu anterior.');
      }
      
    } else if (Object.values(carregarReservas()).some(reserva => 
      reserva.contato === contato && reserva.status === 'pendente' && 
      !['1','2','3','4'].includes(texto)
    )) {
      const reservas = carregarReservas();
      const reservaPendente = Object.values(reservas).find(
        reserva => reserva.contato === contato && reserva.status === 'pendente'
      );
      
      if (reservaPendente) {
        reservaPendente.detalhes = texto;
        reservaPendente.status = 'confirmada';
        reservaPendente.dataConfirmacao = new Date().toISOString();
        
        if (salvarReservas(reservas)) {
          await message.reply(`✅ *Reserva confirmada!*

📋 *ID:* ${reservaPendente.id}
📝 *Detalhes:* ${texto}
📅 *Data da confirmação:* ${new Date().toLocaleString('pt-BR')}

Agradecemos pela sua reserva! Em breve entraremos em contato.`);
        }
      }
      
    } else if (!['1','2','3','4'].includes(texto) && !/^[1-9][0-9]*$/.test(texto)) {
      await message.reply(formatarMenu());
    }
    
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    await message.reply('❌ Ocorreu um erro. Tente novamente.');
  }
});

client.initialize();

console.log('🚀 Iniciando bot de WhatsApp...');
console.log('📋 Instruções:');
console.log('1. Execute: npm install');
console.log('2. Execute: npm start');
console.log('3. Escaneie o QR Code com seu WhatsApp');
console.log('4. Envie qualquer mensagem para ver o menu');
