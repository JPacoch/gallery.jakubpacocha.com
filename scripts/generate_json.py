import cloudinary
import cloudinary.api
import json
import math
import os

from dotenv import load_dotenv

load_dotenv()


cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "your_cloud_name")
api_key = os.getenv("CLOUDINARY_API_KEY", "your_key")
api_secret = os.getenv("CLOUDINARY_API_SECRET", "your_secret")


if not all([cloud_name, api_key, api_secret]):
    print("Error: Cloudinary credentials missing from .env file!")
else:
    cloudinary.config(
        cloud_name = cloud_name,
        api_key = api_key,
        api_secret = api_secret,
        secure = True
    )

def get_gcd(a, b):
    return math.gcd(a, b)

def get_all_photos():
    all_photos = []
    root_folder = "" 

    try:
        # fetch folders
        if root_folder:
            print(f"Scanning subfolders of: {root_folder}...")
            folder_resp = cloudinary.api.subfolders(root_folder, max_results=500)
        else:
            print("Scanning all root folders...")
            folder_resp = cloudinary.api.root_folders(max_results=500)
        
        folder_paths = [f['path'] for f in folder_resp.get('folders', [])]
        folder_paths.append(root_folder)

        for folder_path in folder_paths:
            display_name = folder_path if folder_path else "Root"
            print(f"Fetching images from: {display_name}...")
            
            resources = cloudinary.api.resources(
                type = "upload",
                prefix = folder_path,
                image_metadata = True,
                max_results = 500
            )

            for res in resources.get('resources', []):
                pid = res.get('public_id', '')
                current_file_path = pid.rsplit('/', 1)[0] if '/' in pid else ""
                
                if current_file_path != folder_path:
                    continue

                meta = res.get('image_metadata', {})
                w, h = res.get('width', 0), res.get('height', 0)
                
                if w > 0 and h > 0:
                    common = get_gcd(w, h)
                    simple_ratio = f"{w//common}:{h//common}"
                else:
                    simple_ratio = "Unknown"

                if folder_path:
                    category_name = str(folder_path).split('/')[-1].replace('-', ' ').replace('_', ' ').title()
                else:
                    category_name = "General"

                raw_filename = res.get('filename')
                clean_title = str(raw_filename).replace('-', ' ').replace('_', ' ').title() if raw_filename else "Untitled"

                all_photos.append({
                    "id": "", 
                    "publicId": pid,
                    "title": clean_title,
                    "category": category_name,
                    "year": (res.get('created_at') or "2026")[:4],
                    "created_at": res.get('created_at'), # Keep for sorting
                    "aspectRatio": simple_ratio,
                    "orientation": "landscape" if w > h else "portrait",
                    "exif": {
                        "camera": meta.get('Model', 'Unknown'),
                        "lens": meta.get('LensModel', 'Unknown'),
                        "aperture": f"f/{meta.get('FNumber')}" if meta.get('FNumber') else "N/A",
                        "shutter": f"{meta.get('ExposureTime')}s" if meta.get('ExposureTime') else "N/A",
                        "iso": str(meta.get('ISO', 'N/A'))
                    }
                })

        all_photos.sort(key=lambda x: x['created_at'] or "", reverse=False)

        for i, photo in enumerate(all_photos, 1):
            photo['id'] = str(i)
            del photo['created_at']

        with open('photos.json', 'w') as f:
            json.dump({"photos": all_photos}, f, indent=2)
        
        print(f"\nSuccess! photo.json created with {len(all_photos)} photos.")
        print("Order: oldest is ID 1, newest is ID", len(all_photos))

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    get_all_photos()