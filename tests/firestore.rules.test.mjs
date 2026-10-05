import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
let env;
const stateDoc=db=>doc(db,'households','goncalo-ines','state','main');
const state=revision=>({payload:'{"version":1}',revision,updatedAt:serverTimestamp()});
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-mesa-a-dois',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'access','goncalo-test'),{householdId:'goncalo-ines'});
  await setDoc(doc(db,'access','ines-test'),{householdId:'goncalo-ines'});
  await setDoc(doc(db,'access','other-test'),{householdId:'outro-agregado'});
  await setDoc(stateDoc(db),{payload:'{"version":1}',revision:1,updatedAt:new Date()});
 });
});
after(async()=>{await env?.cleanup();});
test('Sem sessão não lê nem escreve o plano',async()=>{const db=env.unauthenticatedContext().firestore();await assertFails(getDoc(stateDoc(db)));await assertFails(setDoc(stateDoc(db),state(2)));});
test('Gonçalo e Inês podem ler o mesmo plano',async()=>{for(const uid of ['goncalo-test','ines-test'])await assertSucceeds(getDoc(stateDoc(env.authenticatedContext(uid).firestore())));});
test('Conta sem acesso e membro de outro agregado são rejeitados',async()=>{for(const uid of ['stranger-test','other-test']){const db=env.authenticatedContext(uid).firestore();await assertFails(getDoc(stateDoc(db)));await assertFails(setDoc(stateDoc(db),state(2)));}});
test('Ninguém se pode atribuir acesso ou consultar a lista de membros',async()=>{const db=env.authenticatedContext('stranger-test').firestore();await assertFails(setDoc(doc(db,'access','stranger-test'),{householdId:'goncalo-ines'}));await assertFails(getDocs(collection(db,'access')));await assertFails(getDoc(doc(db,'access','goncalo-test')));});
test('Cada conta pode consultar apenas o seu documento de acesso',async()=>{const db=env.authenticatedContext('goncalo-test').firestore();await assertSucceeds(getDoc(doc(db,'access','goncalo-test')));await assertFails(setDoc(doc(db,'access','goncalo-test'),{householdId:'outro-agregado'}));});
test('Escrita autorizada incrementa a revisão; escritas antigas são recusadas',async()=>{const db=env.authenticatedContext('goncalo-test').firestore();await assertSucceeds(setDoc(stateDoc(db),state(2)));await assertFails(setDoc(stateDoc(env.authenticatedContext('ines-test').firestore()),state(2)));await assertSucceeds(setDoc(stateDoc(env.authenticatedContext('ines-test').firestore()),state(3)));});
test('Payload inválido, campos adicionais e remoção são recusados',async()=>{const db=env.authenticatedContext('ines-test').firestore();await assertFails(setDoc(stateDoc(db),{...state(4),payload:1}));await assertFails(setDoc(stateDoc(db),{...state(4),admin:true}));await assertFails(setDoc(stateDoc(db),{...state(4),payload:''}));await assertFails(deleteDoc(stateDoc(db)));});
test('Criar outro agregado não concede acesso',async()=>{const db=env.authenticatedContext('goncalo-test').firestore();await assertFails(setDoc(doc(db,'households','outro-agregado','state','main'),state(1)));});
