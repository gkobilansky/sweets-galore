#!/bin/bash

# Sweets Galore - Candy Piece Generator
# Uses Nano Banana Pro (Gemini API) to generate game sprites

# API key from environment variable
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY environment variable not set"
  exit 1
fi

OUTPUT_DIR="public/atlases/sweets-pieces/raw"
SCRIPT_PATH="$HOME/.claude/skills/nano-banana-pro/scripts/generate_image.py"

# Style prefix for consistent look
STYLE="cute kawaii candy character, simple round design, pastel colors, solid white background, game sprite asset, centered composition, no shadows, clean edges, adorable face with simple dot eyes and small smile, chibi style"

# Piece definitions: name|size|description
PIECES=(
  "buddy-bear|60|red gummy bear candy, translucent jelly texture, small cute bear shape"
  "buddy-bear-1|60|red gummy bear candy, translucent jelly texture, small cute bear shape, slightly squished bouncing pose"
  "fruity-tutti|94|colorful fruit roll-up candy spiral, rainbow swirl pattern, rolled up tube shape"
  "fruity-tutti-1|94|colorful fruit roll-up candy spiral, rainbow swirl pattern, slightly unrolled"
  "mellow-marcy|130|white fluffy marshmallow, soft puffy cylinder shape, slightly pink tinted"
  "mellow-marcy-1|130|white fluffy marshmallow, soft puffy shape, squished down pose"
  "lady-pop|140|round lollipop on white stick, pink and purple swirl pattern, classic spiral design"
  "lady-pop-1|140|round lollipop on white stick, pink and purple swirl, tilted angle"
  "coco-dude|180|chocolate bar with wrapper partially open, brown chocolate squares visible, gold foil wrapper"
  "coco-dude-1|180|chocolate bar, brown squares, wrapper flapping, bouncy pose"
  "dodo-donut|230|frosted donut with colorful sprinkles, pink strawberry icing, golden fried dough"
  "frosty-franny|260|cupcake with swirled pink frosting, cherry on top, paper wrapper with hearts"
  "speedy-shake|320|tall milkshake glass with whipped cream, pink strawberry shake, striped straw, cherry on top"
  "vanilla-ice-ice-baby|354|bowl of vanilla ice cream with three scoops, waffle bowl, sprinkles on top"
  "abby-apples|440|slice of apple pie with lattice crust, vanilla ice cream scoop melting on top, cinnamon sprinkle"
  "big-ol-cake-a-rinos|520|tall three tier wedding cake, white frosting, pink roses, gold decorations, fancy and elaborate"
)

mkdir -p "$OUTPUT_DIR"

echo "Starting Sweets Galore sprite generation..."
echo "Output directory: $OUTPUT_DIR"
echo ""

for piece in "${PIECES[@]}"; do
  IFS='|' read -r name size desc <<< "$piece"

  filename="${OUTPUT_DIR}/${name}.png"
  full_prompt="${STYLE}, ${desc}, ${size}x${size} pixels"

  echo "Generating: $name ($size x $size)"
  echo "  Prompt: $desc"

  uv run "$SCRIPT_PATH" \
    --prompt "$full_prompt" \
    --filename "$filename" \
    --resolution 1K \
    --api-key "$GEMINI_API_KEY"

  if [ $? -eq 0 ]; then
    echo "  ✓ Saved: $filename"
  else
    echo "  ✗ Failed to generate $name"
  fi

  echo ""
  # Small delay to avoid rate limiting
  sleep 2
done

echo "Generation complete!"
echo "Generated files in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"
