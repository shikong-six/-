/**
 * 把法律案例目录里的现行法律按条灌进向量库。
 * 用法（在 houduan 目录）：npx tsx scripts/seedLaws.ts
 *
 * 向量在进程内用 bge-small-zh 计算，不走 Ollama。
 * 会清空旧向量表：旧的 nomic 向量和这部模型不能混在一起。
 * 只写 LanceDB 和 documents 文件列表，不把全文灌进法条页。
 * 目录里已有刑法全文时，不再灌刑事演示节选。
 */
import '../src/config'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import mammoth from 'mammoth'
import pool from '../src/services/db'
import {splitText} from '../src/services/textSplitter'
import {embedTexts} from '../src/services/embedding'
import {addChunks, resetVectorTable, ChunkRecord} from '../src/services/vectorStore'

dotenv.config({path: path.resolve(process.cwd(), '.env')})

const LAW_DIR = path.resolve(process.cwd(), '../../法律案例')
const CRIMINAL_EXCERPT = path.resolve(process.cwd(), 'knowledge_seed/刑事辩护-刑法节选.txt')

// 这几份节选已经被对应全文盖住，清掉，避免和正式条文抢检索
const RETIRED = [
  '交通事故-道交法与相关节选.txt',
  '其他-民法典总则诉讼时效节选.txt',
  '劳动纠纷-劳动合同法节选.txt',
  '合同纠纷-民法典合同编节选.txt',
  '婚姻家庭-民法典节选.txt',
  '房产物业-民法典物权物业节选.txt',
]

async function upsertDocument(filename: string, size: number, chunkCount: number) {
  await pool.query('DELETE FROM documents WHERE filename = ?', [filename])
  try {
    await pool.query(
      'INSERT INTO documents (filename, size, chunk_count, user_id) VALUES (?,?,?,NULL)',
      [filename, size, chunkCount]
    )
  } catch {
    await pool.query(
      'INSERT INTO documents (filename, size, chunk_count) VALUES (?,?,?)',
      [filename, size, chunkCount]
    )
  }
}

async function indexText(filename: string, text: string, size: number) {
  const chunks = splitText(text, filename)
  if (chunks.length === 0) {
    console.warn(`跳过空文档: ${filename}`)
    return
  }
  console.log(`→ ${filename}：${chunks.length} 条，向量化中…`)
  const started = Date.now()
  const vectors = await embedTexts(chunks)
  if (vectors.length !== chunks.length || !vectors[0] || vectors[0].length < 8) {
    throw new Error(`${filename} 向量数量或维度不对`)
  }
  const records: ChunkRecord[] = chunks.map((chunk, index) => ({
    vector: vectors[index],
    text: chunk,
    docName: filename,
    chunkIndex: index,
  }))
  await addChunks(records)
  console.log(`  ✓ ${records.length} 条，${((Date.now() - started) / 1000).toFixed(1)} 秒，维度 ${vectors[0].length}`)
  try {
    await upsertDocument(filename, size, records.length)
  } catch (error: any) {
    console.warn(`  文件列表没写上（向量已入库）: ${error.message}`)
  }
}

async function main() {
  if (!fs.existsSync(LAW_DIR)) {
    throw new Error(`找不到法律目录: ${LAW_DIR}`)
  }
  console.log('清空旧向量表…')
  await resetVectorTable()

  const files = fs.readdirSync(LAW_DIR).filter((name) => name.endsWith('.docx') && !name.startsWith('~$')).sort()
  if (files.length === 0) throw new Error('法律目录里没有 docx')
  for (const name of files) {
    const filePath = path.join(LAW_DIR, name)
    const text = (await mammoth.extractRawText({path: filePath})).value
    await indexText(name, text, fs.statSync(filePath).size)
  }

  // 目录里已有刑法全文时，不再灌演示节选，避免和正式条文抢检索。
  // 节选里夹的三句刑事诉讼法没有对应全文，会一并离开问答库。
  const hasFullCriminal = files.some((name) => name.includes('刑法') && !name.includes('修正案'))
  if (!hasFullCriminal && fs.existsSync(CRIMINAL_EXCERPT)) {
    const text = fs.readFileSync(CRIMINAL_EXCERPT, 'utf8')
    await indexText(path.basename(CRIMINAL_EXCERPT), text, Buffer.byteLength(text, 'utf8'))
  }

  try {
    const retired = [...RETIRED]
    if (hasFullCriminal) retired.push(path.basename(CRIMINAL_EXCERPT))
    for (const name of retired) {
      await pool.query('DELETE FROM documents WHERE filename = ?', [name])
    }
  } catch (error: any) {
    console.warn(`旧节选文件列表没清掉: ${error.message}`)
  }

  console.log('\n完成。问答检索走新的中文向量，不再经过 Ollama。')
  try {
    await pool.end()
  } catch {
    /* 数据库没连上时忽略 */
  }
}

main().catch(async (error) => {
  console.error('灌入失败:', error.message || error)
  try {
    await pool.end()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
