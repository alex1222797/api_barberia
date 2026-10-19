'use strict';
require('dotenv').config();
const express=require('express');
const cors=require('cors');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const mysql=require('mysql2/promise');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const crypto=require('crypto');
const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
const origins=(process.env.FRONTEND_URL||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);
const ssl={rejectUnauthorized:true};
if(process.env.DB_SSL_CA)ssl.ca=process.env.DB_SSL_CA.replace(/\\n/g,'\n');
const pool=mysql.createPool({host:process.env.DB_HOST,port:+(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'barberia',ssl,waitForConnections:true,connectionLimit:10,dateStrings:true,timezone:'Z',decimalNumbers:true});
app.use(helmet());
app.use(cors({origin(origin,cb){if(!origin||origins.includes(origin))return cb(null,true);cb(new Error('Origen no permitido por CORS'));}}));
app.use(express.json({limit:'20kb'}));
const limiter=rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:'draft-7',legacyHeaders:false});
app.use('/api',limiter);
const asyncRoute=f=>(req,res,next)=>Promise.resolve(f(req,res,next)).catch(next);
function bad(message,status=400){const e=new Error(message);e.status=status;throw e;}
function auth(req,res,next){try{let t=/^Bearer (.+)$/i.exec(req.get('authorization')||'');if(!t)bad('Inicia sesión',401);req.user=jwt.verify(t[1],process.env.JWT_SECRET,{algorithms:['HS256']});if(!['admin','barbero'].includes(req.user.rol))bad('Sin permiso',403);next();}catch(e){next(Object.assign(new Error('Sesión inválida o vencida'),{status:401}));}}
function allowBarber(req,id){if(req.user.rol!=='admin'&&(req.user.rol!=='barbero'||Number(req.user.barbero_id)!==Number(id)))bad('Sin permiso para este barbero',403);}
const iso=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''));
const hh=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t||''));
const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
const overlap=(start,lasting,start2,lasting2)=>start<start2+lasting2&&start+lasting>start2;
function todaySV(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function nowSV(){return new Intl.DateTimeFormat('en-GB',{timeZone:'America/El_Salvador',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());}
function validateSlot(date,time,duration){if(!iso(date)||!hh(time))bad('Fecha u hora inválida');let d=new Date(date+'T12:00:00Z');if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==date)bad('Fecha inválida');if(d.getUTCDay()===0)bad('Domingos cerrados');if(date<todaySV()||(date===todaySV()&&time<=nowSV()))bad('Fecha u hora pasada');let max=new Date(todaySV()+'T12:00:00Z');max.setUTCDate(max.getUTCDate()+13);if(date>max.toISOString().slice(0,10))bad('Solo se admiten los próximos 14 días');if(mins(time)<540||mins(time)>1080||mins(time)%15!==0||mins(time)+duration>1140)bad('Horario fuera de atención');}
async function unavailable(conn,barber,date,time,duration){const [rows]=await conn.query(`SELECT hora,duracion_min FROM reservas WHERE barbero_id=? AND fecha=? AND estado <> 'cancelada' FOR UPDATE`,[barber,date]);const [blocks]=await conn.query('SELECT hora,duracion_min FROM bloqueos WHERE barbero_id=? AND fecha=? FOR UPDATE',[barber,date]);return [...rows,...blocks].some(x=>overlap(mins(time),duration,mins(String(x.hora).slice(0,5)),x.duracion_min));}
// Autenticación de clientes por correo y contraseña propia de Imperium.
const clientLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
function clientAuth(req,res,next){try{const m=/^Bearer (.+)$/i.exec(req.get('authorization')||'');if(!m)bad('Inicia sesión para reservar',401);const p=jwt.verify(m[1],process.env.JWT_SECRET,{algorithms:['HS256']});if(p.tipo!=='cliente'||!p.id)bad('Sesión de cliente inválida',401);req.clientId=p.id;next();}catch(e){next(Object.assign(new Error('Sesión de cliente inválida o vencida'),{status:401}));}}
async function verifiedClient(req,res,next){try{const [[c]]=await pool.query('SELECT id,nombre,email,telefono,verificado FROM clientes WHERE id=?',[req.clientId]);if(!c||!c.verificado)bad('Cliente no autorizado',401);req.client=c;next();}catch(e){next(e);}}
function validEmail(x){const v=String(x||'').trim().toLowerCase();if(v.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))bad('Ingresa un correo válido');return v;}
function validPassword(x){if(typeof x!=='string'||x.length<10||Buffer.byteLength(x)>72)bad('La contraseña debe tener de 10 a 72 caracteres');return x;}
function clientToken(client){return jwt.sign({id:client.id,tipo:'cliente'},process.env.JWT_SECRET,{expiresIn:'7d',algorithm:'HS256'});}
app.post('/api/clientes/auth/registro',clientLimiter,asyncRoute(async(req,res)=>{
 const nombre=String(req.body?.nombre||'').trim(),email=validEmail(req.body?.email),password=validPassword(req.body?.password);
 if(nombre.length<2||nombre.length>70)bad('El nombre debe tener entre 2 y 70 caracteres');
 const hash=await bcrypt.hash(password,12);
 // Una cuenta antigua con el mismo correo no se puede reclamar sin acreditar propiedad.
 try{const [r]=await pool.query('INSERT INTO clientes(nombre,email,password_hash,verificado) VALUES(?,?,?,1)',[nombre,email,hash]);
 const client={id:r.insertId,nombre,email};res.status(201).json({token:clientToken(client),cliente:client});}
 catch(e){if(e.code==='ER_DUP_ENTRY')bad('Este correo ya está registrado. Inicia sesión o contacta a la barbería.',409);throw e;}
}));
app.post('/api/clientes/auth/login',clientLimiter,asyncRoute(async(req,res)=>{
 const email=validEmail(req.body?.email),password=String(req.body?.password||'');
 const [[client]]=await pool.query('SELECT id,nombre,email,password_hash,verificado FROM clientes WHERE email=?',[email]);
 if(!client||!client.password_hash||!client.verificado||!await bcrypt.compare(password,client.password_hash))bad('Correo o contraseña incorrectos',401);
 res.json({token:clientToken(client),cliente:{id:client.id,nombre:client.nombre,email:client.email}});
}));
app.get('/api/clientes/yo',clientAuth,verifiedClient,(req,res)=>res.json({cliente:req.client}));
// Foto de perfil: guardada en Aiven, máximo 1 MiB, JPEG/PNG/WebP.
app.put('/api/clientes/foto',clientAuth,verifiedClient,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'1mb'}),asyncRoute(async(req,res)=>{
 const mime=req.get('content-type')?.split(';')[0]?.toLowerCase();
 if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Buffer.isBuffer(req.body)||req.body.length<12)bad('Selecciona una imagen JPG, PNG o WebP de hasta 1 MB');
 const d=req.body;
 const valid=(mime==='image/jpeg'&&d[0]===0xff&&d[1]===0xd8&&d[2]===0xff)||(mime==='image/png'&&d.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(mime==='image/webp'&&d.toString('ascii',0,4)==='RIFF'&&d.toString('ascii',8,12)==='WEBP');
 if(!valid)bad('El archivo no es una imagen válida');
 await pool.query('UPDATE clientes SET foto_perfil=?,foto_mime=? WHERE id=?',[d,mime,req.client.id]);
 res.json({ok:true});
}));
app.get('/api/clientes/foto',clientAuth,verifiedClient,asyncRoute(async(req,res)=>{
 const [[row]]=await pool.query('SELECT foto_perfil,foto_mime FROM clientes WHERE id=?',[req.client.id]);
 if(!row?.foto_perfil)return res.status(404).json({error:'Sin foto de perfil'});
 res.set('Cache-Control','private, no-store');res.type(row.foto_mime);res.send(row.foto_perfil);
}));
app.get('/api/clientes/mis-reservas',clientAuth,verifiedClient,asyncRoute(async(req,res)=>{const [rows]=await pool.query("SELECT r.codigo,r.fecha,TIME_FORMAT(r.hora,'%H:%i') AS hora,r.precio,r.estado,r.servicio_id,r.barbero_id,s.nombre AS servicio,b.nombre AS barbero FROM reservas r JOIN servicios s ON s.id=r.servicio_id JOIN barberos b ON b.id=r.barbero_id WHERE r.cliente_id=? ORDER BY r.fecha DESC,r.hora DESC LIMIT 100",[req.client.id]);res.json(rows);}));

