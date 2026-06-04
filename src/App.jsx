import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";

const C = {
  bg:"#0B0B0D",surface:"#111116",card:"#16161E",cardHover:"#1C1C26",
  border:"#242430",borderHi:"#2E2E42",
  blue:"#2146D0",blueGlow:"#2146D044",blueDim:"#111827",
  white:"#F5F5F5",muted:"#7A7F86",mutedDim:"#3B3D42",
  green:"#22C97A",red:"#E03C3C",amber:"#E89A1A",
  pink:"#E0449A",pinkDim:"#2A1020",
};

const TopoBg=({opacity=0.07})=>(
  <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",opacity,pointerEvents:"none",zIndex:0}} viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice">
    <defs><filter id="bl"><feGaussianBlur stdDeviation="1"/></filter></defs>
    <g fill="none" stroke={C.blue} strokeWidth="0.8" filter="url(#bl)">
      {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i=><ellipse key={i} cx="400" cy="600" rx={80+i*55} ry={50+i*80} transform={`rotate(${i*7} 400 600)`} opacity={1-i*0.06}/>)}
    </g>
  </svg>
);
const Slashes=({color=C.blue,size=12})=><span style={{color,fontSize:size,fontWeight:900,letterSpacing:-1}}>///</span>;
const Tag=({children,color=C.blue})=><span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:3,padding:"2px 7px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{children}</span>;
const Bar=({value,color=C.blue,height=3})=><div style={{background:C.border,borderRadius:2,height,width:"100%",overflow:"hidden"}}><div style={{width:`${Math.min(value||0,100)}%`,height:"100%",background:color,transition:"width .5s ease"}}/></div>;
const Divider=()=><div style={{height:1,background:C.border}}/>;
const Spinner=()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh"}}><div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.blue}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;
const inp_s={width:"100%",padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA=["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"];
const TIPOS_RUNNING=["Regenerativo","Intervalos","Tempo","Umbral","Long Run","Trail","Rodaje","Movilidad","Descanso","Otro"];
const TIPOS_GYM=["Tren superior","Tren inferior","Full body","Core","Fuerza máxima","Hipertrofia","Movilidad","Descanso","Otro"];

function cicloInfo(ciclo){
  if(!ciclo?.ultimaMenstruacion)return null;
  const hoy=new Date();
  const[y,m,d]=ciclo.ultimaMenstruacion.split("-").map(Number);
  const ultima=new Date(y,m-1,d);
  const diasDesde=Math.floor((hoy-ultima)/(1000*60*60*24));
  const durCiclo=ciclo.duracionCiclo||28,durMens=ciclo.duracionMenstruacion||5;
  const diaEnCiclo=(diasDesde%durCiclo)+1;
  const diasHastaProxima=durCiclo-(diasDesde%durCiclo);
  const enMenstruacion=diaEnCiclo<=durMens,alertaProxima=!enMenstruacion&&diasHastaProxima<=3;
  let fase="";
  if(diaEnCiclo<=durMens)fase="Menstruación";
  else if(diaEnCiclo<=13)fase="Folicular";
  else if(diaEnCiclo<=16)fase="Ovulación";
  else fase="Lútea";
  return{diaEnCiclo,diasHastaProxima,enMenstruacion,alertaProxima,fase,durCiclo,durMens};
}
const planStatus=dias=>{const d=parseInt(dias)||0;if(d<=0)return{label:"VENCIDO",color:C.red,urgente:true};if(d<=3)return{label:`VENCE EN ${d}d`,color:C.amber,urgente:true};return{label:`${d}d restantes`,color:C.muted,urgente:false};};
const payStatus=(pagado,diasVencido)=>{if(pagado)return{label:"AL DÍA",color:C.green};if(!diasVencido)return{label:"PENDIENTE",color:C.amber};return{label:`DEBE ${diasVencido}d`,color:C.red};};

// ── SPLASH ─────────────────────────────────────────────
function SplashScreen({onDone}){
  const[phase,setPhase]=useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),700),t2=setTimeout(()=>setPhase(2),1400),t3=setTimeout(()=>setPhase(3),2200),t4=setTimeout(()=>onDone(),2900);
    return()=>[t1,t2,t3,t4].forEach(clearTimeout);
  },[onDone]);
  return(
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transition:"opacity .7s ease",opacity:phase===3?0:1}}>
      <TopoBg opacity={0.12}/>
      <div style={{textAlign:"center",position:"relative",zIndex:1}}>
        <div style={{fontSize:64,fontWeight:900,letterSpacing:12,color:C.white,lineHeight:1,textShadow:`0 0 40px ${C.blue}66`}}>STRONG</div>
        <div style={{opacity:phase>=1?1:0,transition:"all .6s ease",marginTop:10,fontSize:11,letterSpacing:6,color:C.blue,fontWeight:700}}>SYSTEM IN MOTION</div>
        <div style={{opacity:phase>=2?1:0,transition:"opacity .4s ease",marginTop:16}}><Slashes size={16}/></div>
        <div style={{opacity:phase>=2?1:0,transition:"opacity .4s ease",marginTop:20,fontSize:9,letterSpacing:4,color:C.muted}}>FUERZA · RENDIMIENTO · CIENCIA</div>
      </div>
    </div>
  );
}

// ── AUTH ───────────────────────────────────────────────
function AuthScreen({onAuth}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState(""),[ pass,setPass]=useState(""),[ nombre,setNombre]=useState(""),[ error,setError]=useState(""),[ loading,setLoading]=useState(false);
  const inp={...inp_s,padding:"12px 14px",fontSize:13};

  // Cargar email guardado
  useEffect(()=>{
    const saved=localStorage.getItem("strong_email");
    if(saved){setEmail(saved);setRecordar(true);}
  },[]);

  const[recordar,setRecordar]=useState(false);

  const handleLogin=async()=>{
    setError("");setLoading(true);
    if(recordar)localStorage.setItem("strong_email",email);
    else localStorage.removeItem("strong_email");
    try{
      const cred=await signInWithEmailAndPassword(auth,email,pass);
      const snap=await getDoc(doc(db,"usuarios",cred.user.uid));
      if(!snap.exists())throw new Error("no perfil");
      const ud=snap.data();
      if(ud.estado==="pendiente"){await signOut(auth);setError("Tu cuenta está pendiente de aprobación.");setLoading(false);return;}
      onAuth({uid:cred.user.uid,...ud});
    }catch(e){setError("Email o contraseña incorrectos.");setLoading(false);}
  };

  const handleRegister=async()=>{
    if(!nombre.trim()){setError("Ingresá tu nombre completo.");return;}
    setError("");setLoading(true);
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,pass);
      await setDoc(doc(db,"usuarios",cred.user.uid),{nombre:nombre.trim(),email:email.toLowerCase(),role:"alumno",estado:"pendiente",genero:"",tipo:"",objetivo:"",peso:"",edad:"",marcas:{cinco:"—",diez:"—",media:"—",maraton:"—"},ciclo:null,creadoEn:serverTimestamp()});
      await signOut(auth);setMode("pendiente");setLoading(false);
    }catch(e){
      if(e.code==="auth/email-already-in-use")setError("Ese email ya está registrado.");
      else if(e.code==="auth/weak-password")setError("La contraseña debe tener al menos 6 caracteres.");
      else setError("Error al registrarse. Intentá de nuevo.");
      setLoading(false);
    }
  };

  if(mode==="pendiente")return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative"}}>
      <TopoBg opacity={0.08}/>
      <div style={{width:"100%",maxWidth:360,position:"relative",zIndex:1,textAlign:"center"}}>
        <div style={{fontSize:36,fontWeight:900,letterSpacing:8,color:C.white,marginBottom:6}}>STRONG</div>
        <div style={{fontSize:9,letterSpacing:5,color:C.blue,marginBottom:32,fontWeight:700}}>SYSTEM IN MOTION</div>
        <div style={{background:C.card,border:`1px solid ${C.green}44`,borderRadius:14,padding:"28px 24px"}}>
          <div style={{fontSize:32,marginBottom:12}}>✓</div>
          <div style={{fontSize:16,fontWeight:700,color:C.green,marginBottom:8}}>SOLICITUD ENVIADA</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>El entrenador revisará tu solicitud y te dará acceso en breve.</div>
          <button onClick={()=>setMode("login")} style={{marginTop:20,width:"100%",padding:"11px",background:C.blue,color:C.white,border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:900,fontSize:12,letterSpacing:2,cursor:"pointer"}}>IR AL LOGIN</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,position:"relative"}}>
      <TopoBg opacity={0.08}/>
      <div style={{width:"100%",maxWidth:360,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:36,fontWeight:900,letterSpacing:8,color:C.white,lineHeight:1}}>STRONG</div>
          <div style={{fontSize:9,letterSpacing:5,color:C.blue,marginTop:6,fontWeight:700}}>SYSTEM IN MOTION</div>
          <div style={{marginTop:8}}><Slashes size={10}/></div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:14,padding:"24px 22px"}}>
          <div style={{display:"flex",marginBottom:20,background:C.surface,borderRadius:8,padding:3}}>
            {[["login","INGRESAR"],["register","REGISTRARME"]].map(([v,l])=>(
              <button key={v} onClick={()=>{setMode(v);setError("");}} style={{flex:1,padding:"8px",border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:1.5,cursor:"pointer",background:mode===v?C.blue:"transparent",color:mode===v?C.white:C.muted,transition:"all .2s"}}>{l}</button>
            ))}
          </div>
          {mode==="register"&&<div style={{marginBottom:12}}><div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:5}}>NOMBRE COMPLETO</div><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre" style={inp} onFocus={e=>e.target.style.border=`1px solid ${C.blue}`} onBlur={e=>e.target.style.border=`1px solid ${C.border}`}/></div>}
          <div style={{marginBottom:12}}><div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:5}}>EMAIL</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inp} onFocus={e=>e.target.style.border=`1px solid ${C.blue}`} onBlur={e=>e.target.style.border=`1px solid ${C.border}`} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/></div>
          <div style={{marginBottom:20}}><div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:5}}>CONTRASEÑA</div><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={inp} onFocus={e=>e.target.style.border=`1px solid ${C.blue}`} onBlur={e=>e.target.style.border=`1px solid ${C.border}`} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/>{mode==="register"&&<div style={{fontSize:9,color:C.muted,marginTop:5}}>Mínimo 6 caracteres</div>}</div>
          {mode==="login"&&(
            <div onClick={()=>setRecordar(r=>!r)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,cursor:"pointer",userSelect:"none"}}>
              <div style={{width:16,height:16,border:`2px solid ${recordar?C.blue:C.border}`,borderRadius:4,background:recordar?C.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                {recordar&&<span style={{color:C.white,fontSize:10,lineHeight:1}}>✓</span>}
              </div>
              <span style={{fontSize:11,color:C.muted}}>Recordar mi email en este dispositivo</span>
            </div>
          )}
          {error&&<div style={{background:C.red+"15",border:`1px solid ${C.red}44`,borderRadius:6,padding:"8px 12px",marginBottom:14,fontSize:11,color:C.red}}>{error}</div>}
          <button onClick={mode==="login"?handleLogin:handleRegister} style={{width:"100%",padding:"12px",background:loading?C.mutedDim:C.blue,color:C.white,border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:900,fontSize:13,letterSpacing:3,cursor:loading?"default":"pointer",transition:"all .2s"}}>
            {loading?"PROCESANDO...":(mode==="login"?"INGRESAR":"SOLICITAR ACCESO")}
          </button>
          {mode==="register"&&<div style={{marginTop:14,padding:"10px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,fontSize:10,color:C.muted,lineHeight:1.6}}>El entrenador revisará tu solicitud y te dará acceso una vez aprobada.</div>}
        </div>
      </div>
    </div>
  );
}

// ── TOP BAR ────────────────────────────────────────────
function TopBar({user,onLogout}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 18px",borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,borderRadius:5,border:`1px solid ${C.blue}`,background:C.blueDim,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:C.white}}>S</div>
        <div><div style={{fontWeight:900,fontSize:14,letterSpacing:4,color:C.white,lineHeight:1}}>STRONG</div><div style={{fontSize:7,color:C.blue,letterSpacing:3,marginTop:1}}>SYSTEM IN MOTION</div></div>
        <Slashes size={8}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.white,fontWeight:700}}>{user.nombre}</div><div style={{fontSize:7,color:C.blue,letterSpacing:1}}>{user.role==="admin"?"ENTRENADOR":"ALUMNO"}</div></div>
        <button onClick={onLogout} style={{padding:"4px 9px",background:"none",border:`1px solid ${C.border}`,borderRadius:5,color:C.muted,fontFamily:"inherit",fontSize:8,letterSpacing:1,cursor:"pointer"}}>SALIR</button>
      </div>
    </div>
  );
}

