/**
 * 按案例/法条六大模块灌入向量知识库
 * 用法（在 houduan 目录）：npx tsx scripts/seedKnowledge.ts
 *
 * 向量在进程内用 bge-small-zh 计算，不需要 Ollama。
 */
import '../src/config'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import pool from '../src/services/db'
import {splitText} from '../src/services/textSplitter'
import {embedTexts} from '../src/services/embedding'
import {addChunks, deleteChunksByDocName, ChunkRecord} from '../src/services/vectorStore'

dotenv.config({path: path.resolve(process.cwd(), '.env')})

const SEED_DIR = path.resolve(process.cwd(), 'knowledge_seed')

async function upsertDocument(filename: string, size: number, chunkCount: number) {
  // 先清 MySQL 同名记录，再插入，保证可重复执行
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

async function seedOne(filePath: string) {
  const filename = path.basename(filePath)
  const text = fs.readFileSync(filePath, 'utf8')
  if (!text.trim()) {
    console.warn(`跳过空文件: ${filename}`)
    return
  }
  const chunks = splitText(text, filename)
  console.log(`→ ${filename}：${chunks.length} 块，向量化中…`)
  const vectors = await embedTexts(chunks)
  await deleteChunksByDocName(filename)
  // 兼容旧测试文件 labor.txt：若新劳动模块入库，顺带清掉旧名
  if (filename.includes('劳动')) {
    await deleteChunksByDocName('labor.txt')
    await pool.query('DELETE FROM documents WHERE filename = ?', ['labor.txt'])
  }
  const records: ChunkRecord[] = chunks.map((chunk, index) => ({
    vector: vectors[index],
    text: chunk,
    docName: filename,
    chunkIndex: index
  }))
  await addChunks(records)
  await upsertDocument(filename, Buffer.byteLength(text, 'utf8'), chunks.length)
  console.log(`  ✓ 已入库 ${filename}`)
}

async function main() {
  if (!fs.existsSync(SEED_DIR)) {
    throw new Error(`找不到知识库目录: ${SEED_DIR}`)
  }
  const only = process.argv[2];
  const files = fs
    .readdirSync(SEED_DIR)
    .filter((f) => f.endsWith('.txt') && (!only || f === only))
    .sort()
  if (files.length === 0) {
    throw new Error('knowledge_seed 下没有 .txt 文件')
  }
  console.log(`准备灌入 ${files.length} 个模块文档…`)
  for (const file of files) {
    await seedOne(path.join(SEED_DIR, file))
  }
  const [rows] = await pool.query<any[]>(
    'SELECT filename, chunk_count FROM documents ORDER BY id'
  )
  console.log('\n当前知识库文档：')
  for (const row of rows) {
    console.log(`  - ${row.filename}（${row.chunk_count} 块）`)
  }
  console.log('\n完成。可在 AI 咨询中试问交通事故逃逸、离婚抚养费等。')
  await pool.end()
}

main().catch(async (err) => {
  console.error('灌入失败:', err.message || err)
  try {
    await pool.end()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
