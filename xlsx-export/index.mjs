import ExcelJS from 'exceljs';

const headers=['公司','岗位','地点','来源','聚合来源发布时间','获取时间（美东）','已核实官网岗位链接','原始来源链接（非官网证明）','官网核验状态','链接核验时间（美东）','官网/ATS发布日','已投日期（美东）','AI相关度（非录用概率）','签证提示','官网核验说明'];
const epoch=Date.UTC(1899,11,30);
const text=value=>String(value??'').replace(/^[\s]*[=+@-]/,"'$&");
function excelDate(value,local=false){
  if(!value||!Number.isFinite(Date.parse(value)))return null;
  const date=new Date(value);
  if(!local)return Math.floor((date.valueOf()-epoch)/86400000);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return (Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second)-epoch)/86400000;
}
function safeLink(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}

export function createJobWorkbook(jobs,applied={}){
  const workbook=new ExcelJS.Workbook();
  workbook.creator='Job Radar';
  const sheet=workbook.addWorksheet('职位列表',{views:[{state:'frozen',xSplit:2,ySplit:1,showGridLines:false}]});
  const rows=jobs.map(j=>[text(j.company),text(j.title),text(j.location),text(j.source),excelDate(j.postedAt)??text(j.postedText||'未知'),excelDate(j.checkedAt,true),j.linkStatus==='verified'&&safeLink(j.officialUrl)?'官网岗位 / 直投入口':'未核实官网入口',safeLink(j.sourceUrl||j.url)?'原始来源（不等于官网）':'来源未提供',j.linkStatus==='verified'?'已核实官网岗位':j.linkStatus==='closed'?'官网下架 / 过期信号':'官网未核实',excelDate(j.linkCheckedAt,true),excelDate(j.officialPostedAt)??'官网未提供',excelDate(applied[j.id]?.date,true),Number.isFinite(j.analysis?.score)?j.analysis.score:null,text(j.visa),text(j.linkNote||'官网尚未核验')]);
  sheet.addTable({name:'JobResults',ref:'A1',headerRow:true,totalsRow:false,style:{theme:'TableStyleMedium2',showRowStripes:true},columns:headers.map(name=>({name,filterButton:true})),rows});
  const widths=[25,56,25,20,23,24,25,29,26,24,25,24,26,43,66];
  widths.forEach((width,i)=>sheet.getColumn(i+1).width=width);
  for(let r=1;r<=jobs.length+1;r++){
    const row=sheet.getRow(r);row.height=r===1?40:52;
    row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Arial',size:11,color:{argb:'FF17324D'}};cell.alignment={vertical:'middle',wrapText:true};});
    if(r===1){row.eachCell(cell=>{cell.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17324D'}};});continue;}
    const j=jobs[r-2];
    for(const [column,value] of [[7,j.linkStatus==='verified'?j.officialUrl:''],[8,j.sourceUrl||j.url]]){
      const url=safeLink(value);if(url){const cell=row.getCell(column);cell.value={text:String(cell.value),hyperlink:url};cell.font={name:'Arial',size:11,color:{argb:'FF0563C1'},underline:true};}
    }
    for(const col of [5,11])row.getCell(col).numFmt='yyyy-mm-dd';
    for(const col of [6,10,12])row.getCell(col).numFmt='yyyy-mm-dd hh:mm:ss';
    row.getCell(13).numFmt='0';
  }
  return workbook;
}
export async function exportJobWorkbook(jobs,applied={}){
  return Buffer.from(await createJobWorkbook(jobs,applied).xlsx.writeBuffer());
}
