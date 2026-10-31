// Génère les icônes de l'appli (PWA, iPhone, Android, favicon) : npx tsx scripts/icones.ts
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
import { svgIconeStore } from '../src/ui/oeufSvg'

const png = (svg: string, taille: number) => new Resvg(svg, { fitTo: { mode: 'width', value: taille } }).render().asPng()

writeFileSync('public/icon-1024.png', png(svgIconeStore('carree'), 1024))
writeFileSync('public/icon-512.png', png(svgIconeStore('arrondie'), 512))
writeFileSync('public/icon-192.png', png(svgIconeStore('arrondie'), 192))
writeFileSync('public/apple-touch-icon.png', png(svgIconeStore('carree'), 180))
writeFileSync('public/icon-maskable-512.png', png(svgIconeStore('adaptative'), 512))
writeFileSync('public/icon-maskable-192.png', png(svgIconeStore('adaptative'), 192))
writeFileSync('public/icon-monochrome-512.png', png(svgIconeStore('monochrome'), 512))
writeFileSync('public/favicon-32.png', png(svgIconeStore('arrondie'), 32))
writeFileSync('public/favicon.svg', svgIconeStore('arrondie'))
console.log('icônes générées')
