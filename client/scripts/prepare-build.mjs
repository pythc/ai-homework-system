import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()

function isWritable(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function ensureWritableDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true })
    return
  }
  if (isWritable(targetPath)) return

  const backupName = `${path.basename(targetPath)}.unwritable.${Date.now()}`
  const backupPath = path.join(path.dirname(targetPath), backupName)
  fs.renameSync(targetPath, backupPath)
  fs.mkdirSync(targetPath, { recursive: true })
  // eslint-disable-next-line no-console
  console.warn(`[build] moved unwritable path: ${targetPath} -> ${backupPath}`)
}

ensureWritableDir(path.join(cwd, '.cache'))

const outDir = path.join(cwd, 'dist')
if (fs.existsSync(outDir)) {
  try {
    fs.rmSync(outDir, { recursive: true, force: true })
  } catch {
    const backupName = `${path.basename(outDir)}.unwritable.${Date.now()}`
    const backupPath = path.join(path.dirname(outDir), backupName)
    fs.renameSync(outDir, backupPath)
    // eslint-disable-next-line no-console
    console.warn(`[build] moved unwritable path: ${outDir} -> ${backupPath}`)
  }
}
fs.mkdirSync(outDir, { recursive: true })
