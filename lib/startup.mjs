// No dependencies. Safe localhost port selection and login-link utilities.
export async function listenOnAvailablePort(app, desiredPort=5055, attempts=25) {
  for (let n=0; n<attempts; n++) {
    const port=desiredPort+n;
    if (port>65535) break;
    try {
      const server=await new Promise((resolve,reject)=>{
        const listener=app.listen(port,'127.0.0.1');
        listener.once('listening',()=>resolve(listener));
        listener.once('error',reject);
      });
      return {server,port};
    } catch (error) {
      if (error.code!=='EADDRINUSE' && error.code!=='EACCES') throw error;
    }
  }
  throw new Error(`No free localhost port from ${desiredPort} to ${desiredPort+attempts-1}`);
}
export function makeLocalLaunchUrl(port,token) {
  if (!Number.isInteger(port) || port<1025 || port>65535) throw new Error('Invalid port');
  if (!/^[a-f0-9]{36}$/i.test(token)) throw new Error('Invalid generated admin code');
  // Fragment is processed only by the browser and stripped immediately.
  return `http://127.0.0.1:${port}/#admin=${encodeURIComponent(token)}`;
}
