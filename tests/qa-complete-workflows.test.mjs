import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { POST, GET, FILE_POST, FILE_GET, TestDatabase, state, signIn, QUESTION_FORMATS } from './helpers/platform-api.mjs';
import { manifest, bytes, readBlock, contextFor } from './helpers/qa-assets.mjs';
import { practiceMetrics } from '../lib/practice-progress.ts';
import { courseLessons, courseProgress } from '../lib/courses.ts';
import { resourceSectionRecordId } from '../lib/additional-resources.ts';
import { buildReportDocument, reportExcel } from '../lib/report-export.ts';
import { reportPDF } from '../lib/report-pdf.ts';
import { readSheet } from 'read-excel-file/node';
import { PDFDocument } from 'pdf-lib';

const origin = 'https://qa-isolated.example.test', period = manifest.period;
const evidence = { synthetic: true, productionWrites: 0, requests: 0, uploads: 0, scenarios: [] };
const hash = value => createHash('sha256').update(value).digest('hex');
class ByteBucket {
  objects = new Map(); reads = 0;
  async put(key, input, metadata) { const content = new Uint8Array(input).slice(); this.objects.set(key, { bytes: content, size: content.length, httpEtag: `"${hash(content)}"`, ...metadata }); }
  async head(key) { this.reads++; return this.objects.get(key) || null; }
  async get(key, options) { this.reads++; const item = this.objects.get(key); if (!item) return null; const range = options?.range, body = range ? item.bytes.slice(range.offset, range.offset+range.length) : item.bytes; return { ...item, body, arrayBuffer: async()=>body.slice().buffer, writeHttpMetadata(headers) { headers.set('content-type', item.httpMetadata.contentType); } }; }
  async list() { return { objects: [...this.objects.keys()].map(key=>({ key })), truncated: false }; }
  async delete(key) { this.objects.delete(key); }
}
function fixture() {
  const db = new TestDatabase(), bucket = new ByteBucket(); state.env.DB = db; state.env.BUCKET = bucket;
  for (const who of ['teacher','student','other','outsider']) db.sql.prepare('INSERT INTO profiles(id,auth_id,email,full_name,role,status,group_id,member_role) VALUES(?,?,?,?,?,?,?,?)').run(who, `auth-${who}`, `${who==='teacher'?'profesor':who}@example.test`, `QA ${who}`, who==='teacher'?'admin':'student', 'active', who==='teacher'?null:who==='outsider'?'group-2':'group', who==='student'?'coordinator':'member');
  db.add('period-current','period',period,'published',{ current:true }); db.add('sim-ef-pilot','simulator','Sentinel','archived',{});
  for (const id of ['group','group-2']) db.add(id,'group',`QA ${id}`,'active',{ plan:'Gold',accessPolicyVersion:1,planStatus:'active',endsAt:'2099-01-01',permissions:[] });
  signIn(); return { db, bucket };
}
const request = body => new Request(`${origin}/api/platform`,{ method:'POST',headers:{ origin,'sec-fetch-site':'same-origin','content-type':'application/json' },body:JSON.stringify(body) });
async function post(body, expected=200) { evidence.requests++; const response=await POST(request(body)), result=await response.json(); assert.equal(response.status,expected,JSON.stringify({ action:body.action,...result })); return result; }
async function catalog() { evidence.requests++; const response=await GET(); assert.equal(response.status,200); return await response.json(); }
async function upload(name, kind='material', expected=200, body=bytes(name), headers={}) { evidence.requests++; const response=await FILE_POST(new Request(`${origin}/api/files?kind=${kind}&fileName=${encodeURIComponent(name)}`,{ method:'POST',headers:{ origin,'sec-fetch-site':'same-origin',...headers },body })), result=await response.json(); assert.equal(response.status,expected,JSON.stringify(result)); if(expected===200)evidence.uploads++; return result; }
async function file(key, view='', expected=200, headers={}) { evidence.requests++; const response=await FILE_GET(new Request(`${origin}/api/files?key=${encodeURIComponent(key)}${view?`&view=${view}`:''}`,{ headers })); assert.equal(response.status,expected,expected===response.status?'':await response.clone().text()); return response; }
const questions = (db,id) => db.sql.prepare("SELECT id FROM records WHERE kind='question' AND json_extract(data_json,'$.importBlockId')=? ORDER BY json_extract(data_json,'$.importRow')").all(id).map(row=>db.record(row.id));
async function academic(f, area, all=true) {
  for (const subject of [...new Set(manifest.blocks.map(block=>block.subject))]) await post({ action:'create_record',kind:'subject',title:subject,data:{ area,period } });
  f.area=area;f.blocks=[];f.materials=[];
  for (const [index,block] of manifest.blocks.entries()) {
    if(!all && index>0)break;
    let source;
    for (const [name,type] of [['material-lectura.pdf','Documento'],['infografia.png','Infografía'],['audio-prueba.wav','Audio'],['material-word.docx','Guía de estudio']]) {
      const uploaded=await upload(name), saved=await post({ action:'create_record',kind:'resource',title:`QA ${block.id} ${type}`,status:'published',data:{ area,subject:block.subject,topic:block.topic,period,plan:'Bronce',materialType:type,fileKey:uploaded.key,fileName:uploaded.fileName } });
      assert.equal(f.db.record(saved.id).status,'published');
      f.materials.push({ id:saved.id,key:uploaded.key,name,type,block:block.id }); if(type==='Documento')source=saved.id;
    }
    const inputs=await readBlock(block,['docx','pdf','xlsx','csv'][index],area);
    const context={ ...contextFor(block,area),sourceResourceId:source };
    const before=f.db.sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='question'").get().n;
    const imported=await post({ action:'import_question_block',context,questions:inputs });
    assert.equal(imported.count,20);assert.equal(f.db.record(imported.blockId).status,'pending');
    const repeated=await post({ action:'import_question_block',context,questions:inputs }); assert.equal(repeated.blockId,imported.blockId);assert.equal(repeated.reused,true);
    assert.equal(f.db.sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='question'").get().n,before+20);
    signIn('student');assert.equal((await catalog()).records.some(row=>row.kind==='question'),f.blocks.length>0);signIn();
    await post({ action:'approve_question_block',id:imported.blockId,reviewed:false },400);
    if(index===0) { const first=questions(f.db,imported.blockId)[0];await post({ action:'update_status',id:first.id,status:'approved' }); }
    await post({ action:'approve_question_block',id:imported.blockId,reviewed:true });
    assert.ok(questions(f.db,imported.blockId).every(row=>row.status==='approved'));
    f.blocks.push({ ...block,blockId:imported.blockId,source,questions:questions(f.db,imported.blockId) });
  }
  return f;
}
async function evaluation(f, configuration, correctCount) {
  signIn();const saved=await post({ action:'create_record',kind:'simulator',title:`QA ${f.area} ${configuration.mode}`,data:{ area:f.area,period,plan:'Gold',passScore:14,...configuration } });
  await post({ action:'update_status',id:saved.id,status:'published' });signIn('student');
  const started=await post({ action:'start_simulator_attempt',simulatorId:saved.id,clientAttemptId:crypto.randomUUID() });
  const resumed=await post({ action:'start_simulator_attempt',simulatorId:saved.id,clientAttemptId:crypto.randomUUID() });assert.equal(resumed.resumed,true);assert.deepEqual(resumed.attempt,started.attempt);
  const session=f.db.record(started.attempt.id), bank=session.data.questions;
  assert.equal(new Set(bank.map(row=>row.questionId)).size,bank.length);
  assert.ok(started.attempt.questions.every(row=>!('correctIndex'in row)&&!('explanation'in row)));
  for (const row of bank) { const original=f.db.record(row.questionId);assert.equal(row.options[row.correctIndex],original.data.options[original.data.correctIndex]);assert.equal(original.data.area,f.area); }
  const answers=bank.map((row,i)=>({ questionId:row.questionId,selectedIndex:i<correctCount?row.correctIndex:(row.correctIndex+1)%4 }));
  await post({ action:'finish_simulator_attempt',attemptId:session.id,answers:answers.slice(1) },400);
  signIn('other');await post({ action:'finish_simulator_attempt',attemptId:session.id,answers },404);signIn('student');
  const finished=await post({ action:'finish_simulator_attempt',attemptId:session.id,answers,score:20,correct:999 });
  assert.equal(finished.result.correct,correctCount);assert.equal(finished.result.score,Math.round(correctCount/bank.length*20*100)/100);
  assert.deepEqual(await post({ action:'finish_simulator_attempt',attemptId:session.id,answers:[] }),finished);
  assert.equal(f.db.sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='attempt' AND json_extract(data_json,'$.sessionId')=?").get(session.id).n,1);
  return { finished,bank,session };
}

for(const area of ['complexive','final_degree'])test(`QA complete ${area}: real files → 80 imported questions → topic practice → subject simulator → finals → reports`,async()=>{
  const f=fixture();try{
    await academic(f,area);signIn('student');const initial=await catalog();assert.equal(initial.records.filter(row=>row.kind==='question').length,80);
    assert.ok(initial.records.filter(row=>row.kind==='question').every(row=>!('correctIndex'in row.data)&&!('data_json'in row)));
    for(const material of f.materials){if(material.type==='Guía de estudio')await file(material.key,'metadata',415);else{const metadata=await(await file(material.key,'metadata')).json();assert.equal(metadata.size,bytes(material.name).length);}const response=await file(material.key);assert.equal(hash(new Uint8Array(await response.arrayBuffer())),hash(bytes(material.name)));assert.equal(response.headers.get('cache-control'),'private, no-store');if(material.type!=='Guía de estudio')await file(material.key,'inline');else await file(material.key,'inline',415);}
    const selected=f.blocks[0].questions;
    for(const format of QUESTION_FORMATS){const pool=selected.filter(row=>row.data.format===format), ids=pool.slice(0,2).map(row=>row.id),clientPracticeId=crypto.randomUUID();assert.equal(pool.length,4);
      const started=await post({ action:'start_practice_session',clientPracticeId,questionIds:ids });const id=started.practice.id;
      assert.equal((await post({ action:'start_practice_session',clientPracticeId,questionIds:ids })).practice.id,id);
      await post({ action:'check_practice_answer',practiceId:id,questionId:ids[0],selectedIndex:pool[0].data.correctIndex });
      assert.equal(f.db.record(id).status,'in_progress');
      const finished=await post({ action:'check_practice_answer',practiceId:id,questionId:ids[1],selectedIndex:(pool[1].data.correctIndex+1)%4 });assert.equal(finished.progress.data.correct,1);assert.equal(finished.progress.data.answered,2);assert.equal(finished.progress.status,'completed');
      const again=await post({ action:'check_practice_answer',practiceId:id,questionId:ids[1],selectedIndex:(pool[1].data.correctIndex+1)%4 });assert.deepEqual(again.progress,finished.progress);
      signIn('other');assert.equal((await catalog()).records.some(row=>row.id===id),false);signIn('student');
    }
    const scope={ area,subject:f.blocks[0].subject,period }, progress=practiceMetrics((await catalog()).records,scope,null,'');assert.deepEqual(progress,{ started:5,completed:5,answered:10,correct:5,accuracy:50 });
    const partial=await post({ action:'start_practice_session',clientPracticeId:crypto.randomUUID(),questionIds:selected.map(row=>row.id) });await post({ action:'check_practice_answer',practiceId:partial.practice.id,questionId:selected[0].id,selectedIndex:selected[0].data.correctIndex });assert.equal(f.db.record(partial.practice.id).status,'in_progress');
    const quota=QUESTION_FORMATS.map(format=>({ format,count:2 }));
    const individual=await evaluation(f,{ mode:'subject',subject:f.blocks[0].subject,count:10,topics:f.blocks.slice(0,2).map(block=>block.topic),topicCoverage:'balanced',formats:[],formatCoverage:'quota',formatDistribution:quota },5);
    assert.deepEqual(QUESTION_FORMATS.map(format=>individual.bank.filter(row=>row.format===format).length),[2,2,2,2,2]);assert.deepEqual(f.blocks.slice(0,2).map(block=>individual.bank.filter(row=>row.topic===block.topic).length),[5,5]);
    const finalBlocks=await evaluation(f,{ mode:'final',selectionMode:'blocks',blockDistribution:f.blocks.map(block=>({ blockId:block.blockId,subject:block.subject,count:5 })),formatCoverage:'quota',formatDistribution:QUESTION_FORMATS.map(format=>({ format,count:4 })),formats:[] },20);
    assert.deepEqual(f.blocks.map(block=>finalBlocks.bank.filter(row=>f.db.record(row.questionId).data.importBlockId===block.blockId).length),[5,5,5,5]);
    const finalSubjects=await evaluation(f,{ mode:'final',selectionMode:'subjects',distribution:[...new Set(f.blocks.map(block=>block.subject))].map(subject=>({ subject,count:40 })),formatCoverage:'quota',formatDistribution:QUESTION_FORMATS.map(format=>({ format,count:16 })),formats:[] },0);
    assert.equal(finalSubjects.bank.length,80);assert.equal(finalSubjects.finished.result.score,0);assert.equal(finalSubjects.finished.result.passed,false);
    signIn();const teacher=await catalog(), attempts=teacher.records.filter(row=>row.kind==='attempt');assert.equal(attempts.length,3);
    const doc=buildReportDocument(teacher.profiles,attempts,teacher.records.filter(row=>row.kind==='group'),{ query:'',group:'',status:'',period,from:'',to:'' });
    const workbook=reportExcel(doc),excel=await readSheet(Buffer.from(workbook),'Intentos');assert.equal(excel.length,4);assert.deepEqual(excel.slice(1).map(row=>row[6]).sort((a,b)=>a-b),[0,10,20]);assert.ok(!JSON.stringify(doc).includes('correctIndex'));
    const regular=new Uint8Array(readFileSync(new URL('../public/fonts/DejaVuSans.ttf',import.meta.url))), bold=new Uint8Array(readFileSync(new URL('../public/fonts/DejaVuSans-Bold.ttf',import.meta.url)));
    const pdf=await reportPDF(doc,regular,bold);assert.ok((await PDFDocument.load(pdf)).getPageCount()>=1);
    if(process.env.QA_EVIDENCE_DIR){mkdirSync(process.env.QA_EVIDENCE_DIR,{recursive:true});writeFileSync(`${process.env.QA_EVIDENCE_DIR}/ejemplo-resultados-${area}.xlsx`,workbook);writeFileSync(`${process.env.QA_EVIDENCE_DIR}/ejemplo-resultados-${area}.pdf`,pdf);}
    signIn('student');const material=f.materials[0],snapshots=attempts.map(row=>f.db.record(row.id));signIn();await post({ action:'update_status',id:material.id,status:'draft' });signIn('student');await file(material.key,'inline',403);
    signIn();await post({ action:'update_status',id:material.id,status:'published' });signIn('student');await file(material.key,'inline');assert.deepEqual(attempts.map(row=>f.db.record(row.id)),snapshots);
    evidence.scenarios.push({ name:`complete-${area}`,subjects:2,topics:4,questions:80,materials:16,practicesCompleted:5,practicesPartial:1,gradedAttempts:3,scores:[10,20,0],status:'passed' });
  }finally{f.db.sql.close();}
});

for(const area of ['complexive','final_degree'])test(`QA ${area}: invalid blocks are atomic, duplicates do not multiply and unpublished sources require review`,async()=>{
  const f=fixture();try{
    await academic(f,area,false);const block=f.blocks[0],inputs=await readBlock(manifest.blocks[0]);signIn();
    const count=()=>f.db.sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='question'").get().n;
    const invalid=inputs.map((q,i)=>i===5?{ ...q,correctIndex:null }:q);await post({ action:'import_question_block',context:{...contextFor(block,area),title:'QA invalid',topic:'Tema inválido'},questions:invalid },400);assert.equal(count(),20);
    await post({ action:'import_question_block',context:{...contextFor(block,area),title:'QA duplicate'},questions:inputs },409);assert.equal(count(),20);
    await post({ action:'import_question_block',context:{...contextFor(block,area),period:'2025-2026'},questions:inputs },409);
    await post({ action:'update_status',id:block.source,status:'draft' });await post({ action:'approve_question_block',id:block.blockId,reviewed:true },400);
    signIn('student');await post({ action:'import_question_block',context:contextFor(block,area),questions:inputs },403);signIn();await post({ action:'update_status',id:block.source,status:'published' });await post({ action:'approve_question_block',id:block.blockId,reviewed:true });
    evidence.scenarios.push({ name:`atomic-import-${area}`,status:'passed' });
  }finally{f.db.sql.close();}
});

for(const area of ['complexive','final_degree'])test(`QA capacity ${area}: import 200 actual prepared questions, final of 200 and practice limit of 100`,async()=>{
  const f=fixture();try{
    f.area=area;const subjects=[...new Set(manifest.blocks.map(block=>block.subject))], imported=[];
    for(const subject of subjects)await post({action:'create_record',kind:'subject',title:subject,data:{area,period}});
    const original=await readBlock(manifest.blocks[0],'docx',area);
    for(let n=0;n<10;n++){
      const subject=subjects[Math.floor(n/5)], prepared=original.map(q=>({...q,prompt:`Ensayo de capacidad ${n+1}. ${q.prompt}`}));
      const saved=await post({action:'import_question_block',context:{...contextFor(manifest.blocks[0],area),subject,topic:`Tema ${n%5+1} · Capacidad`,title:`QA capacidad ${n+1}`},questions:prepared});
      await post({action:'approve_question_block',id:saved.blockId,reviewed:true});imported.push(...questions(f.db,saved.blockId));
    }
    assert.equal(imported.length,200);signIn('student');
    const ids=imported.filter(q=>q.data.subject===subjects[0]).map(q=>q.id);
    assert.equal((await post({action:'start_practice_session',clientPracticeId:crypto.randomUUID(),questionIds:ids})).progress.data.total,100);
    await post({action:'start_practice_session',clientPracticeId:crypto.randomUUID(),questionIds:[...ids,imported[100].id]},400);
    const finished=await evaluation(f,{mode:'final',selectionMode:'subjects',distribution:subjects.map(subject=>({subject,count:100})),formatCoverage:'quota',formatDistribution:QUESTION_FORMATS.map(format=>({format,count:40})),formats:[]},100);
    assert.equal(finished.bank.length,200);assert.deepEqual(subjects.map(subject=>finished.bank.filter(q=>q.subject===subject).length),[100,100]);assert.deepEqual(QUESTION_FORMATS.map(format=>finished.bank.filter(q=>q.format===format).length),[40,40,40,40,40]);assert.equal(finished.finished.result.score,10);
    signIn();await post({action:'create_record',kind:'simulator',title:'QA exceso',data:{area,period,mode:'final',selectionMode:'subjects',distribution:[{subject:subjects[0],count:100},{subject:subjects[1],count:101}],plan:'Gold'}},400);
    evidence.scenarios.push({name:`capacity-${area}`,questions:200,finalSize:200,practiceSize:100,status:'passed'});
  }finally{f.db.sql.close();}
});

test('QA malformed practice answers never save a false answer or change progress',async()=>{
  const f=fixture();try{
    await academic(f,'complexive',false);const question=f.blocks[0].questions[0];signIn('student');const started=await post({ action:'start_practice_session',clientPracticeId:crypto.randomUUID(),questionIds:[question.id] });
    for(const selectedIndex of [null,false,true,'','0',[],{},undefined,0.5,-1,4]) { for(const practiceId of [started.practice.id,undefined])await post({ action:'check_practice_answer',practiceId,questionId:question.id,selectedIndex },400);assert.equal(f.db.record(started.practice.id).data.answers.length,0); }
    await post({ action:'check_practice_answer',practiceId:started.practice.id,questionId:question.id,selectedIndex:question.data.correctIndex });assert.equal(f.db.record(started.practice.id).status,'completed');
    evidence.scenarios.push({name:'strict-practice-answer',status:'passed'});
  }finally{f.db.sql.close();}
});

test('QA resources and courses: custom section, actual PDF/image/audio/Word lessons, order, completion and restoration',async()=>{
  const f=fixture();try{
    const section=await post({ action:'save_resource_section',title:'QA Recursos experimentales',mode:'materials' });
    const filePDF=await upload('material-lectura.pdf'), resource=await post({ action:'create_record',kind:'resource',title:'QA Biblioteca',data:{ area:'resources',category:section.sectionId,plan:'Bronce',materialType:'Documento',fileKey:filePDF.key } });
    await post({ action:'update_status',id:resource.id,status:'published' });
    const course=await post({ action:'create_record',kind:'course',title:'QA Curso de observación',data:{ category:'courses',plan:'Gold' } }),lessons=[];
    for(const [index,[name,type]]of [['material-lectura.pdf','Documento'],['infografia.png','Infografía'],['audio-prueba.wav','Audio'],['material-word.docx','Documento']].entries()) { const uploaded=await upload(name);const saved=await post({ action:'save_course_lesson',courseId:course.id,title:`QA Lección ${index+1}`,data:{order:index+1,minutes:5,materialType:type,fileKey:uploaded.key,fileName:uploaded.fileName} });lessons.push({...saved,...uploaded,name}); }
    await post({ action:'move_course_lesson',id:lessons[3].id,direction:'up' });await post({ action:'publish_course_lessons',courseId:course.id });
    signIn('student');await file(lessons[0].key,'inline',403);signIn();await post({ action:'update_status',id:course.id,status:'published' });signIn('student');
    assert.deepEqual(courseLessons((await catalog()).records,course.id).map(row=>row.id),[lessons[0].id,lessons[1].id,lessons[3].id,lessons[2].id]);
    for(const lesson of lessons){const response=await file(lesson.key);assert.equal(hash(new Uint8Array(await response.arrayBuffer())),hash(bytes(lesson.name)));await post({ action:'set_course_lesson_progress',id:lesson.id,completed:true });}
    const data=(await catalog()).records;assert.equal(courseProgress(courseLessons(data,course.id),data).percent,100);
    signIn('other');const other=(await catalog()).records;assert.equal(courseProgress(courseLessons(other,course.id),other).percent,0);
    signIn();await post({ action:'update_status',id:course.id,status:'archived' });signIn('student');await file(lessons[0].key,'inline',403);
    signIn();await post({ action:'update_status',id:course.id,status:'draft' });await post({ action:'update_status',id:course.id,status:'published' });signIn('student');const restored=(await catalog()).records;assert.equal(courseProgress(courseLessons(restored,course.id),restored).percent,100);
    signIn();const config=f.db.record(resourceSectionRecordId(period,section.sectionId));await post({ action:'archive_resource_section',sectionId:section.sectionId,targetSectionId:'other',revision:config.data.revision });assert.equal(f.db.record(resource.id).data.category,'other');assert.equal(f.bucket.objects.size,5);
    evidence.scenarios.push({name:'resources-courses-real-files',lessons:4,status:'passed'});
  }finally{f.db.sql.close();}
});

test('QA private files: bytes, SHA-256, ranged audio, malformed uploads and authorization before reading storage',async()=>{
  const f=fixture();try{
    const uploaded=await upload('audio-prueba.wav'),saved=await post({action:'create_record',kind:'resource',title:'QA Audio',data:{area:'resources',category:'other',plan:'Gold',materialType:'Audio',fileKey:uploaded.key}});await post({action:'update_status',id:saved.id,status:'published'});
    const registered=f.db.sql.prepare('SELECT * FROM file_objects WHERE object_key=?').get(uploaded.key);assert.equal(registered.sha256,hash(bytes('audio-prueba.wav')));
    signIn('student');const range=await file(uploaded.key,'inline',206,{range:'bytes=44-1043'});assert.equal(range.headers.get('content-type'),'audio/wav');assert.deepEqual(new Uint8Array(await range.arrayBuffer()),bytes('audio-prueba.wav').slice(44,1044));await file(uploaded.key,'inline',416,{range:'bytes=1-3,8-9'});
    const policy=f.db.record('group').data;
    for(const changed of [{...policy,plan:'Bronce'},{...policy,endsAt:'2000-01-01'},{...policy,featureOverrides:{'resources.library':'deny'}}]) {f.db.sql.prepare("UPDATE records SET data_json=? WHERE id='group'").run(JSON.stringify(changed));const before=f.bucket.reads;await file(uploaded.key,'metadata',403);await file(uploaded.key,'inline',403,{range:'bytes=0-10'});assert.equal(f.bucket.reads,before);}
    f.db.sql.prepare("UPDATE records SET data_json=? WHERE id='group'").run(JSON.stringify(policy));signIn();await upload('archivo-falso.pdf','material',400);await upload('word-danado.docx','material',400);await upload('grande.pdf','material',413,new Uint8Array(25*1024*1024+1));assert.equal(f.bucket.objects.size,1);
    signIn('student');await upload('material-lectura.pdf','material',403);f.db.sql.exec("UPDATE profiles SET status='suspended' WHERE id='student'");await file(uploaded.key,'metadata',403);
    state.headers=new Headers();await file(uploaded.key,'metadata',401);signIn('unknown');assert.equal((await catalog()).authorized,false);
    evidence.requests++;const untrusted=await POST(new Request(`${origin}/api/platform`,{method:'POST',headers:{origin:'https://evil.example.test','sec-fetch-site':'cross-site','content-type':'application/json'},body:'{"action":"create_record"}'}));assert.equal(untrusted.status,403);
    evidence.scenarios.push({name:'private-files-real-bytes',status:'passed'});
  }finally{f.db.sql.close();}
});
after(()=>{if(process.env.QA_EVIDENCE_DIR){mkdirSync(process.env.QA_EVIDENCE_DIR,{recursive:true});writeFileSync(`${process.env.QA_EVIDENCE_DIR}/workflows.json`,JSON.stringify(evidence,null,2)+'\n');}});
