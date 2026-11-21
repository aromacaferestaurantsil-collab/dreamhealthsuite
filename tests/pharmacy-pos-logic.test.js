import test from 'node:test';
import assert from 'node:assert/strict';
import { cartRequiresPrescription, getAvailableBatches, getFefoLineSubtotal, validateCartQuantities } from '../src/lib/pharmacy-pos-logic.js';
const stock=[
 {id:'late',medicine_id:'m1',expiry_date:'2027-12-01',received_at:'2026-01-02',quantity_on_hand:8,selling_rate:12},
 {id:'early',medicine_id:'m1',expiry_date:'2027-01-01',received_at:'2026-01-01',quantity_on_hand:10,selling_rate:10},
 {id:'expired',medicine_id:'m1',expiry_date:'2026-10-01',received_at:'2025-01-01',quantity_on_hand:100,selling_rate:1},
 {id:'other',medicine_id:'m2',expiry_date:'2027-01-01',quantity_on_hand:20,selling_rate:5}
];
const holds=[{batch_id:'early',held_quantity:3,hold_status:'active'},{batch_id:'late',held_quantity:2,hold_status:'released'}];
test('available stock excludes expired batches and subtracts active holds only',()=>{
 const rows=getAvailableBatches(stock,holds,'m1','2026-11-21');
 assert.deepEqual(rows.map(x=>[x.id,x.available]),[['early',7],['late',8]]);
});
test('FEFO pricing consumes earliest expiry first',()=>{
 const rows=getAvailableBatches(stock,holds,'m1','2026-11-21');
 const result=getFefoLineSubtotal(9,rows);
 assert.equal(result.subtotal,94);assert.equal(result.allocatedQuantity,9);assert.equal(result.remaining,0);
 assert.deepEqual(result.allocation.map(x=>x.batchId),['early','late']);
});
test('prescription need is derived from catalogue state',()=>{
 assert.equal(cartRequiresPrescription([{medicineId:'m1'}],[{id:'m1',prescription_required:true}]),true);
 assert.equal(cartRequiresPrescription([{medicineId:'m1'}],[{id:'m1',prescription_required:false}]),false);
});
test('cart validation rejects overdrawn and non-positive quantities',()=>{
 const issues=validateCartQuantities([{medicineId:'m1',quantity:16},{medicineId:'m2',quantity:1},{medicineId:'m1',quantity:0}],stock,holds,'2026-11-21');
 assert.equal(issues.length,2);assert.equal(issues[0].reason,'quantity_exceeds_available');assert.equal(issues[0].available,15);
 assert.equal(issues[1].reason,'quantity_must_be_positive');
});
