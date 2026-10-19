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
function auth(req,res,next){try{let t=/^Bearer (.+)$/i.exec(req.get('authorization')||'');if(!t)bad('Inicia sesión',401);req.user=jwt.verify(t[1],process.env.JWT_SECRET);next();}catch(e){next(Object.assign(new Error('Sesión inválida o vencida'),{status:401}));}}
function allowBarber(req,id){if(req.user.rol!=='admin'&&Number(req.user.barbero_id)!==Number(id))bad('Sin permiso para este barbero',403);}
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
app.get('/api/clientes/mis-reservas',clientAuth,verifiedClient,asyncRoute(async(req,res)=>{const [rows]=await pool.query("SELECT r.codigo,r.fecha,TIME_FORMAT(r.hora,'%H:%i') AS hora,r.precio,r.estado,s.nombre AS servicio,b.nombre AS barbero FROM reservas r JOIN servicios s ON s.id=r.servicio_id JOIN barberos b ON b.id=r.barbero_id WHERE r.cliente_id=? ORDER BY r.fecha DESC,r.hora DESC LIMIT 100",[req.client.id]);res.json(rows);}));

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
app.get('/api/reservas',auth,asyncRoute(async(req,res)=>{let barber=+(req.query.barbero_id||req.user.barbero_id||1);allowBarber(req,barber);let date=String(req.query.fecha||todaySV());if(!iso(date))bad('Fecha inválida');const [rows]=await pool.query(`SELECT r.codigo AS id,r.servicio_id AS service,r.barbero_id AS barber,r.fecha AS date,TIME_FORMAT(r.hora,'%H:%i') AS time,c.nombre AS name,c.telefono AS phone,r.duracion_min AS minutes,r.precio AS price,r.estado AS status FROM reservas r JOIN clientes c ON c.id=r.cliente_id WHERE r.barbero_id=? AND r.fecha=? ORDER BY r.hora`,[barber,date]);res.json(rows);}));
app.patch('/api/reservas/:codigo',auth,asyncRoute(async(req,res)=>{const status=String(req.body?.status||'');if(!['finalizada','cancelada','confirmada'].includes(status))bad('Estado no permitido');const [[r]]=await pool.query('SELECT barbero_id FROM reservas WHERE codigo=?',[req.params.codigo]);if(!r)bad('Reserva no encontrada',404);allowBarber(req,r.barbero_id);const [result]=await pool.query("UPDATE reservas SET estado=? WHERE codigo=? AND estado NOT IN ('finalizada','cancelada')",[status,req.params.codigo]);if(!result.affectedRows)bad('Esta reserva ya se cerró',409);res.json({ok:true,status});}));
app.get('/api/bloqueos',auth,asyncRoute(async(req,res)=>{const barber=+(req.query.barbero_id||req.user.barbero_id||1);allowBarber(req,barber);const [rows]=await pool.query("SELECT id,barbero_id AS barber,fecha AS date,TIME_FORMAT(hora,'%H:%i') AS time,duracion_min AS minutes,motivo FROM bloqueos WHERE barbero_id=? AND fecha>=CURDATE() ORDER BY fecha,hora",[barber]);res.json(rows.map(x=>({...x,id:String(x.id)})));}));
app.post('/api/bloqueos',auth,asyncRoute(async(req,res)=>{const barber=+req.body?.barber,date=req.body?.date,time=req.body?.time,minutes=+req.body?.minutes;allowBarber(req,barber);if(![30,60,90,120].includes(minutes))bad('Duración inválida');validateSlot(date,time,minutes);const conn=await pool.getConnection();try{await conn.beginTransaction();const [[b]]=await conn.query('SELECT id FROM barberos WHERE id=? FOR UPDATE',[barber]);if(!b)bad('Barbero inválido');if(await unavailable(conn,barber,date,time,minutes))bad('Se cruza con una cita o bloqueo',409);const [r]=await conn.query('INSERT INTO bloqueos(barbero_id,fecha,hora,duracion_min) VALUES(?,?,?,?)',[barber,date,time,minutes]);await conn.commit();res.status(201).json({id:String(r.insertId),barber,date,time,minutes});}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
app.delete('/api/bloqueos/:id',auth,asyncRoute(async(req,res)=>{const [[b]]=await pool.query('SELECT barbero_id FROM bloqueos WHERE id=?',[req.params.id]);if(!b)bad('Bloqueo no encontrado',404);allowBarber(req,b.barbero_id);await pool.query('DELETE FROM bloqueos WHERE id=?',[req.params.id]);res.json({ok:true});}));
app.get('/api/estadisticas',auth,asyncRoute(async(req,res)=>{const barber=+(req.query.barbero_id||req.user.barbero_id||1);allowBarber(req,barber);const [[r]]=await pool.query("SELECT COUNT(*) AS total,SUM(estado='finalizada') AS finalizadas,COALESCE(SUM(CASE WHEN estado='finalizada' THEN precio ELSE 0 END),0) AS ingresos FROM reservas WHERE barbero_id=? AND estado<>'cancelada'",[barber]);res.json({total:+r.total,finalizadas:+(r.finalizadas||0),ingresos:+r.ingresos});}));
app.use((req,res)=>res.status(404).json({error:'Ruta no encontrada'}));
app.use((err,req,res,next)=>{if(err.message==='Origen no permitido por CORS')return res.status(403).json({error:err.message});console.error(err);res.status(err.status||500).json({error:err.status?err.message:'Error interno del servidor'});});
async function bootstrap(){for(const v of ['DB_HOST','DB_USER','DB_PASSWORD','JWT_SECRET','FRONTEND_URL'])if(!process.env[v])throw Error('Falta variable de entorno: '+v);const [[count]]=await pool.query('SELECT COUNT(*) AS n FROM usuarios');if(!count.n){if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<12||!process.env.ADMIN_EMAIL)throw Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD de al menos 12 caracteres para crear el primer administrador');await pool.query('INSERT INTO usuarios(nombre,email,password_hash,rol) VALUES(?,?,?,?)',['Administrador',process.env.ADMIN_EMAIL.toLowerCase(),await bcrypt.hash(process.env.ADMIN_PASSWORD,12),'admin']);console.log('Administrador inicial creado');}const port=process.env.PORT||10000;app.listen(port,'0.0.0.0',()=>console.log('API escuchando en '+port));}
bootstrap().catch(e=>{console.error('No se pudo iniciar:',e.message);process.exit(1);});