// Cancelar o reprogramar una cita propia: el cliente nunca puede editar las de terceros.
// Se bloquea la fila del barbero para serializar cambios y reservas nuevas del mismo profesional.
app.patch('/api/clientes/mis-reservas/:codigo',clientAuth,verifiedClient,rateLimit({windowMs:15*60*1000,limit:20}),asyncRoute(async(req,res)=>{
 const codigo=String(req.params.codigo||'');
 if(!/^IMP-[A-Z0-9-]{6,40}$/i.test(codigo))bad('Código de cita inválido');
 const action=String(req.body?.action||'');
 if(!['cancel','reschedule'].includes(action))bad('Operación inválida');
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  // Reservas normales y reprogramaciones comparten el mismo bloqueo de barbero.
  const [[initial]]=await conn.query('SELECT barbero_id FROM reservas WHERE codigo=? AND cliente_id=?',[codigo,req.client.id]);
  if(!initial)bad('Cita no encontrada',404);
  await conn.query('SELECT id FROM barberos WHERE id=? FOR UPDATE',[initial.barbero_id]);
  const [[r]]=await conn.query("SELECT id,barbero_id,servicio_id,fecha,TIME_FORMAT(hora,'%H:%i') AS hora,duracion_min,estado FROM reservas WHERE codigo=? AND cliente_id=? FOR UPDATE",[codigo,req.client.id]);
  if(!r)bad('Cita no encontrada',404);
  if(Number(r.barbero_id)!==Number(initial.barbero_id))bad('La cita cambió. Actualiza e intenta de nuevo',409);
  if(!['pendiente','confirmada'].includes(r.estado))bad('La cita ya fue cerrada o cancelada',409);
  if(r.fecha<todaySV()||(r.fecha===todaySV()&&r.hora<=nowSV()))bad('No se puede modificar una cita que ya comenzó',409);
  if(action==='cancel'){
   await conn.query("UPDATE reservas SET estado='cancelada' WHERE id=?",[r.id]);
   await conn.commit();return res.json({ok:true,status:'cancelada'});
  }
  const date=String(req.body?.date||''),time=String(req.body?.time||'');
  validateSlot(date,time,r.duracion_min);
  if(date===r.fecha&&time===r.hora)bad('Elige un horario diferente');
  const [appointments]=await conn.query("SELECT id,hora,duracion_min FROM reservas WHERE barbero_id=? AND fecha=? AND estado<>'cancelada' AND id<>? FOR UPDATE",[r.barbero_id,date,r.id]);
  const [blocks]=await conn.query('SELECT hora,duracion_min FROM bloqueos WHERE barbero_id=? AND fecha=? FOR UPDATE',[r.barbero_id,date]);
  if([...appointments,...blocks].some(x=>overlap(mins(time),r.duracion_min,mins(String(x.hora).slice(0,5)),x.duracion_min)))bad('Este horario ya no está disponible',409);
  await conn.query('UPDATE reservas SET fecha=?,hora=? WHERE id=?',[date,time,r.id]);
  await conn.commit();return res.json({ok:true,codigo,date,time});
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));

// Asistencia física verificada por el barbero: un único resultado por cita.
app.post('/api/reservas/:codigo/asistencia',auth,asyncRoute(async(req,res)=>{
 const resultado=String(req.body?.resultado||'');
 if(!['asistio','no_asistio'].includes(resultado))bad('Selecciona Asistió o No asistió');
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[r]]=await conn.query("SELECT id,cliente_id,barbero_id,fecha,TIME_FORMAT(hora,'%H:%i') AS hora,estado FROM reservas WHERE codigo=? FOR UPDATE",[req.params.codigo]);
  if(!r)bad('Cita no encontrada',404);
  allowBarber(req,r.barbero_id);
  const [[u]]=await conn.query('SELECT id FROM usuarios WHERE id=? AND activo=1',[req.user.id]);
  if(!u)bad('Usuario no autorizado',401);
  if(r.estado==='cancelada')bad('No se puede registrar asistencia de una cita cancelada',409);
  if(r.fecha>todaySV()||(r.fecha===todaySV()&&r.hora>nowSV()))bad('Espera a la hora de la cita para registrar asistencia',409);
  const [[prev]]=await conn.query('SELECT id,resultado FROM asistencias WHERE reserva_id=? FOR UPDATE',[r.id]);
  if(prev)bad('Esta cita ya tiene asistencia registrada: '+prev.resultado,409);
  await conn.query('INSERT INTO asistencias(reserva_id,resultado,registrado_por) VALUES(?,?,?)',[r.id,resultado,u.id]);
  let selloAgregado=false;
  if(resultado==='asistio'){
   await conn.query('INSERT IGNORE INTO fidelidad_cuentas(cliente_id,sellos) VALUES(?,0)',[r.cliente_id]);
   const [[cuenta]]=await conn.query('SELECT sellos FROM fidelidad_cuentas WHERE cliente_id=? FOR UPDATE',[r.cliente_id]);
   if(Number(cuenta.sellos)<10){
    await conn.query('UPDATE fidelidad_cuentas SET sellos=sellos+1 WHERE cliente_id=?',[r.cliente_id]);
    await conn.query("INSERT INTO fidelidad_movimientos(cliente_id,reserva_id,tipo,sellos_antes,sellos_despues,registrado_por,detalle) VALUES(?,?,'sello',?,?,?,?)",[r.cliente_id,r.id,cuenta.sellos,Number(cuenta.sellos)+1,u.id,'Asistencia confirmada']);
    selloAgregado=true;
   }
  }

  if(resultado==='asistio')await conn.query("UPDATE reservas SET estado='finalizada' WHERE id=?",[r.id]);
  await conn.commit();res.json({ok:true,resultado,sello_agregado:selloAgregado});
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
// Fidelidad V6: saldo limitado a 10. Un canje lo registra solo el personal.
app.get('/api/clientes/fidelidad',clientAuth,verifiedClient,asyncRoute(async(req,res)=>{
 const [[cuenta]]=await pool.query('SELECT sellos FROM fidelidad_cuentas WHERE cliente_id=?',[req.client.id]);
 const sellos=Number(cuenta?.sellos||0);
 const [historial]=await pool.query('SELECT tipo,sellos_antes,sellos_despues,detalle,creado_en FROM fidelidad_movimientos WHERE cliente_id=? ORDER BY id DESC LIMIT 30',[req.client.id]);
 res.json({sellos,max_sellos:10,premio:'Arreglo de barba gratis',listo_para_canjear:sellos===10,
  niveles:[{sellos:10,beneficio:'Arreglo de barba gratis',desbloqueado:sellos===10}],historial,
  nota:'Al llegar a diez sellos, muestra tu tarjeta al personal para canjear el beneficio.'});
}));
// Canje exclusivamente en barbería: requiere JWT de barbero o administrador.
// Consulta de tarjeta por personal autenticado para canje presencial.
app.get('/api/panel/fidelidad/buscar',auth,asyncRoute(async(req,res)=>{
 const q=String(req.query.q||'').trim();
 if(q.length<3||q.length>120)bad('Escribe al menos 3 caracteres del nombre, correo o teléfono');
 const search='%'+q.replace(/[\%_]/g,'\\$&')+'%';
 const [rows]=await pool.query(`SELECT c.id,c.nombre,c.email AS correo,c.telefono,LEAST(10,COALESCE(fc.sellos,0)) AS sellos
 FROM clientes c LEFT JOIN fidelidad_cuentas fc ON fc.cliente_id=c.id
 WHERE c.nombre LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? ORDER BY c.nombre LIMIT 15`,[search,search,search]);
 res.json(rows);
}));
app.post('/api/panel/fidelidad/canjear',auth,rateLimit({windowMs:15*60*1000,limit:20}),asyncRoute(async(req,res)=>{
 const clienteId=Number(req.body?.cliente_id);
 if(!Number.isSafeInteger(clienteId)||clienteId<1)bad('Selecciona un cliente válido');
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[c]]=await conn.query('SELECT id FROM clientes WHERE id=?',[clienteId]);
  if(!c)bad('Cliente no encontrado',404);
  await conn.query('INSERT IGNORE INTO fidelidad_cuentas(cliente_id,sellos) VALUES(?,0)',[clienteId]);
  const [[cuenta]]=await conn.query('SELECT sellos FROM fidelidad_cuentas WHERE cliente_id=? FOR UPDATE',[clienteId]);
  if(Number(cuenta.sellos)!==10)bad('El cliente necesita 10 sellos para canjear el premio',409);
  await conn.query('UPDATE fidelidad_cuentas SET sellos=0 WHERE cliente_id=?',[clienteId]);
  await conn.query("INSERT INTO fidelidad_movimientos(cliente_id,tipo,sellos_antes,sellos_despues,registrado_por,detalle) VALUES(?,'canje',10,0,?,?)",[clienteId,req.user.id,'Arreglo de barba gratis']);
  await conn.commit();res.json({ok:true,sellos:0,premio:'Arreglo de barba gratis'});
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
app.get('/api/health',asyncRoute(async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true,servicio:'Proyecto Denisse Barberia API'});}));
app.get('/api/servicios',asyncRoute(async(req,res)=>{const [rows]=await pool.query('SELECT id,nombre AS name,descripcion AS description,duracion_min AS minutes,precio AS price FROM servicios WHERE activo=1 ORDER BY id');res.json(rows);}));
app.get('/api/barberos',asyncRoute(async(req,res)=>{const [rows]=await pool.query('SELECT id,nombre AS name,especialidad AS specialty,foto AS photo FROM barberos WHERE activo=1 ORDER BY id');res.json(rows);}));
app.get('/api/disponibilidad',asyncRoute(async(req,res)=>{const barber=+req.query.barbero_id,service=+req.query.servicio_id,date=String(req.query.fecha||'');const [[s]]=await pool.query('SELECT duracion_min FROM servicios WHERE id=? AND activo=1',[service]);if(!s||!Number.isInteger(barber))bad('Servicio o barbero inválido');if(!iso(date))bad('Fecha inválida');const [appointments]=await pool.query("SELECT hora,duracion_min FROM reservas WHERE barbero_id=? AND fecha=? AND estado<>'cancelada'",[barber,date]);const [blocks]=await pool.query('SELECT hora,duracion_min FROM bloqueos WHERE barbero_id=? AND fecha=?',[barber,date]);const data=[];for(let m=540;m<=1080;m+=15){if(m+s.duracion_min>1140)continue;const t=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');let past=false;try{validateSlot(date,t,s.duracion_min);}catch{past=true;}const busy=[...appointments,...blocks].some(x=>overlap(m,s.duracion_min,mins(String(x.hora).slice(0,5)),x.duracion_min));data.push({time:t,disabled:past||busy,reason:past?'past':busy?'occupied':null});}res.json(data);}));
app.post('/api/reservas',clientAuth,verifiedClient,rateLimit({windowMs:15*60*1000,limit:15}),asyncRoute(async(req,res)=>{const {service,barber,date,time}=req.body||{};const cleanName=String(req.client.nombre||'').trim(),cleanPhone=String(req.client.telefono||'').trim();const serviceId=+service,barberId=+barber;if(cleanName.length<2||cleanName.length>70)bad('Cuenta de cliente inválida',401);const conn=await pool.getConnection();try{await conn.beginTransaction();const [[s]]=await conn.query('SELECT duracion_min,precio FROM servicios WHERE id=? AND activo=1',[serviceId]);const [[b]]=await conn.query('SELECT id FROM barberos WHERE id=? AND activo=1',[barberId]);if(!s||!b)bad('Servicio o barbero inexistente');validateSlot(date,time,s.duracion_min);
// Serializar reservas por barbero mediante bloqueo de su fila. Evita doble reserva simultánea.
await conn.query('SELECT id FROM barberos WHERE id=? FOR UPDATE',[barberId]);
if(await unavailable(conn,barberId,date,time,s.duracion_min))bad('Este horario ya no está disponible',409);
const [[c]]=await conn.query('SELECT id FROM clientes WHERE id=? AND verificado=1',[req.client.id]);if(!c)bad('La cuenta no está verificada',401);const code='IMP-'+crypto.randomBytes(6).toString('hex').toUpperCase();await conn.query('INSERT INTO reservas(codigo,cliente_id,servicio_id,barbero_id,fecha,hora,duracion_min,precio) VALUES(?,?,?,?,?,?,?,?)',[code,c.id,serviceId,barberId,date,time,s.duracion_min,s.precio]);await conn.commit();res.status(201).json({id:code,service:serviceId,barber:barberId,date,time,name:cleanName,phone:cleanPhone,minutes:s.duracion_min,price:s.precio,status:'pendiente'});
}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
app.post('/api/auth/login',rateLimit({windowMs:15*60*1000,limit:10}),asyncRoute(async(req,res)=>{const {email,password}=req.body||{};const [[u]]=await pool.query('SELECT * FROM usuarios WHERE email=? AND activo=1',[String(email||'').trim().toLowerCase()]);if(!u||!await bcrypt.compare(String(password||''),u.password_hash))bad('Correo o contraseña incorrectos',401);const token=jwt.sign({id:u.id,rol:u.rol,barbero_id:u.barbero_id},process.env.JWT_SECRET,{expiresIn:'8h'});res.json({token,user:{id:u.id,nombre:u.nombre,rol:u.rol,barbero_id:u.barbero_id}});}));
app.get('/api/panel/yo',auth,asyncRoute(async(req,res)=>{const [[u]]=await pool.query('SELECT id,nombre,email,rol,barbero_id FROM usuarios WHERE id=? AND activo=1',[req.user.id]);if(!u)bad('Cuenta desactivada',401);res.json(u); }));
app.get('/api/reservas',auth,asyncRoute(async(req,res)=>{let barber=+(req.query.barbero_id||req.user.barbero_id||1);allowBarber(req,barber);let date=String(req.query.fecha||todaySV());if(!iso(date))bad('Fecha inválida');const [rows]=await pool.query(`SELECT r.codigo AS id,r.servicio_id AS service,r.barbero_id AS barber,r.fecha AS date,TIME_FORMAT(r.hora,'%H:%i') AS time,c.nombre AS name,c.telefono AS phone,r.duracion_min AS minutes,r.precio AS price,r.estado AS status,(SELECT a.resultado FROM asistencias a WHERE a.reserva_id=r.id) AS asistencia FROM reservas r JOIN clientes c ON c.id=r.cliente_id WHERE r.barbero_id=? AND r.fecha=? ORDER BY r.hora`,[barber,date]);res.json(rows);}));
app.patch('/api/reservas/:codigo',auth,asyncRoute(async(req,res)=>{const status=String(req.body?.status||'');if(!['cancelada','confirmada'].includes(status))bad('Para finalizar una cita utiliza Asistió o No asistió');const [[r]]=await pool.query('SELECT barbero_id FROM reservas WHERE codigo=?',[req.params.codigo]);if(!r)bad('Reserva no encontrada',404);allowBarber(req,r.barbero_id);const [result]=await pool.query("UPDATE reservas SET estado=? WHERE codigo=? AND estado NOT IN ('finalizada','cancelada')",[status,req.params.codigo]);if(!result.affectedRows)bad('Esta reserva ya se cerró',409);res.json({ok:true,status});}));
app.get('/api/bloqueos',auth,asyncRoute(async(req,res)=>{const barber=Number(req.user.rol==='barbero'?req.user.barbero_id:(req.query.barbero_id||1));allowBarber(req,barber);const [rows]=await pool.query("SELECT id,barbero_id AS barber,fecha AS date,TIME_FORMAT(hora,'%H:%i') AS time,duracion_min AS minutes,motivo FROM bloqueos WHERE barbero_id=? AND fecha>=CURDATE() ORDER BY fecha,hora",[barber]);res.json(rows.map(x=>({...x,id:String(x.id)})));}));
app.post('/api/bloqueos',auth,asyncRoute(async(req,res)=>{const barber=Number(req.user.rol==='barbero'?req.user.barbero_id:req.body?.barber),date=req.body?.date,time=req.body?.time,minutes=+req.body?.minutes;allowBarber(req,barber);if(!Number.isInteger(minutes)||minutes<15||minutes>600||minutes%15!==0)bad('Duración: múltiplos de 15 minutos, máximo 10 horas');if(!iso(date)||!hh(time))bad('Fecha u hora inválida');if(date<todaySV()||(date===todaySV()&&time<=nowSV()))bad('No se puede bloquear una fecha pasada');if(mins(time)<480||mins(time)+minutes>1140)bad('El descanso debe estar entre 8:00 AM y 7:00 PM');const conn=await pool.getConnection();try{await conn.beginTransaction();const [[b]]=await conn.query('SELECT id FROM barberos WHERE id=? FOR UPDATE',[barber]);if(!b)bad('Barbero inválido');if(await unavailable(conn,barber,date,time,minutes))bad('Se cruza con una cita o bloqueo',409);const [r]=await conn.query('INSERT INTO bloqueos(barbero_id,fecha,hora,duracion_min) VALUES(?,?,?,?)',[barber,date,time,minutes]);await conn.commit();res.status(201).json({id:String(r.insertId),barber,date,time,minutes});}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
app.delete('/api/bloqueos/:id',auth,asyncRoute(async(req,res)=>{const [[b]]=await pool.query('SELECT barbero_id FROM bloqueos WHERE id=?',[req.params.id]);if(!b)bad('Bloqueo no encontrado',404);allowBarber(req,b.barbero_id);await pool.query('DELETE FROM bloqueos WHERE id=?',[req.params.id]);res.json({ok:true});}));
app.get('/api/estadisticas',auth,asyncRoute(async(req,res)=>{const barber=Number(req.user.rol==='barbero'?req.user.barbero_id:(req.query.barbero_id||1));allowBarber(req,barber);const [[r]]=await pool.query("SELECT COUNT(*) AS total,SUM(estado='finalizada') AS finalizadas,COALESCE(SUM(CASE WHEN estado='finalizada' THEN precio ELSE 0 END),0) AS ingresos FROM reservas WHERE barbero_id=? AND estado<>'cancelada'",[barber]);res.json({total:+r.total,finalizadas:+(r.finalizadas||0),ingresos:+r.ingresos});}));
app.use((req,res)=>res.status(404).json({error:'Ruta no encontrada'}));
app.use((err,req,res,next)=>{if(err.message==='Origen no permitido por CORS')return res.status(403).json({error:err.message});console.error(err);res.status(err.status||500).json({error:err.status?err.message:'Error interno del servidor'});});
async function bootstrap(){for(const v of ['DB_HOST','DB_USER','DB_PASSWORD','JWT_SECRET','FRONTEND_URL'])if(!process.env[v])throw Error('Falta variable de entorno: '+v);const [[count]]=await pool.query('SELECT COUNT(*) AS n FROM usuarios');if(!count.n){if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<12||!process.env.ADMIN_EMAIL)throw Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD de al menos 12 caracteres para crear el primer administrador');await pool.query('INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES(?,?,?,?)',['Administrador',process.env.ADMIN_EMAIL.toLowerCase(),await bcrypt.hash(process.env.ADMIN_PASSWORD,12),'admin']);console.log('Administrador inicial creado');}const port=process.env.PORT||10000;app.listen(port,'0.0.0.0',()=>console.log('API escuchando en '+port));}
bootstrap().catch(e=>{console.error('No se pudo iniciar:',e.message);process.exit(1);});
