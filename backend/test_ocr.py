import io
from pprint import pprint

try:
    import pytesseract
    from PIL import Image
    # Just draw a dummy image with some text shape if possible, or just a blank image to see if tesseract binary is found
    img = Image.new('RGB', (100, 30), color = (73, 109, 137))
    print("Testing Tesseract invocation...")
    text = pytesseract.image_to_string(img)
    print("Success. Output:", repr(text))
except Exception as e:
    print("Error:", type(e).__name__, "-", e)
