#!/bin/bash
# Claude Code Pre-Write Hook for Zuko's Blog
# This hook validates dates before creating blog posts

# Check if creating a post file
if [[ "$1" == *"_posts/"* ]]; then
  # Extract date from filename
  filename=$(basename "$1")
  date_part=$(echo "$filename" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
  
  if [[ -n "$date_part" ]]; then
    year=$(echo "$date_part" | cut -d'-' -f1)
    
    # Validate year is 2025 for new posts (current year)
    if [[ "$year" != "2025" && "$year" != "2024" && "$year" != "2023" ]]; then
      echo "⚠️  Warning: Post date year should be 2025 for current posts"
      echo "📅 Today is August 21, 2025"
    fi
    
    # Ensure proper date format
    if ! [[ "$date_part" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      echo "❌ Error: Post filename must start with YYYY-MM-DD format"
      exit 1
    fi
  fi
fi

echo "✅ Date validation passed"