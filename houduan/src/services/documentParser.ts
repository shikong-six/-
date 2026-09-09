// 文档解析服务
// 支持 PDF、Word(docx)、TXT 三种格式
import fs from 'fs'
import pdfParse from 'pdf-parse'
import path from 'path'

import mammoth from 'mammoth';

//解析文档，返回纯文本
export async function parseDocument(filePath:string):Promise<string>{
    //获取文件扩展名并转小写
    const ext=path.extname(filePath).toLowerCase();

    //根据扩展名选择解析方式
    if(ext==='.pdf'){
        return parsePdf(filePath);
    }else if(ext==='.docx'){
         return parseDocx(filePath);
    }else if(ext==='.txt'){
        return parseTxt(filePath);
    }
    //不支持的格式抛出错误
    throw new Error(`不支持的文件格式:${ext}`);
}

//解析PDF
async function parsePdf(filePath:string):Promise<string>{
    //读取PDF文件为Buffer
    const buffer=fs.readFileSync(filePath);
    //用pdf-parse提取文本
    const data=await pdfParse(buffer);
    return data.text;
}

//解析word
async function parseDocx(filePath:string):Promise<string>{
    //用mammoth提取纯文本
    const result=await mammoth.extractRawText({path:filePath});
    return result.value;
}
//解析TXT
function parseTxt(filePath:string):string{
    //读取文本文件
    return fs.readFileSync(filePath,'utf-8')
}