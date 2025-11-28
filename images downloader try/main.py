import os
import requests
from ddgs import DDGS

def search_and_download(query, limit=10, save_folder="downloaded_images"):
    os.makedirs(save_folder, exist_ok=True)

    print(f"Searching images for: {query}")

    with DDGS() as ddgs:
        results = ddgs.images(
            query,          # <-- positional argument
            max_results=limit
        )

        for idx, result in enumerate(results):
            image_url = result.get("image")
            if not image_url:
                continue

            print(f"Downloading: {image_url}")
            try:
                response = requests.get(image_url, timeout=10)
                response.raise_for_status()

                file_path = os.path.join(save_folder, f"{query}_{idx+1}.jpg")

                with open(file_path, "wb") as f:
                    f.write(response.content)

                print(f"Saved → {file_path}")

            except Exception as e:
                print(f"Failed to download {image_url}: {e}")

    print("Done!")

# Test
search_and_download("newton's law of gravitation force vector diagram", limit=10)
