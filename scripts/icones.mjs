// Génère les icônes PWA : carré vert avec un œuf blanc.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (b) => {
  let c = 0xffffffff
  for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}

function icone(taille) {
  const lignes = []
  for (let y = 0; y < taille; y++) {
    const l = [0]
    for (let x = 0; x < taille; x++) {
      const dx = (x - taille / 2) / (taille * 0.26)
      const dy = (y - taille * 0.53) / (taille * 0.34)
      const oeuf = dx * dx + dy * dy * (dy < 0 ? 1.15 : 1) <= 1
      l.push(...(oeuf ? [255, 255, 255] : [59, 109, 17]))
    }
    lignes.push(Buffer.from(l))
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(taille, 0); ihdr.writeUInt32BE(taille, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(lignes))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const t of [192, 512]) writeFileSync(`public/icon-${t}.png`, icone(t))
