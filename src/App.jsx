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
  comp:"#FF6B5C",compDim:"#2A1410",compGlow:"#FF4D3D55",
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
const Tag=({children,color=C.blue})=><span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{children}</span>;
const Bar=({value,color=C.blue,height=6})=><div style={{background:"rgba(255,255,255,0.08)",borderRadius:20,height,width:"100%",overflow:"hidden"}}><div style={{width:`${Math.min(value||0,100)}%`,height:"100%",background:`linear-gradient(90deg,${color}cc,${color})`,borderRadius:20,transition:"width .6s cubic-bezier(.16,1,.3,1)"}}/></div>;
const Divider=()=><div style={{height:1,background:"rgba(255,255,255,0.08)"}}/>;
const Spinner=()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh"}}><div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.blue}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;
const inp_s={width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,color:C.white,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

const GLOBAL_ANIM_STYLES = `
@keyframes fadeUpCard{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes popCheck{0%{transform:scale(0.5);opacity:0;}60%{transform:scale(1.2);}100%{transform:scale(1);opacity:1;}}
@keyframes pulseGlowBlue{0%,100%{box-shadow:0 8px 24px -8px #2146D055;}50%{box-shadow:0 8px 30px -4px #2146D088;}}
@keyframes pulseGlowComp{0%,100%{box-shadow:0 8px 24px -8px #FF4D3D55;}50%{box-shadow:0 8px 30px -4px #FF4D3D88;}}
.card-glass{animation:fadeUpCard .4s cubic-bezier(.16,1,.3,1);}
.check-pop{animation:popCheck .4s ease;display:inline-block;}
.glow-blue{animation:pulseGlowBlue 3s ease-in-out infinite;}
.glow-comp{animation:pulseGlowComp 2.5s ease-in-out infinite;}
`;

const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_SEMANA=["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"];
const TIPOS_RUNNING=["Regenerativo","Intervalos","Tempo","Umbral","Long Run","Trail","Rodaje","Movilidad","Competencia","Descanso","Otro"];
const TIPOS_GYM=["Tren superior","Tren inferior","Full body","Core","Fuerza máxima","Hipertrofia","Movilidad","Competencia","Descanso","Otro"];

function colorPorTipo(tipo, colorBase){
  if(tipo==="Competencia") return C.comp;
  return colorBase;
}

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

function AuthScreen({onAuth}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState(""),[ pass,setPass]=useState(""),[ nombre,setNombre]=useState(""),[ error,setError]=useState(""),[ loading,setLoading]=useState(false);
  const inp={...inp_s,padding:"14px 16px",fontSize:14};

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
        <div className="card-glass" style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(34,201,122,0.3)",borderRadius:24,padding:"32px 26px",boxShadow:"0 12px 32px -8px #000000aa"}}>
          <div style={{fontSize:32,marginBottom:12}}>✓</div>
          <div style={{fontSize:17,fontWeight:700,color:C.green,marginBottom:8}}>SOLICITUD ENVIADA</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.7}}>El entrenador revisará tu solicitud y te dará acceso en breve.</div>
          <button onClick={()=>setMode("login")} style={{marginTop:20,width:"100%",padding:"13px",background:"linear-gradient(135deg,#2146D0,#1530a0)",color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:13,letterSpacing:1,cursor:"pointer"}}>Ir al login</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,position:"relative"}}>
      <style>{GLOBAL_ANIM_STYLES}</style>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 20% 0%,#1a2a6622,transparent 50%),radial-gradient(circle at 90% 80%,#2146D015,transparent 50%)"}}/>
      <TopoBg opacity={0.08}/>
      <div style={{width:"100%",maxWidth:360,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:36,fontWeight:900,letterSpacing:8,color:C.white,lineHeight:1}}>STRONG</div>
          <div style={{fontSize:9,letterSpacing:5,color:C.blue,marginTop:6,fontWeight:700}}>SYSTEM IN MOTION</div>
          <div style={{marginTop:8}}><Slashes size={10}/></div>
        </div>
        <div className="card-glass" style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:"26px 22px",boxShadow:"0 12px 32px -8px #000000aa"}}>
          <div style={{display:"flex",marginBottom:22,background:"rgba(255,255,255,0.05)",borderRadius:14,padding:4}}>
            {[["login","Ingresar"],["register","Registrarme"]].map(([v,l])=>(
              <button key={v} onClick={()=>{setMode(v);setError("");}} style={{flex:1,padding:"10px",border:"none",borderRadius:11,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer",background:mode===v?"linear-gradient(135deg,#2146D0,#1530a0)":"transparent",color:mode===v?C.white:"rgba(255,255,255,0.5)",transition:"all .25s"}}>{l}</button>
            ))}
          </div>
          {mode==="register"&&<div style={{marginBottom:14}}><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:1,marginBottom:6,fontWeight:600}}>NOMBRE COMPLETO</div><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre" style={inp} onFocus={e=>e.target.style.border="1px solid #2146D0"} onBlur={e=>e.target.style.border="1px solid rgba(255,255,255,0.1)"}/></div>}
          <div style={{marginBottom:14}}><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:1,marginBottom:6,fontWeight:600}}>EMAIL</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" style={inp} onFocus={e=>e.target.style.border="1px solid #2146D0"} onBlur={e=>e.target.style.border="1px solid rgba(255,255,255,0.1)"} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/></div>
          <div style={{marginBottom:18}}><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:1,marginBottom:6,fontWeight:600}}>CONTRASEÑA</div><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={inp} onFocus={e=>e.target.style.border="1px solid #2146D0"} onBlur={e=>e.target.style.border="1px solid rgba(255,255,255,0.1)"} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/>{mode==="register"&&<div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:6}}>Mínimo 6 caracteres</div>}</div>
          {mode==="login"&&(
            <div onClick={()=>setRecordar(r=>!r)} style={{display:"flex",alignItems:"center",gap:9,marginBottom:18,cursor:"pointer",userSelect:"none"}}>
              <div style={{width:18,height:18,border:`2px solid ${recordar?"#2146D0":"rgba(255,255,255,0.2)"}`,borderRadius:6,background:recordar?"linear-gradient(135deg,#2146D0,#1530a0)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                {recordar&&<span style={{color:C.white,fontSize:11,lineHeight:1}}>✓</span>}
              </div>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>Recordar mi email en este dispositivo</span>
            </div>
          )}
          {error&&<div style={{background:"rgba(224,60,60,0.1)",border:"1px solid rgba(224,60,60,0.3)",borderRadius:12,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#ff7a7a"}}>{error}</div>}
          <button onClick={mode==="login"?handleLogin:handleRegister} className="glow-blue" style={{width:"100%",padding:"15px",background:loading?C.mutedDim:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:14,cursor:loading?"default":"pointer",transition:"all .2s"}}>
            {loading?"Procesando...":(mode==="login"?"Ingresar":"Solicitar acceso")}
          </button>
          {mode==="register"&&<div style={{marginTop:16,padding:"12px 14px",background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>El entrenador revisará tu solicitud y te dará acceso una vez aprobada.</div>}
        </div>
      </div>
    </div>
  );
}

function TopBar({user,onLogout}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",background:"rgba(17,17,22,0.85)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:30,height:30,borderRadius:10,background:"linear-gradient(145deg,#2146D0,#0e2477)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:C.white,boxShadow:"0 4px 12px -4px #2146D099"}}>S</div>
        <div><div style={{fontWeight:900,fontSize:14,letterSpacing:4,color:C.white,lineHeight:1}}>STRONG</div><div style={{fontSize:7,color:C.blue,letterSpacing:3,marginTop:1}}>SYSTEM IN MOTION</div></div>
        <Slashes size={8}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.white,fontWeight:700}}>{user.nombre}</div><div style={{fontSize:8,color:C.blue,letterSpacing:1}}>{user.role==="admin"?"ENTRENADOR":"ALUMNO"}</div></div>
        <button onClick={onLogout} style={{padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.6)",fontFamily:"inherit",fontSize:9,letterSpacing:1,cursor:"pointer",fontWeight:600}}>Salir</button>
      </div>
    </div>
  );
}

const IconRunning=({color,size=16})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M4 17l5-1 1.5-4.5L13 13l3 5h3"/><path d="M7 10l2.5-2.5L12 9l3-3"/></svg>
);
const IconGym=({color,size=16})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 7v10M17.5 7v10M3 10v4M21 10v4M6.5 12h11"/></svg>
);
const IconTrophy=({color,size=16})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10l-1 9a4 4 0 0 1-8 0L7 4Z"/><path d="M5 4h2v5a3 3 0 0 1-2-3V4Z"/><path d="M19 4h-2v5a3 3 0 0 0 2-3V4Z"/></svg>
);
const IconCheck=({color,size=14})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconLink=({color="currentColor",size=13})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
);

function iconoPorTipoYColeccion(tipo, esGym, color, size=16){
  if(tipo==="Competencia") return <IconTrophy color={color} size={size}/>;
  if(esGym) return <IconGym color={color} size={size}/>;
  return <IconRunning color={color} size={size}/>;
}

