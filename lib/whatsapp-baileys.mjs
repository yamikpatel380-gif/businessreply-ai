import fs from 'node:fs';

// Baileys replaces whatsapp-web.js so QR does not depend on the changing
// WAWebSocketModel.Socket module inside WhatsApp Web's browser application.
// This remains an UNOFFICIAL linked-device interface, not Meta Cloud API.
export function createWhatsAppConnector({authDir,onStatus,onMessage,onDiagnostic=()=>{},loadLibrary,encodeQR}) {
  const dynamicLibrary=loadLibrary || (()=>import('@whiskeysockets/baileys'));
  const qrEncoder=encodeQR || (async(qr)=>{const {default:QRCode}=await import('qrcode');return QRCode.toDataURL(qr,{width:340,margin:2});});
  let sock=null, active=false, generation=0, reconnects=0;
  let serverClose=false;
  let disconnectReason=null;
  let qrLastAt=0;
  const status=(s)=>{ if(active) onStatus(s); };

  async function connect() {
    if(!active) return;
    const mine=++generation;
    const mod=await dynamicLibrary();
    const makeWASocket=mod.default;
    if(typeof makeWASocket!=='function' || !mod.useMultiFileAuthState) throw new Error('Baileys package import is not compatible');
    const {state,saveCreds}=await mod.useMultiFileAuthState(authDir);
    if(!active || mine!==generation) return;
    const current=makeWASocket({auth:state,markOnlineOnConnect:false,printQRInTerminal:false,shouldSyncHistoryMessage:()=>false});
    sock=current;
    status({status:'starting',qr:null,error:null,kind:null});
    current.ev.on('creds.update',saveCreds);
    current.ev.on('connection.update', async update=> {
      if(!active || mine!==generation) return;
      if(update.qr) {
        try {
          qrLastAt=Date.now();
          const image=await qrEncoder(update.qr);
          status({status:'qr_ready',qr:image,error:null,kind:null});
        }catch(e){status({status:'error',qr:null,error:'QR could not be drawn: '+String(e.message).slice(0,150),kind:'qr_draw'});}
      }
      if(update.connection==='open') {
        reconnects=0;disconnectReason=null;
        status({status:'connected',qr:null,error:null,kind:null,account:current.user?.id?.split(':')[0]||'connected'});
      }
      if(update.connection==='close') {
        const code=update.lastDisconnect?.error?.output?.statusCode;
        const reason=String(update.lastDisconnect?.error?.message || 'connection closed').slice(0,150);
        const loggedOut = code===mod.DisconnectReason.loggedOut;
        const restartNeeded=code===mod.DisconnectReason.restartRequired;
        sock=null;
        if(serverClose) return;
        if(loggedOut){
          status({status:'logged_out',qr:null,error:'WhatsApp logged out. Use Logout to clear session and Retry QR.',kind:'logged_out'});
          return;
        }
        // WhatsApp explicitly requests one reconnect immediately after successful QR linking.
        // At most 2 consecutive automatic reconnect attempts; no endless loops.
        if((restartNeeded || reconnects<2) && reconnects<2){
          reconnects++;
          status({status:'restarting',qr:null,error:null,kind:null});
          setTimeout(()=>{
            if(active && mine===generation) connect().catch(err=>status({status:'error',error:String(err.message).slice(0,190),kind:'reconnect_error'}));
          },restartNeeded?600:1800*reconnects);
        }else{
          status({status:'error',qr:null,error:`WhatsApp connection closed (${code??'no code'}): ${reason}. Select Retry QR to try again.`,kind:'connection_closed'});
        }
      }
    });
    current.ev.on('messages.upsert',async ({type,messages})=> {
      if(!active || mine!==generation || type!=='notify') return;
      for(const m of messages||[]){
        if(m.key?.fromMe || !m.message) continue;
        const from=m.key.remoteJid;
        if(!from || !(from.endsWith('@s.whatsapp.net') || from.endsWith('@lid'))) continue; // private chats only
        let content=m.message;
        // WhatsApp nests text in an envelope for disappearing/view-once messages.
        for (let depth=0;depth<4;depth++) {
          const nested=content?.ephemeralMessage?.message || content?.viewOnceMessage?.message || content?.viewOnceMessageV2?.message || content?.documentWithCaptionMessage?.message;
          if(!nested) break;
          content=nested;
        }
        const text=content?.conversation || content?.extendedTextMessage?.text;
        if(typeof text!=='string' || !text.trim()) {onDiagnostic({stage:'skipped',detail:'New private message is not plain text (media or unsupported type)'});continue;}
        const id=m.key.id;
        if(!id) {onDiagnostic({stage:'skipped',detail:'Incoming message has no ID'});continue;}
        try{
          await onMessage({id,from,text,sendReply:answer=>current.sendMessage(from,{text:String(answer).slice(0,3500)},{quoted:m})});
        }catch(e){onDiagnostic({stage:'failed',detail:'Message handler: '+String(e.message).slice(0,150)});}
      }
    });
  }

  return {
    async start(){active=true;serverClose=false;reconnects=0;await connect();},
    async stop(){active=false;serverClose=true;generation++;if(sock){try{sock.end?.(new Error('Stopped by owner'))}catch{}try{sock.ws?.close()}catch{}}sock=null;},
    async logout(){
      if(!sock) throw new Error('WhatsApp socket is not connected. Logout from your phone linked devices if necessary.');
      await sock.logout();
      status({status:'disconnected',qr:null,error:null,kind:null});
    }
  };
}
