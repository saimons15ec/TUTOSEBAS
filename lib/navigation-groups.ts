const teacherGroups = [
  ['Inicio',['dashboard']],
  ['Gestión académica',['final','complexive','reviews','resources']],
  ['Grupos y acceso',['students','plans','payments','periods']],
  ['Seguimiento',['notices','reports']],
  ['Cuenta',['settings']],
] as const;
const studentGroups = [
  ['Inicio',['home']],
  ['Estudio',['final','complexive','resources']],
  ['Trabajos',['work','deliveries']],
  ['Mi grupo',['group','plan']],
  ['Cuenta y avisos',['notices','account']],
] as const;
export function groupNavigation<T extends readonly [string, ...unknown[]]>(items: readonly T[]) {
  const groups = items.some(item=>item[0]==='dashboard') ? teacherGroups : studentGroups;
  const used = new Set<string>();
  const result: {label:string;items:T[]}[] = groups.map(([label, ids])=>({label,items:ids.flatMap(id=>{const item=items.find(row=>row[0]===id);if(!item||used.has(id))return[];used.add(id);return[item];})})).filter(group=>group.items.length);
  const extra=items.filter(item=>!used.has(item[0]));if(extra.length)result.push({label:'Otras opciones',items:[...extra]});return result;
}
