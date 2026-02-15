"""
DXC UI Gamification Mockup - Mythic Interface Design
Creating a museum-quality visual design for the game interface transformation
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

# Canvas setup - 1920x1080 landscape
WIDTH = 1920
HEIGHT = 1080

# Color palette - DanMachi themed
DUNGEON_BLACK = '#0a0a0f'
HESTIA_BLUE = '#3b82f6'
HESTIA_BLUE_GLOW = '#60a5fa'
GUILD_GOLD = '#f59e0b'
PARCHMENT_LIGHT = '#f8f4ed'
PARCHMENT_MID = '#e8dcc8'
DUNGEON_STONE = '#2d2d35'
BRONZE_TRIM = '#cd7f32'

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_gradient_vertical(draw, bbox, color_top, color_bottom):
    """Create a vertical gradient"""
    x1, y1, x2, y2 = bbox
    for y in range(y1, y2):
        ratio = (y - y1) / (y2 - y1)
        r = int(color_top[0] * (1 - ratio) + color_bottom[0] * ratio)
        g = int(color_top[1] * (1 - ratio) + color_bottom[1] * ratio)
        b = int(color_top[2] * (1 - ratio) + color_bottom[2] * ratio)
        draw.rectangle([(x1, y), (x2, y + 1)], fill=(r, g, b))

def add_glow_effect(img, bbox, color, blur_radius=20, intensity=0.6):
    """Add a glow effect around a region"""
    glow_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)

    # Draw the glow shape
    glow_color = hex_to_rgb(color) + (int(255 * intensity),)
    glow_draw.rectangle(bbox, fill=glow_color)

    # Blur it
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(blur_radius))

    # Composite
    img.paste(glow_layer, (0, 0), glow_layer)

def draw_ornate_border(draw, bbox, color, width=3):
    """Draw an ornate border with corner decorations"""
    x1, y1, x2, y2 = bbox
    rgb = hex_to_rgb(color)

    # Main border
    draw.rectangle(bbox, outline=rgb, width=width)

    # Corner decorations (small L-shapes)
    corner_size = 20
    for corner in [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]:
        cx, cy = corner
        if cx == x1 and cy == y1:  # Top-left
            draw.line([(cx, cy), (cx + corner_size, cy)], fill=rgb, width=width+1)
            draw.line([(cx, cy), (cx, cy + corner_size)], fill=rgb, width=width+1)
        elif cx == x2 and cy == y1:  # Top-right
            draw.line([(cx, cy), (cx - corner_size, cy)], fill=rgb, width=width+1)
            draw.line([(cx, cy), (cx, cy + corner_size)], fill=rgb, width=width+1)
        elif cx == x1 and cy == y2:  # Bottom-left
            draw.line([(cx, cy), (cx + corner_size, cy)], fill=rgb, width=width+1)
            draw.line([(cx, cy), (cx, cy - corner_size)], fill=rgb, width=width+1)
        elif cx == x2 and cy == y2:  # Bottom-right
            draw.line([(cx, cy), (cx - corner_size, cy)], fill=rgb, width=width+1)
            draw.line([(cx, cy), (cx, cy - corner_size)], fill=rgb, width=width+1)

def add_texture_noise(img, intensity=15):
    """Add subtle noise texture to simulate paper grain"""
    import random
    pixels = img.load()
    width, height = img.size

    for _ in range(width * height // 20):  # Sparse noise
        x = random.randint(0, width - 1)
        y = random.randint(0, height - 1)
        if pixels[x, y][3] > 0:  # Only on visible pixels
            r, g, b, a = pixels[x, y]
            noise = random.randint(-intensity, intensity)
            pixels[x, y] = (
                max(0, min(255, r + noise)),
                max(0, min(255, g + noise)),
                max(0, min(255, b + noise)),
                a
            )

def create_ui_mockup():
    """Create the main UI mockup"""
    # Create base canvas
    img = Image.new('RGB', (WIDTH, HEIGHT), hex_to_rgb(DUNGEON_BLACK))
    draw = ImageDraw.Draw(img, 'RGBA')

    # Add subtle background texture (dark stone)
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Create background depth with very subtle gradients
    create_gradient_vertical(
        overlay_draw,
        (0, 0, WIDTH, HEIGHT),
        hex_to_rgb(DUNGEON_BLACK),
        (15, 15, 20)
    )
    img.paste(overlay, (0, 0), overlay)

    # === TOP NAVIGATION BAR (Guild Plaque Style) ===
    top_nav_height = 100
    top_nav_y = 20

    # Top nav background - ornate plaque
    top_nav_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    top_nav_draw = ImageDraw.Draw(top_nav_layer)

    # Main plaque body with gradient
    plaque_bbox = (40, top_nav_y, WIDTH - 40, top_nav_y + top_nav_height)
    create_gradient_vertical(
        top_nav_draw,
        plaque_bbox,
        hex_to_rgb(DUNGEON_STONE),
        (35, 35, 45)
    )

    # Add glow effect for the top nav
    add_glow_effect(top_nav_layer, plaque_bbox, HESTIA_BLUE, blur_radius=15, intensity=0.3)

    # Ornate border
    draw_ornate_border(top_nav_draw, plaque_bbox, GUILD_GOLD, width=3)

    img.paste(top_nav_layer, (0, 0), top_nav_layer)
    draw = ImageDraw.Draw(img)

    # Top nav content placeholders
    # Left: Guild emblem placeholder
    emblem_size = 60
    emblem_x = 80
    emblem_y = top_nav_y + (top_nav_height - emblem_size) // 2
    draw.ellipse(
        [(emblem_x, emblem_y), (emblem_x + emblem_size, emblem_y + emblem_size)],
        fill=hex_to_rgb(HESTIA_BLUE),
        outline=hex_to_rgb(GUILD_GOLD),
        width=3
    )

    # Right: Character status (avatar, level, gold)
    status_x = WIDTH - 400
    avatar_size = 60
    avatar_y = top_nav_y + (top_nav_height - avatar_size) // 2
    draw.ellipse(
        [(status_x, avatar_y), (status_x + avatar_size, avatar_y + avatar_size)],
        fill=hex_to_rgb(PARCHMENT_LIGHT),
        outline=hex_to_rgb(GUILD_GOLD),
        width=2
    )

    # === MAIN LAYOUT ===
    main_top = top_nav_y + top_nav_height + 30
    main_bottom = HEIGHT - 40

    # LEFT PANEL (Book/Scroll Navigation)
    left_panel_width = 320
    left_panel_x = 40

    left_panel_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    left_draw = ImageDraw.Draw(left_panel_layer)

    # Parchment background with gradient
    left_bbox = (left_panel_x, main_top, left_panel_x + left_panel_width, main_bottom)
    create_gradient_vertical(
        left_draw,
        left_bbox,
        hex_to_rgb(PARCHMENT_LIGHT),
        hex_to_rgb(PARCHMENT_MID)
    )

    # Add subtle texture
    add_texture_noise(left_panel_layer, intensity=10)

    # Torn paper edge effect (right side)
    for i in range(main_top, main_bottom, 8):
        offset = (i % 16) // 4
        left_draw.line(
            [(left_panel_x + left_panel_width - 2 - offset, i),
             (left_panel_x + left_panel_width - 2 - offset, i + 4)],
            fill=hex_to_rgb(PARCHMENT_MID),
            width=2
        )

    img.paste(left_panel_layer, (0, 0), left_panel_layer)

    # Book tabs (navigation items)
    tab_height = 60
    tab_spacing = 10
    tab_start_y = main_top + 40
    tabs = ['Quest', 'Map', 'Party', 'Items', 'Skills']

    for i, tab in enumerate(tabs):
        tab_y = tab_start_y + i * (tab_height + tab_spacing)
        # Tab bookmark shape
        draw.rectangle(
            [(left_panel_x + 20, tab_y), (left_panel_x + left_panel_width - 30, tab_y + tab_height)],
            fill=hex_to_rgb(DUNGEON_STONE),
            outline=hex_to_rgb(BRONZE_TRIM),
            width=2
        )

    # RIGHT PANEL (Magic Crystal Ball Info)
    right_panel_width = 340
    right_panel_x = WIDTH - 40 - right_panel_width

    right_panel_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    right_draw = ImageDraw.Draw(right_panel_layer)

    # Crystalline panel with glow
    right_bbox = (right_panel_x, main_top, right_panel_x + right_panel_width, main_bottom)

    # Add glow first
    add_glow_effect(right_panel_layer, right_bbox, HESTIA_BLUE_GLOW, blur_radius=30, intensity=0.4)

    # Semi-transparent dark background
    right_draw.rounded_rectangle(
        right_bbox,
        radius=24,
        fill=hex_to_rgb(DUNGEON_STONE) + (200,),
        outline=hex_to_rgb(HESTIA_BLUE),
        width=2
    )

    img.paste(right_panel_layer, (0, 0), right_panel_layer)

    # CENTER PANEL (Adventure Journal)
    center_left = left_panel_x + left_panel_width + 30
    center_right = right_panel_x - 30
    center_width = center_right - center_left

    center_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    center_draw = ImageDraw.Draw(center_layer)

    # Aged paper journal
    center_bbox = (center_left, main_top, center_right, main_bottom)
    create_gradient_vertical(
        center_draw,
        center_bbox,
        hex_to_rgb(PARCHMENT_LIGHT),
        (245, 240, 230)
    )

    # Add paper texture
    add_texture_noise(center_layer, intensity=12)

    # Weathered edges
    center_draw.rectangle(
        center_bbox,
        outline=hex_to_rgb(BRONZE_TRIM),
        width=2
    )

    img.paste(center_layer, (0, 0), center_layer)

    # === SAMPLE COMPONENTS ===

    # SAMPLE BUTTON (Metallic with glow)
    button_width = 200
    button_height = 50
    button_x = center_left + (center_width - button_width) // 2
    button_y = main_top + 60

    button_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    button_draw = ImageDraw.Draw(button_layer)

    # Glow effect
    add_glow_effect(
        button_layer,
        (button_x - 10, button_y - 10, button_x + button_width + 10, button_y + button_height + 10),
        GUILD_GOLD,
        blur_radius=20,
        intensity=0.5
    )

    # Button body
    button_draw.rounded_rectangle(
        [(button_x, button_y), (button_x + button_width, button_y + button_height)],
        radius=8,
        fill=hex_to_rgb(DUNGEON_STONE),
        outline=hex_to_rgb(GUILD_GOLD),
        width=3
    )

    img.paste(button_layer, (0, 0), button_layer)

    # SAMPLE QUALITY CARDS
    card_width = 180
    card_height = 240
    card_spacing = 40
    cards_start_x = center_left + (center_width - (card_width * 3 + card_spacing * 2)) // 2
    cards_y = main_top + 200

    qualities = [
        ('RARE', HESTIA_BLUE, 0.4),
        ('EPIC', '#a855f7', 0.5),
        ('LEGENDARY', GUILD_GOLD, 0.6)
    ]

    for i, (quality, color, glow_intensity) in enumerate(qualities):
        card_x = cards_start_x + i * (card_width + card_spacing)

        card_layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        card_draw = ImageDraw.Draw(card_layer)

        # Quality glow
        add_glow_effect(
            card_layer,
            (card_x - 15, cards_y - 15, card_x + card_width + 15, cards_y + card_height + 15),
            color,
            blur_radius=25,
            intensity=glow_intensity
        )

        # Card body
        card_draw.rounded_rectangle(
            [(card_x, cards_y), (card_x + card_width, cards_y + card_height)],
            radius=12,
            fill=hex_to_rgb(DUNGEON_STONE) + (240,),
            outline=hex_to_rgb(color),
            width=3
        )

        img.paste(card_layer, (0, 0), card_layer)

    # === FINAL TOUCHES ===
    draw = ImageDraw.Draw(img)

    # Add subtle vignette
    vignette = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    vignette_draw = ImageDraw.Draw(vignette)

    for i in range(200):
        alpha = int((i / 200) * 60)
        vignette_draw.rectangle(
            [(i, i), (WIDTH - i, HEIGHT - i)],
            outline=(0, 0, 0, alpha)
        )

    img.paste(vignette, (0, 0), vignette)

    return img

# Create and save the mockup
print("Creating DXC UI Gamification Mockup...")
mockup = create_ui_mockup()
output_path = r"E:\github\Aha-Loop\docs\dxc-ui-mockup.png"
mockup.save(output_path, 'PNG', quality=95)
print(f"Mockup created: {output_path}")
