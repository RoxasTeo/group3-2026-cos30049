import assert from 'node:assert/strict'
import {filterRecords,summarize,csvCell,reportCsv} from '../src/services/reportService.js'
const records=[{species_id:1,scientific_name:'Test A',common_name:'Alpha',family:'A',status:'Endangered',description:'Text, with "quotes"\nand newline'},{species_id:2,scientific_name:'Test B',common_name:'Beta',family:'B',status:'Least Concern'},{species_id:3,scientific_name:'Test C',family:'A',status:'Vulnerable'}]
assert.equal(filterRecords(records,{search:'ALPHA',family:'A',status:'Endangered'}).length,1)
assert.equal(filterRecords(records,{search:'',family:'B',status:'Endangered'}).length,0)
assert.deepEqual(summarize(records),{total:3,families:2,threatened:2,statuses:[['Endangered',1],['Least Concern',1],['Vulnerable',1]]})
assert.equal(summarize([]).total,0)
for(const input of ['=1+1',' +1','@SUM(A1)','-1','\tformula'])assert.ok(csvCell(input).startsWith('"\''))
assert.equal(csvCell('a,"b"'),'"a,""b"""')
const csv=reportCsv({records,filters:{search:'',family:'',status:''},generatedAt:'2026-10-26T00:00:00Z',summary:summarize(records)})
assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"Text, with ""quotes""\nand newline"'));assert.ok(csv.includes('2026-10-26T00:00:00Z'))
console.log('PASS: combined filters, no matches, counts, empty data, CSV escaping/formula defense and metadata')

