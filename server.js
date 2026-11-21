const express = require("express");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, "data.json");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const initial = {
  settings: { college: "MIT Academy of Engineering, Alandi, Pune", threshold: 75,
    campus: { lat: 18.6775, lng: 73.8987 }, radius: 250 },
  users: [
    {id:"S001",name:"Aarav Patil",email:"aarav@mit.edu",password:"student123",role:"student",roll:"CSE-001",year:"Second Year"},
    {id:"S002",name:"Ananya Sharma",email:"ananya@mit.edu",password:"student123",role:"student",roll:"CSE-002",year:"Second Year"},
    {id:"T001",name:"Prof. Demo Teacher",email:"teacher@mit.edu",password:"teacher123",role:"teacher",department:"Computer Engineering"},
    {id:"A001",name:"College Admin",email:"admin@mit.edu",password:"admin123",role:"admin"}
  ],
  courses: [
    {id:"CSE201",name:"Data Structures",code:"CSE201",teacherId:"T001",teacher:"Prof. Demo Teacher",total:20,held:12,room:"A-204"},
    {id:"CSE202",name:"Database Management Systems",code:"CSE202",teacherId:"T001",teacher:"Prof. Demo Teacher",total:18,held:10,room:"A-205"},
    {id:"CSE203",name:"Applied Mathematics",code:"CSE203",teacherId:"T001",teacher:"Prof. Demo Teacher",total:22,held:17,room:"B-101"}
  ],
  attendance: [
    {id:"a1",studentId:"S001",courseId:"CSE201",status:"present",date:"2026-11-17"},
    {id:"a2",studentId:"S001",courseId:"CSE201",status:"present",date:"2026-11-18"},
    {id:"a3",studentId:"S001",courseId:"CSE201",status:"absent",date:"2026-11-19"},
    {id:"a4",studentId:"S002",courseId:"CSE201",status:"present",date:"2026-11-17"},
    {id:"a5",studentId:"S002",courseId:"CSE201",status:"absent",date:"2026-11-18"}
  ],
  sessions: [], notifications: []
};
function load(){ if(!fs.existsSync(DB)) fs.writeFileSync(DB,JSON.stringify(initial,null,2)); return JSON.parse(fs.readFileSync(DB)); }
function save(db){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
function safeUser(u){const {password,...x}=u;return x;}
function auth(req,res,next){const id=req.headers["x-user-id"];const db=load();const user=db.users.find(x=>x.id===id);if(!user)return res.status(401).json({error:"Please sign in again"});req.user=user;req.db=db;next();}
function role(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:"Not authorised"});}
function pct(present,total){return total?Math.round(present/total*100):0;}
function courseStats(db,studentId,c){const rows=db.attendance.filter(a=>a.studentId===studentId&&a.courseId===c.id);const present=rows.filter(a=>a.status==="present").length;const total=Math.max(c.held,rows.length);return {present,total,percentage:pct(present,total)};}
function calcNeeded(present,total,target){if(pct(present,total)>=target)return {needed:0,message:"You currently meet the minimum. You can miss up to "+Math.max(0,Math.floor(present*100/target-total))+" future lectures (assuming no other changes)."};let n=0;while((present+n)/(total+n)*100<target&&n<10000)n++;return {needed:n,message:"Attend the next "+n+" consecutive lectures to reach "+target+"%."};}
function alerts(db){const t=db.settings.threshold;for(const s of db.users.filter(u=>u.role==="student"))for(const c of db.courses){const st=courseStats(db,s.id,c);const key=`low-${s.id}-${c.id}-${st.percentage}`;if(st.percentage<t&&!db.notifications.some(n=>n.key===key)){db.notifications.push({id:crypto.randomUUID(),key,to:s.id,courseId:c.id,title:"Attendance below "+t+"%",message:`${c.name}: your attendance is ${st.percentage}%. Please meet your teacher and attend upcoming lectures.`,createdAt:new Date().toISOString(),read:false});db.notifications.push({id:crypto.randomUUID(),key:key+"-teacher",to:c.teacherId,courseId:c.id,title:"Low attendance alert",message:`${s.name} (${s.roll||s.id}) has ${st.percentage}% attendance in ${c.name}.`,createdAt:new Date().toISOString(),read:false});}}}
app.post("/api/login",(req,res)=>{const db=load();const u=db.users.find(x=>x.email.toLowerCase()===String(req.body.email||"").toLowerCase()&&x.password===req.body.password);if(!u)return res.status(401).json({error:"Invalid email or password"});res.json({user:safeUser(u)});});
app.get("/api/me",auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.get("/api/dashboard",auth,(req,res)=>{const db=req.db;alerts(db);save(db);const students=db.users.filter(u=>u.role==="student");if(req.user.role==="student"){const courses=db.courses.map(c=>({...c,...courseStats(db,req.user.id,c),...calcNeeded(courseStats(db,req.user.id,c).present,courseStats(db,req.user.id,c).total,db.settings.threshold)}));return res.json({user:safeUser(req.user),settings:db.settings,courses,notifications:db.notifications.filter(n=>n.to===req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});}
const courses=db.courses.map(c=>({...c,students:students.map(s=>({student:safeUser(s),...courseStats(db,s.id,c)}))}));res.json({user:safeUser(req.user),settings:db.settings,courses,students:students.map(s=>safeUser(s)),notifications:db.notifications.filter(n=>n.to===req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});});
app.post("/api/courses",auth,role("teacher","admin"),(req,res)=>{const db=req.db;const c={id:"C"+crypto.randomBytes(3).toString("hex").toUpperCase(),name:req.body.name,code:req.body.code,teacherId:req.user.id,teacher:req.user.name,total:0,held:0,room:req.body.room||"TBA"};if(!c.name||!c.code)return res.status(400).json({error:"Course name and code required"});db.courses.push(c);save(db);res.json(c);});
app.post("/api/sessions",auth,role("teacher","admin"),async(req,res)=>{const db=req.db;const c=db.courses.find(x=>x.id===req.body.courseId);if(!c)return res.status(404).json({error:"Course not found"});const token=crypto.randomBytes(24).toString("hex");const session={id:crypto.randomUUID(),token,courseId:c.id,teacherId:req.user.id,createdAt:Date.now(),expiresAt:Date.now()+5*60*1000,lat:Number(req.body.lat??db.settings.campus.lat),lng:Number(req.body.lng??db.settings.campus.lng),radius:Number(req.body.radius??db.settings.radius),active:true};db.sessions.push(session);save(db);const url=`${req.protocol}://${req.get("host")}/?session=${token}`;res.json({session:{...session,token:undefined},qr:await QRCode.toDataURL(url),url});});
function distance(a,b,c,d){const R=6371000,rad=x=>x*Math.PI/180;const x=rad(c-a),y=rad(d-b);const h=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
app.post("/api/mark",auth,role("student"),(req,res)=>{const db=req.db;const s=db.sessions.find(x=>x.token===req.body.token&&x.active&&x.expiresAt>Date.now());if(!s)return res.status(400).json({error:"QR expired or invalid. Ask your teacher for a fresh QR."});const c=db.courses.find(x=>x.id===s.courseId);const lat=Number(req.body.lat),lng=Number(req.body.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return res.status(400).json({error:"Location is required to verify campus presence."});const metres=distance(lat,lng,s.lat,s.lng);if(metres>s.radius)return res.status(403).json({error:`You are approximately ${Math.round(metres)}m away. Required distance: within ${s.radius}m.`});if(db.attendance.some(a=>a.studentId===req.user.id&&a.sessionId===s.id))return res.status(409).json({error:"Attendance already marked for this session."});db.attendance.push({id:crypto.randomUUID(),studentId:req.user.id,courseId:c.id,sessionId:s.id,status:"present",date:new Date().toISOString().slice(0,10),distance:Math.round(metres)});c.held++;alerts(db);save(db);res.json({message:`Attendance marked for ${c.name}. Location verified (${Math.round(metres)}m).`});});
app.post("/api/sessions/:id/close",auth,role("teacher","admin"),(req,res)=>{const db=req.db;const s=db.sessions.find(x=>x.id===req.params.id);if(!s)return res.status(404).json({error:"Session not found"});s.active=false;const c=db.courses.find(x=>x.id===s.courseId);c.held++;for(const u of db.users.filter(x=>x.role==="student"))if(!db.attendance.some(a=>a.sessionId===s.id&&a.studentId===u.id))db.attendance.push({id:crypto.randomUUID(),studentId:u.id,courseId:c.id,sessionId:s.id,status:"absent",date:new Date().toISOString().slice(0,10)});alerts(db);save(db);res.json({message:"Session closed; absences recorded."});});
app.get("/api/report",auth,role("teacher","admin"),(req,res)=>{const db=req.db;const rows=[];for(const c of db.courses)for(const s of db.users.filter(u=>u.role==="student")){const st=courseStats(db,s.id,c);rows.push({student:s.name,roll:s.roll,course:c.name,present:st.present,total:st.total,percentage:st.percentage});}res.json(rows);});
app.post("/api/notifications/read",auth,(req,res)=>{const db=req.db;db.notifications.filter(n=>n.to===req.user.id).forEach(n=>n.read=true);save(db);res.json({ok:true});});
app.get("/api/settings",auth,role("admin"),(req,res)=>res.json(req.db.settings));
app.put("/api/settings",auth,role("admin"),(req,res)=>{const db=req.db;const t=Number(req.body.threshold);if(t<1||t>100)return res.status(400).json({error:"Threshold must be 1–100"});db.settings.threshold=t;save(db);res.json(db.settings);});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`MITAOE SmartAttend running at http://localhost:${PORT}`));
