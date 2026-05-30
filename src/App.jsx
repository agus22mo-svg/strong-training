import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, query, orderBy, serverTimestamp } from "firebase/firestore";

const C = {
  bg:"#0B0B0D",surface:"#111116",card:"#16161E",cardHover:"#1C1C26",
  border:"#242430",borderHi:"#2E2E42",
  blue:"#2146D0",blueBright:"#3A5FE8",blueGlow:"#2146D044",blueDim:"#111827",
  white:"#F5F5F5",muted:"#7A7F86",mutedDim:"#3B3D42",
  green:"#22C97A",red:"#E03C3C",amber:"#E89A1A",
  pink:"#E0449A",pinkDim:"#2A1020",
};

const TopoBg = ({opacity=0.07}) => (
  <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",opacity,pointerEvents:"none",zIndex:0}} viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice">
    <defs><filter id="bl"><feGaussianBlur stdDeviation="1"/></filter></defs>
    <g fill="none" stroke={C.blue} strokeWidth="0.8" filter="url(#bl)">
      {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i=><ellipse key={i} cx="400" cy="600" rx={80+i*55} ry={50+i*80} transform={`rotate(${i*7} 400 600)`} opacity={1-i*0.06}/>)}
    </g>
  </svg>
);
const Slashes = ({color=C.blue,size=12}) => <span style={{color,fontSize:size,fontWeight:900,letterSpacing:-1}}>///</span>;
const Tag = ({children,color=C.blue}) => <span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:3,padding:"2px 7px",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{children}</span>;
const Bar = ({value,color=C.blue,height=3}) => <div style={{background:C.border,borderRadius:2,height,width:"100%",overflow:"hidden"}}><div style={{width:`${value}%`,height:"100%",background:color,transition:"width .5s ease"}}/></div>;
const Divider = () => <div style={{height:1,background:C.border}}/>;
const Spinner = () => <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh"}}><div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.blue}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>;

function cicloInfo(ciclo) {
  if (!ciclo?.ultimaMenstruacion) return null;
  const hoy = new Date();
  const [y,m,d] = ciclo.ultimaMenstruacion.split("-").map(Number);
  const ultima = new Date(y,m-1,d);
  const diasDesde = Math.floor((hoy-ultima)/(1000*60*60*24));
  const durCiclo = ciclo.duracionCiclo||28;
  const durMens = ciclo.duracionMenstruacion||5;
  const diaEnCiclo = (diasDesde%durCiclo)+1;
  const diasHastaProxima = durCiclo-(diasDesde%durCiclo);
  const enMenstruacion = diaEnCiclo<=durMens;
  const alertaProxima = !enMenstruacion&&diasHastaProxima<=3;
  let fase="";
  if(diaEnCiclo<=durMens) fase="Menstruación";
  else if(diaEnCiclo<=13) fase="Folicular";
  else if(diaEnCiclo<=16) fase="Ovulación";
  else fase="Lútea";
  return {diaEnCiclo,diasHastaProxima,enMenstruacion,alertaProxima,fase,durCiclo,durMens};
}
function planStatus(dias){const d=parseInt(dias)||0;if(d<=0)return{label:"VENCIDO",color:C.red,urgente:true};if(d<=3)return{label:`VENCE EN ${d}d`,color:C.amber,urgente:true};return{label:`${d}d restantes`,color:C.muted,urgente:false};}
function payStatus(pagado,diasVencido){if(pagado)return{label:"AL DÍA",color:C.green};if(!diasVencido)return{label:"PENDIENTE",color:C.amber};return{label:`DEBE ${diasVencido}d`,color:C.red};}

