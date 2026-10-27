import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {exportJobWorkbook} from '../xlsx-export/index.mjs';

test('portable XLSX preserves strings, dates, zero scores, hyperlinks and frozen panes',async()=>{
  const jobs=[{id:'fixture',company:'=1+1',title:'Example Engineer',location:'Boston, MA',source:'Fixture',postedAt:'2026-10-01T00:00:00Z',checkedAt:'2026-10-02T16:00:00Z',linkStatus:'verified',officialUrl:'https://careers.example.com/jobs/123',sourceUrl:'https://example.com/source',visa:'Unknown',analysis:{score:0}}];
  const bytes=await exportJobWorkbook(jobs,{fixture:{date:'2026-10-02T17:00:00Z'}});
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);const s=wb.getWorksheet('职位列表');
  assert.equal(s.getCell('A2').value,"'=1+1");assert.equal(s.getCell('A2').type,ExcelJS.ValueType.String);
  assert.equal(s.getCell('G2').value.hyperlink,jobs[0].officialUrl);assert.equal(s.getCell('H2').value.hyperlink,jobs[0].sourceUrl);
  assert.equal(s.getCell('M2').value,0);assert.ok(s.getCell('E2').value instanceof Date);assert.equal(s.views[0].xSplit,2);assert.equal(s.views[0].ySplit,1);
  assert.equal(s.getTable('JobResults').table.columns.length,15);
});
test('unverified and dangerous links are not exported as verified links',async()=>{
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(await exportJobWorkbook([{id:'x',company:'Example',title:'Engineer',officialUrl:'javascript:alert(1)',url:'javascript:alert(1)',linkStatus:'unverified'}]));const s=wb.getWorksheet('职位列表');assert.equal(s.getCell('G2').value,'未核实官网入口');assert.equal(s.getCell('H2').value,'来源未提供');
});