function DetalleEntrenamiento({dia,onClose,esAdmin=false}){
  if(!dia) return null;
  const esComp = dia.tipo==="Competencia";
  const color = esComp ? C.comp : (dia.planKey==="gym" ? C.amber : C.blue);
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <style>{GLOBAL_ANIM_STYLES}</style>
      <div className="card-glass" style={{background:"rgba(22,22,30,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,width:420,maxWidth:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px -12px #000000cc"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:11,flexShrink:0}}>
          <div style={{width:34,height:34,borderRadius:11,background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {iconoPorTipoYColeccion(dia.tipo,dia.planKey==="gym",color,17)}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:16,color:C.white,letterSpacing:-0.3}}>{dia.dia} — {dia.tipo}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:1,fontWeight:600}}>{esComp?"COMPETENCIA":dia.planKey==="gym"?"GIMNASIO":"RUNNING"}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:30,height:30,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:18}}>
          {dia.detalle&&(
            <div style={{background:color+"0d",border:`1px solid ${color}33`,borderRadius:18,padding:"16px 18px",marginBottom:16}}>
              <div style={{fontSize:10,color,letterSpacing:1.5,marginBottom:9,fontWeight:700}}>DESCRIPCIÓN</div>
              <div style={{fontSize:18,fontWeight:800,color:C.white,marginBottom:12,letterSpacing:-0.3}}>{dia.detalle}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                {dia.distancia&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"9px 11px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,fontWeight:600}}>DISTANCIA</div><div style={{fontSize:14,fontWeight:700,color:C.white,marginTop:3}}>{dia.distancia}</div></div>}
                {dia.ritmo&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"9px 11px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,fontWeight:600}}>RITMO</div><div style={{fontSize:14,fontWeight:700,color:C.white,marginTop:3}}>{dia.ritmo}</div></div>}
                {dia.series&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"9px 11px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,fontWeight:600}}>SERIES</div><div style={{fontSize:14,fontWeight:700,color:C.white,marginTop:3}}>{dia.series}</div></div>}
                {dia.descanso&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"9px 11px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,fontWeight:600}}>DESCANSO</div><div style={{fontSize:14,fontWeight:700,color:C.white,marginTop:3}}>{dia.descanso}</div></div>}
                {dia.carga&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"9px 11px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,fontWeight:600}}>CARGA</div><div style={{fontSize:14,fontWeight:700,color:C.white,marginTop:3}}>{dia.carga}</div></div>}
                {dia.frecuencia&&<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"9px 11px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,fontWeight:600}}>FC OBJETIVO</div><div style={{fontSize:14,fontWeight:700,color:C.white,marginTop:3}}>{dia.frecuencia}</div></div>}
              </div>
            </div>
          )}
          {dia.comentario&&(
            <div style={{background:"rgba(33,70,208,0.08)",border:"1px solid rgba(33,70,208,0.25)",borderRadius:18,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:10,color:"#7d9bff",letterSpacing:1.5,marginBottom:7,fontWeight:700}}>NOTA DEL ENTRENADOR</div>
              <div style={{fontSize:13,color:C.white,lineHeight:1.7}}>{dia.comentario}</div>
            </div>
          )}
          {!dia.detalle&&!dia.comentario&&(
            <div style={{textAlign:"center",padding:28,color:"rgba(255,255,255,0.4)",fontSize:13}}>Sin detalles adicionales para este entrenamiento.</div>
          )}
          {dia.ejercicios&&dia.ejercicios.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.amber,letterSpacing:1.5,marginBottom:9,fontWeight:700}}>EJERCICIOS</div>
              {dia.ejercicios.map((ej,i)=>(
                <div key={i} style={{background:"rgba(232,154,26,0.06)",border:"1px solid rgba(232,154,26,0.2)",borderRadius:14,padding:"11px 13px",marginBottom:8,display:"flex",alignItems:"center",gap:11}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.white}}>{ej.nombre||"Ejercicio"}</div>
                    {ej.series&&<div style={{fontSize:11,color:C.amber,fontWeight:700,marginTop:3}}>{ej.series}</div>}
                  </div>
                  {ej.ytUrl&&(
                    <a href={ej.ytUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:"rgba(255,0,0,0.1)",border:"1px solid rgba(255,0,0,0.25)",borderRadius:20,fontSize:10,color:"#ff6b6b",textDecoration:"none",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                      <span style={{display:"inline-block",width:14,height:10,background:"#FF0000",borderRadius:3,position:"relative",flexShrink:0}}>
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
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:0.5,textAlign:"center",marginTop:10}}>Usá el botón de la vista principal para marcar como completado.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CargarDia({diaData,uid,coleccion,onClose}){
  const esGym=coleccion==="planGym";
  const tiposOpc=esGym?TIPOS_GYM:TIPOS_RUNNING;
  const colorBase=esGym?C.amber:C.blue;

  const[tipo,setTipo]=useState(diaData.tipo||"Descanso");
  const color = tipo==="Competencia" ? C.comp : colorBase;
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
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div className="card-glass" style={{background:"rgba(22,22,30,0.95)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,width:440,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px -12px #000000cc"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:11,flexShrink:0}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:color,boxShadow:`0 0 10px ${color}`}}/>
          <div style={{flex:1,fontWeight:800,fontSize:15,color:C.white,letterSpacing:-0.3}}>{diaData.dia} — {esGym?"GYM":"RUNNING"}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:30,height:30,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:18}}>
          <div style={{marginBottom:13}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:1,marginBottom:6,fontWeight:600}}>TIPO DE ENTRENAMIENTO</div>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} style={inp_s}>
              {tiposOpc.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {tipo==="Competencia"&&(
            <div style={{background:"rgba(255,107,92,0.1)",border:"1px solid rgba(255,107,92,0.3)",borderRadius:14,padding:"10px 13px",marginBottom:13,fontSize:11,color:"#ffb3a8",lineHeight:1.6}}>
              🏆 Este día se va a destacar en rojo/coral para el alumno, tanto en HOY como en SEMANA.
            </div>
          )}
          {tipo!=="Descanso"&&(
            <>
              {!esGym&&camposRunningFields.map(f=>(
                <div key={f.label} style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:1,marginBottom:6,fontWeight:600}}>{f.label}</div>
                  <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp_s}/>
                </div>
              ))}
              {esGym&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:1,marginBottom:6,fontWeight:600}}>DESCRIPCIÓN GENERAL</div>
                  <textarea value={detalle} onChange={e=>setDetalle(e.target.value)} placeholder="Ej: Foco en tren inferior, cadena posterior" style={{...inp_s,minHeight:50,resize:"vertical",lineHeight:1.5}}/>
                </div>
              )}
              {esGym&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:C.amber,letterSpacing:1,marginBottom:9,fontWeight:700}}>EJERCICIOS</div>
                  {ejercicios.map((ej,i)=>(
                    <div key={i} style={{background:"rgba(232,154,26,0.06)",border:"1px solid rgba(232,154,26,0.25)",borderRadius:14,padding:"11px",marginBottom:9}}>
                      <div style={{display:"flex",gap:9,marginBottom:9}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:4,fontWeight:600}}>EJERCICIO</div>
                          <input value={ej.nombre} onChange={e=>updEj(i,"nombre",e.target.value)} placeholder="Nombre del ejercicio" style={{...inp_s,borderColor:"rgba(232,154,26,0.3)"}}/>
                        </div>
                        <button onClick={()=>delEj(i)} style={{alignSelf:"flex-end",padding:"8px 11px",background:"rgba(224,60,60,0.1)",border:"1px solid rgba(224,60,60,0.3)",borderRadius:10,color:"#ff7a7a",cursor:"pointer",fontFamily:"inherit",fontSize:12,whiteSpace:"nowrap"}}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:9,alignItems:"end"}}>
                        <div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:4,fontWeight:600}}>LINK YOUTUBE (opcional)</div>
                          <input value={ej.ytUrl||""} onChange={e=>updEj(i,"ytUrl",e.target.value)} placeholder="https://youtube.com/..." style={{...inp_s,fontSize:11}}/>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:4,fontWeight:600}}>SERIES × REPS</div>
                          <input value={ej.series} onChange={e=>updEj(i,"series",e.target.value)} placeholder="3×10" style={{...inp_s,width:84,textAlign:"center",fontWeight:700,borderColor:"rgba(232,154,26,0.3)"}}/>
                        </div>
                        {ej.ytUrl&&(
                          <a href={ej.ytUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:6,padding:"9px 11px",background:"rgba(255,0,0,0.1)",border:"1px solid rgba(255,0,0,0.25)",borderRadius:10,fontSize:10,color:"#ff6b6b",textDecoration:"none",fontWeight:700,whiteSpace:"nowrap"}}>
                            <span style={{display:"inline-block",width:14,height:10,background:"#FF0000",borderRadius:3,flexShrink:0,position:"relative"}}>
                              <span style={{position:"absolute",top:"50%",left:"55%",transform:"translate(-50%,-50%)",width:0,height:0,borderStyle:"solid",borderWidth:"3px 0 3px 6px",borderColor:"transparent transparent transparent #FFF"}}/>
                            </span>
                            VER
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={addEj} style={{display:"flex",alignItems:"center",gap:7,padding:"10px 14px",background:"rgba(232,154,26,0.06)",border:"1px dashed rgba(232,154,26,0.4)",borderRadius:14,color:C.amber,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",width:"100%",justifyContent:"center"}}>
                    <span style={{fontSize:16,lineHeight:1}}>+</span> Agregar ejercicio
                  </button>
                </div>
              )}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10,color:esGym?C.amber:C.blue,letterSpacing:1,marginBottom:6,fontWeight:700}}>NOTA PARA EL ALUMNO</div>
                <textarea value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="Instrucciones o recomendaciones para este entrenamiento..." style={{...inp_s,minHeight:76,resize:"vertical",lineHeight:1.5}}/>
              </div>
            </>
          )}
          <button onClick={guardar} disabled={guardando} style={{width:"100%",padding:"13px",background:ok?C.green:guardando?C.mutedDim:`linear-gradient(135deg,${color},${color}cc)`,color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:guardando?"default":"pointer",transition:"background .3s",boxShadow:guardando?"none":`0 8px 20px -6px ${color}77`}}>
            {ok?"✓ Guardado":guardando?"Guardando...":"Guardar día"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DIAS_OPCIONES=["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"];
const DIAS_IDX={"LUN":0,"MAR":1,"MIÉ":2,"JUE":3,"VIE":4,"SÁB":5,"DOM":6};

function PlanSemanaAdmin({uid,coleccion,planActual,fechaInicioPlan,onClose,onFechaInicio}){
  const esGym=coleccion==="planGym";
  const color=esGym?C.amber:C.blue;
  const[diaEdit,setDiaEdit]=useState(null);
  const[plan,setPlan]=useState(planActual||[]);
  const[mostrarSelectorDia,setMostrarSelectorDia]=useState(false);
  const[semanaNew,setSemanaNew]=useState(1);
  const[fechaInicio,setFechaInicio]=useState(fechaInicioPlan||"");
  const[guardandoFecha,setGuardandoFecha]=useState(false);
  const[fechaOk,setFechaOk]=useState(false);

  const recargar=async()=>{
    try{
      const snap=await getDocs(query(collection(db,"usuarios",uid,coleccion),orderBy("semana"),orderBy("orden")));
      setPlan(snap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){
      try{
        const snap2=await getDocs(query(collection(db,"usuarios",uid,coleccion),orderBy("orden")));
        setPlan(snap2.docs.map(d=>({id:d.id,...d.data()})));
      }catch(e2){console.error(e2);}
    }
  };

  const guardarFechaInicio=async()=>{
    if(!fechaInicio)return;
    setGuardandoFecha(true);
    const campo=esGym?"planGymInicio":"planInicio";
    await updateDoc(doc(db,"usuarios",uid),{[campo]:fechaInicio});
    if(onFechaInicio)onFechaInicio(fechaInicio);
    setGuardandoFecha(false);setFechaOk(true);
    setTimeout(()=>setFechaOk(false),2000);
  };

  const eliminarDia=async(diaId)=>{
    if(!diaId)return;
    await deleteDoc(doc(db,"usuarios",uid,coleccion,diaId));
    recargar();
  };

  const semanas=[...new Set(plan.map(d=>d.semana||1))].sort((a,b)=>a-b);
  if(semanas.length===0)semanas.push(1);
  const maxSemana=semanas.length>0?Math.max(...semanas):1;

  return(
    <div style={{padding:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:10,color,letterSpacing:1.5,fontWeight:700}}>PLAN {esGym?"GYM":"RUNNING"}</div>
        <button onClick={onClose} style={{padding:"6px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.6)",fontSize:10,fontFamily:"inherit",cursor:"pointer",fontWeight:600}}>Cerrar</button>
      </div>
      <div style={{background:color+"12",border:`1px solid ${color}33`,borderRadius:16,padding:"13px 15px",marginBottom:14}}>
        <div style={{fontSize:9,color,letterSpacing:1.5,marginBottom:7,fontWeight:700}}>📅 FECHA DE INICIO DEL PLAN</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:9,lineHeight:1.5}}>Podés cargar el plan hoy y poner la fecha real en que el alumno empieza. El HOY avanza de semana automáticamente.</div>
        <div style={{display:"flex",gap:9,alignItems:"center"}}>
          <input type="date" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)} style={{...inp_s,flex:1,borderColor:color+"44"}}/>
          <button onClick={guardarFechaInicio} disabled={!fechaInicio||guardandoFecha} style={{padding:"10px 14px",background:fechaOk?C.green:color,color:C.white,border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer",whiteSpace:"nowrap",transition:"background .3s"}}>{fechaOk?"✓ OK":guardandoFecha?"...":"Guardar"}</button>
        </div>
        {fechaInicio&&<div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:7}}>El plan arranca el {new Date(fechaInicio+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}.</div>}
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:11,lineHeight:1.5}}>
        {plan.length===0?"Sin días cargados. Tocá '+ Agregar día' para empezar.":"Tocá un día para editarlo. Podés cargar varias semanas."}
      </div>

      {plan.length===0&&(
        <div style={{textAlign:"center",padding:"24px 18px",background:"rgba(255,255,255,0.03)",border:`1px dashed ${color}66`,borderRadius:16,marginBottom:14}}>
          <div style={{fontSize:26,marginBottom:7}}>📋</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Sin días cargados todavía</div>
        </div>
      )}

      {semanas.map(sem=>{
        const diasSem=plan.filter(d=>(d.semana||1)===sem);
        if(diasSem.length===0)return null;
        return(
          <div key={sem} style={{marginBottom:14}}>
            <div style={{fontSize:9,color,letterSpacing:1.5,fontWeight:700,marginBottom:7,padding:"5px 10px",background:color+"15",borderRadius:20,display:"inline-block"}}>
              SEMANA {sem}
            </div>
            {diasSem.map((d,i)=>{
              const colorDia = d.tipo==="Competencia" ? C.comp : color;
              return(
              <div key={d.id||i}>
                <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",opacity:d.tipo==="Descanso"?.5:1}}>
                  <div style={{width:32,fontSize:11,fontWeight:800,color:d.tipo==="Descanso"?"rgba(255,255,255,0.4)":colorDia,flexShrink:0}}>{d.dia}</div>
                  <div style={{width:7,height:7,borderRadius:"50%",background:d.completado?C.green:d.tipo==="Descanso"?"rgba(255,255,255,0.15)":colorDia,flexShrink:0}}/>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>setDiaEdit(d)}>
                    <div style={{fontSize:13,fontWeight:600,color:d.completado?"rgba(255,255,255,0.45)":d.tipo==="Descanso"?"rgba(255,255,255,0.4)":C.white}}>{d.tipo}</div>
                    {d.detalle&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{d.detalle}</div>}
                  </div>
                  {d.completado&&<span style={{color:C.green,fontSize:12}}>✓</span>}
                  <button onClick={()=>setDiaEdit(d)} style={{padding:"5px 9px",background:"rgba(255,255,255,0.05)",border:`1px solid ${colorDia}44`,borderRadius:8,color:colorDia,fontSize:11,cursor:"pointer"}}>✏️</button>
                  <button onClick={()=>eliminarDia(d.id)} style={{padding:"5px 9px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(224,60,60,0.3)",borderRadius:8,color:"#ff7a7a",fontSize:11,cursor:"pointer"}}>🗑️</button>
                </div>
                {i<diasSem.length-1&&<Divider/>}
              </div>
            );})}
          </div>
        );
      })}

      <button onClick={()=>{setSemanaNew(maxSemana);setMostrarSelectorDia(true);}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,width:"100%",padding:"12px",marginTop:6,background:"rgba(255,255,255,0.03)",border:`1px dashed ${color}66`,borderRadius:16,color,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer"}}>
        <span style={{fontSize:17,lineHeight:1}}>+</span> Agregar día
      </button>

      {mostrarSelectorDia&&(
        <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setMostrarSelectorDia(false)}>
          <div style={{background:"rgba(22,22,30,0.95)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:22,width:330,maxWidth:"90%",padding:22,maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:11,color,letterSpacing:1,marginBottom:9,fontWeight:700}}>SELECCIONÁ EL DÍA</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:9}}>¿A qué semana pertenece?</div>
            <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
              {[...Array(maxSemana+1)].map((_,i)=>{
                const s=i+1;
                return(
                  <button key={s} onClick={()=>setSemanaNew(s)} style={{padding:"6px 12px",border:`1px solid ${semanaNew===s?color:"rgba(255,255,255,0.1)"}`,borderRadius:20,background:semanaNew===s?color+"22":"rgba(255,255,255,0.04)",color:semanaNew===s?color:"rgba(255,255,255,0.5)",fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>
                    {s<=maxSemana?`S${s}`:`+ Nueva S${s}`}
                  </button>
                );
              })}
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:9}}>Día de la semana:</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
              {DIAS_OPCIONES.map(d=>(
                <button key={d} onClick={()=>{
                  const orden=(semanaNew-1)*7+(DIAS_IDX[d]||0)+1;
                  const nuevoDia={dia:d,semana:semanaNew,orden,tipo:"Descanso",detalle:"",distancia:"",ritmo:"",series:"",descanso:"",carga:"",frecuencia:"",comentario:"",ejercicios:[],completado:false};
                  setMostrarSelectorDia(false);
                  setDiaEdit(nuevoDia);
                }} style={{padding:"13px 7px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,color:C.white,fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer",transition:"all .15s",textAlign:"center"}} onMouseEnter={e=>{e.currentTarget.style.background=color+"22";e.currentTarget.style.borderColor=color+"66";e.currentTarget.style.color=color;}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color=C.white;}}>
                  {d}
                </button>
              ))}
            </div>
            <button onClick={()=>setMostrarSelectorDia(false)} style={{width:"100%",marginTop:14,padding:"10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,color:"rgba(255,255,255,0.5)",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>Cancelar</button>
          </div>
        </div>
      )}

      {diaEdit&&(
        <CargarDia diaData={diaEdit} uid={uid} coleccion={coleccion} onClose={()=>{setDiaEdit(null);recargar();}}/>
      )}
    </div>
  );
}

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
    <div style={{padding:18}}>
      <div style={{background:pg.color+"12",border:`1px solid ${pg.color}33`,borderRadius:16,padding:"13px 16px",marginBottom:14}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:0.5}}>ESTADO ACTUAL</div>
        <div style={{fontWeight:800,fontSize:17,color:pg.color,marginTop:4}}>{pg.label}</div>
      </div>
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:9}}>REGISTRAR PAGO</div>
        <div style={{display:"flex",gap:9}}>
          <input value={mes} onChange={e=>setMes(e.target.value)} placeholder="Junio 2026" style={{flex:2,...inp_s,padding:"9px 11px"}}/>
          <input type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="Monto" style={{flex:1,...inp_s,padding:"9px 11px"}}/>
          <button onClick={registrar} disabled={guardando} style={{padding:"9px 16px",background:guardando?C.mutedDim:"linear-gradient(135deg,#2146D0,#1530a0)",color:C.white,border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:guardando?"default":"pointer"}}>{guardando?"...":"+"}</button>
        </div>
      </div>
      {pagos.length===0&&<div style={{color:"rgba(255,255,255,0.4)",fontSize:13,textAlign:"center",padding:14}}>Sin pagos registrados.</div>}
      {pagos.map(p=>(
        <div key={p.id} style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          {editando===p.id?(
            <div style={{display:"flex",gap:9,alignItems:"center"}}>
              <input value={editMes} onChange={e=>setEditMes(e.target.value)} style={{flex:2,...inp_s,padding:"7px 9px",fontSize:12}}/>
              <input type="number" value={editMonto} onChange={e=>setEditMonto(e.target.value)} style={{flex:1,...inp_s,padding:"7px 9px",fontSize:12}}/>
              <button onClick={guardarEdit} style={{padding:"7px 12px",background:C.green,color:C.bg,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer"}}>OK</button>
              <button onClick={()=>setEditando(null)} style={{padding:"7px 12px",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>✕</button>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:C.white}}>{p.mes}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{p.fecha}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:C.white}}>${(p.monto||0).toLocaleString()}</div><Tag color={C.green}>{p.estado}</Tag></div>
                <button onClick={()=>{setEditando(p.id);setEditMes(p.mes);setEditMonto(p.monto);}} style={{padding:"5px 9px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer"}}>✏️</button>
                {confirmarBorrar===p.id
                  ?<button onClick={()=>borrar(p.id)} style={{padding:"5px 9px",background:C.red,border:"none",borderRadius:8,color:C.white,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>BORRAR</button>
                  :<button onClick={()=>setConfirmarBorrar(p.id)} style={{padding:"5px 9px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(224,60,60,0.3)",borderRadius:8,color:"#ff7a7a",fontSize:11,cursor:"pointer"}}>🗑️</button>
                }
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function KmChartAdmin({data,uid,onAgregar}){
  const[nueva,setNueva]=useState({semana:"",km:"",tipo:"carga"});
  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    const d=payload[0].payload;
    return(<div style={{background:"rgba(22,22,30,0.95)",backdropFilter:"blur(10px)",border:`1px solid ${d.tipo==="carga"?C.blue:C.amber}44`,borderRadius:12,padding:"10px 14px"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:d.tipo==="carga"?C.blue:C.amber}}>{d.km} km</div><Tag color={d.tipo==="carga"?C.blue:C.amber}>{d.tipo}</Tag></div>);
  };
  return(
    <div style={{padding:18}}>
      <div style={{fontSize:10,color:C.blue,letterSpacing:1.5,marginBottom:14,fontWeight:700}}>KILOMETRAJE SEMANAL</div>
      {data.length===0&&<div style={{color:"rgba(255,255,255,0.4)",fontSize:13,textAlign:"center",padding:14,marginBottom:14}}>Sin datos todavía.</div>}
      {data.length>0&&<ResponsiveContainer width="100%" height={170}><LineChart data={data} margin={{top:5,right:5,bottom:0,left:-20}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false}/><XAxis dataKey="semana" tick={{fill:"rgba(255,255,255,0.45)",fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"rgba(255,255,255,0.45)",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="km" stroke={C.blue} strokeWidth={2.5} dot={(props)=>{const{cx,cy,payload}=props;const col=payload.tipo==="carga"?C.blue:C.amber;return <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={5} fill={col} stroke={C.bg} strokeWidth={2}/>;}} /></LineChart></ResponsiveContainer>}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 16px",marginTop:14}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:9}}>AGREGAR SEMANA</div>
        <div style={{display:"flex",gap:9}}>
          <input value={nueva.semana} onChange={e=>setNueva({...nueva,semana:e.target.value})} placeholder="S1" style={{flex:1,...inp_s,padding:"9px 11px"}}/>
          <input type="number" value={nueva.km} onChange={e=>setNueva({...nueva,km:e.target.value})} placeholder="km" style={{flex:1,...inp_s,padding:"9px 11px"}}/>
          <select value={nueva.tipo} onChange={e=>setNueva({...nueva,tipo:e.target.value})} style={{flex:1,...inp_s,padding:"9px 11px"}}><option value="carga">Carga</option><option value="descarga">Descarga</option></select>
          <button onClick={()=>{if(!nueva.semana||!nueva.km)return;onAgregar(nueva);setNueva({semana:"",km:"",tipo:"carga"});}} style={{padding:"9px 14px",background:"linear-gradient(135deg,#2146D0,#1530a0)",color:C.white,border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer"}}>+</button>
        </div>
      </div>
    </div>
  );
}

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
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div className="card-glass" style={{background:"rgba(22,22,30,0.93)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,width:420,maxWidth:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px -12px #000000cc"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:13,flexShrink:0}}>
          <div style={{width:48,height:48,background:"rgba(33,70,208,0.12)",borderRadius:14,border:"1px solid rgba(33,70,208,0.3)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:17,fontWeight:800,color:"#7d9bff",lineHeight:1}}>{de||"—"}</span>
            <span style={{fontSize:8,color:"rgba(255,255,255,0.4)",letterSpacing:0.5}}>{me?MESES[me-1].slice(0,3).toUpperCase():"—"}</span>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:16,color:C.white,letterSpacing:-0.3}}>{evento.nombre}</div>
            <div style={{display:"flex",gap:7,marginTop:5,flexWrap:"wrap"}}>
              <Tag color={C.blue}>{evento.tipo}</Tag>
              {evento.distancia&&<Tag color={C.amber}>{evento.distancia}</Tag>}
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:30,height:30,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:18}}>
          {inscripto&&(
            <div style={{background:"rgba(34,201,122,0.1)",border:"1px solid rgba(34,201,122,0.3)",borderRadius:16,padding:"12px 16px",marginBottom:16,display:"flex",gap:11,alignItems:"center"}}>
              <IconCheck color={C.green}/>
              <div><div style={{fontSize:13,fontWeight:700,color:C.green}}>¡Estás anotado!</div>{distSel&&<div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Distancia: {distSel}</div>}</div>
            </div>
          )}
          {evento.descripcion&&(
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:7,fontWeight:600}}>DESCRIPCIÓN</div>
              <div style={{fontSize:13,color:C.white,lineHeight:1.6}}>{evento.descripcion}</div>
            </div>
          )}
          {evento.url&&(
            <div style={{background:"rgba(33,70,208,0.06)",border:"1px solid rgba(33,70,208,0.25)",borderRadius:16,padding:"12px 16px",marginBottom:16}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:7,fontWeight:600}}>SITIO OFICIAL</div>
              <a href={evento.url.startsWith("http")?evento.url:`https://${evento.url}`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,color:"#7d9bff",fontSize:13,textDecoration:"none",fontWeight:700}}>
                <IconLink color="#7d9bff"/>
                {evento.url.replace(/^https?:\/\//,"")}
              </a>
            </div>
          )}
          {distancias.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:9,fontWeight:600}}>SELECCIONÁ TU DISTANCIA</div>
              {distancias.map((d,i)=>(
                <div key={i} onClick={()=>setDistSel(d)} style={{display:"flex",alignItems:"center",gap:11,padding:"12px 16px",background:distSel===d?"rgba(33,70,208,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${distSel===d?"rgba(33,70,208,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:16,marginBottom:7,cursor:"pointer",transition:"all .15s"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${distSel===d?"#3a5fe0":"rgba(255,255,255,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {distSel===d&&<div style={{width:9,height:9,borderRadius:"50%",background:"#3a5fe0"}}/>}
                  </div>
                  <span style={{fontSize:14,fontWeight:700,color:distSel===d?"#7d9bff":C.white}}>{d}</span>
                </div>
              ))}
            </div>
          )}
          {!inscripto?(
            <button onClick={anotarse} disabled={loading||(distancias.length>0&&!distSel)} style={{width:"100%",padding:"14px",background:loading||(distancias.length>0&&!distSel)?C.mutedDim:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:loading?"default":"pointer"}}>
              {loading?"Procesando...":"Anotarme"}
            </button>
          ):(
            <button onClick={desinscribirse} disabled={loading} style={{width:"100%",padding:"14px",background:"rgba(224,60,60,0.1)",color:"#ff7a7a",border:"1px solid rgba(224,60,60,0.3)",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              {loading?"Procesando...":"Desinscribirme"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditarEvento({evento,onClose,onGuardado}){
  const[form,setForm]=useState({
    nombre:evento.nombre||"",
    fecha:evento.fecha||"",
    distancia:evento.distancia||"",
    tipo:evento.tipo||"Carrera",
    descripcion:evento.descripcion||"",
    distancias:(evento.distancias||[]).join(", "),
    url:evento.url||"",
  });
  const[guardando,setGuardando]=useState(false);
  const[ok,setOk]=useState(false);

  const guardar=async()=>{
    if(!form.nombre||!form.fecha||guardando)return;
    setGuardando(true);
    const distanciasArr=form.distancias?form.distancias.split(",").map(d=>d.trim()).filter(Boolean):[];
    await updateDoc(doc(db,"eventos",evento.id),{
      nombre:form.nombre,fecha:form.fecha,distancia:form.distancia,tipo:form.tipo,
      descripcion:form.descripcion,distancias:distanciasArr,url:form.url,
    });
    setGuardando(false);setOk(true);
    setTimeout(()=>{setOk(false);onGuardado();onClose();},1000);
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:450,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div className="card-glass" style={{background:"rgba(22,22,30,0.95)",backdropFilter:"blur(20px)",border:"1px solid rgba(33,70,208,0.3)",borderRadius:24,width:460,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px -12px #000000cc"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:11,flexShrink:0}}>
          <div style={{flex:1,fontWeight:800,fontSize:15,color:C.white}}>Editar evento</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:30,height:30,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:20}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>NOMBRE</div><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} style={inp_s}/></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>FECHA</div><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={inp_s}/></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>TIPO</div><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp_s}>{["Carrera","Entrenamiento grupal","Trail","Triatlón","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DISTANCIA PRINCIPAL</div><input value={form.distancia} onChange={e=>setForm({...form,distancia:e.target.value})} style={inp_s}/></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DISTANCIAS DISPONIBLES</div><input value={form.distancias} onChange={e=>setForm({...form,distancias:e.target.value})} placeholder="5K, 10K, 21K" style={inp_s}/></div>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DESCRIPCIÓN</div><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} style={{...inp_s,minHeight:70,resize:"vertical"}}/></div>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>LINK (sitio web o Instagram)</div><input value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="www.ejemplo.com" style={inp_s}/></div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={onClose} style={{flex:1,padding:"13px",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer"}}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{flex:2,padding:"13px",background:ok?C.green:guardando?C.mutedDim:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:guardando?"default":"pointer"}}>{ok?"✓ Guardado":guardando?"Guardando...":"Guardar cambios"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"11px",background:open?"rgba(255,255,255,0.05)":"rgba(224,68,154,0.1)",color:C.pink,border:"1px solid rgba(224,68,154,0.3)",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer"}}>
        {open?"Cancelar":(cicloActual?"Actualizar mi ciclo":"Cargar mi ciclo")}
      </button>
      {open&&(
        <div style={{background:"rgba(224,68,154,0.06)",border:"1px solid rgba(224,68,154,0.2)",borderRadius:18,padding:"16px",marginTop:9}}>
          <div style={{fontSize:10,color:C.pink,letterSpacing:1,marginBottom:13,fontWeight:700}}>{cicloActual?"ACTUALIZAR":"CARGAR"} DATOS DE MI CICLO</div>
          <div style={{marginBottom:11}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>FECHA DE INICIO DEL ÚLTIMO PERÍODO</div>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp_s,borderColor:"rgba(224,68,154,0.3)"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:13}}>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DURACIÓN DEL CICLO (días)</div>
              <input type="number" value={durCiclo} onChange={e=>setDurCiclo(e.target.value)} min="21" max="45" style={{...inp_s,borderColor:"rgba(224,68,154,0.3)"}}/>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:4}}>Promedio: 28 días</div>
            </div>
            <div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DURACIÓN DEL PERÍODO (días)</div>
              <input type="number" value={durMens} onChange={e=>setDurMens(e.target.value)} min="2" max="10" style={{...inp_s,borderColor:"rgba(224,68,154,0.3)"}}/>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:4}}>Promedio: 5 días</div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"11px 13px",marginBottom:13,fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>
            📌 Estos datos son privados. Solo los ven vos y tu entrenador para adaptar el plan de entrenamiento.
          </div>
          <button onClick={guardar} disabled={!fecha||guardando} style={{width:"100%",padding:"12px",background:ok?C.green:!fecha||guardando?C.mutedDim:"linear-gradient(135deg,#e0449a,#a02d6e)",color:C.white,border:"none",borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:!fecha||guardando?"default":"pointer",transition:"background .3s"}}>
            {ok?"✓ Guardado":guardando?"Guardando...":"Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

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
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"10px",background:open?"rgba(255,255,255,0.05)":"rgba(33,70,208,0.08)",color:"#7d9bff",border:`1px solid ${open?"rgba(255,255,255,0.1)":"rgba(33,70,208,0.35)"}`,borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
        <span style={{fontSize:15,lineHeight:1}}>+</span>{open?"Cancelar":"Proponer un evento"}
      </button>
      {open&&(
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"16px",marginTop:9}}>
          <div style={{fontSize:10,color:"#7d9bff",letterSpacing:1,marginBottom:9,fontWeight:700}}>PROPONER EVENTO</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:14,lineHeight:1.6}}>Tu propuesta será revisada por el entrenador antes de aparecer en el calendario.</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:5,fontWeight:600}}>NOMBRE DEL EVENTO</div><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej: 10K Villa María" style={inp_s}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
              <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:5,fontWeight:600}}>FECHA</div><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={inp_s}/></div>
              <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:5,fontWeight:600}}>TIPO</div><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp_s}>{["Carrera","Trail","Triatlón","Entrenamiento","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:5,fontWeight:600}}>DISTANCIA (opcional)</div><input value={form.distancia} onChange={e=>setForm({...form,distancia:e.target.value})} placeholder="Ej: 10K, 21K" style={inp_s}/></div>
            <button onClick={proponer} disabled={!form.nombre||!form.fecha||guardando} style={{padding:"12px",background:ok?C.green:!form.nombre||!form.fecha?C.mutedDim:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:!form.nombre||!form.fecha||guardando?"default":"pointer",transition:"background .3s"}}>
              {ok?"✓ Propuesta enviada":guardando?"Enviando...":"Enviar propuesta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventosView({uid,esAdmin=false,alumnos=[]}){
  const[eventos,setEventos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[mesActual,setMesActual]=useState(new Date().getMonth());
  const[anioActual,setAnioActual]=useState(new Date().getFullYear());
  const[form,setForm]=useState({nombre:"",fecha:"",distancia:"",tipo:"Carrera",descripcion:"",distancias:""});
  const[mostrarForm,setMostrarForm]=useState(false);
  const[guardando,setGuardando]=useState(false);
  const[eventoSel,setEventoSel]=useState(null);
  const[eventoEdit,setEventoEdit]=useState(null);
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

  const wrapStyle=esAdmin?{maxWidth:860,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}:{maxWidth:430,margin:"0 auto",padding:"16px 12px",position:"relative",zIndex:1};

  return(
    <div style={wrapStyle}>
      <style>{GLOBAL_ANIM_STYLES}</style>
      {esAdmin&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:1.5,fontWeight:600}}>EVENTOS Y CARRERAS</div>
          <button onClick={()=>setMostrarForm(!mostrarForm)} style={{padding:"9px 18px",background:mostrarForm?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:`1px solid ${mostrarForm?"rgba(255,255,255,0.1)":"transparent"}`,borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer"}}>
            {mostrarForm?"Cancelar":"+ Nuevo evento"}
          </button>
        </div>
      )}

      {!esAdmin&&(
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,marginBottom:12,fontWeight:600}}>CALENDARIO DE EVENTOS</div>
          <AlumnoProponerEvento uid={uid} onGuardado={cargar}/>
        </div>
      )}

      {esAdmin&&mostrarForm&&(
        <div className="card-glass" style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:22,padding:18,marginBottom:18}}>
          <div style={{fontSize:11,color:"#7d9bff",letterSpacing:1,marginBottom:14,fontWeight:700}}>AGREGAR EVENTO</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>NOMBRE</div><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej: Maratón Buenos Aires" style={inp_s}/></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>FECHA</div><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={inp_s}/></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>TIPO</div><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp_s}>{["Carrera","Entrenamiento grupal","Trail","Triatlón","Otro"].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DISTANCIA PRINCIPAL</div><input value={form.distancia} onChange={e=>setForm({...form,distancia:e.target.value})} placeholder="Ej: 42km" style={inp_s}/></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DISTANCIAS DISPONIBLES</div><input value={form.distancias} onChange={e=>setForm({...form,distancias:e.target.value})} placeholder="Ej: 5K, 10K, 21K" style={inp_s}/></div>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DESCRIPCIÓN</div><textarea value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} placeholder="Info adicional del evento..." style={{...inp_s,minHeight:64,resize:"vertical"}}/></div>
            <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>LINK (sitio web o Instagram)</div><input value={form.url||""} onChange={e=>setForm({...form,url:e.target.value})} placeholder="Ej: www.10klaplata.com.ar" style={inp_s}/></div>
          </div>
          <button onClick={guardar} disabled={guardando} style={{width:"100%",marginTop:14,padding:"13px",background:guardando?C.mutedDim:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:guardando?"default":"pointer"}}>
            {guardando?"Guardando...":"Guardar evento"}
          </button>
        </div>
      )}

      <div className="card-glass" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:22,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <button onClick={prevMes} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,color:C.white,padding:"7px 13px",cursor:"pointer",fontFamily:"inherit",fontSize:15}}>‹</button>
          <div style={{fontWeight:800,fontSize:15,letterSpacing:1,color:C.white}}>{MESES[mesActual].toUpperCase()} {anioActual}</div>
          <button onClick={nextMes} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,color:C.white,padding:"7px 13px",cursor:"pointer",fontFamily:"inherit",fontSize:15}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}}>
          {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,padding:"4px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {celdas.map((dia,i)=>{
            if(!dia)return <div key={`e${i}`}/>;
            const evs=eventosDelDia(dia);
            const hoy=new Date();
            const esHoy=dia===hoy.getDate()&&mesActual===hoy.getMonth()&&anioActual===hoy.getFullYear();
            return(
              <div key={dia} style={{minHeight:50,background:esHoy?"rgba(33,70,208,0.15)":"rgba(255,255,255,0.02)",border:`1px solid ${esHoy?"rgba(33,70,208,0.5)":evs.length>0?"rgba(33,70,208,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:10,padding:"4px 5px"}}>
                <div style={{fontSize:10,fontWeight:esHoy?800:400,color:esHoy?"#7d9bff":"rgba(255,255,255,0.4)",marginBottom:2}}>{dia}</div>
                {evs.map(e=>(
                  <div key={e.id} onClick={()=>setEventoSel(e)} style={{background:"rgba(33,70,208,0.2)",borderRadius:6,padding:"2px 5px",marginBottom:2,cursor:"pointer"}}>
                    <div style={{fontSize:8,color:"#7d9bff",fontWeight:700,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.nombre}</div>
                    {e.distancia&&<div style={{fontSize:7,color:"rgba(255,255,255,0.4)"}}>{e.distancia}</div>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {esAdmin&&eventosPendientes.length>0&&(
        <div className="card-glass" style={{background:"rgba(232,154,26,0.05)",border:"1px solid rgba(232,154,26,0.3)",borderRadius:22,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontSize:10,color:C.amber,letterSpacing:1,fontWeight:700}}>EVENTOS PROPUESTOS POR ALUMNOS</span>
            <span style={{background:"rgba(232,154,26,0.2)",color:C.amber,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{eventosPendientes.length}</span>
          </div>
          {eventosPendientes.map((e,i)=>{
            const[ye,me,de]=e.fecha?e.fecha.split("-").map(Number):[0,0,0];
            return(
              <div key={e.id} style={{padding:"13px 16px",borderBottom:i<eventosPendientes.length-1?"1px solid rgba(255,255,255,0.08)":"none",display:"flex",alignItems:"center",gap:11}}>
                <div style={{width:40,height:40,background:"rgba(232,154,26,0.1)",borderRadius:12,border:"1px solid rgba(232,154,26,0.3)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:13,fontWeight:800,color:C.amber,lineHeight:1}}>{de||"—"}</span>
                  <span style={{fontSize:7,color:"rgba(255,255,255,0.4)",letterSpacing:0.5}}>{me?MESES[me-1].slice(0,3).toUpperCase():"—"}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.white}}>{e.nombre}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:3}}>Propuesto por: <span style={{color:C.amber}}>{e.propuestoPor||"Alumno"}</span></div>
                  <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                    <Tag color={C.amber}>{e.tipo}</Tag>
                    {e.distancia&&<Tag color={C.muted}>{e.distancia}</Tag>}
                  </div>
                </div>
                <div style={{display:"flex",gap:7,flexShrink:0}}>
                  <button onClick={()=>aprobarEvento(e.id)} style={{padding:"7px 13px",background:C.green,color:C.bg,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>Aprobar</button>
                  <button onClick={()=>rechazarEvento(e.id)} style={{padding:"7px 13px",background:"rgba(255,255,255,0.05)",color:"#ff7a7a",border:"1px solid rgba(224,60,60,0.3)",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>Rechazar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="card-glass" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:22,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,fontWeight:600}}>PRÓXIMOS EVENTOS</span></div>
        {eventosAprobados.length===0&&<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:13}}>No hay eventos cargados todavía.</div>}
        {eventosAprobados.map((e,i)=>{
          const[ye,me,de]=e.fecha?e.fecha.split("-").map(Number):[0,0,0];
          const ins=getInscriptosEvento(e);
          const miInscripcion=e.inscriptos?.find(i=>i.uid===uid);
          return(
            <div key={e.id} style={{padding:"13px 16px",borderBottom:i<eventosAprobados.length-1?"1px solid rgba(255,255,255,0.08)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:11}}>
                <div style={{width:46,height:46,background:"rgba(33,70,208,0.1)",borderRadius:13,border:"1px solid rgba(33,70,208,0.3)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:15,fontWeight:800,color:"#7d9bff",lineHeight:1}}>{de||"—"}</span>
                  <span style={{fontSize:7,color:"rgba(255,255,255,0.4)",letterSpacing:0.5}}>{me?MESES[me-1].slice(0,3).toUpperCase():"—"}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.white}}>{e.nombre}</div>
                  <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                    <Tag color={C.blue}>{e.tipo}</Tag>
                    {e.distancia&&<Tag color={C.amber}>{e.distancia}</Tag>}
                    {miInscripcion&&<Tag color={C.green}>ANOTADO{miInscripcion.distancia?` — ${miInscripcion.distancia}`:""}</Tag>}
                  </div>
                  {e.url&&!esAdmin&&(
                    <a href={e.url.startsWith("http")?e.url:`https://${e.url}`} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:6,color:"#7d9bff",fontSize:11,textDecoration:"none",fontWeight:700}}>
                      <IconLink color="#7d9bff" size={11}/>
                      {e.url.replace(/^https?:\/\//,"")}
                    </a>
                  )}
                  {esAdmin&&ins.length>0&&(
                    <div style={{marginTop:6,fontSize:10,color:"rgba(255,255,255,0.4)"}}>
                      Inscriptos: {ins.map(i=>`${i.nombre}${i.distancia?` (${i.distancia})`:""}`).join(", ")}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
                  <button onClick={()=>setEventoSel(e)} style={{padding:"6px 12px",background:"rgba(33,70,208,0.15)",color:"#7d9bff",border:"1px solid rgba(33,70,208,0.3)",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>
                    {esAdmin?"Ver":"Detalle"}
                  </button>
                  {esAdmin&&(
                    <button onClick={()=>setEventoEdit(e)} style={{padding:"6px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.6)",fontSize:11,cursor:"pointer"}}>✏️</button>
                  )}
                  {esAdmin&&(confirmarBorrar===e.id
                    ?<button onClick={()=>borrar(e.id)} style={{padding:"6px 12px",background:C.red,border:"none",borderRadius:10,color:C.white,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Borrar</button>
                    :<button onClick={()=>setConfirmarBorrar(e.id)} style={{padding:"6px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer"}}>🗑️</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {eventoSel&&(
        esAdmin
          ?<DetalleEvento evento={eventoSel} uid={null} onClose={()=>{setEventoSel(null);cargar();}}/>
          :<DetalleEvento evento={eventoSel} uid={uid} onClose={()=>{setEventoSel(null);cargar();}}/>
      )}
      {eventoEdit&&(
        <EditarEvento evento={eventoEdit} onClose={()=>setEventoEdit(null)} onGuardado={cargar}/>
      )}
    </div>
  );
}

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
      <div style={{marginTop:14}}>
        <div style={{fontSize:9,color:C.pink,letterSpacing:1,marginBottom:8,fontWeight:700}}>{MESES_N[mes]} {anio} — VISTA DEL CICLO</div>
        <div style={{display:"flex",gap:12,marginBottom:8,flexWrap:"wrap"}}>
          {[{c:C.pink,l:"Período"},{c:C.green,l:"Ovulación"},{c:C.blue,l:"Hoy"}].map(x=>(
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:x.c,flexShrink:0}}/>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{x.l}</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
          {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:8,color:"rgba(255,255,255,0.4)",fontWeight:700,padding:"3px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {celdas.map((dia,i)=>{
            if(!dia)return <div key={"e"+i}/>;
            const esHoy=dia===hoy.getDate();
            const esPer=diasPeriodo.has(dia);
            const esOvul=diasOvulacion.has(dia);
            return(
              <div key={dia} style={{minHeight:30,background:esHoy?"rgba(33,70,208,0.15)":esPer?"rgba(224,68,154,0.12)":esOvul?"rgba(34,201,122,0.1)":"rgba(255,255,255,0.02)",border:`1px solid ${esHoy?"rgba(33,70,208,0.5)":esPer?"rgba(224,68,154,0.4)":esOvul?"rgba(34,201,122,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:8,padding:"3px 4px",position:"relative"}}>
                <div style={{fontSize:9,color:esHoy?"#7d9bff":esPer?C.pink:"rgba(255,255,255,0.4)",fontWeight:esHoy?800:400}}>{dia}</div>
                {esPer&&<div style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:C.pink}}/>}
                {esOvul&&!esPer&&<div style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:C.green}}/>}
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
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <style>{GLOBAL_ANIM_STYLES}</style>
      <div className="card-glass" style={{background:"rgba(22,22,30,0.94)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:26,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 60px -14px #000000dd"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"15px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:11,flexShrink:0}}>
          <div style={{width:40,height:40,borderRadius:14,background:"linear-gradient(145deg,#3a5fe0,#1530a0)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:C.white,boxShadow:"0 4px 12px -3px #2146D099"}}>{(alumno.nombre||"?")[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:C.white}}>{alumno.nombre}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{alumno.tipo&&<Tag color={C.blue}>{alumno.tipo}</Tag>}{generoFinal==="F"&&<Tag color={C.pink}>♀</Tag>}{generoFinal==="M"&&<Tag color={C.blue}>♂</Tag>}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:30,height:30,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",overflowX:"auto",flexShrink:0}}>
          {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"9px 13px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${t==="ciclo"?C.pink:C.blue}`:"2px solid transparent",color:tab===t?(t==="ciclo"?"#e0449a":"#7d9bff"):"rgba(255,255,255,0.4)",fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:1,cursor:"pointer",textTransform:"uppercase"}}>{t==="ciclo"?"CICLO ♀":t.toUpperCase()}</button>)}
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {tab==="perfil"&&(
            <div style={{padding:18}}>
              <div style={{display:"flex",flexDirection:"column",gap:11}}>
                {[{label:"NOMBRE",value:nombre,set:setNombre,placeholder:"Nombre completo"},{label:"OBJETIVO",value:objetivo,set:setObjetivo,placeholder:"Objetivo principal"},{label:"PESO (kg)",value:peso,set:setPeso,placeholder:"72",type:"number"},{label:"EDAD",value:edad,set:setEdad,placeholder:"25",type:"number"}].map(f=>(
                  <div key={f.label}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>{f.label}</div><input type={f.type||"text"} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp_s}/></div>
                ))}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                  <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>GÉNERO</div><select value={genero} onChange={e=>setGenero(e.target.value)} style={inp_s}><option value="">Sin especificar</option><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
                  <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>TIPO DE PLAN</div><select value={tipo} onChange={e=>setTipo(e.target.value)} style={inp_s}><option value="">Sin asignar</option><option value="Solo Running">Solo Running</option><option value="Running + Gym">Running + Gym</option></select></div>
                  <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>DÍAS PLAN</div><input type="number" value={planDias} onChange={e=>setPlanDias(e.target.value)} style={inp_s} min="0" max="15"/></div>
                  <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>PROGRESO %</div><input type="number" value={progreso} onChange={e=>setProgreso(e.target.value)} style={inp_s} min="0" max="100"/></div>
                  <div style={{gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5,marginBottom:6,fontWeight:600}}>PAGO</div><select value={pagado?"si":"no"} onChange={e=>setPagado(e.target.value==="si")} style={inp_s}><option value="si">AL DÍA</option><option value="no">PENDIENTE</option></select></div>
                </div>
                <button onClick={guardarPerfil} style={{padding:"13px",background:editOk?C.green:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:16,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer",transition:"background .3s"}}>{editOk?"✓ Guardado":"Guardar cambios"}</button>
                <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"13px 15px"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:9,fontWeight:600}}>MARCAS</div>
                  {[{l:"5K",v:alumno.marcas?.cinco||"—"},{l:"10K",v:alumno.marcas?.diez||"—"},{l:"21K",v:alumno.marcas?.media||"—"},{l:"42K",v:alumno.marcas?.maraton||"—"}].map(m=>(
                    <div key={m.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}><span style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>MEJOR {m.l}</span><span style={{fontSize:13,fontWeight:700,color:C.white}}>{m.v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="plan"&&(
            <div>
              {mostrarPlanEdit?(
                <PlanSemanaAdmin uid={alumno.uid} coleccion={colActual} planActual={planActual} fechaInicioPlan={colActual==="planGym"?alumno.planGymInicio:alumno.planInicio} onClose={()=>{setMostrarPlanEdit(false);cargarPlanes();}} onFechaInicio={(f)=>{}}/>
              ):(
                <div style={{padding:18}}>
                  {esGymYRunning&&(
                    <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:14,padding:4,marginBottom:14}}>
                      {[["running","🏃 RUNNING"],["gym","🏋️ GYM"]].map(([k,l])=>(
                        <button key={k} onClick={()=>setPlanSubTab(k)} style={{flex:1,padding:"9px",border:"none",borderRadius:11,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer",background:planSubTab===k?(k==="gym"?"linear-gradient(135deg,#e89a1a,#a86c0e)":"linear-gradient(135deg,#3a5fe0,#1530a0)"):"transparent",color:planSubTab===k?C.white:"rgba(255,255,255,0.45)",transition:"all .2s"}}>{l}</button>
                      ))}
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,fontWeight:600}}>PLAN {esGymYRunning?(planSubTab==="gym"?"GYM":"RUNNING"):"ACTUAL"}</div><div style={{fontWeight:700,color:ps.color,marginTop:3,fontSize:13}}>{ps.label}</div></div>
                    <div style={{display:"flex",gap:7}}>
                      {planActual.filter(d=>d.completado).length>0&&(
                        <button onClick={async()=>{
                          const col=planSubTab==="gym"?"planGym":"plan";
                          const completados=planActual.filter(d=>d.completado&&d.id);
                          await Promise.all(completados.map(d=>deleteDoc(doc(db,"usuarios",alumno.uid,col,d.id))));
                          cargarPlanes();
                        }} style={{padding:"8px 12px",background:"rgba(224,60,60,0.1)",color:"#ff7a7a",border:"1px solid rgba(224,60,60,0.3)",borderRadius:11,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>
                          🗑 Limpiar completados
                        </button>
                      )}
                      <button onClick={()=>setMostrarPlanEdit(true)} style={{padding:"8px 14px",background:planSubTab==="gym"?"linear-gradient(135deg,#e89a1a,#a86c0e)":"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:11,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>
                        {planActual.length===0?"+ Cargar plan":"Editar plan"}
                      </button>
                    </div>
                  </div>
                  {planActual.length===0
                    ?<div style={{color:"rgba(255,255,255,0.4)",fontSize:13,textAlign:"center",padding:24,background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)"}}>Sin plan cargado. Hacé click en "Cargar Plan".</div>
                    :planActual.map((d,i)=>{
                      const colorDia=d.tipo==="Competencia"?C.comp:(planSubTab==="gym"?C.amber:C.blue);
                      return(
                      <div key={d.id||i} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",opacity:d.tipo==="Descanso"?.45:1}}>
                        <div style={{width:28,fontSize:11,fontWeight:700,color:d.completado?C.green:"rgba(255,255,255,0.45)"}}>{d.dia}</div>
                        <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:d.completado?C.green:d.tipo==="Descanso"?"rgba(255,255,255,0.15)":colorDia}}/>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:d.completado?"rgba(255,255,255,0.45)":C.white}}>{d.tipo}</div>{d.detalle&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{d.detalle}</div>}</div>
                        {d.completado&&<span style={{color:C.green,fontSize:13}}>✓</span>}
                      </div>
                    );})
                  }
                </div>
              )}
            </div>
          )}

          {tab==="ciclo"&&(
            <div style={{padding:18}}>
              {ci?(
                <div>
                  {ci.enMenstruacion&&ci.diaEnCiclo<=2&&<div style={{background:"rgba(224,68,154,0.1)",border:"1px solid rgba(224,68,154,0.3)",borderRadius:14,padding:"11px 14px",marginBottom:12,display:"flex",gap:9,alignItems:"center"}}><span>⚠️</span><div><div style={{fontSize:13,color:C.pink,fontWeight:700}}>DÍA {ci.diaEnCiclo} — NO ENTRENAR</div></div></div>}
                  {ci.alertaProxima&&<div style={{background:"rgba(232,154,26,0.08)",border:"1px solid rgba(232,154,26,0.3)",borderRadius:14,padding:"11px 14px",marginBottom:12,display:"flex",gap:9,alignItems:"center"}}><span>🗓️</span><div><div style={{fontSize:13,color:C.amber,fontWeight:700}}>MENSTRUACIÓN EN {ci.diasHastaProxima}D</div></div></div>}
                  <div style={{background:"rgba(224,68,154,0.06)",border:"1px solid rgba(224,68,154,0.2)",borderRadius:18,padding:"16px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                      {[
                      {label:"FASE",value:ci.fase,color:faseColor[ci.fase]||C.muted},
                      {label:"DÍA DEL CICLO",value:`${ci.diaEnCiclo} / ${ci.durCiclo}`,color:C.white},
                      {label:"PRÓXIMO PERÍODO",value:`En ${ci.diasHastaProxima}d`,color:ci.diasHastaProxima<=3?C.pink:C.muted},
                      {label:"OVULACIÓN EST.",value:(()=>{const diasOvul=14-(ci.diaEnCiclo);return diasOvul>0?`En ~${diasOvul}d`:"Esta semana";})(),color:C.green},
                      {label:"DURACIÓN CICLO",value:`${ci.durCiclo} días`,color:C.white},
                      {label:"DURACIÓN PERÍODO",value:`${ci.durMens} días`,color:C.white},
                    ].map(item=>(
                      <div key={item.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 12px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:3,fontWeight:600}}>{item.label}</div><div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div></div>
                    ))}
                    </div>
                  </div>
                  <CicloCalendario ci={ci} ciclo={alumno.ciclo}/>
                </div>
              ):<div style={{color:"rgba(255,255,255,0.4)",fontSize:13,textAlign:"center",padding:24}}>Sin datos de ciclo. La alumna debe cargar su período.</div>}
            </div>
          )}

          {tab==="pagos"&&<HistorialPagos uid={alumno.uid} pg={pg}/>}

          {tab==="notas"&&(
            <div style={{padding:18}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:9,fontWeight:600}}>NOTAS PRIVADAS</div>
              <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Lesiones, contexto, observaciones..." style={{width:"100%",minHeight:150,padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,color:C.white,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.6}}/>
              <button onClick={guardarNota} style={{width:"100%",marginTop:10,padding:"11px",background:guardado?C.green:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer",transition:"background .3s"}}>{guardado?"✓ Guardado":"Guardar nota"}</button>
            </div>
          )}

          {tab==="km"&&<KmChartAdmin data={kmData} uid={alumno.uid} onAgregar={agregarKm}/>}
        </div>
      </div>
    </div>
  );
}

function PanelFiltrado({titulo,alumnos,onSelect,onClose}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div className="card-glass" style={{background:"rgba(22,22,30,0.94)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,width:440,maxWidth:"100%",maxHeight:"80vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px -12px #000000cc"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"15px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:14,color:C.white,letterSpacing:0.5}}>{titulo}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,width:30,height:30,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {alumnos.length===0&&<div style={{padding:28,textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:13}}>No hay alumnos en esta categoría.</div>}
          {alumnos.map((a,i)=>{
            const ps=planStatus(a.planDias),pg=payStatus(a.pagado,a.diasVencido);
            return(
              <div key={a.uid}>
                <div onClick={()=>onSelect(a)} style={{padding:"13px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:11}}>
                  <div style={{width:36,height:36,borderRadius:13,background:"linear-gradient(145deg,#3a5fe0,#1530a0)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:C.white}}>{(a.nombre||"?")[0]}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:C.white}}>{a.nombre}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{a.tipo||"—"} · <span style={{color:ps.color}}>{ps.label}</span> · <span style={{color:pg.color}}>{pg.label}</span></div></div>
                  <span style={{color:"rgba(255,255,255,0.3)",fontSize:16}}>›</span>
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
    const activos=todos.filter(u=>u.role==="alumno"&&u.estado==="activo");
    const alumnosConProgreso=await Promise.all(activos.map(async(a)=>{
      try{
        const [snapR,snapG]=await Promise.all([
          getDocs(collection(db,"usuarios",a.uid,"plan")),
          getDocs(collection(db,"usuarios",a.uid,"planGym")),
        ]);
        const planR=snapR.docs.map(d=>d.data());
        const planG=snapG.docs.map(d=>d.data());
        const total=planR.filter(d=>d.tipo!=="Descanso").length+planG.filter(d=>d.tipo!=="Descanso").length;
        const completados=planR.filter(d=>d.completado&&d.tipo!=="Descanso").length+planG.filter(d=>d.completado&&d.tipo!=="Descanso").length;
        const progreso=total>0?Math.round((completados/total)*100):0;
        return{...a,progreso};
      }catch(e){return{...a,progreso:a.progreso||0};}
    }));
    setAlumnos(alumnosConProgreso);
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
      <style>{GLOBAL_ANIM_STYLES}</style>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,fontWeight:600}}>PANEL DE CONTROL</div><Slashes/>
      </div>

      <div style={{display:"flex",gap:9,marginBottom:14}}>
        {stats.map(s=>(
          <div key={s.label} className="card-glass" onClick={()=>setPanelFiltro({titulo:s.titulo,lista:s.lista})} style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"13px 14px",cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color+"66";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.transform="translateY(0)";}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:6,fontWeight:600}}>{s.label}</div>
            <div style={{fontSize:26,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:9,color:s.color,marginTop:5,letterSpacing:0.5,fontWeight:600}}>VER ›</div>
          </div>
        ))}
      </div>
      {solicitudes.map(s=>(
        <div key={s.uid} style={{display:"flex",alignItems:"center",gap:11,background:"rgba(232,154,26,0.08)",border:"1px solid rgba(232,154,26,0.3)",borderRadius:16,padding:"11px 14px",marginBottom:7}}>
          <span>🔔</span>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.white}}>{s.nombre}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{s.email}</div></div>
          <button onClick={()=>aprobar(s.uid)} style={{padding:"7px 13px",background:C.green,color:C.bg,border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>Aprobar</button>
          <button onClick={()=>rechazar(s.uid)} style={{padding:"7px 13px",background:"rgba(255,255,255,0.05)",color:"#ff7a7a",border:"1px solid rgba(224,60,60,0.3)",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>Rechazar</button>
        </div>
      ))}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",overflowX:"auto"}}>
        {["alumnos","cobros","eventos"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"9px 16px",background:"none",border:"none",borderBottom:tab===t?"2px solid #2146D0":"2px solid transparent",color:tab===t?"#7d9bff":"rgba(255,255,255,0.4)",fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:1.5,cursor:"pointer",textTransform:"uppercase"}}>{t}</button>
        ))}
      </div>

      {tab==="alumnos"&&(
        <div className="card-glass" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderTop:"none",borderRadius:"0 0 18px 18px"}}>
          <div style={{padding:"10px 16px"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,fontWeight:600}}>ALUMNOS ACTIVOS</span></div><Divider/>
          {alumnos.length===0&&<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:13}}>No hay alumnos activos todavía.</div>}
          {alumnos.map((a,i)=>{
            const ps=planStatus(a.planDias),pg=payStatus(a.pagado,a.diasVencido);
            const ci=a.ciclo?cicloInfo(a.ciclo):null;
            const cicloAlerta=ci&&(ci.alertaProxima||(ci.enMenstruacion&&ci.diaEnCiclo<=2));
            return(
              <div key={a.uid}>
                <div onClick={()=>setAlumnoSel(a)} style={{padding:"12px 16px",cursor:"pointer",transition:"background .15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11}}>
                    <div style={{position:"relative"}}>
                      <div style={{width:36,height:36,borderRadius:13,background:"linear-gradient(145deg,#3a5fe0,#1530a0)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:C.white}}>{(a.nombre||"?")[0]}</div>
                      {cicloAlerta&&<div style={{position:"absolute",top:-3,right:-3,width:10,height:10,borderRadius:"50%",background:C.pink,border:"2px solid #16161E"}}/>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,fontSize:14,color:C.white}}>{a.nombre}</span>{a.genero==="F"&&<span style={{fontSize:10,color:C.pink}}>♀</span>}{a.genero==="M"&&<span style={{fontSize:10,color:C.blue}}>♂</span>}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{a.tipo||"Sin plan"}{a.edad?` · ${a.edad} años`:""}</div>
                    </div>
                    <div style={{textAlign:"right",minWidth:80}}><div style={{fontSize:11,color:ps.color,fontWeight:700}}>{ps.label}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.35)"}}>PLAN</div></div>
                    <div style={{width:26,height:26,borderRadius:"50%",background:pg.color+"20",border:`1px solid ${pg.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:pg.color}}>{a.pagado?"✓":"!"}</div>
                  </div>
                  <div style={{marginTop:7,display:"flex",alignItems:"center",gap:9}}><Bar value={a.progreso||0} color={(a.progreso||0)>75?C.green:(a.progreso||0)>50?C.blue:C.amber}/><span style={{fontSize:11,color:"rgba(255,255,255,0.4)",minWidth:26}}>{a.progreso||0}%</span></div>
                </div>
                {i<alumnos.length-1&&<Divider/>}
              </div>
            );
          })}
        </div>
      )}

      {tab==="cobros"&&(
        <div className="card-glass" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderTop:"none",borderRadius:"0 0 18px 18px"}}>
          <div style={{padding:"10px 16px"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,fontWeight:600}}>COBROS</span></div><Divider/>
          {alumnos.map((a,i)=>{
            const pg=payStatus(a.pagado,a.diasVencido);
            return(
              <div key={a.uid}>
                <div style={{display:"flex",alignItems:"center",gap:11,padding:"12px 16px"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:a.pagado?C.green+"22":C.red+"22",border:`1px solid ${a.pagado?C.green:C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:a.pagado?C.green:C.red}}>{a.pagado?"✓":"!"}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:C.white}}>{a.nombre}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{a.tipo}</div></div>
                  <div style={{fontWeight:700,fontSize:13,color:pg.color}}>{pg.label}</div>
                  <button onClick={async()=>{await updateDoc(doc(db,"usuarios",a.uid),{pagado:!a.pagado});cargar();}} style={{padding:"6px 12px",background:a.pagado?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:`1px solid ${a.pagado?"rgba(255,255,255,0.1)":"transparent"}`,borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>{a.pagado?"Revertir":"Cobrado"}</button>
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
      setPlanRunning(planR);
      setPlanGym(planG);
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
  const totalEntrenR=planRunning.filter(d=>d.tipo!=="Descanso").length;
  const totalEntrenG=planGym.filter(d=>d.tipo!=="Descanso").length;
  const totalEntren=totalEntrenR+totalEntrenG;
  const completadosEntren=planRunning.filter(d=>d.completado&&d.tipo!=="Descanso").length+planGym.filter(d=>d.completado&&d.tipo!=="Descanso").length;
  const porcentaje=totalEntren>0?Math.round((completadosEntren/totalEntren)*100):0;
  const DIAS_MAP={"0":"DOM","1":"LUN","2":"MAR","3":"MIÉ","4":"JUE","5":"VIE","6":"SÁB"};
  const diaHoy=DIAS_MAP[new Date().getDay().toString()]||"LUN";
  const getSemanaActiva=(plan,fechaInicioStr)=>{
    if(!plan||plan.length===0)return 1;
    const semanas=[...new Set(plan.map(d=>d.semana||1))].sort((a,b)=>a-b);
    if(fechaInicioStr){
      try{
        const inicio=new Date(fechaInicioStr+"T12:00:00");
        const hoy=new Date();
        hoy.setHours(12,0,0,0);
        const diasTranscurridos=Math.floor((hoy-inicio)/(1000*60*60*24));
        if(diasTranscurridos<0)return semanas[0];
        const semanaCalc=Math.floor(diasTranscurridos/7)+1;
        const semanasFiltradas=semanas.filter(s=>s<=semanaCalc);
        if(semanasFiltradas.length>0)return Math.max(...semanasFiltradas);
        return semanas[0];
      }catch(e){}
    }
    for(const sem of semanas){
      const diasSem=plan.filter(d=>(d.semana||1)===sem);
      if(diasSem.some(d=>!d.completado&&d.tipo!=="Descanso"))return sem;
    }
    return semanas[semanas.length-1];
  };
  const semanaActivaR=getSemanaActiva(planRunning,perfil.planInicio);
  const semanaActivaG=getSemanaActiva(planGym,perfil.planGymInicio||perfil.planInicio);
  const entrenamientoHoyR=planRunning.find(d=>d.dia===diaHoy&&(d.semana||1)===semanaActivaR);
  const entrenamientoHoyG=planGym.find(d=>d.dia===diaHoy&&(d.semana||1)===semanaActivaG);
  const hoy=planActivo.find(d=>!d.completado&&d.tipo!=="Descanso");
  const ps=planStatus(perfil.planDias);
  const pg=payStatus(perfil.pagado,perfil.diasVencido);
  const generoFinal=genero||perfil.genero;
  const tabs=generoFinal==="F"?["hoy","semana","resumen","ciclo","eventos","perfil"]:["hoy","semana","resumen","eventos","perfil"];
  const inp={...inp_s,marginTop:4};

  const esCompHoyR = entrenamientoHoyR?.tipo==="Competencia";
  const esCompHoyG = entrenamientoHoyG?.tipo==="Competencia";

  return(
    <div style={{maxWidth:430,margin:"0 auto",padding:"16px 10px",position:"relative",zIndex:1}}>
      <style>{GLOBAL_ANIM_STYLES}</style>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(circle at 20% 0%,#1a2a6622,transparent 50%),radial-gradient(circle at 90% 80%,#2146D015,transparent 50%)",zIndex:-1,pointerEvents:"none"}}/>
      {ci&&ci.enMenstruacion&&ci.diaEnCiclo<=2&&<div style={{background:"rgba(224,68,154,0.1)",border:"1px solid rgba(224,68,154,0.3)",borderRadius:16,padding:"11px 14px",marginBottom:11,display:"flex",gap:9,alignItems:"center"}}><span>🌸</span><div><div style={{fontSize:13,color:C.pink,fontWeight:700}}>DÍA {ci.diaEnCiclo} — TU ENTRENADOR SUGIERE DESCANSO</div></div></div>}

      <div className="card-glass" style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"15px 16px",marginBottom:11,boxShadow:"0 8px 24px -8px #00000077"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:42,height:42,borderRadius:15,background:"linear-gradient(145deg,#3a5fe0,#1530a0)",boxShadow:"0 6px 16px -4px #2146D099",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:17,color:C.white}}>{(perfil.nombre||"?")[0]}</div>
            <div><div style={{fontWeight:800,fontSize:14,color:C.white}}>{perfil.nombre}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>{perfil.objetivo||"Sin objetivo cargado"}</div></div>
          </div>
          <Slashes size={9}/>
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:5,fontWeight:600}}>PROGRESO DEL CICLO</div>
        <Bar value={porcentaje} color={C.blue} height={7}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{perfil.tipo||"Sin plan"}</span>
          <span style={{fontSize:11,color:"#7d9bff",fontWeight:700}}>{porcentaje}%</span>
        </div>
      </div>

      <div style={{display:"flex",gap:7,marginBottom:11}}>
        {[{label:"DÍAS OK",value:`${planActivo.filter(d=>d.completado).length}/${planActivo.length||7}`,color:C.green},{label:"PLAN",value:ps.label,color:ps.color},{label:"PAGO",value:pg.label,color:pg.color}].map(s=>(
          <div key={s.label} className="card-glass" style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"11px 6px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginTop:2,fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.08)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"9px 11px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${t==="ciclo"?C.pink:C.blue}`:"2px solid transparent",color:tab===t?(t==="ciclo"?"#e0449a":"#7d9bff"):"rgba(255,255,255,0.4)",fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:0.5,cursor:"pointer",textTransform:"uppercase"}}>{t==="ciclo"?"CICLO":t}</button>)}
      </div>

      {tab!=="eventos"&&(
        <div className="card-glass" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderTop:"none",borderRadius:"0 0 18px 18px"}}>

          {tab==="hoy"&&(
            <div style={{padding:14}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:12,fontWeight:600}}>{diaHoy} — HOY</div>
              {planRunning.length===0&&planGym.length===0&&(
                <div style={{textAlign:"center",padding:28,background:"rgba(255,255,255,0.02)",borderRadius:18,border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:26,marginBottom:8}}>📋</div>
                  <div style={{fontWeight:700,color:C.white,marginBottom:5,fontSize:14}}>Sin plan cargado</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Tu entrenador aún no cargó el plan de entrenamiento.</div>
                </div>
              )}
              {entrenamientoHoyR&&entrenamientoHoyR.tipo!=="Descanso"&&(
                <div className={esCompHoyR?"card-glass glow-comp":"card-glass"} style={{background:esCompHoyR?"rgba(255,107,92,0.07)":"rgba(255,255,255,0.04)",border:`1px solid ${esCompHoyR?"rgba(255,107,92,0.35)":"rgba(33,70,208,0.35)"}`,borderRadius:20,padding:"17px",marginBottom:9}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:11}}>
                    <div style={{width:28,height:28,borderRadius:9,background:(esCompHoyR?C.comp:C.blue)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {iconoPorTipoYColeccion(entrenamientoHoyR.tipo,false,esCompHoyR?C.comp:"#7d9bff",15)}
                    </div>
                    <span style={{fontSize:11,color:esCompHoyR?"#ff9d91":"#7d9bff",letterSpacing:1,fontWeight:700}}>{esCompHoyR?"COMPETENCIA":"RUNNING"}</span>
                    <Tag color={esCompHoyR?C.comp:C.blue}>{entrenamientoHoyR.tipo}</Tag>
                  </div>
                  <div style={{fontSize:24,fontWeight:800,color:C.white,margin:"7px 0",letterSpacing:-0.4}}>{entrenamientoHoyR.detalle||entrenamientoHoyR.tipo}</div>
                  {entrenamientoHoyR.comentario&&<div style={{fontSize:13,color:C.white,marginBottom:11,lineHeight:1.6,background:(esCompHoyR?"rgba(255,107,92,0.1)":"rgba(33,70,208,0.1)"),borderRadius:"0 12px 12px 0",borderLeft:`3px solid ${esCompHoyR?C.comp:C.blue}`,padding:"9px 12px"}}>{entrenamientoHoyR.comentario}</div>}
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>setDiaDetalle({...entrenamientoHoyR,planKey:"plan"})} style={{flex:1,padding:"11px",background:"rgba(255,255,255,0.06)",color:C.white,border:"1px solid rgba(255,255,255,0.1)",borderRadius:13,fontFamily:"inherit",fontWeight:600,fontSize:12,cursor:"pointer"}}>Ver detalle</button>
                    <button onClick={()=>marcarDia(entrenamientoHoyR.id,entrenamientoHoyR.completado,"plan")} style={{flex:2,padding:"11px",background:entrenamientoHoyR.completado?C.mutedDim:`linear-gradient(135deg,${esCompHoyR?C.comp:"#3a5fe0"},${esCompHoyR?"#c8281a":"#1530a0"})`,color:C.white,border:"none",borderRadius:13,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer"}}>{entrenamientoHoyR.completado?"✓ Completado":"Marcar completado"}</button>
                  </div>
                </div>
              )}
              {esGymYRunning&&entrenamientoHoyG&&entrenamientoHoyG.tipo!=="Descanso"&&(
                <div className={esCompHoyG?"card-glass glow-comp":"card-glass"} style={{background:esCompHoyG?"rgba(255,107,92,0.07)":"rgba(255,255,255,0.04)",border:`1px solid ${esCompHoyG?"rgba(255,107,92,0.35)":"rgba(232,154,26,0.35)"}`,borderRadius:20,padding:"17px",marginBottom:9}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:11}}>
                    <div style={{width:28,height:28,borderRadius:9,background:(esCompHoyG?C.comp:C.amber)+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {iconoPorTipoYColeccion(entrenamientoHoyG.tipo,true,esCompHoyG?C.comp:C.amber,15)}
                    </div>
                    <span style={{fontSize:11,color:esCompHoyG?"#ff9d91":C.amber,letterSpacing:1,fontWeight:700}}>{esCompHoyG?"COMPETENCIA":"GYM"}</span>
                    <Tag color={esCompHoyG?C.comp:C.amber}>{entrenamientoHoyG.tipo}</Tag>
                  </div>
                  <div style={{fontSize:24,fontWeight:800,color:C.white,margin:"7px 0",letterSpacing:-0.4}}>{entrenamientoHoyG.detalle||entrenamientoHoyG.tipo}</div>
                  {entrenamientoHoyG.comentario&&<div style={{fontSize:13,color:C.white,marginBottom:11,lineHeight:1.6,background:(esCompHoyG?"rgba(255,107,92,0.1)":"rgba(232,154,26,0.1)"),borderRadius:"0 12px 12px 0",borderLeft:`3px solid ${esCompHoyG?C.comp:C.amber}`,padding:"9px 12px"}}>{entrenamientoHoyG.comentario}</div>}
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>setDiaDetalle({...entrenamientoHoyG,planKey:"planGym"})} style={{flex:1,padding:"11px",background:"rgba(255,255,255,0.06)",color:C.white,border:"1px solid rgba(255,255,255,0.1)",borderRadius:13,fontFamily:"inherit",fontWeight:600,fontSize:12,cursor:"pointer"}}>Ver detalle</button>
                    <button onClick={()=>marcarDia(entrenamientoHoyG.id,entrenamientoHoyG.completado,"planGym")} style={{flex:2,padding:"11px",background:entrenamientoHoyG.completado?C.mutedDim:`linear-gradient(135deg,${esCompHoyG?C.comp:C.amber},${esCompHoyG?"#c8281a":"#a86c0e"})`,color:C.white,border:"none",borderRadius:13,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer"}}>{entrenamientoHoyG.completado?"✓ Completado":"Marcar completado"}</button>
                  </div>
                </div>
              )}
              {planRunning.length>0&&(
                (!entrenamientoHoyR||entrenamientoHoyR.tipo==="Descanso")&&
                (!esGymYRunning||!entrenamientoHoyG||entrenamientoHoyG.tipo==="Descanso")
              )&&(
                <div style={{textAlign:"center",padding:"28px 18px",background:"rgba(255,255,255,0.02)",borderRadius:18,border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:28,marginBottom:8}}>💤</div>
                  <div style={{fontWeight:800,fontSize:15,color:C.white,marginBottom:5}}>Hoy no tenés actividad planificada</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>Aprovechá para recuperarte. El descanso también es entrenamiento.</div>
                </div>
              )}
            </div>
          )}

          {tab==="semana"&&(
            <div>
              {esGymYRunning&&(
                <div style={{padding:"10px 14px 0"}}>
                  <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:13,padding:3,marginBottom:7}}>
                    {[["running","🏃 RUNNING"],["gym","🏋️ GYM"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setPlanSubTab(k)} style={{flex:1,padding:"8px",border:"none",borderRadius:10,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer",background:planSubTab===k?(k==="gym"?"linear-gradient(135deg,#e89a1a,#a86c0e)":"linear-gradient(135deg,#3a5fe0,#1530a0)"):"transparent",color:planSubTab===k?C.white:"rgba(255,255,255,0.45)",transition:"all .2s"}}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              {planActivo.length===0&&<div style={{padding:18,textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:13}}>Tu entrenador aún no cargó el plan.</div>}
              {planActivo.map((d,i)=>{
                const esComp=d.tipo==="Competencia";
                const colorDia=esComp?C.comp:(planSubTab==="gym"?C.amber:C.blue);
                return(
                <div key={d.id}>
                  <div style={{display:"flex",alignItems:"center",gap:9,padding:"11px 14px",opacity:d.tipo==="Descanso"?.4:1,background:esComp?"rgba(255,107,92,0.06)":"transparent"}}>
                    <div style={{width:26,fontSize:10,fontWeight:700,color:d.completado?C.green:esComp?"#ff9d91":"rgba(255,255,255,0.4)"}}>{d.dia}</div>
                    <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:d.completado?C.green:d.tipo==="Descanso"?"rgba(255,255,255,0.15)":colorDia,boxShadow:esComp?`0 0 6px ${C.comp}`:"none"}}/>
                    <div style={{flex:1,cursor:d.tipo!=="Descanso"?"pointer":"default"}} onClick={()=>d.tipo!=="Descanso"&&setDiaDetalle({...d,planKey:colActiva})}>
                      <div style={{fontSize:13,fontWeight:esComp?700:600,color:d.completado?"rgba(255,255,255,0.45)":esComp?"#ff9d91":C.white}}>{esComp?`Competencia · ${d.detalle||""}`:d.tipo}</div>
                      {!esComp&&d.detalle&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{d.detalle}</div>}
                    </div>
                    {d.completado
                      ?<span style={{color:C.green,fontSize:13}}>✓</span>
                      :d.tipo!=="Descanso"&&(
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>setDiaDetalle({...d,planKey:colActiva})} style={{padding:"4px 9px",fontSize:10,fontFamily:"inherit",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.5)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,cursor:"pointer"}}>+</button>
                          <button onClick={()=>marcarDia(d.id,d.completado,colActiva)} style={{padding:"4px 9px",fontSize:10,fontFamily:"inherit",background:colorDia+"22",color:colorDia,border:`1px solid ${colorDia}44`,borderRadius:8,cursor:"pointer",fontWeight:700}}>OK</button>
                        </div>
                      )
                    }
                  </div>
                  {i<planActivo.length-1&&<Divider/>}
                </div>
              );})}
            </div>
          )}

          {tab==="resumen"&&(
            <div style={{padding:14}}>
              <div style={{fontSize:11,color:"#7d9bff",letterSpacing:1,marginBottom:11,fontWeight:700}}>RESUMEN SEMANAL</div>
              <div className="card-glass" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"16px",marginBottom:12,textAlign:"center"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:6,fontWeight:600}}>ADHERENCIA AL PLAN</div>
                <div style={{fontSize:50,fontWeight:800,color:porcentaje>=80?C.green:porcentaje>=60?C.amber:C.red,lineHeight:1}}>{porcentaje}%</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:5}}>{completadosEntren} de {totalEntren} entrenamientos</div>
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:9,fontWeight:600}}>ENTRENAMIENTOS DE LA SEMANA</div>
              {planActivo.filter(d=>d.tipo!=="Descanso").map((d,i)=>{
                const esComp=d.tipo==="Competencia";
                return(
                <div key={d.id||i} onClick={()=>setDiaDetalle({...d,planKey:colActiva})} style={{display:"flex",alignItems:"center",gap:9,padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"pointer",background:esComp?"rgba(255,107,92,0.05)":"transparent",borderRadius:esComp?10:0}}>
                  <div style={{width:26,fontSize:10,fontWeight:700,color:d.completado?C.green:esComp?"#ff9d91":"rgba(255,255,255,0.4)"}}>{d.dia}</div>
                  <div style={{width:6,height:6,borderRadius:"50%",background:d.completado?C.green:esComp?C.comp:C.blue,flexShrink:0}}/>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:esComp?700:600,color:d.completado?"rgba(255,255,255,0.45)":esComp?"#ff9d91":C.white}}>{d.tipo}</div>{d.detalle&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{d.detalle}</div>}</div>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    {d.completado&&<span style={{color:C.green,fontSize:13}}>✓</span>}
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>›</span>
                  </div>
                </div>
              );})}
            </div>
          )}

          {tab==="ciclo"&&generoFinal==="F"&&(
            <div style={{padding:14}}>
              <div style={{fontSize:11,color:C.pink,letterSpacing:1,marginBottom:11,fontWeight:700}}>MI CICLO</div>
              {ci?(
                <div style={{background:"rgba(224,68,154,0.06)",border:"1px solid rgba(224,68,154,0.2)",borderRadius:18,padding:"16px",marginBottom:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:11}}>
                    {[
                      {label:"FASE",value:ci.fase,color:{"Menstruación":C.pink,"Folicular":C.blue,"Ovulación":C.green,"Lútea":C.amber}[ci.fase]||C.muted},
                      {label:"DÍA DEL CICLO",value:`${ci.diaEnCiclo} / ${ci.durCiclo}`,color:C.white},
                      {label:"PRÓXIMO PERÍODO",value:`En ${ci.diasHastaProxima}d`,color:ci.diasHastaProxima<=3?C.pink:C.muted},
                      {label:"OVULACIÓN EST.",value:(()=>{const d=14-ci.diaEnCiclo;return d>0?`En ~${d}d`:"Esta semana";})(),color:C.green},
                      {label:"DURACIÓN CICLO",value:`${ci.durCiclo} días`,color:C.white},
                      {label:"DURACIÓN PERÍODO",value:`${ci.durMens} días`,color:C.white},
                    ].map(item=>(
                      <div key={item.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 12px"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:0.5,marginBottom:3,fontWeight:600}}>{item.label}</div><div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div></div>
                    ))}
                  </div>
                  <div style={{padding:"11px 13px",background:"rgba(255,255,255,0.04)",borderRadius:12,marginBottom:9}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginBottom:4,fontWeight:600}}>RECOMENDACIÓN</div>
                    <div style={{fontSize:13,color:C.white,lineHeight:1.6}}>{ci.fase==="Menstruación"?"Priorizá el descanso. Movilidad suave, sin cargas intensas los primeros 2 días.":ci.fase==="Folicular"?"Fase de alta energía. Ideal para intervalos y fuerza.":ci.fase==="Ovulación"?"Pico de rendimiento. Aprovechá para tus mejores sesiones.":"Energía más baja. Mantené el volumen pero bajá la intensidad."}</div>
                  </div>
                  <CicloCalendario ci={ci} ciclo={perfil.ciclo}/>
                </div>
              ):(
                <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,textAlign:"center",padding:"14px 0 18px"}}>Aún no cargaste los datos de tu ciclo.</div>
              )}
              <CicloAlumnaForm uid={user.uid} cicloActual={perfil.ciclo} onGuardado={data=>{setPerfil(prev=>({...prev,ciclo:data}));}}/>
            </div>
          )}

          {tab==="perfil"&&(
            <div style={{padding:14}}>
              {[{label:"PLAN",value:perfil.tipo||"—"},{label:"GÉNERO",value:generoFinal==="F"?"Femenino":generoFinal==="M"?"Masculino":"Sin especificar"},{label:"EDAD",value:perfil.edad?`${perfil.edad} años`:"—"},{label:"OBJETIVO",value:perfil.objetivo||"—"},{label:"PESO",value:perfil.peso?`${perfil.peso} kg`:"—"},{label:"MEJOR 5K",value:perfil.marcas?.cinco||"—"},{label:"MEJOR 10K",value:perfil.marcas?.diez||"—"},{label:"MEJOR 21K",value:perfil.marcas?.media||"—"},{label:"MEJOR 42K",value:perfil.marcas?.maraton||"—"}].map(item=>(
                <div key={item.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:0.5}}>{item.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.white}}>{item.value}</span>
                </div>
              ))}
              <button onClick={()=>setEditOpen(!editOpen)} style={{width:"100%",marginTop:12,padding:"11px",background:editOpen?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:`1px solid ${editOpen?"rgba(255,255,255,0.1)":"transparent"}`,borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer"}}>{editOpen?"Cancelar":"Editar mi perfil"}</button>
              {editOpen&&(
                <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
                  <div><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5}}>GÉNERO</div><select value={genero} onChange={e=>setGenero(e.target.value)} style={inp}><option value="">Sin especificar</option><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
                  {[{label:"EDAD",value:edad,set:setEdad,placeholder:"25",type:"number"},{label:"OBJETIVO",value:objetivo,set:setObjetivo,placeholder:"Tu objetivo"},{label:"PESO (kg)",value:peso,set:setPeso,placeholder:"72",type:"number"},{label:"MEJOR 5K",value:cinco,set:setCinco,placeholder:"23:10"},{label:"MEJOR 10K",value:diez,set:setDiez,placeholder:"48:32"},{label:"MEJOR 21K",value:media,set:setMedia,placeholder:"1:52:14"},{label:"MEJOR 42K",value:maraton,set:setMaraton,placeholder:"3:45:00"}].map(f=>(
                    <div key={f.label}><div style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:0.5}}>{f.label}</div><input type={f.type||"text"} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp}/></div>
                  ))}
                  <button onClick={guardarPerfil} style={{padding:"11px",background:editOk?C.green:"linear-gradient(135deg,#3a5fe0,#1530a0)",color:C.white,border:"none",borderRadius:14,fontFamily:"inherit",fontWeight:700,fontSize:11,cursor:"pointer",transition:"background .3s"}}>{editOk?"✓ Guardado":"Guardar"}</button>
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
