
import base64
import io
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("PIL not found. Please run 'pip install Pillow'")
    sys.exit(1)

INPUT_PATH = r'd:\dev\projects\zonds\zonds\packages\ui\src\assets\logo.png'
OUTPUT_PATH = r'd:\dev\projects\zonds\zonds\packages\ui\src\assets\logo.svg'

def main():
    if not os.path.exists(INPUT_PATH):
        print(f"Error: {INPUT_PATH} does not exist.")
        return

    print(f"Opening {INPUT_PATH}...")
    img = Image.open(INPUT_PATH)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    new_data = []
    
    # Tolerance for black background removal
    threshold = 15
    
    for item in datas:
        # Check if pixel is close to black
        if item[0] < threshold and item[1] < threshold and item[2] < threshold:
            # Set to transparent (0,0,0,0)
            new_data.append((0, 0, 0, 0)) 
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    print("Background removed (converted black to transparent).")

    # Save as PNG to memory
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    png_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    width, height = img.size
    
    # Create valid SVG embedding the PNG
    svg_content = f'''<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,{png_base64}" width="{width}" height="{height}" />
</svg>'''

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(svg_content)
        
    print(f"Successfully created transparent SVG at: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
