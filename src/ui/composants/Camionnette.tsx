/** Camionnette utilitaire à toit haut, chargée de plateaux d'œufs, cabine tournée vers la gauche. Décorative. */
export function Camionnette({ largeur = 120 }: { largeur?: number }) {
  return (
    <svg className="camionnette" width={largeur} height={largeur * 0.62} viewBox="0 0 200 124" aria-hidden="true">
      {/* dessin miroir : le bus roule de la droite vers la gauche */}
      <g transform="translate(200 0) scale(-1 1)">
      {/* ombre */}
      <ellipse cx="100" cy="116" rx="86" ry="5" fill="#000" opacity="0.18" />
      {/* caisse et cabine */}
      <path d="M14 30 Q14 14 30 14 H128 Q138 14 141 22 L150 46 L176 56 Q188 60 188 74 V96 Q188 102 182 102 H18 Q12 102 12 96 V34 Z" fill="#f7f5ef" stroke="#1f3a12" strokeWidth="3" strokeLinejoin="round" />
      {/* bande verte de la ferme */}
      <path d="M12 78 H188 V88 H12 Z" fill="#3f7d20" />
      {/* plateaux d'œufs visibles par la vitre arrière */}
      <rect x="24" y="26" width="64" height="34" rx="6" fill="#dfe9d6" stroke="#1f3a12" strokeWidth="2.5" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => (
        <ellipse key={`${r}-${c}`} cx={32 + c * 12} cy={33 + r * 10} rx="4.6" ry="5.6" fill={(r + c) % 3 === 0 ? '#fff' : '#f3d9b1'} stroke="#c9a46a" strokeWidth="1" />
      )))}
      {/* porte latérale */}
      <path d="M96 22 V96" stroke="#1f3a12" strokeWidth="2" opacity="0.5" />
      <rect x="100" y="58" width="12" height="4" rx="2" fill="#1f3a12" opacity="0.6" />
      {/* vitre de la cabine */}
      <path d="M118 24 H130 Q135 24 137 29 L145 50 H118 Z" fill="#a9cbe3" stroke="#1f3a12" strokeWidth="2.5" strokeLinejoin="round" />
      {/* phare et pare-chocs */}
      <rect x="178" y="62" width="10" height="7" rx="2" fill="#f6c445" stroke="#1f3a12" strokeWidth="1.5" />
      <rect x="168" y="94" width="24" height="8" rx="3" fill="#1f3a12" />
      {/* roues */}
      {[48, 152].map((x) => (
        <g key={x} className="roue">
          <circle cx={x} cy="102" r="15" fill="#1f2a1a" />
          <circle cx={x} cy="102" r="6.5" fill="#cfd5c8" />
        </g>
      ))}
      </g>
    </svg>
  )
}
