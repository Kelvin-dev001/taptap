import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge resolves conflicts using its knowledge of Tailwind's DEFAULT
 * scales. Our type scale is custom (text-body-sm, text-metric, …), so out of
 * the box it cannot tell a size utility from a colour utility — it files both
 * under one group and drops the earlier one, silently deleting the font size
 * from `text-body-sm text-foreground`.
 *
 * Registering the custom font sizes keeps size and colour in separate groups.
 * Any new entry in tailwind.config.ts `fontSize` must be added here too.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "page-title",
            "section-title",
            "card-title",
            "body",
            "body-sm",
            "label",
            "caption",
            "metric",
            "metric-lg",
          ],
        },
      ],
    },
  },
});

/**
 * Merge conditional class names, with later Tailwind utilities winning over
 * earlier conflicting ones. Lets every component accept a `className` override
 * without fighting its own base styles.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
