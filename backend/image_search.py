import os
import requests
import time
from duckduckgo_search import DDGS
import random

def search_and_download_images(query, limit=10, save_folder="downloaded_images"):

    # Ensure absolute path for save_folder
    if not os.path.isabs(save_folder):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        save_folder = os.path.join(base_dir, save_folder)

    os.makedirs(save_folder, exist_ok=True)
    
    print(f"Searching images for: {query}")
    downloaded_images = []

    # Create a session for better connection handling
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/"
    })

    # Retry logic with exponential backoff
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            # Add random delay before search (2-5 seconds)
            wait_time = random.uniform(3, 6)
            print(f"Waiting {wait_time:.1f} seconds before search (attempt {attempt + 1}/{max_retries})...")
            time.sleep(wait_time)
            
            # Search with smaller batch to reduce rate limit issues
            # Use safesearch and region parameters for better results
            results = DDGS().images(
                keywords=query,
                region="wt-wt",  # Worldwide
                safesearch="moderate",
                max_results=min(limit, 20)  # Cap at 20 to avoid rate limits
            )
            
            # Convert to list
            results = list(results)
            print(f"Found {len(results)} results")
            
            if not results:
                print("No results found. Trying again...")
                continue

            # Download images with delays
            for idx, result in enumerate(results[:limit]):
                image_url = result.get('image')
                if not image_url:
                    continue

                print(f"Downloading {idx+1}/{min(len(results), limit)}: {image_url[:60]}...")
                try:
                    response = session.get(image_url, timeout=10, stream=True)
                    response.raise_for_status()

                    # Determine file extension
                    content_type = response.headers.get('content-type', '').lower()
                    if 'jpeg' in content_type or 'jpg' in content_type:
                        ext = '.jpg'
                    elif 'png' in content_type:
                        ext = '.png'
                    elif 'gif' in content_type:
                        ext = '.gif'
                    elif 'webp' in content_type:
                        ext = '.webp'
                    else:
                        ext = os.path.splitext(image_url.split('?')[0])[1] or '.jpg'

                    # Create safe filename
                    safe_query = "".join([c for c in query if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_')
                    filename = f"{safe_query}_{idx+1}{ext}"
                    file_path = os.path.join(save_folder, filename)

                    with open(file_path, "wb") as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)

                    print(f"✓ Saved: {filename}")
                    
                    downloaded_images.append({
                        "original_url": image_url,
                        "filename": filename,
                        "local_path": file_path
                    })

                    # Random delay between downloads (1-3 seconds)
                    time.sleep(random.uniform(1.5, 3))

                except requests.exceptions.RequestException as e:
                    print(f"✗ Failed to download: {str(e)[:100]}")
                except Exception as e:
                    print(f"✗ Error: {str(e)[:100]}")
            
            # If we got here, search was successful
            break
                    
        except Exception as e:
            print(f"Search failed (attempt {attempt + 1}/{max_retries}): {e}")
            
            # Check if it's a rate limit error
            if "403" in str(e) or "Ratelimit" in str(e):
                if attempt < max_retries - 1:
                    # Exponential backoff: 5s, 10s, 20s
                    wait_time = retry_delay * (2 ** attempt)
                    print(f"Rate limit hit. Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                else:
                    print("Max retries reached. Try again later or use a different search method.")
                    break
            else:
                # For non-rate-limit errors, break immediately
                print("Non-rate-limit error encountered.")
                break

    session.close()
    print(f"Successfully downloaded {len(downloaded_images)}/{limit} images!")
    return downloaded_images