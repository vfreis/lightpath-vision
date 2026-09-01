import assert from 'node:assert/strict'
import test from 'node:test'
import catalog from '../src/catalog.json' with { type:'json' }
import { mapResult } from '../src/result.js'
import { extractOutputText } from '../src/openai.js'

test('high-confidence allowed class maps to success and server catalog facts', () => {
  const out = mapResult({status:'success',predictedFlavor:'zozzona',confidence:.93,topCandidates:[],visualSignals:[],warnings:[]},catalog,.72)
  assert.equal(out.status,'success'); assert.equal(out.pizzaId,'zozzona'); assert.ok(out.ingredients.includes('Guanciale'))
})

test('low confidence is inconclusive even when model says success', () => {
  const out = mapResult({status:'success',predictedFlavor:'zozzona',confidence:.51,topCandidates:[],visualSignals:[],warnings:[]},catalog,.72)
  assert.equal(out.status,'inconclusive'); assert.equal(out.pizzaId,null)
})

test('unknown/out-of-catalog slug cannot escape closed catalog', () => {
  const out = mapResult({status:'success',predictedFlavor:'hawaiian',confidence:.99,topCandidates:[],visualSignals:[],warnings:[]},catalog,.72)
  assert.equal(out.status,'inconclusive'); assert.equal(out.pizzaName,null)
})

test('similar candidates remain alternatives without forcing primary', () => {
  const out = mapResult({status:'inconclusive',predictedFlavor:null,confidence:.68,topCandidates:[{slug:'caprese',confidence:.68},{slug:'cuore-di-napoli',confidence:.63}],visualSignals:[],warnings:[]},catalog,.72)
  assert.equal(out.status,'inconclusive'); assert.equal(out.alternatives.length,2)
})

test('Responses API output text extraction supports output array', () => {
  const text = extractOutputText({output:[{content:[{type:'output_text',text:'{"status":"inconclusive"}'}]}]})
  assert.equal(text,'{"status":"inconclusive"}')
})
