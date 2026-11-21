const isoDate = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10);

export function getAvailableBatches(stock, holds, medicineId, asOf = new Date()) {
  const asOfDate = isoDate(asOf);
  const heldByBatch = new Map();
  for (const hold of holds || []) {
    if (hold.hold_status !== 'active') continue;
    heldByBatch.set(hold.batch_id, (heldByBatch.get(hold.batch_id) || 0) + Number(hold.held_quantity || 0));
  }
  return (stock || [])
    .filter(batch => batch.medicine_id === medicineId && isoDate(batch.expiry_date) >= asOfDate)
    .map(batch => ({...batch,available:Math.max(0,Number(batch.quantity_on_hand || 0)-(heldByBatch.get(batch.id)||0))}))
    .filter(batch => batch.available > 0)
    .sort((a,b) => isoDate(a.expiry_date).localeCompare(isoDate(b.expiry_date))
      || String(a.received_at || '').localeCompare(String(b.received_at || ''))
      || String(a.id).localeCompare(String(b.id)));
}
export function getFefoLineSubtotal(quantity,batches) {
  let remaining=Math.max(0,Number(quantity)||0),subtotal=0;
  const allocation=[];
  for(const batch of batches||[]){
    if(remaining<=0)break;
    const take=Math.min(remaining,Math.max(0,Number(batch.available)||0));
    if(take<=0)continue;
    allocation.push({batchId:batch.id,quantity:take,unitPrice:Number(batch.selling_rate||0)});
    subtotal+=take*Number(batch.selling_rate||0);remaining-=take;
  }
  return {subtotal,allocatedQuantity:Number(quantity||0)-remaining,remaining,allocation};
}
export function cartRequiresPrescription(cart,medicines) {
  const requiredIds=new Set((medicines||[]).filter(m=>m.prescription_required).map(m=>m.id));
  return (cart||[]).some(line=>requiredIds.has(line.medicineId));
}
export function validateCartQuantities(cart,stock,holds,asOf=new Date()) {
  const issues=[];
  for(const line of cart||[]){
    const available=getAvailableBatches(stock,holds,line.medicineId,asOf).reduce((sum,b)=>sum+b.available,0);
    if(!Number.isFinite(Number(line.quantity))||Number(line.quantity)<=0)issues.push({medicineId:line.medicineId,reason:'quantity_must_be_positive'});
    else if(Number(line.quantity)>available)issues.push({medicineId:line.medicineId,reason:'quantity_exceeds_available',available});
  }
  return issues;
}
