"use client";
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
export function PaymentRejection({ id, mutate }: { id: string; mutate: (body: Record<string, unknown>, success?: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false), [note, setNote] = useState('');
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><X/> Rechazar</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Motivo del rechazo</DialogTitle><DialogDescription>Explica qué debe corregir el coordinador: valor, legibilidad, destinatario o comprobante equivocado. El motivo quedará junto a este pago.</DialogDescription></DialogHeader><label className="space-y-2 text-sm font-semibold">Qué debe corregirse<Textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} className="min-h-28" placeholder="El valor del comprobante no coincide con el reportado. Envía el comprobante del pago completo."/></label><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={!note.trim()} onClick={async()=>{if(await mutate({action:'review_payment',id,status:'rejected',reviewNote:note},'Pago rechazado con el motivo indicado.')){setNote('');setOpen(false);}}}>Rechazar y guardar motivo</Button></DialogFooter></DialogContent></Dialog>;
}
