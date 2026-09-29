import { formattedTextToHtml } from "@/lib/resume-inline-links"
import {
  pairTwoColumnItems,
  renderCVColumnListHtml,
  type ColumnListBulletStyle,
} from "@/lib/cv-two-column-section"
import { cn } from "@/lib/utils"

export type CVTwoColumnListProps = {
  items: string[]
  className?: string
  itemClassName?: string
  linkColor?: string
  style?: {
    fontSize?: number
    lineHeight?: number | string
    margin?: string
  }
}

export function CVTwoColumnList({
  items,
  className,
  itemClassName,
  linkColor = "#000000",
  style,
}: CVTwoColumnListProps) {
  const paired = pairTwoColumnItems(items)
  const fontSize = style?.fontSize ?? 14
  const lineHeight = style?.lineHeight ?? 1.5

  return (
    <div
      className={cn("cv-two-column-list pdf-block-keep-together", className)}
      style={{
        margin: style?.margin,
        fontSize: `${fontSize}px`,
        lineHeight,
      }}
    >
      {paired.flatMap((row, rowIndex) => {
        const cells = [
          <div
            key={`${rowIndex}-left`}
            className={cn("cv-two-column-list__item", itemClassName)}
            dangerouslySetInnerHTML={{
              __html: formattedTextToHtml(row.left, { linkColor }),
            }}
          />,
        ]
        if (row.right) {
          cells.push(
            <div
              key={`${rowIndex}-right`}
              className={cn("cv-two-column-list__item", itemClassName)}
              dangerouslySetInnerHTML={{
                __html: formattedTextToHtml(row.right, { linkColor }),
              }}
            />,
          )
        }
        return cells
      })}
    </div>
  )
}

export function renderCVTwoColumnListHtml(
  items: string[],
  options: {
    linkColor: string
    fontSize: number
    lineHeight: number | string
    itemMargin?: string
    bullet?: Partial<ColumnListBulletStyle>
  },
): string {
  const itemMargin = options.itemMargin ?? "2px 0"
  const bulletMargin = Number.parseFloat(itemMargin) * 2 || 4
  const bullet: ColumnListBulletStyle = {
    symbol: "•",
    color: "#000000",
    size: "1em",
    bulletMargin,
    bulletIndent: 16,
    lineHeight: options.lineHeight,
    fontSize: options.fontSize,
    linkColor: options.linkColor,
    ...options.bullet,
  }
  return renderCVColumnListHtml(items, 2, bullet)
}
