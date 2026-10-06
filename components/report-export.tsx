"use client";
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { localRecordDay } from '@/lib/record-lists';
import type { ReportDocument } from '@/lib/report-export';
function download(bytes:Uint8Array,name:string,type:string){const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function ReportExport({report}:{report:ReportDocument}){
 const name=`TUTOSEBAS-reporte-${localRecordDay(new Date().toISOString())}`;
 const excel=async()=>{try{const{reportExcel}=await import('@/lib/report-export');download(reportExcel(report),name+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}catch{toast.error('No se pudo generar Excel. Revisa los filtros y vuelve a intentar.');}};
 const pdf=async()=>{try{const responses=await Promise.all(['/fonts/DejaVuSans.ttf','/fonts/DejaVuSans-Bold.ttf'].map(url=>fetch(url)));if(responses.some(r=>!r.ok))throw new Error('No se pudo cargar la fuente del reporte.');const fonts=await Promise.all(responses.map(r=>r.arrayBuffer())),{reportPDF}=await import('@/lib/report-pdf');download(await reportPDF(report,new Uint8Array(fonts[0]),new Uint8Array(fonts[1])),name+'.pdf','application/pdf');}catch(error){toast.error(error instanceof Error?error.message:'No se pudo generar el PDF.');}};
 return <section aria-label="Descargar reporte" className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">Descargar resultados del filtro</h2><p className="mt-1 text-xs leading-5 text-slate-500">Todos los registros filtrados, incluidos los de otras páginas. Excel incluye estudiantes, intentos y filtros.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={excel}><FileDown/> Excel</Button><Button variant="outline" onClick={pdf}><FileDown/> PDF</Button></div></section>;
}
