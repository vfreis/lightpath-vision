import assert from 'node:assert/strict'
import test from 'node:test'
import catalog from '../src/catalog.json' with { type:'json' }
import { validateModelOutput } from '../src/contract.js'
import { mapResult } from '../src/result.js'
import { buildVisionContent, extractOutputText } from '../src/openai.js'

const valid = (overrides={}) => ({status:'success',predictedFlavor:'zozzona',confidence:.93,topCandidates:[],visualSignals:[],warnings:[],...overrides})

test('high-confidence allowed class maps to success and server catalog facts', () => {
  const out = mapResult(valid(),catalog,.78,.10)
  assert.equal(out.status,'success'); assert.equal(out.pizzaId,'zozzona'); assert.ok(out.ingredients.includes('Guanciale'))
  assert.equal(out.confidenceScore,null); assert.equal(out.confidenceCalibrated,false)
})

test('low confidence is inconclusive even when model says success', () => {
  const out = mapResult(valid({confidence:.51}),catalog,.78,.10)
  assert.equal(out.status,'inconclusive'); assert.equal(out.pizzaId,null)
})

test('unknown/out-of-catalog slug cannot escape closed catalog', () => {
  const out = mapResult(valid({predictedFlavor:'hawaiian',confidence:.99}),catalog,.78,.10)
  assert.equal(out.status,'inconclusive'); assert.equal(out.pizzaName,null)
})

test('close candidates force inconclusive despite threshold passing', () => {
  const out = mapResult(valid({confidence:.84,topCandidates:[{slug:'caprese',confidence:.80}]}),catalog,.78,.10)
  assert.equal(out.status,'inconclusive'); assert.equal(out.confidenceScore,null)
})

test('model-declared inconclusive remains inconclusive with safe alternatives', () => {
  const out = mapResult(valid({status:'inconclusive',predictedFlavor:null,confidence:.68,topCandidates:[{slug:'caprese',confidence:.68},{slug:'cuore-di-napoli',confidence:.63}]}),catalog,.78,.10)
  assert.equal(out.status,'inconclusive'); assert.equal(out.alternatives.length,2)
  assert.equal(out.alternatives[0].confidenceScore,null)
})

test('server validator rejects malformed structured output', () => {
  assert.throws(() => validateModelOutput({status:'success'}), /OPENAI_INVALID_OUTPUT/)
  assert.doesNotThrow(() => validateModelOutput(valid()))
})

test('Responses API output text extraction supports output array', () => {
  const text = extractOutputText({output:[{content:[{type:'output_text',text:'{"status":"inconclusive"}'}]}]})
  assert.equal(text,'{"status":"inconclusive"}')
})

test('vision content adds only remote catalog references and never invents one', () => {
  const items = [{...catalog[0], referenceImage:'https://example.com/zozzona.jpg'}, {...catalog[1], referenceImage:null}]
  const content = buildVisionContent({imageBase64:'abc',mimeType:'image/jpeg',catalog:items,maxReferenceImages:8})
  const images = content.filter(x => x.type === 'input_image')
  assert.equal(images.length,2)
  assert.equal(images[1].image_url,'https://example.com/zozzona.jpg')
})