function SplashScreen({onDone}){
  const [phase,setPhase]=useState(0);
  useEffect(()=>{const t1=setTimeout(()=>setPhase(1),700),t2=setTimeout(()=>setPhase(2),1400),t3=setTimeout(()=>setPhase(3),2200),t4=setTimeout(()=>onDone(),2900);return()=>[t1,t2,t3,t4].forEach(clearTimeout);},[onDone]);
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
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState(""),[pass,setPass]=useState(""),[nombre,setNombre]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const inp={width:"100%",padding:"12px 14px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

  const handleLogin=async()=>{
    setError("");setLoading(true);
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
      await setDoc(doc(db,"usuarios",cred.user.uid),{nombre:nombre.trim(),email:email.toLowerCase(),role:"alumno",estado:"pendiente",genero:"",tipo:"",objetivo:"",peso:"",marcas:{cinco:"—",diez:"—",media:"—",maraton:"—"},ciclo:null,creadoEn:serverTimestamp()});
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
          <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>Tu cuenta fue creada. El entrenador va a revisar tu solicitud y te dará acceso en breve.</div>
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

function AdminView(){
  const [alumnos,setAlumnos]=useState([]);
  const [solicitudes,setSolicitudes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("alumnos");
  const [alumnoSel,setAlumnoSel]=useState(null);

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

  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:3}}>PANEL DE CONTROL</div><Slashes/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[{label:"ACTIVOS",value:alumnos.length,color:C.white},{label:"SOLICITUDES",value:solicitudes.length,color:solicitudes.length>0?C.amber:C.muted},{label:"AL DÍA",value:alumnos.filter(a=>a.pagado).length,color:C.green},{label:"PLANES URGENTES",value:alumnos.filter(a=>planStatus(a.planDias).urgente).length,color:C.amber}].map(s=>(
          <div key={s.label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:8,color:C.muted,letterSpacing:2,marginBottom:5}}>{s.label}</div>
            <div style={{fontSize:24,fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
          </div>
        ))}
      </div>
      {solicitudes.map(s=>(
        <div key={s.uid} style={{display:"flex",alignItems:"center",gap:12,background:`${C.amber}12`,border:`1px solid ${C.amber}44`,borderRadius:8,padding:"10px 14px",marginBottom:6}}>
          <span>🔔</span>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:C.white}}>{s.nombre}</div><div style={{fontSize:10,color:C.muted}}>{s.email}</div></div>
          <button onClick={()=>aprobar(s.uid)} style={{padding:"5px 12px",background:C.green,color:C.bg,border:"none",borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>APROBAR</button>
          <button onClick={()=>rechazar(s.uid)} style={{padding:"5px 12px",background:"none",color:C.red,border:`1px solid ${C.red}44`,borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>RECHAZAR</button>
        </div>
      ))}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
        {["alumnos","cobros"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 16px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${C.blue}`:"2px solid transparent",color:tab===t?C.blue:C.muted,fontFamily:"inherit",fontWeight:700,fontSize:9,letterSpacing:2,cursor:"pointer",textTransform:"uppercase"}}>{t}</button>
        ))}
      </div>
      {tab==="alumnos"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px"}}>
          <div style={{padding:"8px 16px"}}><span style={{fontSize:9,color:C.muted,letterSpacing:2}}>ALUMNOS ACTIVOS</span></div><Divider/>
          {alumnos.length===0&&<div style={{padding:24,textAlign:"center",color:C.muted,fontSize:12}}>No hay alumnos activos todavía.</div>}
          {alumnos.map((a,i)=>{
            const ps=planStatus(a.planDias),pg=payStatus(a.pagado,a.diasVencido);
            const ci=a.ciclo?cicloInfo(a.ciclo):null,cicloAlerta=ci&&(ci.alertaProxima||(ci.enMenstruacion&&ci.diaEnCiclo<=2));
            return(<div key={a.uid}><div onClick={()=>setAlumnoSel(a)} style={{padding:"11px 16px",cursor:"pointer",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.cardHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{position:"relative"}}><div style={{width:34,height:34,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:C.white}}>{(a.nombre||"?")[0]}</div>{cicloAlerta&&<div style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:C.pink,border:`2px solid ${C.card}`}}/>}</div>
                <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,fontSize:13,color:C.white}}>{a.nombre}</span>{a.genero==="F"&&<span style={{fontSize:9,color:C.pink}}>♀</span>}</div><div style={{fontSize:9,color:C.muted}}>{a.tipo||"Sin plan"}</div></div>
                <div style={{textAlign:"right",minWidth:80}}><div style={{fontSize:9,color:ps.color,fontWeight:700}}>{ps.label}</div><div style={{fontSize:8,color:C.muted}}>PLAN</div></div>
                <div style={{width:26,height:26,borderRadius:"50%",background:pg.color+"20",border:`1px solid ${pg.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:pg.color}}>{a.pagado?"✓":"!"}</div>
              </div>
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}><Bar value={a.progreso||0} color={(a.progreso||0)>75?C.green:(a.progreso||0)>50?C.blue:C.amber}/><span style={{fontSize:9,color:C.muted,minWidth:24}}>{a.progreso||0}%</span></div>
            </div>{i<alumnos.length-1&&<Divider/>}</div>);
          })}
        </div>
      )}
      {tab==="cobros"&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px"}}>
          <div style={{padding:"8px 16px"}}><span style={{fontSize:9,color:C.muted,letterSpacing:2}}>COBROS</span></div><Divider/>
          {alumnos.map((a,i)=>{const pg=payStatus(a.pagado,a.diasVencido);return(
            <div key={a.uid}><div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px"}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:a.pagado?C.green+"22":C.red+"22",border:`1px solid ${a.pagado?C.green:C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:a.pagado?C.green:C.red}}>{a.pagado?"✓":"!"}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:C.white}}>{a.nombre}</div><div style={{fontSize:9,color:C.muted}}>{a.tipo}</div></div>
              <div style={{fontWeight:700,fontSize:12,color:pg.color}}>{pg.label}</div>
              <button onClick={async()=>{await updateDoc(doc(db,"usuarios",a.uid),{pagado:!a.pagado});cargar();}} style={{padding:"5px 10px",background:a.pagado?C.surface:C.blue,color:C.white,border:`1px solid ${C.border}`,borderRadius:5,fontFamily:"inherit",fontWeight:700,fontSize:9,cursor:"pointer"}}>{a.pagado?"REVERTIR":"COBRADO"}</button>
            </div>{i<alumnos.length-1&&<Divider/>}</div>
          );})}
        </div>
      )}
      {alumnoSel&&<AlumnoModal alumno={alumnoSel} onClose={()=>{setAlumnoSel(null);cargar();}}/>}
    </div>
  );
}

