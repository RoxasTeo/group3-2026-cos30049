export function filterRecords(records, filters) {
 const q = filters.search.trim().toLowerCase()
 return records.filter(r => (!q || `${r.common_name || ''} ${r.scientific_name || ''}`.toLowerCase().includes(q)) && (!filters.family || r.family === filters.family) && (!filters.status || r.status === filters.status)).sort((a,b)=>String(a.scientific_name||'').localeCompare(String(b.scientific_name||'')))
}
export function summarize(records) {
 const counts = new Map()
 for(const r of records){const s=r.status||'Not recorded';counts.set(s,(counts.get(s)||0)+1)}
 return {total:records.length,families:new Set(records.map(r=>r.family).filter(Boolean)).size,threatened:records.filter(r=>['Vulnerable','Endangered','Critically Endangered'].includes(r.status)).length,statuses:[...counts].sort(([a],[b])=>a.localeCompare(b))}
}
export function csvCell(value) {
 let text=String(value??'')
 if(/^[\s\uFEFF]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text)) text="'"+text
 return '"'+text.replaceAll('"','""')+'"'
}
export function reportCsv(r){
 const columns=[['species_id','Record ID'],['common_name','Common name'],['scientific_name','Scientific name'],['family','Family'],['genus','Genus'],['status','Conservation status'],['habitat','Habitat'],['description','Description'],['ecological_info','Ecological information'],['cultural_sign','Cultural significance'],['updated_at','Updated at (source value)']]
 const rows=[['Niah National Park biodiversity report'],['Generated at (UTC)',r.generatedAt],['Source','Shared species database; current inventory snapshot'],['Name search',r.filters.search||'All'],['Family filter',r.filters.family||'All'],['Status filter',r.filters.status||'All'],['Species records',r.summary.total],['Plant families',r.summary.families],['Threatened species records',r.summary.threatened],[],['Conservation status','Record count'],...r.summary.statuses,[],columns.map(([,label])=>label),...r.records.map(record=>columns.map(([key])=>record[key]))]
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
}
