import iconAtlasUrl from '../assets/terraria-wiki-sprites.svg'

type Sprite = { sheet: number; x: number; y: number; width: number; height: number }

const spritePositions: Record<string, Sprite> = {
  water_bottle: { sheet:1, x:0, y:1492, width:20, height:26 },
  daybloom: { sheet:2, x:73, y:877, width:12, height:16 },
  iron_ore: { sheet:2, x:510, y:826, width:16, height:16 },
  mushroom: { sheet:1, x:464, y:1946, width:22, height:24 },
  blinkroot: { sheet:2, x:491, y:488, width:16, height:20 },
  cactus: { sheet:2, x:60, y:877, width:12, height:16 },
  armored_cavefish: { sheet:0, x:181, y:1086, width:34, height:34 },
  prismite: { sheet:0, x:280, y:1191, width:34, height:34 },
  moonglow: { sheet:2, x:264, y:509, width:12, height:20 },
  shiverthorn: { sheet:2, x:85, y:739, width:16, height:18 },
  waterleaf: { sheet:2, x:527, y:860, width:16, height:16 },
  deathweed: { sheet:2, x:745, y:720, width:16, height:18 },
  hemopiranha: { sheet:0, x:70, y:1156, width:34, height:34 },
  ebonkoi: { sheet:0, x:350, y:1121, width:34, height:34 },
  variegated_lardfish: { sheet:0, x:770, y:1226, width:34, height:34 },
  lens: { sheet:2, x:619, y:276, width:16, height:22 },
  lesser_mana_potion: { sheet:1, x:231, y:1492, width:20, height:26 },
  glowing_mushroom: { sheet:1, x:234, y:1946, width:22, height:24 },
  cobweb: { sheet:1, x:680, y:988, width:26, height:28 },
  antlion_mandible: { sheet:1, x:640, y:2021, width:12, height:24 },
  ironskin_potion: { sheet:1, x:679, y:667, width:12, height:30 },
  regeneration_potion: { sheet:1, x:692, y:667, width:12, height:30 },
  swiftness_potion: { sheet:1, x:718, y:667, width:12, height:30 },
  endurance_potion: { sheet:1, x:336, y:605, width:20, height:30 },
  lifeforce_potion: { sheet:1, x:798, y:605, width:20, height:30 },
  rage_potion: { sheet:1, x:0, y:636, width:20, height:30 },
  wrath_potion: { sheet:1, x:651, y:636, width:20, height:30 },
  summoning_potion: { sheet:1, x:315, y:636, width:20, height:30 },
  archery_potion: { sheet:1, x:0, y:605, width:20, height:30 },
  mana_potion: { sheet:1, x:273, y:1492, width:20, height:26 },
  dangersense_potion: { sheet:1, x:252, y:605, width:20, height:30 },
  mining_potion: { sheet:1, x:903, y:605, width:20, height:30 },
}

const sheetOffsets = [0, 2032, 4078]
const scale = 1.5

type PotionItemIconProps = {
  icon: string
  className?: string
  label?: string
}

export function PotionItemIcon({ icon, className = '', label = '' }: PotionItemIconProps) {
  const sprite = spritePositions[icon] ?? spritePositions.water_bottle
  const x = sprite.x * scale
  const y = (sprite.y + sheetOffsets[sprite.sheet]) * scale

  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          flex: '0 0 auto',
          width: sprite.width * scale,
          height: sprite.height * scale,
          backgroundImage: `url("${iconAtlasUrl}")`,
          backgroundSize: `1536px 7542px`,
          backgroundPosition: `-${x}px -${y}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    </span>
  )
}
