import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['ui-button', `ui-button--${variant}`, `ui-button--${size}`, className].filter(Boolean).join(' ')}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  )
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'article'
  children: ReactNode
}

export function Panel({ as: Element = 'section', className = '', children, ...props }: PanelProps) {
  return (
    <Element {...props} className={['ui-panel', className].filter(Boolean).join(' ')}>
      {children}
    </Element>
  )
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}

export function Badge({ tone = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span {...props} className={['ui-badge', `ui-badge--${tone}`, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}

type SectionHeadingProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function SectionHeading({ title, description, action, className = '', ...props }: SectionHeadingProps) {
  return (
    <div {...props} className={['ui-section-heading', className].filter(Boolean).join(' ')}>
      <div className="ui-section-heading__copy">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="ui-section-heading__action">{action}</div>}
    </div>
  )
}
