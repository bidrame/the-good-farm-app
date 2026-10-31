// Génère les icônes PWA à partir du dessin de l'œuf : npx tsx scripts/icones.ts
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
import { svgIcone } from '../src/ui/oeufSvg'

const png = (svg: string, taille: number) => new Resvg(svg, { fitTo: { mode: 'width', value: taille } }).render().asPng()

writeFileSync('public/icon-192.png', png(svgIcone(), 192))
writeFileSync('public/icon-512.png', png(svgIcone(), 512))
writeFileSync('public/icon-maskable-512.png', png(svgIcone({ maskable: true }), 512))
writeFileSync('public/favicon.svg', svgIcone())
console.log('icônes générées')
