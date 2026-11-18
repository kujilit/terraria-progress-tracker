import iconAtlasUrl from '../assets/potion-icons.svg'

const iconPositions: Record<string, number> = {
  water_bottle:0, daybloom:1, iron_ore:2, mushroom:3,
  blinkroot:4, cactus:5, armored_cavefish:6, prismite:7,
  moonglow:8, shiverthorn:9, waterleaf:10, deathweed:11,
  hemopiranha:12, ebonkoi:13, variegated_lardfish:14, lens:15,
  lesser_mana_potion:16, glowing_mushroom:17, cobweb:18, antlion_mandible:19,
  ironskin_potion:20, regeneration_potion:21, swiftness_potion:22, endurance_potion:23,
  lifeforce_potion:24, rage_potion:25, wrath_potion:26, summoning_potion:27,
  archery_potion:28, mana_potion:29, dangersense_potion:30, mining_potion:31,
}

type PotionItemIconProps = {
  icon: string
  className?: string
  label?: string
}

export function PotionItemIcon({ icon, className = '', label = '' }: PotionItemIconProps) {
  const index = iconPositions[icon] ?? 0
  const column = index % 8
  const row = Math.floor(index / 8)

  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{
        backgroundImage: `url("${iconAtlasUrl}")`,
        backgroundSize: '800% 400%',
        backgroundPosition: `${column / 7 * 100}% ${row / 3 * 100}%`,
      }}
    />
  )
}