// ── DETALLE ENTRENAMIENTO ──────────────────────────────
function DetalleEntrenamiento({dia,onClose,esAdmin=false}){
  if(!dia) return null;
  const color = dia.planKey==="gym" ? C.amber : C.blue;
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#000000cc",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,width:420,maxWidth:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:color,boxShadow:`0 0 8px ${color}`}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:15,color:C.white}}>{dia.dia} — {dia.tipo}</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:1}}>{dia.planKey==="gym"?"GIMNASIO":"RUNNING"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:16}}>
          {/* Detalles del entrenamiento */}
          {dia.detalle&&(
            <div style={{background:C.card,border:`1px solid ${color}44`,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:9,color:color,letterSpacing:2,marginBottom:8}}>// DESCRIPCIÓN</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:10}}>{dia.detalle}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {dia.distancia&&<div style={{background:C.surface,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>DISTANCIA</div><div style={{fontSize:13,fontWeight:700,color:C.white,marginTop:2}}>{dia.distancia}</div></div>}
                {dia.ritmo&&<div style={{background:C.surface,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>RITMO</div><div style={{fontSize:13,fontWeight:700,color:C.white,marginTop:2}}>{dia.ritmo}</div></div>}
                {dia.series&&<div style={{background:C.surface,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>SERIES</div><div style={{fontSize:13,fontWeight:700,color:C.white,marginTop:2}}>{dia.series}</div></div>}
                {dia.descanso&&<div style={{background:C.surface,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>DESCANSO</div><div style={{fontSize:13,fontWeight:700,color:C.white,marginTop:2}}>{dia.descanso}</div></div>}
                {dia.carga&&<div style={{background:C.surface,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>CARGA</div><div style={{fontSize:13,fontWeight:700,color:C.white,marginTop:2}}>{dia.carga}</div></div>}
                {dia.frecuencia&&<div style={{background:C.surface,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1}}>FC OBJETIVO</div><div style={{fontSize:13,fontWeight:700,color:C.white,marginTop:2}}>{dia.frecuencia}</div></div>}
              </div>
            </div>
          )}
          {/* Comentario del entrenador */}
          {dia.comentario&&(
            <div style={{background:C.blueDim,border:`1px solid ${C.blue}33`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:9,color:C.blue,letterSpacing:2,marginBottom:6}}>// NOTA DEL ENTRENADOR</div>
              <div style={{fontSize:12,color:C.white,lineHeight:1.7}}>{dia.comentario}</div>
            </div>
          )}
          {!dia.detalle&&!dia.comentario&&(
            <div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12}}>Sin detalles adicionales para este entrenamiento.</div>
          )}
          {dia.ejercicios&&dia.ejercicios.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,color:C.amber,letterSpacing:2,marginBottom:8}}>// EJERCICIOS</div>
              {dia.ejercicios.map((ej,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${C.amber}33`,borderRadius:8,padding:"10px 12px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.white}}>{ej.nombre||"Ejercicio"}</div>
                    {ej.series&&<div style={{fontSize:10,color:C.amber,fontWeight:700,marginTop:2}}>{ej.series}</div>}
                  </div>
                  {ej.ytUrl&&(
                    <a href={ej.ytUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",background:"#FF000015",border:"1px solid #FF000033",borderRadius:5,fontSize:9,color:"#FF4444",textDecoration:"none",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                      <span style={{display:"inline-block",width:14,height:10,background:"#FF0000",borderRadius:2,position:"relative",flexShrink:0}}>
                        <span style={{position:"absolute",top:"50%",left:"55%",transform:"translate(-50%,-50%)",width:0,height:0,borderStyle:"solid",borderWidth:"3px 0 3px 6px",borderColor:"transparent transparent transparent #FFF"}}/>
                      </span>
                      VER
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {!esAdmin&&dia.tipo!=="Descanso"&&(
            <div style={{fontSize:9,color:C.muted,letterSpacing:1,textAlign:"center",marginTop:8}}>Usá el botón de la vista principal para marcar como completado.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CARGAR PLAN DIA ────────────────────────────────────
function CargarDia({diaData,uid,coleccion,onClose}){
  const esGym=coleccion==="planGym";
  const tiposOpc=esGym?TIPOS_GYM:TIPOS_RUNNING;
  const color=esGym?C.amber:C.blue;

  const[tipo,setTipo]=useState(diaData.tipo||"Descanso");
  const[detalle,setDetalle]=useState(diaData.detalle||"");
  const[distancia,setDistancia]=useState(diaData.distancia||"");
  const[ritmo,setRitmo]=useState(diaData.ritmo||"");
  const[series,setSeries]=useState(diaData.series||"");
  const[descanso,setDescanso]=useState(diaData.descanso||"");
  const[carga,setCarga]=useState(diaData.carga||"");
  const[frecuencia,setFrecuencia]=useState(diaData.frecuencia||"");
  const[comentario,setComentario]=useState(diaData.comentario||"");
  const[guardando,setGuardando]=useState(false),[ok,setOk]=useState(false);

  const guardar=async()=>{
    setGuardando(true);
    const data=esGym
      ?{...diaData,tipo,detalle,ejercicios,comentario,completado:false}
      :{...diaData,tipo,detalle,distancia,ritmo,series,descanso,carga,frecuencia,comentario,completado:false};
    if(diaData.id){
      await updateDoc(doc(db,"usuarios",uid,coleccion,diaData.id),data);
    }else{
      await addDoc(collection(db,"usuarios",uid,coleccion),data);
    }
    setOk(true);setTimeout(()=>{setOk(false);onClose();},1200);
    setGuardando(false);
  };

  const camposRunning=[
    {label:"DESCRIPCIÓN GENERAL",value:detalle,set:setDetalle,placeholder:"Ej: 8×400m @ 4:45/km"},
    {label:"DISTANCIA",value:distancia,set:setDistancia,placeholder:"Ej: 10km, 400m"},
    {label:"RITMO OBJETIVO",value:ritmo,set:setRitmo,placeholder:"Ej: 4:45/km"},
    {label:"SERIES / REPETICIONES",value:series,set:setSeries,placeholder:"Ej: 8 series"},
    {label:"DESCANSO",value:descanso,set:setDescanso,placeholder:"Ej: 90 seg entre series"},
    {label:"FC OBJETIVO",value:frecuencia,set:setFrecuencia,placeholder:"Ej: FC < 145"},
  ];
  const camposRunningFields=camposRunning;
  const[ejercicios,setEjercicios]=useState(diaData.ejercicios||[]);
  const addEj=()=>setEjercicios(prev=>[...prev,{nombre:"",ytUrl:"",series:""}]);
  const updEj=(i,field,val)=>setEjercicios(prev=>prev.map((e,idx)=>idx===i?{...e,[field]:val}:e));
  const delEj=(i)=>setEjercicios(prev=>prev.filter((_,idx)=>idx!==i));

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#000000cc",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,width:440,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
          <div style={{flex:1,fontWeight:900,fontSize:14,color:C.white}}>{diaData.dia} — {esGym?"GYM":"RUNNING"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:16}}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>TIPO DE ENTRENAMIENTO</div>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} style={inp_s}>
              {tiposOpc.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {tipo!=="Descanso"&&(
            <>
              {!esGym&&camposRunningFields.map(f=>(
                <div key={f.label} style={{marginBottom:10}}>
                  <div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>{f.label}</div>
                  <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp_s}/>
                </div>
              ))}
              {esGym&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>DESCRIPCIÓN GENERAL</div>
                  <textarea value={detalle} onChange={e=>setDetalle(e.target.value)} placeholder="Ej: Foco en tren inferior, cadena posterior" style={{...inp_s,minHeight:44,resize:"vertical",lineHeight:1.5}}/>
                </div>
              )}
              {esGym&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:8,color:C.amber,letterSpacing:1.5,marginBottom:8}}>EJERCICIOS</div>
                  {ejercicios.map((ej,i)=>(
                    <div key={i} style={{background:C.card,border:`1px solid ${C.amber}33`,borderRadius:8,padding:"10px",marginBottom:8}}>
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:7,color:C.muted,letterSpacing:1.5,marginBottom:3}}>EJERCICIO</div>
                          <input value={ej.nombre} onChange={e=>updEj(i,"nombre",e.target.value)} placeholder="Nombre del ejercicio" style={{...inp_s,borderColor:C.amber+"44"}}/>
                        </div>
                        <button onClick={()=>delEj(i)} style={{alignSelf:"flex-end",padding:"6px 9px",background:"none",border:`1px solid ${C.red}44`,borderRadius:5,color:C.red,cursor:"pointer",fontFamily:"inherit",fontSize:11,whiteSpace:"nowrap"}}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,alignItems:"end"}}>
                        <div>
                          <div style={{fontSize:7,color:C.muted,letterSpacing:1.5,marginBottom:3}}>LINK YOUTUBE (opcional)</div>
                          <input value={ej.ytUrl||""} onChange={e=>updEj(i,"ytUrl",e.target.value)} placeholder="https://youtube.com/..." style={{...inp_s,fontSize:10}}/>
                        </div>
                        <div>
                          <div style={{fontSize:7,color:C.muted,letterSpacing:1.5,marginBottom:3}}>SERIES × REPS</div>
                          <input value={ej.series} onChange={e=>updEj(i,"series",e.target.value)} placeholder="3×10" style={{...inp_s,width:80,textAlign:"center",fontWeight:700,borderColor:C.amber+"44"}}/>
                        </div>
                        {ej.ytUrl&&(
                          <a href={ej.ytUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 9px",background:"#FF000015",border:"1px solid #FF000033",borderRadius:5,fontSize:9,color:"#FF4444",textDecoration:"none",fontWeight:700,whiteSpace:"nowrap"}}>
                            <span style={{display:"inline-block",width:14,height:10,background:"#FF0000",borderRadius:2,flexShrink:0,position:"relative"}}>
                              <span style={{position:"absolute",top:"50%",left:"55%",transform:"translate(-50%,-50%)",width:0,height:0,borderStyle:"solid",borderWidth:"3px 0 3px 6px",borderColor:"transparent transparent transparent #FFF"}}/>
                            </span>
                            VER
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={addEj} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"none",border:`1px dashed ${C.amber}66`,borderRadius:7,color:C.amber,fontFamily:"inherit",fontSize:10,fontWeight:700,cursor:"pointer",width:"100%",justifyContent:"center"}}>
                    <span style={{fontSize:16,lineHeight:1}}>+</span> AGREGAR EJERCICIO
                  </button>
                </div>
              )}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:8,color:esGym?C.amber:C.blue,letterSpacing:1.5,marginBottom:4}}>NOTA PARA EL ALUMNO</div>
                <textarea value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="Instrucciones o recomendaciones para este entrenamiento..." style={{...inp_s,minHeight:70,resize:"vertical",lineHeight:1.5}}/>
              </div>
            </>
          )}
          <button onClick={guardar} disabled={guardando} style={{width:"100%",padding:"11px",background:ok?C.green:guardando?C.mutedDim:color,color:C.white,border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:900,fontSize:11,letterSpacing:2,cursor:guardando?"default":"pointer",transition:"background .3s"}}>
            {ok?"✓ GUARDADO":guardando?"GUARDANDO...":"GUARDAR DÍA"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CARGAR PLAN SEMANA (admin) ─────────────────────────
function PlanSemanaAdmin({uid,coleccion,planActual,onClose}){
  const esGym=coleccion==="planGym";
  const color=esGym?C.amber:C.blue;
  const[diaEdit,setDiaEdit]=useState(null);
  const[plan,setPlan]=useState(
    DIAS_SEMANA.map((dia,i)=>{
      const found=planActual.find(d=>d.dia===dia);
      return found?{...found,completado:false}:{dia,orden:i+1,tipo:"Descanso",detalle:"",distancia:"",ritmo:"",series:"",descanso:"",carga:"",frecuencia:"",comentario:"",ejercicios:[],completado:false};
    })
  );

  const recargar=async()=>{
    const snap=await getDocs(query(collection(db,"usuarios",uid,coleccion),orderBy("orden")));
    const loaded=snap.docs.map(d=>({id:d.id,...d.data()}));
    setPlan(DIAS_SEMANA.map((dia,i)=>{
      const found=loaded.find(d=>d.dia===dia);
      return found?{...found,completado:false}:{dia,orden:i+1,tipo:"Descanso",detalle:"",distancia:"",ritmo:"",series:"",descanso:"",carga:"",frecuencia:"",comentario:"",ejercicios:[],completado:false};
    }));
  };

  return(
    <div style={{padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:9,color:color,letterSpacing:3,fontWeight:700}}>// PLAN {esGym?"GYM":"RUNNING"} — SEMANA</div>
        <button onClick={onClose} style={{padding:"4px 10px",background:"none",border:`1px solid ${C.border}`,borderRadius:5,color:C.muted,fontSize:9,fontFamily:"inherit",cursor:"pointer"}}>CERRAR</button>
      </div>
      <div style={{fontSize:10,color:C.muted,marginBottom:12,lineHeight:1.5}}>Hacé click en cada día para editar el detalle del entrenamiento.</div>
      {plan.map((d,i)=>(
        <div key={d.dia}>
          <div onClick={()=>setDiaEdit(d)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 0",cursor:"pointer",transition:"opacity .15s"}} onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
            <div style={{width:32,fontSize:10,fontWeight:900,color:color}}>{d.dia}</div>
            <div style={{width:6,height:6,borderRadius:"50%",background:d.tipo==="Descanso"?C.border:color,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:d.tipo==="Descanso"?C.muted:C.white}}>{d.tipo}</div>
              {d.detalle&&<div style={{fontSize:9,color:C.muted}}>{d.detalle}</div>}
            </div>
            <div style={{fontSize:10,color:color}}>✏️</div>
          </div>
          {i<plan.length-1&&<Divider/>}
        </div>
      ))}
      {diaEdit&&(
        <CargarDia diaData={diaEdit} uid={uid} coleccion={coleccion} onClose={()=>{setDiaEdit(null);recargar();}}/>
      )}
    </div>
  );
}

// ── HISTORIAL PAGOS ────────────────────────────────────
function HistorialPagos({uid,pg}){
  const[pagos,setPagos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[mes,setMes]=useState(""),[monto,setMonto]=useState("");
  const[guardando,setGuardando]=useState(false);
  const[editando,setEditando]=useState(null);
  const[editMes,setEditMes]=useState(""),[editMonto,setEditMonto]=useState("");
  const[confirmarBorrar,setConfirmarBorrar]=useState(null);

  const cargar=async()=>{
    try{const snap=await getDocs(query(collection(db,"usuarios",uid,"pagos"),orderBy("creadoEn","desc")));setPagos(snap.docs.map(d=>({id:d.id,...d.data()})));}catch(e){setPagos([]);}
    setLoading(false);
  };
  useEffect(()=>{cargar();},[uid]); // eslint-disable-line

  const registrar=async()=>{
    if(!mes||!monto||guardando)return;
    setGuardando(true);
    await addDoc(collection(db,"usuarios",uid,"pagos"),{mes,monto:parseInt(monto),fecha:new Date().toLocaleDateString("es-AR"),estado:"Pagado",creadoEn:serverTimestamp()});
    setMes("");setMonto("");await cargar();setGuardando(false);
  };
  const borrar=async(id)=>{await deleteDoc(doc(db,"usuarios",uid,"pagos",id));setConfirmarBorrar(null);cargar();};
  const guardarEdit=async()=>{await updateDoc(doc(db,"usuarios",uid,"pagos",editando),{mes:editMes,monto:parseInt(editMonto)});setEditando(null);cargar();};

  if(loading)return <Spinner/>;
  return(
    <div style={{padding:16}}>
      <div style={{background:pg.color+"12",border:`1px solid ${pg.color}33`,borderRadius:8,padding:"11px 13px",marginBottom:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:1}}>ESTADO ACTUAL</div>
        <div style={{fontWeight:900,fontSize:15,color:pg.color,marginTop:3}}>{pg.label}</div>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>REGISTRAR PAGO</div>
        <div style={{display:"flex",gap:8}}>
          <input value={mes} onChange={e=>setMes(e.target.value)} placeholder="Junio 2026" style={{flex:2,...inp_s,padding:"8px 10px"}}/>
          <input type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="Monto" style={{flex:1,...inp_s,padding:"8px 10px"}}/>
          <button onClick={registrar} disabled={guardando} style={{padding:"8px 14px",background:guardando?C.mutedDim:C.blue,color:C.white,border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:guardando?"default":"pointer"}}>{guardando?"...":"+"}</button>
        </div>
      </div>
      {pagos.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12}}>Sin pagos registrados.</div>}
      {pagos.map(p=>(
        <div key={p.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
          {editando===p.id?(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={editMes} onChange={e=>setEditMes(e.target.value)} style={{flex:2,...inp_s,padding:"6px 8px",fontSize:11}}/>
              <input type="number" value={editMonto} onChange={e=>setEditMonto(e.target.value)} style={{flex:1,...inp_s,padding:"6px 8px",fontSize:11}}/>
              <button onClick={guardarEdit} style={{padding:"6px 10px",background:C.green,color:C.bg,border:"none",borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>OK</button>
              <button onClick={()=>setEditando(null)} style={{padding:"6px 10px",background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:5,fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>✕</button>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:12,fontWeight:600,color:C.white}}>{p.mes}</div><div style={{fontSize:9,color:C.muted}}>{p.fecha}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:C.white}}>${(p.monto||0).toLocaleString()}</div><Tag color={C.green}>{p.estado}</Tag></div>
                <button onClick={()=>{setEditando(p.id);setEditMes(p.mes);setEditMonto(p.monto);}} style={{padding:"4px 8px",background:"none",border:`1px solid ${C.border}`,borderRadius:4,color:C.muted,fontSize:10,cursor:"pointer"}}>✏️</button>
                {confirmarBorrar===p.id
                  ?<button onClick={()=>borrar(p.id)} style={{padding:"4px 8px",background:C.red,border:"none",borderRadius:4,color:C.white,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>BORRAR</button>
                  :<button onClick={()=>setConfirmarBorrar(p.id)} style={{padding:"4px 8px",background:"none",border:`1px solid ${C.red}44`,borderRadius:4,color:C.red,fontSize:10,cursor:"pointer"}}>🗑️</button>
                }
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── KM CHART ───────────────────────────────────────────
function KmChartAdmin({data,uid,onAgregar}){
  const[nueva,setNueva]=useState({semana:"",km:"",tipo:"carga"});
  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    const d=payload[0].payload;
    return(<div style={{background:C.card,border:`1px solid ${d.tipo==="carga"?C.blue:C.amber}44`,borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:9,color:C.muted}}>{label}</div><div style={{fontSize:20,fontWeight:900,color:d.tipo==="carga"?C.blue:C.amber}}>{d.km} km</div><Tag color={d.tipo==="carga"?C.blue:C.amber}>{d.tipo}</Tag></div>);
  };
  return(
    <div style={{padding:16}}>
      <div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:12}}>// KILOMETRAJE SEMANAL</div>
      {data.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12,marginBottom:12}}>Sin datos todavía.</div>}
      {data.length>0&&<ResponsiveContainer width="100%" height={160}><LineChart data={data} margin={{top:5,right:5,bottom:0,left:-20}}><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/><XAxis dataKey="semana" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="km" stroke={C.blue} strokeWidth={2} dot={(props)=>{const{cx,cy,payload}=props;const col=payload.tipo==="carga"?C.blue:C.amber;return <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={4} fill={col} stroke={C.bg} strokeWidth={2}/>;}} /></LineChart></ResponsiveContainer>}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginTop:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>AGREGAR SEMANA</div>
        <div style={{display:"flex",gap:8}}>
          <input value={nueva.semana} onChange={e=>setNueva({...nueva,semana:e.target.value})} placeholder="S1" style={{flex:1,...inp_s,padding:"8px 10px"}}/>
          <input type="number" value={nueva.km} onChange={e=>setNueva({...nueva,km:e.target.value})} placeholder="km" style={{flex:1,...inp_s,padding:"8px 10px"}}/>
          <select value={nueva.tipo} onChange={e=>setNueva({...nueva,tipo:e.target.value})} style={{flex:1,...inp_s,padding:"8px 10px"}}><option value="carga">Carga</option><option value="descarga">Descarga</option></select>
          <button onClick={()=>{if(!nueva.semana||!nueva.km)return;onAgregar(nueva);setNueva({semana:"",km:"",tipo:"carga"});}} style={{padding:"8px 12px",background:C.blue,color:C.white,border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>+</button>
        </div>
      </div>
    </div>
  );
}

// ── DETALLE EVENTO ─────────────────────────────────────
function DetalleEvento({evento,uid,onClose}){
  const[inscripto,setInscripto]=useState(false);
  const[distSel,setDistSel]=useState("");
  const[loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!evento||!uid)return;
    const ins=evento.inscriptos||[];
    const miInscripcion=ins.find(i=>i.uid===uid);
    if(miInscripcion){setInscripto(true);setDistSel(miInscripcion.distancia||"");}
  },[evento,uid]);

  const anotarse=async()=>{
    if(!distSel&&evento.distancias?.length>0)return;
    setLoading(true);
    const ins=evento.inscriptos||[];
    const yaEsta=ins.find(i=>i.uid===uid);
    let nuevos;
    if(yaEsta){
      nuevos=ins.map(i=>i.uid===uid?{...i,distancia:distSel}:i);
    }else{
      nuevos=[...ins,{uid,distancia:distSel||evento.distancias?.[0]||""}];
    }
    await updateDoc(doc(db,"eventos",evento.id),{inscriptos:nuevos});
    setInscripto(true);setLoading(false);
    if(distSel||!evento.distancias?.length){
      setTimeout(onClose,1000);
    }
  };

  const desinscribirse=async()=>{
    setLoading(true);
    const nuevos=(evento.inscriptos||[]).filter(i=>i.uid!==uid);
    await updateDoc(doc(db,"eventos",evento.id),{inscriptos:nuevos});
    setInscripto(false);setDistSel("");setLoading(false);
  };

  if(!evento)return null;
  const[ye,me,de]=evento.fecha?evento.fecha.split("-").map(Number):[0,0,0];
  const distancias=evento.distancias||[];

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"#000000cc",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,width:420,maxWidth:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:44,height:44,background:C.surface,borderRadius:8,border:`1px solid ${C.blue}44`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:16,fontWeight:900,color:C.blue,lineHeight:1}}>{de||"—"}</span>
            <span style={{fontSize:7,color:C.muted,letterSpacing:1}}>{me?MESES[me-1].slice(0,3).toUpperCase():"—"}</span>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:14,color:C.white}}>{evento.nombre}</div>
            <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
              <Tag color={C.blue}>{evento.tipo}</Tag>
              {evento.distancia&&<Tag color={C.amber}>{evento.distancia}</Tag>}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:16}}>
          {inscripto&&(
            <div style={{background:C.green+"12",border:`1px solid ${C.green}44`,borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
              <span>✓</span>
              <div><div style={{fontSize:12,fontWeight:700,color:C.green}}>¡Estás anotado!</div>{distSel&&<div style={{fontSize:10,color:C.muted}}>Distancia: {distSel}</div>}</div>
            </div>
          )}
          {evento.descripcion&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:6}}>DESCRIPCIÓN</div>
              <div style={{fontSize:12,color:C.white,lineHeight:1.6}}>{evento.descripcion}</div>
            </div>
          )}
          {evento.url&&(
            <div style={{background:C.card,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:6}}>SITIO OFICIAL</div>
              <a href={evento.url.startsWith("http")?evento.url:`https://${evento.url}`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,color:C.blue,fontSize:12,textDecoration:"none",fontWeight:700}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                {evento.url.replace(/^https?:\/\//,"")}
              </a>
            </div>
          )}
          {distancias.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>SELECCIONÁ TU DISTANCIA</div>
              {distancias.map((d,i)=>(
                <div key={i} onClick={()=>setDistSel(d)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:distSel===d?C.blue+"22":C.card,border:`1px solid ${distSel===d?C.blue+"66":C.border}`,borderRadius:8,marginBottom:6,cursor:"pointer",transition:"all .15s"}}>
                  <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${distSel===d?C.blue:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {distSel===d&&<div style={{width:8,height:8,borderRadius:"50%",background:C.blue}}/>}
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:distSel===d?C.blue:C.white}}>{d}</span>
                </div>
              ))}
            </div>
          )}
          {!inscripto?(
            <button onClick={anotarse} disabled={loading||(distancias.length>0&&!distSel)} style={{width:"100%",padding:"12px",background:loading||(distancias.length>0&&!distSel)?C.mutedDim:C.blue,color:C.white,border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:900,fontSize:12,letterSpacing:2,cursor:loading?"default":"pointer"}}>
              {loading?"PROCESANDO...":"ANOTARME"}
            </button>
          ):(
            <button onClick={desinscribirse} disabled={loading} style={{width:"100%",padding:"12px",background:"none",color:C.red,border:`1px solid ${C.red}44`,borderRadius:8,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              {loading?"PROCESANDO...":"DESINSCRIBIRME"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CICLO ALUMNA FORM ─────────────────────────────────
function CicloAlumnaForm({uid,cicloActual,onGuardado}){
  const[open,setOpen]=useState(false);
  const[fecha,setFecha]=useState(cicloActual?.ultimaMenstruacion||"");
  const[durCiclo,setDurCiclo]=useState(cicloActual?.duracionCiclo||28);
  const[durMens,setDurMens]=useState(cicloActual?.duracionMenstruacion||5);
  const[guardando,setGuardando]=useState(false);
  const[ok,setOk]=useState(false);
  const guardar=async()=>{
    if(!fecha)return;
    setGuardando(true);
    const data={ultimaMenstruacion:fecha,duracionCiclo:parseInt(durCiclo)||28,duracionMenstruacion:parseInt(durMens)||5};
    await updateDoc(doc(db,"usuarios",uid),{ciclo:data});
    setGuardando(false);setOk(true);
    setTimeout(()=>{setOk(false);setOpen(false);onGuardado(data);},1500);
  };
  return(
    <div>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"9px",background:open?C.surface:C.pinkDim,color:C.pink,border:`1px solid ${C.pink}44`,borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:2,cursor:"pointer"}}>
        {open?"CANCELAR":(cicloActual?"ACTUALIZAR MI CICLO":"CARGAR MI CICLO")}
      </button>
      {open&&(
        <div style={{background:C.pinkDim,border:`1px solid ${C.pink}33`,borderRadius:10,padding:"14px",marginTop:8}}>
          <div style={{fontSize:9,color:C.pink,letterSpacing:2,marginBottom:12}}>// {cicloActual?"ACTUALIZAR":"CARGAR"} DATOS DE MI CICLO</div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>FECHA DE INICIO DEL ÚLTIMO PERÍODO</div>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp_s,borderColor:C.pink+"44"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div>
              <div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>DURACIÓN DEL CICLO (días)</div>
              <input type="number" value={durCiclo} onChange={e=>setDurCiclo(e.target.value)} min="21" max="45" style={{...inp_s,borderColor:C.pink+"44"}}/>
              <div style={{fontSize:8,color:C.muted,marginTop:3}}>Promedio: 28 días</div>
            </div>
            <div>
              <div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>DURACIÓN DEL PERÍODO (días)</div>
              <input type="number" value={durMens} onChange={e=>setDurMens(e.target.value)} min="2" max="10" style={{...inp_s,borderColor:C.pink+"44"}}/>
              <div style={{fontSize:8,color:C.muted,marginTop:3}}>Promedio: 5 días</div>
            </div>
          </div>
          <div style={{background:C.surface,borderRadius:7,padding:"9px 11px",marginBottom:12,fontSize:10,color:C.muted,lineHeight:1.6}}>
            📌 Estos datos son privados. Solo los ven vos y tu entrenador para adaptar el plan de entrenamiento.
          </div>
          <button onClick={guardar} disabled={!fecha||guardando} style={{width:"100%",padding:"10px",background:ok?C.green:!fecha||guardando?C.mutedDim:C.pink,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:2,cursor:!fecha||guardando?"default":"pointer",transition:"background .3s"}}>
            {ok?"✓ GUARDADO":guardando?"GUARDANDO...":"GUARDAR"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ALUMNO PROPONER EVENTO ─────────────────────────────
function AlumnoProponerEvento({uid,onGuardado}){
  const[open,setOpen]=useState(false);
  const[form,setForm]=useState({nombre:"",fecha:"",distancia:"",tipo:"Carrera"});
  const[guardando,setGuardando]=useState(false);
  const[ok,setOk]=useState(false);
  const[nombreAlumno,setNombreAlumno]=useState("");
  useEffect(()=>{
    getDoc(doc(db,"usuarios",uid)).then(s=>{if(s.exists())setNombreAlumno(s.data().nombre||"Alumno");});
  },[uid]);
  const proponer=async()=>{
    if(!form.nombre||!form.fecha||guardando)return;
    setGuardando(true);
    await addDoc(collection(db,"eventos"),{...form,estado:"pendiente",propuestoPor:nombreAlumno,propuestoPorUid:uid,inscriptos:[],creadoEn:serverTimestamp()});
    setForm({nombre:"",fecha:"",distancia:"",tipo:"Carrera"});
    setGuardando(false);setOk(true);
    setTimeout(()=>{setOk(false);setOpen(false);onGuardado();},1800);
  };
  return(
    <div style={{marginBottom:12}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"8px",background:open?C.surface:"none",color:C.blue,border:`1px solid ${open?C.border:C.blue+"66"}`,borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <span style={{fontSize:14,lineHeight:1}}>+</span>{open?"CANCELAR":"PROPONER UN EVENTO"}
      </button>
      {open&&(
        <div style={{background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:10,padding:"14px",marginTop:8}}>
          <div style={{fontSize:9,color:C.blue,letterSpacing:2,marginBottom:8}}>// PROPONER EVENTO</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:12,lineHeight:1.6}}>Tu propuesta será revisada por el entrenador antes de aparecer en el calendario.</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>NOMBRE DEL EVENTO</div><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej: 10K Villa María" style={inp_s}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>FECHA</div><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={inp_s}/></div>
              <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>TIPO</div><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp_s}>{["Carrera","Trail","Triatlón","Entrenamiento","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>DISTANCIA (opcional)</div><input value={form.distancia} onChange={e=>setForm({...form,distancia:e.target.value})} placeholder="Ej: 10K, 21K" style={inp_s}/></div>
            <button onClick={proponer} disabled={!form.nombre||!form.fecha||guardando} style={{padding:"10px",background:ok?C.green:!form.nombre||!form.fecha?C.mutedDim:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:2,cursor:!form.nombre||!form.fecha||guardando?"default":"pointer",transition:"background .3s"}}>
              {ok?"✓ PROPUESTA ENVIADA":guardando?"ENVIANDO...":"ENVIAR PROPUESTA"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EVENTOS (admin + alumno compartido) ────────────────
function EventosView({uid,esAdmin=false,alumnos=[]}){
  const[eventos,setEventos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[mesActual,setMesActual]=useState(new Date().getMonth());
  const[anioActual,setAnioActual]=useState(new Date().getFullYear());
  const[form,setForm]=useState({nombre:"",fecha:"",distancia:"",tipo:"Carrera",descripcion:"",distancias:""});
  const[mostrarForm,setMostrarForm]=useState(false);
  const[guardando,setGuardando]=useState(false);
  const[eventoSel,setEventoSel]=useState(null);
  const[confirmarBorrar,setConfirmarBorrar]=useState(null);

  const cargar=async()=>{
    try{const snap=await getDocs(query(collection(db,"eventos"),orderBy("fecha")));setEventos(snap.docs.map(d=>({id:d.id,...d.data()})));}catch(e){setEventos([]);}
    setLoading(false);
  };
  const aprobarEvento=async(id)=>{await updateDoc(doc(db,"eventos",id),{estado:"aprobado"});cargar();};
  const rechazarEvento=async(id)=>{await deleteDoc(doc(db,"eventos",id));cargar();};
  useEffect(()=>{cargar();},[]);

  const guardar=async()=>{
    if(!form.nombre||!form.fecha||guardando)return;
    setGuardando(true);
    const distanciasArr=form.distancias?form.distancias.split(",").map(d=>d.trim()).filter(Boolean):[];
    await addDoc(collection(db,"eventos"),{...form,url:form.url||"",distancias:distanciasArr,inscriptos:[],creadoEn:serverTimestamp()});
    setForm({nombre:"",fecha:"",distancia:"",tipo:"Carrera",descripcion:"",distancias:""});
    setMostrarForm(false);await cargar();setGuardando(false);
  };

  const borrar=async(id)=>{await deleteDoc(doc(db,"eventos",id));setConfirmarBorrar(null);cargar();};

  const primerDia=new Date(anioActual,mesActual,1).getDay();
  const offset=(primerDia+6)%7;
  const diasEnMes=new Date(anioActual,mesActual+1,0).getDate();
  const celdas=Array.from({length:offset+diasEnMes},(_,i)=>i<offset?null:i-offset+1);
  const eventosAprobados=eventos.filter(e=>!e.estado||e.estado==="aprobado");
  const eventosPendientes=eventos.filter(e=>e.estado==="pendiente");
  const eventosDelMes=eventosAprobados.filter(e=>{if(!e.fecha)return false;const[y,m]=e.fecha.split("-").map(Number);return y===anioActual&&m-1===mesActual;});
  const eventosDelDia=dia=>eventosDelMes.filter(e=>parseInt(e.fecha.split("-")[2])===dia);
  const prevMes=()=>{if(mesActual===0){setMesActual(11);setAnioActual(a=>a-1);}else setMesActual(m=>m-1);};
  const nextMes=()=>{if(mesActual===11){setMesActual(0);setAnioActual(a=>a+1);}else setMesActual(m=>m+1);};

  const getInscriptosEvento=(e)=>{
    if(!e.inscriptos)return[];
    return e.inscriptos.map(i=>{
      const alumno=alumnos.find(a=>a.uid===i.uid);
      return{...i,nombre:alumno?.nombre||"Alumno"};
    });
  };

  if(loading)return <Spinner/>;

  const wrapStyle=esAdmin?{maxWidth:860,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}:{maxWidth:430,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1};

  return(
    <div style={wrapStyle}>
      {esAdmin&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:3}}>EVENTOS Y CARRERAS</div>
          <button onClick={()=>setMostrarForm(!mostrarForm)} style={{padding:"7px 16px",background:mostrarForm?C.surface:C.blue,color:C.white,border:`1px solid ${mostrarForm?C.border:C.blue}`,borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:1,cursor:"pointer"}}>
            {mostrarForm?"CANCELAR":"+ NUEVO EVENTO"}
          </button>
        </div>
      )}

      {!esAdmin&&(
        <div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:3,marginBottom:10}}>CALENDARIO DE EVENTOS</div>
          <AlumnoProponerEvento uid={uid} onGuardado={cargar}/>
        </div>
      )}

      {/* Form nuevo evento (solo admin) */}
      {esAdmin&&mostrarForm&&(
        <div style={{background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:12}}>// AGREGAR EVENTO</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>NOMBRE</div><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej: Maratón Buenos Aires" style={{...inp_s,padding:"10px 12px"}}/></div>
            <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>FECHA</div><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={{...inp_s,padding:"10px 12px"}}/></div>
            <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>TIPO</div><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={{...inp_s,padding:"10px 12px"}}>{["Carrera","Entrenamiento grupal","Trail","Triatlón","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>DISTANCIA PRINCIPAL</div><input value={form.distancia} onChange={e=>setForm({...form,distancia:e.target.value})} placeholder="Ej: 42km" style={{...inp_s,padding:"10px 12px"}}/></div>
            <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>DISTANCIAS DISPONIBLES (separadas por coma)</div><input value={form.distancias} onChange={e=>setForm({...form,distancias:e.target.value})} placeholder="Ej: 5K, 10K, 21K" style={{...inp_s,padding:"10px 12px"}}/></div>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>DESCRIPCIÓN</div><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} placeholder="Info adicional del evento..." style={{...inp_s,padding:"10px 12px",minHeight:60,resize:"vertical"}}/></div>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:4}}>LINK (sitio web o Instagram)</div><input value={form.url||""} onChange={e=>setForm({...form,url:e.target.value})} placeholder="Ej: www.10klaplata.com.ar o @mediamaratonrosario" style={{...inp_s,padding:"10px 12px"}}/></div>
          </div>
          <button onClick={guardar} disabled={guardando} style={{width:"100%",marginTop:12,padding:"11px",background:guardando?C.mutedDim:C.blue,color:C.white,border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:900,fontSize:11,letterSpacing:2,cursor:guardando?"default":"pointer"}}>
            {guardando?"GUARDANDO...":"GUARDAR EVENTO"}
          </button>
        </div>
      )}

      {/* Calendario */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button onClick={prevMes} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.white,padding:"5px 10px",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>‹</button>
          <div style={{fontWeight:900,fontSize:14,letterSpacing:2,color:C.white}}>{MESES[mesActual].toUpperCase()} {anioActual}</div>
          <button onClick={nextMes} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.white,padding:"5px 10px",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:8,color:C.muted,fontWeight:700,padding:"3px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {celdas.map((dia,i)=>{
            if(!dia)return <div key={`e${i}`}/>;
            const evs=eventosDelDia(dia);
            const hoy=new Date();
            const esHoy=dia===hoy.getDate()&&mesActual===hoy.getMonth()&&anioActual===hoy.getFullYear();
            return(
              <div key={dia} style={{minHeight:48,background:esHoy?C.blueDim:C.surface,border:`1px solid ${esHoy?C.blue:evs.length>0?C.blue+"44":C.border}`,borderRadius:5,padding:"3px 4px"}}>
                <div style={{fontSize:9,fontWeight:esHoy?900:400,color:esHoy?C.blue:C.muted,marginBottom:2}}>{dia}</div>
                {evs.map(e=>(
                  <div key={e.id} onClick={()=>setEventoSel(e)} style={{background:C.blue+"22",borderRadius:3,padding:"2px 4px",marginBottom:2,cursor:"pointer"}} onMouseEnter={ev=>ev.currentTarget.style.background=C.blue+"44"} onMouseLeave={ev=>ev.currentTarget.style.background=C.blue+"22"}>
                    <div style={{fontSize:7,color:C.blue,fontWeight:700,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.nombre}</div>
                    {e.distancia&&<div style={{fontSize:6,color:C.muted}}>{e.distancia}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista eventos */}
      {esAdmin&&eventosPendientes.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.amber}44`,borderRadius:12,overflow:"hidden",marginBottom:12}}>
          <div style={{padding:"9px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:9,color:C.amber,letterSpacing:2}}>EVENTOS PROPUESTOS POR ALUMNOS</span>
            <span style={{background:C.amber+"22",color:C.amber,borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{eventosPendientes.length}</span>
          </div>
          {eventosPendientes.map((e,i)=>{
            const[ye,me,de]=e.fecha?e.fecha.split("-").map(Number):[0,0,0];
            return(
              <div key={e.id} style={{padding:"10px 14px",borderBottom:i<eventosPendientes.length-1?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,background:C.surface,borderRadius:6,border:`1px solid ${C.amber}44`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:900,color:C.amber,lineHeight:1}}>{de||"—"}</span>
                  <span style={{fontSize:6,color:C.muted,letterSpacing:1}}>{me?MESES[me-1].slice(0,3).toUpperCase():"—"}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:12,color:C.white}}>{e.nombre}</div>
                  <div style={{fontSize:9,color:C.muted,marginTop:2}}>Propuesto por: <span style={{color:C.amber}}>{e.propuestoPor||"Alumno"}</span></div>
                  <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                    <Tag color={C.amber}>{e.tipo}</Tag>
                    {e.distancia&&<Tag color={C.muted}>{e.distancia}</Tag>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>aprobarEvento(e.id)} style={{padding:"5px 10px",background:C.green,color:C.bg,border:"none",borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>APROBAR</button>
                  <button onClick={()=>rechazarEvento(e.id)} style={{padding:"5px 10px",background:"none",color:C.red,border:`1px solid ${C.red}44`,borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>RECHAZAR</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"9px 14px",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:9,color:C.muted,letterSpacing:2}}>PRÓXIMOS EVENTOS</span></div>
        {eventosAprobados.length===0&&<div style={{padding:20,textAlign:"center",color:C.muted,fontSize:12}}>No hay eventos cargados todavía.</div>}
        {eventosAprobados.map((e,i)=>{
          const[ye,me,de]=e.fecha?e.fecha.split("-").map(Number):[0,0,0];
          const ins=getInscriptosEvento(e);
          const miInscripcion=e.inscriptos?.find(i=>i.uid===uid);
          return(
            <div key={e.id} style={{padding:"11px 14px",borderBottom:i<eventos.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,background:C.surface,borderRadius:7,border:`1px solid ${C.blue}44`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:900,color:C.blue,lineHeight:1}}>{de||"—"}</span>
                  <span style={{fontSize:6,color:C.muted,letterSpacing:1}}>{me?MESES[me-1].slice(0,3).toUpperCase():"—"}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:12,color:C.white}}>{e.nombre}</div>
                  <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                    <Tag color={C.blue}>{e.tipo}</Tag>
                    {e.distancia&&<Tag color={C.amber}>{e.distancia}</Tag>}
                    {miInscripcion&&<Tag color={C.green}>ANOTADO{miInscripcion.distancia?` — ${miInscripcion.distancia}`:""}</Tag>}
                  </div>
                  {esAdmin&&ins.length>0&&(
                    <div style={{marginTop:5,fontSize:9,color:C.muted}}>
                      Inscriptos: {ins.map(i=>`${i.nombre}${i.distancia?` (${i.distancia})`:""}`).join(", ")}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>setEventoSel(e)} style={{padding:"5px 10px",background:C.blue+"22",color:C.blue,border:`1px solid ${C.blue}44`,borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>
                    {esAdmin?"VER":"DETALLE"}
                  </button>
                  {esAdmin&&(confirmarBorrar===e.id
                    ?<button onClick={()=>borrar(e.id)} style={{padding:"5px 10px",background:C.red,border:"none",borderRadius:5,color:C.white,fontSize:9,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>BORRAR</button>
                    :<button onClick={()=>setConfirmarBorrar(e.id)} style={{padding:"5px 8px",background:"none",border:`1px solid ${C.border}`,borderRadius:5,color:C.muted,fontSize:11,cursor:"pointer"}}>🗑️</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detalle evento */}
      {eventoSel&&(
        esAdmin
          ?<DetalleEvento evento={eventoSel} uid={null} onClose={()=>{setEventoSel(null);cargar();}}/>
          :<DetalleEvento evento={eventoSel} uid={uid} onClose={()=>{setEventoSel(null);cargar();}}/>
      )}
    </div>
  );
}

// ── CICLO CALENDARIO (admin) ───────────────────────────
function CicloCalendario({ci,ciclo}){
  if(!ci||!ciclo)return null;
  try{
    const hoy=new Date();
    const anio=hoy.getFullYear();
    const mes=hoy.getMonth();
    const MESES_N=["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    const primerDia=new Date(anio,mes,1).getDay();
    const offset=(primerDia+6)%7;
    const diasEnMes=new Date(anio,mes+1,0).getDate();
    const celdas=Array.from({length:offset+diasEnMes},(_,i)=>i<offset?null:i-offset+1);
    const diasPeriodo=new Set();
    const diasOvulacion=new Set();
    const diasHasta=ci.diasHastaProxima||0;
    const durMens=ciclo.duracionMenstruacion||5;
    const inicioProx=new Date(hoy);
    inicioProx.setDate(inicioProx.getDate()+diasHasta);
    for(let d=0;d<durMens;d++){
      const f=new Date(inicioProx);f.setDate(f.getDate()+d);
      if(f.getMonth()===mes&&f.getFullYear()===anio)diasPeriodo.add(f.getDate());
    }
    const inicioOvul=new Date(inicioProx);
    inicioOvul.setDate(inicioOvul.getDate()+14);
    for(let d=0;d<3;d++){
      const f=new Date(inicioOvul);f.setDate(f.getDate()+d);
      if(f.getMonth()===mes&&f.getFullYear()===anio)diasOvulacion.add(f.getDate());
    }
    if(ci.enMenstruacion){
      const diasRest=(ciclo.duracionMenstruacion||5)-(ci.diaEnCiclo||1)+1;
      for(let d=0;d<diasRest;d++){
        const f=new Date(hoy);f.setDate(f.getDate()+d);
        if(f.getMonth()===mes&&f.getFullYear()===anio)diasPeriodo.add(f.getDate());
      }
    }
    return(
      <div style={{marginTop:12}}>
        <div style={{fontSize:7,color:C.pink,letterSpacing:2,marginBottom:6}}>{MESES_N[mes]} {anio} — VISTA DEL CICLO</div>
        <div style={{display:"flex",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          {[{c:C.pink,l:"Período"},{c:C.green,l:"Ovulación"},{c:C.blue,l:"Hoy"}].map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:x.c,flexShrink:0}}/>
              <span style={{fontSize:7,color:C.muted}}>{x.l}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
          {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:7,color:C.muted,fontWeight:700,padding:"2px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {celdas.map((dia,i)=>{
            if(!dia)return <div key={"e"+i}/>;
            const esHoy=dia===hoy.getDate();
            const esPer=diasPeriodo.has(dia);
            const esOvul=diasOvulacion.has(dia);
            return(
              <div key={dia} style={{minHeight:26,background:esHoy?C.blueDim:esPer?C.pink+"18":esOvul?C.green+"15":C.surface,border:`1px solid ${esHoy?C.blue:esPer?C.pink+"55":esOvul?C.green+"44":C.border}`,borderRadius:3,padding:"2px 3px",position:"relative"}}>
                <div style={{fontSize:8,color:esHoy?C.blue:esPer?C.pink:C.muted,fontWeight:esHoy?900:400}}>{dia}</div>
                {esPer&&<div style={{position:"absolute",top:2,right:2,width:3,height:3,borderRadius:"50%",background:C.pink}}/>}
                {esOvul&&!esPer&&<div style={{position:"absolute",top:2,right:2,width:3,height:3,borderRadius:"50%",background:C.green}}/>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }catch(err){
    return null;
  }
}

// ── MODAL ALUMNO (admin) ───────────────────────────────
function AlumnoModal({alumno,onClose,onUpdate,alumnos=[]}){
  const[tab,setTab]=useState("perfil");
  const[nota,setNota]=useState("");
  const[guardado,setGuardado]=useState(false);
  const[kmData,setKmData]=useState([]);
  const[planRunning,setPlanRunning]=useState([]);
  const[planGym,setPlanGym]=useState([]);
  const[planSubTab,setPlanSubTab]=useState("running");
  const[mostrarPlanEdit,setMostrarPlanEdit]=useState(false);

  const[nombre,setNombre]=useState(alumno.nombre||"");
  const[tipo,setTipo]=useState(alumno.tipo||"");
  const[planDias,setPlanDias]=useState(alumno.planDias||"");
  const[pagado,setPagado]=useState(alumno.pagado||false);
  const[progreso,setProgreso]=useState(alumno.progreso||0);
  const[genero,setGenero]=useState(alumno.genero||"");
  const[objetivo,setObjetivo]=useState(alumno.objetivo||"");
  const[peso,setPeso]=useState(alumno.peso||"");
  const[edad,setEdad]=useState(alumno.edad||"");
  const[editOk,setEditOk]=useState(false);

  const ps=planStatus(alumno.planDias);
  const pg=payStatus(alumno.pagado,alumno.diasVencido);
  const ci=alumno.ciclo?cicloInfo(alumno.ciclo):null;
  const faseColor={"Menstruación":C.pink,"Folicular":C.blue,"Ovulación":C.green,"Lútea":C.amber};
  const esGymYRunning=(tipo||alumno.tipo)==="Running + Gym";
  const generoFinal=genero||alumno.genero;
  const tabs=generoFinal==="F"?["perfil","plan","ciclo","pagos","notas","km"]:["perfil","plan","pagos","notas","km"];
  const colActual=planSubTab==="gym"?"planGym":"plan";
  const planActual=planSubTab==="gym"?planGym:planRunning;

  const cargarPlanes=()=>{
    getDocs(query(collection(db,"usuarios",alumno.uid,"plan"),orderBy("orden"))).then(s=>setPlanRunning(s.docs.map(d=>({id:d.id,...d.data()}))));
    getDocs(query(collection(db,"usuarios",alumno.uid,"planGym"),orderBy("orden"))).then(s=>setPlanGym(s.docs.map(d=>({id:d.id,...d.data()}))));
  };

  useEffect(()=>{
    getDoc(doc(db,"notas",alumno.uid)).then(s=>{if(s.exists())setNota(s.data().texto||"");});
    getDocs(query(collection(db,"usuarios",alumno.uid,"kilometraje"),orderBy("semana"))).then(s=>setKmData(s.docs.map(d=>d.data())));
    cargarPlanes();
  },[alumno.uid]); // eslint-disable-line

  const guardarNota=async()=>{await setDoc(doc(db,"notas",alumno.uid),{texto:nota,actualizadoEn:serverTimestamp()});setGuardado(true);setTimeout(()=>setGuardado(false),2000);};
  const guardarPerfil=async()=>{
    await updateDoc(doc(db,"usuarios",alumno.uid),{nombre,tipo,planDias:parseInt(planDias)||0,pagado,progreso:parseInt(progreso)||0,genero,objetivo,peso,edad});
    setEditOk(true);setTimeout(()=>{setEditOk(false);if(onUpdate)onUpdate();},1500);
  };
  const agregarKm=async(nueva)=>{
    await addDoc(collection(db,"usuarios",alumno.uid,"kilometraje"),{semana:nueva.semana,km:parseInt(nueva.km),tipo:nueva.tipo});
    getDocs(query(collection(db,"usuarios",alumno.uid,"kilometraje"),orderBy("semana"))).then(s=>setKmData(s.docs.map(d=>d.data())));
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"#000000cc",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:C.white}}>{(alumno.nombre||"?")[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:13,color:C.white}}>{alumno.nombre}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{alumno.tipo&&<Tag color={C.blue}>{alumno.tipo}</Tag>}{generoFinal==="F"&&<Tag color={C.pink}>♀</Tag>}{generoFinal==="M"&&<Tag color={C.blue}>♂</Tag>}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,overflowX:"auto",flexShrink:0}}>
          {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"7px 11px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${t==="ciclo"?C.pink:C.blue}`:"2px solid transparent",color:tab===t?(t==="ciclo"?C.pink:C.blue):C.muted,fontFamily:"inherit",fontWeight:700,fontSize:8,letterSpacing:1.5,cursor:"pointer",textTransform:"uppercase"}}>{t==="ciclo"?"CICLO ♀":t.toUpperCase()}</button>)}
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {tab==="perfil"&&(
            <div style={{padding:14}}>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {[{label:"NOMBRE",value:nombre,set:setNombre,placeholder:"Nombre completo"},{label:"OBJETIVO",value:objetivo,set:setObjetivo,placeholder:"Objetivo principal"},{label:"PESO (kg)",value:peso,set:setPeso,placeholder:"72",type:"number"},{label:"EDAD",value:edad,set:setEdad,placeholder:"25",type:"number"}].map(f=>(
                  <div key={f.label}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>{f.label}</div><input type={f.type||"text"} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp_s}/></div>
                ))}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>GÉNERO</div><select value={genero} onChange={e=>setGenero(e.target.value)} style={inp_s}><option value="">Sin especificar</option><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
                  <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>TIPO DE PLAN</div><select value={tipo} onChange={e=>setTipo(e.target.value)} style={inp_s}><option value="">Sin asignar</option><option value="Solo Running">Solo Running</option><option value="Running + Gym">Running + Gym</option></select></div>
                  <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>DÍAS PLAN</div><input type="number" value={planDias} onChange={e=>setPlanDias(e.target.value)} style={inp_s} min="0" max="15"/></div>
                  <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>PROGRESO %</div><input type="number" value={progreso} onChange={e=>setProgreso(e.target.value)} style={inp_s} min="0" max="100"/></div>
                  <div style={{gridColumn:"1/-1"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>PAGO</div><select value={pagado?"si":"no"} onChange={e=>setPagado(e.target.value==="si")} style={inp_s}><option value="si">AL DÍA</option><option value="no">PENDIENTE</option></select></div>
                </div>
                <button onClick={guardarPerfil} style={{padding:"10px",background:editOk?C.green:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:10,letterSpacing:2,cursor:"pointer",transition:"background .3s"}}>{editOk?"✓ GUARDADO":"GUARDAR CAMBIOS"}</button>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px"}}>
                  <div style={{fontSize:8,color:C.muted,letterSpacing:2,marginBottom:7}}>MARCAS</div>
                  {[{l:"5K",v:alumno.marcas?.cinco||"—"},{l:"10K",v:alumno.marcas?.diez||"—"},{l:"21K",v:alumno.marcas?.media||"—"},{l:"42K",v:alumno.marcas?.maraton||"—"}].map(m=>(
                    <div key={m.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:9,color:C.muted}}>MEJOR {m.l}</span><span style={{fontSize:11,fontWeight:700,color:C.white}}>{m.v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="plan"&&(
            <div>
              {mostrarPlanEdit?(
                <PlanSemanaAdmin uid={alumno.uid} coleccion={colActual} planActual={planActual} onClose={()=>{setMostrarPlanEdit(false);cargarPlanes();}}/>
              ):(
                <div style={{padding:14}}>
                  {esGymYRunning&&(
                    <div style={{display:"flex",background:C.surface,borderRadius:8,padding:3,marginBottom:12}}>
                      {[["running","🏃 RUNNING"],["gym","🏋️ GYM"]].map(([k,l])=>(
                        <button key={k} onClick={()=>setPlanSubTab(k)} style={{flex:1,padding:"7px",border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer",background:planSubTab===k?(k==="gym"?C.amber:C.blue):"transparent",color:planSubTab===k?C.white:C.muted,transition:"all .2s"}}>{l}</button>
                      ))}
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div><div style={{fontSize:9,color:C.muted,letterSpacing:1}}>PLAN {esGymYRunning?(planSubTab==="gym"?"GYM":"RUNNING"):"ACTUAL"}</div><div style={{fontWeight:700,color:ps.color,marginTop:2,fontSize:11}}>{ps.label}</div></div>
                    <button onClick={()=>setMostrarPlanEdit(true)} style={{padding:"7px 12px",background:planSubTab==="gym"?C.amber:C.blue,color:C.white,border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>
                      {planActual.length===0?"+ CARGAR PLAN":"EDITAR PLAN"}
                    </button>
                  </div>
                  {planActual.length===0
                    ?<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:20,background:C.card,borderRadius:8,border:`1px solid ${C.border}`}}>Sin plan cargado. Hacé click en "Cargar Plan".</div>
                    :planActual.map((d,i)=>(
                      <div key={d.id||i} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:`1px solid ${C.border}`,opacity:d.tipo==="Descanso"?.45:1}}>
                        <div style={{width:26,fontSize:9,fontWeight:700,color:d.completado?C.green:C.muted}}>{d.dia}</div>
                        <div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:d.completado?C.green:d.tipo==="Descanso"?C.border:(planSubTab==="gym"?C.amber:C.blue)}}/>
                        <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:d.completado?C.muted:C.white}}>{d.tipo}</div>{d.detalle&&<div style={{fontSize:9,color:C.muted}}>{d.detalle}</div>}</div>
                        {d.completado&&<span style={{color:C.green,fontSize:11}}>✓</span>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {tab==="ciclo"&&(
            <div style={{padding:14}}>
              {ci?(
                <div>
                  {ci.enMenstruacion&&ci.diaEnCiclo<=2&&<div style={{background:C.pink+"15",border:`1px solid ${C.pink}44`,borderRadius:8,padding:"9px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}><span>⚠️</span><div><div style={{fontSize:11,color:C.pink,fontWeight:700}}>DÍA {ci.diaEnCiclo} — NO ENTRENAR</div></div></div>}
                  {ci.alertaProxima&&<div style={{background:C.amber+"12",border:`1px solid ${C.amber}44`,borderRadius:8,padding:"9px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}><span>🗓️</span><div><div style={{fontSize:11,color:C.amber,fontWeight:700}}>MENSTRUACIÓN EN {ci.diasHastaProxima}D</div></div></div>}
                  <div style={{background:C.pinkDim,border:`1px solid ${C.pink}33`,borderRadius:10,padding:"13px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                      {[
                      {label:"FASE",value:ci.fase,color:faseColor[ci.fase]||C.muted},
                      {label:"DÍA DEL CICLO",value:`${ci.diaEnCiclo} / ${ci.durCiclo}`,color:C.white},
                      {label:"PRÓXIMO PERÍODO",value:`En ${ci.diasHastaProxima}d`,color:ci.diasHastaProxima<=3?C.pink:C.muted},
                      {label:"OVULACIÓN EST.",value:(()=>{const diasOvul=14-(ci.diaEnCiclo);return diasOvul>0?`En ~${diasOvul}d`:"Esta semana";})(),color:C.green},
                      {label:"DURACIÓN CICLO",value:`${ci.durCiclo} días`,color:C.white},
                      {label:"DURACIÓN PERÍODO",value:`${ci.durMens} días`,color:C.white},
                    ].map(item=>(
                      <div key={item.label} style={{background:C.card,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:7,color:C.muted,letterSpacing:1.5,marginBottom:2}}>{item.label}</div><div style={{fontSize:11,fontWeight:700,color:item.color}}>{item.value}</div></div>
                    ))}
                    </div>
                  </div>
                  {/* Calendario del mes con ciclo marcado */}
                  <CicloCalendario ci={ci} ciclo={alumno.ciclo}/>
                </div>
              ):<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:20}}>Sin datos de ciclo. La alumna debe cargar su período.</div>}
            </div>
          )}

          {tab==="pagos"&&<HistorialPagos uid={alumno.uid} pg={pg}/>}

          {tab==="notas"&&(
            <div style={{padding:14}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:7}}>NOTAS PRIVADAS</div>
              <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Lesiones, contexto, observaciones..." style={{width:"100%",minHeight:140,padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.6}}/>
              <button onClick={guardarNota} style={{width:"100%",marginTop:8,padding:"9px",background:guardado?C.green:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:2,cursor:"pointer",transition:"background .3s"}}>{guardado?"✓ GUARDADO":"GUARDAR NOTA"}</button>
            </div>
          )}

          {tab==="km"&&<KmChartAdmin data={kmData} uid={alumno.uid} onAgregar={agregarKm}/>}
        </div>
      </div>
    </div>
  );
}

// ── PANEL FILTRADO ─────────────────────────────────────
function PanelFiltrado({titulo,alumnos,onSelect,onClose}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:"#000000cc",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,width:440,maxWidth:"100%",maxHeight:"80vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontWeight:900,fontSize:12,color:C.white,letterSpacing:2}}>{titulo}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {alumnos.length===0&&<div style={{padding:24,textAlign:"center",color:C.muted,fontSize:12}}>No hay alumnos en esta categoría.</div>}
          {alumnos.map((a,i)=>{
            const ps=planStatus(a.planDias),pg=payStatus(a.pagado,a.diasVencido);
            return(
              <div key={a.uid}>
                <div onClick={()=>onSelect(a)} style={{padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background=C.cardHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:C.white}}>{(a.nombre||"?")[0]}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:C.white}}>{a.nombre}</div><div style={{fontSize:9,color:C.muted}}>{a.tipo||"—"} · <span style={{color:ps.color}}>{ps.label}</span> · <span style={{color:pg.color}}>{pg.label}</span></div></div>
                  <span style={{color:C.muted,fontSize:14}}>›</span>
                </div>
                {i<alumnos.length-1&&<Divider/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN VIEW ─────────────────────────────────────────
function AdminView(){
  const[alumnos,setAlumnos]=useState([]);
  const[solicitudes,setSolicitudes]=useState([]);
  const[loading,setLoading]=useState(true);
  const[tab,setTab]=useState("alumnos");
  const[alumnoSel,setAlumnoSel]=useState(null);
  const[panelFiltro,setPanelFiltro]=useState(null);

  const cargar=async()=>{
    setLoading(true);
    const snap=await getDocs(collection(db,"usuarios"));
    const todos=snap.docs.map(d=>({uid:d.id,...d.data()}));
    setAlumnos(todos.filter(u=>u.role==="alumno"&&u.estado==="activo"));
    setSolicitudes(todos.filter(u=>u.role==="alumno"&&u.estado==="pendiente"));
    setLoading(false);
  };
  useEffect(()=>{cargar();},[]);

  const aprobar=async(uid)=>{await updateDoc(doc(db,"usuarios",uid),{estado:"activo"});cargar();};
  const rechazar=async(uid)=>{await updateDoc(doc(db,"usuarios",uid),{estado:"rechazado"});cargar();};

  if(loading)return <Spinner/>;

  const stats=[
    {label:"ACTIVOS",value:alumnos.length,color:C.white,lista:alumnos,titulo:"ALUMNOS ACTIVOS"},
    {label:"SOLICITUDES",value:solicitudes.length,color:solicitudes.length>0?C.amber:C.muted,lista:solicitudes,titulo:"SOLICITUDES PENDIENTES"},
    {label:"AL DÍA",value:alumnos.filter(a=>a.pagado).length,color:C.green,lista:alumnos.filter(a=>a.pagado),titulo:"PAGOS AL DÍA"},
    {label:"PLANES URGENTES",value:alumnos.filter(a=>planStatus(a.planDias).urgente).length,color:C.amber,lista:alumnos.filter(a=>planStatus(a.planDias).urgente),titulo:"PLANES URGENTES"},
  ];

  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:3}}>PANEL DE CONTROL</div><Slashes/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {stats.map(s=>(
          <div key={s.label} onClick={()=>setPanelFiltro({titulo:s.titulo,lista:s.lista})} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 12px",cursor:"pointer",transition:"border .2s"}} onMouseEnter={e=>e.currentTarget.style.border=`1px solid ${s.color}66`} onMouseLeave={e=>e.currentTarget.style.border=`1px solid ${C.border}`}>
            <div style={{fontSize:7,color:C.muted,letterSpacing:2,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:22,fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:7,color:s.color,marginTop:3,letterSpacing:1}}>VER ›</div>
          </div>
        ))}
      </div>
      {solicitudes.map(s=>(
        <div key={s.uid} style={{display:"flex",alignItems:"center",gap:10,background:`${C.amber}12`,border:`1px solid ${C.amber}44`,borderRadius:8,padding:"9px 12px",marginBottom:6}}>
          <span>🔔</span>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:C.white}}>{s.nombre}</div><div style={{fontSize:10,color:C.muted}}>{s.email}</div></div>
          <button onClick={()=>aprobar(s.uid)} style={{padding:"5px 10px",background:C.green,color:C.bg,border:"none",borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>APROBAR</button>
          <button onClick={()=>rechazar(s.uid)} style={{padding:"5px 10px",background:"none",color:C.red,border:`1px solid ${C.red}44`,borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>RECHAZAR</button>
        </div>
      ))}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {["alumnos","cobros","eventos"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"8px 14px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${C.blue}`:"2px solid transparent",color:tab===t?C.blue:C.muted,fontFamily:"inherit",fontWeight:700,fontSize:9,letterSpacing:2,cursor:"pointer",textTransform:"uppercase"}}>{t}</button>
        ))}
      </div>

      {tab==="alumnos"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px"}}>
          <div style={{padding:"8px 14px"}}><span style={{fontSize:9,color:C.muted,letterSpacing:2}}>ALUMNOS ACTIVOS</span></div><Divider/>
          {alumnos.length===0&&<div style={{padding:20,textAlign:"center",color:C.muted,fontSize:12}}>No hay alumnos activos todavía.</div>}
          {alumnos.map((a,i)=>{
            const ps=planStatus(a.planDias),pg=payStatus(a.pagado,a.diasVencido);
            const ci=a.ciclo?cicloInfo(a.ciclo):null;
            const cicloAlerta=ci&&(ci.alertaProxima||(ci.enMenstruacion&&ci.diaEnCiclo<=2));
            return(
              <div key={a.uid}>
                <div onClick={()=>setAlumnoSel(a)} style={{padding:"10px 14px",cursor:"pointer",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.cardHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{position:"relative"}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:C.white}}>{(a.nombre||"?")[0]}</div>
                      {cicloAlerta&&<div style={{position:"absolute",top:-2,right:-2,width:9,height:9,borderRadius:"50%",background:C.pink,border:`2px solid ${C.card}`}}/>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontWeight:700,fontSize:12,color:C.white}}>{a.nombre}</span>{a.genero==="F"&&<span style={{fontSize:9,color:C.pink}}>♀</span>}{a.genero==="M"&&<span style={{fontSize:9,color:C.blue}}>♂</span>}</div>
                      <div style={{fontSize:9,color:C.muted}}>{a.tipo||"Sin plan"}{a.edad?` · ${a.edad} años`:""}</div>
                    </div>
                    <div style={{textAlign:"right",minWidth:76}}><div style={{fontSize:9,color:ps.color,fontWeight:700}}>{ps.label}</div><div style={{fontSize:8,color:C.muted}}>PLAN</div></div>
                    <div style={{width:24,height:24,borderRadius:"50%",background:pg.color+"20",border:`1px solid ${pg.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:pg.color}}>{a.pagado?"✓":"!"}</div>
                  </div>
                  <div style={{marginTop:5,display:"flex",alignItems:"center",gap:7}}><Bar value={a.progreso||0} color={(a.progreso||0)>75?C.green:(a.progreso||0)>50?C.blue:C.amber}/><span style={{fontSize:9,color:C.muted,minWidth:22}}>{a.progreso||0}%</span></div>
                </div>
                {i<alumnos.length-1&&<Divider/>}
              </div>
            );
          })}
        </div>
      )}

      {tab==="cobros"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px"}}>
          <div style={{padding:"8px 14px"}}><span style={{fontSize:9,color:C.muted,letterSpacing:2}}>COBROS</span></div><Divider/>
          {alumnos.map((a,i)=>{
            const pg=payStatus(a.pagado,a.diasVencido);
            return(
              <div key={a.uid}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:a.pagado?C.green+"22":C.red+"22",border:`1px solid ${a.pagado?C.green:C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:a.pagado?C.green:C.red}}>{a.pagado?"✓":"!"}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:C.white}}>{a.nombre}</div><div style={{fontSize:9,color:C.muted}}>{a.tipo}</div></div>
                  <div style={{fontWeight:700,fontSize:11,color:pg.color}}>{pg.label}</div>
                  <button onClick={async()=>{await updateDoc(doc(db,"usuarios",a.uid),{pagado:!a.pagado});cargar();}} style={{padding:"4px 9px",background:a.pagado?C.surface:C.blue,color:C.white,border:`1px solid ${C.border}`,borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>{a.pagado?"REVERTIR":"COBRADO"}</button>
                </div>
                {i<alumnos.length-1&&<Divider/>}
              </div>
            );
          })}
        </div>
      )}

      {tab==="eventos"&&<EventosView esAdmin={true} alumnos={alumnos}/>}

      {alumnoSel&&<AlumnoModal alumno={alumnoSel} onClose={()=>{setAlumnoSel(null);cargar();}} onUpdate={cargar} alumnos={alumnos}/>}
      {panelFiltro&&<PanelFiltrado titulo={panelFiltro.titulo} alumnos={panelFiltro.lista} onClose={()=>setPanelFiltro(null)} onSelect={a=>{setPanelFiltro(null);setAlumnoSel(a);}}/>}
    </div>
  );
}

// ── ALUMNO VIEW ────────────────────────────────────────
function AlumnoView({user}){
  const[perfil,setPerfil]=useState(user);
  const[planRunning,setPlanRunning]=useState([]);
  const[planGym,setPlanGym]=useState([]);
  const[tab,setTab]=useState("hoy");
  const[planSubTab,setPlanSubTab]=useState("running");
  const[loading,setLoading]=useState(true);
  const[diaDetalle,setDiaDetalle]=useState(null);

  const[objetivo,setObjetivo]=useState("");
  const[peso,setPeso]=useState("");
  const[edad,setEdad]=useState("");
  const[genero,setGenero]=useState("");
  const[cinco,setCinco]=useState("");
  const[diez,setDiez]=useState("");
  const[media,setMedia]=useState("");
  const[maraton,setMaraton]=useState("");
  const[editOpen,setEditOpen]=useState(false);
  const[editOk,setEditOk]=useState(false);

  useEffect(()=>{
    const cargar=async()=>{
      const snap=await getDoc(doc(db,"usuarios",user.uid));
      if(snap.exists()){
        const data=snap.data();
        setPerfil({uid:user.uid,...data});
        setObjetivo(data.objetivo||"");setPeso(data.peso||"");setEdad(data.edad||"");
        setGenero(data.genero||"");setCinco(data.marcas?.cinco||"");setDiez(data.marcas?.diez||"");
        setMedia(data.marcas?.media||"");setMaraton(data.marcas?.maraton||"");
      }
      const pr=await getDocs(query(collection(db,"usuarios",user.uid,"plan"),orderBy("orden")));
      const planR=pr.docs.map(d=>({id:d.id,...d.data()}));
      const pg2=await getDocs(query(collection(db,"usuarios",user.uid,"planGym"),orderBy("orden")));
      const planG=pg2.docs.map(d=>({id:d.id,...d.data()}));
      // Limpieza automática: archivar y eliminar días vencidos (5 días)
      const DIAS_ORD=["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"];
      const hoyIdx=((new Date().getDay()+6)%7); // 0=LUN
      const limpiar=async(plan,col)=>{
        for(const dia of plan){
          const diaIdx=DIAS_ORD.indexOf(dia.dia);
          if(diaIdx<0)continue;
          const diasAtras=((hoyIdx-diaIdx)+7)%7;
          if(diasAtras>=5){
            // Archivar en resumenSemanal si no está ya
            await deleteDoc(doc(db,"usuarios",user.uid,col,dia.id));
          }
        }
      };
      await limpiar(planR,"plan");
      await limpiar(planG,"planGym");
      // Recargar tras limpieza
      const pr2=await getDocs(query(collection(db,"usuarios",user.uid,"plan"),orderBy("orden")));
      setPlanRunning(pr2.docs.map(d=>({id:d.id,...d.data()})));
      const pg3=await getDocs(query(collection(db,"usuarios",user.uid,"planGym"),orderBy("orden")));
      setPlanGym(pg3.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    };
    cargar();
  },[user.uid]);

  const marcarDia=async(diaId,completado,col)=>{
    await updateDoc(doc(db,"usuarios",user.uid,col,diaId),{completado:!completado});
    let nuevoR=planRunning,nuevoG=planGym;
    if(col==="plan"){nuevoR=planRunning.map(d=>d.id===diaId?{...d,completado:!completado}:d);setPlanRunning(nuevoR);}
    else{nuevoG=planGym.map(d=>d.id===diaId?{...d,completado:!completado}:d);setPlanGym(nuevoG);}
    const totalR=nuevoR.filter(d=>d.tipo!=="Descanso").length;
    const totalG=nuevoG.filter(d=>d.tipo!=="Descanso").length;
    const total=totalR+totalG;
    const completados=nuevoR.filter(d=>d.completado&&d.tipo!=="Descanso").length+nuevoG.filter(d=>d.completado&&d.tipo!=="Descanso").length;
    const nuevoPct=total>0?Math.round((completados/total)*100):0;
    await updateDoc(doc(db,"usuarios",user.uid),{progreso:nuevoPct});
  };

  const guardarPerfil=async()=>{
    const updates={objetivo,peso,edad,genero,marcas:{cinco:cinco||"—",diez:diez||"—",media:media||"—",maraton:maraton||"—"}};
    await updateDoc(doc(db,"usuarios",user.uid),updates);
    setPerfil(prev=>({...prev,...updates}));
    setEditOk(true);setTimeout(()=>{setEditOk(false);setEditOpen(false);},1500);
  };

  if(loading)return <Spinner/>;

  const ci=perfil.ciclo?cicloInfo(perfil.ciclo):null;
  const esGymYRunning=perfil.tipo==="Running + Gym";
  const planActivo=planSubTab==="gym"?planGym:planRunning;
  const colActiva=planSubTab==="gym"?"planGym":"plan";
  // Progreso automático calculado desde entrenamientos completados
  const totalEntrenR=planRunning.filter(d=>d.tipo!=="Descanso").length;
  const totalEntrenG=planGym.filter(d=>d.tipo!=="Descanso").length;
  const totalEntren=totalEntrenR+totalEntrenG;
  const completadosEntren=planRunning.filter(d=>d.completado&&d.tipo!=="Descanso").length+planGym.filter(d=>d.completado&&d.tipo!=="Descanso").length;
  const porcentaje=totalEntren>0?Math.round((completadosEntren/totalEntren)*100):0;
  // Sincronizar HOY con el día real de la semana
  const DIAS_MAP={"0":"DOM","1":"LUN","2":"MAR","3":"MIÉ","4":"JUE","5":"VIE","6":"SÁB"};
  const diaHoy=DIAS_MAP[new Date().getDay().toString()]||"LUN";
  const entrenamientoHoyR=planRunning.find(d=>d.dia===diaHoy);
  const entrenamientoHoyG=planGym.find(d=>d.dia===diaHoy);
  const hoy=planActivo.find(d=>!d.completado&&d.tipo!=="Descanso");
  const ps=planStatus(perfil.planDias);
  const pg=payStatus(perfil.pagado,perfil.diasVencido);
  const generoFinal=genero||perfil.genero;
  const tabs=generoFinal==="F"?["hoy","semana","resumen","ciclo","eventos","perfil"]:["hoy","semana","resumen","eventos","perfil"];
  const inp={...inp_s,marginTop:3};

  return(
    <div style={{maxWidth:430,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}}>
      {ci&&ci.enMenstruacion&&ci.diaEnCiclo<=2&&<div style={{background:C.pinkDim,border:`1px solid ${C.pink}44`,borderRadius:8,padding:"9px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center"}}><span>🌸</span><div><div style={{fontSize:11,color:C.pink,fontWeight:700}}>DÍA {ci.diaEnCiclo} — TU ENTRENADOR SUGIERE DESCANSO</div></div></div>}

      <div style={{background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:C.blue,boxShadow:`0 0 12px ${C.blueGlow}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:C.white}}>{(perfil.nombre||"?")[0]}</div>
            <div><div style={{fontWeight:900,fontSize:12,color:C.white}}>{perfil.nombre}</div><div style={{fontSize:8,color:C.muted,marginTop:1,letterSpacing:1}}>{perfil.objetivo||"Sin objetivo cargado"}</div></div>
          </div>
          <Slashes size={8}/>
        </div>
        <div style={{fontSize:8,color:C.muted,letterSpacing:2,marginBottom:3}}>PROGRESO DEL CICLO</div>
        <Bar value={porcentaje} color={C.blue} height={4}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
          <span style={{fontSize:8,color:C.muted}}>{perfil.tipo||"Sin plan"}</span>
          <span style={{fontSize:8,color:C.blue,fontWeight:700}}>{porcentaje}%</span>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[{label:"DÍAS OK",value:`${planActivo.filter(d=>d.completado).length}/${planActivo.length||7}`,color:C.green},{label:"PLAN",value:ps.label,color:ps.color},{label:"PAGO",value:pg.label,color:pg.color}].map(s=>(
          <div key={s.label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 5px",textAlign:"center"}}>
            <div style={{fontSize:11,fontWeight:900,color:s.color}}>{s.value}</div>
            <div style={{fontSize:7,color:C.muted,letterSpacing:1,marginTop:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"7px 9px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${t==="ciclo"?C.pink:C.blue}`:"2px solid transparent",color:tab===t?(t==="ciclo"?C.pink:C.blue):C.muted,fontFamily:"inherit",fontWeight:700,fontSize:8,letterSpacing:1,cursor:"pointer",textTransform:"uppercase"}}>{t==="ciclo"?"CICLO":t}</button>)}
      </div>

      {tab!=="eventos"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px"}}>

          {tab==="hoy"&&(
            <div style={{padding:12}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:10}}>{diaHoy} — HOY</div>
              {/* Si no hay plan cargado en absoluto */}
              {planRunning.length===0&&planGym.length===0&&(
                <div style={{textAlign:"center",padding:24,background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:22,marginBottom:6}}>📋</div>
                  <div style={{fontWeight:700,color:C.white,marginBottom:4}}>Sin plan cargado</div>
                  <div style={{fontSize:11,color:C.muted}}>Tu entrenador aún no cargó el plan de entrenamiento.</div>
                </div>
              )}
              {/* Running de hoy */}
              {entrenamientoHoyR&&entrenamientoHoyR.tipo!=="Descanso"&&(
                <div style={{background:C.surface,border:`1px solid ${C.blue}44`,borderRadius:10,padding:"13px",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:C.blue,boxShadow:`0 0 6px ${C.blue}`,flexShrink:0}}/>
                    <span style={{fontSize:8,color:C.blue,letterSpacing:2,fontWeight:700}}>RUNNING</span>
                    <Tag color={C.blue}>{entrenamientoHoyR.tipo}</Tag>
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:C.white,margin:"6px 0"}}>{entrenamientoHoyR.detalle||entrenamientoHoyR.tipo}</div>
                  {entrenamientoHoyR.comentario&&<div style={{fontSize:10,color:C.white,marginBottom:9,lineHeight:1.5,borderLeft:`2px solid ${C.blue}`,paddingLeft:8,background:C.blueDim,borderRadius:"0 6px 6px 0",padding:"6px 8px"}}>{entrenamientoHoyR.comentario}</div>}
                  <div style={{display:"flex",gap:7,marginTop:8}}>
                    <button onClick={()=>setDiaDetalle({...entrenamientoHoyR,planKey:"plan"})} style={{flex:1,padding:"8px",background:"none",color:C.white,border:`1px solid ${C.border}`,borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>VER DETALLE</button>
                    <button onClick={()=>marcarDia(entrenamientoHoyR.id,entrenamientoHoyR.completado,"plan")} style={{flex:2,padding:"8px",background:entrenamientoHoyR.completado?C.mutedDim:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:9,letterSpacing:1,cursor:"pointer"}}>{entrenamientoHoyR.completado?"✓ COMPLETADO":"MARCAR COMPLETADO"}</button>
                  </div>
                </div>
              )}
              {/* Gym de hoy */}
              {esGymYRunning&&entrenamientoHoyG&&entrenamientoHoyG.tipo!=="Descanso"&&(
                <div style={{background:C.surface,border:`1px solid ${C.amber}44`,borderRadius:10,padding:"13px",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:C.amber,flexShrink:0}}/>
                    <span style={{fontSize:8,color:C.amber,letterSpacing:2,fontWeight:700}}>GYM</span>
                    <Tag color={C.amber}>{entrenamientoHoyG.tipo}</Tag>
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:C.white,margin:"6px 0"}}>{entrenamientoHoyG.detalle||entrenamientoHoyG.tipo}</div>
                  {entrenamientoHoyG.comentario&&<div style={{fontSize:10,color:C.white,marginBottom:9,lineHeight:1.5,borderLeft:`2px solid ${C.amber}`,paddingLeft:8,background:"#1A1000",borderRadius:"0 6px 6px 0",padding:"6px 8px"}}>{entrenamientoHoyG.comentario}</div>}
                  <div style={{display:"flex",gap:7,marginTop:8}}>
                    <button onClick={()=>setDiaDetalle({...entrenamientoHoyG,planKey:"planGym"})} style={{flex:1,padding:"8px",background:"none",color:C.white,border:`1px solid ${C.border}`,borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>VER DETALLE</button>
                    <button onClick={()=>marcarDia(entrenamientoHoyG.id,entrenamientoHoyG.completado,"planGym")} style={{flex:2,padding:"8px",background:entrenamientoHoyG.completado?C.mutedDim:C.amber,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:9,letterSpacing:1,cursor:"pointer"}}>{entrenamientoHoyG.completado?"✓ COMPLETADO":"MARCAR COMPLETADO"}</button>
                  </div>
                </div>
              )}
              {/* Descanso o sin actividad hoy */}
              {planRunning.length>0&&(
                (!entrenamientoHoyR||entrenamientoHoyR.tipo==="Descanso")&&
                (!esGymYRunning||!entrenamientoHoyG||entrenamientoHoyG.tipo==="Descanso")
              )&&(
                <div style={{textAlign:"center",padding:"24px 16px",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:24,marginBottom:6}}>💤</div>
                  <div style={{fontWeight:900,fontSize:13,color:C.white,marginBottom:4}}>Hoy no tenés actividad planificada</div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>Aprovechá para recuperarte. El descanso también es entrenamiento.</div>
                </div>
              )}
            </div>
          )}

          {tab==="semana"&&(
            <div>
              {esGymYRunning&&(
                <div style={{padding:"8px 12px 0"}}>
                  <div style={{display:"flex",background:C.surface,borderRadius:7,padding:2,marginBottom:6}}>
                    {[["running","🏃 RUNNING"],["gym","🏋️ GYM"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setPlanSubTab(k)} style={{flex:1,padding:"6px",border:"none",borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer",background:planSubTab===k?(k==="gym"?C.amber:C.blue):"transparent",color:planSubTab===k?C.white:C.muted,transition:"all .2s"}}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {planActivo.length===0&&<div style={{padding:16,textAlign:"center",color:C.muted,fontSize:12}}>Tu entrenador aún no cargó el plan.</div>}
              {planActivo.map((d,i)=>(
                <div key={d.id}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",opacity:d.tipo==="Descanso"?.4:1}}>
                    <div style={{width:24,fontSize:8,fontWeight:700,color:d.completado?C.green:C.muted}}>{d.dia}</div>
                    <div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:d.completado?C.green:d.tipo==="Descanso"?C.border:(planSubTab==="gym"?C.amber:C.blue)}}/>
                    <div style={{flex:1,cursor:d.tipo!=="Descanso"?"pointer":"default"}} onClick={()=>d.tipo!=="Descanso"&&setDiaDetalle({...d,planKey:colActiva})}>
                      <div style={{fontSize:11,fontWeight:600,color:d.completado?C.muted:C.white}}>{d.tipo}</div>
                      {d.detalle&&<div style={{fontSize:9,color:C.muted}}>{d.detalle}</div>}
                    </div>
                    {d.completado
                      ?<span style={{color:C.green,fontSize:11}}>✓</span>
                      :d.tipo!=="Descanso"&&(
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>setDiaDetalle({...d,planKey:colActiva})} style={{padding:"3px 7px",fontSize:8,fontFamily:"inherit",background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:4,cursor:"pointer"}}>+</button>
                          <button onClick={()=>marcarDia(d.id,d.completado,colActiva)} style={{padding:"3px 7px",fontSize:8,fontFamily:"inherit",background:(planSubTab==="gym"?C.amber:C.blue)+"22",color:planSubTab==="gym"?C.amber:C.blue,border:`1px solid ${(planSubTab==="gym"?C.amber:C.blue)}44`,borderRadius:4,cursor:"pointer",fontWeight:700}}>OK</button>
                        </div>
                      )
                    }
                  </div>
                  {i<planActivo.length-1&&<Divider/>}
                </div>
              ))}
            </div>
          )}

          {tab==="resumen"&&(
            <div style={{padding:12}}>
              <div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:8}}>// RESUMEN SEMANAL</div>
              <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:10,padding:"12px",marginBottom:10,textAlign:"center"}}>
                <div style={{fontSize:8,color:C.muted,letterSpacing:2,marginBottom:4}}>ADHERENCIA AL PLAN</div>
                <div style={{fontSize:44,fontWeight:900,color:porcentaje>=80?C.green:porcentaje>=60?C.amber:C.red,lineHeight:1}}>{porcentaje}%</div>
                <div style={{fontSize:10,color:C.muted,marginTop:4}}>{completadosEntren} de {totalEntren} entrenamientos</div>
              </div>
              {/* Detalle por día en resumen */}
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>ENTRENAMIENTOS DE LA SEMANA</div>
              {planActivo.filter(d=>d.tipo!=="Descanso").map((d,i)=>(
                <div key={d.id||i} onClick={()=>setDiaDetalle({...d,planKey:colActiva})} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer",transition:"opacity .15s"}} onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <div style={{width:24,fontSize:8,fontWeight:700,color:d.completado?C.green:C.muted}}>{d.dia}</div>
                  <div style={{width:5,height:5,borderRadius:"50%",background:d.completado?C.green:C.blue,flexShrink:0}}/>
                  <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:d.completado?C.muted:C.white}}>{d.tipo}</div>{d.detalle&&<div style={{fontSize:9,color:C.muted}}>{d.detalle}</div>}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {d.completado&&<span style={{color:C.green,fontSize:11}}>✓</span>}
                    <span style={{fontSize:10,color:C.muted}}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==="ciclo"&&generoFinal==="F"&&(
            <div style={{padding:12}}>
              <div style={{fontSize:9,color:C.pink,letterSpacing:3,marginBottom:8}}>// MI CICLO</div>
              {ci?(
                <div style={{background:C.pinkDim,border:`1px solid ${C.pink}33`,borderRadius:10,padding:"12px",marginBottom:12}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}>
                    {[
                      {label:"FASE",value:ci.fase,color:{"Menstruación":C.pink,"Folicular":C.blue,"Ovulación":C.green,"Lútea":C.amber}[ci.fase]||C.muted},
                      {label:"DÍA DEL CICLO",value:`${ci.diaEnCiclo} / ${ci.durCiclo}`,color:C.white},
                      {label:"PRÓXIMO PERÍODO",value:`En ${ci.diasHastaProxima}d`,color:ci.diasHastaProxima<=3?C.pink:C.muted},
                      {label:"OVULACIÓN EST.",value:(()=>{const d=14-ci.diaEnCiclo;return d>0?`En ~${d}d`:"Esta semana";})(),color:C.green},
                      {label:"DURACIÓN CICLO",value:`${ci.durCiclo} días`,color:C.white},
                      {label:"DURACIÓN PERÍODO",value:`${ci.durMens} días`,color:C.white},
                    ].map(item=>(
                      <div key={item.label} style={{background:C.card,borderRadius:7,padding:"8px 10px"}}><div style={{fontSize:7,color:C.muted,letterSpacing:1.5,marginBottom:2}}>{item.label}</div><div style={{fontSize:11,fontWeight:700,color:item.color}}>{item.value}</div></div>
                    ))}
                  </div>
                  <div style={{padding:"9px 11px",background:C.surface,borderRadius:7,marginBottom:8}}>
                    <div style={{fontSize:7,color:C.muted,letterSpacing:2,marginBottom:3}}>RECOMENDACIÓN</div>
                    <div style={{fontSize:11,color:C.white,lineHeight:1.6}}>{ci.fase==="Menstruación"?"Priorizá el descanso. Movilidad suave, sin cargas intensas los primeros 2 días.":ci.fase==="Folicular"?"Fase de alta energía. Ideal para intervalos y fuerza.":ci.fase==="Ovulación"?"Pico de rendimiento. Aprovechá para tus mejores sesiones.":"Energía más baja. Mantené el volumen pero bajá la intensidad."}</div>
                  </div>
                  <CicloCalendario ci={ci} ciclo={perfil.ciclo}/>
                </div>
              ):(
                <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"12px 0 16px"}}>Aún no cargaste los datos de tu ciclo.</div>
              )}
              <CicloAlumnaForm uid={user.uid} cicloActual={perfil.ciclo} onGuardado={data=>{setPerfil(prev=>({...prev,ciclo:data}));}}/>
            </div>
          )}

          {tab==="perfil"&&(
            <div style={{padding:12}}>
              {[{label:"PLAN",value:perfil.tipo||"—"},{label:"GÉNERO",value:generoFinal==="F"?"Femenino":generoFinal==="M"?"Masculino":"Sin especificar"},{label:"EDAD",value:perfil.edad?`${perfil.edad} años`:"—"},{label:"OBJETIVO",value:perfil.objetivo||"—"},{label:"PESO",value:perfil.peso?`${perfil.peso} kg`:"—"},{label:"MEJOR 5K",value:perfil.marcas?.cinco||"—"},{label:"MEJOR 10K",value:perfil.marcas?.diez||"—"},{label:"MEJOR 21K",value:perfil.marcas?.media||"—"},{label:"MEJOR 42K",value:perfil.marcas?.maraton||"—"}].map(item=>(
                <div key={item.label} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:8,color:C.muted,letterSpacing:1}}>{item.label}</span>
                  <span style={{fontSize:11,fontWeight:700,color:C.white}}>{item.value}</span>
                </div>
              ))}
              <button onClick={()=>setEditOpen(!editOpen)} style={{width:"100%",marginTop:10,padding:"9px",background:editOpen?C.surface:C.blue,color:C.white,border:`1px solid ${C.border}`,borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:10,letterSpacing:2,cursor:"pointer"}}>{editOpen?"CANCELAR":"EDITAR MI PERFIL"}</button>
              {editOpen&&(
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:9}}>
                  <div><div style={{fontSize:8,color:C.muted,letterSpacing:1.5}}>GÉNERO</div><select value={genero} onChange={e=>setGenero(e.target.value)} style={inp}><option value="">Sin especificar</option><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
                  {[{label:"EDAD",value:edad,set:setEdad,placeholder:"25",type:"number"},{label:"OBJETIVO",value:objetivo,set:setObjetivo,placeholder:"Tu objetivo"},{label:"PESO (kg)",value:peso,set:setPeso,placeholder:"72",type:"number"},{label:"MEJOR 5K",value:cinco,set:setCinco,placeholder:"23:10"},{label:"MEJOR 10K",value:diez,set:setDiez,placeholder:"48:32"},{label:"MEJOR 21K",value:media,set:setMedia,placeholder:"1:52:14"},{label:"MEJOR 42K",value:maraton,set:setMaraton,placeholder:"3:45:00"}].map(f=>(
                    <div key={f.label}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5}}>{f.label}</div><input type={f.type||"text"} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp}/></div>
                  ))}
                  <button onClick={guardarPerfil} style={{padding:"9px",background:editOk?C.green:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:10,letterSpacing:2,cursor:"pointer",transition:"background .3s"}}>{editOk?"✓ GUARDADO":"GUARDAR"}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab==="eventos"&&<EventosView uid={user.uid} esAdmin={false}/>}

      {diaDetalle&&<DetalleEntrenamiento dia={diaDetalle} onClose={()=>setDiaDetalle(null)}/>}
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("splash");
  const[user,setUser]=useState(null);
  const handleLogout=async()=>{await signOut(auth);setUser(null);setScreen("login");};
  return(
    <div style={{fontFamily:"'Barlow Condensed','Arial Narrow',sans-serif",background:C.bg,minHeight:"100vh",color:C.white,overflowX:"hidden"}}>
      {screen==="splash"&&<SplashScreen onDone={()=>setScreen("login")}/>}
      {screen==="login"&&<AuthScreen onAuth={u=>{setUser(u);setScreen("app");}}/>}
      {screen==="app"&&user&&<><TopoBg/><TopBar user={user} onLogout={handleLogout}/>{user.role==="admin"?<AdminView/>:<AlumnoView user={user}/>}<div style={{textAlign:"center",padding:"14px 0 24px",position:"relative",zIndex:1,fontSize:7,color:C.mutedDim,letterSpacing:3}}>STRONG · SYSTEM IN MOTION · <Slashes size={7}/></div></>}
    </div>
  );
}
