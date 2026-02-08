#!/bin/bash

# Sweets Galore - Piece Generator
#
# Usage:
#   ./scripts/generate-piece.sh <piece-name> "<item description>"
#   ./scripts/generate-piece.sh <piece-name> "<edit instructions>" --edit <source.png>
#   ./scripts/generate-piece.sh <piece-name> "<item description>" --ref <reference.png>
#
# Examples:
#   ./scripts/generate-piece.sh mellow-marcy "white fluffy marshmallow cylinder"
#   ./scripts/generate-piece.sh mellow-marcy "make eyes rounder" --edit mellow-marcy-v1.png
#   ./scripts/generate-piece.sh mellow-marcy "white marshmallow" --ref kawaii-faces.png

set -e
cd "$(dirname "$0")/.."

API_KEY="AIzaSyDjo3dgHlrmXLc_U8FTYO8LT1ekBjob-D8"
OUTPUT_DIR="public/atlases/sweets-pieces/raw"
SCRIPT_PATH=".agents/skills/nano-banana-pro/scripts/generate_image.py"

# Consistent style prefix for all pieces
# Using bright green background (#00FF00) for easy chroma-key removal
STYLE_PREFIX="cute kawaii character, clean smooth lines, adorable face with round dot eyes and small curved smile, pink blush cheeks, pastel colors, solid bright green background (#00FF00), game sprite icon, centered, simple cartoon style"

if [ $# -lt 2 ]; then
  echo "Sweets Galore Piece Generator"
  echo ""
  echo "Usage:"
  echo "  $0 <piece-name> \"<item description>\""
  echo "  $0 <piece-name> \"<edit instructions>\" --edit <source.png>"
  echo "  $0 <piece-name> \"<item description>\" --ref <reference.png>"
  echo ""
  echo "Examples:"
  echo "  $0 mellow-marcy \"white fluffy marshmallow cylinder shape\""
  echo "  $0 mellow-marcy \"make the eyes rounder\" --edit mellow-marcy-v1.png"
  echo ""
  echo "Style prefix (auto-applied):"
  echo "  $STYLE_PREFIX"
  exit 1
fi

PIECE_NAME="$1"
DESCRIPTION="$2"
MODE=""
INPUT_IMAGE=""

# Parse optional flags
shift 2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --edit)
      MODE="edit"
      INPUT_IMAGE="$2"
      shift 2
      ;;
    --ref)
      MODE="ref"
      INPUT_IMAGE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Resolve input image path
if [ -n "$INPUT_IMAGE" ]; then
  if [[ "$INPUT_IMAGE" != /* ]]; then
    INPUT_IMAGE="${OUTPUT_DIR}/${INPUT_IMAGE}"
  fi
  if [ ! -f "$INPUT_IMAGE" ]; then
    echo "Error: Input image not found: $INPUT_IMAGE"
    exit 1
  fi
fi

# Generate timestamp for unique filenames
TIMESTAMP=$(date +%H%M%S)
OUTPUT_FILE="${OUTPUT_DIR}/${PIECE_NAME}-${TIMESTAMP}.png"

mkdir -p "$OUTPUT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Generating: $PIECE_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$MODE" == "edit" ]; then
  echo "Mode: EDIT existing image"
  echo "Source: $INPUT_IMAGE"
  echo "Prompt: $DESCRIPTION"
  echo ""

  uv run "$SCRIPT_PATH" \
    --prompt "$DESCRIPTION" \
    --filename "$OUTPUT_FILE" \
    --input-image "$INPUT_IMAGE" \
    --resolution 1K \
    --api-key "$API_KEY"

elif [ "$MODE" == "ref" ]; then
  echo "Mode: GENERATE with reference"
  echo "Reference: $INPUT_IMAGE"
  echo "Description: $DESCRIPTION"
  echo "Full prompt: $STYLE_PREFIX, $DESCRIPTION"
  echo ""

  # For reference mode, we combine the style with description and use reference as input
  uv run "$SCRIPT_PATH" \
    --prompt "$STYLE_PREFIX, $DESCRIPTION, match the cute face style from the reference" \
    --filename "$OUTPUT_FILE" \
    --input-image "$INPUT_IMAGE" \
    --resolution 1K \
    --api-key "$API_KEY"

else
  echo "Mode: GENERATE new"
  echo "Description: $DESCRIPTION"
  echo "Full prompt: $STYLE_PREFIX, $DESCRIPTION"
  echo ""

  uv run "$SCRIPT_PATH" \
    --prompt "$STYLE_PREFIX, $DESCRIPTION" \
    --filename "$OUTPUT_FILE" \
    --resolution 1K \
    --api-key "$API_KEY"
fi

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Saved: $OUTPUT_FILE"
  echo ""
  echo "Next steps:"
  echo "  - Check the image"
  echo "  - To edit: $0 $PIECE_NAME \"<changes>\" --edit $(basename $OUTPUT_FILE)"
  echo "  - To finalize: mv $OUTPUT_FILE ${OUTPUT_DIR}/${PIECE_NAME}.png"
else
  echo ""
  echo "✗ Failed to generate"
  exit 1
fi
