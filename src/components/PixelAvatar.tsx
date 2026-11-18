import spriteUrl from '../assets/pixel-avatars.svg'

type PixelAvatarProps = {
  playerId: string
  className?: string
  label?: string
}

function avatarIndex(playerId: string): number {
  let hash = 2166136261
  for (let index = 0; index < playerId.length; index += 1) {
    hash ^= playerId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 16
}

export function PixelAvatar({ playerId, className = '', label }: PixelAvatarProps) {
  const index = avatarIndex(playerId || 'guest')
  const column = index % 4
  const row = Math.floor(index / 4)

  return (
    <span
      className={className}
      role="img"
      aria-label={label || 'Аватар игрока'}
      style={{
        backgroundImage: `url("${spriteUrl}")`,
        backgroundPosition: `${column * 33.3333}% ${row * 33.3333}%`,
      }}
    />
  )
}
