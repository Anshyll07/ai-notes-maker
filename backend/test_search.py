from image_search import search_and_download_images
import os

print("Testing image search...")
try:
    results = search_and_download_images("tiger", limit=1)
    print(f"Results: {results}")
    if results:
        print("Success!")
    else:
        print("No results found.")
except Exception as e:
    print(f"Error: {e}")
