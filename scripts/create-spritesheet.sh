#!/bin/bash

# Sweets Galore - Spritesheet Generator
# Combines raw images into a single spritesheet with JSON metadata
#
# Prerequisites: ImageMagick (brew install imagemagick)
#
# Usage: ./scripts/create-spritesheet.sh

set -e
cd "$(dirname "$0")/.."

RAW_DIR="public/atlases/sweets-pieces/raw"
OUTPUT_DIR="public/atlases/sweets-pieces"
TEMP_DIR="$RAW_DIR/resized"

# Piece definitions: name:size (sorted largest to smallest for packing)
PIECES=(
  "big-ol-cake-a-rinos:520"
  "abby-apples:440"
  "vanilla-ice-ice-baby:354"
  "speedy-shake:320"
  "frosty-franny:260"
  "dodo-donut:230"
  "coco-dude:180"
  "coco-dude-1:180"
  "lady-pop:140"
  "lady-pop-1:140"
  "mellow-marcy:130"
  "mellow-marcy-1:130"
  "fruity-tutti:94"
  "fruity-tutti-1:94"
  "buddy-bear:60"
  "buddy-bear-1:60"
)

# Check for ImageMagick
if ! command -v magick &> /dev/null; then
  echo "Error: ImageMagick not found. Install with: brew install imagemagick"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sweets Galore Spritesheet Generator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create temp directory for resized images
mkdir -p "$TEMP_DIR"
rm -f "$TEMP_DIR"/*.png

# Step 1: Find and resize images
echo "Step 1: Resizing images..."
FOUND_PIECES=""
FOUND_SIZES=""

for entry in "${PIECES[@]}"; do
  piece="${entry%%:*}"
  size="${entry##*:}"

  # Find the source image (either exact name or latest timestamped version)
  if [ -f "$RAW_DIR/$piece.png" ]; then
    src="$RAW_DIR/$piece.png"
  else
    # Find latest timestamped version
    src=$(ls -t "$RAW_DIR/$piece"-*.png 2>/dev/null | head -1 || echo "")
  fi

  if [ -n "$src" ] && [ -f "$src" ]; then
    echo "  ✓ $piece (${size}x${size}) <- $(basename "$src")"

    # Remove background - try green first, then white (floodfill from corners)
    magick "$src" \
      -alpha set \
      -channel RGBA \
      -fuzz 15% -fill none -draw "color 0,0 floodfill" \
      -fuzz 15% -fill none -draw "color %[fx:w-1],0 floodfill" \
      -fuzz 15% -fill none -draw "color 0,%[fx:h-1] floodfill" \
      -fuzz 15% -fill none -draw "color %[fx:w-1],%[fx:h-1] floodfill" \
      -trim +repage \
      -resize "${size}x${size}" \
      -gravity center -background none -extent "${size}x${size}" \
      PNG32:"$TEMP_DIR/$piece.png"

    FOUND_PIECES="$FOUND_PIECES $piece:$size"
  else
    echo "  ✗ $piece - NOT FOUND (skipping)"
  fi
done

# Count found pieces
PIECE_COUNT=$(echo $FOUND_PIECES | wc -w | tr -d ' ')
echo ""
echo "Found $PIECE_COUNT pieces"

if [ "$PIECE_COUNT" -eq 0 ]; then
  echo "Error: No pieces found!"
  exit 1
fi

# Step 2: Calculate spritesheet layout
echo ""
echo "Step 2: Creating spritesheet layout..."

PADDING=2
MAX_WIDTH=1400
current_x=$PADDING
current_y=$PADDING
row_height=0

# Store positions in temp file
POSITIONS_FILE="$TEMP_DIR/positions.txt"
> "$POSITIONS_FILE"

for entry in $FOUND_PIECES; do
  piece="${entry%%:*}"
  size="${entry##*:}"

  # Check if piece fits in current row
  if [ $((current_x + size + PADDING)) -gt $MAX_WIDTH ]; then
    # Move to next row
    current_x=$PADDING
    current_y=$((current_y + row_height + PADDING))
    row_height=0
  fi

  echo "$piece $size $current_x $current_y" >> "$POSITIONS_FILE"

  current_x=$((current_x + size + PADDING))
  if [ $size -gt $row_height ]; then
    row_height=$size
  fi
done

total_height=$((current_y + row_height + PADDING))
total_width=$MAX_WIDTH

echo "  Spritesheet size: ${total_width}x${total_height}"

# Step 3: Compose spritesheet
echo ""
echo "Step 3: Composing spritesheet..."

# Start with transparent canvas
magick -size "${total_width}x${total_height}" xc:transparent PNG32:"$OUTPUT_DIR/spritesheet.png"

# Composite each piece
while read -r piece size x y; do
  magick "$OUTPUT_DIR/spritesheet.png" "$TEMP_DIR/$piece.png" -geometry "+${x}+${y}" -composite PNG32:"$OUTPUT_DIR/spritesheet.png"
done < "$POSITIONS_FILE"

echo "  ✓ Saved: $OUTPUT_DIR/spritesheet.png"

# Step 4: Generate JSON metadata
echo ""
echo "Step 4: Generating JSON metadata..."

JSON_FILE="$OUTPUT_DIR/spritesheet.json"

cat > "$JSON_FILE" << EOF
{
	"meta": {
		"image": "spritesheet.png",
		"size": {"w":${total_width},"h":${total_height}},
		"scale": "1"
	},
	"frames": {
EOF

# Add frame entries
first=true
while read -r piece size x y; do
  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$JSON_FILE"
  fi

  cat >> "$JSON_FILE" << FRAME
		"$piece":
		{
			"frame": {"x":$x,"y":$y,"w":$size,"h":$size},
			"rotated": false,
			"trimmed": false,
			"spriteSourceSize": {"x":0,"y":0,"w":$size,"h":$size},
			"sourceSize": {"w":$size,"h":$size}
		}
FRAME
done < "$POSITIONS_FILE"

cat >> "$JSON_FILE" << 'FOOTER'

	}
}
FOOTER

echo "  ✓ Saved: $JSON_FILE"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done! Spritesheet created:"
echo "  $OUTPUT_DIR/spritesheet.png"
echo "  $OUTPUT_DIR/spritesheet.json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