function AlumnoModal({alumno,onClose}){
  const [tab,setTab]=useState("perfil");
  const [nota,setNota]=useState("");
  const [guardado,setGuardado]=useState(false);
  const [kmData,setKmData]=useState([]);
  const [plan,setPlan]=useState([]);
  const [tipo,setTipo]=useState(alumno.tipo||"");
  const [planDias,setPlanDias]=useState(alumno.planDias||"");
  const [pagado,setPagado]=useState(alumno.pagado||false);
  const [progreso,setProgreso]=useState(alumno.progreso||0);
  const [editOk,setEditOk]=useState(false);
  const ps=planStatus(alumno.planDias),pg=payStatus(alumno.pagado,alumno.diasVencido);
  const ci=alumno.ciclo?cicloInfo(alumno.ciclo):null;
  const tabs=alumno.genero==="F"?["perfil","plan","ciclo","pagos","notas","km"]:["perfil","plan","pagos","notas","km"];

  useEffect(()=>{
    getDoc(doc(db,"notas",alumno.uid)).then(s=>{if(s.exists())setNota(s.data().texto||"");});
    getDocs(query(collection(db,"usuarios",alumno.uid,"kilometraje"),orderBy("semana"))).then(s=>setKmData(s.docs.map(d=>d.data())));
    getDocs(query(collection(db,"usuarios",alumno.uid,"plan"),orderBy("orden"))).then(s=>setPlan(s.docs.map(d=>({id:d.id,...d.data()}))));
  },[alumno.uid]);

  const guardarNota=async()=>{await setDoc(doc(db,"notas",alumno.uid),{texto:nota,actualizadoEn:serverTimestamp()});setGuardado(true);setTimeout(()=>setGuardado(false),2000);};
  const guardarPerfil=async()=>{await updateDoc(doc(db,"usuarios",alumno.uid),{tipo,planDias:parseInt(planDias)||0,pagado,progreso:parseInt(progreso)||0});setEditOk(true);setTimeout(()=>setEditOk(false),2000);};

  const agregarKm=async(nueva)=>{
    await addDoc(collection(db,"usuarios",alumno.uid,"kilometraje"),{semana:nueva.semana,km:parseInt(nueva.km),tipo:nueva.tipo});
    getDocs(query(collection(db,"usuarios",alumno.uid,"kilometraje"),orderBy("semana"))).then(s=>setKmData(s.docs.map(d=>d.data())));
  };

  const inp={width:"100%",padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const sel={...inp};
  const faseColor={"Menstruación":C.pink,"Folicular":C.blue,"Ovulación":C.green,"Lútea":C.amber};

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:"#000000cc",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,width:460,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:C.white}}>{(alumno.nombre||"?")[0]}</div>
          <div style={{flex:1}}><div style={{fontWeight:900,fontSize:14,color:C.white}}>{alumno.nombre}</div><div style={{display:"flex",gap:6}}>{alumno.tipo&&<Tag color={C.blue}>{alumno.tipo}</Tag>}{alumno.genero==="F"&&<Tag color={C.pink}>♀</Tag>}</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
          {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"8px 12px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${t==="ciclo"?C.pink:C.blue}`:"2px solid transparent",color:tab===t?(t==="ciclo"?C.pink:C.blue):C.muted,fontFamily:"inherit",fontWeight:700,fontSize:9,letterSpacing:1.5,cursor:"pointer",textTransform:"uppercase"}}>{t==="ciclo"?"CICLO ♀":t.toUpperCase()}</button>)}
        </div>
        <div style={{overflowY:"auto",flex:1,padding:16}}>
          {tab==="perfil"&&(
            <div>
              {[{label:"EMAIL",value:alumno.email},{label:"OBJETIVO",value:alumno.objetivo||"—"},{label:"PESO",value:alumno.peso?`${alumno.peso} kg`:"—"},{label:"MEJOR 5K",value:alumno.marcas?.cinco||"—"},{label:"MEJOR 10K",value:alumno.marcas?.diez||"—"},{label:"MEJOR 21K",value:alumno.marcas?.media||"—"},{label:"MEJOR 42K",value:alumno.marcas?.maraton||"—"}].map(item=>(
                <div key={item.label} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:9,color:C.muted,letterSpacing:1.5}}>{item.label}</span><span style={{fontSize:12,fontWeight:700,color:C.white}}>{item.value}</span></div>
              ))}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginTop:12}}>
                <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:10}}>EDITAR DATOS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:8,color:C.muted,marginBottom:4}}>TIPO</div><select value={tipo} onChange={e=>setTipo(e.target.value)} style={sel}><option value="">Sin asignar</option><option value="Solo Running">Solo Running</option><option value="Running + Gym">Running + Gym</option></select></div>
                  <div><div style={{fontSize:8,color:C.muted,marginBottom:4}}>DÍAS PLAN</div><input type="number" value={planDias} onChange={e=>setPlanDias(e.target.value)} style={inp} min="0" max="15"/></div>
                  <div><div style={{fontSize:8,color:C.muted,marginBottom:4}}>PROGRESO %</div><input type="number" value={progreso} onChange={e=>setProgreso(e.target.value)} style={inp} min="0" max="100"/></div>
                  <div><div style={{fontSize:8,color:C.muted,marginBottom:4}}>PAGO</div><select value={pagado?"si":"no"} onChange={e=>setPagado(e.target.value==="si")} style={sel}><option value="si">AL DÍA</option><option value="no">PENDIENTE</option></select></div>
                </div>
                <button onClick={guardarPerfil} style={{width:"100%",marginTop:10,padding:"9px",background:editOk?C.green:C.blue,color:C.white,border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:1,cursor:"pointer",transition:"background .3s"}}>{editOk?"✓ GUARDADO":"GUARDAR CAMBIOS"}</button>
              </div>
            </div>
          )}
          {tab==="plan"&&(
            <div>
              <div style={{background:ps.urgente?`${C.amber}12`:C.card,border:`1px solid ${ps.urgente?C.amber+"44":C.border}`,borderRadius:8,padding:"11px 13px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:9,color:C.muted,letterSpacing:1}}>PLAN ACTUAL</div><div style={{fontWeight:700,color:ps.color,marginTop:3}}>{ps.label}</div></div>
              </div>
              {plan.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:16}}>Sin plan cargado.</div>}
              {plan.map((d,i)=>(
                <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`,opacity:d.tipo==="Descanso"?.45:1}}>
                  <div style={{width:26,fontSize:9,fontWeight:700,color:d.completado?C.green:C.muted}}>{d.dia}</div>
                  <div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:d.completado?C.green:d.tipo==="Descanso"?C.border:C.blue}}/>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:d.completado?C.muted:C.white}}>{d.tipo}</div>{d.detalle&&<div style={{fontSize:9,color:C.muted}}>{d.detalle}</div>}</div>
                  {d.completado&&<span style={{color:C.green,fontSize:11}}>✓</span>}
                </div>
              ))}
            </div>
          )}
          {tab==="ciclo"&&alumno.genero==="F"&&ci&&(
            <div>
              {ci.enMenstruacion&&ci.diaEnCiclo<=2&&<div style={{background:C.pink+"15",border:`1px solid ${C.pink}44`,borderRadius:8,padding:"10px 14px",marginBottom:10,display:"flex",gap:10,alignItems:"center"}}><span>⚠️</span><div><div style={{fontSize:11,color:C.pink,fontWeight:700}}>DÍA {ci.diaEnCiclo} — NO ENTRENAR</div><div style={{fontSize:10,color:C.muted}}>Descanso activo recomendado.</div></div></div>}
              {ci.alertaProxima&&<div style={{background:C.amber+"12",border:`1px solid ${C.amber}44`,borderRadius:8,padding:"10px 14px",marginBottom:10,display:"flex",gap:10,alignItems:"center"}}><span>🗓️</span><div><div style={{fontSize:11,color:C.amber,fontWeight:700}}>MENSTRUACIÓN EN {ci.diasHastaProxima}D</div><div style={{fontSize:10,color:C.muted}}>Prever días de menor carga.</div></div></div>}
              <div style={{background:C.pinkDim,border:`1px solid ${C.pink}33`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:C.pink,letterSpacing:2,fontWeight:700,marginBottom:10}}>// CICLO MENSTRUAL</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{label:"FASE",value:ci.fase,color:faseColor[ci.fase]||C.muted},{label:"DÍA",value:`${ci.diaEnCiclo}/${ci.durCiclo}`,color:C.white},{label:"PRÓXIMA",value:`${ci.diasHastaProxima}d`,color:ci.diasHastaProxima<=3?C.pink:C.muted},{label:"ESTADO",value:ci.enMenstruacion?"En curso":"Activo",color:ci.enMenstruacion?C.pink:C.green}].map(item=>(
                    <div key={item.label} style={{background:C.card,borderRadius:7,padding:"9px 11px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>{item.label}</div><div style={{fontSize:12,fontWeight:700,color:item.color}}>{item.value}</div></div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab==="pagos"&&<HistorialPagos uid={alumno.uid} pg={pg}/>}
          {tab==="notas"&&(
            <div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>NOTAS PRIVADAS</div>
              <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Lesiones, contexto, observaciones..." style={{width:"100%",minHeight:150,padding:"11px 13px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:12,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.6}} onFocus={e=>e.target.style.border=`1px solid ${C.blue}`} onBlur={e=>e.target.style.border=`1px solid ${C.border}`}/>
              <button onClick={guardarNota} style={{width:"100%",marginTop:8,padding:"9px",background:guardado?C.green:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:700,fontSize:10,letterSpacing:2,cursor:"pointer",transition:"background .3s"}}>{guardado?"✓ GUARDADO":"GUARDAR NOTA"}</button>
            </div>
          )}
          {tab==="km"&&<KmChartAdmin data={kmData} uid={alumno.uid} onAgregar={agregarKm}/>}
        </div>
      </div>
    </div>
  );
}

function HistorialPagos({uid,pg}){
  const [pagos,setPagos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [mes,setMes]=useState(""),[monto,setMonto]=useState("");
  const cargar=async()=>{const snap=await getDocs(query(collection(db,"usuarios",uid,"pagos"),orderBy("creadoEn","desc")));setPagos(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);};
  useEffect(()=>{cargar();},[uid]);
  const registrar=async()=>{if(!mes||!monto)return;await addDoc(collection(db,"usuarios",uid,"pagos"),{mes,monto:parseInt(monto),fecha:new Date().toLocaleDateString("es-AR"),estado:"Pagado",creadoEn:serverTimestamp()});setMes("");setMonto("");cargar();};
  if(loading)return <Spinner/>;
  return(
    <div>
      <div style={{background:pg.color+"12",border:`1px solid ${pg.color}33`,borderRadius:8,padding:"11px 13px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:9,color:C.muted,letterSpacing:1}}>ESTADO ACTUAL</div><div style={{fontWeight:900,fontSize:15,color:pg.color,marginTop:3}}>{pg.label}</div></div>
      </div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>REGISTRAR PAGO</div>
        <div style={{display:"flex",gap:8}}>
          <input value={mes} onChange={e=>setMes(e.target.value)} placeholder="Junio 2026" style={{flex:2,padding:"8px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
          <input type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="Monto" style={{flex:1,padding:"8px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={registrar} style={{padding:"8px 12px",background:C.blue,color:C.white,border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>+</button>
        </div>
      </div>
      {pagos.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12}}>Sin pagos registrados.</div>}
      {pagos.map(p=>(
        <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
          <div><div style={{fontSize:12,fontWeight:600,color:C.white}}>{p.mes}</div><div style={{fontSize:9,color:C.muted}}>{p.fecha}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:C.white}}>${(p.monto||0).toLocaleString()}</div><Tag color={C.green}>{p.estado}</Tag></div>
        </div>
      ))}
    </div>
  );
}

function KmChartAdmin({data,uid,onAgregar}){
  const [nueva,setNueva]=useState({semana:"",km:"",tipo:"carga"});
  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    const d=payload[0].payload;
    return(<div style={{background:C.card,border:`1px solid ${d.tipo==="carga"?C.blue:C.amber}44`,borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:9,color:C.muted}}>{label}</div><div style={{fontSize:20,fontWeight:900,color:d.tipo==="carga"?C.blue:C.amber}}>{d.km} km</div><Tag color={d.tipo==="carga"?C.blue:C.amber}>{d.tipo}</Tag></div>);
  };
  return(
    <div>
      <div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:12}}>// KILOMETRAJE SEMANAL</div>
      {data.length===0&&<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:12,marginBottom:12}}>Sin datos todavía.</div>}
      {data.length>0&&<ResponsiveContainer width="100%" height={160}><LineChart data={data} margin={{top:5,right:5,bottom:0,left:-20}}><CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/><XAxis dataKey="semana" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="km" stroke={C.blue} strokeWidth={2} dot={(props)=>{const{cx,cy,payload}=props;const col=payload.tipo==="carga"?C.blue:C.amber;return <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={4} fill={col} stroke={C.bg} strokeWidth={2}/>;}} /></LineChart></ResponsiveContainer>}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginTop:12}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:8}}>AGREGAR SEMANA</div>
        <div style={{display:"flex",gap:8}}>
          <input value={nueva.semana} onChange={e=>setNueva({...nueva,semana:e.target.value})} placeholder="S11" style={{flex:1,padding:"8px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
          <input type="number" value={nueva.km} onChange={e=>setNueva({...nueva,km:e.target.value})} placeholder="km" style={{flex:1,padding:"8px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
          <select value={nueva.tipo} onChange={e=>setNueva({...nueva,tipo:e.target.value})} style={{flex:1,padding:"8px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:11,fontFamily:"inherit",outline:"none"}}><option value="carga">Carga</option><option value="descarga">Descarga</option></select>
          <button onClick={()=>{if(!nueva.semana||!nueva.km)return;onAgregar(nueva);setNueva({semana:"",km:"",tipo:"carga"});}} style={{padding:"8px 12px",background:C.blue,color:C.white,border:"none",borderRadius:6,fontFamily:"inherit",fontWeight:700,fontSize:10,cursor:"pointer"}}>+</button>
        </div>
      </div>
    </div>
  );
}

function AlumnoView({user}){
  const [perfil,setPerfil]=useState(user);
  const [plan,setPlan]=useState([]);
  const [tab,setTab]=useState("hoy");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const cargar=async()=>{
      const snap=await getDoc(doc(db,"usuarios",user.uid));
      if(snap.exists())setPerfil({uid:user.uid,...snap.data()});
      const planSnap=await getDocs(query(collection(db,"usuarios",user.uid,"plan"),orderBy("orden")));
      setPlan(planSnap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    };
    cargar();
  },[user.uid]);

  const marcarDia=async(diaId,completado)=>{
    await updateDoc(doc(db,"usuarios",user.uid,"plan",diaId),{completado:!completado});
    setPlan(prev=>prev.map(d=>d.id===diaId?{...d,completado:!completado}:d));
  };

  if(loading)return <Spinner/>;

  const ci=perfil.ciclo?cicloInfo(perfil.ciclo):null;
  const completadosEntren=plan.filter(d=>d.completado&&d.tipo!=="Descanso").length;
  const totalEntren=plan.filter(d=>d.tipo!=="Descanso").length;
  const porcentaje=totalEntren>0?Math.round((completadosEntren/totalEntren)*100):0;
  const hoy=plan.find(d=>!d.completado&&d.tipo!=="Descanso");
  const ps=planStatus(perfil.planDias),pg=payStatus(perfil.pagado,perfil.diasVencido);
  const tabs=perfil.genero==="F"?["hoy","semana","resumen","ciclo","perfil"]:["hoy","semana","resumen","perfil"];

  const [objetivo,setObjetivo]=useState(perfil.objetivo||"");
  const [peso,setPeso]=useState(perfil.peso||"");
  const [cinco,setCinco]=useState(perfil.marcas?.cinco||"");
  const [diez,setDiez]=useState(perfil.marcas?.diez||"");
  const [media,setMedia]=useState(perfil.marcas?.media||"");
  const [maraton,setMaraton]=useState(perfil.marcas?.maraton||"");
  const [editOpen,setEditOpen]=useState(false);
  const [editOk,setEditOk]=useState(false);

  const guardarPerfil=async()=>{
    const updates={objetivo,peso,marcas:{cinco:cinco||"—",diez:diez||"—",media:media||"—",maraton:maraton||"—"}};
    await updateDoc(doc(db,"usuarios",user.uid),updates);
    setPerfil({...perfil,...updates});
    setEditOk(true);setTimeout(()=>{setEditOk(false);setEditOpen(false);},1500);
  };

  const inp={width:"100%",padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,color:C.white,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginTop:4};

  return(
    <div style={{maxWidth:430,margin:"0 auto",padding:"16px 14px",position:"relative",zIndex:1}}>
      {ci&&ci.enMenstruacion&&ci.diaEnCiclo<=2&&<div style={{background:C.pinkDim,border:`1px solid ${C.pink}44`,borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"center"}}><span>🌸</span><div><div style={{fontSize:11,color:C.pink,fontWeight:700}}>DÍA {ci.diaEnCiclo} — TU ENTRENADOR SUGIERE DESCANSO</div><div style={{fontSize:10,color:C.muted}}>Priorizá descanso o movilidad suave.</div></div></div>}
      <div style={{background:C.card,border:`1px solid ${C.borderHi}`,borderRadius:12,padding:"13px 15px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:C.blue,boxShadow:`0 0 14px ${C.blueGlow}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:C.white}}>{(perfil.nombre||"?")[0]}</div>
            <div><div style={{fontWeight:900,fontSize:13,color:C.white}}>{perfil.nombre}</div><div style={{fontSize:8,color:C.muted,marginTop:1,letterSpacing:1}}>{perfil.objetivo||"Sin objetivo"}</div></div>
          </div>
          <Slashes size={9}/>
        </div>
        <div style={{fontSize:8,color:C.muted,letterSpacing:2,marginBottom:4}}>PROGRESO DEL CICLO</div>
        <Bar value={perfil.progreso||0} color={C.blue} height={4}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{fontSize:8,color:C.muted}}>{perfil.tipo||"Sin plan"}</span>
          <span style={{fontSize:8,color:C.blue,fontWeight:700}}>{perfil.progreso||0}%</span>
        </div>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:12}}>
        {[{label:"DÍAS OK",value:`${plan.filter(d=>d.completado).length}/${plan.length}`,color:C.green},{label:"PLAN",value:ps.label,color:ps.color},{label:"PAGO",value:pg.label,color:pg.color}].map(s=>(
          <div key={s.label} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 6px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:900,color:s.color}}>{s.value}</div>
            <div style={{fontSize:7,color:C.muted,letterSpacing:1,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"8px 10px",background:"none",border:"none",borderBottom:tab===t?`2px solid ${t==="ciclo"?C.pink:C.blue}`:"2px solid transparent",color:tab===t?(t==="ciclo"?C.pink:C.blue):C.muted,fontFamily:"inherit",fontWeight:700,fontSize:8,letterSpacing:1,cursor:"pointer",textTransform:"uppercase"}}>{t==="ciclo"?"CICLO":t}</button>)}
      </div>
      {tab==="hoy"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:14}}><div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:10}}>// HOY</div>{!hoy?<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>🎉 ¡Semana completada!</div>:<div style={{background:C.surface,border:`1px solid ${C.blue}44`,borderRadius:10,padding:"15px 13px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><Tag color={C.blue}>{hoy.tipo}</Tag><span style={{fontSize:8,color:C.muted}}>{hoy.dia}</span></div><div style={{fontSize:22,fontWeight:900,color:C.white,margin:"9px 0"}}>{hoy.detalle||hoy.tipo}</div><button onClick={()=>marcarDia(hoy.id,hoy.completado)} style={{width:"100%",padding:"11px",background:C.blue,color:C.white,border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:900,fontSize:11,letterSpacing:2,cursor:"pointer",boxShadow:`0 4px 16px ${C.blueGlow}`}}>MARCAR COMO COMPLETADO</button></div>}</div>}
      {tab==="semana"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px"}}>{plan.length===0&&<div style={{padding:20,textAlign:"center",color:C.muted,fontSize:12}}>Tu entrenador aún no cargó el plan.</div>}{plan.map((d,i)=><div key={d.id}><div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 15px",opacity:d.tipo==="Descanso"?.4:1}}><div style={{width:26,fontSize:8,fontWeight:700,color:d.completado?C.green:C.muted}}>{d.dia}</div><div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:d.completado?C.green:d.tipo==="Descanso"?C.border:C.blue}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:d.completado?C.muted:C.white}}>{d.tipo}</div>{d.detalle&&<div style={{fontSize:9,color:C.muted}}>{d.detalle}</div>}</div>{d.completado?<span style={{color:C.green,fontSize:11}}>✓</span>:d.tipo!=="Descanso"&&<button onClick={()=>marcarDia(d.id,d.completado)} style={{padding:"3px 8px",fontSize:8,fontFamily:"inherit",background:C.blue+"22",color:C.blue,border:`1px solid ${C.blue}44`,borderRadius:4,cursor:"pointer",fontWeight:700}}>OK</button>}</div>{i<plan.length-1&&<Divider/>}</div>)}</div>}
      {tab==="resumen"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:14}}><div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:10}}>// RESUMEN SEMANAL</div><div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:10,padding:"14px",marginBottom:12,textAlign:"center"}}><div style={{fontSize:9,color:C.muted,letterSpacing:2,marginBottom:5}}>ADHERENCIA</div><div style={{fontSize:48,fontWeight:900,color:porcentaje>=80?C.green:porcentaje>=60?C.amber:C.red,lineHeight:1}}>{porcentaje}%</div><div style={{fontSize:10,color:C.muted,marginTop:5}}>{completadosEntren} de {totalEntren} entrenamientos</div></div></div>}
      {tab==="ciclo"&&perfil.genero==="F"&&ci&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:14}}><div style={{fontSize:9,color:C.pink,letterSpacing:3,marginBottom:10}}>// MI CICLO</div><div style={{background:C.pinkDim,border:`1px solid ${C.pink}33`,borderRadius:10,padding:"14px"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>{[{label:"FASE",value:ci.fase,color:{"Menstruación":C.pink,"Folicular":C.blue,"Ovulación":C.green,"Lútea":C.amber}[ci.fase]},{label:"DÍA",value:`Día ${ci.diaEnCiclo}`,color:C.white},{label:"PRÓXIMA",value:`En ${ci.diasHastaProxima}d`,color:ci.diasHastaProxima<=3?C.pink:C.muted},{label:"ESTADO",value:ci.enMenstruacion?"En curso":"Activo",color:ci.enMenstruacion?C.pink:C.green}].map(item=><div key={item.label} style={{background:C.card,borderRadius:7,padding:"9px 11px"}}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5,marginBottom:3}}>{item.label}</div><div style={{fontSize:12,fontWeight:700,color:item.color}}>{item.value}</div></div>)}</div></div></div>}
      {tab==="perfil"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:13}}>{[{label:"PLAN",value:perfil.tipo||"—"},{label:"OBJETIVO",value:perfil.objetivo||"—"},{label:"PESO",value:perfil.peso?`${perfil.peso} kg`:"—"},{label:"MEJOR 5K",value:perfil.marcas?.cinco||"—"},{label:"MEJOR 10K",value:perfil.marcas?.diez||"—"},{label:"MEJOR 21K",value:perfil.marcas?.media||"—"},{label:"MEJOR 42K",value:perfil.marcas?.maraton||"—"}].map(item=><div key={item.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:9,color:C.muted,letterSpacing:1}}>{item.label}</span><span style={{fontSize:12,fontWeight:700,color:C.white}}>{item.value}</span></div>)}<button onClick={()=>setEditOpen(!editOpen)} style={{width:"100%",marginTop:12,padding:"10px",background:editOpen?C.surface:C.blue,color:C.white,border:`1px solid ${C.border}`,borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:10,letterSpacing:2,cursor:"pointer"}}>{editOpen?"CANCELAR":"EDITAR MI PERFIL"}</button>{editOpen&&<div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>{[{label:"OBJETIVO",value:objetivo,set:setObjetivo,placeholder:"Tu objetivo"},{label:"PESO (kg)",value:peso,set:setPeso,placeholder:"72",type:"number"},{label:"MEJOR 5K",value:cinco,set:setCinco,placeholder:"23:10"},{label:"MEJOR 10K",value:diez,set:setDiez,placeholder:"48:32"},{label:"MEJOR 21K",value:media,set:setMedia,placeholder:"1:52:14"},{label:"MEJOR 42K",value:maraton,set:setMaraton,placeholder:"3:45:00"}].map(f=><div key={f.label}><div style={{fontSize:8,color:C.muted,letterSpacing:1.5}}>{f.label}</div><input type={f.type||"text"} value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder} style={inp} onFocus={e=>e.target.style.border=`1px solid ${C.blue}`} onBlur={e=>e.target.style.border=`1px solid ${C.border}`}/></div>)}<button onClick={guardarPerfil} style={{padding:"10px",background:editOk?C.green:C.blue,color:C.white,border:"none",borderRadius:7,fontFamily:"inherit",fontWeight:900,fontSize:10,letterSpacing:2,cursor:"pointer",transition:"background .3s"}}>{editOk?"✓ GUARDADO":"GUARDAR"}</button></div>}</div>}
    </div>
  );
}

export default function App(){
  const [screen,setScreen]=useState("splash");
  const [user,setUser]=useState(null);
  const handleLogout=async()=>{await signOut(auth);setUser(null);setScreen("login");};
  return(
    <div style={{fontFamily:"'Barlow Condensed','Arial Narrow',sans-serif",background:C.bg,minHeight:"100vh",color:C.white,overflowX:"hidden"}}>
      {screen==="splash"&&<SplashScreen onDone={()=>setScreen("login")}/>}
      {screen==="login"&&<AuthScreen onAuth={u=>{setUser(u);setScreen("app");}}/>}
      {screen==="app"&&user&&<><TopoBg/><TopBar user={user} onLogout={handleLogout}/>{user.role==="admin"?<AdminView/>:<AlumnoView user={user}/>}<div style={{textAlign:"center",padding:"16px 0 26px",position:"relative",zIndex:1,fontSize:7,color:C.mutedDim,letterSpacing:3}}>STRONG · SYSTEM IN MOTION · <Slashes size={7}/></div></>}
    </div>
  );
}
